"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { cardClassName } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input, Label, FieldError } from "@/components/ui/Field";
import { generatePlaygroundReply, type PlaygroundTurn } from "./actions";

export default function PlaygroundChat() {
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("");
  const [messages, setMessages] = useState<PlaygroundTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function sendMessage() {
    const text = draft.trim();
    if (!text || isPending) return;

    setError(null);
    setDraft("");
    const nextHistory: PlaygroundTurn[] = [...messages, { role: "user", content: text }];
    setMessages(nextHistory);

    startTransition(async () => {
      try {
        const { eventTypeLabel, reply } = await generatePlaygroundReply({
          childName,
          childAge,
          history: nextHistory,
        });
        setMessages((current) => [
          ...current,
          { role: "assistant", content: reply, eventTypeLabel: eventTypeLabel ?? undefined },
        ]);
      } catch {
        setError("Não foi possível gerar a resposta. Tente de novo.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className={cardClassName("grid grid-cols-1 gap-3 p-4 sm:grid-cols-2")}>
        <div className="space-y-1">
          <Label>Nome da criança (opcional)</Label>
          <Input
            value={childName}
            onChange={(event) => setChildName(event.target.value)}
            placeholder="Ex: Laura"
          />
        </div>
        <div className="space-y-1">
          <Label>Idade (opcional)</Label>
          <Input
            value={childAge}
            onChange={(event) => setChildAge(event.target.value)}
            placeholder="Ex: 8 meses"
          />
        </div>
      </div>

      <FieldError>{error}</FieldError>

      {/* Bolhas estilo WhatsApp aqui são intencionais — é o que está sendo
          testado, não a interface do Quintal em si. */}
      <div className="min-h-[300px] space-y-3 rounded-sm border border-neutral p-4 bg-[#e5ddd5]">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-ink-muted">
            Escreva uma mensagem abaixo como se fosse um pai ou mãe no WhatsApp.
          </p>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-md px-3 py-2 text-sm shadow-sm ${
                  message.role === "user" ? "bg-[#dcf8c6] text-ink" : "bg-primary text-ink"
                }`}
              >
                {message.role === "assistant" && message.eventTypeLabel && (
                  <Badge className="mb-1">{message.eventTypeLabel}</Badge>
                )}
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))
        )}
        {isPending && (
          <div className="flex justify-start">
            <div className="max-w-[75%] rounded-md bg-primary px-3 py-2 text-sm text-ink-muted shadow-sm">
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
