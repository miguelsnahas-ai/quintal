import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ageLabel, toDatetimeLocalValue } from "@/lib/format";
import { eventTypeLabels, eventTypes } from "@/lib/validation/events";
import { createEvent } from "./actions";

export default async function ChildDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id: childId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: child }, { data: events }] = await Promise.all([
    supabase
      .from("children")
      .select("id, name, birth_date, family_id, families(name)")
      .eq("id", childId)
      .maybeSingle(),
    supabase
      .from("events")
      .select("id, type, occurred_at, notes, source_message_id")
      .eq("child_id", childId)
      .order("occurred_at", { ascending: false })
      .limit(50),
  ]);

  if (!child) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/ops/families/${child.family_id}`}
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← {child.families?.name ?? "família"}
        </Link>
        <h1 className="text-lg font-semibold text-neutral-900">
          {child.name}
          {ageLabel(child.birth_date) && (
            <span className="ml-2 text-sm font-normal text-neutral-500">
              {ageLabel(child.birth_date)}
            </span>
          )}
        </h1>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-700">Registrar evento</h2>
        <form
          action={createEvent}
          className="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 bg-white p-4 sm:grid-cols-2"
        >
          <input type="hidden" name="child_id" value={child.id} />
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
              defaultValue={toDatetimeLocalValue(new Date())}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-sm font-medium text-neutral-700">Notas</label>
            <textarea
              name="notes"
              required
              rows={3}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Registrar
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-700">
          Histórico ({events?.length ?? 0})
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
                    {eventTypeLabels[event.type as keyof typeof eventTypeLabels] ?? event.type}
                  </span>
                  <span>
                    {new Date(event.occurred_at).toLocaleString("pt-BR")}
                    {event.source_message_id && " · via WhatsApp"}
                  </span>
                </div>
                <p className="text-sm text-neutral-800">{event.notes}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
