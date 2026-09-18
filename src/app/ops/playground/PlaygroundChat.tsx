"use client";

import { useState, useTransition } from "react";
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
      <div className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 bg-white p-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-neutral-700">
            Nome da criança (opcional)
          </label>
          <input
            value={childName}
            onChange={(event) => setChildName(event.target.value)}
            placeholder="Ex: Laura"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-neutral-700">
            Idade (opcional)
          </label>
          <input
            value={childAge}
            onChange={(event) => setChildAge(event.target.value)}
            placeholder="Ex: 8 meses"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="min-h-[300px] space-y-3 rounded-md border border-neutral-200 bg-[#e5ddd5] p-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-neutral-500">
            Escreva uma mensagem abaixo como se fosse um pai ou mãe no WhatsApp.
          </p>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                  message.role === "user"
                    ? "bg-[#dcf8c6] text-neutral-900"
                    : "bg-white text-neutral-900"
                }`}
              >
                {message.role === "assistant" && message.eventTypeLabel && (
                  <span className="mb-1 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                    {message.eventTypeLabel}
                  </span>
                )}
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))
        )}
        {isPending && (
          <div className="flex justify-start">
            <div className="max-w-[75%] rounded-lg bg-white px-3 py-2 text-sm text-neutral-400 shadow-sm">
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
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Digite uma mensagem..."
          className="flex-1 rounded-full border border-neutral-300 px-4 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
        />
        <button
          type="submit"
          disabled={isPending || !draft.trim()}
          className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
