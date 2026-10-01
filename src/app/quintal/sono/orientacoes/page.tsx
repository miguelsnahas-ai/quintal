import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check, Sparkles, Moon } from "lucide-react";
import { getSessionCaregiver } from "@/lib/authorization";
import { getActiveChildContext } from "@/lib/activeChild";
import { createServiceClient } from "@/lib/supabase/service";
import { ageInMonths } from "@/lib/format";
import { getMaterialsByFilter } from "@/lib/library";
import { getSleepAnalytics } from "@/lib/sleepInsights";
import { getRoutineSuggestions } from "@/lib/routineEngine";
import { cardClassName, inviteCardClassName } from "@/components/ui/Card";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SleepModuleNav } from "@/components/sleep/SleepModuleNav";
import MaterialCard from "@/components/library/MaterialCard";

export const metadata: Metadata = {
  title: "Orientações de sono — Quintal",
  robots: { index: false, follow: false },
};

// Tela 5: nunca prescreve — reconhece o que já está registrado (mesmo
// padrão de estabilidade de Análises, só reformulado de forma mais
// acolhedora) e sugere conteúdo real da biblioteca (categoria "sleep",
// mesma fonte que Materiais/Home já usam) e, quando há uma rotina
// conhecida, a sugestão de preparação para dormir que routineEngine já
// calcula a partir do horário costumeiro da família.
export default async function OrientacoesSonoPage() {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const { active: activeChild } = await getActiveChildContext(session.caregiverId);
  if (!activeChild) {
    redirect("/quintal/sono");
  }

  const supabase = createServiceClient();
  const [{ data: childRow }, analytics, { suggestions: routineSuggestions }] = await Promise.all([
    supabase.from("children").select("birth_date").eq("id", activeChild.id).maybeSingle(),
    getSleepAnalytics(activeChild.id, 7),
    getRoutineSuggestions(activeChild.id),
  ]);

  const ageMonths = ageInMonths(childRow?.birth_date ?? null);
  const materials = await getMaterialsByFilter({ ageMonths, category: "sleep", limit: 4 });
  const windDown = routineSuggestions.find((suggestion) => suggestion.kind === "wind_down") ?? null;

  const statusTitle = analytics.pattern ? "Tudo certo por aqui!" : "Continue registrando";
  const statusText =
    analytics.pattern ??
    "Ainda não há sono suficiente registrado para reconhecer um padrão — assim que houver mais dias, ele aparece aqui.";

  return (
    <PageContainer>
      <PageHeader title="Orientações de sono" description={activeChild.name} backHref="/quintal/sono" backLabel="Sono" />
      <SleepModuleNav active="/quintal/sono/orientacoes" />

      <div className={cardClassName("flex items-start gap-3 p-4")}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tertiary">
          <Check className="h-4 w-4 text-ink" aria-hidden />
        </span>
        <div>
          <p className="font-semibold text-ink">{statusTitle}</p>
          <p className="text-xs text-ink-muted">{statusText}</p>
        </div>
      </div>

      {windDown && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink-muted">
            <Moon className="h-4 w-4" aria-hidden />
            Uma possibilidade de rotina
          </h2>
          <div className={inviteCardClassName("p-4")}>
            <p className="text-sm font-semibold text-ink">{windDown.label}</p>
            <p className="text-xs text-ink-muted">{windDown.reason}</p>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink-muted">
          <Sparkles className="h-4 w-4" aria-hidden />
          Conteúdos sobre sono
        </h2>
        {materials.length > 0 ? (
          <div className="space-y-3">
            {materials.map((material) => (
              <MaterialCard key={material.id} material={material} />
            ))}
          </div>
        ) : (
          <p className={cardClassName("p-4 text-sm text-ink-muted")}>Nenhum conteúdo disponível ainda para essa idade.</p>
        )}
      </section>

      <p className="text-xs text-ink-muted">
        Nada aqui substitui uma avaliação médica — mudanças bruscas no sono valem uma conversa com
        o pediatra.
      </p>
    </PageContainer>
  );
}
