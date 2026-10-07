import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFamilySessionCaregiverId } from "@/lib/familySession";
import { Wordmark } from "@/components/marks/Wordmark";
import { CrayonDefs, CrayonMark } from "@/components/marks/CrayonMark";
import { buttonClassName } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Bem-vindo(a) ao Quintal",
  robots: { index: false, follow: false },
};

// Primeira tela do onboarding (refatoração desta fase) — só a
// apresentação e o convite para começar, sem nenhum campo. "Já tenho uma
// conta" pula direto pro passo que reconhece o WhatsApp já cadastrado
// (/comecar/voce) — não existe um segundo mecanismo de login no
// produto, então "entrar" e "começar" convergem no mesmo lugar.
export default async function StartPage() {
  const existingCaregiverId = await getFamilySessionCaregiverId();
  if (existingCaregiverId) {
    redirect("/quintal");
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center px-4 py-10 text-center">
      <CrayonDefs />
      <Wordmark size={48} />
      <div className="mt-8 space-y-2">
        <h1 className="text-2xl font-bold text-ink">Um lugar de apoio para cada fase da primeira infância.</h1>
        <p className="text-sm text-ink-muted">
          Rotina, orientação e conteúdo, tudo em um só lugar — sem cobrar nada de você além do que
          já faz.
        </p>
      </div>
      <CrayonMark mark="sprig" scale={0.6} style={{ margin: "24px 0" }} />
      <div className="w-full space-y-3">
        <Link href="/comecar/voce" className={buttonClassName("primary", "w-full justify-center")}>
          Começar
        </Link>
        <Link href="/comecar/voce" className="block text-sm text-ink-muted hover:text-ink">
          Já tenho uma conta
        </Link>
      </div>
    </div>
  );
}
