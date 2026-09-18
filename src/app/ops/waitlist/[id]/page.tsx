import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </dt>
      <dd className="text-sm text-neutral-900">{value}</dd>
    </div>
  );
}

function list(values: string[] | null): string | null {
  if (!values || values.length === 0) return null;
  return values.join(", ");
}

export default async function WaitlistLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("waitlist_leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!lead) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/ops/waitlist" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Lista de interesse
        </Link>
        <h1 className="text-lg font-semibold text-neutral-900">{lead.name}</h1>
        <p className="text-sm text-neutral-500">
          Cadastrado em {new Date(lead.created_at).toLocaleString("pt-BR")}
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-4 rounded-md border border-neutral-200 bg-white p-4 sm:grid-cols-2">
        <Field label="E-mail" value={lead.email} />
        <Field label="WhatsApp" value={lead.whatsapp} />
        <Field label="Quantidade de filhos" value={lead.child_count} />
        <Field label="Idade dos filhos" value={list(lead.child_age)} />
        <Field label="Cuidadores envolvidos" value={list(lead.caregivers)} />
        <Field label="Outros cuidadores" value={lead.caregivers_other} />
        <Field label="Principais desafios" value={list(lead.challenges)} />
        <Field label="Outros desafios" value={lead.challenges_other} />
        <Field label="Rede de apoio" value={list(lead.support_network)} />
        <Field label="Outra rede de apoio" value={lead.support_network_other} />
        <Field label="Profissionais acompanhando" value={list(lead.professionals)} />
        <Field
          label="Já fez curso de parentalidade?"
          value={lead.course_taken}
        />
        <Field label="Qual curso" value={lead.course_which} />
        <Field label="Já usou outro app parecido?" value={lead.app_used} />
        <Field label="Qual app" value={lead.app_which} />
        <Field label="O que espera do Quintal" value={lead.expectation} />
        <Field
          label="Interesse em plano família"
          value={lead.family_setup_interest ? "Sim" : "Não"}
        />
        <Field label="Como conheceu" value={lead.how_found} />
        <Field label="Outro (como conheceu)" value={lead.how_found_other} />
        <Field label="UTM source" value={lead.utm_source} />
        <Field label="UTM medium" value={lead.utm_medium} />
        <Field label="UTM campaign" value={lead.utm_campaign} />
      </dl>
    </div>
  );
}
