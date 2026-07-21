"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Slugify a title into a url-safe slug as a starting point (admin can edit).
function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Admin create-content-page form (CMS & SEO section). RBAC enforced server-side
// by /api/admin/cms (cms.manage).
export function CreateContentControl() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [body, setBody] = useState("");
  const [isBlog, setIsBlog] = useState(false);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onTitle(v: string) {
    setTitle(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/cms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: slug.trim(),
        title: title.trim(),
        body,
        isBlog,
        status,
        metaTitle: metaTitle.trim(),
        metaDescription: metaDescription.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to create page");
      setBusy(false);
      return;
    }
    setTitle("");
    setSlug("");
    setSlugTouched(false);
    setBody("");
    setMetaTitle("");
    setMetaDescription("");
    setStatus("DRAFT");
    setIsBlog(false);
    setOpen(false);
    setBusy(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        New page / post
      </button>
    );
  }

  const inputClass =
    "w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

  return (
    <div className="space-y-3 rounded-2xl border border-brand-100 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">New content page</h2>
        <button
          onClick={() => setOpen(false)}
          className="text-xs font-medium text-ink-soft hover:text-brand-700"
        >
          Cancel
        </button>
      </div>

      <input
        value={title}
        onChange={(e) => onTitle(e.target.value)}
        placeholder="Title (e.g. How Buyer Protection Works)"
        className={inputClass}
      />
      <div>
        <input
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          placeholder="url-slug"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-ink-soft">
          URL: /help/{slug || "your-slug"}
        </p>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Body (markdown supported)"
        rows={6}
        className={inputClass}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          value={metaTitle}
          onChange={(e) => setMetaTitle(e.target.value)}
          placeholder="SEO meta title (optional)"
          className={inputClass}
        />
        <input
          value={metaDescription}
          onChange={(e) => setMetaDescription(e.target.value)}
          placeholder="SEO meta description (optional)"
          className={inputClass}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={isBlog}
            onChange={(e) => setIsBlog(e.target.checked)}
            className="h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-500/30"
          />
          Blog post
        </label>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button
        onClick={submit}
        disabled={busy || title.trim().length < 2 || slug.trim().length < 1 || body.trim().length < 1}
        className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Create page"}
      </button>
    </div>
  );
}
