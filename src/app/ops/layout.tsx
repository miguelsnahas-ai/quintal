import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, ClipboardList, LogOut, Settings, Sprout, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { signOut } from "./actions";

// Navegação principal do /ops (refatoração): só as três áreas que
// respondem "quem está usando o Quintal?" e "quem demonstrou interesse?"
// — Inbox, Simulador e Chat de teste saíram daqui (ver
// src/app/ops/inbox/page.tsx; os dois últimos foram removidos de vez).
// Configurações fica à parte, como seção secundária, abaixo de um
// divisor — mesma estrutura pedida no desenho da nova navegação.
const navItems = [
  { href: "/ops/families", label: "Famílias", icon: Users },
  { href: "/ops/waitlist", label: "Lista de interesse", icon: ClipboardList },
  { href: "/ops/library", label: "Biblioteca", icon: BookOpen },
];

const secondaryNavItems = [{ href: "/ops/settings", label: "Configurações", icon: Settings }];

export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Proxy already redirects unauthenticated requests away from /ops; this
  // is the defense-in-depth check Next.js recommends doing again here,
  // since a Proxy matcher change should never be the only thing standing
  // between this layout and an unauthenticated render.
  if (!user) {
    redirect("/login");
  }

  const navLinkClassName =
    "flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm text-ink-muted transition-colors hover:bg-neutral/40 hover:text-ink";

  return (
    <div className="flex min-h-[100dvh] flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral bg-primary px-6 py-3">
        <Link href="/ops" className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <Sprout className="h-5 w-5 text-tertiary" aria-hidden />
          Quintal Ops
        </Link>
        {/* Abaixo de lg, a navegação fica aqui (linha horizontal, sem
            sidebar) — "responsividade básica" pedida nesta fase; o uso
            principal continua sendo desktop, onde a sidebar assume. */}
        <nav className="flex flex-wrap items-center gap-1 lg:hidden">
          {[...navItems, ...secondaryNavItems].map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={navLinkClassName}>
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm text-ink-muted">
          <span className="hidden sm:inline">{user.email}</span>
          <form action={signOut}>
            <Button type="submit" variant="ghost" className="px-2 py-1">
              <LogOut className="h-4 w-4" aria-hidden />
              Sair
            </Button>
          </form>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-6 py-8">
        <nav className="hidden w-52 shrink-0 flex-col gap-1 lg:flex" aria-label="Quintal Ops">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={navLinkClassName}>
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          ))}
          <hr className="my-3 border-neutral" />
          {secondaryNavItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={navLinkClassName}>
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
