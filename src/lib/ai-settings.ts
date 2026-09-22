import { createServiceClient } from "@/lib/supabase/service";

const AI_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

export async function getCustomInstructions(): Promise<string> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("ai_settings")
    .select("custom_instructions")
    .eq("id", AI_SETTINGS_ID)
    .maybeSingle();

  return data?.custom_instructions ?? "";
}

export async function setCustomInstructions(
  customInstructions: string,
  updatedBy: string | null,
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("ai_settings")
    .update({
      custom_instructions: customInstructions,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    })
    .eq("id", AI_SETTINGS_ID);

  if (error) {
    throw new Error(error.message);
  }
}
