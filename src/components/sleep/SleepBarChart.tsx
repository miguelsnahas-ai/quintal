import type { DaySleepTotals } from "@/lib/sleepInsights";

const CHART_HEIGHT = 120;

export function shortDayLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").slice(0, 3);
}

export function shortDateLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// Barras simples (CSS puro, sem biblioteca de gráfico) — cada dia, sono
// noturno embaixo + sonecas em cima, empilhados. "Gráfico simples",
// pedido explícito: sem eixo numérico, sem grade, sem tooltip — só a
// forma geral e os rótulos de dia. `labelFor` troca o rótulo por data
// (ex.: visão mensal agrupada por semana) em vez de dia da semana.
export function SleepBarChart({ data, labelFor = shortDayLabel }: { data: DaySleepTotals[]; labelFor?: (dateKey: string) => string }) {
  const maxTotal = Math.max(1, ...data.map((day) => day.napMinutes + day.nightMinutes));

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-1.5" style={{ height: CHART_HEIGHT }}>
        {data.map((day) => {
          const nightHeight = (day.nightMinutes / maxTotal) * CHART_HEIGHT;
          const napHeight = (day.napMinutes / maxTotal) * CHART_HEIGHT;
          return (
            <div key={day.date} className="flex flex-1 flex-col items-center justify-end gap-0.5">
              <div className="flex w-full max-w-[22px] flex-col-reverse overflow-hidden rounded-sm">
                <div className="w-full bg-tertiary" style={{ height: Math.max(nightHeight, day.nightMinutes > 0 ? 2 : 0) }} />
                <div className="w-full bg-accent" style={{ height: Math.max(napHeight, day.napMinutes > 0 ? 2 : 0) }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-1.5">
        {data.map((day) => (
          <span key={day.date} className="flex-1 text-center text-[10px] uppercase text-ink-muted">
            {labelFor(day.date)}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-4 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-tertiary" aria-hidden /> Sono noturno
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden /> Sonecas
        </span>
      </div>
    </div>
  );
}
