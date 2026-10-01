import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Baby } from "lucide-react";
import { getSessionCaregiver } from "@/lib/authorization";
import { getAccessibleChildren } from "@/lib/activeChild";
import { ageLabel } from "@/lib/format";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { AvatarUrlField } from "@/components/onboarding/AvatarUrlField";
import { Input, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { cardClassName } from "@/components/ui/Card";
import { addChildStepAction } from "./actions";

export const metadata: Metadata = {
  title: "Crianças — Quintal",
  robots: { index: false, follow: false },
};

// Reentrante: cada submissão cria uma criança. "Adicionar outra
// criança" volta pra esta mesma tela (agora mostrando quem já foi
// adicionado); "Continuar" segue o fluxo. Junta os passos 5 e 6 do
// mockup de referência (primeira criança / mais crianças) numa tela só
// — a pergunta é sempre a mesma, só muda o que já existe acima dela.
export default async function ChildStepPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const childrenList = await getAccessibleChildren(session.caregiverId);
  const isFirst = childrenList.length === 0;

  return (
    <OnboardingScreen
      step={3}
      title={isFirst ? "Vamos adicionar a primeira criança?" : "Mais alguma criança?"}
      description={
        isFirst
          ? "Você sempre pode adicionar outras crianças depois."
          : "Adicione quantas crianças quiser, ou continue com quem já está na lista."
      }
      backHref="/comecar/familia"
    >
      {childrenList.length > 0 && (
        <ul className="space-y-2">
          {childrenList.map((child) => (
            <li key={child.id} className={cardClassName("flex items-center gap-3 p-3")}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent">
                <Baby className="h-4 w-4 text-ink" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{child.name}</span>
                {ageLabel(child.birthDate) && (
                  <span className="block text-xs text-ink-muted">{ageLabel(child.birthDate)}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <FieldError>{error}</FieldError>
      <form action={addChildStepAction} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="name">Nome da criança</Label>
          <Input id="name" name="name" autoFocus placeholder={isFirst ? "" : "Deixe em branco para continuar sem adicionar outra"} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="birth_date">Data de nascimento</Label>
          <Input id="birth_date" name="birth_date" type="date" />
        </div>
        <AvatarUrlField name="avatar_url" fallbackInitial="?" />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" name="intent" value="continue" className="flex-1 justify-center">
            {isFirst ? "Continuar" : "Continuar com estas crianças"}
          </Button>
          <Button
            type="submit"
            name="intent"
            value="add_another"
            variant="secondary"
            className="flex-1 justify-center"
          >
            Adicionar outra criança
          </Button>
        </div>
      </form>
    </OnboardingScreen>
  );
}
