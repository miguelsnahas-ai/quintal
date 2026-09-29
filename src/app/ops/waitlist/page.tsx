import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { getLeadList, getLeadOrigins, leadStatuses, leadStatusLabels, type LeadStatus } from "@/lib/ops/leads";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Field";

export const metadata: Metadata = {
  title: "Lista de interesse — Quintal Ops",
  robots: { index: false, follow: false },
};

const STATUS_BADGE_VARIANT: Record<LeadStatus, "neutral" | "accent" | "success" | "decorative"> = {
  novo: "accent",
  em_contato: "neutral",
  interessado: "neutral",
  convertido: "success",
  nao_interessado: "decorative",
};

// "Quem demonstrou interesse em usar o Quintal?" (refatoração do /ops) —
// mesma tabela waitlist_leads de sempre, alimentada pela landing page.
export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; origin?: string; sort?: string }>;
}) {
  const { q, status, origin, sort } = await searchParams;
  const statusFilter = leadStatuses.includes(status as LeadStatus) ? (status as LeadStatus) : undefined;
  const sortFilter = sort === "updated" ? "updated" : "created";

  const [leads, origins] = await Promise.all([
    getLeadList({ query: q, status: statusFilter, origin, sort: sortFilter }),
    getLeadOrigins(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-ink">Lista de interesse</h1>
        <p className="text-sm text-ink-muted">
          Pessoas e famílias que demonstraram interesse, mas ainda não são uma família ativa.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="min-w-[220px] flex-1 space-y-1">
          <label className="text-xs font-medium text-ink-muted" htmlFor="q">
            Buscar
          </label>
          <Input id="q" name="q" defaultValue={q ?? ""} placeholder="Nome, e-mail ou WhatsApp" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-muted" htmlFor="status">
            Status
          </label>
          <Select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Todos</option>
            {leadStatuses.map((value) => (
              <option key={value} value={value}>
                {leadStatusLabels[value]}
              </option>
            ))}
          </Select>
        </div>
        {origins.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-ink-muted" htmlFor="origin">
              Origem
            </label>
            <Select id="origin" name="origin" defaultValue={origin ?? ""}>
              <option value="">Todas</option>
              {origins.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-muted" htmlFor="sort">
            Ordenar por
          </label>
          <Select id="sort" name="sort" defaultValue={sort ?? "created"}>
            <option value="created">Data de entrada</option>
            <option value="updated">Último contato</option>
          </Select>
        </div>
        <button type="submit" className="sr-only">
          Filtrar
        </button>
      </form>

      {leads.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <ClipboardList className="h-8 w-8 text-ink-muted" aria-hidden />
          <p className="text-sm text-ink-muted">Nenhum interessado encontrado.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral text-xs text-ink-muted">
                <th className="px-4 py-2.5 font-medium">Pessoa/Família</th>
                <th className="px-4 py-2.5 font-medium">Contato</th>
                <th className="px-4 py-2.5 font-medium">Origem</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Entrada</th>
                <th className="px-4 py-2.5 font-medium">Último contato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral">
              {leads.map((lead) => (
                <tr key={lead.id} className="transition-colors hover:bg-secondary/60">
                  <td className="px-4 py-3">
                    <Link href={`/ops/waitlist/${lead.id}`} className="font-medium text-ink hover:underline">
                      {lead.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    <div>{lead.email}</div>
                    <div>{lead.whatsapp}</div>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{lead.origin ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGE_VARIANT[lead.status]}>{leadStatusLabels[lead.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {new Date(lead.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {lead.updatedAt ? new Date(lead.updatedAt).toLocaleDateString("pt-BR") : "Nunca"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
