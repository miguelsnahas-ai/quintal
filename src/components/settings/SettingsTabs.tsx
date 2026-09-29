import Link from "next/link";
import { chipClassName } from "@/components/ui/Chip";

export type SettingsTab = { value: string; label: string };

// Abas de uma seção de Configurações via query param (?aba=) — zero JS
// de cliente, mesmo padrão de link+GET já usado em toda a área de
// família (FilterChips da Timeline, os filtros de Brincadeiras/Materiais).
// O visual é o mesmo pill de Chip (mesma classe, chipClassName), mas o
// papel é de aba (role="tab"/"tablist"), não de filtro — daqui não usa o
// componente FilterChips. `basePath` é a própria página (ex.:
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
            className={chipClassName(isActive)}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
