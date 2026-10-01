import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionCaregiver } from "@/lib/authorization";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { Input, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { cardClassName } from "@/components/ui/Card";
import { inviteCaregiverStepAction } from "./actions";

export const metadata: Metadata = {
  title: "Cuidadores — Quintal",
  robots: { index: false, follow: false },
};

export default async function CaregiversStepPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; link?: string }>;
}) {
  const { error, link } = await searchParams;

  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  return (
    <OnboardingScreen
      step={4}
      title="Quem também faz parte do cuidado?"
      description="Convide outras pessoas da família para acessar o Quintal. Você pode fazer isso depois também."
      backHref="/comecar/crianca"
    >
      {link ? (
        <div className={cardClassName("space-y-2 p-4")}>
          <p className="text-sm font-medium text-ink">Convite criado!</p>
          <p className="text-xs text-ink-muted">Copie o link abaixo e mande por WhatsApp.</p>
          <p className="truncate rounded-sm bg-surface px-3 py-2 text-xs text-ink">{link}</p>
          <Link href="/comecar/preferencias" className="text-sm font-medium text-ink underline underline-offset-2">
            Continuar →
          </Link>
        </div>
      ) : (
        <>
          <FieldError>{error}</FieldError>
          <form action={inviteCaregiverStepAction} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" autoFocus placeholder="Ex.: Avó Maria" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">E-mail (opcional, só para sua referência)</Label>
              <Input id="email" name="email" type="email" placeholder="ex@exemplo.com" />
            </div>
            <p className="text-xs text-ink-muted">
              Você vai receber um link para copiar e mandar por WhatsApp — o Quintal ainda não envia
              convites automaticamente.
            </p>
            <Button type="submit" className="w-full justify-center">
              Gerar convite
            </Button>
          </form>
          <Link href="/comecar/preferencias" className="block text-center text-sm text-ink-muted hover:text-ink">
            Pular por enquanto
          </Link>
        </>
      )}
    </OnboardingScreen>
  );
}
