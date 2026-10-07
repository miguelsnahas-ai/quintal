import { z } from "zod";

// As quatro opções pedidas para "Como foi?" — deliberadamente não um
// booleano (ajudou/não ajudou, como activity_feedback da Fase 4) nem o
// vocabulário de activity_recommendation_feedback (worked/did_not_work/
// wants_another, Fase 6): este é um terceiro mecanismo de feedback, mais
// pessoal e granular, pensado para quando a família registra uma
// atividade feita fora de uma recomendação do chat (navegando a
// biblioteca) — ver src/lib/play.ts.
export const activityFeedbackOptions = ["loved", "liked", "not_interested", "did_not_do"] as const;
export type ActivityFeedback = (typeof activityFeedbackOptions)[number];

export const activityFeedbackLabels: Record<ActivityFeedback, string> = {
  loved: "Adorou",
  liked: "Gostou",
  not_interested: "Não se interessou",
  did_not_do: "Não fizemos",
};

// activityTitle é gravado junto (não só activityId) — mesmo raciocínio de
// meal guardar `foods` em vez de só uma referência: evita que formatar
// o histórico/prompt precise de uma segunda consulta assíncrona para
// resolver um título.
//
// activityId e feedback são nullable desde a Fase 15: um registro de
// brincadeira vindo do chat ("brincamos de empilhar blocos, 20 min") não
// necessariamente corresponde a uma atividade catalogada
// (activityId null — é uma descrição livre da família) nem
// necessariamente vem com uma reação explícita (feedback null — "Como
// foi?" continua obrigatório no fluxo da Biblioteca, mas o chat nunca
// inventa uma reação que a família não mencionou). Todo registro
// existente continua tendo os dois campos preenchidos normalmente.
export const playEventPayloadSchema = z.object({
  activityId: z.string().nullable(),
  activityTitle: z.string(),
  feedback: z.enum(activityFeedbackOptions).nullable(),
});

export type PlayEventPayload = z.infer<typeof playEventPayloadSchema>;

export const logActivityInputSchema = z.object({
  activity_id: z.string().min(1, "Atividade inválida."),
  feedback: z.enum(activityFeedbackOptions, { message: "Selecione como foi." }),
});

export type LogActivityInput = z.infer<typeof logActivityInputSchema>;
