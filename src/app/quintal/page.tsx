import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Moon, Utensils, Blocks, ListChecks, MessageCircle, Sparkles } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import { getFamilySessionCaregiverId } from "@/lib/familySession";
import { ageLabel } from "@/lib/format";
import { getDashboardSummary } from "@/lib/dashboard";
import { buttonClassName } from "@/components/ui/Button";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import SummaryCard from "@/components/dashboard/SummaryCard";
import Timeline from "@/components/dashboard/Timeline";
import ActivityCard from "@/components/conversation/ActivityCard";

export const metadata: Metadata = {
  title: "Quintal",
  robots: { index: false, follow: false },
};

// The family's entry point as of this phase: a Home/Dashboard, not the
// chat. The chat hasn't gone anywhere — it moved to /quintal/chat, still
// one tap away from the header's message button and the CTA at the
// bottom of this page. This page is intentionally read-only: it answers
// "how's the day going", it doesn't collect anything.
export default async function QuintalDashboardPage() {
  const caregiverId = await getFamilySessionCaregiverId();
  if (!caregiverId) {
    redirect("/comecar");
  }

  const supabase = createServiceClient();

  const { data: caregiver } = await supabase
    .from("caregivers")
    .select("id, family_id")
    .eq("id", caregiverId)
    .maybeSingle();

  // Session points at a caregiver that no longer exists (e.g. removed by
  // an operator) — treat it the same as "no session".
  if (!caregiver) {
    redirect("/comecar");
  }

  const { data: childrenList } = await supabase
    .from("children")
    .select("id, name, birth_date")
    .eq("family_id", caregiver.family_id)
    .order("created_at", { ascending: true });

  // Same "primeira criança da família" simplification already made by the
  // chat page and its header — real multi-child support is a Fase 7
  // candidate (docs/PRODUCT_ROADMAP.md), not something this dashboard
  // invents on its own.
  const primaryChild = childrenList?.[0] ?? null;

  const summary = primaryChild
    ? await getDashboardSummary(primaryChild.id)
    : {
        sleepCount: 0,
        mealCount: 0,
        freePlayCount: 0,
        routineCount: 0,
        lastRoutine: null,
        timeline: [],
        recommendationsToday: [],
      };

  const dateLabel = capitalize(
    new Date().toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  );

  const lastRoutineTime = summary.lastRoutine
    ? new Date(summary.lastRoutine.occurredAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 px-4 py-6 sm:max-w-2xl lg:max-w-3xl">
      <DashboardHeader
        childName={primaryChild?.name ?? null}
        ageLabel={primaryChild ? ageLabel(primaryChild.birth_date) : null}
        dateLabel={dateLabel}
      />

      {!primaryChild ? (
        <p className="rounded-lg bg-primary p-4 text-sm text-ink-muted shadow-[var(--shadow-card)]">
          Nenhuma criança cadastrada ainda para esta família.
        </p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-ink-muted">Hoje</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCard
                icon={Moon}
                label="Sono"
                value={
                  summary.sleepCount > 0
                    ? `${summary.sleepCount} soneca${summary.sleepCount === 1 ? "" : "s"} hoje`
                    : null
                }
                empty="Nenhum registro ainda hoje."
              />
              <SummaryCard
                icon={Utensils}
                label="Alimentação"
                value={
                  summary.mealCount > 0
                    ? `${summary.mealCount} ${summary.mealCount === 1 ? "refeição" : "refeições"} hoje`
                    : null
                }
                empty="Nenhum registro ainda hoje."
              />
              <SummaryCard
                icon={Blocks}
                label="Brincadeiras"
                value={
                  summary.freePlayCount > 0
                    ? `${summary.freePlayCount} atividade${summary.freePlayCount === 1 ? "" : "s"} hoje`
                    : null
                }
                empty="Nenhuma atividade ainda hoje."
              />
              <SummaryCard
                icon={ListChecks}
                label="Rotina"
                value={
                  summary.lastRoutine
                    ? `Último: ${summary.lastRoutine.notes} · ${lastRoutineTime}`
                    : null
                }
                empty="Nenhum evento ainda hoje."
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink-muted">
              <Sparkles className="h-4 w-4" aria-hidden />
              Para hoje
            </h2>
            {summary.recommendationsToday.length > 0 ? (
              <div className="space-y-3">
                {summary.recommendationsToday.map((activity) => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))}
              </div>
            ) : (
              <div className="space-y-2 rounded-lg bg-secondary p-4 text-sm text-ink-muted shadow-[var(--shadow-card)]">
                <p>Nenhuma sugestão ainda hoje.</p>
                <Link href="/quintal/chat" className="font-medium text-ink underline underline-offset-2">
                  Conte pro Quintal como está o dia
                </Link>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-ink-muted">Timeline de hoje</h2>
            <Timeline events={summary.timeline} />
          </section>
        </>
      )}

      <Link
        href="/quintal/chat"
        className={buttonClassName("primary", "w-full justify-center")}
      >
        <MessageCircle className="h-4 w-4" aria-hidden />
        Conversar com o Quintal
      </Link>
    </div>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
