"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { familyInputSchema } from "@/lib/validation/families";

export async function createFamily(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const parsed = familyInputSchema.safeParse({
    name: formData.get("name"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    redirect(
      `/ops/families?error=${encodeURIComponent(parsed.error.issues[0].message)}`,
    );
  }

  const { data, error } = await supabase
    .from("families")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) {
    redirect(`/ops/families?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/ops/families");
  redirect(`/ops/families/${data.id}`);
}
