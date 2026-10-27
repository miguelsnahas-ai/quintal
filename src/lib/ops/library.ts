import { createClient } from "@/lib/supabase/server";
import type { MaterialType } from "@/lib/validation/library";

// ---------------------------------------------------------------------
// Refatoração do /ops — "Biblioteca": gestão simplificada do mesmo
// knowledge_chunks que já alimenta recomendações, métodos alimentares e
// receitas em produção (ver src/lib/library.ts, a leitura family-facing —
// nunca duplicada aqui). Sem CMS: um título, uma categoria (as mesmas já
// usadas pelo produto, nunca inventadas), um blob de conteúdo em texto
// "Rótulo: valor" por linha (o mesmo formato que a planilha original já
// usava — ver parseContentFields em src/lib/activity.ts) e um status.
// ---------------------------------------------------------------------

export const libraryStatuses = ["published", "draft", "archived"] as const;
export type LibraryStatus = (typeof libraryStatuses)[number];

export const libraryStatusLabels: Record<LibraryStatus, string> = {
  published: "Publicado",
  draft: "Rascunho",
  archived: "Arquivado",
};

// Só apresentacional (qual "tipo" pedido nesta fase — Atividade/Material/
// Receita/Conteúdo/Guia — combina com cada categoria já existente); a
// fonte de verdade do tipo real usado pelo produto continua sendo
// CATEGORY_CONFIG em src/lib/library.ts. Categoria fora deste mapa (uma
// nova, criada por um operador) cai em "Guia", o mais genérico dos
// quatro tipos com conteúdo real hoje.
const CATEGORY_TYPE_LABEL: Record<string, string> = {
  brincadeiras: "Atividade",
  materiais: "Material",
  alimentos: "Material",
  receitas: "Receita",
  metodos_alimentacao: "Guia",
  rotinas_sono: "Guia",
  formas_de_dormir: "Guia",
  desenvolvimento: "Material",
  higiene: "Guia",
  passeios: "Guia",
};

function typeLabelFor(category: string): string {
  return CATEGORY_TYPE_LABEL[category] ?? "Guia";
}

export type OpsLibraryItem = {
  id: string;
  title: string;
  category: string;
  typeLabel: string;
  status: LibraryStatus;
  updatedAt: string;
};

export async function getLibraryCategories(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("knowledge_chunks").select("category");
  const categories = new Set((data ?? []).map((row) => row.category));
  return [...categories].sort();
}

const PAGE_SIZE = 30;

export type LibraryListFilters = {
  query?: string;
  category?: string;
  status?: LibraryStatus;
  page?: number;
};

export async function getLibraryList(
  filters: LibraryListFilters,
): Promise<{ items: OpsLibraryItem[]; total: number; page: number; pageCount: number }> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("knowledge_chunks")
    .select("id, title, category, status, updated_at", { count: "exact" });

  const trimmed = filters.query?.trim();
  if (trimmed) query = query.ilike("title", `%${trimmed}%`);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.status) query = query.eq("status", filters.status);

  query = query.order("updated_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);

  const { data, count } = await query;

  const items: OpsLibraryItem[] = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    typeLabel: typeLabelFor(row.category),
    status: row.status as LibraryStatus,
    updatedAt: row.updated_at,
  }));

  const total = count ?? 0;
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export type OpsLibraryItemDetail = {
  id: string;
  title: string;
  category: string;
  status: LibraryStatus;
  content: string;
  tags: string[];
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  imageUrl: string | null;
  updatedAt: string;
  createdAt: string;
};

export async function getLibraryItem(id: string): Promise<OpsLibraryItemDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("knowledge_chunks").select("*").eq("id", id).maybeSingle();
  if (!data) return null;

  return {
    id: data.id,
    title: data.title,
    category: data.category,
    status: data.status as LibraryStatus,
    content: data.content,
    tags: data.tags ?? [],
    ageMinMonths: data.age_min_months,
    ageMaxMonths: data.age_max_months,
    imageUrl: data.image_url,
    updatedAt: data.updated_at,
    createdAt: data.created_at,
  };
}

export type LibraryItemInput = {
  title: string;
  category: string;
  content: string;
  tags: string[];
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  imageUrl: string | null;
  status: LibraryStatus;
};

// IDs seedados pela planilha seguem um prefixo por categoria (MAT-001,
// SON-014...); um item novo criado pela equipe usa um prefixo neutro
// próprio — nunca tenta adivinhar/reciclar o esquema da planilha, que
// não é o que este formulário está criando.
function generateLibraryId(): string {
  return `LIB-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1000)}`;
}

export async function createLibraryItem(input: LibraryItemInput): Promise<{ id: string }> {
  const supabase = await createClient();
  const id = generateLibraryId();

  const { error } = await supabase.from("knowledge_chunks").insert({
    id,
    title: input.title,
    category: input.category,
    content: input.content,
    tags: input.tags,
    age_min_months: input.ageMinMonths,
    age_max_months: input.ageMaxMonths,
    image_url: input.imageUrl,
    status: input.status,
    updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);
  return { id };
}

export async function updateLibraryItem(id: string, input: LibraryItemInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("knowledge_chunks")
    .update({
      title: input.title,
      category: input.category,
      content: input.content,
      tags: input.tags,
      age_min_months: input.ageMinMonths,
      age_max_months: input.ageMaxMonths,
      image_url: input.imageUrl,
      status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

// "Arquivar" — nunca um delete físico (conteúdo já pode estar referenciado
// por events.payload/activity_recommendations históricos); status
// 'archived' já basta para sumir de toda busca/recomendação (ver a
// migration desta fase, search_knowledge_chunks e os call sites com
// .eq("status", "published") em library.ts/feeding.ts/play.ts).
export async function archiveLibraryItem(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("knowledge_chunks")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export type { MaterialType };
