"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  caregiverInputSchema,
  childInputSchema,
  familyInputSchema,
} from "@/lib/validation/families";

async function requireOperator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return supabase;
}

function familyIdFrom(formData: FormData) {
  const familyId = String(formData.get("family_id") ?? "");
  if (!familyId) {
    throw new Error("family_id ausente no formulário.");
  }
  return familyId;
}

export async function updateFamily(formData: FormData) {
  const supabase = await requireOperator();
  const familyId = familyIdFrom(formData);

  const parsed = familyInputSchema.safeParse({
    name: formData.get("name"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    redirect(
      `/ops/families/${familyId}?error=${encodeURIComponent(parsed.error.issues[0].message)}`,
    );
  }

  const { error } = await supabase
    .from("families")
    .update(parsed.data)
    .eq("id", familyId);

  if (error) {
    redirect(`/ops/families/${familyId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/ops/families/${familyId}`);
  revalidatePath("/ops/families");
  redirect(`/ops/families/${familyId}`);
}

export async function addCaregiver(formData: FormData) {
  const supabase = await requireOperator();
  const familyId = familyIdFrom(formData);

  const parsed = caregiverInputSchema.safeParse({
    name: formData.get("name"),
    role: formData.get("role"),
    phone_number: formData.get("phone_number"),
    is_primary_contact: formData.get("is_primary_contact") === "on",
  });

  if (!parsed.success) {
    redirect(
      `/ops/families/${familyId}?error=${encodeURIComponent(parsed.error.issues[0].message)}`,
    );
  }

  const { error } = await supabase
    .from("caregivers")
    .insert({ ...parsed.data, family_id: familyId });

  if (error) {
    redirect(`/ops/families/${familyId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/ops/families/${familyId}`);
  redirect(`/ops/families/${familyId}`);
}

export async function deleteCaregiver(formData: FormData) {
  const supabase = await requireOperator();
  const familyId = familyIdFrom(formData);
  const caregiverId = String(formData.get("caregiver_id") ?? "");

  const { error } = await supabase
    .from("caregivers")
    .delete()
    .eq("id", caregiverId)
    .eq("family_id", familyId);

  if (error) {
    redirect(`/ops/families/${familyId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/ops/families/${familyId}`);
  redirect(`/ops/families/${familyId}`);
}

export async function addChild(formData: FormData) {
  const supabase = await requireOperator();
  const familyId = familyIdFrom(formData);

  const parsed = childInputSchema.safeParse({
    name: formData.get("name"),
    birth_date: formData.get("birth_date"),
    sex: formData.get("sex"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    redirect(
      `/ops/families/${familyId}?error=${encodeURIComponent(parsed.error.issues[0].message)}`,
    );
  }

  const { error } = await supabase
    .from("children")
    .insert({ ...parsed.data, family_id: familyId });

  if (error) {
    redirect(`/ops/families/${familyId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/ops/families/${familyId}`);
  redirect(`/ops/families/${familyId}`);
}

export async function deleteChild(formData: FormData) {
  const supabase = await requireOperator();
  const familyId = familyIdFrom(formData);
  const childId = String(formData.get("child_id") ?? "");

  const { error } = await supabase
    .from("children")
    .delete()
    .eq("id", childId)
    .eq("family_id", familyId);

  if (error) {
    redirect(`/ops/families/${familyId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/ops/families/${familyId}`);
  redirect(`/ops/families/${familyId}`);
}
