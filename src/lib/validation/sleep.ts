import { z } from "zod";

// "Noite" vs. "soneca" — o único vocabulário pedido nesta fase. Guardado
// em events.payload (jsonb), mesmo padrão já usado por meal (Fase 9):
// nenhuma coluna nova, o campo é específico do tipo 'sleep' e não faz
// sentido para os outros tipos de evento.
export const sleepTypes = ["night", "nap"] as const;
export type SleepType = (typeof sleepTypes)[number];

export const sleepTypeLabels: Record<SleepType, string> = {
  night: "Sono noturno",
  nap: "Soneca",
};

// Um período de sono em andamento tem endedAt: null — é essa a diferença
// entre "a criança começou a dormir, ainda não acordou" e um registro já
// completo. sleepType sempre presente distingue um evento 'sleep' desta
// fase de um evento 'sleep' antigo/manual (Fase 8, via /ops) sem payload
// estruturado — ver src/lib/sleep.ts, getOpenSleepSession.
export const sleepEventPayloadSchema = z.object({
  sleepType: z.enum(sleepTypes),
  endedAt: z.string().nullable(),
});

export type SleepEventPayload = z.infer<typeof sleepEventPayloadSchema>;

// "Começou a dormir" — só o início, sem duração ainda.
export const sleepStartInputSchema = z.object({
  child_id: z.uuid("Selecione uma criança."),
  sleep_type: z.enum(sleepTypes, { message: "Selecione o tipo de sono." }),
  started_at: z.string().min(1, "Informe quando começou."),
  notes: z.string().trim().optional(),
});

export type SleepStartInput = z.infer<typeof sleepStartInputSchema>;

// "Acordou" — fecha um período já em andamento (event_id).
export const sleepEndInputSchema = z.object({
  child_id: z.uuid("Selecione uma criança."),
  event_id: z.uuid("Sono em andamento não encontrado."),
  ended_at: z.string().min(1, "Informe quando acordou."),
  notes: z.string().trim().optional(),
});

export type SleepEndInput = z.infer<typeof sleepEndInputSchema>;

// Registro retroativo: início e fim de uma vez, para quando a família
// esquece de registrar em tempo real.
export const sleepPeriodInputSchema = z
  .object({
    child_id: z.uuid("Selecione uma criança."),
    sleep_type: z.enum(sleepTypes, { message: "Selecione o tipo de sono." }),
    started_at: z.string().min(1, "Informe quando começou."),
    ended_at: z.string().min(1, "Informe quando acordou."),
    notes: z.string().trim().optional(),
  })
  .refine((data) => new Date(data.ended_at).getTime() > new Date(data.started_at).getTime(), {
    message: "O fim precisa ser depois do início.",
    path: ["ended_at"],
  });

export type SleepPeriodInput = z.infer<typeof sleepPeriodInputSchema>;
