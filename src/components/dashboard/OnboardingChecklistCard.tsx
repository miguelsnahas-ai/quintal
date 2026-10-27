"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { X, Check } from "lucide-react";
import { cardClassName } from "@/components/ui/Card";
import type { OnboardingChecklistKey } from "@/lib/onboardingProgress";
import { dismissOnboardingChecklistAction } from "@/app/quintal/actions";

// "Primeiros passos" — checklist persistente na Home (pedido explícito,
// combinado com o tour de 1 vez só — ver GuidedTourOverlay), visível
// enquanto nem tudo foi feito e o cuidador não dispensou. Cada item é
// honesto sobre o que falta: vem de dado real (ver
// src/lib/onboardingProgress.ts), nunca um progresso inventado — "feito"
// aqui significa que aquilo de fato aconteceu.
const CHECKLIST: { key: OnboardingChecklistKey; label: string; href: string }[] = [
  { key: "registrar", label: "Registre o primeiro momento", href: "/quintal/registrar" },
  { key: "chat", label: "Converse com o Quintal no chat", href: "/quintal/chat" },
  { key: "timeline", label: "Veja a timeline", href: "/quintal/timeline" },
  { key: "convidar", label: "Convide outro cuidador", href: "/quintal/configuracoes/cuidadores" },
];

export function OnboardingChecklistCard({ items }: { items: Record<OnboardingChecklistKey, boolean> }) {
  const [hidden, setHidden] = useState(false);
  const [, startTransition] = useTransition();

  if (hidden) return null;

  function dismiss() {
    setHidden(true);
    startTransition(async () => {
      try {
        await dismissOnboardingChecklistAction();
      } catch {
        // Falha silenciosa — pior caso, o card reaparece na próxima visita.
      }
    });
  }

  const doneCount = Object.values(items).filter(Boolean).length;

  return (
    <section className={cardClassName("space-y-3 p-4")}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">
          Primeiros passos ({doneCount}/{CHECKLIST.length})
        </h2>
        <button type="button" onClick={dismiss} className="text-ink-muted hover:text-ink" aria-label="Dispensar primeiros passos">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <ul className="space-y-2">
        {CHECKLIST.map(({ key, label, href }) => {
          const done = items[key];
          return (
            <li key={key}>
              {done ? (
                <span className="flex items-center gap-2 text-sm text-ink-muted">
                  <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                  <span className="line-through">{label}</span>
                </span>
              ) : (
                <Link href={href} className="flex items-center gap-2 text-sm text-ink hover:underline">
                  <span className="h-4 w-4 shrink-0 rounded-full border-[1.5px] border-neutral" aria-hidden />
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
