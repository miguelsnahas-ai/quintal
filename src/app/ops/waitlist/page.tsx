import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function WaitlistPage() {
  const supabase = await createClient();
  const { data: leads } = await supabase
    .from("waitlist_leads")
    .select("id, name, email, whatsapp, how_found, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">
          Lista de interesse
        </h1>
        <p className="text-sm text-neutral-600">
          Cadastros vindos da landing page, mais recentes primeiro.
        </p>
      </div>

      {!leads || leads.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Nenhum cadastro ainda. Se alguém já se inscreveu e não aparece
          aqui, verifique se a landing page está gravando neste mesmo
          projeto Supabase.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
          {leads.map((lead) => (
            <li key={lead.id}>
              <Link
                href={`/ops/waitlist/${lead.id}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-neutral-50"
              >
                <div>
                  <span className="font-medium text-neutral-900">{lead.name}</span>
                  <span className="ml-2 text-neutral-500">{lead.email}</span>
                </div>
                <span className="text-neutral-500">
                  {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
