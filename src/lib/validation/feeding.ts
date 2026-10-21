import { z } from "zod";

// The meal-slot taxonomy asked for this phase. Deliberately its own
// small enum, separate from EventType (events.ts) — a meal event's
// `type` is always the generic "meal" (Fase 8); `slot` is a detail
// inside its `payload`, same split as `eventTypes` vs. a hypothetical
// per-type sub-classification.
export const mealSlots = [
  "breakfast",
  "morning_snack",
  "lunch",
  "afternoon_snack",
  "dinner",
  "other",
] as const;

export type MealSlot = (typeof mealSlots)[number];

export const mealSlotLabels: Record<MealSlot, string> = {
  breakfast: "Café da manhã",
  morning_snack: "Lanche da manhã",
  lunch: "Almoço",
  afternoon_snack: "Lanche da tarde",
  dinner: "Jantar",
  other: "Outro",
};

// "Aceitação" — deliberately just how much was eaten, not a food-by-food
// breakdown or a nutrition score. Keeps the quick-log form to one tap.
export const mealAcceptances = ["ate_well", "ate_some", "refused", "unknown"] as const;
export type MealAcceptance = (typeof mealAcceptances)[number];

export const mealAcceptanceLabels: Record<MealAcceptance, string> = {
  ate_well: "Comeu bem",
  ate_some: "Comeu pouco",
  refused: "Recusou",
  unknown: "Não sei dizer",
};

// The shape stored in events.payload for type='meal' rows — see
// src/lib/feeding.ts. Validated with Zod both when writing (the quick-log
// form) and when reading back (payload is untyped jsonb at the DB level,
// and will eventually also be written by a chat-based extractor this
// phase only prepares for, not implements).
export const mealEventPayloadSchema = z.object({
  slot: z.enum(mealSlots),
  foods: z.array(z.string()),
  acceptance: z.enum(mealAcceptances),
  // knowledge_chunks id (category "metodos_alimentacao") used to offer
  // THIS meal — usually just a copy of the child's configured method at
  // the time, so a later method change doesn't rewrite history.
  offeringMethodId: z.string().nullable(),
  // knowledge_chunks id (category "receitas") this entry was logged
  // from, when the family tapped "Registrar" on a suggestion card
  // instead of starting from a blank form.
  suggestionId: z.string().nullable(),
});

export type MealEventPayload = z.infer<typeof mealEventPayloadSchema>;

// The quick-log form's own input — foods arrives as one comma-separated
// field (same UX already used for children.interests in /quintal/perfil),
// parsed into an array here.
export const mealLogInputSchema = z.object({
  child_id: z.uuid("Criança inválida."),
  slot: z.enum(mealSlots, { message: "Selecione a refeição." }),
  occurred_at: z.string().min(1, "Informe quando isso aconteceu."),
  foods: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? "")
        .split(",")
        .map((food) => food.trim())
        .filter((food) => food.length > 0),
    ),
  acceptance: z.enum(mealAcceptances, { message: "Selecione como foi a aceitação." }),
  notes: z.string().optional(),
  suggestion_id: z.string().optional(),
});

export type MealLogInput = z.infer<typeof mealLogInputSchema>;

// The feeding-method configuration form — either a real knowledge_chunks
// id from the "metodos_alimentacao" category, or free text when the
// family picks "outro/personalizado". Not both: choosing a listed method
// clears any previous custom text, and vice versa (enforced in
// src/lib/feeding.ts's save function, not here).
export const feedingMethodInputSchema = z.object({
  child_id: z.uuid("Criança inválida."),
  method_id: z.string().optional(),
  method_custom: z.string().optional(),
});

export type FeedingMethodInput = z.infer<typeof feedingMethodInputSchema>;
