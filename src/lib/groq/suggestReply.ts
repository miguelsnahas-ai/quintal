import { createGroqClient } from "./client";
import { eventTypeLabels, type EventType } from "@/lib/validation/events";
import { getCustomInstructions } from "@/lib/ai-settings";
import { searchKnowledge } from "@/lib/knowledge";

// Same reasoning as suggestEvent.ts: openai/gpt-oss-120b, Groq's
// recommended free-tier replacement for the deprecated
// llama-3.3-70b-versatile.
const MODEL = "openai/gpt-oss-120b";

export async function suggestReply(input: {
  messageBody: string;
  childName: string | null;
  childAge: string | null;
  childAgeMonths: number | null;
  recentEvents: { type: string; notes: string; occurredAt: string }[];
  recentMessages: { direction: string; body: string }[];
}): Promise<string> {
  const client = createGroqClient();

  const contextBlock = input.childName
    ? `Criança: ${input.childName}${input.childAge ? ` (${input.childAge})` : ""}

Histórico recente:
${
  input.recentEvents.length
    ? input.recentEvents
        .map((event) => {
          const label = eventTypeLabels[event.type as EventType] ?? event.type;
          const date = new Date(event.occurredAt).toLocaleDateString("pt-BR");
          return `- [${label}] ${date}: ${event.notes}`;
        })
        .join("\n")
    : "Nenhum evento registrado ainda."
}`
    : "Não há uma criança específica identificada para esta conversa.";

  const [customInstructions, knowledgeChunks] = await Promise.all([
    getCustomInstructions().catch(() => ""),
    searchKnowledge({
      query: input.messageBody,
      ageMonths: input.childAgeMonths,
    }).catch(() => []),
  ]);

  const knowledgeBlock = knowledgeChunks.length
    ? `\n\nBase de conhecimento (materiais, brincadeiras, alimentação, sono, desenvolvimento, higiene, passeios) — use o que for relevante para enriquecer a resposta, adapte a linguagem ao tom de WhatsApp, não cite fontes, IDs ou nomes de categoria:\n${knowledgeChunks
        .map((chunk) => `---\n${chunk.content}`)
        .join("\n")}`
    : "";

  // Without this, each reply is generated blind to everything said earlier
  // in the same conversation — a parent saying "ele fez de novo" has no
  // "de novo" to point to unless it happens to already be a logged event.
  const conversationHistoryBlock = input.recentMessages.length
    ? `Histórico recente da conversa (mais antigas primeiro, para você entender o contexto — não repita nem resuma isso na resposta):\n${input.recentMessages
        .map((message) => `${message.direction === "inbound" ? "Pai/mãe" : "Quintal"}: ${message.body}`)
        .join("\n")}\n\n`
    : "";

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `Você é o Quintal, um copiloto de parentalidade que responde pelo WhatsApp a pais de crianças pequenas. Uma operadora humana revisa e edita cada resposta antes de enviar — você está apenas rascunhando.

Escreva uma resposta curta (2 a 5 frases, tom de mensagem de WhatsApp), calorosa e prática, em português do Brasil, para a mensagem abaixo, usando o contexto da criança quando disponível.

Regras importantes:
- Baseie-se APENAS no que está no contexto, na mensagem e na base de conhecimento abaixo (quando houver). Nunca invente eventos, diagnósticos ou fatos que não foram informados.
- Não dê diagnóstico médico nem prometa resultados. Diante de sinais de saúde preocupantes, sugira conversar com o pediatra.
- Segurança sempre tem prioridade sobre preferência da família: sono seguro (de barriga para cima, superfície firme, sem objetos soltos no berço), risco de engasgo com objetos/alimentos pequenos ou duros, nunca mel antes de 1 ano, supervisão constante perto de água, e qualquer sinal de alerta de saúde.
- Seja acolhedor e específico à situação relatada, sem soar genérico ou robótico.
- Responda só com o texto da mensagem em si, sem saudação de assinatura nem aspas ao redor.${
          customInstructions
            ? `\n\nInstruções adicionais definidas pela operadora:\n${customInstructions}`
            : ""
        }${knowledgeBlock}`,
      },
      {
        role: "user",
        content: `${conversationHistoryBlock}${contextBlock}\n\nMensagem atual do pai/mãe: "${input.messageBody}"`,
      },
    ],
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) {
    throw new Error("A IA não retornou uma resposta.");
  }

  return text.trim();
}
