"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionCaregiver, canAccessChild, type SessionCaregiver } from "@/lib/authorization";
import { recordDiaperChange } from "@/lib/hygiene";
import { diaperChangeInputSchema } from "@/lib/validation/hygiene";

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
    redirect(`/quintal/higiene/registrar?error=${encodeURIComponent("Criança inválida.")}`);
  }
}

// Higiene/Histórico e a Home (Últimos registros) todos leem desses
// mesmos eventos — mesmo padrão de revalidateSono (Sono/registrar/actions.ts).
function revalidateHigiene() {
  revalidatePath("/quintal/higiene");
  revalidatePath("/quintal/higiene/historico");
  revalidatePath("/quintal");
  revalidatePath("/quintal/timeline");
}

export async function recordDiaperChangeAction(formData: FormData) {
  const session = await requireSession();

  const parsed = diaperChangeInputSchema.safeParse({
    child_id: formData.get("child_id"),
    diaper_result: formData.get("diaper_result"),
    condition: formData.get("condition"),
    skin_condition: formData.get("skin_condition"),
    occurred_at: formData.get("occurred_at"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    redirect(`/quintal/higiene/registrar?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  await assertChildAccess(parsed.data.child_id, session.caregiverId);

  try {
    await recordDiaperChange({
      childId: parsed.data.child_id,
      diaperResult: parsed.data.diaper_result,
      condition: parsed.data.condition,
      skinCondition: parsed.data.skin_condition,
      occurredAt: new Date(parsed.data.occurred_at).toISOString(),
      notes: parsed.data.notes?.trim() || null,
      origin: "manual",
      caregiverId: session.caregiverId,
    });
  } catch {
    redirect(`/quintal/higiene/registrar?error=${encodeURIComponent("Não foi possível registrar. Tente de novo.")}`);
  }

  revalidateHigiene();
  redirect("/quintal/higiene?success=1");
}
