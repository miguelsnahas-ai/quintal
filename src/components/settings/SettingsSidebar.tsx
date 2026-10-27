"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { User, Users, Baby, UserCog } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type SidebarChild = { id: string; name: string };

type SectionConfig = {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  tabs: { value: string; label: string }[];
};

const SECTIONS: SectionConfig[] = [
  {
    key: "conta",
    label: "Minha conta",
    icon: User,
    href: "/quintal/configuracoes/conta",
    tabs: [
      { value: "perfil", label: "Perfil" },
      { value: "preferencias", label: "Preferências pessoais" },
      { value: "notificacoes", label: "Notificações" },
    ],
  },
  {
    key: "familia",
    label: "Minha família",
    icon: Users,
    href: "/quintal/configuracoes/familia",
    tabs: [
      { value: "perfil", label: "Perfil da família" },
      { value: "preferencias", label: "Preferências da família" },
    ],
  },
  {
    key: "cuidadores",
    label: "Cuidadores",
    icon: UserCog,
    href: "/quintal/configuracoes/cuidadores",
    tabs: [
      { value: "ativos", label: "Ativos" },
      { value: "convites", label: "Convites pendentes" },
      { value: "permissoes", label: "Permissões" },
      { value: "convidar", label: "Convidar cuidador" },
    ],
  },
];

// Sidebar persistente de Configurações (desktop only — hidden abaixo de
// lg, ver o layout). Client component pelo mesmo motivo de BottomNav.tsx
// e ChildSwitcher.tsx: precisa saber a rota/aba atual para destacar onde
// o cuidador está. "Crianças" é tratada à parte das outras 3 seções (não
// tem abas fixas — tem uma lista de verdade, recebida como prop) porque
// sua navegação é dinâmica por natureza, não um conjunto fixo de
// sub-páginas.
export default function SettingsSidebar({ childrenList }: { childrenList: SidebarChild[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("aba");

  function isSectionActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="hidden w-64 shrink-0 space-y-5 lg:block" aria-label="Configurações">
      {SECTIONS.map((section) => {
        const sectionActive = isSectionActive(section.href);
        const Icon = section.icon;
        return (
          <div key={section.key}>
            <Link
              href={section.href}
              className={`flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-semibold transition-colors ${
                sectionActive ? "text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {section.label}
            </Link>
            <ul className="mt-1 space-y-0.5 border-l border-neutral pl-4">
              {section.tabs.map((tab, index) => {
                const tabActive = sectionActive && (activeTab ? activeTab === tab.value : index === 0);
                return (
                  <li key={tab.value}>
                    <Link
                      href={`${section.href}?aba=${tab.value}`}
                      className={`block rounded-sm px-2 py-1 text-sm transition-colors ${
                        tabActive ? "font-medium text-ink" : "text-ink-muted hover:text-ink"
                      }`}
                    >
                      {tab.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      <div>
        <Link
          href="/quintal/configuracoes/criancas"
          className={`flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-semibold transition-colors ${
            isSectionActive("/quintal/configuracoes/criancas") ? "text-ink" : "text-ink-muted hover:text-ink"
          }`}
        >
          <Baby className="h-4 w-4" aria-hidden />
          Crianças
        </Link>
        <ul className="mt-1 space-y-0.5 border-l border-neutral pl-4">
          {childrenList.map((child) => (
            <li key={child.id}>
              <Link
                href={`/quintal/configuracoes/criancas/${child.id}`}
                className={`block rounded-sm px-2 py-1 text-sm transition-colors ${
                  pathname === `/quintal/configuracoes/criancas/${child.id}` ? "font-medium text-ink" : "text-ink-muted hover:text-ink"
                }`}
              >
                {child.name}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/quintal/configuracoes/criancas"
              className="block rounded-sm px-2 py-1 text-sm text-ink-muted hover:text-ink"
            >
              + Adicionar criança
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
