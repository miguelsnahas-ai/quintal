import { z } from "zod";

// Graph API version last checked against Meta's docs during development.
// Meta keeps versions supported for a long window, so this should keep
// working for a while; override via WHATSAPP_GRAPH_API_VERSION if a
// message ever fails with a deprecation error.
const DEFAULT_GRAPH_API_VERSION = "v21.0";

const sendResponseSchema = z
  .object({
    messages: z.array(z.object({ id: z.string() })).min(1),
  })
  .loose();

const errorResponseSchema = z
  .object({
    error: z.object({ message: z.string() }).loose(),
  })
  .loose();

export async function sendWhatsAppTextMessage(input: {
  to: string;
  body: string;
}): Promise<{ waMessageId: string; raw: unknown }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error(
      "WhatsApp não está configurado (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN ausentes).",
    );
  }

  const graphApiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || DEFAULT_GRAPH_API_VERSION;
  // Cloud API expects the number without the leading "+".
  const to = input.to.replace(/^\+/, "");

  const response = await fetch(
    `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: input.body },
      }),
    },
  );

  const rawPayload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsedError = errorResponseSchema.safeParse(rawPayload);
    throw new Error(
      parsedError.success
        ? parsedError.data.error.message
        : `Falha ao enviar mensagem (HTTP ${response.status}).`,
    );
  }

  const parsed = sendResponseSchema.safeParse(rawPayload);
  if (!parsed.success) {
    throw new Error("WhatsApp não retornou o id da mensagem enviada.");
  }

  return { waMessageId: parsed.data.messages[0].id, raw: rawPayload };
}
