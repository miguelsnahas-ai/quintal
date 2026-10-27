import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getFamilySessionCaregiverId } from "@/lib/familySession";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { Input, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { caregiverRoleOptions } from "@/lib/validation/onboarding";
import { createCaregiverAction } from "./actions";

export const metadata: Metadata = {
  title: "Sobre você — Quintal",
  robots: { index: false, follow: false },
};

// Passo 1: quem é você. O papel ("Mãe"/"Pai"/"Outro cuidador") e o nome
// vêm do mockup de referência; o WhatsApp não aparece lá, mas é a
// identidade do produto (uma mensagem chega pelo número, não por login)
// — por isso entra aqui, no mesmo grupo "sobre você", em vez de ganhar
// uma tela própria que o mockup não previu.
export default async function AboutCaregiverPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const existingCaregiverId = await getFamilySessionCaregiverId();
  if (existingCaregiverId) {
    redirect("/quintal");
  }

  return (
    <OnboardingScreen step={1} title="Vamos começar!" description="Conte um pouco sobre você." backHref="/comecar">
      <FieldError>{error}</FieldError>
      <form action={createCaregiverAction} className="space-y-4">
        <div className="space-y-2">
          <Label>Qual é o seu papel na família?</Label>
          <div className="grid grid-cols-1 gap-2">
            {caregiverRoleOptions.map((role) => (
              <label
                key={role}
                className="flex cursor-pointer items-center gap-2 rounded-lg border-[1.5px] border-neutral p-3 text-sm text-ink has-[:checked]:border-accent has-[:checked]:bg-accent/20"
              >
                <input type="radio" name="role" value={role} className="h-4 w-4 accent-accent" />
                {role}
              </label>
            ))}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border-[1.5px] border-neutral p-3 text-sm text-ink has-[:checked]:border-accent has-[:checked]:bg-accent/20">
              <input type="radio" name="role" value="" defaultChecked className="h-4 w-4 accent-accent" />
              Prefiro não informar
            </label>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="name">Seu nome</Label>
          <Input id="name" name="name" required autoFocus placeholder="Seu nome nos ajuda a personalizar o Quintal" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="phone_number">Seu WhatsApp</Label>
          <Input id="phone_number" name="phone_number" placeholder="(11) 91234-5678" required />
        </div>
        <Button type="submit" className="w-full justify-center">
          Continuar
        </Button>
      </form>
    </OnboardingScreen>
  );
}
