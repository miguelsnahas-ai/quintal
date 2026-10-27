"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { Input, Label, Select, FieldError } from "@/components/ui/Field";
import { HandNote } from "@/components/marks/HandNote";
import { TEST_ACCESS_COOKIE } from "@/lib/testAccess";
import type { ActivitySummary } from "@/lib/activity";
import type { RecommendationFeedback as FeedbackValue } from "@/lib/recommendation";
import ActivityCard from "./ActivityCard";
import RecommendationFeedback from "./RecommendationFeedback";

export type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
  activity?: ActivitySummary | null;
  // Present only alongside `activity`, when it came from a specific
  // Recommendation Engine decision (Fase 6) — lets the feedback control
  // and the activity link (?rec=) attach to that exact occurrence rather
  // than "this activity" in the abstract.
  recommendationId?: string | null;
};

type Child = {
  id: string;
  name: string;
};

// Shared by /test/[caregiverId] (internal QA/pilot-link tool) and /quintal
// (the real product experience) — same chat UI and client-side behavior,
// wired to whatever server action each page passes in via `onSend`. Keeps
// the two call sites from re-implementing the same message list, draft
// state and pending/error handling twice.
export default function ConversationChat({
  caregiverId,
  childrenList,
  initialChildId = null,
  initialMessages = [],
  onSend,
  onFeedback,
  rememberDevice = false,
  suggestedQuestions = [],
}: {
  caregiverId: string;
  childrenList: Child[];
  // A criança ativa (Fase 16, ver src/lib/activeChild.ts) quando o
  // chamador tem uma — hoje só /quintal/chat passa isto, semeando o
  // seletor com o mesmo contexto que já vale pro resto do produto (não
  // mistura irmãos por padrão). A família ainda pode trocar dentro da
  // própria conversa quando quiser perguntar sobre outra criança sem sair
  // da tela — isso continua possível, só o ponto de partida mudou.
  initialChildId?: string | null;
  initialMessages?: ConversationTurn[];
  onSend: (input: {
    childId: string | null;
    history: ConversationTurn[];
  }) => Promise<{ reply: string; activity: ActivitySummary | null; recommendationId: string | null }>;
  // Optional so callers that don't wire it up (none currently) degrade to
  // simply not rendering the feedback control, rather than crashing.
  onFeedback?: (input: {
    recommendationId: string;
    feedback: FeedbackValue;
    note?: string;
  }) => Promise<void>;
  rememberDevice?: boolean;
  // Chips de pergunta sugerida (pedido explícito: "mais estímulos
  // visuais para interagir com a IA") — só renderizam enquanto a
  // conversa está vazia (ver uso abaixo), nunca somem o campo de texto
  // livre, é só um atalho. Calculado no server (chat/page.tsx) a partir
  // do que já foi registrado hoje — ver src/lib/chatSuggestions.ts.
  suggestedQuestions?: string[];
}) {
  // Prioridade: initialChildId (criança ativa, quando o chamador manda) >
  // auto-seleção quando só existe uma criança > nenhuma selecionada.
  const [childId, setChildId] = useState(
    initialChildId ?? (childrenList.length === 1 ? childrenList[0].id : ""),
  );
  const [messages, setMessages] = useState<ConversationTurn[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const threadRef = useRef<HTMLDivElement>(null);

  // Padrão de chat: a tela sempre abre e permanece no fim da conversa —
  // quem quer ver mensagens antigas rola para cima dentro da própria
  // "thread", a página ao redor não rola. Dispara na montagem (mensagens
  // antigas já carregadas do servidor) e a cada nova mensagem/resposta.
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isPending]);

  // Lets /comecar recognize this browser on a later visit and skip
  // straight back to this same chat instead of creating a new family.
  // Only relevant for /test's own device-memory convenience — /quintal
  // has a real session cookie instead and passes rememberDevice={false}.
  useEffect(() => {
    if (!rememberDevice) return;
    try {
      const maxAgeSeconds = 60 * 60 * 24 * 180;
      document.cookie = `${TEST_ACCESS_COOKIE}=${caregiverId}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
    } catch {
      // Cookie access can fail in some private-browsing contexts — losing
      // the "remember this device" convenience is fine, chat still works.
    }
  }, [rememberDevice, caregiverId]);

  function sendMessage(overrideText?: string) {
    const text = (overrideText ?? draft).trim();
    if (!text || isPending) return;

    setError(null);
    setDraft("");
    const nextHistory: ConversationTurn[] = [...messages, { role: "user", content: text }];
    setMessages(nextHistory);

    startTransition(async () => {
      try {
        const { reply, activity, recommendationId } = await onSend({
          childId: childId || null,
          history: nextHistory,
        });
        setMessages((current) => [
          ...current,
          { role: "assistant", content: reply, activity, recommendationId },
        ]);
      } catch {
        setError("Não foi possível enviar. Tente de novo.");
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {childrenList.length > 1 && (
        <div className="space-y-1">
          <Label>Sobre qual criança é a conversa?</Label>
          <Select value={childId} onChange={(event) => setChildId(event.target.value)}>
            <option value="">Nenhuma criança específica</option>
            {childrenList.map((child) => (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <FieldError>{error}</FieldError>

      <div
        ref={threadRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-sm border border-neutral bg-chat-thread p-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <HandNote tone="sage" tilt={-2} size={18}>
              Oi! Pode perguntar qualquer coisa 💬
            </HandNote>
            <p className="text-sm text-ink-muted">Escreva uma mensagem abaixo para começar.</p>
            {suggestedQuestions.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {suggestedQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => sendMessage(question)}
                    disabled={isPending}
                    className="rounded-full border border-neutral bg-primary px-3 py-1.5 text-xs font-medium text-ink shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-lift)] disabled:opacity-50"
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex flex-col gap-2 ${message.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-md px-3 py-2 text-sm shadow-[var(--shadow-card)] ${
                  message.role === "user" ? "bg-chat-bubble-mine text-ink" : "bg-primary text-ink"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
              {message.activity && (
                <div className="w-full max-w-[80%] space-y-1.5">
                  <p className="text-xs font-medium text-ink-muted">Uma ideia para agora</p>
                  <ActivityCard activity={message.activity} recommendationId={message.recommendationId} />
                  {onFeedback && message.recommendationId && (
                    <RecommendationFeedback
                      recommendationId={message.recommendationId}
                      onSubmit={onFeedback}
                    />
                  )}
                </div>
              )}
            </div>
          ))
        )}
        {isPending && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-md bg-primary px-3 py-2 text-sm text-ink-muted shadow-[var(--shadow-card)]">
              digitando...
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage();
        }}
        className="flex gap-2"
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Digite uma mensagem..."
          className="flex-1 rounded-full"
          autoFocus
        />
        <button
          type="submit"
          disabled={isPending || !draft.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink transition-all duration-200 hover:brightness-95 disabled:opacity-50"
        >
          <Send className="h-4 w-4" aria-hidden />
          Enviar
        </button>
      </form>
    </div>
  );
}
