"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionCaregiver, canAccessChild, type SessionCaregiver } from "@/lib/authorization";
import { startSleep, endSleep, recordSleepPeriod, getOpenSleepSession } from "@/lib/sleep";
import { sleepStartInputSchema, sleepEndInputSchema, sleepPeriodInputSchema } from "@/lib/validation/sleep";

// Camada de autorização centralizada (Fase 16) — ver src/lib/authorization.ts.
// Substitui o par requireFamilyId()/assertChildInFamily() que cada
// actions.ts de /quintal/* reimplementava à mão.
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
    redirect(`/quintal/sono/registrar?error=${encodeURIComponent("Criança inválida.")}`);
  }
}

// Sono/Histórico/Análises e a Home todos leem desses mesmos eventos —
// revalida os quatro, não só a tela de onde o registro partiu.
function revalidateSono() {
  revalidatePath("/quintal/sono");
  revalidatePath("/quintal/sono/historico");
  revalidatePath("/quintal/sono/analises");
  revalidatePath("/quintal");
}

export async function startSleepAction(formData: FormData) {
  const session = await requireSession();

  const parsed = sleepStartInputSchema.safeParse({
    child_id: formData.get("child_id"),
    sleep_type: formData.get("sleep_type"),
    started_at: formData.get("started_at"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    redirect(`/quintal/sono/registrar?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  await assertChildAccess(parsed.data.child_id, session.caregiverId);

  // Nunca dois períodos em aberto ao mesmo tempo — se já existe um, a
  // família precisa registrar que a criança acordou primeiro.
  const existingOpen = await getOpenSleepSession(parsed.data.child_id);
  if (existingOpen) {
    redirect(
      `/quintal/sono/registrar?error=${encodeURIComponent("Já existe um sono em andamento. Registre que a criança acordou antes de começar outro.")}`,
    );
  }

  try {
    await startSleep({
      childId: parsed.data.child_id,
      sleepType: parsed.data.sleep_type,
      startedAt: new Date(parsed.data.started_at).toISOString(),
      notes: parsed.data.notes?.trim() || null,
      origin: "manual",
      caregiverId: session.caregiverId,
    });
  } catch {
    redirect(`/quintal/sono/registrar?error=${encodeURIComponent("Não foi possível registrar. Tente de novo.")}`);
  }

  revalidateSono();
  redirect("/quintal/sono?success=1");
}

export async function endSleepAction(formData: FormData) {
  const session = await requireSession();

  const parsed = sleepEndInputSchema.safeParse({
    child_id: formData.get("child_id"),
    event_id: formData.get("event_id"),
    ended_at: formData.get("ended_at"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    redirect(`/quintal/sono/registrar?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  await assertChildAccess(parsed.data.child_id, session.caregiverId);

  try {
    await endSleep({
      eventId: parsed.data.event_id,
      childId: parsed.data.child_id,
      endedAt: new Date(parsed.data.ended_at).toISOString(),
      notes: parsed.data.notes?.trim() || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível registrar. Tente de novo.";
    redirect(`/quintal/sono/registrar?error=${encodeURIComponent(message)}`);
  }

  revalidateSono();
  redirect("/quintal/sono?success=1");
}

export async function recordSleepPeriodAction(formData: FormData) {
  const session = await requireSession();

  const parsed = sleepPeriodInputSchema.safeParse({
    child_id: formData.get("child_id"),
    sleep_type: formData.get("sleep_type"),
    started_at: formData.get("started_at"),
    ended_at: formData.get("ended_at"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    redirect(`/quintal/sono/registrar?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  await assertChildAccess(parsed.data.child_id, session.caregiverId);

  try {
    await recordSleepPeriod({
      childId: parsed.data.child_id,
      sleepType: parsed.data.sleep_type,
      startedAt: new Date(parsed.data.started_at).toISOString(),
      endedAt: new Date(parsed.data.ended_at).toISOString(),
      notes: parsed.data.notes?.trim() || null,
      origin: "manual",
      caregiverId: session.caregiverId,
    });
  } catch {
    redirect(`/quintal/sono/registrar?error=${encodeURIComponent("Não foi possível registrar. Tente de novo.")}`);
  }

  revalidateSono();
  redirect("/quintal/sono?success=1");
}
