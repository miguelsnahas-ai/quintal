import { z } from "zod";

// Essentials only — see familyContext.ts's updateChildEssentials. Interests
// arrive from the form as one comma-separated string (simplest possible
// input for a family on a phone — no tag-picker component, no new
// dependency); parsed here into a clean array: trimmed, empty entries
// dropped, so "carros,, música ,  " becomes ["carros", "música"].
export const childEssentialsInputSchema = z.object({
  child_id: z.uuid("Criança inválida."),
  name: z.string().trim().min(1, "Informe o nome da criança."),
  birth_date: z
    .string()
    .optional()
    .transform((value) => (value ? value : null)),
  interests: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? "")
        .split(",")
        .map((interest) => interest.trim())
        .filter((interest) => interest.length > 0),
    ),
});

export type ChildEssentialsInput = z.infer<typeof childEssentialsInputSchema>;

// Every field optional/free text on purpose — this is the "configurações
// avançadas" progressive-disclosure section of /quintal/perfil, not a
// form with required fields. Empty string means "cleared", not "unset"
// (transformed to null so it doesn't show up in formatChildContextForPrompt
// as an empty preference).
export const familyPreferencesInputSchema = z.object({
  family_id: z.uuid("Família inválida."),
  feeding_notes: z.string().optional().transform(emptyToNull),
  routine_notes: z.string().optional().transform(emptyToNull),
  play_notes: z.string().optional().transform(emptyToNull),
  materials_notes: z.string().optional().transform(emptyToNull),
  interaction_style: z.string().optional().transform(emptyToNull),
});

export type FamilyPreferencesInput = z.infer<typeof familyPreferencesInputSchema>;

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
