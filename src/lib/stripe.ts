import Stripe from "stripe";

// The only place the Stripe SDK is instantiated (per CLAUDE.md constraint #5).
// Route handlers and components must import `stripe` / helpers from here rather
// than constructing their own client.
//
// Instantiation is lazy: the Stripe constructor throws when the secret key is
// missing, and Next's build imports every route module to collect page data.
// A lazy proxy lets those imports succeed while still failing loudly the moment
// Stripe is actually used without a configured key.

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (_stripe) return _stripe;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set — configure it before making Stripe calls."
    );
  }

  _stripe = new Stripe(secretKey, {
    // Pinned to the API version bundled with stripe-node v22.
    apiVersion: "2026-06-24.dahlia",
    typescript: true,
    appInfo: {
      name: "marketplace-app",
    },
  });
  return _stripe;
}

// Proxy that forwards property access to a lazily-created Stripe instance.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    const client = getStripe();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/**
 * Create (or reuse) a Stripe Connect Express account for a seller and return an
 * onboarding link. Returns the accountId so the caller can persist it to
 * User.stripeAccountId.
 */
export async function createConnectOnboardingLink(params: {
  existingAccountId?: string | null;
  email: string;
  country: string;
  refreshUrl: string;
  returnUrl: string;
}): Promise<{ accountId: string; url: string }> {
  let accountId = params.existingAccountId ?? undefined;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: params.email,
      country: params.country,
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      business_type: "individual",
    });
    accountId = account.id;
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: params.refreshUrl,
    return_url: params.returnUrl,
    type: "account_onboarding",
  });

  return { accountId, url: link.url };
}
