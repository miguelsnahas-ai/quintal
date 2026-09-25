"use client";

import { useEffect, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { Input, Label, Select, FieldError } from "@/components/ui/Field";
import { TEST_ACCESS_COOKIE } from "@/lib/testAccess";
import type { ActivitySummary } from "@/lib/activity";
import ActivityCard from "./ActivityCard";

export type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
  activity?: ActivitySummary | null;
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
  initialMessages = [],
  onSend,
  rememberDevice = false,
}: {
  caregiverId: string;
  childrenList: Child[];
  initialMessages?: ConversationTurn[];
  onSend: (input: {
    childId: string | null;
    history: ConversationTurn[];
  }) => Promise<{ reply: string; activity: ActivitySummary | null }>;
  rememberDevice?: boolean;
}) {
  // Auto-select when there's exactly one child — previously this stayed
  // unset even with a single child (the selector only ever appeared for
  // 2+), so the conversation silently ran with no child context at all
  // for the single-child case, the most common one.
  const [childId, setChildId] = useState(
    childrenList.length === 1 ? childrenList[0].id : "",
  );
  const [messages, setMessages] = useState<ConversationTurn[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  function sendMessage() {
    const text = draft.trim();
    if (!text || isPending) return;

    setError(null);
    setDraft("");
    const nextHistory: ConversationTurn[] = [...messages, { role: "user", content: text }];
    setMessages(nextHistory);

    startTransition(async () => {
      try {
        const { reply, activity } = await onSend({ childId: childId || null, history: nextHistory });
        setMessages((current) => [...current, { role: "assistant", content: reply, activity }]);
      } catch {
        setError("Não foi possível enviar. Tente de novo.");
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
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

      <div className="min-h-[400px] flex-1 space-y-3 rounded-sm border border-neutral bg-[#e5ddd5] p-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-ink-muted">
            Escreva uma mensagem abaixo para começar.
          </p>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex flex-col gap-2 ${message.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-md px-3 py-2 text-sm shadow-sm ${
                  message.role === "user" ? "bg-[#dcf8c6] text-ink" : "bg-white text-ink"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
              {message.activity && (
                <div className="w-full max-w-[80%] space-y-1">
                  <p className="text-xs font-medium text-ink-muted">Uma ideia para agora</p>
                  <ActivityCard activity={message.activity} />
                </div>
              )}
            </div>
          ))
        )}
        {isPending && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-md bg-white px-3 py-2 text-sm text-ink-muted shadow-sm">
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
