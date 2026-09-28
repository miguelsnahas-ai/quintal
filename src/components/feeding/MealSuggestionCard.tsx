import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import type { MealSuggestion } from "@/lib/feeding";
import type { MealSlot } from "@/lib/validation/feeding";

// Same warm family-tier surface as ActivityCard (rounded-lg, bg-secondary,
// no border) — a suggestion should feel like an invitation, not a data
// row, same reasoning. "Registrar essa refeição" pre-fills the quick-log
// form below via query params — plain links, no client state, matching
// how the rest of /quintal composes forms with searchParams.
export default function MealSuggestionCard({
  suggestion,
  slot,
}: {
  suggestion: MealSuggestion;
  slot: MealSlot;
}) {
  const logHref = `/quintal/alimentacao?slot=${slot}&foods=${encodeURIComponent(
    suggestion.ingredients ?? suggestion.title,
  )}&suggestion=${suggestion.id}#registrar`;

  return (
    <div className="space-y-3 rounded-lg bg-secondary p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent">
          <UtensilsCrossed className="h-4 w-4 text-ink" aria-hidden />
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="font-semibold text-ink">{suggestion.title}</p>
          {suggestion.mealLabel && <p className="text-xs text-ink-muted">{suggestion.mealLabel}</p>}
        </div>
      </div>

      {suggestion.ingredients && (
        <p className="text-sm text-ink">
          <span className="font-medium">Ingredientes: </span>
          {suggestion.ingredients}
        </p>
      )}

      {(suggestion.howTo || suggestion.note) && (
        <p className="text-sm text-ink-muted">
          <span className="font-medium text-ink">Como oferecer: </span>
          {[suggestion.howTo, suggestion.note].filter(Boolean).join(" — ")}
        </p>
      )}

      {suggestion.compatibleMethods.length > 0 && (
        <p className="text-xs text-ink-muted">
          Compatível com: {suggestion.compatibleMethods.join(", ")}
        </p>
      )}

      <Link
        href={logHref}
        className="inline-block text-xs font-medium text-ink underline underline-offset-2"
      >
        Registrar essa refeição →
      </Link>
    </div>
  );
}
