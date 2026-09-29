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

// "Adicionar criança" (Fase 16, /quintal/familia) — fluxo simples pedido:
// nome + data de nascimento, sem foto/avatar (ver o comentário em
// createChild, familyContext.ts).
export const addChildInputSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da criança."),
  birth_date: z
    .string()
    .optional()
    .transform((value) => (value ? value : null)),
});

export type AddChildInput = z.infer<typeof addChildInputSchema>;

// "Perfil da família" (Fase 17, /quintal/configuracoes/familia) — só o
// nome, campo único hoje (ver updateFamilyName em familyContext.ts).
export const updateFamilyNameInputSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da família."),
});

export type UpdateFamilyNameInput = z.infer<typeof updateFamilyNameInputSchema>;

// "Minha conta > Perfil" (Fase 17, /quintal/configuracoes/conta) — só o
// nome do próprio cuidador. Telefone fica fora de propósito (é a chave
// de identidade da sessão, ver src/lib/familySession.ts — mudar sem
// reverificação seria um jeito de sequestrar o acesso de outra pessoa);
// papel de acesso (owner/caregiver) também fica fora, não é o próprio
// cuidador quem decide isso.
export const updateCaregiverNameInputSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome."),
});

export type UpdateCaregiverNameInput = z.infer<typeof updateCaregiverNameInputSchema>;

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
