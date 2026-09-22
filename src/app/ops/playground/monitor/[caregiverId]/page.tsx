import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCustomInstructions } from "@/lib/ai-settings";
import { getConversation } from "./actions";
import MonitorChat from "./MonitorChat";

export default async function MonitorPage({
  params,
}: {
  params: Promise<{ caregiverId: string }>;
}) {
  const { caregiverId } = await params;
  const supabase = await createClient();

  const { data: caregiver } = await supabase
    .from("caregivers")
    .select("id, name, phone_number, families(name)")
    .eq("id", caregiverId)
    .maybeSingle();

  if (!caregiver) {
    notFound();
  }

  const [messages, customInstructions] = await Promise.all([
    getConversation(caregiverId),
    getCustomInstructions(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/ops/playground" className="text-sm text-ink-muted hover:text-ink">
          ← Chat de teste
        </Link>
        <h1 className="text-lg font-bold text-ink">
          Monitorando {caregiver.name}
        </h1>
        <p className="text-sm text-ink-muted">
          {caregiver.families?.name ?? "sem família"} · {caregiver.phone_number}
          — a conversa abaixo atualiza sozinha a cada poucos segundos.
        </p>
      </div>

      <MonitorChat
        caregiverId={caregiverId}
        initialMessages={messages}
        initialCustomInstructions={customInstructions}
      />
    </div>
  );
}
