import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ageLabel, toDatetimeLocalValue } from "@/lib/format";
import { eventTypeLabels, eventTypes, type EventType } from "@/lib/validation/events";
import { Button } from "@/components/ui/Button";
import { Card, cardClassName } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input, Label, Select, Textarea, FieldError } from "@/components/ui/Field";
import {
  createEventFromMessage,
  recordReplyFeedback,
  sendReply,
  suggestEvent,
  suggestReplyDraft,
} from "./actions";

export default async function TriageMessagePage({
  params,
  searchParams,
}: {
  params: Promise<{ messageId: string }>;
  searchParams: Promise<{
    child_id?: string;
    error?: string;
    suggested_type?: string;
    suggested_notes?: string;
    draft_reply?: string;
    sent?: string;
  }>;
}) {
  const { messageId } = await params;
  const {
    child_id: requestedChildId,
    error,
    suggested_type: suggestedType,
    suggested_notes: suggestedNotes,
    draft_reply: draftReply,
    sent,
  } = await searchParams;
  const supabase = await createClient();

  const { data: message } = await supabase
    .from("messages")
    .select(
      "id, wa_message_id, from_phone_number, message_type, body, wa_timestamp, handled_at, family_id, caregiver_id, families(name)",
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
  const selectedChildAge = ageLabel(selectedChild?.birth_date ?? null);

  const { data: events } = selectedChild
    ? await supabase
        .from("events")
        .select("id, type, occurred_at, notes")
        .eq("child_id", selectedChild.id)
        .order("occurred_at", { ascending: false })
        .limit(20)
    : { data: null };

  const isSimulated = message.wa_message_id.startsWith("sim-");

  const messageDateTime = message.wa_timestamp
    ? toDatetimeLocalValue(new Date(message.wa_timestamp))
    : toDatetimeLocalValue(new Date());

  // Surface the most recent unrated reply to this family so the operator
  // can close the feedback loop while triaging what the parent said next.
  const { data: pendingFeedbackReply } = message.family_id
    ? await supabase
        .from("messages")
        .select("id, body, wa_timestamp")
        .eq("family_id", message.family_id)
        .eq("direction", "outbound")
        .is("feedback_recorded_at", null)
        .order("wa_timestamp", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/ops/inbox" className="text-sm text-ink-muted hover:text-ink">
          ← Inbox
        </Link>
        <h1 className="text-lg font-bold text-ink">Triar mensagem</h1>
      </div>

      <FieldError>{error}</FieldError>

      {sent === "1" && (
        <p
          className="flex items-center gap-2 rounded-sm bg-success/30 px-3 py-2 text-sm text-ink"
          role="status"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Resposta enviada com sucesso.
        </p>
      )}

      <Card className="p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-medium text-ink">
            {message.families?.name ?? "Família não identificada"}
            {isSimulated && <Badge variant="decorative">simulação</Badge>}
          </span>
          <span className="text-ink-muted">{message.from_phone_number}</span>
        </div>
        <p className="mt-2 text-sm text-ink">
          {message.message_type === "text"
            ? message.body
            : `[mensagem de mídia: ${message.message_type}]`}
        </p>
      </Card>

      {!message.family_id ? (
        <p className="text-sm text-ink-muted">
          Esta mensagem ainda não está vinculada a uma família.{" "}
          <Link href="/ops/inbox" className="underline hover:text-ink">
            Volte para a inbox
          </Link>{" "}
          e vincule antes de continuar.
        </p>
      ) : (
        <>
          {pendingFeedbackReply && (
            <Card className="space-y-3 border-tertiary p-4">
              <h2 className="text-sm font-medium text-ink">A resposta anterior ajudou?</h2>
              <p className="text-sm text-ink">{pendingFeedbackReply.body}</p>
              <p className="text-xs text-ink-muted">
                {pendingFeedbackReply.wa_timestamp
                  ? new Date(pendingFeedbackReply.wa_timestamp).toLocaleString("pt-BR")
                  : ""}
              </p>
              <form action={recordReplyFeedback} className="space-y-2">
                <input type="hidden" name="message_id" value={message.id} />
                <input type="hidden" name="reply_message_id" value={pendingFeedbackReply.id} />
                <Textarea
                  name="feedback_notes"
                  placeholder="Nota opcional (o que a família disse, o que funcionou ou não)"
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button type="submit" variant="secondary" name="helpful" value="true">
                    <ThumbsUp className="h-4 w-4" aria-hidden />
                    Ajudou
                  </Button>
                  <Button type="submit" variant="secondary" name="helpful" value="false">
                    <ThumbsDown className="h-4 w-4" aria-hidden />
                    Não ajudou
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="space-y-6">
              {children && children.length > 1 && (
                <div className="flex flex-wrap gap-2 text-sm">
                  {children.map((child) => (
                    <Link
                      key={child.id}
                      href={`/ops/inbox/${messageId}?child_id=${child.id}`}
                      className={`rounded-full px-3 py-1 ${
                        selectedChild?.id === child.id
                          ? "bg-accent text-ink"
                          : "bg-neutral/40 text-ink-muted hover:bg-neutral/60"
                      }`}
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              )}

              {!children || children.length === 0 || !selectedChild ? (
                <p className="text-sm text-ink-muted">
                  Esta família ainda não tem crianças cadastradas.{" "}
                  <Link
                    href={`/ops/families/${message.family_id}`}
                    className="underline hover:text-ink"
                  >
                    Cadastre uma criança
                  </Link>{" "}
                  antes de registrar um evento.
                </p>
              ) : (
                <div className="space-y-3">
                  <h2 className="text-sm font-medium text-ink">Registrar evento</h2>

                  {message.message_type === "text" && (
                    <form action={suggestEvent} className="flex justify-end">
                      <input type="hidden" name="message_id" value={message.id} />
                      <input type="hidden" name="child_id" value={selectedChild.id} />
                      <input type="hidden" name="message_body" value={message.body ?? ""} />
                      <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
                        <Sparkles className="h-3.5 w-3.5" aria-hidden />
                        Sugerir com IA
                      </Button>
                    </form>
                  )}

                  <form action={createEventFromMessage} className={cardClassName("space-y-3 p-4")}>
                    <input type="hidden" name="message_id" value={message.id} />
                    <input type="hidden" name="child_id" value={selectedChild.id} />

                    <div className="space-y-1">
                      <Label>Tipo</Label>
                      <Select
                        name="type"
                        required
                        defaultValue={(suggestedType as EventType) ?? eventTypes[0]}
                      >
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
                        defaultValue={messageDateTime}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>
                        Notas
                        {suggestedNotes && (
                          <span className="ml-2 font-normal text-ink-muted">
                            (sugestão da IA — revise antes de salvar)
                          </span>
                        )}
                      </Label>
                      <Textarea
                        name="notes"
                        required
                        rows={4}
                        defaultValue={
                          suggestedNotes ??
                          (message.message_type === "text" ? (message.body ?? "") : "")
                        }
                      />
                    </div>

                    <Button type="submit">Registrar e marcar como tratada</Button>
                  </form>
                </div>
              )}

              <div className="space-y-3">
                <h2 className="text-sm font-medium text-ink">Responder</h2>

                {message.message_type === "text" && (
                  <form action={suggestReplyDraft} className="flex justify-end">
                    <input type="hidden" name="message_id" value={message.id} />
                    <input type="hidden" name="child_id" value={selectedChild?.id ?? ""} />
                    <input type="hidden" name="message_body" value={message.body ?? ""} />
                    <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden />
                      Sugerir resposta com IA
                    </Button>
                  </form>
                )}

                <form action={sendReply} className={cardClassName("space-y-3 p-4")}>
                  <input type="hidden" name="message_id" value={message.id} />
                  <input type="hidden" name="to_phone_number" value={message.from_phone_number} />
                  <input type="hidden" name="family_id" value={message.family_id} />
                  <input type="hidden" name="caregiver_id" value={message.caregiver_id ?? ""} />

                  <div className="space-y-1">
                    <Label>
                      Mensagem
                      {draftReply && (
                        <span className="ml-2 font-normal text-ink-muted">
                          (sugestão da IA — revise antes de enviar)
                        </span>
                      )}
                    </Label>
                    <Textarea name="reply_body" required rows={4} defaultValue={draftReply ?? ""} />
                  </div>

                  {isSimulated && (
                    <p className="flex items-center gap-1.5 text-xs text-decorative">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                      Esta é uma conversa simulada, mas o envio abaixo é real — vai para o número
                      de telefone do cuidador de verdade.
                    </p>
                  )}

                  <Button type="submit">Enviar pelo WhatsApp</Button>
                </form>
              </div>
            </section>

            <section className="space-y-3">
              {selectedChild ? (
                <>
                  <h2 className="text-sm font-medium text-ink">
                    Contexto de {selectedChild.name}
                    {selectedChildAge && (
                      <span className="ml-2 font-normal text-ink-muted">{selectedChildAge}</span>
                    )}
                  </h2>
                  {!events || events.length === 0 ? (
                    <p className="text-sm text-ink-muted">Nenhum evento registrado ainda.</p>
                  ) : (
                    <div className="space-y-2">
                      {events.map((event) => (
                        <Card key={event.id} className="space-y-1 p-3">
                          <div className="flex items-center justify-between text-xs text-ink-muted">
                            <Badge variant="accent">
                              {eventTypeLabels[event.type as keyof typeof eventTypeLabels] ??
                                event.type}
                            </Badge>
                            <span>{new Date(event.occurred_at).toLocaleString("pt-BR")}</span>
                          </div>
                          <p className="text-sm text-ink">{event.notes}</p>
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-ink-muted">Nenhuma criança selecionada.</p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
