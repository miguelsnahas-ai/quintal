import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { getFamilyList, type OpsFamilyStatus } from "@/lib/ops/families";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Field";

export const metadata: Metadata = {
  title: "Famílias — Quintal Ops",
  robots: { index: false, follow: false },
};

const STATUS_LABELS: Record<OpsFamilyStatus, string> = { active: "Ativa", inactive: "Inativa" };

// Tela principal do backoffice (refatoração do /ops): "quem está usando o
// Quintal?". Busca/filtro/ordenação via query string (?q=&status=&sort=),
// mesmo padrão GET-only já usado em todo o resto do produto — nada de
// estado de cliente para uma lista que é só leitura.
export default async function FamiliesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string }>;
}) {
  const { q, status, sort } = await searchParams;
  const statusFilter = status === "active" || status === "inactive" ? status : undefined;
  const sortFilter = sort === "created" ? "created" : "activity";

  const families = await getFamilyList({ query: q, status: statusFilter, sort: sortFilter });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-ink">Famílias</h1>
        <p className="text-sm text-ink-muted">Quem está usando o Quintal.</p>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="min-w-[220px] flex-1 space-y-1">
          <label className="text-xs font-medium text-ink-muted" htmlFor="q">
            Buscar
          </label>
          <Input
            id="q"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Nome da família, da criança ou telefone do cuidador"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-muted" htmlFor="status">
            Status
          </label>
          <Select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Todos</option>
            <option value="active">Ativa</option>
            <option value="inactive">Inativa</option>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-ink-muted" htmlFor="sort">
            Ordenar por
          </label>
          <Select id="sort" name="sort" defaultValue={sort ?? "activity"}>
            <option value="activity">Atividade recente</option>
            <option value="created">Data de criação</option>
          </Select>
        </div>
        <button type="submit" className="sr-only">
          Filtrar
        </button>
      </form>

      {families.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <Users className="h-8 w-8 text-ink-muted" aria-hidden />
          <p className="text-sm text-ink-muted">Nenhuma família encontrada.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral text-xs text-ink-muted">
                <th className="px-4 py-2.5 font-medium">Família</th>
                <th className="px-4 py-2.5 text-right font-medium">Crianças</th>
                <th className="px-4 py-2.5 text-right font-medium">Cuidadores</th>
                <th className="px-4 py-2.5 font-medium">Última atividade</th>
                <th className="px-4 py-2.5 font-medium">Criada em</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral">
              {families.map((family) => (
                <tr key={family.id} className="transition-colors hover:bg-secondary/60">
                  <td className="px-4 py-3">
                    <Link href={`/ops/families/${family.id}`} className="font-medium text-ink hover:underline">
                      {family.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right text-ink-muted">{family.childCount}</td>
                  <td className="px-4 py-3 text-right text-ink-muted">{family.caregiverCount}</td>
                  <td className="px-4 py-3 text-ink-muted">{family.lastActivityLabel}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {new Date(family.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={family.status === "active" ? "success" : "neutral"}>
                      {STATUS_LABELS[family.status]}
                    </Badge>
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
