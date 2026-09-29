import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Moon, Utensils, Blocks, ListChecks, MessageCircle, Sparkles } from "lucide-react";
import { getSessionCaregiver } from "@/lib/authorization";
import { getActiveChildContext } from "@/lib/activeChild";
import { ageLabel, formatDurationMinutes } from "@/lib/format";
import { getDashboardSummary } from "@/lib/dashboard";
import { buttonClassName } from "@/components/ui/Button";
import { cardClassName, inviteCardClassName } from "@/components/ui/Card";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import SummaryCard from "@/components/dashboard/SummaryCard";
import Timeline from "@/components/dashboard/Timeline";
import UpcomingMoments from "@/components/dashboard/UpcomingMoments";
import ActivityCard from "@/components/conversation/ActivityCard";
import MaterialCard from "@/components/library/MaterialCard";

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
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  // Criança ativa (Fase 16) — não mais "a primeira criança da família":
  // o seletor global (ChildSwitcher, no layout) deixa a família trocar,
  // e o Dashboard sempre reflete a escolha atual, persistida em cookie.
  const { active: activeChild } = await getActiveChildContext(session.caregiverId);

  const summary = activeChild
    ? await getDashboardSummary(activeChild.id)
    : {
        sleepCount: 0,
        mealCount: 0,
        freePlayCount: 0,
        routineCount: 0,
        lastRoutine: null,
        lastMeal: null,
        napCountToday: 0,
        napTotalMinutesToday: 0,
        openSleepSession: null,
        lastActivity: null,
        timeline: [],
        recommendationsToday: [],
        playSuggestion: null,
        recommendedMaterials: [],
        upcomingMoments: [],
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

  // Enquanto a criança está dormindo, isso é mais relevante do que a
  // contagem de sonecas do dia — é o "próximo evento relacionado à
  // rotina" que de fato temos evidência para mostrar sem inventar uma
  // previsão (ver docs/ARCHITECTURE_TARGET.md, "Módulo de Sono").
  const sleepCardValue = summary.openSleepSession
    ? `Dormindo desde ${new Date(summary.openSleepSession.startedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : summary.napCountToday > 0
      ? `${summary.napCountToday} soneca${summary.napCountToday === 1 ? "" : "s"} · ${formatDurationMinutes(summary.napTotalMinutesToday)}`
      : null;

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 px-4 py-6 sm:max-w-2xl lg:max-w-3xl">
      <DashboardHeader
        childName={activeChild?.name ?? null}
        ageLabel={activeChild ? ageLabel(activeChild.birthDate) : null}
        dateLabel={dateLabel}
      />

      {!activeChild ? (
        <p className={cardClassName("p-4 text-sm text-ink-muted")}>
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
                href="/quintal/sono"
                value={sleepCardValue}
                empty="Nenhum registro ainda hoje."
              />
              <SummaryCard
                icon={Utensils}
                label="Alimentação"
                href="/quintal/alimentacao"
                value={
                  summary.lastMeal
                    ? `${summary.mealCount} ${summary.mealCount === 1 ? "refeição" : "refeições"} · última: ${summary.lastMeal.notes}`
                    : null
                }
                empty="Nenhum registro ainda hoje."
              />
              <SummaryCard
                icon={Blocks}
                label="Brincadeiras"
                href="/quintal/brincadeiras"
                value={
                  summary.lastActivity
                    ? `${summary.freePlayCount} ${summary.freePlayCount === 1 ? "atividade" : "atividades"} · última: ${summary.lastActivity.notes}`
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

          <UpcomingMoments suggestions={summary.upcomingMoments} />

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
            ) : summary.playSuggestion ? (
              // Sem recomendação do chat hoje — cai para a sugestão
              // determinística de brincadeira (idade + interesses, Fase
              // 11) em vez de um estado vazio, quando há conteúdo real
              // para a idade da criança.
              <ActivityCard activity={summary.playSuggestion} />
            ) : (
              <div className={inviteCardClassName("space-y-2 p-4 text-sm text-ink-muted")}>
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
            <Link
              href="/quintal/timeline"
              className="text-xs font-medium text-ink underline underline-offset-2"
            >
              Ver timeline completa
            </Link>
          </section>

          {summary.recommendedMaterials.length > 0 && (
            // Só aparece com contexto suficiente (idade conhecida) —
            // getRecommendedMaterials devolve vazio sem isso, nunca um
            // preenchimento forçado (Fase 12).
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-ink-muted">Materiais para vocês</h2>
              <div className="space-y-3">
                {summary.recommendedMaterials.map(({ material, reason }) => (
                  <MaterialCard key={material.id} material={material} reason={reason} />
                ))}
              </div>
              <Link
                href="/quintal/materiais"
                className="text-xs font-medium text-ink underline underline-offset-2"
              >
                Ver biblioteca de materiais
              </Link>
            </section>
          )}
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
