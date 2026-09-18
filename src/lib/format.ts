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
