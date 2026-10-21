"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setCustomInstructions } from "@/lib/ai-settings";

// Movida de /ops/playground/monitor/[caregiverId]/actions.ts (refatoração
// do /ops) — mesma função (setCustomInstructions, ai-settings.ts), só
// numa área própria de configurações em vez de dentro da tela de "chat de
// teste" que esta fase remove.
export async function updateCustomInstructionsAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const customInstructions = String(formData.get("custom_instructions") ?? "");
  await setCustomInstructions(customInstructions, user.id);

  revalidatePath("/ops/settings");
  redirect("/ops/settings?success=1");
}
