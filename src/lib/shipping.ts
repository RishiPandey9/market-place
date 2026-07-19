// ==============================================================
// Shipping / carrier aggregator client (Phase 1.9)
// ==============================================================
// Approved stack: Sendcloud / EasyPost / ShipEngine (one, TBD). Keys are
// deferred per the project owner, so this module provides a SANDBOX client that
// returns deterministic fake rates + labels when no aggregator key is set.
//
// SANDBOX FLAG: this MUST be swapped for a real carrier integration before
// launch. It is gated on SHIPPING_API_KEY — set the key and implement the live
// branch to switch over. Never leave sandbox active in production.

export type ShippingRate = {
  optionId: string;
  carrier: string;
  service: string;
  price: number; // in major currency units
  currency: string;
  estimatedDays: number;
};

export type ShippingLabel = {
  carrier: string;
  trackingNumber: string;
  labelUrl: string;
};

function sandboxEnabled(): boolean {
  return !process.env.SHIPPING_API_KEY;
}

// Flat sandbox rate table keyed by parcel size. Live rates will come from the
// aggregator's rate endpoint using origin/destination + parcel dimensions.
const SANDBOX_RATES: Record<string, number> = {
  small: 3.29,
  medium: 3.99,
  large: 5.99,
  custom: 8.99,
};

export async function getShippingRates(params: {
  parcelSize: string;
  currency: string;
  fromCountry: string;
  toCountry: string;
}): Promise<ShippingRate[]> {
  if (sandboxEnabled()) {
    const base = SANDBOX_RATES[params.parcelSize] ?? SANDBOX_RATES.medium;
    return [
      {
        optionId: "sandbox-standard",
        carrier: "SandboxPost",
        service: "Standard",
        price: base,
        currency: params.currency,
        estimatedDays: 3,
      },
      {
        optionId: "sandbox-express",
        carrier: "SandboxPost",
        service: "Express",
        price: Math.round((base + 2.5) * 100) / 100,
        currency: params.currency,
        estimatedDays: 1,
      },
    ];
  }

  // TODO(live): call the configured aggregator's rate endpoint.
  throw new Error("Live shipping rate fetch not implemented — SHIPPING_API_KEY is set but no live client exists yet.");
}

export async function createShippingLabel(params: {
  orderId: string;
  carrier?: string;
}): Promise<ShippingLabel> {
  if (sandboxEnabled()) {
    // Deterministic fake tracking number so tests/repeat calls are stable.
    const tracking = `SBX${params.orderId.slice(-8).toUpperCase()}`;
    return {
      carrier: params.carrier ?? "SandboxPost",
      trackingNumber: tracking,
      labelUrl: `https://sandbox.local/labels/${params.orderId}.pdf`,
    };
  }

  // TODO(live): call the configured aggregator's label endpoint.
  throw new Error("Live label generation not implemented — SHIPPING_API_KEY is set but no live client exists yet.");
}

export function isShippingSandbox(): boolean {
  return sandboxEnabled();
}
