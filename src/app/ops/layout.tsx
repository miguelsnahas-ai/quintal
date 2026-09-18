import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ClipboardList,
  Inbox,
  LogOut,
  MessageSquareText,
  Sparkles,
  Sprout,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { signOut } from "./actions";

const navItems = [
  { href: "/ops/families", label: "Famílias", icon: Users },
  { href: "/ops/inbox", label: "Inbox", icon: Inbox },
  { href: "/ops/simulator", label: "Simulador", icon: MessageSquareText },
  { href: "/ops/playground", label: "Chat de teste", icon: Sparkles },
  { href: "/ops/waitlist", label: "Lista de interesse", icon: ClipboardList },
];

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

  return (
    <div className="flex min-h-[100dvh] flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral bg-primary px-6 py-3">
        <nav className="flex flex-wrap items-center gap-1">
          <Link href="/ops" className="mr-3 flex items-center gap-1.5 text-sm font-bold text-ink">
            <Sprout className="h-5 w-5 text-tertiary" aria-hidden />
            Quintal
          </Link>
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-sm text-ink-muted transition-colors hover:bg-neutral/40 hover:text-ink"
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm text-ink-muted">
          <span>{user.email}</span>
          <form action={signOut}>
            <Button type="submit" variant="ghost" className="px-2 py-1">
              <LogOut className="h-4 w-4" aria-hidden />
              Sair
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
