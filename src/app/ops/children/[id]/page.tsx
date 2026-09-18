import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ageLabel, toDatetimeLocalValue } from "@/lib/format";
import { eventTypeLabels, eventTypes } from "@/lib/validation/events";
import { Button } from "@/components/ui/Button";
import { Card, cardClassName } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/Field";
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
          className="text-sm text-ink-muted hover:text-ink"
        >
          ← {child.families?.name ?? "família"}
        </Link>
        <h1 className="text-lg font-bold text-ink">
          {child.name}
          {ageLabel(child.birth_date) && (
            <span className="ml-2 text-sm font-normal text-ink-muted">
              {ageLabel(child.birth_date)}
            </span>
          )}
        </h1>
      </div>

      <FieldError>{error}</FieldError>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink">Registrar evento</h2>
        <form
          action={createEvent}
          className={cardClassName("grid grid-cols-1 gap-3 p-4 sm:grid-cols-2")}
        >
          <input type="hidden" name="child_id" value={child.id} />
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select name="type" required>
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {eventTypeLabels[type]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Quando</Label>
            <Input
              type="datetime-local"
              name="occurred_at"
              required
              defaultValue={toDatetimeLocalValue(new Date())}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Notas</Label>
            <Textarea name="notes" required rows={3} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Registrar</Button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink">Histórico ({events?.length ?? 0})</h2>
        {!events || events.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhum evento registrado ainda.</p>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <Card key={event.id} className="space-y-1 p-3">
                <div className="flex items-center justify-between text-xs text-ink-muted">
                  <Badge variant="accent">
                    {eventTypeLabels[event.type as keyof typeof eventTypeLabels] ?? event.type}
                  </Badge>
                  <span className="flex items-center gap-1">
                    {new Date(event.occurred_at).toLocaleString("pt-BR")}
                    {event.source_message_id && (
                      <>
                        <MessageCircle className="h-3 w-3" aria-hidden /> via WhatsApp
                      </>
                    )}
                  </span>
                </div>
                <p className="text-sm text-ink">{event.notes}</p>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
