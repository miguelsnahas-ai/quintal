"use server";

import { redirect } from "next/navigation";
import { getSessionCaregiver, canManageFamily } from "@/lib/authorization";
import { updateFamilyProfile } from "@/lib/familyContext";
import { familyStepInputSchema } from "@/lib/validation/onboarding";

export async function saveFamilyStepAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const allowed = await canManageFamily(session.caregiverId, session.familyId);
  if (!allowed) {
    redirect("/quintal");
  }

  const parsed = familyStepInputSchema.safeParse({
    name: formData.get("name"),
    avatar_url: formData.get("avatar_url"),
  });

  if (!parsed.success) {
    redirect(`/comecar/familia?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  try {
    await updateFamilyProfile(session.familyId, { name: parsed.data.name, avatarUrl: parsed.data.avatar_url });
  } catch {
    redirect(`/comecar/familia?error=${encodeURIComponent("Não foi possível salvar. Tente de novo.")}`);
  }

  redirect("/comecar/crianca");
}
