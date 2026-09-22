import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";

export default async function WaitlistPage() {
  const supabase = await createClient();
  const { data: leads } = await supabase
    .from("waitlist_leads")
    .select("id, name, email, whatsapp, how_found, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-ink">Lista de interesse</h1>
        <p className="text-sm text-ink-muted">
          Cadastros vindos da landing page, mais recentes primeiro.
        </p>
      </div>

      {!leads || leads.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <ClipboardList className="h-8 w-8 text-ink-muted" aria-hidden />
          <p className="text-sm text-ink-muted">
            Nenhum cadastro ainda. Se alguém já se inscreveu e não aparece
            aqui, verifique se a landing page está gravando neste mesmo
            projeto Supabase.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-neutral">
          {leads.map((lead) => (
            <Link
              key={lead.id}
              href={`/ops/waitlist/${lead.id}`}
              className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-secondary/60"
            >
              <div>
                <span className="font-medium text-ink">{lead.name}</span>
                <span className="ml-2 text-ink-muted">{lead.email}</span>
              </div>
              <span className="text-ink-muted">
                {new Date(lead.created_at).toLocaleDateString("pt-BR")}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
