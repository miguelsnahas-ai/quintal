import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

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
    <div className="flex min-h-screen flex-1 flex-col bg-neutral-50">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
        <nav className="flex items-center gap-4">
          <Link href="/ops" className="text-sm font-semibold text-neutral-900">
            Quintal — operação
          </Link>
          <Link
            href="/ops/families"
            className="text-sm text-neutral-600 hover:text-neutral-900"
          >
            Famílias
          </Link>
          <Link
            href="/ops/inbox"
            className="text-sm text-neutral-600 hover:text-neutral-900"
          >
            Inbox
          </Link>
        </nav>
        <div className="flex items-center gap-3 text-sm text-neutral-600">
          <span>{user.email}</span>
          <form action={signOut}>
            <button type="submit" className="text-neutral-500 hover:text-neutral-900">
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
