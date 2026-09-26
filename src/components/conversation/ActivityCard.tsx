import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { ActivitySummary } from "@/lib/activity";

// Deliberately warmer than the operator tool's `Card` (rounded-sm,
// bg-primary, thin border): larger radius, cream surface, no border — a
// recommendation should feel like an invitation to do something together,
// not a data row. Reusable wherever a specific activity needs surfacing:
// today only inline in the chat, but built to also work standalone (a
// future home feed, a recommendations list).
export default function ActivityCard({
  activity,
  recommendationId,
}: {
  activity: ActivitySummary;
  // Optional: when this card renders a specific Recommendation Engine
  // decision (Fase 6), carrying it in the link's ?rec= param is what lets
  // /atividades/[id] record "recommendation_opened" against that exact
  // occurrence — see markRecommendationOpened in src/lib/recommendation.ts.
  // Absent when the card isn't tied to one (none of today's call sites,
  // but kept optional for future reuse, e.g. a home feed).
  recommendationId?: string | null;
}) {
  const href = recommendationId
    ? `/atividades/${activity.id}?rec=${recommendationId}`
    : `/atividades/${activity.id}`;

  return (
    <Link
      href={href}
      className="block rounded-lg bg-secondary p-4 shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-lift)]"
    >
      <div className="flex items-start gap-3">
        {activity.imageUrl ? (
          // External Drive-hosted URL, not a local/optimizable asset (see activity.ts).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activity.imageUrl}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent">
            <Sparkles className="h-4 w-4 text-ink" aria-hidden />
          </span>
        )}
        <div className="min-w-0 space-y-0.5">
          <p className="font-semibold text-ink">{activity.title}</p>
          {activity.ageDisplayLabel && (
            <p className="text-xs text-ink-muted">{activity.ageDisplayLabel}</p>
          )}
          <p className="text-xs font-medium text-ink underline underline-offset-2">
            Ver atividade
          </p>
        </div>
      </div>
    </Link>
  );
}
