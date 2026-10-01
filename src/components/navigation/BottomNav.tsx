"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, CalendarClock, Menu } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import RegisterSheet from "./RegisterSheet";

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };

// Navegação principal (nova arquitetura): Hoje, Chat, Registrar (ação
// central, sem rota própria — ver RegisterSheet), Timeline, Mais. Os
// pilares de uso menos diário (Sono, Brincar, Comer) e o resto
// (Integrações, Família, Configurações) ficam dentro de "Mais" — cinco
// itens na barra, não uma lista de funcionalidades.
const LEFT_ITEMS: NavItem[] = [
  { href: "/quintal", label: "Hoje", icon: Home, exact: true },
  { href: "/quintal/chat", label: "Chat", icon: MessageCircle },
];

const RIGHT_ITEMS: NavItem[] = [
  { href: "/quintal/timeline", label: "Timeline", icon: CalendarClock },
  { href: "/quintal/mais", label: "Mais", icon: Menu },
];

function NavLink({ href, label, icon: Icon, exact, pathname }: NavItem & { pathname: string }) {
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
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
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-neutral bg-primary pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegação principal"
    >
      <div className="mx-auto flex max-w-lg items-center justify-around px-1 py-1.5 sm:max-w-2xl lg:max-w-3xl">
        {LEFT_ITEMS.map((item) => (
          <NavLink key={item.href} {...item} pathname={pathname} />
        ))}
        <RegisterSheet />
        {RIGHT_ITEMS.map((item) => (
          <NavLink key={item.href} {...item} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
}
