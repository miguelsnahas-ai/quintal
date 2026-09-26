import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import ConversationChat from "@/components/conversation/ConversationChat";
import { sendTestMessage, sendTestRecommendationFeedback } from "./actions";

export const metadata: Metadata = {
  title: "Converse com o Quintal",
  robots: { index: false, follow: false },
};

export default async function TestChatPage({
  params,
}: {
  params: Promise<{ caregiverId: string }>;
}) {
  const { caregiverId } = await params;
  const supabase = createServiceClient();

  const { data: caregiver } = await supabase
    .from("caregivers")
    .select("id, name, family_id, families(name)")
    .eq("id", caregiverId)
    .maybeSingle();

  if (!caregiver) {
    notFound();
  }

  const { data: childrenList } = await supabase
    .from("children")
    .select("id, name")
    .eq("family_id", caregiver.family_id)
    .order("name", { ascending: true });

  const handleSend = sendTestMessage.bind(null, caregiver.id);

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-4 py-6">
      <div className="mb-4 space-y-1">
        <h1 className="text-lg font-bold text-ink">Converse com o Quintal</h1>
        <p className="text-sm text-ink-muted">
          Oi, {caregiver.name}! Mande uma mensagem como se estivesse falando
          no WhatsApp sobre a rotina do seu filho — é só um teste, mas a
          conversa fica salva para a equipe do Quintal revisar.
        </p>
      </div>
      <ConversationChat
        caregiverId={caregiver.id}
        childrenList={childrenList ?? []}
        onSend={handleSend}
        onFeedback={sendTestRecommendationFeedback}
        rememberDevice
      />
    </div>
  );
}
