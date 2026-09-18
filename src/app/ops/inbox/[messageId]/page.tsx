import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ageLabel, toDatetimeLocalValue } from "@/lib/format";
import { eventTypeLabels, eventTypes } from "@/lib/validation/events";
import { createEventFromMessage } from "./actions";

export default async function TriageMessagePage({
  params,
  searchParams,
}: {
  params: Promise<{ messageId: string }>;
  searchParams: Promise<{ child_id?: string; error?: string }>;
}) {
  const { messageId } = await params;
  const { child_id: requestedChildId, error } = await searchParams;
  const supabase = await createClient();

  const { data: message } = await supabase
    .from("messages")
    .select(
      "id, from_phone_number, message_type, body, wa_timestamp, handled_at, family_id, families(name)",
    )
    .eq("id", messageId)
    .maybeSingle();

  if (!message) {
    notFound();
  }

  const { data: children } = message.family_id
    ? await supabase
        .from("children")
        .select("id, name, birth_date")
        .eq("family_id", message.family_id)
        .order("created_at", { ascending: true })
    : { data: null };

  const selectedChild =
    children?.find((child) => child.id === requestedChildId) ?? children?.[0] ?? null;

  const { data: events } = selectedChild
    ? await supabase
        .from("events")
        .select("id, type, occurred_at, notes")
        .eq("child_id", selectedChild.id)
        .order("occurred_at", { ascending: false })
        .limit(20)
    : { data: null };

  const messageDateTime = message.wa_timestamp
    ? toDatetimeLocalValue(new Date(message.wa_timestamp))
    : toDatetimeLocalValue(new Date());

  return (
    <div className="space-y-6">
      <div>
        <Link href="/ops/inbox" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Inbox
        </Link>
        <h1 className="text-lg font-semibold text-neutral-900">Triar mensagem</h1>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="rounded-md border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-neutral-900">
            {message.families?.name ?? "Família não identificada"}
          </span>
          <span className="text-neutral-500">{message.from_phone_number}</span>
        </div>
        <p className="mt-2 text-sm text-neutral-800">
          {message.message_type === "text"
            ? message.body
            : `[mensagem de mídia: ${message.message_type}]`}
        </p>
      </div>

      {!message.family_id ? (
        <p className="text-sm text-neutral-600">
          Esta mensagem ainda não está vinculada a uma família.{" "}
          <Link href="/ops/inbox" className="underline hover:text-neutral-900">
            Volte para a inbox
          </Link>{" "}
          e vincule antes de registrar um evento.
        </p>
      ) : !children || children.length === 0 ? (
        <p className="text-sm text-neutral-600">
          Esta família ainda não tem crianças cadastradas.{" "}
          <Link
            href={`/ops/families/${message.family_id}`}
            className="underline hover:text-neutral-900"
          >
            Cadastre uma criança
          </Link>{" "}
          antes de registrar um evento.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="space-y-3">
            {children.length > 1 && (
              <div className="flex flex-wrap gap-2 text-sm">
                {children.map((child) => (
                  <Link
                    key={child.id}
                    href={`/ops/inbox/${messageId}?child_id=${child.id}`}
                    className={`rounded-full px-3 py-1 ${
                      selectedChild?.id === child.id
                        ? "bg-neutral-900 text-white"
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                    }`}
                  >
                    {child.name}
                  </Link>
                ))}
              </div>
            )}

            <form
              action={createEventFromMessage}
              className="space-y-3 rounded-md border border-neutral-200 bg-white p-4"
            >
              <input type="hidden" name="message_id" value={message.id} />
              <input type="hidden" name="child_id" value={selectedChild!.id} />

              <div className="space-y-1">
                <label className="text-sm font-medium text-neutral-700">Tipo</label>
                <select
                  name="type"
                  required
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
                >
                  {eventTypes.map((type) => (
                    <option key={type} value={type}>
                      {eventTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-neutral-700">Quando</label>
                <input
                  type="datetime-local"
                  name="occurred_at"
                  required
                  defaultValue={messageDateTime}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-neutral-700">Notas</label>
                <textarea
                  name="notes"
                  required
                  rows={4}
                  defaultValue={message.message_type === "text" ? (message.body ?? "") : ""}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
                />
              </div>

              <button
                type="submit"
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Registrar e marcar como tratada
              </button>
            </form>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-neutral-700">
              Contexto de {selectedChild?.name}
              {ageLabel(selectedChild?.birth_date ?? null) && (
                <span className="ml-2 font-normal text-neutral-500">
                  {ageLabel(selectedChild?.birth_date ?? null)}
                </span>
              )}
            </h2>
            {!events || events.length === 0 ? (
              <p className="text-sm text-neutral-500">Nenhum evento registrado ainda.</p>
            ) : (
              <ul className="space-y-2">
                {events.map((event) => (
                  <li
                    key={event.id}
                    className="space-y-1 rounded-md border border-neutral-200 bg-white p-3"
                  >
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-700">
                        {eventTypeLabels[event.type as keyof typeof eventTypeLabels] ??
                          event.type}
                      </span>
                      <span>{new Date(event.occurred_at).toLocaleString("pt-BR")}</span>
                    </div>
                    <p className="text-sm text-neutral-800">{event.notes}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
