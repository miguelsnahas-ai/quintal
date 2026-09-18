import { z } from "zod";

// As seis áreas do produto (ver README/briefing). `payload` na tabela
// events fica reservado para campos estruturados por tipo quando
// tivermos evidência real do que registrar (ex: Sprint 4, extração via
// IA) — por ora todo evento é tipo + quando + notas livres.
export const eventTypes = [
  "sleep",
  "routine",
  "free_play",
  "development",
  "observation",
  "decision",
] as const;

export type EventType = (typeof eventTypes)[number];

export const eventTypeLabels: Record<EventType, string> = {
  sleep: "Sono",
  routine: "Rotina",
  free_play: "Livre brincar",
  development: "Desenvolvimento",
  observation: "Observação",
  decision: "Decisão",
};

export const eventInputSchema = z.object({
  child_id: z.uuid("Selecione uma criança."),
  type: z.enum(eventTypes, { message: "Selecione um tipo de evento." }),
  occurred_at: z.string().min(1, "Informe quando isso aconteceu."),
  notes: z.string().trim().min(1, "Descreva o que aconteceu."),
  source_message_id: z.uuid().optional(),
});

export type EventInput = z.infer<typeof eventInputSchema>;
