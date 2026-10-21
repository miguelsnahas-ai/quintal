import Link from "next/link";
import { Inbox as InboxIcon, MessageSquareText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Select, FieldError } from "@/components/ui/Field";
import { linkMessageToFamily, toggleMessageHandled } from "./actions";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: messages }, { data: families }] = await Promise.all([
    supabase
      .from("messages")
      .select(
        "id, wa_message_id, from_phone_number, message_type, body, wa_timestamp, handled_at, family_id, families(name)",
      )
      .eq("direction", "inbound")
      .order("wa_timestamp", { ascending: false })
      .limit(100),
    supabase.from("families").select("id, name").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-ink">Inbox do WhatsApp</h1>
        <p className="text-sm text-ink-muted">Mensagens recebidas, mais recentes primeiro.</p>
      </div>

      <FieldError>{error}</FieldError>

      {!messages || messages.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <InboxIcon className="h-8 w-8 text-ink-muted" aria-hidden />
          <p className="text-sm text-ink-muted">Nenhuma mensagem recebida ainda.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {messages.map((message) => (
            <Card
              key={message.id}
              as="li"
              className={`space-y-2 p-4 ${message.handled_at ? "" : "border-tertiary"}`}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium text-ink">
                  {message.families?.name ?? "Família não identificada"}
                  {message.wa_message_id.startsWith("sim-") && (
                    <Badge variant="decorative">simulação</Badge>
                  )}
                </span>
                <span className="text-ink-muted">{message.from_phone_number}</span>
              </div>

              <p className="text-sm text-ink">
                {message.message_type === "text"
                  ? message.body
                  : `[mensagem de mídia: ${message.message_type}]`}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
                <span>
                  {message.wa_timestamp
                    ? new Date(message.wa_timestamp).toLocaleString("pt-BR")
                    : ""}
                </span>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/ops/inbox/${message.id}`}
                    className={buttonClassName("ghost", "px-2 py-1")}
                  >
                    <MessageSquareText className="h-4 w-4" aria-hidden />
                    Triar
                  </Link>

                  {!message.family_id && families && families.length > 0 && (
                    <form action={linkMessageToFamily} className="flex items-center gap-2">
                      <input type="hidden" name="message_id" value={message.id} />
                      <Select
                        name="family_id"
                        required
                        defaultValue=""
                        className="px-2 py-1 text-xs"
                      >
                        <option value="" disabled>
                          Vincular à família...
                        </option>
                        {families.map((family) => (
                          <option key={family.id} value={family.id}>
                            {family.name}
                          </option>
                        ))}
                      </Select>
                      <Button type="submit" variant="ghost" className="px-2 py-1">
                        Vincular
                      </Button>
                    </form>
                  )}

                  <form action={toggleMessageHandled}>
                    <input type="hidden" name="message_id" value={message.id} />
                    <input
                      type="hidden"
                      name="was_handled"
                      value={String(Boolean(message.handled_at))}
                    />
                    <Button type="submit" variant="ghost" className="px-2 py-1">
                      {message.handled_at ? "Reabrir" : "Marcar como tratada"}
                    </Button>
                  </form>
                </div>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
