import { startSleep, endSleep, recordSleepPeriod, getOpenSleepSession, getTodaySleepSummary, guessSleepType } from "@/lib/sleep";
import { recordMealEvent, getMealSuggestions, getChildFeedingMethod, guessMealSlot } from "@/lib/feeding";
import { recordPlayEvent, getActivityHistory, getActivitySuggestions } from "@/lib/play";
import { appendFamilyPreferenceNote, addChildInterest } from "@/lib/familyContext";
import { getRoutineSuggestions } from "@/lib/routineEngine";
import { createServiceClient } from "@/lib/supabase/service";
import { formatDurationMinutes } from "@/lib/format";
import type { EventOrigin, EventType } from "@/lib/validation/events";
import { sleepTypeLabels, type SleepType } from "@/lib/validation/sleep";
import { mealSlotLabels, type MealSlot, type MealAcceptance } from "@/lib/validation/feeding";
import { activityFeedbackLabels, type ActivityFeedback } from "@/lib/validation/play";
import {
  preferenceCategoryLabels,
  type ChatAction,
  type NoteKind,
  type PreferenceCategory,
} from "@/lib/validation/chatAction";
import type { ChildContext } from "@/lib/childContext";

// ---------------------------------------------------------------------
// Fase 15 — a "camada controlada" pedida no objetivo: o único módulo que
// tem permissão de transformar um ChatAction (já validado, ver
// src/lib/validation/chatAction.ts e src/lib/groq/extractAction.ts) numa
// escrita de verdade. Toda gravação passa pelas mesmas funções que as
// telas manuais já usam (startSleep, recordMealEvent, recordPlayEvent,
// appendFamilyPreferenceNote...) — nada aqui faz um INSERT que essas
// funções não façam também, exceto createNoteEvent (observação/decisão),
// que nunca teve um módulo próprio porque sempre foi só tipo+notas (ver
// events.ts). Nenhum caminho aqui é alcançável a partir de texto do
// modelo sem passar pelo parse de chatActionSchema primeiro.
//
// Política de confirmação (documentada aqui, não deixada implícita):
// cada ação espelha a postura da tela manual equivalente.
//   - Sono com início E fim explícitos (um relato retroativo completo,
//     ex.: "ela dormiu das 14h às 15h20") sempre CONFIRMA antes de
//     gravar — é o único caso sem equivalente de "um toque" na UI manual
//     (lá, início e fim são sempre dois passos distintos no tempo) e é o
//     próprio exemplo usado no pedido desta fase.
//   - Sono só-início ou só-fim (fechando uma sessão em aberto) grava
//     direto — espelha exatamente os botões "Começou a dormir"/"Acordou"
//     de /quintal/sono, que também não pedem confirmação.
//   - Refeição e brincadeira gravam direto quando têm o mínimo de dado
//     útil (algum alimento/horário; um título de atividade) — espelha o
//     formulário de registro rápido e o "Como foi?" da Biblioteca, nenhum
//     dos dois pede confirmação hoje.
//   - Preferência SEMPRE confirma: é uma mudança duradoura, que influencia
//     recomendações futuras silenciosamente, e diferente de um evento não
//     tem uma tela de Timeline para editar/desfazer depois.
//   - Observação/decisão grava direto — mesmo risco (nenhum) que o
//     auto-registro grosseiro que já existia antes desta fase.
// ---------------------------------------------------------------------

function isValidDateString(value: string | null): value is string {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function formatHM(value: string): string {
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ---- Planos puros (sem banco) — testados em chatActions.test.ts, mesmo
// espírito de detectState/buildRoutineSuggestions em routineEngine.ts:
// toda decisão de "o que fazer com os campos extraídos" fica isolada do
// código assíncrono que efetivamente lê/grava. ------------------------

export type SleepDispatchPlan =
  | { kind: "start"; sleepType: SleepType; startedAt: string }
  | { kind: "end"; endedAt: string }
  | { kind: "confirm_complete"; sleepType: SleepType; startedAt: string; endedAt: string }
  | { kind: "insufficient" };

export function planSleepDispatch(
  action: { sleepType: SleepType | null; startedAt: string | null; endedAt: string | null },
  hasOpenSession: boolean,
): SleepDispatchPlan {
  const started = isValidDateString(action.startedAt) ? action.startedAt : null;
  const ended = isValidDateString(action.endedAt) ? action.endedAt : null;

  if (started && ended) {
    return {
      kind: "confirm_complete",
      sleepType: action.sleepType ?? guessSleepType(new Date(started).getHours()),
      startedAt: started,
      endedAt: ended,
    };
  }
  if (ended && !started) {
    return hasOpenSession ? { kind: "end", endedAt: ended } : { kind: "insufficient" };
  }
  if (started && !ended) {
    if (hasOpenSession) return { kind: "insufficient" }; // não abre uma segunda sessão por cima da que já está em aberto
    return {
      kind: "start",
      sleepType: action.sleepType ?? guessSleepType(new Date(started).getHours()),
      startedAt: started,
    };
  }
  return { kind: "insufficient" };
}

export type MealDispatchPlan =
  | { kind: "record"; slot: MealSlot; foods: string[]; acceptance: MealAcceptance; occurredAt: string }
  | { kind: "insufficient" };

export function planMealDispatch(action: {
  slot: MealSlot | null;
  foods: string[];
  acceptance: MealAcceptance | null;
  occurredAt: string | null;
}): MealDispatchPlan {
  const foods = action.foods.map((food) => food.trim()).filter(Boolean);
  if (foods.length === 0 && action.slot === null) return { kind: "insufficient" };

  const occurredAt = isValidDateString(action.occurredAt) ? action.occurredAt : new Date().toISOString();
  return {
    kind: "record",
    slot: action.slot ?? guessMealSlot(new Date(occurredAt).getHours()),
    foods,
    acceptance: action.acceptance ?? "unknown",
    occurredAt,
  };
}

export type PlayDispatchPlan =
  | {
      kind: "record";
      activityTitle: string;
      durationMinutes: number | null;
      feedback: ActivityFeedback | null;
      occurredAt: string;
    }
  | { kind: "insufficient" };

export function planPlayDispatch(action: {
  activityTitle: string | null;
  durationMinutes: number | null;
  feedback: ActivityFeedback | null;
  occurredAt: string | null;
}): PlayDispatchPlan {
  const title = action.activityTitle?.trim();
  if (!title) return { kind: "insufficient" };

  const occurredAt = isValidDateString(action.occurredAt) ? action.occurredAt : new Date().toISOString();
  return {
    kind: "record",
    activityTitle: title,
    durationMinutes: action.durationMinutes ?? null,
    feedback: action.feedback ?? null,
    occurredAt,
  };
}

export type PreferenceDispatchPlan =
  | { kind: "confirm"; category: PreferenceCategory; note: string }
  | { kind: "insufficient" };

export function planPreferenceDispatch(action: { category: PreferenceCategory; note: string }): PreferenceDispatchPlan {
  const note = action.note.trim();
  return note ? { kind: "confirm", category: action.category, note } : { kind: "insufficient" };
}

export type NoteDispatchPlan = { kind: "record"; noteKind: NoteKind; text: string } | { kind: "insufficient" };

export function planNoteDispatch(action: { kind: NoteKind; text: string }): NoteDispatchPlan {
  const text = action.text.trim();
  return text ? { kind: "record", noteKind: action.kind, text } : { kind: "insufficient" };
}

// ---- Confirmação entre turnos ----------------------------------------
//
// Nenhuma tabela nova: a ação pendente viaja dentro de
// messages.raw_payload (jsonb, já existia) da mensagem de SAÍDA que fez
// a pergunta. No turno seguinte, conversation.ts confere se a última
// mensagem de saída da família carrega uma pendingAction e se a nova
// mensagem do pai/mãe é uma confirmação — por regra fixa em código, não
// por julgamento do modelo, para essa decisão específica (gravar ou não)
// nunca depender só da IA. Uma confirmação clara reexecuta a MESMA ação
// já extraída originalmente, sem pedir pro modelo extrair de novo (evita
// o risco de uma segunda extração divergir da primeira).
const AFFIRMATIVE_PATTERN =
  /^(sim|isso|isso mesmo|exato|correto|pode|pode sim|confirmo|confirma|ok|okay|beleza|manda|manda ver)\b/i;
const NEGATIVE_PATTERN = /^(n[ãa]o|nao|espera|pera|errado|calma)\b/i;

export function matchesAffirmativeConfirmation(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (NEGATIVE_PATTERN.test(trimmed)) return false;
  return AFFIRMATIVE_PATTERN.test(trimmed);
}

// ---- Dispatch (async, escreve/lê de verdade) --------------------------

export type DispatchOutcome =
  | { status: "recorded"; eventType: EventType | null; reply: string }
  | { status: "needs_confirmation"; reply: string; pendingAction: ChatAction }
  | { status: "answered"; reply: string }
  | { status: "not_applicable" };

type DispatchContext = {
  childId: string | null;
  familyId: string;
  childContext: ChildContext | null;
  origin: EventOrigin;
  sourceMessageId: string | null;
};

const NO_CHILD_REPLY =
  "Preciso saber sobre qual criança é isso — escolha a criança no topo da conversa e me conta de novo.";

export async function dispatchChatAction(action: ChatAction, ctx: DispatchContext): Promise<DispatchOutcome> {
  switch (action.type) {
    case "NONE":
      return { status: "not_applicable" };

    case "CREATE_SLEEP_EVENT":
      return dispatchSleep(action, ctx);
    case "CREATE_MEAL_EVENT":
      return dispatchMeal(action, ctx);
    case "CREATE_PLAY_EVENT":
      return dispatchPlay(action, ctx);
    case "UPDATE_PREFERENCE":
      return dispatchPreference(action, ctx);
    case "CREATE_NOTE":
      return dispatchNote(action, ctx);

    case "GET_TODAY_ROUTINE":
      return ctx.childId ? answerTodayRoutine(ctx.childId) : { status: "answered", reply: NO_CHILD_REPLY };
    case "GET_MEAL_SUGGESTIONS":
      return answerMealSuggestions(ctx.childContext);
    case "GET_ACTIVITY_SUGGESTIONS":
      return answerActivitySuggestions(ctx.childContext);
    case "GET_SLEEP_SUMMARY":
      return ctx.childId ? answerSleepSummary(ctx.childId) : { status: "answered", reply: NO_CHILD_REPLY };
    case "GET_ACTIVITY_FEEDBACK":
      return ctx.childId ? answerActivityFeedback(ctx.childId) : { status: "answered", reply: NO_CHILD_REPLY };
    case "GET_FEEDING_METHOD":
      return ctx.childId ? answerFeedingMethod(ctx.childId) : { status: "answered", reply: NO_CHILD_REPLY };
  }
}

async function dispatchSleep(
  action: Extract<ChatAction, { type: "CREATE_SLEEP_EVENT" }>,
  ctx: DispatchContext,
): Promise<DispatchOutcome> {
  if (!ctx.childId) return { status: "answered", reply: NO_CHILD_REPLY };

  const openSession = await getOpenSleepSession(ctx.childId);
  const plan = planSleepDispatch(action, openSession !== null);

  switch (plan.kind) {
    case "insufficient":
      return { status: "not_applicable" };

    case "confirm_complete": {
      const question = `Entendi que ela dormiu das ${formatHM(plan.startedAt)} às ${formatHM(plan.endedAt)} (${sleepTypeLabels[plan.sleepType]}). Quer que eu registre?`;
      return { status: "needs_confirmation", reply: question, pendingAction: { ...action, sleepType: plan.sleepType, startedAt: plan.startedAt, endedAt: plan.endedAt } };
    }

    case "start": {
      await startSleep({
        childId: ctx.childId,
        sleepType: plan.sleepType,
        startedAt: plan.startedAt,
        notes: null,
        origin: ctx.origin,
        sourceMessageId: ctx.sourceMessageId,
      });
      return {
        status: "recorded",
        eventType: "sleep",
        reply: `Registrei: começou a dormir (${sleepTypeLabels[plan.sleepType]}) às ${formatHM(plan.startedAt)}.`,
      };
    }

    case "end": {
      await endSleep({ eventId: openSession!.id, childId: ctx.childId, endedAt: plan.endedAt, notes: null });
      return { status: "recorded", eventType: "sleep", reply: `Registrei que ela acordou às ${formatHM(plan.endedAt)}.` };
    }
  }
}

// Chamado só depois da confirmação do pai/mãe (ver applyConfirmedAction
// no fim do arquivo) — startedAt/endedAt/sleepType já vêm resolvidos na
// pendingAction (foram fixados em dispatchSleep, no ramo
// "confirm_complete"), então aqui é só gravar com recordSleepPeriod
// direto, sem passar de novo por planSleepDispatch (que sempre pediria
// confirmação de novo para um sono com início e fim completos e criaria
// um loop).
async function applyConfirmedSleep(
  action: Extract<ChatAction, { type: "CREATE_SLEEP_EVENT" }>,
  ctx: DispatchContext,
): Promise<DispatchOutcome> {
  if (!ctx.childId) return { status: "answered", reply: NO_CHILD_REPLY };
  if (!isValidDateString(action.startedAt) || !isValidDateString(action.endedAt)) {
    return { status: "not_applicable" };
  }

  const sleepType = action.sleepType ?? guessSleepType(new Date(action.startedAt).getHours());
  await recordSleepPeriod({
    childId: ctx.childId,
    sleepType,
    startedAt: action.startedAt,
    endedAt: action.endedAt,
    notes: null,
    origin: ctx.origin,
    sourceMessageId: ctx.sourceMessageId,
  });

  return {
    status: "recorded",
    eventType: "sleep",
    reply: `Registrado: sono das ${formatHM(action.startedAt)} às ${formatHM(action.endedAt)} (${sleepTypeLabels[sleepType]}).`,
  };
}

async function dispatchMeal(
  action: Extract<ChatAction, { type: "CREATE_MEAL_EVENT" }>,
  ctx: DispatchContext,
): Promise<DispatchOutcome> {
  if (!ctx.childId) return { status: "answered", reply: NO_CHILD_REPLY };

  const plan = planMealDispatch(action);
  if (plan.kind === "insufficient") return { status: "not_applicable" };

  await recordMealEvent({
    childId: ctx.childId,
    occurredAt: plan.occurredAt,
    slot: plan.slot,
    foods: plan.foods,
    acceptance: plan.acceptance,
    notes: null,
    offeringMethodId: null,
    suggestionId: null,
    origin: ctx.origin,
    sourceMessageId: ctx.sourceMessageId,
  });

  const foodsPart = plan.foods.length > 0 ? ` (${plan.foods.join(", ")})` : "";
  return {
    status: "recorded",
    eventType: "meal",
    reply: `Registrei ${mealSlotLabels[plan.slot].toLowerCase()}${foodsPart}.`,
  };
}

async function dispatchPlay(
  action: Extract<ChatAction, { type: "CREATE_PLAY_EVENT" }>,
  ctx: DispatchContext,
): Promise<DispatchOutcome> {
  if (!ctx.childId) return { status: "answered", reply: NO_CHILD_REPLY };

  const plan = planPlayDispatch(action);
  if (plan.kind === "insufficient") return { status: "not_applicable" };

  await recordPlayEvent({
    childId: ctx.childId,
    activityTitle: plan.activityTitle,
    durationMinutes: plan.durationMinutes,
    feedback: plan.feedback,
    occurredAt: plan.occurredAt,
    origin: ctx.origin,
    sourceMessageId: ctx.sourceMessageId,
  });

  const durationPart = plan.durationMinutes ? ` por ${formatDurationMinutes(plan.durationMinutes)}` : "";
  const feedbackPart = plan.feedback ? ` — ${activityFeedbackLabels[plan.feedback].toLowerCase()}` : "";
  return {
    status: "recorded",
    eventType: "free_play",
    reply: `Registrei: ${plan.activityTitle}${durationPart}${feedbackPart}.`,
  };
}

async function dispatchPreference(
  action: Extract<ChatAction, { type: "UPDATE_PREFERENCE" }>,
  ctx: DispatchContext,
): Promise<DispatchOutcome> {
  if (action.category === "child_interest" && !ctx.childId) {
    return { status: "answered", reply: NO_CHILD_REPLY };
  }

  const plan = planPreferenceDispatch(action);
  if (plan.kind === "insufficient") return { status: "not_applicable" };

  return {
    status: "needs_confirmation",
    reply: `Entendi: "${plan.note}" — quer que eu salve isso como preferência de ${preferenceCategoryLabels[plan.category].toLowerCase()}?`,
    pendingAction: action,
  };
}

// Chamado só por dispatchConfirmedAction (a preferência SEMPRE passa por
// confirm_complete-style confirmação, nunca é gravada na primeira
// passada — ver dispatchPreference acima). Fica separado do dispatch
// principal porque a gravação de fato (append vs. confirmar) só deve
// acontecer depois do "sim" do pai/mãe.
async function applyConfirmedPreference(
  action: Extract<ChatAction, { type: "UPDATE_PREFERENCE" }>,
  ctx: DispatchContext,
): Promise<DispatchOutcome> {
  const note = action.note.trim();
  if (!note) return { status: "not_applicable" };

  if (action.category === "child_interest") {
    if (!ctx.childId) return { status: "answered", reply: NO_CHILD_REPLY };
    await addChildInterest(ctx.childId, note);
  } else {
    await appendFamilyPreferenceNote(ctx.familyId, action.category, note);
  }

  return {
    status: "recorded",
    eventType: null,
    reply: `Salvei essa preferência de ${preferenceCategoryLabels[action.category].toLowerCase()}.`,
  };
}

async function dispatchNote(
  action: Extract<ChatAction, { type: "CREATE_NOTE" }>,
  ctx: DispatchContext,
): Promise<DispatchOutcome> {
  if (!ctx.childId) return { status: "answered", reply: NO_CHILD_REPLY };

  const plan = planNoteDispatch(action);
  if (plan.kind === "insufficient") return { status: "not_applicable" };

  await createNoteEvent({
    childId: ctx.childId,
    kind: plan.noteKind,
    text: plan.text,
    origin: ctx.origin,
    sourceMessageId: ctx.sourceMessageId,
  });

  return { status: "recorded", eventType: plan.noteKind, reply: `Registrei: ${plan.text}` };
}

// Único INSERT direto deste módulo — observation/decision nunca tiveram
// payload estruturado nem um módulo próprio (ver events.ts): sempre
// foram só tipo + notas, desde a Fase 3. Mesma forma que o fallback
// grosseiro de conversation.ts já gravava antes desta fase, só que agora
// atrás do parse de chatActionSchema em vez de direto do classificador.
async function createNoteEvent(input: {
  childId: string;
  kind: NoteKind;
  text: string;
  origin: EventOrigin;
  sourceMessageId: string | null;
}): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("events").insert({
    child_id: input.childId,
    type: input.kind,
    notes: input.text,
    origin: input.origin,
    source_message_id: input.sourceMessageId,
  });

  if (error) {
    console.error("Failed to record note event from chat", error);
    throw new Error("Não foi possível registrar.");
  }
}

// ---- Consultas (GET_*) — sempre respondem com dado real formatado em
// código, nunca com um resumo livre do modelo (a "camada controlada"
// vale tanto para escrita quanto para leitura: a resposta de uma
// pergunta factual não pode arriscar inventar um número). -------------

async function answerTodayRoutine(childId: string): Promise<DispatchOutcome> {
  const { suggestions } = await getRoutineSuggestions(childId);
  if (suggestions.length === 0) {
    return {
      status: "answered",
      reply: "Ainda não tenho dado suficiente pra sugerir o que vem a seguir — conforme forem registrando sono, refeições e brincadeiras, isso fica mais claro.",
    };
  }
  const lines = suggestions.map((s) => `${formatHM(s.suggestedAt)} — ${s.label}: ${s.reason}`);
  return {
    status: "answered",
    reply: `Uma possibilidade para o restante do dia (não é uma agenda fixa, é só uma ideia):\n${lines.join("\n")}`,
  };
}

async function answerMealSuggestions(childContext: ChildContext | null): Promise<DispatchOutcome> {
  const suggestions = await getMealSuggestions({
    ageMonths: childContext?.age.months ?? null,
    feedingMethodTitle: childContext?.child.feedingMethod ?? null,
  });
  if (suggestions.length === 0) {
    return { status: "answered", reply: "Ainda não encontrei sugestões de refeição para a idade dela." };
  }
  const titles = suggestions.slice(0, 4).map((s) => s.title);
  return { status: "answered", reply: `Algumas ideias de refeição: ${titles.join(", ")}.` };
}

async function answerActivitySuggestions(childContext: ChildContext | null): Promise<DispatchOutcome> {
  const suggestions = await getActivitySuggestions({
    ageMonths: childContext?.age.months ?? null,
    interests: childContext?.child.interests,
  });
  if (suggestions.length === 0) {
    return { status: "answered", reply: "Ainda não encontrei sugestões de brincadeira para a idade dela." };
  }
  const titles = suggestions.map((s) => s.title);
  return { status: "answered", reply: `Algumas ideias de brincadeira: ${titles.join(", ")}.` };
}

async function answerSleepSummary(childId: string): Promise<DispatchOutcome> {
  const summary = await getTodaySleepSummary(childId);

  if (summary.openSession) {
    const napsPart =
      summary.napCount > 0
        ? ` Hoje já foram ${summary.napCount} soneca${summary.napCount > 1 ? "s" : ""}, ${formatDurationMinutes(summary.napTotalMinutes)} no total.`
        : "";
    return { status: "answered", reply: `Ela está dormindo agora (desde ${formatHM(summary.openSession.startedAt)}).${napsPart}` };
  }

  if (summary.napCount === 0 && !summary.lastPeriod) {
    return { status: "answered", reply: "Ainda não tem sono registrado hoje." };
  }

  const parts: string[] = [];
  if (summary.napCount > 0) {
    parts.push(`${summary.napCount} soneca${summary.napCount > 1 ? "s" : ""}, totalizando ${formatDurationMinutes(summary.napTotalMinutes)}`);
  }
  if (summary.lastPeriod) {
    const typeLabel = summary.lastPeriod.sleepType ? sleepTypeLabels[summary.lastPeriod.sleepType] : "Sono";
    const durationPart = summary.lastPeriod.durationMinutes !== null ? ` (${formatDurationMinutes(summary.lastPeriod.durationMinutes)})` : "";
    parts.push(`o último período foi ${typeLabel.toLowerCase()}${durationPart}`);
  }
  return { status: "answered", reply: `Hoje: ${parts.join("; ")}.` };
}

async function answerActivityFeedback(childId: string): Promise<DispatchOutcome> {
  const history = await getActivityHistory(childId, 30);
  const dedupe = (titles: (string | null)[]) => [...new Set(titles.filter((t): t is string => Boolean(t)))];

  const loved = dedupe(history.filter((h) => h.feedback === "loved" || h.feedback === "liked").map((h) => h.activityTitle));
  const disliked = dedupe(
    history.filter((h) => h.feedback === "not_interested" || h.feedback === "did_not_do").map((h) => h.activityTitle),
  );

  if (loved.length === 0 && disliked.length === 0) {
    return { status: "answered", reply: "Ainda não tem feedback de brincadeiras registrado." };
  }

  const parts: string[] = [];
  if (loved.length > 0) parts.push(`Ela tem gostado de: ${loved.slice(0, 5).join(", ")}.`);
  if (disliked.length > 0) parts.push(`Não rendeu tanto: ${disliked.slice(0, 5).join(", ")}.`);
  return { status: "answered", reply: parts.join(" ") };
}

async function answerFeedingMethod(childId: string): Promise<DispatchOutcome> {
  const method = await getChildFeedingMethod(childId);
  const label = method.option?.title ?? method.custom;
  return {
    status: "answered",
    reply: label
      ? `O método alimentar escolhido é: ${label}.`
      : "Ainda não escolheram um método alimentar — dá pra configurar em Alimentação, no perfil.",
  };
}

// Ponte entre uma confirmação pendente e a gravação de fato — chamado por
// conversation.ts no lugar de dispatchChatAction quando a mensagem atual
// confirma o que foi perguntado no turno anterior (ver
// matchesAffirmativeConfirmation). Só dois tipos de ação chegam a ficar
// pendentes (sono completo e preferência — os únicos que
// dispatchChatAction pode devolver como needs_confirmation), então só
// eles precisam de um caminho aqui; qualquer outro tipo não deveria
// nunca aparecer como pendingAction, mas cai em "not_applicable" em vez
// de gravar algo não previsto.
export async function applyConfirmedAction(action: ChatAction, ctx: DispatchContext): Promise<DispatchOutcome> {
  if (action.type === "CREATE_SLEEP_EVENT") return applyConfirmedSleep(action, ctx);
  if (action.type === "UPDATE_PREFERENCE") return applyConfirmedPreference(action, ctx);
  return { status: "not_applicable" };
}
