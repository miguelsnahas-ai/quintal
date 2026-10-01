import { z } from "zod";
import { materialCategories } from "@/lib/validation/library";
import { routineFlexibilities } from "@/lib/validation/profile";

function emptyToNull(value: string | undefined): string | null {
  return value && value.trim().length > 0 ? value.trim() : null;
}

function urlOrNull() {
  return z
    .string()
    .optional()
    .transform(emptyToNull)
    .refine((value) => value === null || z.url().safeParse(value).success, {
      message: "Informe uma URL válida para a foto.",
    });
}

// "Qual é o seu papel na família?" — texto livre (caregivers.role), mas
// de um vocabulário fechado pra não acumular grafias diferentes da
// mesma coisa. "Prefiro não informar" vira null, não um texto salvo.
export const caregiverRoleOptions = ["Mãe", "Pai", "Outro cuidador"] as const;

// Passo "Sobre você" (/comecar/voce) — papel + nome + WhatsApp. O
// telefone não aparece no mockup de referência, mas é a identidade do
// produto (é por ele que uma mensagem de WhatsApp encontra a família) —
// não dá pra tirar, então entra aqui, junto do nome, o grupo mais
// próximo possível.
export const aboutCaregiverInputSchema = z.object({
  role: z
    .string()
    .optional()
    .transform(emptyToNull)
    .refine((value) => value === null || (caregiverRoleOptions as readonly string[]).includes(value), {
      message: "Opção inválida.",
    }),
  name: z.string().trim().min(1, "Informe seu nome."),
  phone_number: z.string().trim().min(1, "Informe seu WhatsApp."),
});

export type AboutCaregiverInput = z.infer<typeof aboutCaregiverInputSchema>;

// Passo "Família" (/comecar/familia) — nome (pré-preenchido, sempre pode
// confirmar sem digitar nada) + foto opcional. Mesmo padrão de avatar de
// updateFamilyProfileInputSchema (colar URL, sem upload).
export const familyStepInputSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da família."),
  avatar_url: urlOrNull(),
});

export type FamilyStepInput = z.infer<typeof familyStepInputSchema>;

// Passo "Criança" (/comecar/crianca) — reentrante: o mesmo formulário
// cria quantas crianças a família quiser, uma por submissão.
export const childStepInputSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da criança."),
  birth_date: z
    .string()
    .optional()
    .transform((value) => (value ? value : null)),
  avatar_url: urlOrNull(),
});

export type ChildStepInput = z.infer<typeof childStepInputSchema>;

// Passo "Cuidadores" (/comecar/cuidadores) — mesmos dois campos que o
// convite de Configurações já usa (createInvitationInputSchema): nome e
// e-mail opcional, só de referência. Sem campo de "papel do convidado" —
// isso não existe em family_invitations, e inventar um campo que não é
// salvo em lugar nenhum seria o tipo de dado fictício que este pedido
// pede pra evitar.
export const onboardingInviteInputSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome de quem você quer convidar."),
  email: z.string().optional().transform(emptyToNull),
});

export type OnboardingInviteInput = z.infer<typeof onboardingInviteInputSchema>;

// Passo "Preferências" (/comecar/preferencias) — os dois campos
// ESTRUTURADOS de family_preferences que fazem sentido perguntar no
// onboarding (interesses de conteúdo + flexibilidade de rotina); os
// demais campos de family_preferences (notas livres, estilo de
// recomendação, foco de atividade) ficam para quando a família quiser
// refinar em Configurações — perguntar tudo aqui era exatamente o
// "formulário longo" que este pedido pede pra evitar.
export const onboardingPreferencesInputSchema = z.object({
  content_focus: z.array(z.enum(materialCategories)).optional().default([]),
  routine_flexibility: z
    .string()
    .optional()
    .transform(emptyToNull)
    .refine((value) => value === null || (routineFlexibilities as readonly string[]).includes(value), {
      message: "Opção inválida.",
    })
    .transform((value) => value as (typeof routineFlexibilities)[number] | null),
});

export type OnboardingPreferencesInput = z.infer<typeof onboardingPreferencesInputSchema>;
