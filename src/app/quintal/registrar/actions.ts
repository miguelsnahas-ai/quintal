"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { getSessionCaregiver, canAccessChild } from "@/lib/authorization";
import { eventInputSchema } from "@/lib/validation/events";

export async function createQuickEventAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const type = String(formData.get("type") ?? "");

  const parsed = eventInputSchema.safeParse({
    child_id: formData.get("child_id"),
    type,
    occurred_at: formData.get("occurred_at"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    redirect(`/quintal/registrar?tipo=${type}&error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const allowed = await canAccessChild(session.caregiverId, parsed.data.child_id);
  if (!allowed) {
    redirect(`/quintal/registrar?tipo=${type}&error=${encodeURIComponent("Criança inválida.")}`);
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("events").insert({
    child_id: parsed.data.child_id,
    type: parsed.data.type,
    occurred_at: new Date(parsed.data.occurred_at).toISOString(),
    notes: parsed.data.notes,
    origin: "manual",
    caregiver_id: session.caregiverId,
  });

  if (error) {
    redirect(`/quintal/registrar?tipo=${type}&error=${encodeURIComponent("Não foi possível registrar. Tente de novo.")}`);
  }

  revalidatePath("/quintal/timeline");
  revalidatePath("/quintal");
  redirect("/quintal/timeline?success=1");
}
