import Link from "next/link";

export type SettingsTab = { value: string; label: string };

// Abas de uma seção de Configurações via query param (?aba=) — zero JS
// de cliente, mesmo padrão de link+GET já usado em toda a área de
// família (FilterChip da Timeline, os filtros de Brincadeiras/Materiais):
// cada aba é uma URL de verdade, navegável/compartilhável, sem estado de
// cliente escondido. `basePath` é a própria página (ex.:
// "/quintal/configuracoes/conta"); `active` vem de searchParams.aba na
// própria página, com o primeiro valor de `tabs` como padrão.
export default function SettingsTabs({
  basePath,
  tabs,
  active,
}: {
  basePath: string;
  tabs: SettingsTab[];
  active: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <Link
            key={tab.value}
            href={`${basePath}?aba=${tab.value}`}
            role="tab"
            aria-selected={isActive}
            className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
              isActive ? "bg-accent text-ink" : "border-[1.5px] border-neutral text-ink-muted hover:bg-neutral/40"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
