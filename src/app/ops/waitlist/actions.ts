"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { updateLeadStatus, convertLeadToFamily } from "@/lib/ops/leads";
import { leadStatusInputSchema } from "@/lib/validation/ops";

async function requireOperator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
}

export async function saveLeadStatusAction(formData: FormData) {
  await requireOperator();

  const leadId = String(formData.get("lead_id") ?? "");
  const parsed = leadStatusInputSchema.safeParse({
    lead_id: leadId,
    status: formData.get("status"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    redirect(`/ops/waitlist/${leadId}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  try {
    await updateLeadStatus(parsed.data.lead_id, { status: parsed.data.status, notes: parsed.data.notes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível salvar.";
    redirect(`/ops/waitlist/${leadId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/ops/waitlist/${leadId}`);
  revalidatePath("/ops/waitlist");
  revalidatePath("/ops");
  redirect(`/ops/waitlist/${leadId}?success=1`);
}

export async function convertLeadAction(formData: FormData) {
  await requireOperator();

  const leadId = String(formData.get("lead_id") ?? "");
  let familyId: string;

  try {
    familyId = (await convertLeadToFamily(leadId)).familyId;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível converter.";
    redirect(`/ops/waitlist/${leadId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/ops/waitlist/${leadId}`);
  revalidatePath("/ops/waitlist");
  revalidatePath("/ops/families");
  revalidatePath("/ops");
  redirect(`/ops/families/${familyId}?converted=1`);
}
