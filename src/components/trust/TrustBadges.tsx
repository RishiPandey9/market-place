import { trustBadges, BADGE_LABELS, type TrustSignals } from "@/lib/trust";

// Visible trust badges (SOW 1.2). Renders the "email / phone / ID / payment
// verified" chips derived purely from a user's identity signals. Used on the
// public seller profile and listing pages so buyers can gauge seller trust.
export function TrustBadges({
  signals,
  className = "",
}: {
  signals: TrustSignals;
  className?: string;
}) {
  const badges = trustBadges(signals);
  if (badges.length === 0) return null;

  return (
    <ul className={`flex flex-wrap gap-2 ${className}`} aria-label="Verified">
      {badges.map((b) => (
        <li
          key={b}
          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3 w-3"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
              clipRule="evenodd"
            />
          </svg>
          {BADGE_LABELS[b]}
        </li>
      ))}
    </ul>
  );
}
