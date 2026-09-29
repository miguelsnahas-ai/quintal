import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { getSessionCaregiver } from "@/lib/authorization";
import { getActiveChildContext } from "@/lib/activeChild";
import { ageLabel } from "@/lib/format";
import ConversationChat, {
  type ConversationTurn,
} from "@/components/conversation/ConversationChat";
import ChildHeader from "@/components/conversation/ChildHeader";
import { sendQuintalMessage, sendQuintalRecommendationFeedback } from "./actions";

export const metadata: Metadata = {
  title: "Conversar — Quintal",
  robots: { index: false, follow: false },
};

// Moved here from /quintal itself when the dashboard became the family's
// entry point — same page, same ConversationChat, same actions, just a
// nested route now. /quintal (the dashboard) always keeps a way back in
// here (its header's chat button), and this page always keeps a way back
// to the dashboard (the link below) — the chat never stops being reachable.
export default async function QuintalChatPage() {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const supabase = createServiceClient();

  const [{ active: activeChild, children: childrenList }, { data: recentMessagesRaw }] = await Promise.all([
    getActiveChildContext(session.caregiverId),
    supabase
      .from("messages")
      .select("direction, body")
      .eq("caregiver_id", session.caregiverId)
      .not("body", "is", null)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const { count: eventCount } = activeChild
    ? await supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("child_id", activeChild.id)
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
      <Link href="/quintal" className="mb-2 text-sm text-ink-muted hover:text-ink">
        ← Quintal
      </Link>
      <ChildHeader
        childName={activeChild?.name ?? null}
        ageLabel={activeChild ? ageLabel(activeChild.birthDate) : null}
        eventCount={eventCount ?? 0}
      />
      <ConversationChat
        caregiverId={session.caregiverId}
        childrenList={childrenList}
        initialChildId={activeChild?.id ?? null}
        initialMessages={initialMessages}
        onSend={sendQuintalMessage}
        onFeedback={sendQuintalRecommendationFeedback}
      />
    </div>
  );
}
