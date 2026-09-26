"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import type { RecommendationFeedback as FeedbackValue } from "@/lib/recommendation";

// Deliberately small and discreet — three pill buttons, an optional
// one-line note, no stars/scales/scores. This is the "experiência mínima"
// asked for: enough to close the context → recommendation → feedback loop
// without turning the chat into a review app. Lives directly under the
// ActivityCard for the turn that produced a recommendation (see
// ConversationChat.tsx); once submitted, this replaces itself with a
// quiet acknowledgement rather than staying interactive.
export default function RecommendationFeedback({
  recommendationId,
  onSubmit,
}: {
  recommendationId: string;
  onSubmit: (input: { recommendationId: string; feedback: FeedbackValue; note?: string }) => Promise<void>;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (submitted) {
    return (
      <p className="flex items-center gap-1 text-xs text-ink-muted">
        <Check className="h-3 w-3" aria-hidden />
        Obrigado! Isso ajuda a melhorar as próximas ideias.
      </p>
    );
  }

  function send(feedback: FeedbackValue) {
    setError(false);
    startTransition(async () => {
      try {
        await onSubmit({ recommendationId, feedback, note: note.trim() || undefined });
        setSubmitted(true);
      } catch {
        setError(true);
      }
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={isPending}
          onClick={() => send("worked")}
          className="rounded-full border-[1.5px] border-neutral px-3 py-1 text-xs text-ink transition-colors hover:bg-neutral/40 disabled:opacity-50"
        >
          Funcionou
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => send("did_not_work")}
          className="rounded-full border-[1.5px] border-neutral px-3 py-1 text-xs text-ink transition-colors hover:bg-neutral/40 disabled:opacity-50"
        >
          Não funcionou
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => send("wants_another")}
          className="rounded-full border-[1.5px] border-neutral px-3 py-1 text-xs text-ink transition-colors hover:bg-neutral/40 disabled:opacity-50"
        >
          Quero outra ideia
        </button>
        {!showNote && (
          <button
            type="button"
            onClick={() => setShowNote(true)}
            className="text-xs text-ink-muted underline underline-offset-2"
          >
            + observação
          </button>
        )}
      </div>
      {showNote && (
        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Ex.: ela adorou / ela não quis participar"
          className="w-full max-w-xs rounded-full border-[1.5px] border-neutral bg-primary px-3 py-1 text-xs text-ink placeholder:text-ink-muted/70 focus:outline-none"
        />
      )}
      {error && <p className="text-xs text-red-600">Não foi possível registrar. Tente de novo.</p>}
    </div>
  );
}
