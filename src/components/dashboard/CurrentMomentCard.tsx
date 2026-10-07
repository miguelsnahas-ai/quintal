import { Sparkle } from "lucide-react";
import { inviteCardClassName } from "@/components/ui/Card";
import type { CurrentMoment } from "@/lib/routineEngine";

// "Momento atual" — a única frase sobre o agora (Home, refatoração desta
// fase): "Soneca terminou há 20 min", "Acordou há 40 min" ou "Hora
// provável: almoço". Não aparece quando describeCurrentMoment não tem
// nada relevante pra dizer — nunca um texto genérico de preenchimento.
export default function CurrentMomentCard({ moment }: { moment: CurrentMoment | null }) {
  if (!moment) return null;

  return (
    <div className={inviteCardClassName("flex items-start gap-3 p-4")}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent">
        <Sparkle className="h-4 w-4 text-ink" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-ink">{moment.text}</p>
        {moment.detail && <p className="text-xs text-ink-muted">{moment.detail}</p>}
      </div>
    </div>
  );
}
