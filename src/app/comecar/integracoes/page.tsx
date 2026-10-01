import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Link2 } from "lucide-react";
import { getFamilySessionCaregiverId } from "@/lib/familySession";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClassName } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Integrações — Quintal",
  robots: { index: false, follow: false },
};

// Sem toggle de "Conectar" — nenhuma integração existe de fato ainda
// (mesmo estado de /quintal/mais/integracoes). Marcar algo como
// "conectado" aqui seria o dado fictício que este pedido pede pra
// evitar; a tela existe só pra avisar que isso vem a seguir, sem
// bloquear quem quer continuar.
export default async function IntegrationsStepPage() {
  const existingCaregiverId = await getFamilySessionCaregiverId();
  if (!existingCaregiverId) {
    redirect("/comecar");
  }

  return (
    <OnboardingScreen
      step={7}
      title="Deseja conectar alguns serviços?"
      description="Isso pode facilitar o registro da rotina e trazer ainda mais contexto. Em breve."
      backHref="/comecar/alimentacao"
    >
      <EmptyState icon={Link2} title="Nenhuma integração ainda" description="Agenda, Localizador e monitores chegam em breve." />
      <Link href="/comecar/resumo" className={buttonClassName("primary", "w-full justify-center")}>
        Continuar
      </Link>
    </OnboardingScreen>
  );
}
