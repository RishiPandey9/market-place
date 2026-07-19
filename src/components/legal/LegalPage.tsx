import Link from "next/link";

// Static legal/support pages share this centered prose shell. Content here is
// placeholder scaffolding for launch — replace with counsel-reviewed copy before
// going live (Phase 0 legal deliverables).
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-800">
        ← Back to marketplace
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-gray-900">
        {title}
      </h1>
      <p className="mt-1 text-sm text-gray-400">Last updated {updated}</p>
      <div className="prose prose-sm mt-8 max-w-none space-y-4 text-gray-700">
        {children}
      </div>
      <p className="mt-10 rounded-md bg-amber-50 px-4 py-3 text-xs text-amber-700">
        Placeholder text pending legal review. This is not the final policy and
        must be replaced with counsel-approved wording before public launch.
      </p>
    </div>
  );
}
