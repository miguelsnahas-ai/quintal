import { z } from "zod";
import { createGroqClient } from "./client";

// Same model/structured-output reasoning as suggestEvent.ts and
// suggestReply.ts.
const MODEL = "openai/gpt-oss-120b";

const detectionSchema = z.object({
  wantsActivitySuggestion: z.boolean(),
  situationSummary: z.string(),
});

export type ActivityRequestDetection = z.infer<typeof detectionSchema>;

// The "intent/context" step of the recommendation pipeline
// (src/lib/recommendation.ts) — deliberately its own small, cheap call
// instead of folding this judgment into suggestReply or into the
// recommendation decision itself. It answers exactly one question ("is
// this a situation where suggesting an activity makes sense?") and
// extracts a short, faithful summary used downstream as the knowledge
// search query and as the basis for the recommendation's explanation —
// never as a hidden channel for inventing details not in the message.
export async function detectActivityRequest(input: {
  messageBody: string;
  recentMessages: { direction: string; body: string }[];
}): Promise<ActivityRequestDetection> {
  const client = createGroqClient();

  const historyBlock = input.recentMessages.length
    ? `Histórico recente da conversa (mais antigas primeiro, só para entender o contexto):\n${input.recentMessages
        .map((message) => `${message.direction === "inbound" ? "Pai/mãe" : "Quintal"}: ${message.body}`)
        .join("\n")}\n\n`
    : "";

  const completion = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Você ajuda a decidir se uma mensagem de WhatsApp de um pai/mãe descreve uma situação em que sugerir uma atividade concreta para fazer com a criança agora faria sentido — por exemplo "ela está entediada", "não sei o que fazer com ele essa tarde", "ele está muito agitado", "preciso de uma ideia rápida para acalmar".

Avalie "wantsActivitySuggestion": true SOMENTE quando a mensagem descreve esse tipo de situação (tédio, falta do que fazer, pedido direto de sugestão/ideia/brincadeira). Use false para relatos de eventos (sono, comida, saúde, desenvolvimento), dúvidas administrativas, cumprimentos, agradecimentos, ou qualquer mensagem que não esteja pedindo, direta ou indiretamente, uma sugestão de atividade para agora.

Também escreva "situationSummary": uma frase curta e neutra em português descrevendo a situação relatada (ex.: "criança entediada, sem saber o que fazer"). Baseie-se só no que a mensagem realmente diz — nunca invente um detalhe que não foi mencionado. Se "wantsActivitySuggestion" for false, ainda assim preencha "situationSummary" com um resumo curto da mensagem (o campo é obrigatório).

Responda APENAS com um objeto JSON no formato exato: {"wantsActivitySuggestion": <true|false>, "situationSummary": "<string>"}. Nenhum texto fora do JSON.`,
      },
      {
        role: "user",
        content: `${historyBlock}Mensagem atual: "${input.messageBody}"`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("A IA não retornou uma classificação.");
  }

  const parsed = detectionSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error("A IA não retornou uma classificação válida.");
  }

  return parsed.data;
}
