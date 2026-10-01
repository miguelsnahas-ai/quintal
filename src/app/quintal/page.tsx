import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Moon, Utensils, Blocks, ListChecks, MessageCircle, Sparkles, Sprout } from "lucide-react";
import { getSessionCaregiver } from "@/lib/authorization";
import { getActiveChildContext } from "@/lib/activeChild";
import { createServiceClient } from "@/lib/supabase/service";
import { formatDurationMinutes } from "@/lib/format";
import { getDashboardSummary } from "@/lib/dashboard";
import { buttonClassName } from "@/components/ui/Button";
import { inviteCardClassName } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import CurrentMomentCard from "@/components/dashboard/CurrentMomentCard";
import SummaryCard from "@/components/dashboard/SummaryCard";
import Timeline from "@/components/dashboard/Timeline";
import UpcomingMoments from "@/components/dashboard/UpcomingMoments";
import ActivityCard from "@/components/conversation/ActivityCard";
import MealSuggestionCard from "@/components/feeding/MealSuggestionCard";
import MaterialCard from "@/components/library/MaterialCard";

export const metadata: Metadata = {
  title: "Quintal",
  robots: { index: false, follow: false },
};

// A Home responde "o que está acontecendo hoje e o que pode fazer
// sentido agora" — contexto + próxima ação, nunca um dashboard de
// métricas (critério explícito desta refatoração). Cada seção já existia
// de alguma forma (Fases 7/9/10/11/12/14); o que muda aqui é a
// composição: um "momento atual" em destaque logo após a saudação, e
// "Sugestões para hoje" consolidando brincadeira + refeição + material
// num só lugar, em vez de duas seções separadas.
export default async function QuintalDashboardPage() {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  // Criança ativa (Fase 16) — não mais "a primeira criança da família":
  // o seletor global (ChildSwitcher, no layout) deixa a família trocar,
  // e o Dashboard sempre reflete a escolha atual, persistida em cookie.
  const { active: activeChild } = await getActiveChildContext(session.caregiverId);

  // "Primeiro acesso" — sessão existe, mas nenhuma criança ainda
  // (onboarding interrompido antes de /comecar/crianca, ou a família
  // removeu a única que tinha). Sem resumo/sugestões possível sem uma
  // criança — a ação certa é voltar a adicionar uma, não mostrar uma
  // Home vazia de verdade.
  if (!activeChild) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-8 px-4 py-6 sm:max-w-2xl lg:max-w-3xl">
        <EmptyState
          icon={Sprout}
          title="Vamos adicionar a primeira criança?"
          description="O Quintal gira em torno da rotina de uma criança — adicione a primeira para ver a Home ganhar vida."
        />
        <Link href="/comecar/crianca" className={buttonClassName("primary", "w-full justify-center")}>
          Adicionar criança
        </Link>
      </div>
    );
  }

  const supabase = createServiceClient();
  const [summary, { data: caregiverRow }] = await Promise.all([
    getDashboardSummary(activeChild.id),
    supabase.from("caregivers").select("name").eq("id", session.caregiverId).maybeSingle(),
  ]);

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

  // "Sugestões para hoje" (brincadeira + refeição + material/conteúdo,
  // sempre respeitando a criança ativa — toda fonte abaixo já é
  // calculada por getDashboardSummary a partir de activeChild.id). Uma
  // atividade só — a lista completa de recomendações do chat continua
  // alcançável por lá; a Home teasa, não acumula.
  const activitySuggestion = summary.recommendationsToday[0] ?? summary.playSuggestion;
  const hasSuggestions = activitySuggestion || summary.mealSuggestion || summary.recommendedMaterials.length > 0;

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 px-4 py-6 sm:max-w-2xl lg:max-w-3xl">
      <DashboardHeader caregiverName={caregiverRow?.name ?? null} childName={activeChild.name} hour={new Date().getHours()} />

      <CurrentMomentCard moment={summary.currentMoment} />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink-muted">Resumo do dia</h2>
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
            href="/quintal/registrar?tipo=routine"
            value={summary.lastRoutine ? `Último: ${summary.lastRoutine.notes} · ${lastRoutineTime}` : null}
            empty="Nenhum evento ainda hoje."
          />
        </div>
      </section>

      <UpcomingMoments suggestions={summary.upcomingMoments} />

      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink-muted">
          <Sparkles className="h-4 w-4" aria-hidden />
          Sugestões para hoje
        </h2>
        {hasSuggestions ? (
          <div className="space-y-3">
            {activitySuggestion && <ActivityCard activity={activitySuggestion} />}
            {summary.mealSuggestion && (
              <MealSuggestionCard suggestion={summary.mealSuggestion} slot={summary.mealSuggestionSlot} />
            )}
            {summary.recommendedMaterials.map(({ material, reason }) => (
              <MaterialCard key={material.id} material={material} reason={reason} />
            ))}
          </div>
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
        <h2 className="text-sm font-medium text-ink-muted">Últimos registros</h2>
        <Timeline events={summary.timeline} />
        <Link href="/quintal/timeline" className="text-xs font-medium text-ink underline underline-offset-2">
          Ver timeline completa
        </Link>
      </section>

      <Link href="/quintal/chat" className={buttonClassName("primary", "w-full justify-center")}>
        <MessageCircle className="h-4 w-4" aria-hidden />
        Conversar com o Quintal
      </Link>
    </div>
  );
}
