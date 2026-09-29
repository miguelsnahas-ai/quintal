"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { activityFeedbackOptions, activityFeedbackLabels, type ActivityFeedback } from "@/lib/validation/play";
import { logActivityOutcomeAction } from "./actions";

// Only rendered by page.tsx when a family session exists (see
// getFamilySessionCaregiverId there) — this component never checks that
// itself, same split of responsibility as ActivityFeedback.tsx (its
// sibling on this page) not knowing about sessions at all.
export default function LogActivityOutcome({ activityId }: { activityId: string }) {
  const [submitted, setSubmitted] = useState<ActivityFeedback | null>(null);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (submitted) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-muted">
        <Check className="h-4 w-4" aria-hidden />
        Registrado — obrigado!
      </p>
    );
  }

  function send(feedback: ActivityFeedback) {
    setError(false);
    startTransition(async () => {
      try {
        await logActivityOutcomeAction(activityId, feedback);
        setSubmitted(feedback);
      } catch {
        setError(true);
      }
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink">Fizeram essa atividade? Como foi?</p>
      <div className="flex flex-wrap gap-2">
        {activityFeedbackOptions.map((option) => (
          <button
            key={option}
            type="button"
            disabled={isPending}
            onClick={() => send(option)}
            className="rounded-full border-[1.5px] border-neutral px-3 py-2 text-sm text-ink transition-colors hover:bg-neutral/40 disabled:opacity-50"
          >
            {activityFeedbackLabels[option]}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">Não foi possível registrar. Tente de novo.</p>}
    </div>
  );
}
