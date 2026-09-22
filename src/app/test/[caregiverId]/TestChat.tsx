"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { Input, Label, Select, FieldError } from "@/components/ui/Field";
import { sendTestMessage, type TestChatTurn } from "./actions";

type Child = {
  id: string;
  name: string;
};

export default function TestChat({
  caregiverId,
  childrenList,
}: {
  caregiverId: string;
  childrenList: Child[];
}) {
  const [childId, setChildId] = useState("");
  const [messages, setMessages] = useState<TestChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function sendMessage() {
    const text = draft.trim();
    if (!text || isPending) return;

    setError(null);
    setDraft("");
    const nextHistory: TestChatTurn[] = [...messages, { role: "user", content: text }];
    setMessages(nextHistory);

    startTransition(async () => {
      try {
        const { reply } = await sendTestMessage({
          caregiverId,
          childId: childId || null,
          history: nextHistory,
        });
        setMessages((current) => [...current, { role: "assistant", content: reply }]);
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
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-md px-3 py-2 text-sm shadow-sm ${
                  message.role === "user" ? "bg-[#dcf8c6] text-ink" : "bg-white text-ink"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
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
