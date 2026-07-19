import { LegalPage } from "@/components/legal/LegalPage";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="19 July 2026">
      <h2 className="text-base font-semibold text-gray-900">1. Overview</h2>
      <p>
        These Terms govern your use of the marketplace as a buyer and seller.
        Every account is a single dual-role account. By registering you agree to
        transact honestly and follow the Buyer Protection and Seller policies.
      </p>
      <h2 className="text-base font-semibold text-gray-900">2. Buying and selling</h2>
      <p>
        Payments are held in escrow until a buyer confirms delivery or the
        auto-confirm window elapses. Funds are then released to the seller&apos;s
        wallet and become available for withdrawal once identity verification is
        complete.
      </p>
      <h2 className="text-base font-semibold text-gray-900">3. Prohibited activity</h2>
      <p>
        Counterfeit goods, prohibited items, and attempts to transact off-platform
        to avoid buyer protection are not permitted and may result in suspension.
      </p>
      <h2 className="text-base font-semibold text-gray-900">4. Disputes</h2>
      <p>
        Buyers may raise a dispute on an order, which freezes the payout pending
        review. Our trust &amp; safety team resolves disputes by refund or release.
      </p>
    </LegalPage>
  );
}
