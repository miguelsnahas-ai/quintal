// O cabeçalho global (ChildSwitcher, no AppShell) já identifica a
// criança ativa acima de toda página — este título não repete
// nome/idade nem duplica o acesso ao chat (agora uma aba própria na
// navegação principal). Sobra só a saudação do dia.
export default function DashboardHeader({ dateLabel }: { dateLabel: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-lg font-bold text-ink">Hoje</h1>
      <p className="text-sm text-ink-muted">{dateLabel}</p>
    </div>
  );
}
