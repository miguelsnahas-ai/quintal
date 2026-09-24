"use client";

import { useState, useTransition } from "react";
import { Check, ThumbsDown, ThumbsUp } from "lucide-react";
import { submitActivityFeedback } from "./actions";

export default function ActivityFeedback({ activityId }: { activityId: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (submitted) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-muted">
        <Check className="h-4 w-4" aria-hidden />
        Obrigado pelo retorno!
      </p>
    );
  }

  function send(helpful: boolean) {
    setError(false);
    startTransition(async () => {
      try {
        await submitActivityFeedback(activityId, helpful);
        setSubmitted(true);
      } catch {
        setError(true);
      }
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink">Essa atividade ajudou?</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => send(true)}
          className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-neutral px-4 py-2 text-sm text-ink transition-colors hover:bg-neutral/40 disabled:opacity-50"
        >
          <ThumbsUp className="h-4 w-4" aria-hidden />
          Ajudou
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => send(false)}
          className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-neutral px-4 py-2 text-sm text-ink transition-colors hover:bg-neutral/40 disabled:opacity-50"
        >
          <ThumbsDown className="h-4 w-4" aria-hidden />
          Não ajudou
        </button>
      </div>
      {error && <p className="text-xs text-red-600">Não foi possível registrar. Tente de novo.</p>}
    </div>
  );
}
