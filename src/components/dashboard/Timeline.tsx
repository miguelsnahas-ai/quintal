import { CalendarClock } from "lucide-react";
import { describeEntry, getTimelineDetailLines } from "@/lib/timeline";
import type { DashboardEvent } from "@/lib/dashboard";

// Mesma formatação da Timeline central (Fase 13, src/lib/timeline.ts) —
// "Café da manhã"/"Almoço" em vez do genérico "Refeição", detalhes reais
// ("Banana + pão", "43 min") em vez de só repetir `notes` — para que o
// resumo compacto do Dashboard e a timeline completa nunca descrevam o
// mesmo evento de dois jeitos diferentes.
export default function Timeline({ events }: { events: DashboardEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]">
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
        const { verb } = describeEntry(event);
        const detailLines = getTimelineDetailLines(event);
        return (
          <li
            key={event.id}
            className="flex gap-3 rounded-lg bg-primary p-3 text-sm shadow-[var(--shadow-card)]"
          >
            <span className="shrink-0 pt-0.5 font-mono text-xs text-ink-muted">
              {new Date(event.occurredAt).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <p className="text-ink">
              <span className="font-medium">{verb}</span>
              {detailLines.length > 0 ? ` — ${detailLines.join(" · ")}` : ""}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
