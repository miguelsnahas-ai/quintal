import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Link2, Users, Settings } from "lucide-react";
import { getSessionCaregiver } from "@/lib/authorization";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { LinkCard } from "@/components/ui/LinkCard";
import { QuintalIcon } from "@/components/icon/QuintalIcon";

export const metadata: Metadata = {
  title: "Mais — Quintal",
  robots: { index: false, follow: false },
};

// "Mais" reúne o que não cabe nos cinco itens da navegação principal
// (Hoje/Chat/Registrar/Timeline/Mais) sem virar uma lista enorme de
// funcionalidades: os três pilares de uso menos diário (Sono, Brincar,
// Comer têm tela própria, mas não presença fixa na barra), a biblioteca
// de materiais (mantida alcançável — não fazia parte da navegação nova,
// mas é uma feature real que não pode ficar órfã) e o que já existia
// (Integrações, Família, Configurações).
export default async function MaisPage() {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  return (
    <PageContainer>
      <PageHeader title="Mais" />

      {/* Cada entrada usa a cor do seu próprio domínio (ver
          docs/design-system.md #Quintal Iconography) — não o selo amber
          genérico (iconBackground="accent", ainda o padrão de LinkCard):
          Sono/Brincar/Comer/Higiene já têm tema próprio; Materiais usa
          "growth" porque "book" é o ícone dessa família que representa
          a biblioteca (não é um domínio de registro à parte). */}
      <div className="space-y-3">
        <LinkCard
          icon={<QuintalIcon name="moon" theme="sleep" size="md" background="light" />}
          iconBackground="none"
          title="Sono"
          description="Registro, análise e orientações"
          href="/quintal/sono"
        />
        <LinkCard
          icon={<QuintalIcon name="blocks" theme="play" size="md" background="light" />}
          iconBackground="none"
          title="Brincar"
          description="Atividades, sugestões e registro de momentos"
          href="/quintal/brincadeiras"
        />
        <LinkCard
          icon={<QuintalIcon name="plate" theme="meal" size="md" background="light" />}
          iconBackground="none"
          title="Comer"
          description="Registro de refeições, receitas e orientações"
          href="/quintal/alimentacao"
        />
        <LinkCard
          icon={<QuintalIcon name="drop" theme="hygiene" size="md" background="light" />}
          iconBackground="none"
          title="Higiene"
          description="Fraldas, trocas e histórico"
          href="/quintal/higiene"
        />
        <LinkCard
          icon={<QuintalIcon name="book" theme="growth" size="md" background="light" />}
          iconBackground="none"
          title="Materiais"
          description="Artigos, guias e receitas para consultar"
          href="/quintal/materiais"
        />
      </div>

      <div className="space-y-3">
        <LinkCard
          icon={<Link2 className="h-4 w-4 text-ink" aria-hidden />}
          title="Integrações"
          description="Conexão com serviços e dispositivos"
          href="/quintal/mais/integracoes"
        />
        <LinkCard
          icon={<Users className="h-4 w-4 text-ink" aria-hidden />}
          title="Família"
          description="Cuidadores, crianças e preferências"
          href="/quintal/configuracoes/familia"
        />
        <LinkCard
          icon={<Settings className="h-4 w-4 text-ink" aria-hidden />}
          title="Configurações"
          description="Conta, família e cuidadores"
          href="/quintal/configuracoes"
        />
      </div>
    </PageContainer>
  );
}
