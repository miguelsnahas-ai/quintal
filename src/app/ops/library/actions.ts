"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createLibraryItem, updateLibraryItem, archiveLibraryItem } from "@/lib/ops/library";
import { libraryItemInputSchema } from "@/lib/validation/ops";

async function requireOperator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
}

function parseLibraryForm(formData: FormData) {
  return libraryItemInputSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    content: formData.get("content"),
    tags: formData.get("tags"),
    age_min_months: formData.get("age_min_months"),
    age_max_months: formData.get("age_max_months"),
    image_url: formData.get("image_url"),
    status: formData.get("status"),
  });
}

export async function createLibraryItemAction(formData: FormData) {
  await requireOperator();

  const parsed = parseLibraryForm(formData);
  if (!parsed.success) {
    redirect(`/ops/library/new?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  let id: string;
  try {
    id = (
      await createLibraryItem({
        title: parsed.data.title,
        category: parsed.data.category,
        content: parsed.data.content,
        tags: parsed.data.tags,
        ageMinMonths: parsed.data.age_min_months,
        ageMaxMonths: parsed.data.age_max_months,
        imageUrl: parsed.data.image_url,
        status: parsed.data.status,
      })
    ).id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível criar.";
    redirect(`/ops/library/new?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/ops/library");
  redirect(`/ops/library/${id}?success=1`);
}

export async function updateLibraryItemAction(formData: FormData) {
  await requireOperator();

  const id = String(formData.get("id") ?? "");
  const parsed = parseLibraryForm(formData);
  if (!parsed.success) {
    redirect(`/ops/library/${id}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  try {
    await updateLibraryItem(id, {
      title: parsed.data.title,
      category: parsed.data.category,
      content: parsed.data.content,
      tags: parsed.data.tags,
      ageMinMonths: parsed.data.age_min_months,
      ageMaxMonths: parsed.data.age_max_months,
      imageUrl: parsed.data.image_url,
      status: parsed.data.status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível salvar.";
    redirect(`/ops/library/${id}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/ops/library/${id}`);
  revalidatePath("/ops/library");
  redirect(`/ops/library/${id}?success=1`);
}

export async function archiveLibraryItemAction(formData: FormData) {
  await requireOperator();

  const id = String(formData.get("id") ?? "");
  try {
    await archiveLibraryItem(id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível arquivar.";
    redirect(`/ops/library/${id}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/ops/library/${id}`);
  revalidatePath("/ops/library");
  redirect(`/ops/library/${id}?success=1`);
}
