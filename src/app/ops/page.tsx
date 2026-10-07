import Link from "next/link";
import { Baby, ClipboardList, UserPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFamilyList } from "@/lib/ops/families";
import { getLeadList } from "@/lib/ops/leads";
import { Card } from "@/components/ui/Card";

const RECENT_WINDOW_DAYS = 7;
const RECENT_ACTIVITY_LIMIT = 8;

function isWithinDays(dateStr: string, days: number): boolean {
  return Date.now() - new Date(dateStr).getTime() <= days * 24 * 60 * 60 * 1000;
}

type ActivityEntry = { at: string; label: string; href: string };

// Resumo operacional do /ops (refatoração — substitui a Home antiga, que
// só mostrava uma contagem de famílias). Métricas simples derivadas dos
// mesmos dados de families/waitlist_leads/family_invitations já usados
// nas próprias telas — nada de BI, cohort, funil ou gráfico (pedido
// explícito desta fase).
export default async function OpsHomePage() {
  const supabase = await createClient();

  const [families, leads, { data: invitations }] = await Promise.all([
    getFamilyList({}),
    getLeadList({}),
    supabase
      .from("family_invitations")
      .select("id, name, created_at, family_id, families(name)")
      .order("created_at", { ascending: false })
      .limit(RECENT_ACTIVITY_LIMIT),
  ]);

  const activeFamilies = families.filter((family) => family.status === "active").length;
  const newFamilies = families.filter((family) => isWithinDays(family.createdAt, RECENT_WINDOW_DAYS));
  const newLeads = leads.filter((lead) => isWithinDays(lead.createdAt, RECENT_WINDOW_DAYS));

  const activity: ActivityEntry[] = [
    ...newFamilies.map((family) => ({
      at: family.createdAt,
      label: `Nova família: ${family.name}`,
      href: `/ops/families/${family.id}`,
    })),
    ...newLeads.map((lead) => ({
      at: lead.createdAt,
      label: `Novo interessado: ${lead.name}`,
      href: `/ops/waitlist/${lead.id}`,
    })),
    ...(invitations ?? [])
      .filter((invitation) => isWithinDays(invitation.created_at, RECENT_WINDOW_DAYS))
      .map((invitation) => ({
        at: invitation.created_at,
        label: `Cuidador convidado: ${invitation.name ?? "sem nome"} (${invitation.families?.name ?? "família"})`,
        href: `/ops/families/${invitation.family_id}`,
      })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, RECENT_ACTIVITY_LIMIT);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-bold text-ink">Bem-vindo</h1>
        <p className="text-sm text-ink-muted">Resumo operacional do Quintal.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Link href="/ops/families">
          <Card className="space-y-1 p-4">
            <span className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Users className="h-3.5 w-3.5" aria-hidden />
              Famílias ativas
            </span>
            <p className="text-2xl font-bold text-ink">{activeFamilies}</p>
          </Card>
        </Link>
        <Link href="/ops/families">
          <Card className="space-y-1 p-4">
            <span className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Baby className="h-3.5 w-3.5" aria-hidden />
              Novas famílias (7d)
            </span>
            <p className="text-2xl font-bold text-ink">{newFamilies.length}</p>
          </Card>
        </Link>
        <Link href="/ops/waitlist">
          <Card className="space-y-1 p-4">
            <span className="flex items-center gap-1.5 text-xs text-ink-muted">
              <ClipboardList className="h-3.5 w-3.5" aria-hidden />
              Lista de interesse
            </span>
            <p className="text-2xl font-bold text-ink">{leads.length}</p>
          </Card>
        </Link>
        <Link href="/ops/waitlist">
          <Card className="space-y-1 p-4">
            <span className="flex items-center gap-1.5 text-xs text-ink-muted">
              <UserPlus className="h-3.5 w-3.5" aria-hidden />
              Novos interessados (7d)
            </span>
            <p className="text-2xl font-bold text-ink">{newLeads.length}</p>
          </Card>
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink">Atividade recente</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-ink-muted">Nada de novo nos últimos {RECENT_WINDOW_DAYS} dias.</p>
        ) : (
          <Card className="divide-y divide-neutral">
            {activity.map((entry, index) => (
              <Link
                key={index}
                href={entry.href}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-secondary/60"
              >
                <span className="text-ink">{entry.label}</span>
                <span className="shrink-0 text-xs text-ink-muted">
                  {new Date(entry.at).toLocaleDateString("pt-BR")}
                </span>
              </Link>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
