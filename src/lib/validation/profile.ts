import { z } from "zod";
import { materialCategories } from "@/lib/validation/library";

// Comma-separated free text is the simplest possible input for a family
// on a phone (no tag-picker component, no new dependency) — parsed here
// into a clean array: trimmed, empty entries dropped, so
// "carros,, música ,  " becomes ["carros", "música"]. Compartilhado por
// todo campo desse formato (interesses, brincadeiras favoritas, materiais
// de interesse — ver childPreferencesInputSchema abaixo).
function csvToArray(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

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

// "Perfil da família" (Fase 17/19, /quintal/configuracoes/familia) — nome
// e avatar da família (ver updateFamilyProfile em familyContext.ts).
// Mesmo padrão de updateCaregiverProfileInputSchema (Fase 18): avatar_url
// vazio vira null ("limpar o avatar"), sem upload, só URL.
export const updateFamilyProfileInputSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da família."),
  avatar_url: z
    .string()
    .optional()
    .transform(emptyToNull)
    .refine((value) => value === null || z.url().safeParse(value).success, {
      message: "Informe uma URL válida para a foto.",
    }),
});

export type UpdateFamilyProfileInput = z.infer<typeof updateFamilyProfileInputSchema>;

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

// "Preferências da família" (Fase 19) — os 3 campos ESTRUTURADOS pedidos
// (estilo de recomendação, flexibilidade de rotina, foco de atividades),
// consultáveis por valor exato em vez de enterrados em texto livre — é
// isso que a fase chama de "family.preferences" como estrutura, não só
// prosa. Um <select> HTML sempre manda algum valor mesmo sem escolha
// explícita (a primeira <option>), por isso cada enum ganha uma opção
// "" ("Sem preferência") que este schema converte para null — nunca um
// enum "obrigatório" que forçaria a família a escolher algo.
export const recommendationStyles = ["practical", "detailed", "balanced"] as const;
export type RecommendationStyle = (typeof recommendationStyles)[number];
export const recommendationStyleLabels: Record<RecommendationStyle, string> = {
  practical: "Mais práticas",
  detailed: "Mais detalhadas",
  balanced: "Equilíbrio",
};

export const routineFlexibilities = ["flexible", "structured", "balanced"] as const;
export type RoutineFlexibility = (typeof routineFlexibilities)[number];
export const routineFlexibilityLabels: Record<RoutineFlexibility, string> = {
  flexible: "Mais flexível",
  structured: "Mais estruturada",
  balanced: "Equilíbrio",
};

export const routineActivityFocuses = ["home", "outdoor", "balanced"] as const;
export type RoutineActivityFocus = (typeof routineActivityFocuses)[number];
export const routineActivityFocusLabels: Record<RoutineActivityFocus, string> = {
  home: "Mais em casa",
  outdoor: "Mais atividades externas",
  balanced: "Equilíbrio",
};

function optionalEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z
    .string()
    .optional()
    .transform(emptyToNull)
    .refine((value) => value === null || (values as readonly string[]).includes(value), {
      message: "Opção inválida.",
    })
    .transform((value) => value as T[number] | null);
}

// Every field optional/free text on purpose — this is the "configurações
// avançadas" progressive-disclosure section of /quintal/perfil, not a
// form with required fields. Empty string means "cleared", not "unset"
// (transformed to null so it doesn't show up in formatChildContextForPrompt
// as an empty preference). content_focus é estruturado (checkboxes,
// vocabulário de materialCategories — mesma escolha de
// caregiverPersonalPreferencesInputSchema, Fase 18, agora no nível da
// família); os 5 campos *_notes/interaction_style continuam sendo o
// "campo de observação" para informação subjetiva ou adicional, como
// desde a Fase 8 — o chat (chatActions.ts) edita esses mesmos campos por
// categoria, então eles não mudam de forma nesta fase.
export const familyPreferencesInputSchema = z.object({
  family_id: z.uuid("Família inválida."),
  recommendation_style: optionalEnum(recommendationStyles),
  routine_flexibility: optionalEnum(routineFlexibilities),
  routine_activity_focus: optionalEnum(routineActivityFocuses),
  content_focus: z.array(z.enum(materialCategories)).optional().default([]),
  feeding_notes: z.string().optional().transform(emptyToNull),
  routine_notes: z.string().optional().transform(emptyToNull),
  play_notes: z.string().optional().transform(emptyToNull),
  materials_notes: z.string().optional().transform(emptyToNull),
  interaction_style: z.string().optional().transform(emptyToNull),
});

export type FamilyPreferencesInput = z.infer<typeof familyPreferencesInputSchema>;

// "Configurações > Crianças > [criança] > Perfil" (Fase 20) — informações
// básicas de UMA criança: nome, nascimento, avatar, sexo. Reaproveita o
// mesmo padrão de avatar de updateFamilyProfileInputSchema/
// updateCaregiverProfileInputSchema. Não inclui interesses (isso mudou de
// aba nesta fase — ver childPreferencesInputSchema abaixo, onde
// conceitualmente pertence, junto de brincadeiras favoritas e materiais).
export const updateChildProfileInputSchema = z.object({
  child_id: z.uuid("Criança inválida."),
  name: z.string().trim().min(1, "Informe o nome da criança."),
  birth_date: z
    .string()
    .optional()
    .transform((value) => (value ? value : null)),
  avatar_url: z
    .string()
    .optional()
    .transform(emptyToNull)
    .refine((value) => value === null || z.url().safeParse(value).success, {
      message: "Informe uma URL válida para a foto.",
    }),
  sex: z.string().optional().transform(emptyToNull),
});

export type UpdateChildProfileInput = z.infer<typeof updateChildProfileInputSchema>;

// "Configurações > Crianças > [criança] > Preferências" (Fase 20) —
// mesma separação DADOS ESTRUTURADOS / OBSERVAÇÕES LIVRES já usada em
// family_preferences (Fase 19): routine_preference/activity_style têm
// vocabulário fixo; os *_notes são texto livre. Não inclui método
// alimentar (children.feeding_method_id/custom, pedido explícito desta
// fase para não duplicar — ver childFeedingMethodInputSchema abaixo, que
// só reexpõe o schema já existente de src/lib/validation/feeding.ts).
export const childRoutinePreferences = ["predictable", "flexible", "balanced"] as const;
export type ChildRoutinePreference = (typeof childRoutinePreferences)[number];
export const childRoutinePreferenceLabels: Record<ChildRoutinePreference, string> = {
  predictable: "Mais previsível",
  flexible: "Mais flexível",
  balanced: "Equilíbrio",
};

export const childActivityStyles = ["calm", "energetic", "balanced"] as const;
export type ChildActivityStyle = (typeof childActivityStyles)[number];
export const childActivityStyleLabels: Record<ChildActivityStyle, string> = {
  calm: "Mais calmas",
  energetic: "Mais agitadas",
  balanced: "Equilíbrio",
};

export const childPreferencesInputSchema = z.object({
  child_id: z.uuid("Criança inválida."),
  interests: z.string().optional().transform(csvToArray),
  favorite_activities: z.string().optional().transform(csvToArray),
  preferred_materials: z.string().optional().transform(csvToArray),
  routine_preference: optionalEnum(childRoutinePreferences),
  activity_style: optionalEnum(childActivityStyles),
  routine_notes: z.string().optional().transform(emptyToNull),
  feeding_notes: z.string().optional().transform(emptyToNull),
  caregiver_notes: z.string().optional().transform(emptyToNull),
});

export type ChildPreferencesInput = z.infer<typeof childPreferencesInputSchema>;

// "Configurações > Crianças > [criança] > Contexto > Sobre esta criança"
// (Fase 20) — observação livre e geral (children.notes), separada das
// observações por área que já vivem em child_preferences acima. Era só
// editável por operador (/ops) até esta fase.
export const updateChildContextNotesInputSchema = z.object({
  child_id: z.uuid("Criança inválida."),
  notes: z.string().optional().transform(emptyToNull),
});

export type UpdateChildContextNotesInput = z.infer<typeof updateChildContextNotesInputSchema>;

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
