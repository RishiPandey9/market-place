import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { ListingForm } from "@/components/listing/ListingForm";

export const metadata = { title: "New listing" };

export default async function NewListingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/listings/new");
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          New listing
        </h1>
        <Link
          href="/my-listings"
          className="text-sm font-medium text-ink-soft underline"
        >
          My listings
        </Link>
      </div>
      <ListingForm />
    </main>
  );
}
