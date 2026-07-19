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
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none";

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
      className="space-y-4 rounded-lg border border-gray-200 p-4"
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">
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
          <label className="mb-1 block text-xs font-medium text-gray-500">
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
        <label className="mb-1 block text-xs font-medium text-gray-500">
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
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Size
          </label>
          <input
            name="size"
            defaultValue={params.get("size") ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
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
        <label className="mb-1 block text-xs font-medium text-gray-500">
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
          <label className="mb-1 block text-xs font-medium text-gray-500">
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
          <label className="mb-1 block text-xs font-medium text-gray-500">
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
        <label className="mb-1 block text-xs font-medium text-gray-500">
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
        className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Apply filters
      </button>
    </form>
  );
}
