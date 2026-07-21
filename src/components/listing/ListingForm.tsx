"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; name: string; parentId: string | null };

export type ListingFormValues = {
  title: string;
  description: string;
  categoryId: string;
  brand: string;
  size: string;
  condition: string;
  color: string;
  price: string;
  currency: string;
  parcelSize: string;
  images: string[];
  country: string;
};

const PARCEL_SIZES = ["small", "medium", "large", "custom"] as const;

const EMPTY: ListingFormValues = {
  title: "",
  description: "",
  categoryId: "",
  brand: "",
  size: "",
  condition: "",
  color: "",
  price: "",
  currency: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "GBP",
  parcelSize: "small",
  images: [],
  country: process.env.NEXT_PUBLIC_DEFAULT_COUNTRY ?? "GB",
};

const inputClass =
  "mt-1 block w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

// Shared create/edit form. `listingId` present => edit mode (PATCH), else create.
export function ListingForm({
  listingId,
  initialValues,
}: {
  listingId?: string;
  initialValues?: Partial<ListingFormValues>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ListingFormValues>({
    ...EMPTY,
    ...initialValues,
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [imageInput, setImageInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => setCategories([]));
  }, []);

  function set<K extends keyof ListingFormValues>(
    key: K,
    value: ListingFormValues[K]
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function addImage() {
    const url = imageInput.trim();
    if (!url) return;
    set("images", [...values.images, url]);
    setImageInput("");
  }

  function removeImage(index: number) {
    set(
      "images",
      values.images.filter((_, i) => i !== index)
    );
  }

  async function submit(status: "DRAFT" | "ACTIVE") {
    setError(null);
    setFieldErrors({});
    setSubmitting(true);

    const payload = {
      title: values.title,
      description: values.description,
      categoryId: values.categoryId,
      brand: values.brand,
      size: values.size,
      condition: values.condition,
      color: values.color,
      price: values.price,
      currency: values.currency,
      parcelSize: values.parcelSize,
      images: values.images,
      country: values.country,
      status,
    };

    const res = await fetch(
      listingId ? `/api/listings/${listingId}` : "/api/listings",
      {
        method: listingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      if (data.issues) setFieldErrors(data.issues);
      return;
    }

    const data = await res.json();
    router.push(`/listing/${data.listing.id}`);
    router.refresh();
  }

  function fieldError(name: string) {
    const msg = fieldErrors[name]?.[0];
    return msg ? (
      <p className="mt-1 text-xs text-rose-600">{msg}</p>
    ) : null;
  }

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="space-y-5"
    >
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-ink-soft">
          Title
        </label>
        <input
          id="title"
          className={inputClass}
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
        />
        {fieldError("title")}
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-ink-soft"
        >
          Description
        </label>
        <textarea
          id="description"
          rows={4}
          className={inputClass}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
        />
        {fieldError("description")}
      </div>

      <div>
        <label
          htmlFor="categoryId"
          className="block text-sm font-medium text-ink-soft"
        >
          Category
        </label>
        <select
          id="categoryId"
          className={inputClass}
          value={values.categoryId}
          onChange={(e) => set("categoryId", e.target.value)}
        >
          <option value="">Select a category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {fieldError("categoryId")}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="brand" className="block text-sm font-medium text-ink-soft">
            Brand
          </label>
          <input
            id="brand"
            className={inputClass}
            value={values.brand}
            onChange={(e) => set("brand", e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="size" className="block text-sm font-medium text-ink-soft">
            Size
          </label>
          <input
            id="size"
            className={inputClass}
            value={values.size}
            onChange={(e) => set("size", e.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor="condition"
            className="block text-sm font-medium text-ink-soft"
          >
            Condition
          </label>
          <input
            id="condition"
            className={inputClass}
            value={values.condition}
            onChange={(e) => set("condition", e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="color" className="block text-sm font-medium text-ink-soft">
            Color
          </label>
          <input
            id="color"
            className={inputClass}
            value={values.color}
            onChange={(e) => set("color", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-ink-soft">
            Price
          </label>
          <input
            id="price"
            inputMode="decimal"
            className={inputClass}
            value={values.price}
            onChange={(e) => set("price", e.target.value)}
          />
          {fieldError("price")}
        </div>
        <div>
          <label
            htmlFor="currency"
            className="block text-sm font-medium text-ink-soft"
          >
            Currency
          </label>
          <input
            id="currency"
            maxLength={3}
            className={`${inputClass} uppercase`}
            value={values.currency}
            onChange={(e) => set("currency", e.target.value.toUpperCase())}
          />
          {fieldError("currency")}
        </div>
        <div>
          <label
            htmlFor="country"
            className="block text-sm font-medium text-ink-soft"
          >
            Country
          </label>
          <input
            id="country"
            maxLength={2}
            className={`${inputClass} uppercase`}
            value={values.country}
            onChange={(e) => set("country", e.target.value.toUpperCase())}
          />
          {fieldError("country")}
        </div>
      </div>

      <div>
        <label
          htmlFor="parcelSize"
          className="block text-sm font-medium text-ink-soft"
        >
          Parcel size
        </label>
        <select
          id="parcelSize"
          className={inputClass}
          value={values.parcelSize}
          onChange={(e) => set("parcelSize", e.target.value)}
        >
          {PARCEL_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {fieldError("parcelSize")}
      </div>

      <div>
        <label className="block text-sm font-medium text-ink-soft">
          Image URLs
        </label>
        <p className="mt-0.5 text-xs text-ink-soft">
          Interim: paste image URLs. Direct upload (Cloudinary) comes later.
        </p>
        <div className="mt-1 flex gap-2">
          <input
            className={inputClass.replace("mt-1 ", "")}
            placeholder="https://…"
            value={imageInput}
            onChange={(e) => setImageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addImage();
              }
            }}
          />
          <button
            type="button"
            onClick={addImage}
            className="shrink-0 rounded-xl border border-brand-200 px-3 py-2 text-sm font-semibold text-ink-soft transition hover:bg-brand-50"
          >
            Add
          </button>
        </div>
        {fieldError("images")}
        {values.images.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-3">
            {values.images.map((url, i) => (
              <li key={`${url}-${i}`} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="h-20 w-20 rounded-xl border border-brand-100 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-xs text-white"
                  aria-label="Remove image"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          disabled={submitting}
          onClick={() => submit("ACTIVE")}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Publish"}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => submit("DRAFT")}
          className="rounded-xl border border-brand-200 px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-brand-50 disabled:opacity-50"
        >
          Save draft
        </button>
      </div>
    </form>
  );
}
