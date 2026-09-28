"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getFamilySessionCaregiverId } from "@/lib/familySession";
import { createServiceClient } from "@/lib/supabase/service";
import { startSleep, endSleep, recordSleepPeriod, getOpenSleepSession } from "@/lib/sleep";
import { sleepStartInputSchema, sleepEndInputSchema, sleepPeriodInputSchema } from "@/lib/validation/sleep";

// Mesmo padrão de resolução de sessão e posse já usado em
// /quintal/alimentacao/actions.ts (Fase 9).
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

async function assertChildInFamily(childId: string, familyId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: child } = await supabase
    .from("children")
    .select("family_id")
    .eq("id", childId)
    .maybeSingle();

  if (!child || child.family_id !== familyId) {
    redirect(`/quintal/sono?error=${encodeURIComponent("Criança inválida.")}`);
  }
}

function revalidateSono() {
  revalidatePath("/quintal/sono");
  revalidatePath("/quintal");
}

export async function startSleepAction(formData: FormData) {
  const familyId = await requireFamilyId();

  const parsed = sleepStartInputSchema.safeParse({
    child_id: formData.get("child_id"),
    sleep_type: formData.get("sleep_type"),
    started_at: formData.get("started_at"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    redirect(`/quintal/sono?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  await assertChildInFamily(parsed.data.child_id, familyId);

  // Nunca dois períodos em aberto ao mesmo tempo — se já existe um, a
  // família precisa registrar que a criança acordou primeiro.
  const existingOpen = await getOpenSleepSession(parsed.data.child_id);
  if (existingOpen) {
    redirect(
      `/quintal/sono?error=${encodeURIComponent("Já existe um sono em andamento. Registre que a criança acordou antes de começar outro.")}`,
    );
  }

  try {
    await startSleep({
      childId: parsed.data.child_id,
      sleepType: parsed.data.sleep_type,
      startedAt: new Date(parsed.data.started_at).toISOString(),
      notes: parsed.data.notes?.trim() || null,
      origin: "manual",
    });
  } catch {
    redirect(`/quintal/sono?error=${encodeURIComponent("Não foi possível registrar. Tente de novo.")}`);
  }

  revalidateSono();
  redirect("/quintal/sono?success=1");
}

export async function endSleepAction(formData: FormData) {
  const familyId = await requireFamilyId();

  const parsed = sleepEndInputSchema.safeParse({
    child_id: formData.get("child_id"),
    event_id: formData.get("event_id"),
    ended_at: formData.get("ended_at"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    redirect(`/quintal/sono?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  await assertChildInFamily(parsed.data.child_id, familyId);

  try {
    await endSleep({
      eventId: parsed.data.event_id,
      childId: parsed.data.child_id,
      endedAt: new Date(parsed.data.ended_at).toISOString(),
      notes: parsed.data.notes?.trim() || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível registrar. Tente de novo.";
    redirect(`/quintal/sono?error=${encodeURIComponent(message)}`);
  }

  revalidateSono();
  redirect("/quintal/sono?success=1");
}

export async function recordSleepPeriodAction(formData: FormData) {
  const familyId = await requireFamilyId();

  const parsed = sleepPeriodInputSchema.safeParse({
    child_id: formData.get("child_id"),
    sleep_type: formData.get("sleep_type"),
    started_at: formData.get("started_at"),
    ended_at: formData.get("ended_at"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    redirect(`/quintal/sono?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  await assertChildInFamily(parsed.data.child_id, familyId);

  try {
    await recordSleepPeriod({
      childId: parsed.data.child_id,
      sleepType: parsed.data.sleep_type,
      startedAt: new Date(parsed.data.started_at).toISOString(),
      endedAt: new Date(parsed.data.ended_at).toISOString(),
      notes: parsed.data.notes?.trim() || null,
      origin: "manual",
    });
  } catch {
    redirect(`/quintal/sono?error=${encodeURIComponent("Não foi possível registrar. Tente de novo.")}`);
  }

  revalidateSono();
  redirect("/quintal/sono?success=1");
}
