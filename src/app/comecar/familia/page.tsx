import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionCaregiver } from "@/lib/authorization";
import { createServiceClient } from "@/lib/supabase/service";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { AvatarUrlField } from "@/components/onboarding/AvatarUrlField";
import { Input, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { saveFamilyStepAction } from "./actions";

export const metadata: Metadata = {
  title: "Sua família — Quintal",
  robots: { index: false, follow: false },
};

export default async function FamilyStepPage({
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
  const { data: family } = await supabase
    .from("families")
    .select("name, avatar_url")
    .eq("id", session.familyId)
    .maybeSingle();

  return (
    <OnboardingScreen
      step={2}
      title="Vamos criar a sua família"
      description="Esse será o espaço de vocês no Quintal. Você sempre pode mudar depois."
      backHref="/comecar/voce"
    >
      <FieldError>{error}</FieldError>
      <form action={saveFamilyStepAction} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="name">Nome da família</Label>
          <Input id="name" name="name" required autoFocus defaultValue={family?.name ?? ""} />
        </div>
        <AvatarUrlField
          name="avatar_url"
          label="Foto da família (opcional)"
          defaultValue={family?.avatar_url}
          fallbackInitial={(family?.name ?? "?").charAt(0)}
        />
        <Button type="submit" className="w-full justify-center">
          Continuar
        </Button>
      </form>
    </OnboardingScreen>
  );
}
