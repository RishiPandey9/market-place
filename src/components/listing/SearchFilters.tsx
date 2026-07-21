"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Category = { id: string; name: string; parentId: string | null };

const SORTS = [
  { value: "recent", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

const inputClass =
  "w-full rounded-xl border border-brand-200 px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

// Client filter form for the search page. Reads current values from the URL,
// pushes updates back into the query string (server component re-renders).
export function SearchFilters({ basePath = "/search" }: { basePath?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => setCategories([]));
  }, []);

  function submit(form: FormData) {
    const next = new URLSearchParams();
    // Preserve an existing category lock (category browse page) if present.
    const lockedCategory = params.get("categoryId");
    if (lockedCategory) next.set("categoryId", lockedCategory);

    for (const [key, value] of form.entries()) {
      const v = String(value).trim();
      if (v) next.set(key, v);
    }
    router.push(`${basePath}?${next.toString()}`);
  }

  return (
    <form
      action={submit}
      className="space-y-4 rounded-2xl border border-brand-100 bg-white p-4"
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft">
          Keyword
        </label>
        <input
          name="q"
          defaultValue={params.get("q") ?? ""}
          placeholder="Search title, brand…"
          className={inputClass}
        />
      </div>

      {!params.get("categoryId") && (
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">
            Category
          </label>
          <select
            name="categoryId"
            defaultValue={params.get("categoryId") ?? ""}
            className={inputClass}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft">
          Brand
        </label>
        <input
          name="brand"
          defaultValue={params.get("brand") ?? ""}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">
            Size
          </label>
          <input
            name="size"
            defaultValue={params.get("size") ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">
            Color
          </label>
          <input
            name="color"
            defaultValue={params.get("color") ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft">
          Condition
        </label>
        <input
          name="condition"
          defaultValue={params.get("condition") ?? ""}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">
            Min price
          </label>
          <input
            name="minPrice"
            type="number"
            min="0"
            step="0.01"
            defaultValue={params.get("minPrice") ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">
            Max price
          </label>
          <input
            name="maxPrice"
            type="number"
            min="0"
            step="0.01"
            defaultValue={params.get("maxPrice") ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft">
          Sort
        </label>
        <select
          name="sort"
          defaultValue={params.get("sort") ?? "recent"}
          className={inputClass}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        Apply filters
      </button>
    </form>
  );
}
