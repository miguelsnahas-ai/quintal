import { z } from "zod";
import { createGroqClient } from "./client";
import { getCustomInstructions } from "@/lib/ai-settings";
import { searchKnowledge } from "@/lib/knowledge";
import { formatChildContextForPrompt, type ChildContext } from "@/lib/childContext";
import { isActivityCategory } from "@/lib/activity";

// Same reasoning as suggestEvent.ts: openai/gpt-oss-120b, Groq's
// recommended free-tier replacement for the deprecated
// llama-3.3-70b-versatile.
const MODEL = "openai/gpt-oss-120b";

const replySchema = z.object({
  text: z.string(),
  activityId: z.string().nullable(),
});

export type ReplySuggestion = z.infer<typeof replySchema>;

export async function suggestReply(input: {
  messageBody: string;
  childContext: ChildContext | null;
  recentMessages: { direction: string; body: string }[];
}): Promise<ReplySuggestion> {
  const client = createGroqClient();

  const contextBlock = input.childContext
    ? formatChildContextForPrompt(input.childContext)
    : "Não há uma criança específica identificada para esta conversa.";

  const [customInstructions, knowledgeChunks] = await Promise.all([
    getCustomInstructions().catch(() => ""),
    searchKnowledge({
      query: input.messageBody,
      ageMonths: input.childContext?.age.months ?? null,
    }).catch(() => []),
  ]);

  const knowledgeBlock = knowledgeChunks.length
    ? `\n\nBase de conhecimento (materiais, brincadeiras, alimentação, sono, desenvolvimento, higiene, passeios) — use o que for relevante para enriquecer a resposta, adapte a linguagem ao tom de WhatsApp, não cite fontes, IDs ou nomes de categoria:\n${knowledgeChunks
        .map((chunk) => `---\n${chunk.content}`)
        .join("\n")}`
    : "";

  // Only brincadeiras/materiais rows are "activities" a family can open
  // and follow step by step (see src/lib/activity.ts) — everything else
  // in knowledgeBlock above is background context, not something with its
  // own page. Listing candidates by id here, separately, is what lets the
  // model attach a real activityId instead of the reply just trailing off
  // into "você pode brincar de X" with nothing to open.
  const activityCandidates = knowledgeChunks.filter((chunk) => isActivityCategory(chunk.category));
  const activityBlock = activityCandidates.length
    ? `\n\nAtividades específicas disponíveis para recomendar agora (preencha "activityId" com um destes IDs SOMENTE se sua resposta estiver recomendando diretamente uma delas; nunca invente um id fora desta lista; use null se nenhuma se aplica ou se você não está recomendando uma atividade específica):\n${activityCandidates
        .map((chunk) => `- id "${chunk.id}": ${chunk.title}`)
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
    response_format: { type: "json_object" },
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
- Se você recomendar uma atividade específica da lista abaixo, mencione-a pelo nome no texto (ex.: "que tal a brincadeira X?"), mas não descreva o passo a passo completo — a família vai abrir a atividade para ver os detalhes.
- "text" deve conter só o texto da mensagem em si, sem saudação de assinatura nem aspas ao redor.${
          customInstructions
            ? `\n\nInstruções adicionais definidas pela operadora:\n${customInstructions}`
            : ""
        }${knowledgeBlock}${activityBlock}

Responda APENAS com um objeto JSON no formato exato: {"text": "<sua resposta>", "activityId": "<um dos ids listados acima, ou null>"}. Nenhum texto fora do JSON.`,
      },
      {
        role: "user",
        content: `${conversationHistoryBlock}${contextBlock}\n\nMensagem atual do pai/mãe: "${input.messageBody}"`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("A IA não retornou uma resposta.");
  }

  const parsed = replySchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error("A IA não retornou uma resposta válida.");
  }

  // Guard against a hallucinated/stale id that isn't actually one of the
  // candidates just offered — drop the reference rather than trust it
  // blindly; a plain reply beats a broken activity link.
  const activityId = activityCandidates.some((chunk) => chunk.id === parsed.data.activityId)
    ? parsed.data.activityId
    : null;

  return { text: parsed.data.text.trim(), activityId };
}
