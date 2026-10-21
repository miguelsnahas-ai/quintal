import { z } from "zod";
import { sleepTypes } from "@/lib/validation/sleep";
import { mealSlots, mealAcceptances } from "@/lib/validation/feeding";
import { activityFeedbackOptions } from "@/lib/validation/play";

// Fase 15 — a camada de ações estruturadas que o chat pode propor. Um
// ChatAction nunca escreve nada sozinho: é só um objeto de dados,
// validado aqui, que src/lib/chatActions.ts (a "camada controlada" pedida
// nesta fase) sabe interpretar e executar chamando as mesmas funções já
// usadas pelas telas manuais (startSleep/recordSleepPeriod, recordMealEvent,
// recordPlayEvent, updateFamilyPreferences...). O modelo (ver
// src/lib/groq/extractAction.ts) só tem permissão para PRODUZIR um valor
// deste tipo — nunca para tocar o banco diretamente.
//
// Datas/horas trafegam como string solta (mesmo formato "datetime-local"
// sem timezone que o resto do produto já usa — ver toDatetimeLocalValue
// em src/lib/format.ts), não um formato rígido: o dispatcher normaliza e
// valida com `new Date(...)` na hora de gravar, e trata qualquer valor
// que não vire uma data válida como "não informado" em vez de rejeitar a
// ação inteira.

export const preferenceCategories = [
  "feeding",
  "routine",
  "play",
  "materials",
  "interaction",
  "child_interest",
] as const;
export type PreferenceCategory = (typeof preferenceCategories)[number];

export const preferenceCategoryLabels: Record<PreferenceCategory, string> = {
  feeding: "Alimentação",
  routine: "Rotina",
  play: "Brincadeiras",
  materials: "Materiais",
  interaction: "Estilo de interação",
  child_interest: "Interesse da criança",
};

export const noteKinds = ["observation", "decision"] as const;
export type NoteKind = (typeof noteKinds)[number];

export const chatActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("CREATE_SLEEP_EVENT"),
    sleepType: z.enum(sleepTypes).nullable(),
    startedAt: z.string().nullable(),
    endedAt: z.string().nullable(),
  }),
  z.object({
    type: z.literal("CREATE_MEAL_EVENT"),
    slot: z.enum(mealSlots).nullable(),
    foods: z.array(z.string()),
    acceptance: z.enum(mealAcceptances).nullable(),
    occurredAt: z.string().nullable(),
  }),
  z.object({
    type: z.literal("CREATE_PLAY_EVENT"),
    activityTitle: z.string().nullable(),
    durationMinutes: z.number().int().positive().nullable(),
    feedback: z.enum(activityFeedbackOptions).nullable(),
    occurredAt: z.string().nullable(),
  }),
  z.object({
    type: z.literal("UPDATE_PREFERENCE"),
    category: z.enum(preferenceCategories),
    note: z.string(),
  }),
  z.object({
    type: z.literal("CREATE_NOTE"),
    kind: z.enum(noteKinds),
    text: z.string(),
  }),
  z.object({ type: z.literal("GET_TODAY_ROUTINE") }),
  z.object({ type: z.literal("GET_MEAL_SUGGESTIONS") }),
  z.object({ type: z.literal("GET_ACTIVITY_SUGGESTIONS") }),
  z.object({ type: z.literal("GET_SLEEP_SUMMARY") }),
  z.object({ type: z.literal("GET_ACTIVITY_FEEDBACK") }),
  z.object({ type: z.literal("GET_FEEDING_METHOD") }),
  z.object({ type: z.literal("NONE") }),
]);

export type ChatAction = z.infer<typeof chatActionSchema>;
export type ChatActionType = ChatAction["type"];

// Usado pelo prompt de extração (listar as opções para o modelo) e pelo
// dispatcher (decidir se uma ação precisa de child_id).
export const CREATE_ACTION_TYPES = [
  "CREATE_SLEEP_EVENT",
  "CREATE_MEAL_EVENT",
  "CREATE_PLAY_EVENT",
  "UPDATE_PREFERENCE",
  "CREATE_NOTE",
] as const satisfies readonly ChatActionType[];

export const QUERY_ACTION_TYPES = [
  "GET_TODAY_ROUTINE",
  "GET_MEAL_SUGGESTIONS",
  "GET_ACTIVITY_SUGGESTIONS",
  "GET_SLEEP_SUMMARY",
  "GET_ACTIVITY_FEEDBACK",
  "GET_FEEDING_METHOD",
] as const satisfies readonly ChatActionType[];
