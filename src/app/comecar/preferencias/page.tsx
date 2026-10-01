import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionCaregiver } from "@/lib/authorization";
import { createServiceClient } from "@/lib/supabase/service";
import { materialCategories, materialCategoryLabels } from "@/lib/validation/library";
import { routineFlexibilities, routineFlexibilityLabels } from "@/lib/validation/profile";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { savePreferencesStepAction } from "./actions";

export const metadata: Metadata = {
  title: "Preferências — Quintal",
  robots: { index: false, follow: false },
};

// Dois dos campos estruturados de family_preferences (Fase 19) — os que
// fazem sentido perguntar logo no começo. Os demais (estilo de
// recomendação, foco de atividade, notas livres) continuam só em
// Configurações > Minha família, pra esta tela não virar o "formulário
// longo" que o pedido explicitamente quer evitar.
export default async function PreferencesStepPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const supabase = createServiceClient();
  const { data: preferences } = await supabase
    .from("family_preferences")
    .select("content_focus, routine_flexibility")
    .eq("family_id", session.familyId)
    .maybeSingle();

  const selectedFocus = new Set(preferences?.content_focus ?? []);

  return (
    <OnboardingScreen
      step={5}
      title="Quais temas são mais importantes para vocês?"
      description="Isso ajuda a trazer sugestões mais relevantes. Pode mudar quando quiser."
      backHref="/comecar/cuidadores"
    >
      <FieldError>{error}</FieldError>
      <form action={savePreferencesStepAction} className="space-y-6">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {materialCategories.map((category) => (
              <label
                key={category}
                className="flex cursor-pointer items-center gap-2 rounded-lg border-[1.5px] border-neutral p-3 text-sm text-ink has-[:checked]:border-accent has-[:checked]:bg-accent/20"
              >
                <input
                  type="checkbox"
                  name="content_focus"
                  value={category}
                  defaultChecked={selectedFocus.has(category)}
                  className="h-4 w-4 accent-accent"
                />
                {materialCategoryLabels[category]}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Como é a rotina da sua família?</Label>
          <div className="grid grid-cols-1 gap-2">
            {routineFlexibilities.map((flexibility) => (
              <label
                key={flexibility}
                className="flex cursor-pointer items-center gap-2 rounded-lg border-[1.5px] border-neutral p-3 text-sm text-ink has-[:checked]:border-accent has-[:checked]:bg-accent/20"
              >
                <input
                  type="radio"
                  name="routine_flexibility"
                  value={flexibility}
                  defaultChecked={preferences?.routine_flexibility === flexibility}
                  className="h-4 w-4 accent-accent"
                />
                {routineFlexibilityLabels[flexibility]}
              </label>
            ))}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border-[1.5px] border-neutral p-3 text-sm text-ink has-[:checked]:border-accent has-[:checked]:bg-accent/20">
              <input
                type="radio"
                name="routine_flexibility"
                value=""
                defaultChecked={!preferences?.routine_flexibility}
                className="h-4 w-4 accent-accent"
              />
              Ainda estamos descobrindo
            </label>
          </div>
        </div>

        <Button type="submit" className="w-full justify-center">
          Continuar
        </Button>
      </form>
      <Link href="/comecar/alimentacao" className="block text-center text-sm text-ink-muted hover:text-ink">
        Pular por enquanto
      </Link>
    </OnboardingScreen>
  );
}
