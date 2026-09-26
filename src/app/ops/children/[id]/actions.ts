"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { eventInputSchema } from "@/lib/validation/events";

export async function createEvent(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const childId = String(formData.get("child_id") ?? "");

  const parsed = eventInputSchema.safeParse({
    child_id: childId,
    type: formData.get("type"),
    occurred_at: formData.get("occurred_at"),
    notes: formData.get("notes"),
    duration_minutes: formData.get("duration_minutes"),
  });

  if (!parsed.success) {
    redirect(
      `/ops/children/${childId}?error=${encodeURIComponent(parsed.error.issues[0].message)}`,
    );
  }

  // A operadora digitou isso direto no formulário — nenhuma mensagem
  // envolvida, então "manual" (Fase 8) é o origin correto aqui.
  const { error } = await supabase.from("events").insert({
    child_id: parsed.data.child_id,
    type: parsed.data.type,
    notes: parsed.data.notes,
    occurred_at: new Date(parsed.data.occurred_at).toISOString(),
    duration_minutes: parsed.data.duration_minutes,
    origin: "manual",
    created_by: user.id,
  });

  if (error) {
    redirect(`/ops/children/${childId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/ops/children/${childId}`);
  redirect(`/ops/children/${childId}`);
}
