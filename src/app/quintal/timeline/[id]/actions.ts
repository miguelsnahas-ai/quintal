"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionCaregiver, canAccessChild, type SessionCaregiver } from "@/lib/authorization";
import { getTimelineEntry, updateTimelineEntry, deleteTimelineEntry } from "@/lib/timeline";
import { eventEditInputSchema } from "@/lib/validation/events";

// Camada de autorização centralizada (Fase 16) — ver src/lib/authorization.ts.
async function requireSession(): Promise<SessionCaregiver> {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }
  return session;
}

// Defesa em profundidade: confere que o evento existe e que o cuidador da
// sessão tem acesso à criança dona dele, antes de deixar editar ou
// excluir — nunca confia só no eventId vindo do formulário.
async function assertEventAccess(eventId: string, caregiverId: string): Promise<string> {
  const entry = await getTimelineEntry(eventId);
  if (!entry) {
    redirect("/quintal/timeline");
  }

  const allowed = await canAccessChild(caregiverId, entry.childId);
  if (!allowed) {
    redirect("/quintal/timeline");
  }

  return entry.childId;
}

export async function updateTimelineEntryAction(eventId: string, formData: FormData) {
  const session = await requireSession();
  const childId = await assertEventAccess(eventId, session.caregiverId);

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
  const session = await requireSession();
  const childId = await assertEventAccess(eventId, session.caregiverId);

  try {
    await deleteTimelineEntry(eventId, childId);
  } catch {
    redirect(`/quintal/timeline/${eventId}?error=${encodeURIComponent("Não foi possível excluir. Tente de novo.")}`);
  }

  revalidatePath("/quintal/timeline");
  revalidatePath("/quintal");
  redirect("/quintal/timeline?deleted=1");
}
