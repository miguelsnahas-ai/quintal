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

  const [{ data: child }, { data: events }, { data: recommendations }] = await Promise.all([
    supabase
      .from("children")
      .select("id, name, birth_date, family_id, families(name)")
      .eq("id", childId)
      .maybeSingle(),
    supabase
      .from("events")
      .select("id, type, occurred_at, notes, source_message_id, duration_minutes, origin")
      .eq("child_id", childId)
      .order("occurred_at", { ascending: false })
      .limit(50),
    // Fase 6: o Concierge precisa ver recomendação + feedback + observação
    // juntos, sem precisar cruzar tabelas manualmente. knowledge_chunks
    // dá o título; activity_recommendation_feedback é 1:N de propósito
    // (uma recomendação pode nunca receber feedback, ou receber mais de
    // um ao longo do tempo) — nunca sobrescreve a linha de
    // activity_recommendations em si.
    supabase
      .from("activity_recommendations")
      .select(
        "id, created_at, opened_at, knowledge_chunks(title), activity_recommendation_feedback(feedback, note, created_at)",
      )
      .eq("child_id", childId)
      .order("created_at", { ascending: false })
      .limit(20),
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
          <div className="space-y-1">
            <Label>Duração em minutos (opcional)</Label>
            <Input type="number" name="duration_minutes" min={1} placeholder="Ex.: 90" />
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
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-ink-muted">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="accent">
                      {eventTypeLabels[event.type as keyof typeof eventTypeLabels] ?? event.type}
                    </Badge>
                    {event.duration_minutes && <span>{event.duration_minutes} min</span>}
                  </div>
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

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink">
          Recomendações de atividade ({recommendations?.length ?? 0})
        </h2>
        {!recommendations || recommendations.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhuma recomendação registrada ainda.</p>
        ) : (
          <div className="space-y-2">
            {recommendations.map((recommendation) => (
              <Card key={recommendation.id} className="space-y-1 p-3">
                <div className="flex items-center justify-between text-xs text-ink-muted">
                  <span className="font-medium text-ink">
                    {recommendation.knowledge_chunks?.title ?? "Atividade removida"}
                  </span>
                  <span className="flex items-center gap-1">
                    {new Date(recommendation.created_at).toLocaleString("pt-BR")}
                    {recommendation.opened_at && (
                      <Badge variant="accent">aberta</Badge>
                    )}
                  </span>
                </div>
                {recommendation.activity_recommendation_feedback.length === 0 ? (
                  <p className="text-xs text-ink-muted">Sem feedback ainda.</p>
                ) : (
                  <div className="space-y-1">
                    {recommendation.activity_recommendation_feedback.map((feedback, index) => (
                      <div key={index} className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge
                          variant={
                            feedback.feedback === "worked"
                              ? "success"
                              : feedback.feedback === "did_not_work"
                                ? "decorative"
                                : "neutral"
                          }
                        >
                          {feedbackLabels[feedback.feedback] ?? feedback.feedback}
                        </Badge>
                        {feedback.note && <span className="text-ink">“{feedback.note}”</span>}
                        <span className="text-ink-muted">
                          {new Date(feedback.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const feedbackLabels: Record<string, string> = {
  worked: "Funcionou",
  did_not_work: "Não funcionou",
  wants_another: "Quis outra ideia",
};
