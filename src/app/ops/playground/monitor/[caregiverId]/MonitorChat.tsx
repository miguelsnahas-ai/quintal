"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { cardClassName } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label, Textarea, FieldError } from "@/components/ui/Field";
import { getConversation, updatePromptInstructions, type MonitorMessage } from "./actions";

const POLL_INTERVAL_MS = 4000;

export default function MonitorChat({
  caregiverId,
  initialMessages,
  initialCustomInstructions,
}: {
  caregiverId: string;
  initialMessages: MonitorMessage[];
  initialCustomInstructions: string;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [customInstructions, setCustomInstructions] = useState(initialCustomInstructions);
  const [savedInstructions, setSavedInstructions] = useState(initialCustomInstructions);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const [isSaving, startSaveTransition] = useTransition();
  const lastMessageId = useRef<string | null>(
    initialMessages[initialMessages.length - 1]?.id ?? null,
  );

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const fresh = await getConversation(caregiverId);
        const freshLastId = fresh[fresh.length - 1]?.id ?? null;
        if (freshLastId !== lastMessageId.current || fresh.length !== messages.length) {
          lastMessageId.current = freshLastId;
          setMessages(fresh);
        }
      } catch {
        // Silent — a transient failure just means the view waits for the
        // next poll instead of showing an error for a background refresh.
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [caregiverId, messages.length]);

  function saveInstructions() {
    setSaveError(null);
    setSaveStatus("idle");
    startSaveTransition(async () => {
      try {
        await updatePromptInstructions(customInstructions);
        setSavedInstructions(customInstructions);
        setSaveStatus("saved");
      } catch {
        setSaveError("Não foi possível salvar as instruções. Tente de novo.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="min-h-[300px] space-y-3 rounded-sm border border-neutral bg-[#e5ddd5] p-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-ink-muted">
            Nenhuma mensagem ainda. Assim que a pessoa começar a conversar
            pelo link de teste, as mensagens aparecem aqui.
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.direction === "inbound" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-md px-3 py-2 text-sm shadow-sm ${
                  message.direction === "inbound" ? "bg-[#dcf8c6] text-ink" : "bg-white text-ink"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.body}</p>
                <p className="mt-1 text-[10px] text-ink-muted">
                  {new Date(message.created_at).toLocaleTimeString("pt-BR")}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className={cardClassName("space-y-3 p-4")}>
        <div className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <Sparkles className="h-4 w-4 text-tertiary" aria-hidden />
          Instruções extras para a IA
        </div>
        <p className="text-xs text-ink-muted">
          Vale para todas as conversas do Quintal (não só esta), e some no
          próximo texto que a IA gerar — não reescreve o que já foi
          respondido. Use para ajustar tom, prioridades ou coisas a evitar.
        </p>
        <Label htmlFor="custom-instructions">Instruções</Label>
        <Textarea
          id="custom-instructions"
          rows={4}
          value={customInstructions}
          onChange={(event) => {
            setCustomInstructions(event.target.value);
            setSaveStatus("idle");
          }}
          placeholder="Ex.: seja mais breve; sempre pergunte a idade se não estiver clara; evite sugerir apps de terceiros..."
        />
        <FieldError>{saveError}</FieldError>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={saveInstructions}
            disabled={isSaving || customInstructions === savedInstructions}
          >
            {isSaving ? "Salvando..." : "Salvar instruções"}
          </Button>
          {saveStatus === "saved" && (
            <span className="text-sm text-ink-muted">Salvo.</span>
          )}
        </div>
      </div>
    </div>
  );
}
