import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cardClassName } from "@/components/ui/Card";

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="text-sm text-ink">{value}</dd>
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
        <Link href="/ops/waitlist" className="text-sm text-ink-muted hover:text-ink">
          ← Lista de interesse
        </Link>
        <h1 className="text-lg font-bold text-ink">{lead.name}</h1>
        <p className="text-sm text-ink-muted">
          Cadastrado em {new Date(lead.created_at).toLocaleString("pt-BR")}
        </p>
      </div>

      <dl className={cardClassName("grid grid-cols-1 gap-4 p-4 sm:grid-cols-2")}>
        <DetailField label="E-mail" value={lead.email} />
        <DetailField label="WhatsApp" value={lead.whatsapp} />
        <DetailField label="Quantidade de filhos" value={lead.child_count} />
        <DetailField label="Idade dos filhos" value={list(lead.child_age)} />
        <DetailField label="Cuidadores envolvidos" value={list(lead.caregivers)} />
        <DetailField label="Outros cuidadores" value={lead.caregivers_other} />
        <DetailField label="Principais desafios" value={list(lead.challenges)} />
        <DetailField label="Outros desafios" value={lead.challenges_other} />
        <DetailField label="Rede de apoio" value={list(lead.support_network)} />
        <DetailField label="Outra rede de apoio" value={lead.support_network_other} />
        <DetailField label="Profissionais acompanhando" value={list(lead.professionals)} />
        <DetailField label="Já fez curso de parentalidade?" value={lead.course_taken} />
        <DetailField label="Qual curso" value={lead.course_which} />
        <DetailField label="Já usou outro app parecido?" value={lead.app_used} />
        <DetailField label="Qual app" value={lead.app_which} />
        <DetailField label="O que espera do Quintal" value={lead.expectation} />
        <DetailField
          label="Interesse em plano família"
          value={lead.family_setup_interest ? "Sim" : "Não"}
        />
        <DetailField label="Como conheceu" value={lead.how_found} />
        <DetailField label="Outro (como conheceu)" value={lead.how_found_other} />
        <DetailField label="UTM source" value={lead.utm_source} />
        <DetailField label="UTM medium" value={lead.utm_medium} />
        <DetailField label="UTM campaign" value={lead.utm_campaign} />
      </dl>
    </div>
  );
}
