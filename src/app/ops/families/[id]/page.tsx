import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getFamilyDetail } from "@/lib/ops/families";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

// Detalhe operacional da família (refatoração do /ops): "quem é essa
// família e o que está acontecendo com ela?" — dados agregados, nunca uma
// segunda versão de Dashboard/Alimentação/Sono/Brincadeiras/Chat (pedido
// explícito desta fase). Somente leitura: editar família/cuidadores/
// crianças é responsabilidade do próprio produto (/quintal/configuracoes),
// que já faz isso corretamente (caregiver_child, convites, permissões) —
// os formulários antigos daqui não sabiam desse modelo e ficariam quebrados.
export default async function FamilyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ converted?: string }>;
}) {
  const { id: familyId } = await params;
  const { converted } = await searchParams;
  const family = await getFamilyDetail(familyId);

  if (!family) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/ops/families" className="text-sm text-ink-muted hover:text-ink">
          ← Famílias
        </Link>
        <h1 className="text-lg font-bold text-ink">{family.name}</h1>
      </div>

      {converted && (
        <p className="flex items-center gap-2 rounded-sm bg-success/20 px-3 py-2 text-sm text-ink" role="status">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Convertido da lista de interesse.
        </p>
      )}

      <section className={"grid grid-cols-2 gap-4 sm:grid-cols-4"}>
        <Card className="space-y-1 p-4">
          <p className="text-xs text-ink-muted">Status</p>
          <Badge variant={family.status === "active" ? "success" : "neutral"}>
            {family.status === "active" ? "Ativa" : "Inativa"}
          </Badge>
        </Card>
        <Card className="space-y-1 p-4">
          <p className="text-xs text-ink-muted">Criada em</p>
          <p className="text-sm font-medium text-ink">{new Date(family.createdAt).toLocaleDateString("pt-BR")}</p>
        </Card>
        <Card className="space-y-1 p-4">
          <p className="text-xs text-ink-muted">Última atividade</p>
          <p className="text-sm font-medium text-ink">{family.lastActivityLabel}</p>
        </Card>
        <Card className="space-y-1 p-4">
          <p className="text-xs text-ink-muted">Eventos registrados</p>
          <p className="text-sm font-medium text-ink">{family.eventCount}</p>
        </Card>
      </section>

      {family.notes && (
        <p className="text-sm text-ink-muted">
          <span className="font-medium text-ink">Notas internas:</span> {family.notes}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink">Crianças ({family.children.length})</h2>
        {family.children.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhuma criança cadastrada.</p>
        ) : (
          <Card className="divide-y divide-neutral">
            {family.children.map((child) => (
              <div key={child.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="font-medium text-ink">{child.name}</span>
                <span className="text-ink-muted">
                  {child.ageLabel ?? "Idade não informada"}
                  {child.birthDate && ` · ${new Date(child.birthDate).toLocaleDateString("pt-BR")}`}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink">Cuidadores ({family.caregivers.length})</h2>
        {family.caregivers.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhum cuidador cadastrado.</p>
        ) : (
          <Card className="divide-y divide-neutral">
            {family.caregivers.map((caregiver) => (
              <div key={caregiver.id} className="space-y-1 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-ink">
                    {caregiver.name}
                    {caregiver.role && <span className="text-ink-muted"> · {caregiver.role}</span>}
                  </span>
                  <Badge variant={caregiver.accessRole === "owner" ? "accent" : "neutral"}>
                    {caregiver.accessRole === "owner" ? "Administrador(a)" : "Cuidador(a)"}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 text-xs text-ink-muted">
                  <span>{caregiver.phoneNumber}</span>
                  {caregiver.isPrimaryContact && <span>Contato principal</span>}
                  <span>Última interação: {caregiver.lastActivityLabel}</span>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
