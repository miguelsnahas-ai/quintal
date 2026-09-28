// Vocabulário da biblioteca de Materiais (Fase 12) — não um formulário
// (esta fase não pede registro/edição de material pela família, só
// leitura/busca/recomendação), por isso sem schemas Zod aqui, diferente
// de validation/feeding.ts ou validation/sleep.ts. Mesmo padrão de
// validation/events.ts ter tipo + labels juntos como fonte única de
// verdade para display.

export const materialTypes = [
  "article",
  "video",
  "book",
  "guide",
  "checklist",
  "activity",
  "recipe",
  "reference",
] as const;

export type MaterialType = (typeof materialTypes)[number];

export const materialTypeLabels: Record<MaterialType, string> = {
  article: "Artigo",
  video: "Vídeo",
  book: "Livro",
  guide: "Guia",
  checklist: "Checklist",
  activity: "Atividade",
  recipe: "Receita",
  reference: "Referência",
};

export const materialCategories = ["feeding", "sleep", "play", "development", "routine", "parenting"] as const;

export type MaterialCategory = (typeof materialCategories)[number];

export const materialCategoryLabels: Record<MaterialCategory, string> = {
  feeding: "Alimentação",
  sleep: "Sono",
  play: "Brincadeiras",
  development: "Desenvolvimento",
  routine: "Rotina",
  parenting: "Parentalidade",
};
