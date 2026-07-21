import { calculateProtectionFee, round2, type OrderPricing } from "@/lib/escrow";

// ==============================================================
// Bundles core (SOW §09 "smart bundles").
// ==============================================================
// A buyer groups 2–20 ACTIVE listings from the SAME seller and buys them in one
// go, paying shipping ONCE instead of per item — that combined-postage saving is
// the whole point of a bundle. Pure functions only (no DB, no network) so the
// pricing and grouping rules are unit-testable per CLAUDE.md #7 (bundles move
// money at checkout). The route handlers compose these against the DB.
//
// Data model note: the schema links a Bundle to its BundleItems, but NOT to an
// Order (Order.listingId is single-listing, and adding a bundleId would need a
// migration — out of scope here). So a bundle checkout is modelled as one escrow
// Order PER listing, created atomically, with the shipping fee charged once
// across the whole set. Each item still clears escrow independently, which keeps
// dispute/refund/release working per-item exactly as for a solo purchase.

export const BUNDLE_MIN_ITEMS = 2;
export const BUNDLE_MAX_ITEMS = 20;

// A bundle is only valid if every listing belongs to the same seller.
export function sameSeller(sellerIds: string[]): boolean {
  if (sellerIds.length === 0) return false;
  return sellerIds.every((s) => s === sellerIds[0]);
}

// Reject duplicate listing ids in a bundle request (a listing can appear once).
export function hasDuplicates(listingIds: string[]): boolean {
  return new Set(listingIds).size !== listingIds.length;
}

export type BundleItemInput = {
  listingId: string;
  itemPrice: number;
};

export type BundleOrderLine = OrderPricing & { listingId: string };

export type BundlePricing = {
  lines: BundleOrderLine[];
  itemsSubtotal: number;
  shippingPrice: number;
  protectionSubtotal: number;
  grandTotal: number;
};

// Price a bundle: each item keeps its own buyer-protection fee (protection is
// per item, matching a solo purchase), but shipping is charged ONCE for the
// whole bundle. To keep each Order a self-consistent escrow record whose columns
// still sum to the grand total, the single shipping charge is attached to the
// first line only; every other line carries zero shipping.
export function calculateBundlePricing(
  items: BundleItemInput[],
  shippingPrice: number,
): BundlePricing {
  const shipping = round2(shippingPrice);

  const lines: BundleOrderLine[] = items.map((item, index) => {
    const itemPrice = round2(item.itemPrice);
    const protectionFee = calculateProtectionFee(itemPrice);
    // Shipping charged once, on the first line only.
    const lineShipping = index === 0 ? shipping : 0;
    const totalPrice = round2(itemPrice + lineShipping + protectionFee);
    return {
      listingId: item.listingId,
      itemPrice,
      shippingPrice: lineShipping,
      protectionFee,
      totalPrice,
    };
  });

  const itemsSubtotal = round2(lines.reduce((sum, l) => sum + l.itemPrice, 0));
  const protectionSubtotal = round2(
    lines.reduce((sum, l) => sum + l.protectionFee, 0),
  );
  const grandTotal = round2(lines.reduce((sum, l) => sum + l.totalPrice, 0));

  return {
    lines,
    itemsSubtotal,
    shippingPrice: shipping,
    protectionSubtotal,
    grandTotal,
  };
}
