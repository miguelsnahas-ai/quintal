"use server";

import { redirect } from "next/navigation";
import { getSessionCaregiver } from "@/lib/authorization";
import { getFamilyProfile, updateFamilyPreferences } from "@/lib/familyContext";
import { onboardingPreferencesInputSchema } from "@/lib/validation/onboarding";

export async function savePreferencesStepAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const parsed = onboardingPreferencesInputSchema.safeParse({
    content_focus: formData.getAll("content_focus"),
    routine_flexibility: formData.get("routine_flexibility"),
  });

  if (!parsed.success) {
    redirect(`/comecar/preferencias?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  // updateFamilyPreferences é um upsert completo — lê o que já existe
  // primeiro pra só sobrescrever os dois campos que esta tela controla,
  // nunca apagar notas/preferências que a família já tenha salvo em
  // Configurações (caso raro, mas o onboarding não é o único jeito de
  // chegar aqui).
  const existing = await getFamilyProfile(session.familyId);

  try {
    await updateFamilyPreferences(session.familyId, {
      recommendationStyle: existing?.preferences?.recommendationStyle ?? null,
      routineFlexibility: parsed.data.routine_flexibility,
      routineActivityFocus: existing?.preferences?.routineActivityFocus ?? null,
      contentFocus: parsed.data.content_focus,
      feedingNotes: existing?.preferences?.feedingNotes ?? null,
      routineNotes: existing?.preferences?.routineNotes ?? null,
      playNotes: existing?.preferences?.playNotes ?? null,
      materialsNotes: existing?.preferences?.materialsNotes ?? null,
      interactionStyle: existing?.preferences?.interactionStyle ?? null,
    });
  } catch {
    redirect(`/comecar/preferencias?error=${encodeURIComponent("Não foi possível salvar. Tente de novo.")}`);
  }

  redirect("/comecar/alimentacao");
}
