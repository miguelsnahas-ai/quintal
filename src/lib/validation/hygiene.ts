import { z } from "zod";

// Vocabulário da troca de fralda — guardado em events.payload (jsonb),
// mesmo padrão de 'sleep'/'meal' (ver src/lib/hygiene.ts). O mínimo que
// permite, mais tarde, relacionar trocas com horários, vazamentos e pele
// sem virar uma tela clínica: três perguntas, cada uma com poucas opções.
export const diaperResults = ["pee", "poop", "both"] as const;
export type DiaperResult = (typeof diaperResults)[number];

export const diaperResultLabels: Record<DiaperResult, string> = {
  pee: "Xixi",
  poop: "Cocô",
  both: "Xixi + Cocô",
};

export const diaperConditions = ["normal", "full", "leaked"] as const;
export type DiaperCondition = (typeof diaperConditions)[number];

export const diaperConditionLabels: Record<DiaperCondition, string> = {
  normal: "Normal",
  full: "Muito cheia",
  leaked: "Vazou",
};

export const skinConditions = ["normal", "red", "rash"] as const;
export type SkinCondition = (typeof skinConditions)[number];

export const skinConditionLabels: Record<SkinCondition, string> = {
  normal: "Normal",
  red: "Vermelha",
  rash: "Assada",
};

// O shape guardado em events.payload para type='hygiene' — ver
// src/lib/hygiene.ts, mesmo espírito de sleepEventPayloadSchema/
// mealEventPayloadSchema: validado tanto ao escrever (formulário de
// registro rápido) quanto ao ler de volta (payload é jsonb não tipado).
export const hygieneEventPayloadSchema = z.object({
  diaperResult: z.enum(diaperResults),
  condition: z.enum(diaperConditions),
  skinCondition: z.enum(skinConditions),
});

export type HygieneEventPayload = z.infer<typeof hygieneEventPayloadSchema>;

// O formulário "Registrar troca" — pedido explícito: "exigir o mínimo de
// interação possível". Três selects (todos com valor padrão já
// selecionado na tela) + data/hora (padrão: agora, editável) + nota
// opcional.
export const diaperChangeInputSchema = z.object({
  child_id: z.uuid("Selecione uma criança."),
  diaper_result: z.enum(diaperResults, { message: "Selecione o tipo." }),
  condition: z.enum(diaperConditions, { message: "Selecione a condição." }),
  skin_condition: z.enum(skinConditions, { message: "Selecione a pele." }),
  occurred_at: z.string().min(1, "Informe quando aconteceu."),
  notes: z.string().trim().optional(),
});

export type DiaperChangeInput = z.infer<typeof diaperChangeInputSchema>;

// "Fralda" — perfil (marca/modelo/tamanho) ao longo do tempo, tabela
// própria (diaper_profiles, não events — ver migração desta fase). Sem
// catálogo: todo campo é texto livre informado pela família.
export const diaperProfileInputSchema = z.object({
  child_id: z.uuid("Selecione uma criança."),
  brand: z.string().trim().optional(),
  model: z.string().trim().optional(),
  size: z.string().trim().optional(),
  started_at: z.string().min(1, "Informe a partir de quando."),
  notes: z.string().trim().optional(),
});

export type DiaperProfileInput = z.infer<typeof diaperProfileInputSchema>;

// Estoque — quantidade que a família tem guardada. Sem estimativa de
// consumo aqui (pedido explícito: "não inventar estimativas") — só o
// número informado.
export const diaperStockInputSchema = z.object({
  child_id: z.uuid("Selecione uma criança."),
  brand: z.string().trim().optional(),
  model: z.string().trim().optional(),
  size: z.string().trim().optional(),
  quantity: z.coerce.number().int().min(0, "Quantidade não pode ser negativa."),
});

export type DiaperStockInput = z.infer<typeof diaperStockInputSchema>;
