export function ageLabel(birthDate: string | null): string | null {
  if (!birthDate) return null;

  const birth = new Date(birthDate);
  const now = new Date();
  const totalMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth()) -
    (now.getDate() < birth.getDate() ? 1 : 0);

  if (totalMonths < 0) return null;
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
