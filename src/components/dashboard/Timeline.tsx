import { CalendarClock } from "lucide-react";
import { describeEntry, getTimelineDetailLines } from "@/lib/timeline";
import { inviteCardClassName } from "@/components/ui/Card";
import { TimelineEventIcon } from "@/components/dashboard/TimelineEventIcon";
import type { DashboardEvent } from "@/lib/dashboard";

// Mesma formatação da Timeline central (Fase 13, src/lib/timeline.ts) —
// "Café da manhã"/"Almoço" em vez do genérico "Refeição", detalhes reais
// ("Banana + pão", "43 min") em vez de só repetir `notes` — para que o
// resumo compacto do Dashboard e a timeline completa nunca descrevam o
// mesmo evento de dois jeitos diferentes. Sem borda (refatoração da
// Home): mesmo critério "leve" de SummaryCard.
export default function Timeline({ events }: { events: DashboardEvent[] }) {
  if (events.length === 0) {
    return (
      <div className={inviteCardClassName("flex items-start gap-3 p-4")}>
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" aria-hidden />
        <p className="text-sm text-ink-muted">
          Nenhum evento registrado hoje ainda. Comece uma conversa com o Quintal para registrar o
          que acontecer.
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-2">
      {events.map((event) => {
        const { verb, icon } = describeEntry(event);
        const detailLines = getTimelineDetailLines(event);
        return (
          <li key={event.id} className={inviteCardClassName("flex items-center gap-3 p-3 text-sm")}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent">
              <TimelineEventIcon type={icon} className="h-4 w-4 text-ink" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-medium text-ink">{verb}</p>
                <span className="shrink-0 font-mono text-xs text-ink-muted">
                  {new Date(event.occurredAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {detailLines.length > 0 && <p className="text-xs text-ink-muted">{detailLines.join(" · ")}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
