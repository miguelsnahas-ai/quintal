"use server";

import { redirect } from "next/navigation";
import { getSessionCaregiver, canAccessChild } from "@/lib/authorization";
import { updateChildFeedingMethod } from "@/lib/feeding";
import { feedingMethodInputSchema } from "@/lib/validation/feeding";

export async function saveFeedingMethodStepAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const parsed = feedingMethodInputSchema.safeParse({
    child_id: formData.get("child_id"),
    method_id: formData.get("method_id"),
    method_custom: formData.get("method_custom"),
  });

  if (!parsed.success) {
    redirect(`/comecar/alimentacao?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const allowed = await canAccessChild(session.caregiverId, parsed.data.child_id);
  if (!allowed) {
    redirect(`/comecar/alimentacao?error=${encodeURIComponent("Criança inválida.")}`);
  }

  try {
    await updateChildFeedingMethod(parsed.data.child_id, {
      methodId: parsed.data.method_id?.trim() || null,
      methodCustom: parsed.data.method_custom?.trim() || null,
    });
  } catch {
    redirect(`/comecar/alimentacao?error=${encodeURIComponent("Não foi possível salvar. Tente de novo.")}`);
  }

  redirect("/comecar/integracoes");
}
