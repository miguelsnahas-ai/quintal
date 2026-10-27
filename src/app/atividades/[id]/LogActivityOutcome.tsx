"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
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
          <Chip key={option} disabled={isPending} onClick={() => send(option)}>
            {activityFeedbackLabels[option]}
          </Chip>
        ))}
      </div>
      {error && <p className="text-xs text-danger">Não foi possível registrar. Tente de novo.</p>}
    </div>
  );
}
