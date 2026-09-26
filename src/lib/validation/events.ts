import { z } from "zod";

// As áreas do produto (ver README/briefing). "meal" e "outing" foram
// somados na Fase 8 (camada de contexto estruturado) para cobrir
// alimentação/passeios, que não tinham tipo próprio até então — o
// Dashboard (Fase 7) já documentava a ausência de "meal" especificamente.
// `payload` na tabela events fica reservado para campos estruturados por
// tipo quando tivermos evidência real do que registrar — por ora todo
// evento é tipo + quando + notas livres (+ duração opcional, Fase 8).
export const eventTypes = [
  "sleep",
  "routine",
  "free_play",
  "development",
  "observation",
  "decision",
  "meal",
  "outing",
] as const;

export type EventType = (typeof eventTypes)[number];

export const eventTypeLabels: Record<EventType, string> = {
  sleep: "Sono",
  routine: "Rotina",
  free_play: "Livre brincar",
  development: "Desenvolvimento",
  observation: "Observação",
  decision: "Decisão",
  meal: "Alimentação",
  outing: "Passeio",
};

// De onde um evento veio — Fase 8. Existe para o Concierge (e futuras
// telas de analytics) distinguirem o que foi digitado manualmente do que
// veio de uma mensagem de chat, sem inferir isso a partir de
// `source_message_id` (que só diz "veio de alguma mensagem", não
// necessariamente COMO). "system"/"recommendation" ainda não são
// emitidos por nenhum código — são preparação de arquitetura para
// eventos gerados automaticamente (ex.: uma extração futura a partir do
// texto do chat) ou a partir de uma recomendação aceita, nenhuma das
// duas implementada ainda.
export const eventOrigins = ["manual", "chat", "system", "recommendation"] as const;
export type EventOrigin = (typeof eventOrigins)[number];

export const eventInputSchema = z.object({
  child_id: z.uuid("Selecione uma criança."),
  type: z.enum(eventTypes, { message: "Selecione um tipo de evento." }),
  occurred_at: z.string().min(1, "Informe quando isso aconteceu."),
  notes: z.string().trim().min(1, "Descreva o que aconteceu."),
  source_message_id: z.uuid().optional(),
  duration_minutes: z
    .union([z.coerce.number().int().positive(), z.literal("")])
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
});

export type EventInput = z.infer<typeof eventInputSchema>;
