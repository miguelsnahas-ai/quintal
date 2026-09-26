import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActivity, type ActivityDetail } from "@/lib/activity";
import { markRecommendationOpened } from "@/lib/recommendation";
import ActivityFeedback from "./ActivityFeedback";

// Public by design — this is the page a family opens straight from a
// chat recommendation, on their own phone, no login. Content is generic
// reference material (not personalized, nothing sensitive), same
// reasoning as /test/[caregiverId] and /comecar being public.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const activity = await getActivity(id);
  return {
    title: activity ? `${activity.title} — Quintal` : "Atividade — Quintal",
    robots: { index: false, follow: false },
  };
}

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ rec?: string }>;
}) {
  const { id } = await params;
  const { rec: recommendationId } = await searchParams;
  const activity = await getActivity(id);

  if (!activity) {
    notFound();
  }

  // "recommendation_opened" (Fase 6) — only recorded when this page was
  // reached via a specific recommendation's ActivityCard link (?rec=...).
  // markRecommendationOpened re-checks that the id in the URL actually
  // belongs to THIS activity before writing anything, so a
  // tampered/mismatched query param is silently ignored rather than
  // corrupting another recommendation's event.
  if (recommendationId) {
    await markRecommendationOpened(recommendationId, activity.id);
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-8">
      {activity.imageUrl && (
        // External Drive-hosted URL, not a local/optimizable asset (see activity.ts).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={activity.imageUrl}
          alt={activity.title}
          className="aspect-[4/3] w-full rounded-lg object-cover"
        />
      )}
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-ink">{activity.title}</h1>
        {activity.ageDisplayLabel && (
          <p className="text-sm text-ink-muted">{activity.ageDisplayLabel}</p>
        )}
      </div>

      {activity.why && <Section title="Por que pode ser interessante" text={activity.why} />}
      {activity.materials && <Section title="Materiais" text={activity.materials} />}
      {activity.howTo && <Section title="Como fazer" text={activity.howTo} />}
      {activity.developmentAreas && (
        <Section title="Desenvolvimento relacionado" text={activity.developmentAreas} />
      )}
      {activity.safety && (
        <Section title="Segurança e supervisão" text={activity.safety} tone="alert" />
      )}
      {activity.extra.map((detail: ActivityDetail) => (
        <Section key={detail.label} title={detail.label} text={detail.value} />
      ))}

      <ActivityFeedback activityId={activity.id} />
    </div>
  );
}

function Section({ title, text, tone }: { title: string; text: string; tone?: "alert" }) {
  return (
    <section className={`rounded-lg p-4 ${tone === "alert" ? "bg-decorative/20" : "bg-secondary"}`}>
      <h2 className="mb-1 text-sm font-semibold text-ink">{title}</h2>
      <p className="whitespace-pre-wrap text-sm text-ink">{text}</p>
    </section>
  );
}
