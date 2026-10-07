import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, Sparkles } from "lucide-react";
import { getSessionCaregiver } from "@/lib/authorization";
import { getActiveChildContext } from "@/lib/activeChild";
import { createServiceClient } from "@/lib/supabase/service";
import { ageInMonths } from "@/lib/format";
import {
  getMaterialsByFilter,
  searchMaterials,
  getRecommendedMaterials,
  getRecentCategoryBoosts,
} from "@/lib/library";
import { getChildFeedingMethod } from "@/lib/feeding";
import {
  materialCategories,
  materialCategoryLabels,
  materialTypes,
  materialTypeLabels,
  type MaterialCategory,
  type MaterialType,
} from "@/lib/validation/library";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { cardClassName, inviteCardClassName, cardHoverLift } from "@/components/ui/Card";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import MaterialCard from "@/components/library/MaterialCard";

export const metadata: Metadata = {
  title: "Materiais — Quintal",
  robots: { index: false, follow: false },
};

function isMaterialCategory(value: string | undefined): value is MaterialCategory {
  return (materialCategories as readonly string[]).includes(value ?? "");
}

function isMaterialType(value: string | undefined): value is MaterialType {
  return (materialTypes as readonly string[]).includes(value ?? "");
}

// Biblioteca de conteúdos/recursos (artigos, guias, receitas,
// atividades...) — a mesma base de conhecimento que já existia
// (knowledge_chunks, 531 linhas em 10 categorias), vista através de um
// vocabulário único de tipo/categoria (Fase 12). Por princípio, esta
// página nunca despeja a biblioteca inteira: sem busca nem filtro, ela
// mostra só "Recomendados para vocês" (poucos, curados) e os atalhos de
// categoria — buscar ou filtrar é o jeito de ver mais.
export default async function MateriaisPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; tipo?: string }>;
}) {
  const { q, categoria, tipo } = await searchParams;
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const { active: activeChild } = await getActiveChildContext(session.caregiverId);

  if (!activeChild) {
    return (
      <PageContainer space={6}>
        <PageHeader title="Materiais" backHref="/quintal/mais" backLabel="Mais" />
        <p className={cardClassName("p-4 text-sm text-ink-muted")}>
          Nenhuma criança cadastrada ainda para esta família.
        </p>
      </PageContainer>
    );
  }

  // interests não faz parte de AccessibleChild — mesma busca pequena e à
  // parte já usada em /quintal/brincadeiras.
  const supabase = createServiceClient();
  const { data: childRow } = await supabase
    .from("children")
    .select("interests")
    .eq("id", activeChild.id)
    .maybeSingle();

  const ageMonths = ageInMonths(activeChild.birthDate);
  const category = isMaterialCategory(categoria) ? categoria : undefined;
  const type = isMaterialType(tipo) ? tipo : undefined;
  const query = q?.trim();

  const isBrowsing = Boolean(query) || Boolean(category) || Boolean(type);

  const [results, feedingMethod, categoryBoosts] = await Promise.all([
    isBrowsing
      ? query
        ? searchMaterials({ query, ageMonths })
        : getMaterialsByFilter({ ageMonths, category, type })
      : Promise.resolve([]),
    getChildFeedingMethod(activeChild.id),
    getRecentCategoryBoosts(activeChild.id),
  ]);

  const recommended = isBrowsing
    ? []
    : await getRecommendedMaterials({
        ageMonths,
        interests: childRow?.interests ?? [],
        feedingMethodTitle: feedingMethod.option?.title ?? feedingMethod.custom,
        categoryBoosts,
      });

  return (
    <PageContainer>
      <PageHeader title="Materiais" backHref="/quintal/mais" backLabel="Mais" />

      <form method="get" className={cardClassName("space-y-3 p-4")}>
        <div className="flex gap-2">
          <Input name="q" defaultValue={q ?? ""} placeholder="Buscar (ex.: sono, papinha, cabana)" className="flex-1" />
          <Button type="submit" variant="secondary" aria-label="Buscar">
            <Search className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select name="categoria" defaultValue={category ?? ""}>
            <option value="">Qualquer categoria</option>
            {materialCategories.map((c) => (
              <option key={c} value={c}>
                {materialCategoryLabels[c]}
              </option>
            ))}
          </Select>
          <Select name="tipo" defaultValue={type ?? ""}>
            <option value="">Qualquer tipo</option>
            {materialTypes.map((t) => (
              <option key={t} value={t}>
                {materialTypeLabels[t]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" className="w-full justify-center">
          Filtrar
        </Button>
      </form>

      {isBrowsing ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-ink-muted">
            {query ? `Resultados para "${query}"` : "Biblioteca"}
          </h2>
          {results.length > 0 ? (
            <div className="space-y-3">
              {results.map((material) => (
                <MaterialCard key={material.id} material={material} />
              ))}
            </div>
          ) : (
            <p className={inviteCardClassName("p-4 text-sm text-ink-muted")}>
              Nada encontrado com esses termos ou filtros.
            </p>
          )}
          <Link href="/quintal/materiais" className="text-xs font-medium text-ink underline underline-offset-2">
            ← Limpar busca/filtros
          </Link>
        </section>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink-muted">
              <Sparkles className="h-4 w-4" aria-hidden />
              Recomendados para vocês
            </h2>
            {recommended.length > 0 ? (
              <div className="space-y-3">
                {recommended.map(({ material, reason }) => (
                  <MaterialCard key={material.id} material={material} reason={reason} />
                ))}
              </div>
            ) : (
              <p className={inviteCardClassName("p-4 text-sm text-ink-muted")}>
                Ainda não há recomendações — busque por um tema ou escolha uma categoria abaixo.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-ink-muted">Categorias</h2>
            <div className="grid grid-cols-2 gap-2">
              {materialCategories.map((c) => (
                <Link
                  key={c}
                  href={`/quintal/materiais?categoria=${c}`}
                  className={cardClassName(`p-3 text-center text-sm font-medium text-ink ${cardHoverLift}`)}
                >
                  {materialCategoryLabels[c]}
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </PageContainer>
  );
}
