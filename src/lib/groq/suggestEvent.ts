import { z } from "zod";
import { createGroqClient } from "./client";
import { eventTypeLabels, eventTypes } from "@/lib/validation/events";
import { getCustomInstructions } from "@/lib/ai-settings";

// llama-3.3-70b-versatile (used here previously) was deprecated by Groq
// in June 2026; openai/gpt-oss-120b is their recommended free-tier
// replacement. Its `json_schema` structured-output mode is known to be
// unreliable, so we use the older `json_object` mode plus our own Zod
// validation instead of relying on schema-enforced output.
const MODEL = "openai/gpt-oss-120b";

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
  const client = createGroqClient();

  const categoriesList = eventTypes
    .map((type) => `- ${type}: ${eventTypeLabels[type]}`)
    .join("\n");

  const customInstructions = await getCustomInstructions().catch(() => "");

  const completion = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Você ajuda uma operadora humana a triar mensagens de WhatsApp de pais sobre a rotina de filhos pequenos, para um copiloto de parentalidade chamado Quintal.

Classifique a mensagem em UM destes tipos:
${categoriesList}

Também escreva "notes": uma reescrita curta e fiel da mensagem, em português, preservando os fatos relevantes (o que aconteceu, quando, como a criança reagiu). Nunca invente informação que não esteja na mensagem — se ela já for curta e clara, pode mantê-la quase como está.

Sua sugestão é sempre revisada por um humano antes de ser salva. Na dúvida entre dois tipos, escolha o mais provável.

Responda APENAS com um objeto JSON no formato exato: {"type": "<um dos tipos acima>", "notes": "<string>"}. Nenhum texto fora do JSON.${
          customInstructions
            ? `\n\nInstruções adicionais definidas pela operadora:\n${customInstructions}`
            : ""
        }`,
      },
      {
        role: "user",
        content: `Criança: ${input.childName}${input.childAge ? ` (${input.childAge})` : ""}\nMensagem recebida: "${input.messageBody}"`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("A IA não retornou uma sugestão.");
  }

  const parsed = suggestionSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error("A IA não retornou uma sugestão válida.");
  }

  return parsed.data;
}
