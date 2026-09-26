import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { getFamilySessionCaregiverId } from "@/lib/familySession";
import { ageLabel } from "@/lib/format";
import ConversationChat, {
  type ConversationTurn,
} from "@/components/conversation/ConversationChat";
import ChildHeader from "@/components/conversation/ChildHeader";
import { sendQuintalMessage, sendQuintalRecommendationFeedback } from "./actions";

export const metadata: Metadata = {
  title: "Quintal",
  robots: { index: false, follow: false },
};

export default async function QuintalPage() {
  const caregiverId = await getFamilySessionCaregiverId();
  if (!caregiverId) {
    redirect("/comecar");
  }

  const supabase = createServiceClient();

  const { data: caregiver } = await supabase
    .from("caregivers")
    .select("id, family_id")
    .eq("id", caregiverId)
    .maybeSingle();

  // Session points at a caregiver that no longer exists (e.g. removed by
  // an operator) — treat it the same as "no session".
  if (!caregiver) {
    redirect("/comecar");
  }

  const [{ data: childrenList }, { data: recentMessagesRaw }] = await Promise.all([
    supabase
      .from("children")
      .select("id, name, birth_date")
      .eq("family_id", caregiver.family_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("messages")
      .select("direction, body")
      .eq("caregiver_id", caregiverId)
      .not("body", "is", null)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const primaryChild = childrenList?.[0] ?? null;

  const { count: eventCount } = primaryChild
    ? await supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("child_id", primaryChild.id)
    : { count: 0 };

  const initialMessages: ConversationTurn[] = (recentMessagesRaw ?? [])
    .slice()
    .reverse()
    .map((message) => ({
      role: message.direction === "inbound" ? "user" : "assistant",
      content: message.body!,
    }));

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-4 py-6">
      <ChildHeader
        childName={primaryChild?.name ?? null}
        ageLabel={primaryChild ? ageLabel(primaryChild.birth_date) : null}
        eventCount={eventCount ?? 0}
      />
      <ConversationChat
        caregiverId={caregiverId}
        childrenList={childrenList ?? []}
        initialMessages={initialMessages}
        onSend={sendQuintalMessage}
        onFeedback={sendQuintalRecommendationFeedback}
      />
    </div>
  );
}
