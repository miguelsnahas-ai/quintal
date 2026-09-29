import { z } from "zod";

// "Adicionar cuidador" (Fase 16, /quintal/familia) — nome é o único
// campo obrigatório (é o que aparece na lista de convites pendentes);
// e-mail é livre/opcional, guardado só como referência (ver
// src/lib/invitations.ts — não existe envio de e-mail real neste
// produto). access_role sempre "caregiver" nesta versão: convidar
// alguém já como owner não faz sentido (só existe um owner por família,
// garantido no banco) e "admin"/"professional" ainda não existem (ver
// seção 19 do pedido) — o campo já existe no schema para quando
// existirem, mas o formulário não oferece escolha ainda.
export const createInvitationInputSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome de quem você quer convidar."),
  email: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : null;
    }),
});

export type CreateInvitationInput = z.infer<typeof createInvitationInputSchema>;

// Aceitar convite (/convite/[token]) — mesmo formato de telefone já
// validado em /comecar (normalizeBrazilianPhone faz a normalização de
// verdade; este schema só garante que algo foi digitado).
export const acceptInvitationInputSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome."),
  phone_number: z.string().trim().min(1, "Informe seu WhatsApp."),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationInputSchema>;
