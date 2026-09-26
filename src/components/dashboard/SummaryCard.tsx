import type { LucideIcon } from "lucide-react";

// One compact tile in the dashboard's "resumo do dia" grid. Deliberately
// dumb/presentational — it never decides what counts as data vs. empty,
// the page passes `value: null` when there's nothing real to show yet
// (see src/lib/dashboard.ts). Same warm family-tier surface as
// ActivityCard (rounded-lg, no border) rather than the operator tool's
// denser `cardClassName` (rounded-sm, bordered).
export default function SummaryCard({
  icon: Icon,
  label,
  value,
  empty,
}: {
  icon: LucideIcon;
  label: string;
  value: string | null;
  empty: string;
}) {
  return (
    <div className="space-y-2 rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-1.5 text-ink-muted">
        <Icon className="h-4 w-4" aria-hidden />
        <span className="text-xs font-medium">{label}</span>
      </div>
      {value ? (
        <p className="text-sm font-semibold leading-snug text-ink">{value}</p>
      ) : (
        <p className="text-sm leading-snug text-ink-muted">{empty}</p>
      )}
    </div>
  );
}
