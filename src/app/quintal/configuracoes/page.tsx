import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { User, Users, Baby, UserCog } from "lucide-react";
import { getSessionCaregiver } from "@/lib/authorization";
import { getFamilyProfile } from "@/lib/familyContext";
import { getFamilyInvitations } from "@/lib/invitations";
import { LinkCard } from "@/components/ui/LinkCard";

export const metadata: Metadata = {
  title: "Configurações — Quintal",
  robots: { index: false, follow: false },
};

// Página inicial de Configurações (Fase 17). Faz papel duplo por design,
// não por economia de código: no mobile, ESTA página é a navegação (a
// sidebar fica escondida abaixo de lg — ver o layout), então cada seção
// precisa aparecer aqui como um destino claro, com um resumo real do que
// tem lá dentro (não só um nome genérico) — daí buscar family/children/
// invitations aqui em vez de só linkar pros 4 hrefs. No desktop, a
// sidebar já cobre a navegação; esta página vira a "página inicial" da
// área, um resumo amigável em vez de uma tela em branco.
export default async function ConfiguracoesPage() {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const [profile, invitations] = await Promise.all([
    getFamilyProfile(session.familyId),
    getFamilyInvitations(session.familyId),
  ]);

  if (!profile) {
    redirect("/comecar");
  }

  const pendingCount = invitations.filter((invitation) => invitation.status === "pending").length;
  const caregiverCount = profile.caregivers.length;
  const childCount = profile.children.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-ink">Configurações</h1>
        <p className="text-sm text-ink-muted">{profile.family.name}</p>
      </div>

      <div className="space-y-3">
        <LinkCard
          icon={User}
          title="Minha conta"
          description="Perfil, preferências pessoais e notificações"
          href="/quintal/configuracoes/conta"
        />
        <LinkCard
          icon={Users}
          title="Minha família"
          description="Perfil e preferências da família"
          href="/quintal/configuracoes/familia"
        />
        <LinkCard
          icon={Baby}
          title="Crianças"
          description={childCount > 0 ? `${childCount} ${childCount === 1 ? "criança" : "crianças"}` : "Adicionar a primeira criança"}
          href="/quintal/configuracoes/criancas"
        />
        <LinkCard
          icon={UserCog}
          title="Cuidadores"
          description={
            pendingCount > 0
              ? `${caregiverCount} ${caregiverCount === 1 ? "cuidador" : "cuidadores"} · ${pendingCount} ${pendingCount === 1 ? "convite pendente" : "convites pendentes"}`
              : `${caregiverCount} ${caregiverCount === 1 ? "cuidador" : "cuidadores"}`
          }
          href="/quintal/configuracoes/cuidadores"
        />
      </div>
    </div>
  );
}
