import { z } from "zod";
import { createGroqClient } from "./client";
import { formatChildContextForPrompt, type ChildContext } from "@/lib/childContext";
import type { Activity } from "@/lib/activity";

// Same model/structured-output reasoning as suggestEvent.ts and
// suggestReply.ts.
const MODEL = "openai/gpt-oss-120b";

const explanationSchema = z.object({ reason: z.string() });

// The "redação" step of the recommendation pipeline
// (src/lib/recommendation.ts) — deliberately separate from the decision
// of WHICH activity to recommend. By the time this runs, the activity is
// already fixed by a deterministic rule; this call's only job is to put
// that fixed choice into natural, warm words. It is never asked to pick
// an activity and never given other candidates to choose from, so it has
// no way to substitute or invent a different one — the prompt names the
// decided activity once and instructs the model to stick to it.
export async function explainRecommendation(input: {
  activity: Activity;
  situationSummary: string;
  childContext: ChildContext;
}): Promise<string> {
  const client = createGroqClient();
  const contextBlock = formatChildContextForPrompt(input.childContext);

  const activityDetails = [
    input.activity.ageDisplayLabel ? `Faixa etária: ${input.activity.ageDisplayLabel}` : null,
    input.activity.why ? `Por que pode interessar: ${input.activity.why}` : null,
    input.activity.safety ? `Segurança/supervisão: ${input.activity.safety}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Você é o Quintal, um copiloto de parentalidade que responde pelo WhatsApp a pais de crianças pequenas.

A atividade a recomendar JÁ FOI DECIDIDA por uma regra separada — sua única tarefa é escrever uma mensagem curta (2 a 4 frases), calorosa, natural e específica à situação, em português do Brasil, explicando por que "${input.activity.title}" pode fazer sentido agora.

Regras importantes:
- NÃO sugira nem mencione nenhuma atividade diferente de "${input.activity.title}". Não invente uma alternativa, mesmo que ache que se encaixaria melhor.
- Baseie a explicação apenas no contexto da criança e nos detalhes da atividade abaixo — nunca invente fatos, preferências ou eventos que não foram informados.
- Mencione a atividade pelo nome no texto, mas não descreva o passo a passo completo — a família vai abrir a atividade para ver os detalhes.
- Se houver alguma informação de segurança/supervisão relevante, você pode citá-la brevemente, mas sem tom alarmista.
- Não dê diagnóstico médico nem prometa resultados de desenvolvimento.
- "reason" deve conter só o texto da mensagem, sem saudação, sem assinatura, sem aspas ao redor.

Responda APENAS com um objeto JSON no formato exato: {"reason": "<sua explicação>"}. Nenhum texto fora do JSON.`,
      },
      {
        role: "user",
        content: `${contextBlock}\n\nSituação relatada agora: ${input.situationSummary}\n\nAtividade decidida: ${input.activity.title}${activityDetails ? `\n${activityDetails}` : ""}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("A IA não retornou uma explicação.");
  }

  const parsed = explanationSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error("A IA não retornou uma explicação válida.");
  }

  return parsed.data.reason.trim();
}
