import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionCaregiver } from "@/lib/authorization";
import { getAccessibleChildren } from "@/lib/activeChild";
import { getFeedingMethodOptions, getChildFeedingMethod } from "@/lib/feeding";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { saveFeedingMethodStepAction } from "./actions";

export const metadata: Metadata = {
  title: "Alimentação — Quintal",
  robots: { index: false, follow: false },
};

// Método alimentar é por criança (children.feeding_method_id), não por
// família — pergunta aqui só pela primeira criança adicionada (a mesma
// que vira a criança ativa por padrão); as demais podem ser
// configuradas depois em Configurações > Crianças, junto do resto do
// perfil de cada uma.
export default async function FeedingMethodStepPage({
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
  const firstChild = childrenList[0];
  if (!firstChild) {
    redirect("/comecar/crianca");
  }

  const [options, current] = await Promise.all([
    getFeedingMethodOptions(),
    getChildFeedingMethod(firstChild.id),
  ]);

  if (options.length === 0) {
    redirect("/comecar/integracoes");
  }

  return (
    <OnboardingScreen
      step={6}
      title="Qual abordagem alimentar vocês preferem?"
      description={`Para ${firstChild.name}. Nenhuma abordagem é mais certa que a outra — a escolha é de vocês.`}
      backHref="/comecar/preferencias"
    >
      <FieldError>{error}</FieldError>
      <form action={saveFeedingMethodStepAction} className="space-y-4">
        <input type="hidden" name="child_id" value={firstChild.id} />
        <div className="grid grid-cols-1 gap-2">
          {options.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-start gap-2 rounded-lg border-[1.5px] border-neutral p-3 has-[:checked]:border-accent has-[:checked]:bg-accent/20"
            >
              <input
                type="radio"
                name="method_id"
                value={option.id}
                defaultChecked={current.option?.id === option.id}
                className="mt-1 h-4 w-4 accent-accent"
              />
              <span>
                <span className="block text-sm font-medium text-ink">{option.title}</span>
                {option.howItWorks && <span className="block text-xs text-ink-muted">{option.howItWorks}</span>}
              </span>
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border-[1.5px] border-neutral p-3 text-sm text-ink has-[:checked]:border-accent has-[:checked]:bg-accent/20">
            <input type="radio" name="method_id" value="" defaultChecked={!current.option} className="h-4 w-4 accent-accent" />
            Ainda não definimos
          </label>
        </div>
        <Button type="submit" className="w-full justify-center">
          Continuar
        </Button>
      </form>
      <Link href="/comecar/integracoes" className="block text-center text-sm text-ink-muted hover:text-ink">
        Pular por enquanto
      </Link>
    </OnboardingScreen>
  );
}
