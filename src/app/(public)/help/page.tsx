import Link from "next/link";

export const metadata = { title: "Help & FAQ" };

const FAQ: { q: string; a: string }[] = [
  {
    q: "How does buyer protection work?",
    a: "When you buy, your payment is held in escrow — not paid to the seller — until you confirm the item arrived as described. If it doesn't, raise a dispute before confirming and our team will review it.",
  },
  {
    q: "When do I get paid as a seller?",
    a: "Once the buyer confirms delivery (or the auto-confirm window passes), the funds move to your wallet's available balance. You can withdraw once your identity is verified.",
  },
  {
    q: "Why do I need to verify my identity to withdraw?",
    a: "Identity verification (Level 3) is a legal and anti-fraud requirement before we can send real payouts to your bank. Browsing and buying only need basic verification.",
  },
  {
    q: "How do I raise a dispute?",
    a: "Open the order and choose 'Raise a dispute' before confirming delivery. This freezes the seller's payout while our trust & safety team reviews it and resolves it by refund or release.",
  },
  {
    q: "How do I change my notification settings?",
    a: "Go to Settings → Notifications and toggle the email and in-app updates you want to receive.",
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-800">
        ← Back to marketplace
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gray-900">
        Help &amp; FAQ
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Answers to common questions about buying, selling, and payouts.
      </p>

      <dl className="mt-8 space-y-6">
        {FAQ.map((item) => (
          <div key={item.q} className="rounded-lg border border-gray-200 bg-white p-5">
            <dt className="text-sm font-semibold text-gray-900">{item.q}</dt>
            <dd className="mt-2 text-sm text-gray-600">{item.a}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 rounded-lg bg-gray-50 px-5 py-4 text-sm text-gray-600">
        <p className="font-medium text-gray-900">Still need help?</p>
        <p className="mt-1">
          A support ticket system is planned. For now, reach out through the
          contact channel provided at launch.
        </p>
      </div>
    </div>
  );
}
