import { z } from "zod";

// Deliberately loose: WhatsApp's payload has many message types (image,
// audio, location, interactive, reaction...) and we only need `from`,
// `id`, `timestamp`, `type`, and `text.body` for now. `.loose()` keeps
// unknown fields around in raw_payload instead of dropping them.
const webhookMessageSchema = z
  .object({
    from: z.string(),
    id: z.string(),
    timestamp: z.string(),
    type: z.string(),
    text: z.object({ body: z.string() }).optional(),
  })
  .loose();

const webhookValueSchema = z
  .object({
    messages: z.array(webhookMessageSchema).optional(),
  })
  .loose();

const webhookChangeSchema = z
  .object({
    value: webhookValueSchema,
  })
  .loose();

const webhookEntrySchema = z
  .object({
    changes: z.array(webhookChangeSchema),
  })
  .loose();

export const webhookPayloadSchema = z
  .object({
    object: z.string().optional(),
    entry: z.array(webhookEntrySchema).optional(),
  })
  .loose();

export type WebhookMessage = z.infer<typeof webhookMessageSchema>;
