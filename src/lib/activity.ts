import { createServiceClient } from "@/lib/supabase/service";

// Only these two categories of knowledge_chunks read as a concrete,
// recommendable "thing to do with the child" — the other eight
// (alimentos, receitas, rotinas_sono, higiene, passeios, etc.) are real
// reference content too, but don't fit the "activity" shape this phase
// asks for. No new content was written for this — every field below comes
// straight from the sheet-sourced rows already seeded into
// knowledge_chunks (see supabase/migrations/20260924185301_*).
const ACTIVITY_CATEGORIES = ["brincadeiras", "materiais"] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export function isActivityCategory(category: string): category is ActivityCategory {
  return (ACTIVITY_CATEGORIES as readonly string[]).includes(category);
}

export type ActivityDetail = {
  label: string;
  value: string;
};

// A thin, deliberately small summary — just enough to render an
// ActivityCard without a second round trip when it's returned inline from
// a chat reply.
export type ActivitySummary = {
  id: string;
  category: ActivityCategory;
  title: string;
  ageDisplayLabel: string | null;
  // Drive-hosted for now (see scripts/knowledge-base/sync_activity_images.py) —
  // null for the rows that don't have a photo yet, which is most of them.
  imageUrl: string | null;
};

export type Activity = ActivitySummary & {
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  tags: string[];
  why: string | null; // "por que pode ser interessante"
  materials: string | null; // "materiais"
  howTo: string | null; // "como fazer"
  developmentAreas: string | null; // "desenvolvimento relacionado"
  safety: string | null; // "segurança/supervisão", quando existir
  extra: ActivityDetail[]; // qualquer outro campo real da linha, não descartado
};

type KnowledgeChunkRow = {
  id: string;
  category: string;
  title: string;
  age_min_months: number | null;
  age_max_months: number | null;
  tags: string[] | null;
  content: string;
  image_url: string | null;
};

// knowledge_chunks.content is "Header: Value" lines, one per column the
// sheet had for that row (see the sync script's CONFIGS) — this just
// reads that back into a lookup instead of duplicating the values into
// new dedicated columns.
function parseContentFields(content: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of content.split("\n")) {
    const separatorIndex = line.indexOf(": ");
    if (separatorIndex === -1) continue;
    const label = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 2).trim();
    if (label && value) {
      fields.set(label, value);
    }
  }
  return fields;
}

// Field names differ between the two source tabs (see the diagnosis in
// docs/ARCHITECTURE_TARGET.md) — this is the one place that knows the
// mapping, so nothing downstream needs to care which tab a row came from.
function mapFieldsToActivity(
  category: ActivityCategory,
  fields: Map<string, string>,
): Pick<Activity, "why" | "materials" | "howTo" | "developmentAreas" | "safety" | "extra"> {
  const get = (label: string) => fields.get(label) ?? null;

  if (category === "brincadeiras") {
    return {
      why: get("Interesses"),
      materials: get("Materiais"),
      howTo: get("Como brincar"),
      developmentAreas: get("O que desenvolve"),
      safety: get("Segurança"),
      extra: [
        get("Tipo") ? { label: "Tipo", value: get("Tipo")! } : null,
        get("Onde") ? { label: "Onde brincar", value: get("Onde")! } : null,
      ].filter((detail): detail is ActivityDetail => detail !== null),
    };
  }

  // materiais: a linha descreve um material, não uma brincadeira pronta —
  // "como fazer" vira as ideias de uso por idade, e "materiais" é o
  // próprio item (junto de como consegui-lo, quando existir).
  const material = get("Material");
  const howToGet = get("Como conseguir / custo");
  return {
    why: get("Estilos de brincadeira"),
    materials: [material, howToGet].filter(Boolean).join(" — ") || null,
    howTo: get("Ideias de atividades por idade"),
    developmentAreas: get("Áreas de desenvolvimento"),
    safety: get("Segurança"),
    extra: [
      get("Categoria") ? { label: "Categoria", value: get("Categoria")! } : null,
      get("Supervisão") ? { label: "Nível de supervisão", value: get("Supervisão")! } : null,
    ].filter((detail): detail is ActivityDetail => detail !== null),
  };
}

function toActivity(row: KnowledgeChunkRow): Activity | null {
  if (!isActivityCategory(row.category)) return null;

  const fields = parseContentFields(row.content);
  const mapped = mapFieldsToActivity(row.category, fields);

  return {
    id: row.id,
    category: row.category,
    title: row.title,
    // The sheet already writes a human label ("6m+", "4m–3a"...) — reuse
    // it verbatim instead of re-deriving one from age_min/max_months, so
    // the page never says something the source content didn't.
    ageDisplayLabel: fields.get("Faixa etária") ?? null,
    ageMinMonths: row.age_min_months,
    ageMaxMonths: row.age_max_months,
    tags: row.tags ?? [],
    imageUrl: row.image_url,
    ...mapped,
  };
}

export async function getActivity(id: string): Promise<Activity | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("knowledge_chunks")
    .select("id, category, title, age_min_months, age_max_months, tags, content, image_url")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;
  return toActivity(data);
}

export function toActivitySummary(activity: Activity): ActivitySummary {
  return {
    id: activity.id,
    category: activity.category,
    title: activity.title,
    ageDisplayLabel: activity.ageDisplayLabel,
    imageUrl: activity.imageUrl,
  };
}
