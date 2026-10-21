import { createGroqClient } from "./client";
import { getCustomInstructions } from "@/lib/ai-settings";
import { formatChildContextForPrompt, type ChildContext } from "@/lib/childContext";
import { toDatetimeLocalValue } from "@/lib/format";
import {
  chatActionSchema,
  preferenceCategoryLabels,
  type ChatAction,
} from "@/lib/validation/chatAction";
import { sleepTypeLabels } from "@/lib/validation/sleep";
import { mealSlotLabels, mealAcceptanceLabels } from "@/lib/validation/feeding";
import { activityFeedbackLabels } from "@/lib/validation/play";

// Same model/structured-output reasoning as the other groq/*.ts modules
// (json_object + our own Zod validation instead of Groq's less reliable
// json_schema mode).
const MODEL = "openai/gpt-oss-120b";

// Fase 15 — "transformar o chat numa interface natural para os dados
// estruturados". Esta é a única função que decide QUAL ação (se alguma)
// uma mensagem pede — a DECISÃO. Ela nunca grava nada: devolve um
// ChatAction (src/lib/validation/chatAction.ts) que src/lib/chatActions.ts
// valida de novo e executa através das mesmas funções já usadas pelas
// telas manuais. Se o modelo devolver algo que não bate com o schema, o
// chamador trata como NONE (ver conversation.ts) — nunca deixamos um
// JSON malformado virar uma gravação.
//
// Deliberadamente separada de suggestEventFromMessage (Fase 8): aquela
// continua existindo e sendo usada pela triagem manual do /ops/inbox
// (um humano sempre revisa ali antes de salvar, e seu formato
// {type, notes, isConcreteEvent} é simples demais pro que esta fase
// pede). conversation.ts só chama esta função quando a Recommendation
// Engine (recommendActivity) já decidiu que a mensagem NÃO é um pedido
// de sugestão de atividade — ver o comentário em conversation.ts sobre a
// ordem das três camadas.
export async function extractChatAction(input: {
  messageBody: string;
  childContext: ChildContext | null;
  recentMessages: { direction: string; body: string }[];
}): Promise<ChatAction> {
  const client = createGroqClient();

  const contextBlock = input.childContext
    ? formatChildContextForPrompt(input.childContext)
    : "Não há uma criança específica identificada para esta conversa.";

  const customInstructions = await getCustomInstructions().catch(() => "");

  const historyBlock = input.recentMessages.length
    ? `Histórico recente da conversa (mais antigas primeiro — use isto para reconhecer quando a mensagem atual está CONFIRMANDO ou RECUSANDO algo que você perguntou na mensagem anterior):\n${input.recentMessages
        .map((message) => `${message.direction === "inbound" ? "Pai/mãe" : "Quintal"}: ${message.body}`)
        .join("\n")}\n\n`
    : "";

  const now = new Date();
  const nowLocal = toDatetimeLocalValue(now);
  const weekday = now.toLocaleDateString("pt-BR", { weekday: "long" });

  const sleepTypeList = Object.entries(sleepTypeLabels).map(([k, v]) => `"${k}" (${v})`).join(", ");
  const mealSlotList = Object.entries(mealSlotLabels).map(([k, v]) => `"${k}" (${v})`).join(", ");
  const mealAcceptanceList = Object.entries(mealAcceptanceLabels).map(([k, v]) => `"${k}" (${v})`).join(", ");
  const feedbackList = Object.entries(activityFeedbackLabels).map(([k, v]) => `"${k}" (${v})`).join(", ");
  const preferenceCategoryList = Object.entries(preferenceCategoryLabels)
    .map(([k, v]) => `"${k}" (${v})`)
    .join(", ");

  const completion = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Você é a camada de extração do Quintal, um copiloto de parentalidade pelo WhatsApp. Sua ÚNICA tarefa é ler a mensagem de um pai/mãe e decidir se ela pede uma das ações estruturadas abaixo — você NUNCA responde ao pai/mãe diretamente, nunca inventa dado que não foi dito, e nunca escreve no banco (só devolve dados, outra camada do sistema decide o que fazer com eles).

Agora são ${nowLocal} (${weekday}). Datas/horas que você extrair devem estar no formato exato "AAAA-MM-DDTHH:mm" (sem "Z", sem segundos) — quando a mensagem não diz o dia, assuma hoje, a não ser que o histórico da conversa deixe claro outro dia.

Escolha UM "type" entre:

- "CREATE_SLEEP_EVENT": a mensagem relata um período de sono (começou, terminou, ou os dois). Campos: sleepType (um de ${sleepTypeList}, ou null se não der pra saber), startedAt (ou null), endedAt (ou null — null quando o sono ainda não acabou / a mensagem não menciona o fim).
- "CREATE_MEAL_EVENT": a mensagem relata uma refeição. Campos: slot (um de ${mealSlotList}, ou null), foods (lista de strings, os alimentos citados — [] se nenhum), acceptance (um de ${mealAcceptanceList}, ou null se não der pra inferir do texto), occurredAt (ou null).
- "CREATE_PLAY_EVENT": a mensagem relata uma brincadeira/atividade feita. Campos: activityTitle (string curta descrevendo a brincadeira, ou null), durationMinutes (número inteiro de minutos, ou null se não mencionado), feedback (um de ${feedbackList}, APENAS se a mensagem disser claramente como foi — null caso contrário, NUNCA invente uma reação), occurredAt (ou null).
- "UPDATE_PREFERENCE": a mensagem descreve uma preferência, gosto ou característica duradoura da criança/família (ex.: "ela não gosta de barulho", "preferimos rotina mais flexível"). Campos: category (um de ${preferenceCategoryList}), note (uma frase curta e fiel resumindo a preferência).
- "CREATE_NOTE": a mensagem é uma observação ou decisão da família que vale registrar, mas não é sono/refeição/brincadeira/preferência (ex.: um marco de desenvolvimento, uma decisão sobre a rotina). Campos: kind ("observation" ou "decision"), text (frase curta e fiel).
- "GET_TODAY_ROUTINE": pergunta sobre o que fazer agora/no resto do dia, próxima atividade sugerida.
- "GET_MEAL_SUGGESTIONS": pede ideias/sugestões de refeição.
- "GET_ACTIVITY_SUGGESTIONS": pede ideias/sugestões de brincadeira (quando NÃO é um relato de algo que já aconteceu — isso seria CREATE_PLAY_EVENT).
- "GET_SLEEP_SUMMARY": pergunta como foi o sono (hoje, hoje à tarde, etc.).
- "GET_ACTIVITY_FEEDBACK": pergunta que brincadeiras/atividades a criança tem gostado ou não gostado.
- "GET_FEEDING_METHOD": pergunta qual método alimentar a família escolheu/está usando.
- "NONE": qualquer outra coisa — cumprimento, pergunta genérica, mensagem vaga demais, pedido de sugestão de atividade (isso é decidido por outra camada do sistema, não aqui), ou quando a mensagem anterior do Quintal pediu uma confirmação e esta mensagem RECUSA ou é ambígua sobre isso.

IMPORTANTE sobre confirmação: se a mensagem anterior do Quintal (no histórico acima) perguntou algo como "Quer que eu registre?" sobre uma ação específica, e a mensagem atual do pai/mãe confirma isso claramente (ex.: "sim", "pode", "isso mesmo", "confirma"), reconstrua a MESMA ação completa (com os mesmos dados da mensagem original que gerou a pergunta), preenchendo os campos a partir do que já foi dito antes no histórico. Se a mensagem atual recusa ou muda de assunto, responda "NONE".

Responda APENAS com um objeto JSON com "type" e os campos daquele tipo (objeto vazio além de "type" para os tipos GET_*/NONE que não têm campos). Nenhum texto fora do JSON.${
          customInstructions
            ? `\n\nInstruções adicionais definidas pela operadora:\n${customInstructions}`
            : ""
        }`,
      },
      {
        role: "user",
        content: `${historyBlock}${contextBlock}\n\nMensagem atual do pai/mãe: "${input.messageBody}"`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    return { type: "NONE" };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { type: "NONE" };
  }

  const parsed = chatActionSchema.safeParse(json);
  return parsed.success ? parsed.data : { type: "NONE" };
}
