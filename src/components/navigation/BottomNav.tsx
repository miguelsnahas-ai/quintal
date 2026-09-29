"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Moon, Utensils, Blocks, CalendarClock } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// A maior fricção de navegação identificada numa revisão de UX desta
// fase: cada módulo (/quintal/sono, /alimentacao, /brincadeiras,
// /timeline...) só tinha um link "← Quintal" de volta ao Dashboard —
// para ir de um módulo a outro, a família sempre precisava passar pela
// Home primeiro. Esta barra fica fixa no rodapé de toda a experiência
// de família (aplicada via src/app/quintal/layout.tsx) e cobre só os
// destinos de uso diário — Materiais, Perfil e Chat continuam
// alcançáveis em um toque a partir do Dashboard/cabeçalho, sem precisar
// disputar espaço numa barra de 5 itens.
const ITEMS: { href: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/quintal", label: "Início", icon: Home, exact: true },
  { href: "/quintal/sono", label: "Sono", icon: Moon },
  { href: "/quintal/alimentacao", label: "Comer", icon: Utensils },
  { href: "/quintal/brincadeiras", label: "Brincar", icon: Blocks },
  { href: "/quintal/timeline", label: "Timeline", icon: CalendarClock },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-neutral bg-primary pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegação principal"
    >
      <div className="mx-auto flex max-w-lg justify-around px-1 py-1.5 sm:max-w-2xl lg:max-w-3xl">
        {ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className="flex min-w-[56px] flex-1 flex-col items-center gap-0.5 rounded-sm px-1 py-1.5 text-center transition-colors"
            >
              <Icon className={`h-5 w-5 ${isActive ? "text-ink" : "text-ink-muted"}`} aria-hidden />
              <span className={`text-[11px] leading-tight ${isActive ? "font-semibold text-ink" : "text-ink-muted"}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
