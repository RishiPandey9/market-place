import { describe, it, expect } from "vitest";

import {
  sameSeller,
  hasDuplicates,
  calculateBundlePricing,
  BUNDLE_MIN_ITEMS,
  BUNDLE_MAX_ITEMS,
} from "@/lib/bundle";
import { calculateProtectionFee, round2 } from "@/lib/escrow";

describe("sameSeller", () => {
  it("is true when every listing has the same seller", () => {
    expect(sameSeller(["s1", "s1", "s1"])).toBe(true);
  });
  it("is false when sellers differ", () => {
    expect(sameSeller(["s1", "s2"])).toBe(false);
  });
  it("is false for an empty set (nothing to bundle)", () => {
    expect(sameSeller([])).toBe(false);
  });
  it("is true for a single seller id", () => {
    expect(sameSeller(["s1"])).toBe(true);
  });
});

describe("hasDuplicates", () => {
  it("detects a repeated listing id", () => {
    expect(hasDuplicates(["a", "b", "a"])).toBe(true);
  });
  it("is false when all ids are distinct", () => {
    expect(hasDuplicates(["a", "b", "c"])).toBe(false);
  });
});

describe("bundle size bounds", () => {
  it("requires at least 2 items", () => {
    expect(BUNDLE_MIN_ITEMS).toBe(2);
  });
  it("caps at 20 items", () => {
    expect(BUNDLE_MAX_ITEMS).toBe(20);
  });
});

describe("calculateBundlePricing", () => {
  it("charges shipping exactly once, on the first line", () => {
    const p = calculateBundlePricing(
      [
        { listingId: "a", itemPrice: 20 },
        { listingId: "b", itemPrice: 30 },
        { listingId: "c", itemPrice: 10 },
      ],
      3.99,
    );
    expect(p.lines[0].shippingPrice).toBe(3.99);
    expect(p.lines[1].shippingPrice).toBe(0);
    expect(p.lines[2].shippingPrice).toBe(0);
    // Total shipping across the bundle is a single 3.99.
    const totalShipping = p.lines.reduce((s, l) => s + l.shippingPrice, 0);
    expect(round2(totalShipping)).toBe(3.99);
    expect(p.shippingPrice).toBe(3.99);
  });

  it("keeps a per-item protection fee on every line", () => {
    const p = calculateBundlePricing(
      [
        { listingId: "a", itemPrice: 20 },
        { listingId: "b", itemPrice: 30 },
      ],
      3.99,
    );
    expect(p.lines[0].protectionFee).toBe(calculateProtectionFee(20));
    expect(p.lines[1].protectionFee).toBe(calculateProtectionFee(30));
    expect(p.protectionSubtotal).toBe(
      round2(calculateProtectionFee(20) + calculateProtectionFee(30)),
    );
  });

  it("grand total equals items + one shipping + all protection fees", () => {
    const items = [
      { listingId: "a", itemPrice: 19.99 },
      { listingId: "b", itemPrice: 45.5 },
    ];
    const shipping = 4.5;
    const p = calculateBundlePricing(items, shipping);

    const expectedItems = round2(19.99 + 45.5);
    const expectedProtection = round2(
      calculateProtectionFee(19.99) + calculateProtectionFee(45.5),
    );
    const expectedGrand = round2(expectedItems + shipping + expectedProtection);

    expect(p.itemsSubtotal).toBe(expectedItems);
    expect(p.protectionSubtotal).toBe(expectedProtection);
    expect(p.grandTotal).toBe(expectedGrand);
  });

  it("each line's total is internally consistent (item + shipping + protection)", () => {
    const p = calculateBundlePricing(
      [
        { listingId: "a", itemPrice: 12.34 },
        { listingId: "b", itemPrice: 56.78 },
      ],
      2.99,
    );
    for (const line of p.lines) {
      expect(line.totalPrice).toBe(
        round2(line.itemPrice + line.shippingPrice + line.protectionFee),
      );
    }
  });

  it("sum of per-line totals equals the grand total (no money lost or created)", () => {
    const p = calculateBundlePricing(
      [
        { listingId: "a", itemPrice: 7.77 },
        { listingId: "b", itemPrice: 8.88 },
        { listingId: "c", itemPrice: 9.99 },
      ],
      5,
    );
    const sumLines = round2(p.lines.reduce((s, l) => s + l.totalPrice, 0));
    expect(sumLines).toBe(p.grandTotal);
  });
});
