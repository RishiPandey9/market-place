import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ListingForm, type ListingFormValues } from "@/components/listing/ListingForm";

export const metadata = { title: "Edit listing" };

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/listings/${id}/edit`);
  }

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing || listing.sellerId !== session.user.id) {
    notFound();
  }

  const initialValues: Partial<ListingFormValues> = {
    title: listing.title,
    description: listing.description,
    categoryId: listing.categoryId,
    brand: listing.brand ?? "",
    size: listing.size ?? "",
    condition: listing.condition ?? "",
    color: listing.color ?? "",
    price: listing.price.toString(),
    currency: listing.currency,
    parcelSize: listing.parcelSize,
    images: listing.images,
    country: listing.country,
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink">
        Edit listing
      </h1>
      <ListingForm listingId={listing.id} initialValues={initialValues} />
    </main>
  );
}
