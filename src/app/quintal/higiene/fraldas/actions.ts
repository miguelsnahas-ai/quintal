"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionCaregiver, canAccessChild, type SessionCaregiver } from "@/lib/authorization";
import { createDiaperProfile, addDiaperStock, updateDiaperStockQuantity, deleteDiaperStock } from "@/lib/hygiene";
import { diaperProfileInputSchema, diaperStockInputSchema } from "@/lib/validation/hygiene";

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
    redirect(`/quintal/higiene/fraldas?error=${encodeURIComponent("Criança inválida.")}`);
  }
}

function revalidateFraldas() {
  revalidatePath("/quintal/higiene/fraldas");
  revalidatePath("/quintal/higiene");
}

export async function createDiaperProfileAction(formData: FormData) {
  const session = await requireSession();

  const parsed = diaperProfileInputSchema.safeParse({
    child_id: formData.get("child_id"),
    brand: formData.get("brand"),
    model: formData.get("model"),
    size: formData.get("size"),
    started_at: formData.get("started_at"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    redirect(`/quintal/higiene/fraldas?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  await assertChildAccess(parsed.data.child_id, session.caregiverId);

  try {
    await createDiaperProfile({
      childId: parsed.data.child_id,
      brand: parsed.data.brand?.trim() || null,
      model: parsed.data.model?.trim() || null,
      size: parsed.data.size?.trim() || null,
      startedAt: parsed.data.started_at,
      notes: parsed.data.notes?.trim() || null,
    });
  } catch {
    redirect(`/quintal/higiene/fraldas?error=${encodeURIComponent("Não foi possível salvar a fralda.")}`);
  }

  revalidateFraldas();
  redirect("/quintal/higiene/fraldas?success=1");
}

export async function addDiaperStockAction(formData: FormData) {
  const session = await requireSession();

  const parsed = diaperStockInputSchema.safeParse({
    child_id: formData.get("child_id"),
    brand: formData.get("brand"),
    model: formData.get("model"),
    size: formData.get("size"),
    quantity: formData.get("quantity"),
  });

  if (!parsed.success) {
    redirect(`/quintal/higiene/fraldas?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  await assertChildAccess(parsed.data.child_id, session.caregiverId);

  try {
    await addDiaperStock({
      childId: parsed.data.child_id,
      brand: parsed.data.brand?.trim() || null,
      model: parsed.data.model?.trim() || null,
      size: parsed.data.size?.trim() || null,
      quantity: parsed.data.quantity,
    });
  } catch {
    redirect(`/quintal/higiene/fraldas?error=${encodeURIComponent("Não foi possível salvar o estoque.")}`);
  }

  revalidateFraldas();
  redirect("/quintal/higiene/fraldas?success=1");
}

export async function updateDiaperStockAction(formData: FormData) {
  const session = await requireSession();

  const childId = formData.get("child_id");
  const id = formData.get("stock_id");
  const quantity = formData.get("quantity");

  if (typeof childId !== "string" || typeof id !== "string" || typeof quantity !== "string") {
    redirect(`/quintal/higiene/fraldas?error=${encodeURIComponent("Dados inválidos.")}`);
  }

  await assertChildAccess(childId, session.caregiverId);

  const parsedQuantity = Number(quantity);
  if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
    redirect(`/quintal/higiene/fraldas?error=${encodeURIComponent("Quantidade inválida.")}`);
  }

  try {
    await updateDiaperStockQuantity({ id, childId, quantity: parsedQuantity });
  } catch {
    redirect(`/quintal/higiene/fraldas?error=${encodeURIComponent("Não foi possível atualizar o estoque.")}`);
  }

  revalidateFraldas();
  redirect("/quintal/higiene/fraldas?success=1");
}

export async function deleteDiaperStockAction(formData: FormData) {
  const session = await requireSession();

  const childId = formData.get("child_id");
  const id = formData.get("stock_id");

  if (typeof childId !== "string" || typeof id !== "string") {
    redirect(`/quintal/higiene/fraldas?error=${encodeURIComponent("Dados inválidos.")}`);
  }

  await assertChildAccess(childId, session.caregiverId);

  try {
    await deleteDiaperStock(id, childId);
  } catch {
    redirect(`/quintal/higiene/fraldas?error=${encodeURIComponent("Não foi possível remover.")}`);
  }

  revalidateFraldas();
  redirect("/quintal/higiene/fraldas?success=1");
}
