import { createOpenAIClient } from "./client";
import { eventTypeLabels, type EventType } from "@/lib/validation/events";

// Cost-tier model, same reasoning as suggestEvent.ts: short, well-scoped
// drafting task, not one that needs a flagship model.
const MODEL = "gpt-5.4-mini";

export async function suggestReply(input: {
  messageBody: string;
  childName: string | null;
  childAge: string | null;
  recentEvents: { type: string; notes: string; occurredAt: string }[];
}): Promise<string> {
  const client = createOpenAIClient();

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

  const response = await client.responses.create({
    model: MODEL,
    instructions: `Você é o Quintal, um copiloto de parentalidade que responde pelo WhatsApp a pais de crianças pequenas. Uma operadora humana revisa e edita cada resposta antes de enviar — você está apenas rascunhando.

Escreva uma resposta curta (2 a 5 frases, tom de mensagem de WhatsApp), calorosa e prática, em português do Brasil, para a mensagem abaixo, usando o contexto da criança quando disponível.

Regras importantes:
- Baseie-se APENAS no que está no contexto e na mensagem. Nunca invente eventos, diagnósticos ou fatos que não foram informados.
- Não dê diagnóstico médico nem prometa resultados. Diante de sinais de saúde preocupantes, sugira conversar com o pediatra.
- Seja acolhedor e específico à situação relatada, sem soar genérico ou robótico.
- Responda só com o texto da mensagem em si, sem saudação de assinatura nem aspas ao redor.`,
    input: `${contextBlock}

Mensagem do pai/mãe: "${input.messageBody}"`,
  });

  return response.output_text.trim();
}
