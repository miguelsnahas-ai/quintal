"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionCaregiver, canAccessChild, type SessionCaregiver } from "@/lib/authorization";
import { createServiceClient } from "@/lib/supabase/service";
import { recordMealEvent, updateChildFeedingMethod } from "@/lib/feeding";
import { mealLogInputSchema, feedingMethodInputSchema } from "@/lib/validation/feeding";

// Camada de autorização centralizada (Fase 16) — ver src/lib/authorization.ts.
async function requireSession(): Promise<SessionCaregiver> {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }
  return session;
}

async function assertChildAccess(childId: string, caregiverId: string): Promise<void> {
  const allowed = await canAccessChild(caregiverId, childId);
  if (!allowed) {
    redirect(`/quintal/alimentacao?error=${encodeURIComponent("Criança inválida.")}`);
  }
}

export async function logMeal(formData: FormData) {
  const session = await requireSession();

  const parsed = mealLogInputSchema.safeParse({
    child_id: formData.get("child_id"),
    slot: formData.get("slot"),
    occurred_at: formData.get("occurred_at"),
    foods: formData.get("foods"),
    acceptance: formData.get("acceptance"),
    notes: formData.get("notes"),
    suggestion_id: formData.get("suggestion_id"),
  });

  if (!parsed.success) {
    redirect(`/quintal/alimentacao?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  await assertChildAccess(parsed.data.child_id, session.caregiverId);

  // The meal's offeringMethodId is a snapshot of the child's *current*
  // configured method, not asked again on every quick log — see
  // recordMealEvent's own reasoning in src/lib/feeding.ts.
  const supabase = createServiceClient();
  const { data: child } = await supabase
    .from("children")
    .select("feeding_method_id")
    .eq("id", parsed.data.child_id)
    .maybeSingle();

  try {
    await recordMealEvent({
      childId: parsed.data.child_id,
      occurredAt: new Date(parsed.data.occurred_at).toISOString(),
      slot: parsed.data.slot,
      foods: parsed.data.foods,
      acceptance: parsed.data.acceptance,
      notes: parsed.data.notes?.trim() || null,
      offeringMethodId: child?.feeding_method_id ?? null,
      suggestionId: parsed.data.suggestion_id?.trim() || null,
      origin: "manual",
      caregiverId: session.caregiverId,
    });
  } catch {
    redirect(`/quintal/alimentacao?error=${encodeURIComponent("Não foi possível registrar. Tente de novo.")}`);
  }

  revalidatePath("/quintal/alimentacao");
  revalidatePath("/quintal");
  redirect("/quintal/alimentacao?success=1");
}

export async function saveFeedingMethod(formData: FormData) {
  const session = await requireSession();

  const parsed = feedingMethodInputSchema.safeParse({
    child_id: formData.get("child_id"),
    method_id: formData.get("method_id"),
    method_custom: formData.get("method_custom"),
  });

  if (!parsed.success) {
    redirect(`/quintal/alimentacao?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  await assertChildAccess(parsed.data.child_id, session.caregiverId);

  try {
    await updateChildFeedingMethod(parsed.data.child_id, {
      methodId: parsed.data.method_id?.trim() || null,
      methodCustom: parsed.data.method_custom?.trim() || null,
    });
  } catch {
    redirect(`/quintal/alimentacao?error=${encodeURIComponent("Não foi possível salvar. Tente de novo.")}`);
  }

  revalidatePath("/quintal/alimentacao");
  redirect("/quintal/alimentacao?success=1#metodo");
}
