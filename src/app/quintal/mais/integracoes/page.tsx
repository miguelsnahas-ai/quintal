import type { Metadata } from "next";
import { Link2 } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = {
  title: "Integrações — Quintal",
  robots: { index: false, follow: false },
};

// Estrutura e navegação, não a lógica completa ainda — mesmo critério já
// usado nas seções de Configurações que nasceram só com EmptyState
// (Fase 17): melhor ser honesto que a conexão com serviços externos
// (agenda, localizador, monitores) ainda não existe do que fingir um
// botão "Conectar" que não conecta nada.
export default function IntegracoesPage() {
  return (
    <PageContainer space={6}>
      <PageHeader title="Integrações" backHref="/quintal/mais" backLabel="Mais" />
      <EmptyState
        icon={Link2}
        title="Nenhuma integração ainda"
        description="Em breve: conectar agenda, localização e outros dispositivos da família."
      />
    </PageContainer>
  );
}
