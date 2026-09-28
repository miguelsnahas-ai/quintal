export function ageInMonths(birthDate: string | null): number | null {
  if (!birthDate) return null;

  const birth = new Date(birthDate);
  const now = new Date();
  const totalMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth()) -
    (now.getDate() < birth.getDate() ? 1 : 0);

  return totalMonths < 0 ? null : totalMonths;
}

export function ageLabel(birthDate: string | null): string | null {
  const totalMonths = ageInMonths(birthDate);
  if (totalMonths === null) return null;
  if (totalMonths < 24) return `${totalMonths} ${totalMonths === 1 ? "mês" : "meses"}`;

  const years = Math.floor(totalMonths / 12);
  return `${years} anos`;
}

// Value for an <input type="datetime-local">, in the server's local time
// zone. Good enough for an MVP where the operator can just eyeball and
// adjust the field — proper per-family time zone handling can wait until
// there's evidence it's needed.
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

// Midnight in the server's local time zone — same pragmatic MVP
// assumption as toDatetimeLocalValue above. Shared by dashboard.ts
// ("hoje" summary, Fase 7) and sleep.ts ("Sono de hoje", Fase 10) so
// "hoje" means exactly the same instant in both places.
export function startOfToday(): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

// "Hoje" / "Ontem" / "23 de setembro" — used to group a history list by
// day (meal history since Fase 9, sleep history since Fase 10, and
// presumably more modules to come per the roadmap).
export function dayLabel(dateStr: string): string {
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (target.getTime() === today.getTime()) return "Hoje";
  if (target.getTime() === yesterday.getTime()) return "Ontem";

  const label = target.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Groups a most-recent-first list into consecutive same-day buckets,
// using dayLabel above. `getDate` picks the field to group by (a
// history entry's occurredAt/startedAt), so this stays reusable across
// different entry shapes instead of assuming one.
export function groupByDay<T>(entries: T[], getDate: (entry: T) => string): { label: string; entries: T[] }[] {
  const groups: { label: string; entries: T[] }[] = [];
  for (const entry of entries) {
    const label = dayLabel(getDate(entry));
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.label === label) {
      lastGroup.entries.push(entry);
    } else {
      groups.push({ label, entries: [entry] });
    }
  }
  return groups;
}

// "1h35" / "1h" / "45min" — the compact format the product brief itself
// uses for sleep summaries (Fase 10). Kept generic (not sleep-specific)
// in case another duration ever needs the same display.
export function formatDurationMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${String(minutes).padStart(2, "0")}`;
}
