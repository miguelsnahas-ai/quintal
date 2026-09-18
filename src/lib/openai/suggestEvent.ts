import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { createOpenAIClient } from "./client";
import { eventTypeLabels, eventTypes } from "@/lib/validation/events";

// Cost-tier model: this is a short classify-and-paraphrase call, not a
// task that needs a flagship model. Revisit if quality turns out to need
// more than this tier can deliver.
const MODEL = "gpt-5.4-mini";

const suggestionSchema = z.object({
  type: z.enum(eventTypes),
  notes: z.string(),
});

export type EventSuggestion = z.infer<typeof suggestionSchema>;

export async function suggestEventFromMessage(input: {
  messageBody: string;
  childName: string;
  childAge: string | null;
}): Promise<EventSuggestion> {
  const client = createOpenAIClient();

  const categoriesList = eventTypes
    .map((type) => `- ${type}: ${eventTypeLabels[type]}`)
    .join("\n");

  const response = await client.responses.parse({
    model: MODEL,
    instructions: `Você ajuda uma operadora humana a triar mensagens de WhatsApp de pais sobre a rotina de filhos pequenos, para um copiloto de parentalidade chamado Quintal.

Classifique a mensagem em UM destes tipos:
${categoriesList}

Também escreva "notes": uma reescrita curta e fiel da mensagem, em português, preservando os fatos relevantes (o que aconteceu, quando, como a criança reagiu). Nunca invente informação que não esteja na mensagem — se ela já for curta e clara, pode mantê-la quase como está.

Sua sugestão é sempre revisada por um humano antes de ser salva. Na dúvida entre dois tipos, escolha o mais provável.`,
    input: `Criança: ${input.childName}${input.childAge ? ` (${input.childAge})` : ""}\nMensagem recebida: "${input.messageBody}"`,
    text: { format: zodTextFormat(suggestionSchema, "event_suggestion") },
  });

  if (!response.output_parsed) {
    throw new Error("A IA não retornou uma sugestão válida.");
  }

  return response.output_parsed;
}
