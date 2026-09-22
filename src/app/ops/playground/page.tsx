import { createClient } from "@/lib/supabase/server";
import PlaygroundChat from "./PlaygroundChat";

export default async function PlaygroundPage() {
  const supabase = await createClient();

  const [{ data: caregivers }, { data: childrenList }] = await Promise.all([
    supabase
      .from("caregivers")
      .select("id, name, phone_number, family_id, families(name)")
      .order("family_id", { ascending: true }),
    supabase
      .from("children")
      .select("id, name, family_id")
      .order("name", { ascending: true }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-ink">Chat de teste</h1>
        <p className="text-sm text-ink-muted">
          Escolha um cuidador (e opcionalmente uma criança, para dar contexto
          real à IA) — cada mensagem aqui vira um registro de verdade no
          histórico dessa família, igual a uma conversa real do WhatsApp.
        </p>
      </div>

      <PlaygroundChat caregivers={caregivers ?? []} childrenList={childrenList ?? []} />
    </div>
  );
}
