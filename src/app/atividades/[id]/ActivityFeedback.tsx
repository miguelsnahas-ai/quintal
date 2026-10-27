"use client";

import { useState, useTransition } from "react";
import { Check, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
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
        <Button type="button" variant="secondary" disabled={isPending} onClick={() => send(true)}>
          <ThumbsUp className="h-4 w-4" aria-hidden />
          Ajudou
        </Button>
        <Button type="button" variant="secondary" disabled={isPending} onClick={() => send(false)}>
          <ThumbsDown className="h-4 w-4" aria-hidden />
          Não ajudou
        </Button>
      </div>
      {error && <p className="text-xs text-danger">Não foi possível registrar. Tente de novo.</p>}
    </div>
  );
}
