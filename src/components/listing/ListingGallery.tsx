"use client";

import { useState } from "react";

// Listing image gallery (redesign). Client component so thumbnails swap the
// main image without a round-trip. Images are interim remote CDN URLs (see
// ListingCard note); rendered with <img> to avoid next/image host config.
export function ListingGallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 text-sm text-gray-400">
        No image
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="aspect-square w-full overflow-hidden rounded-2xl border border-gray-100 bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[active]}
          alt={title}
          className="h-full w-full object-cover"
        />
      </div>

      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {images.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              className={`aspect-square overflow-hidden rounded-lg border-2 transition ${
                i === active
                  ? "border-brand-500"
                  : "border-transparent hover:border-gray-200"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
