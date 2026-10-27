// Saudação contextual da Home — "Bom dia, Marina. Como está o dia da
// Helena?" (refatoração desta fase). O resto da identificação da criança
// (avatar, nome, idade, troca) já vive no cabeçalho global (ChildSwitcher,
// no AppShell) — este título nunca repete isso, só cumprimenta.
export default function DashboardHeader({
  caregiverName,
  childName,
  hour,
}: {
  caregiverName: string | null;
  childName: string;
  hour: number;
}) {
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="mb-6">
      <h1 className="text-lg font-bold text-ink">
        {greeting}
        {caregiverName ? `, ${caregiverName}` : ""}.
      </h1>
      <p className="text-sm text-ink-muted">Como está o dia de {childName}?</p>
    </div>
  );
}
