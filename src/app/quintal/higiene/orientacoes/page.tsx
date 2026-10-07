import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { getSessionCaregiver } from "@/lib/authorization";
import { getActiveChildContext } from "@/lib/activeChild";
import { createServiceClient } from "@/lib/supabase/service";
import { ageInMonths } from "@/lib/format";
import { getHygieneOverview } from "@/lib/hygiene";
import { getMaterialsByFilter, searchMaterials, type LibraryMaterial } from "@/lib/library";
import { cardClassName } from "@/components/ui/Card";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { HygieneModuleNav } from "@/components/hygiene/HygieneModuleNav";
import MaterialCard from "@/components/library/MaterialCard";

export const metadata: Metadata = {
  title: "Orientações de higiene — Quintal",
  robots: { index: false, follow: false },
};

// Qual busca disparar a partir do que a família já registrou — mesmo
// espírito de describeLeakInsight (hygieneInsights.ts): só fatos já
// registrados, nunca uma conclusão sobre causa. A pele da troca mais
// recente vem na frente de vazamentos recentes porque é o sinal mais
// específico (e o registro mais recente, não uma contagem); nenhum dos
// dois nunca inventa um motivo, só escolhe que conteúdo da aba 10
// (aprofundamento de Higiene) é mais relevante agora.
function situationQueryFor(overview: { lastChange: { skinCondition: string | null } | null; recentLeakCount: number }): {
  query: string;
  heading: string;
} | null {
  if (overview.lastChange?.skinCondition === "rash") {
    return { query: "assadura dermatite pele fralda", heading: "A última troca registrou pele assada" };
  }
  if (overview.lastChange?.skinCondition === "red") {
    return { query: "pele vermelha irritação fralda", heading: "A última troca registrou pele vermelha" };
  }
  if (overview.recentLeakCount > 0) {
    return { query: "vazamento fralda tamanho ajuste", heading: "Vazamentos registrados recentemente" };
  }
  return null;
}

// Tela "Orientações" do módulo Higiene — mesmo papel da aba equivalente
// em Sono: reconhece o que já foi registrado e sugere conteúdo real da
// biblioteca (categoria "routine", que já reúne a aba 7 original e o
// aprofundamento de fraldas/pele/banho/produtos/ingredientes sincronizado
// depois). Quando o último registro ou os vazamentos recentes apontam
// para algo específico, a busca textual (searchMaterials, mesma RPC do
// chat) prioriza esse conteúdo; sem nenhum sinal, cai para a lista geral
// por idade, igual Sono.
export default async function OrientacoesHigienePage() {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const { active: activeChild } = await getActiveChildContext(session.caregiverId);
  if (!activeChild) {
    redirect("/quintal/higiene");
  }

  const supabase = createServiceClient();
  const [{ data: childRow }, overview] = await Promise.all([
    supabase.from("children").select("birth_date").eq("id", activeChild.id).maybeSingle(),
    getHygieneOverview(activeChild.id),
  ]);

  const ageMonths = ageInMonths(childRow?.birth_date ?? null);
  const situation = situationQueryFor(overview);

  let materials: LibraryMaterial[] = [];
  if (situation) {
    const found = await searchMaterials({ query: situation.query, ageMonths, limit: 6 });
    materials = found.filter((material) => material.sourceCategory.startsWith("higiene")).slice(0, 4);
  }
  // Sem sinal registrado, ou a busca não achou nada específico de
  // Higiene: lista geral por idade, mesma função que Sono usa.
  if (materials.length === 0) {
    materials = await getMaterialsByFilter({ ageMonths, category: "routine", limit: 4 });
  }

  const heading = situation && materials.some((material) => material.sourceCategory.startsWith("higiene")) ? situation.heading : null;

  const statusTitle = overview.insights.length > 0 ? "Observamos isso no seu registro" : "Continue registrando";
  const statusText =
    overview.insights[0] ??
    "Ainda não há sinais para destacar — assim que houver mais trocas registradas, eles aparecem aqui.";

  return (
    <PageContainer>
      <PageHeader title="Orientações de higiene" description={activeChild.name} backHref="/quintal/higiene" backLabel="Higiene" />
      <HygieneModuleNav active="/quintal/higiene/orientacoes" />

      <div className={cardClassName("flex items-start gap-3 p-4")}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tertiary">
          <Check className="h-4 w-4 text-ink" aria-hidden />
        </span>
        <div>
          <p className="font-semibold text-ink">{statusTitle}</p>
          <p className="text-xs text-ink-muted">{statusText}</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink-muted">
          <Sparkles className="h-4 w-4" aria-hidden />
          {heading ?? "Conteúdos sobre higiene"}
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
        Nada aqui substitui uma avaliação médica — assaduras que não melhoram em alguns dias ou
        outros sinais de alerta valem uma conversa com o pediatra.
      </p>
    </PageContainer>
  );
}
