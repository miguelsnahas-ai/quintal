"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getFamilySessionCaregiverId } from "@/lib/familySession";
import { createServiceClient } from "@/lib/supabase/service";
import { getTimelineEntry, updateTimelineEntry, deleteTimelineEntry } from "@/lib/timeline";
import { eventEditInputSchema } from "@/lib/validation/events";

// Mesmo padrão de resolução de sessão já usado em todo o resto de
// /quintal/*/actions.ts.
async function requireFamilyId(): Promise<string> {
  const caregiverId = await getFamilySessionCaregiverId();
  if (!caregiverId) {
    redirect("/comecar");
  }

  const supabase = createServiceClient();
  const { data: caregiver } = await supabase
    .from("caregivers")
    .select("family_id")
    .eq("id", caregiverId)
    .maybeSingle();

  if (!caregiver) {
    redirect("/comecar");
  }

  return caregiver.family_id;
}

// Defesa em profundidade: confere que o evento existe e que a criança
// dona dele pertence à família da sessão, antes de deixar editar ou
// excluir — nunca confia só no eventId vindo do formulário.
async function assertEventInFamily(eventId: string, familyId: string): Promise<string> {
  const entry = await getTimelineEntry(eventId);
  if (!entry) {
    redirect("/quintal/timeline");
  }

  const supabase = createServiceClient();
  const { data: child } = await supabase
    .from("children")
    .select("family_id")
    .eq("id", entry.childId)
    .maybeSingle();

  if (!child || child.family_id !== familyId) {
    redirect("/quintal/timeline");
  }

  return entry.childId;
}

export async function updateTimelineEntryAction(eventId: string, formData: FormData) {
  const familyId = await requireFamilyId();
  const childId = await assertEventInFamily(eventId, familyId);

  const parsed = eventEditInputSchema.safeParse({
    occurred_at: formData.get("occurred_at"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    redirect(`/quintal/timeline/${eventId}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  try {
    await updateTimelineEntry({
      eventId,
      childId,
      occurredAt: new Date(parsed.data.occurred_at).toISOString(),
      notes: parsed.data.notes,
    });
  } catch {
    redirect(`/quintal/timeline/${eventId}?error=${encodeURIComponent("Não foi possível salvar. Tente de novo.")}`);
  }

  revalidatePath("/quintal/timeline");
  revalidatePath("/quintal");
  redirect(`/quintal/timeline/${eventId}?success=1`);
}

export async function deleteTimelineEntryAction(eventId: string) {
  const familyId = await requireFamilyId();
  const childId = await assertEventInFamily(eventId, familyId);

  try {
    await deleteTimelineEntry(eventId, childId);
  } catch {
    redirect(`/quintal/timeline/${eventId}?error=${encodeURIComponent("Não foi possível excluir. Tente de novo.")}`);
  }

  revalidatePath("/quintal/timeline");
  revalidatePath("/quintal");
  redirect("/quintal/timeline?deleted=1");
}
