import { CalendarClock } from "lucide-react";
import { eventTypeLabels } from "@/lib/validation/events";
import type { DashboardEvent } from "@/lib/dashboard";

// A "verb" per type reads closer to the product brief's own example
// ("07:10 — Acordou") than the more clinical eventTypeLabels ("Sono") —
// but only for the four day-to-day types the dashboard's timeline ever
// receives (see ACTIVITY_EVENT_TYPES). Falls back to eventTypeLabels for
// anything else so this never silently drops a real event.
const TIMELINE_VERBS: Partial<Record<string, string>> = {
  sleep: "Soneca",
  routine: "Rotina",
  free_play: "Brincadeira",
  development: "Desenvolvimento",
  meal: "Refeição",
  outing: "Passeio",
};

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
      {events.map((event) => (
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
            <span className="font-medium">{TIMELINE_VERBS[event.type] ?? eventTypeLabels[event.type]}</span>
            {event.notes ? ` — ${event.notes}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}
