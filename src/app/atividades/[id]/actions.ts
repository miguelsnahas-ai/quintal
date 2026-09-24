"use server";

import { createServiceClient } from "@/lib/supabase/service";

// Public by design — same tier as /atividades/[id] itself. Deliberately
// minimal: not tied to a specific family/child in this phase (the
// ActivityCard link carries no session/query params to attribute it), so
// child_id/caregiver_id stay null. Attributing feedback to a specific
// family is a natural next step once there's a reason to act on it
// per-family rather than just aggregate signal — see
// docs/PRODUCT_ROADMAP.md.
export async function submitActivityFeedback(activityId: string, helpful: boolean): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("activity_feedback").insert({
    activity_id: activityId,
    helpful,
  });

  if (error) {
    throw new Error(error.message);
  }
}
