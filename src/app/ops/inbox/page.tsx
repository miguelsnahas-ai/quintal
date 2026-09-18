import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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
        "id, from_phone_number, message_type, body, wa_timestamp, handled_at, family_id, families(name)",
      )
      .order("wa_timestamp", { ascending: false })
      .limit(100),
    supabase.from("families").select("id, name").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">
          Inbox do WhatsApp
        </h1>
        <p className="text-sm text-neutral-600">
          Mensagens recebidas, mais recentes primeiro.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {!messages || messages.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Nenhuma mensagem recebida ainda.
        </p>
      ) : (
        <ul className="space-y-3">
          {messages.map((message) => (
            <li
              key={message.id}
              className={`space-y-2 rounded-md border bg-white p-4 ${
                message.handled_at ? "border-neutral-200" : "border-neutral-300"
              }`}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-neutral-900">
                  {message.families?.name ?? "Família não identificada"}
                </span>
                <span className="text-neutral-500">{message.from_phone_number}</span>
              </div>

              <p className="text-sm text-neutral-800">
                {message.message_type === "text"
                  ? message.body
                  : `[mensagem de mídia: ${message.message_type}]`}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                <span>
                  {message.wa_timestamp
                    ? new Date(message.wa_timestamp).toLocaleString("pt-BR")
                    : ""}
                </span>

                <div className="flex items-center gap-3">
                  <Link
                    href={`/ops/inbox/${message.id}`}
                    className="text-neutral-600 hover:text-neutral-900"
                  >
                    Triar
                  </Link>

                  {!message.family_id && families && families.length > 0 && (
                    <form action={linkMessageToFamily} className="flex items-center gap-2">
                      <input type="hidden" name="message_id" value={message.id} />
                      <select
                        name="family_id"
                        required
                        defaultValue=""
                        className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-700"
                      >
                        <option value="" disabled>
                          Vincular à família...
                        </option>
                        {families.map((family) => (
                          <option key={family.id} value={family.id}>
                            {family.name}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="text-neutral-600 hover:text-neutral-900">
                        Vincular
                      </button>
                    </form>
                  )}

                  <form action={toggleMessageHandled}>
                    <input type="hidden" name="message_id" value={message.id} />
                    <input
                      type="hidden"
                      name="was_handled"
                      value={String(Boolean(message.handled_at))}
                    />
                    <button type="submit" className="text-neutral-600 hover:text-neutral-900">
                      {message.handled_at ? "Reabrir" : "Marcar como tratada"}
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
