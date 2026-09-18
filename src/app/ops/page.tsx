import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonClassName } from "@/components/ui/Button";

export default async function OpsHomePage() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("families")
    .select("id", { count: "exact", head: true });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">Bem-vindo</h1>
        <p className="text-sm text-ink-muted">{count ?? 0} família(s) cadastrada(s).</p>
      </div>
      <Link href="/ops/families" className={buttonClassName("primary")}>
        Ver famílias
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}
