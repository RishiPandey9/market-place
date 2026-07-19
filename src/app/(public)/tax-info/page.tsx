import { LegalPage } from "@/components/legal/LegalPage";

export const metadata = { title: "Tax information" };

export default function TaxInfoPage() {
  return (
    <LegalPage title="Tax information" updated="19 July 2026">
      <h2 className="text-base font-semibold text-gray-900">Seller reporting</h2>
      <p>
        Depending on your country and sales volume, the marketplace may be
        required to report seller earnings to tax authorities (for example DAC7 in
        the EU, 1099-K in the US, or HMRC reporting in the UK). We log the
        transaction data needed to meet these obligations.
      </p>
      <h2 className="text-base font-semibold text-gray-900">Your responsibility</h2>
      <p>
        You are responsible for declaring income from sales as required in your
        jurisdiction. This page is general information, not tax advice — consult a
        qualified adviser for your situation.
      </p>
      <h2 className="text-base font-semibold text-gray-900">Records</h2>
      <p>
        Your full transaction history is available in your wallet, and can be used
        to reconcile earnings and fees.
      </p>
    </LegalPage>
  );
}
