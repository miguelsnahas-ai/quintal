import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function OpsHomePage() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("families")
    .select("id", { count: "exact", head: true });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Bem-vindo</h1>
        <p className="text-sm text-neutral-600">
          {count ?? 0} família(s) cadastrada(s).
        </p>
      </div>
      <Link
        href="/ops/families"
        className="inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        Ver famílias
      </Link>
    </div>
  );
}
