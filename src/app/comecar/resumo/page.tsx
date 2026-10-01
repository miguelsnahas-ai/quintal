import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, Baby, ListChecks } from "lucide-react";
import { getSessionCaregiver } from "@/lib/authorization";
import { getFamilyProfile } from "@/lib/familyContext";
import { getChildFeedingMethod } from "@/lib/feeding";
import { materialCategoryLabels, type MaterialCategory } from "@/lib/validation/library";
import { routineFlexibilityLabels, type RoutineFlexibility } from "@/lib/validation/profile";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { cardClassName } from "@/components/ui/Card";
import { buttonClassName } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Resumo — Quintal",
  robots: { index: false, follow: false },
};

export default async function SummaryStepPage() {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const profile = await getFamilyProfile(session.familyId);
  if (!profile) {
    redirect("/comecar");
  }

  const firstChild = profile.children[0];
  const feedingMethod = firstChild ? await getChildFeedingMethod(firstChild.id) : null;

  return (
    <OnboardingScreen
      step={8}
      title="Quase pronto!"
      description="Veja um resumo das suas configurações iniciais — tudo pode ser ajustado depois, em Configurações."
      backHref="/comecar/integracoes"
    >
      <div className={cardClassName("flex items-start gap-3 p-4")}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent">
          <Users className="h-4 w-4 text-ink" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{profile.family.name}</p>
          <p className="text-xs text-ink-muted">
            {profile.caregivers.length} {profile.caregivers.length === 1 ? "cuidador" : "cuidadores"}
          </p>
        </div>
        <Link href="/comecar/familia" className="shrink-0 text-xs font-medium text-ink underline underline-offset-2">
          Editar
        </Link>
      </div>

      <div className={cardClassName("flex items-start gap-3 p-4")}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent">
          <Baby className="h-4 w-4 text-ink" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">
            {profile.children.length} {profile.children.length === 1 ? "criança" : "crianças"}
          </p>
          <p className="truncate text-xs text-ink-muted">
            {profile.children.map((child) => child.name).join(", ") || "Nenhuma ainda"}
          </p>
        </div>
        <Link href="/comecar/crianca" className="shrink-0 text-xs font-medium text-ink underline underline-offset-2">
          Editar
        </Link>
      </div>

      <div className={cardClassName("flex items-start gap-3 p-4")}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent">
          <ListChecks className="h-4 w-4 text-ink" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="font-semibold text-ink">Preferências</p>
          <p className="text-xs text-ink-muted">
            {(profile.preferences?.contentFocus ?? []).length > 0
              ? (profile.preferences!.contentFocus as MaterialCategory[])
                  .map((category) => materialCategoryLabels[category])
                  .join(", ")
              : "Nenhum interesse marcado"}
          </p>
          <p className="text-xs text-ink-muted">
            Rotina:{" "}
            {profile.preferences?.routineFlexibility
              ? routineFlexibilityLabels[profile.preferences.routineFlexibility as RoutineFlexibility]
              : "Ainda descobrindo"}
          </p>
          {firstChild && (
            <p className="text-xs text-ink-muted">
              Alimentação de {firstChild.name}:{" "}
              {feedingMethod?.option?.title ?? feedingMethod?.custom ?? "Ainda não definido"}
            </p>
          )}
        </div>
        <Link href="/comecar/preferencias" className="shrink-0 text-xs font-medium text-ink underline underline-offset-2">
          Editar
        </Link>
      </div>

      <Link href="/comecar/concluido" className={buttonClassName("primary", "w-full justify-center")}>
        Finalizar
      </Link>
    </OnboardingScreen>
  );
}
