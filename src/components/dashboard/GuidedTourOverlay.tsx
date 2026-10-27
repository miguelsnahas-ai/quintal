"use client";

import { useState, useTransition } from "react";
import { X, MessageCircle, NotebookPen, CalendarClock, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CrayonMark } from "@/components/marks/CrayonMark";
import { completeOnboardingTourAction } from "@/app/quintal/actions";

// Tour guiado de 1 vez só (pedido explícito, combinado com o checklist
// "Primeiros passos" — ver OnboardingChecklistCard), mostrado na Home
// enquanto family_onboarding_progress.tour_completed_at ainda é null
// (ver src/lib/onboardingProgress.ts e QuintalDashboardPage). Deliberadamente
// um carrossel de cards centrados, não um "spotlight" recortando elementos
// reais da tela: mais simples de manter, mais previsível no mobile, e
// mantém o tom calmo do produto (critério explícito desta refatoração,
// mesmo já usado em /comecar via OnboardingScreen).
type Step = { icon: React.ReactNode; title: string; description: string };

const STEPS: Step[] = [
  {
    icon: <CrayonMark mark="heart" scale={0.55} />,
    title: "Bem-vindo ao Quintal",
    description:
      "Um jeito calmo de acompanhar a rotina — sem métricas, sem pressa. Em poucos passos, mostramos o que você pode fazer por aqui.",
  },
  {
    icon: <NotebookPen className="h-7 w-7 text-ink" aria-hidden />,
    title: "Registre um momento",
    description: "Sono, alimentação, brincadeiras, higiene — toque em \"Registrar\" sempre que quiser guardar algo do dia.",
  },
  {
    icon: <MessageCircle className="h-7 w-7 text-ink" aria-hidden />,
    title: "Converse com o Quintal",
    description: "Conte como está o dia em texto livre, no chat — ele entende e já sugere o registro certo pra você confirmar.",
  },
  {
    icon: <CalendarClock className="h-7 w-7 text-ink" aria-hidden />,
    title: "Acompanhe a timeline",
    description: "Tudo o que já foi registrado aparece ali, organizado por dia — fácil de olhar pra trás quando precisar.",
  },
  {
    icon: <UserPlus className="h-7 w-7 text-ink" aria-hidden />,
    title: "Convide outro cuidador",
    description: "O Quintal fica mais útil quando toda a família usa junto — convide quem também cuida, em Configurações > Cuidadores.",
  },
];

export function GuidedTourOverlay() {
  const [visible, setVisible] = useState(true);
  const [step, setStep] = useState(0);
  const [, startTransition] = useTransition();

  function finish() {
    setVisible(false);
    startTransition(async () => {
      try {
        await completeOnboardingTourAction();
      } catch {
        // Falha silenciosa — o pior caso é o tour aparecer de novo na
        // próxima visita, nunca travar a Home por causa disso.
      }
    });
  }

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-label={current.title}
    >
      <div className="w-full max-w-sm space-y-5 rounded-2xl bg-primary p-6 shadow-[var(--shadow-lift)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/30">{current.icon}</div>
          <button type="button" onClick={finish} className="text-ink-muted hover:text-ink" aria-label="Pular o tour">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-ink">{current.title}</h2>
          <p className="text-sm text-ink-muted">{current.description}</p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden>
            {STEPS.map((_, index) => (
              <span key={index} className={`h-1.5 w-1.5 rounded-full ${index === step ? "bg-accent" : "bg-neutral"}`} />
            ))}
          </div>
          <Button type="button" onClick={() => (isLast ? finish() : setStep((s) => s + 1))}>
            {isLast ? "Entendi, vamos lá!" : "Próximo"}
          </Button>
        </div>
      </div>
    </div>
  );
}
