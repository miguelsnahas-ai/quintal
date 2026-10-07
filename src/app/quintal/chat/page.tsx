import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { getSessionCaregiver } from "@/lib/authorization";
import { getActiveChildContext } from "@/lib/activeChild";
import ConversationChat, {
  type ConversationTurn,
} from "@/components/conversation/ConversationChat";
import { sendQuintalMessage, sendQuintalRecommendationFeedback } from "./actions";

export const metadata: Metadata = {
  title: "Conversar — Quintal",
  robots: { index: false, follow: false },
};

// Aba primária da navegação (Hoje/Chat/Registrar/Timeline/Mais) — sem
// link de volta nem cabeçalho próprio: o cabeçalho global (ChildSwitcher,
// no AppShell) já identifica a criança ativa acima desta página, e a
// barra inferior é como se chega e sai daqui, não um link "← Quintal".
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

  const initialMessages: ConversationTurn[] = (recentMessagesRaw ?? [])
    .slice()
    .reverse()
    .map((message) => ({
      role: message.direction === "inbound" ? "user" : "assistant",
      content: message.body!,
    }));

  return (
    <div className="mx-auto flex h-[calc(100dvh-9rem)] w-full max-w-lg flex-col px-4 pt-3 pb-6">
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
