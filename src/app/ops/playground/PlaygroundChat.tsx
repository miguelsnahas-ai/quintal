"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Send, MessageSquareText } from "lucide-react";
import { cardClassName } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input, Label, Select, FieldError } from "@/components/ui/Field";
import { sendPlaygroundMessage, type PlaygroundTurn } from "./actions";

type Caregiver = {
  id: string;
  name: string;
  phone_number: string;
  family_id: string;
  families: { name: string } | null;
};

type Child = {
  id: string;
  name: string;
  family_id: string;
};

export default function PlaygroundChat({
  caregivers,
  childrenList,
}: {
  caregivers: Caregiver[];
  childrenList: Child[];
}) {
  const [caregiverId, setCaregiverId] = useState("");
  const [childId, setChildId] = useState("");
  const [messages, setMessages] = useState<PlaygroundTurn[]>([]);
  const [lastInboundMessageId, setLastInboundMessageId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedCaregiver = caregivers.find((c) => c.id === caregiverId) ?? null;
  const availableChildren = useMemo(
    () => childrenList.filter((child) => child.family_id === selectedCaregiver?.family_id),
    [childrenList, selectedCaregiver],
  );

  function sendMessage() {
    const text = draft.trim();
    if (!text || isPending || !caregiverId) return;

    setError(null);
    setDraft("");
    const nextHistory: PlaygroundTurn[] = [...messages, { role: "user", content: text }];
    setMessages(nextHistory);

    startTransition(async () => {
      try {
        const { eventTypeLabel, reply, inboundMessageId } = await sendPlaygroundMessage({
          caregiverId,
          childId: childId || null,
          history: nextHistory,
        });
        setLastInboundMessageId(inboundMessageId);
        setMessages((current) => [
          ...current,
          { role: "assistant", content: reply, eventTypeLabel: eventTypeLabel ?? undefined },
        ]);
      } catch {
        setError("Não foi possível gerar/registrar a resposta. Tente de novo.");
      }
    });
  }

  if (caregivers.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Nenhum cuidador cadastrado ainda. Cadastre uma família e um cuidador
        em /ops/families antes de usar o chat de teste.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className={cardClassName("grid grid-cols-1 gap-3 p-4 sm:grid-cols-2")}>
        <div className="space-y-1">
          <Label>Cuidador (define a família)</Label>
          <Select
            value={caregiverId}
            onChange={(event) => {
              setCaregiverId(event.target.value);
              setChildId("");
              setMessages([]);
              setLastInboundMessageId(null);
            }}
          >
            <option value="">Selecione um cuidador...</option>
            {caregivers.map((caregiver) => (
              <option key={caregiver.id} value={caregiver.id}>
                {caregiver.name} ({caregiver.families?.name ?? "sem família"}) —{" "}
                {caregiver.phone_number}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Criança (opcional, dá contexto real à IA)</Label>
          <Select
            value={childId}
            onChange={(event) => setChildId(event.target.value)}
            disabled={!selectedCaregiver}
          >
            <option value="">Nenhuma criança específica</option>
            {availableChildren.map((child) => (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {selectedCaregiver && (
        <p className="flex items-center gap-1.5 text-xs text-decorative">
          <MessageSquareText className="h-3.5 w-3.5" aria-hidden />
          Cada mensagem enviada aqui é gravada de verdade no histórico de{" "}
          {selectedCaregiver.families?.name ?? "esta família"} — não é um teste descartável.
        </p>
      )}

      <FieldError>{error}</FieldError>

      <div className="min-h-[300px] space-y-3 rounded-sm border border-neutral p-4 bg-[#e5ddd5]">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-ink-muted">
            {selectedCaregiver
              ? "Escreva uma mensagem abaixo como se fosse o cuidador selecionado."
              : "Selecione um cuidador para começar."}
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

      {lastInboundMessageId && (
        <Link
          href={`/ops/inbox/${lastInboundMessageId}`}
          className="text-xs text-ink-muted underline hover:text-ink"
        >
          Ver esta conversa na triagem (para registrar um evento, por exemplo)
        </Link>
      )}

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
          placeholder={
            selectedCaregiver ? "Digite uma mensagem..." : "Selecione um cuidador primeiro"
          }
          disabled={!caregiverId}
          className="flex-1 rounded-full"
        />
        <button
          type="submit"
          disabled={isPending || !draft.trim() || !caregiverId}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink transition-all duration-200 hover:brightness-95 disabled:opacity-50"
        >
          <Send className="h-4 w-4" aria-hidden />
          Enviar
        </button>
      </form>
    </div>
  );
}
