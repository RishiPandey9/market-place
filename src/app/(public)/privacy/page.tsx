import { LegalPage } from "@/components/legal/LegalPage";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="19 July 2026">
      <h2 className="text-base font-semibold text-gray-900">1. Data we hold</h2>
      <p>
        We store the account details you provide (email, optional phone, region),
        your listings and orders, and the messages you exchange with counterparties.
        Payment and identity verification are handled by our payment and KYC
        providers; we do not store raw card numbers or identity documents.
      </p>
      <h2 className="text-base font-semibold text-gray-900">2. How we use it</h2>
      <p>
        Your data is used to operate the marketplace: matching buyers and sellers,
        processing escrow, preventing fraud, and meeting legal and tax obligations.
      </p>
      <h2 className="text-base font-semibold text-gray-900">3. Your rights</h2>
      <p>
        You may request a copy of your data or its deletion, subject to the records
        we are legally required to retain (for example, transaction and tax records).
      </p>
      <h2 className="text-base font-semibold text-gray-900">4. Notification preferences</h2>
      <p>
        You control which emails and in-app notifications you receive from your{" "}
        account settings. Essential transactional messages about your orders may
        still be sent.
      </p>
    </LegalPage>
  );
}
