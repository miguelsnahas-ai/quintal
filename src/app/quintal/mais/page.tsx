import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Moon, Utensils, Blocks, BookOpen, Link2, Users, Settings } from "lucide-react";
import { getSessionCaregiver } from "@/lib/authorization";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { LinkCard } from "@/components/ui/LinkCard";

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

      <div className="space-y-3">
        <LinkCard icon={Moon} title="Sono" description="Registro, análise e orientações" href="/quintal/sono" />
        <LinkCard
          icon={Blocks}
          title="Brincar"
          description="Atividades, sugestões e registro de momentos"
          href="/quintal/brincadeiras"
        />
        <LinkCard
          icon={Utensils}
          title="Comer"
          description="Registro de refeições, receitas e orientações"
          href="/quintal/alimentacao"
        />
        <LinkCard
          icon={BookOpen}
          title="Materiais"
          description="Artigos, guias e receitas para consultar"
          href="/quintal/materiais"
        />
      </div>

      <div className="space-y-3">
        <LinkCard
          icon={Link2}
          title="Integrações"
          description="Conexão com serviços e dispositivos"
          href="/quintal/mais/integracoes"
        />
        <LinkCard icon={Users} title="Família" description="Cuidadores, crianças e preferências" href="/quintal/configuracoes/familia" />
        <LinkCard icon={Settings} title="Configurações" description="Conta, família e cuidadores" href="/quintal/configuracoes" />
      </div>
    </PageContainer>
  );
}
