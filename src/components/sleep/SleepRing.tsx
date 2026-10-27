import { formatDurationMinutes } from "@/lib/format";

const SIZE = 160;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Anel simples de duas cores — sono noturno (sage, "calmo" no design
// system) e sonecas (âmbar) — nunca um gráfico técnico (eixos, legendas
// densas): só a proporção e o total no centro. Sem nenhum dado, mostra
// o anel vazio (cinza) em vez de inventar um valor.
export function SleepRing({
  napMinutes,
  nightMinutes,
  label,
}: {
  napMinutes: number;
  nightMinutes: number;
  label: string;
}) {
  const total = napMinutes + nightMinutes;
  const nightFraction = total > 0 ? nightMinutes / total : 0;
  const nightLength = CIRCUMFERENCE * nightFraction;
  const napLength = CIRCUMFERENCE - nightLength;

  return (
    <div className="relative flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--color-neutral)" strokeWidth={STROKE} />
        {total > 0 && (
          <>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--color-tertiary)"
              strokeWidth={STROKE}
              strokeDasharray={`${nightLength} ${CIRCUMFERENCE - nightLength}`}
              strokeLinecap="round"
            />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={STROKE}
              strokeDasharray={`${napLength} ${CIRCUMFERENCE - napLength}`}
              strokeDashoffset={-nightLength}
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-ink">{total > 0 ? formatDurationMinutes(total) : "—"}</span>
        <span className="text-xs text-ink-muted">{label}</span>
      </div>
    </div>
  );
}
