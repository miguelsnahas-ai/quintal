import { createServiceClient } from "@/lib/supabase/service";
import { parseContentFields, toActivity, type KnowledgeChunkRow } from "@/lib/activity";
import { searchKnowledge } from "@/lib/knowledge";
import { methodKeyword } from "@/lib/feeding";
import { materialCategoryLabels, type MaterialType, type MaterialCategory } from "@/lib/validation/library";

// ---------------------------------------------------------------------
// Biblioteca de Materiais (Fase 12) — uma segunda lente sobre o MESMO
// knowledge_chunks que já alimenta Activity (Fase 4) e feeding.ts (Fase
// 9): "receita" e "atividade" pedidos como TIPOS de material, e
// "alimentação"/"sono"/"brincadeiras" pedidos como CATEGORIAS, batem
// quase exatamente com categorias que já existiam (receitas,
// brincadeiras/materiais, metodos_alimentacao...) — em vez de uma nova
// tabela de conteúdo, esta fase é um mapeamento de todas as 10
// categorias de knowledge_chunks (531 linhas) para um vocabulário
// único. Nenhuma migração. Ver docs/ARCHITECTURE_TARGET.md, "Biblioteca
// de Materiais (Fase 12)".
// ---------------------------------------------------------------------

export type MaterialDetail = { label: string; value: string };

export type LibraryMaterial = {
  id: string;
  // knowledge_chunks.category original (ex.: "rotinas_sono") — mantido
  // para getMaterialHref decidir se a página de detalhe é /atividades/
  // ou /materiais/, e para depuração.
  sourceCategory: string;
  type: MaterialType;
  category: MaterialCategory;
  title: string;
  description: string | null;
  ageDisplayLabel: string | null;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  tags: string[];
  // "conteúdo" pedido nos metadados — todo campo real da linha que não
  // virou título/descrição/idade, no mesmo formato de Activity.extra
  // (Fase 4): nada é descartado, nada é inventado.
  extra: MaterialDetail[];
  imageUrl: string | null;
};

// brincadeiras/materiais já têm sua própria abstração e página de
// detalhe (Activity, Fase 4/11) — um material dessas categorias aponta
// pra lá em vez de duplicar a lógica de parsing ou a página.
const ACTIVITY_DELEGATED_CATEGORIES = new Set(["brincadeiras", "materiais"]);

type CategoryConfig = {
  materialCategory: MaterialCategory;
  materialType: MaterialType;
  // Campo do content usado como "descrição curta" pedida nos metadados
  // — um por categoria, o mesmo espírito de mapFieldsToActivity (Fase
  // 4) escolher os campos certos por aba da planilha.
  descriptionField: string;
};

// As 8 categorias restantes de knowledge_chunks (fora
// brincadeiras/materiais, que delegam para Activity acima). Nenhuma
// delas tem conteúdo real do tipo "artigo"/"vídeo"/"livro"/"checklist"
// hoje — confirmado direto no banco antes de codificar (mesma
// disciplina da Fase 4/11) — por isso o vocabulário de tipos suporta
// os oito pedidos, mas só quatro (activity/reference/recipe/guide)
// têm alguma linha real atrás deles nesta fase. Ver limitações.
const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  alimentos: { materialCategory: "feeding", materialType: "reference", descriptionField: "Grupo alimentar (Guia MS)" },
  receitas: { materialCategory: "feeding", materialType: "recipe", descriptionField: "Refeição" },
  metodos_alimentacao: { materialCategory: "feeding", materialType: "guide", descriptionField: "Como funciona" },
  rotinas_sono: { materialCategory: "sleep", materialType: "guide", descriptionField: "Para quem costuma funcionar" },
  formas_de_dormir: { materialCategory: "sleep", materialType: "guide", descriptionField: "Quando funciona melhor" },
  desenvolvimento: { materialCategory: "development", materialType: "reference", descriptionField: "Dica / atividade" },
  higiene: { materialCategory: "routine", materialType: "guide", descriptionField: "O que procurar na composição" },
  // "Passeios" não tem categoria própria entre as seis pedidas — mapeado
  // para "brincadeiras" (lazer fora de casa), não para "rotina", por ser
  // o vizinho semântico mais próximo dos seis nomes pedidos.
  passeios: { materialCategory: "play", materialType: "guide", descriptionField: "O que levar" },
};

// Nunca vira uma seção "extra" duplicada — já aparece em campos
// dedicados (ageDisplayLabel) ou nunca tem valor real aqui (tags já vem
// da coluna própria).
const SKIP_EXTRA_LABELS = new Set(["Faixa etária", "Idade mín. (meses)", "Idade máx. (meses)", "Tags"]);

export function toLibraryMaterial(row: KnowledgeChunkRow): LibraryMaterial | null {
  if (ACTIVITY_DELEGATED_CATEGORIES.has(row.category)) {
    const activity = toActivity(row);
    if (!activity) return null;

    return {
      id: activity.id,
      sourceCategory: row.category,
      type: row.category === "brincadeiras" ? "activity" : "reference",
      category: "play",
      title: activity.title,
      description: activity.why,
      ageDisplayLabel: activity.ageDisplayLabel,
      ageMinMonths: activity.ageMinMonths,
      ageMaxMonths: activity.ageMaxMonths,
      tags: activity.tags,
      extra: [
        activity.materials ? { label: "Materiais", value: activity.materials } : null,
        activity.howTo ? { label: "Como fazer", value: activity.howTo } : null,
        activity.developmentAreas ? { label: "O que desenvolve", value: activity.developmentAreas } : null,
        activity.safety ? { label: "Segurança", value: activity.safety } : null,
        ...activity.extra,
      ].filter((detail): detail is MaterialDetail => detail !== null),
      imageUrl: activity.imageUrl,
    };
  }

  const config = CATEGORY_CONFIG[row.category];
  if (!config) return null; // categoria desconhecida — defensivo, não deveria acontecer

  const fields = parseContentFields(row.content);
  const description = fields.get(config.descriptionField) ?? null;

  const extra: MaterialDetail[] = [];
  for (const [label, value] of fields) {
    if (SKIP_EXTRA_LABELS.has(label)) continue;
    if (label === config.descriptionField) continue; // já é a descrição, não duplicar
    if (value === row.title) continue; // já é o título da página (o próprio campo-título da aba), não duplicar
    extra.push({ label, value });
  }

  return {
    id: row.id,
    sourceCategory: row.category,
    type: config.materialType,
    category: config.materialCategory,
    title: row.title,
    description,
    ageDisplayLabel: fields.get("Faixa etária") ?? null,
    ageMinMonths: row.age_min_months,
    ageMaxMonths: row.age_max_months,
    tags: row.tags ?? [],
    extra,
    imageUrl: row.image_url,
  };
}

// brincadeiras/materiais já têm /atividades/[id] (Fase 4) — um material
// dessas categorias nunca ganha uma segunda página de detalhe, só
// aponta pra existente.
export function getMaterialHref(material: Pick<LibraryMaterial, "id" | "sourceCategory">): string {
  return ACTIVITY_DELEGATED_CATEGORIES.has(material.sourceCategory)
    ? `/atividades/${material.id}`
    : `/materiais/${material.id}`;
}

export async function getMaterial(id: string): Promise<LibraryMaterial | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("knowledge_chunks")
    .select("id, category, title, age_min_months, age_max_months, tags, content, image_url")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;
  return toLibraryMaterial(data as KnowledgeChunkRow);
}

function isAgeAppropriate(material: LibraryMaterial, ageMonths: number | null): boolean {
  if (ageMonths === null) return true;
  if (material.ageMinMonths !== null && ageMonths < material.ageMinMonths) return false;
  if (material.ageMaxMonths !== null && ageMonths > material.ageMaxMonths) return false;
  return true;
}

const ALL_SOURCE_CATEGORIES = [...Object.keys(CATEGORY_CONFIG), ...ACTIVITY_DELEGATED_CATEGORIES];

async function getAllMaterials(sourceCategories: string[]): Promise<LibraryMaterial[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("knowledge_chunks")
    .select("id, category, title, age_min_months, age_max_months, tags, content, image_url")
    .in("category", sourceCategories)
    .eq("status", "published")
    .order("id", { ascending: true });

  return (data ?? [])
    .map((row) => toLibraryMaterial(row as KnowledgeChunkRow))
    .filter((material): material is LibraryMaterial => material !== null);
}

function sourceCategoriesFor(category?: MaterialCategory): string[] {
  if (!category) return ALL_SOURCE_CATEGORIES;
  return ALL_SOURCE_CATEGORIES.filter((sourceCategory) => {
    if (ACTIVITY_DELEGATED_CATEGORIES.has(sourceCategory)) return category === "play";
    return CATEGORY_CONFIG[sourceCategory]?.materialCategory === category;
  });
}

// Um recorte, não a biblioteca inteira — "o material não deve parecer
// um catálogo infinito" foi um pedido explícito desta fase. 12 é
// deliberadamente pequeno mesmo para a maior categoria sozinha
// (alimentos tem 176 linhas) — quem quer ver mais usa a busca (mais
// específica por natureza) em vez de rolar uma lista longa.
const BROWSE_LIMIT = 12;

export async function getMaterialsByFilter(input: {
  ageMonths: number | null;
  category?: MaterialCategory;
  type?: MaterialType;
  limit?: number;
}): Promise<LibraryMaterial[]> {
  const materials = await getAllMaterials(sourceCategoriesFor(input.category));

  const filtered = materials
    .filter((material) => (input.type ? material.type === input.type : true))
    .filter((material) => isAgeAppropriate(material, input.ageMonths));

  return filtered.slice(0, input.limit ?? BROWSE_LIMIT);
}

const SEARCH_LIMIT = 10;

// Delega a busca de verdade para search_knowledge_chunks (a mesma RPC
// full-text já usada pelo RAG da IA desde as fases iniciais) — nenhuma
// segunda implementação de busca. Um pequeno re-fetch por resultado
// (getMaterial) para ter a forma completa de LibraryMaterial, mesmo
// tradeoff de N pequeno já aceito em recommendation.ts/dashboard.ts.
export async function searchMaterials(input: {
  query: string;
  ageMonths: number | null;
  limit?: number;
}): Promise<LibraryMaterial[]> {
  const chunks = await searchKnowledge({ query: input.query, ageMonths: input.ageMonths, limit: input.limit ?? SEARCH_LIMIT });
  const materials = await Promise.all(chunks.map((chunk) => getMaterial(chunk.id)));
  return materials.filter((material): material is LibraryMaterial => material !== null);
}

// ---------------------------------------------------------------------
// "Recomendados para vocês" — regras simples e transparentes (idade,
// interesses, método alimentar, histórico de atividades/contexto
// atual), sem scoring de IA. `score` aqui é só uma contagem inteira de
// quantos sinais bateram, não um modelo — cada sinal soma um número
// fixo e documentado, auditável lendo o próprio código. Estruturada
// para uma curadoria/IA futura assumir o "porquê" (a REDAÇÃO) sem mudar
// o formato de RecommendedMaterial nem os call sites — mesma separação
// DECISÃO/REDAÇÃO já validada por recommendation.ts (Fase 5).
// ---------------------------------------------------------------------

export type RecommendedMaterial = { material: LibraryMaterial; reason: string };

const RECOMMENDED_LIMIT = 4; // curado, não a biblioteca — ver PRINCÍPIO desta fase

function materialMentionsKeyword(material: LibraryMaterial, keyword: string): boolean {
  const haystack = [material.title, material.description, ...material.extra.map((detail) => detail.value)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(keyword);
}

export async function getRecommendedMaterials(input: {
  ageMonths: number | null;
  interests: string[];
  feedingMethodTitle: string | null;
  // "histórico de atividades"/"contexto atual" (pedidos como dois
  // critérios separados) — mesmo sinal aqui: categorias com evento
  // registrado recentemente para esta criança. Ver
  // getRecentCategoryBoosts abaixo.
  categoryBoosts: Set<MaterialCategory>;
  excludeIds?: Set<string>;
  limit?: number;
}): Promise<RecommendedMaterial[]> {
  // Sem idade conhecida, sem recomendação — mesma regra de segurança de
  // recommendActivity (Fase 5): nunca "adivinha" com contexto
  // insuficiente, só deixa de recomendar.
  if (input.ageMonths === null) return [];

  const materials = (await getAllMaterials(ALL_SOURCE_CATEGORIES))
    .filter((material) => isAgeAppropriate(material, input.ageMonths))
    .filter((material) => !input.excludeIds?.has(material.id));

  const keyword = input.feedingMethodTitle ? methodKeyword(input.feedingMethodTitle) : null;

  const scored = materials.map((material) => {
    let score = 0;
    let reason: string | null = null;

    if (input.categoryBoosts.has(material.category)) {
      score += 2;
      reason = `Vocês registraram ${materialCategoryLabels[material.category].toLowerCase()} recentemente`;
    }

    if (material.category === "feeding" && keyword && materialMentionsKeyword(material, keyword)) {
      score += 2;
      reason = `Combina com o método alimentar de vocês (${input.feedingMethodTitle})`;
    }

    const matchedInterest = input.interests.find(
      (interest) => interest.trim() && materialMentionsKeyword(material, interest.toLowerCase().trim()),
    );
    if (matchedInterest) {
      score += 1;
      reason = reason ?? `Relacionado a um interesse: ${matchedInterest}`;
    }

    return { material, score, reason: reason ?? "Compatível com a idade da criança" };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit ?? RECOMMENDED_LIMIT)
    .map(({ material, reason }) => ({ material, reason }));
}

// events.type → MaterialCategory, para "histórico de atividades"/
// "contexto atual" acima. Só os tipos com um mapeamento óbvio entram —
// observation/decision ficam de fora (não são "área" nenhuma).
const EVENT_TYPE_TO_MATERIAL_CATEGORY: Partial<Record<string, MaterialCategory>> = {
  sleep: "sleep",
  meal: "feeding",
  free_play: "play",
  routine: "routine",
  outing: "play",
  development: "development",
};

const CONTEXT_WINDOW_DAYS = 3; // "recente", não o histórico inteiro

export async function getRecentCategoryBoosts(childId: string): Promise<Set<MaterialCategory>> {
  const since = new Date();
  since.setDate(since.getDate() - CONTEXT_WINDOW_DAYS);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("events")
    .select("type")
    .eq("child_id", childId)
    .gte("occurred_at", since.toISOString());

  const boosts = new Set<MaterialCategory>();
  for (const row of data ?? []) {
    const category = EVENT_TYPE_TO_MATERIAL_CATEGORY[row.type];
    if (category) boosts.add(category);
  }
  return boosts;
}
