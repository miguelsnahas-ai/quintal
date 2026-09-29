import { z } from "zod";
import { materialCategories } from "@/lib/validation/library";

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

// "Minha conta > Perfil" (Fase 17/18, /quintal/configuracoes/conta) — nome
// e avatar do próprio cuidador. Telefone fica fora de propósito (é a
// chave de identidade da sessão, ver src/lib/familySession.ts — mudar sem
// reverificação seria um jeito de sequestrar o acesso de outra pessoa);
// papel de acesso (owner/caregiver) também fica fora, não é o próprio
// cuidador quem decide isso. avatar_url aceita string vazia como "limpar
// o avatar" (vira null) — não há upload, só colar uma URL.
export const updateCaregiverProfileInputSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome."),
  avatar_url: z
    .string()
    .optional()
    .transform(emptyToNull)
    .refine((value) => value === null || z.url().safeParse(value).success, {
      message: "Informe uma URL válida para a foto.",
    }),
});

export type UpdateCaregiverProfileInput = z.infer<typeof updateCaregiverProfileInputSchema>;

// "Minha conta > Preferências pessoais" (Fase 18) — o que ESTE cuidador
// quer ver mais (reaproveita o vocabulário de materialCategories, Fase
// 12) e como prefere que o Quintal se comunique com ele. Nunca aceita
// family_id/child_id — ver caregiverPreferences.ts.
export const caregiverPersonalPreferencesInputSchema = z.object({
  content_interests: z.array(z.enum(materialCategories)).optional().default([]),
  communication_style: z.string().optional().transform(emptyToNull),
});

export type CaregiverPersonalPreferencesInput = z.infer<typeof caregiverPersonalPreferencesInputSchema>;

// "Minha conta > Notificações" (Fase 18) — só a preferência/persistência;
// não existe hoje envio de fato (ver caregiverPreferences.ts). Checkboxes
// desmarcados não aparecem no FormData, por isso cada campo é
// `.optional()` transformado em boolean (presente === true).
export const caregiverNotificationPreferencesInputSchema = z.object({
  notify_general: z.string().optional().transform(Boolean),
  notify_reminders: z.string().optional().transform(Boolean),
  notify_recommendations: z.string().optional().transform(Boolean),
  notify_routine_updates: z.string().optional().transform(Boolean),
});

export type CaregiverNotificationPreferencesInput = z.infer<
  typeof caregiverNotificationPreferencesInputSchema
>;

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
