import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getFamilySessionCaregiverId } from "@/lib/familySession";
import { createServiceClient } from "@/lib/supabase/service";
import { toDatetimeLocalValue } from "@/lib/format";
import { getTimelineEntry, describeEntry, getTimelineDetailLines } from "@/lib/timeline";
import { eventOriginLabels } from "@/lib/validation/events";
import { Input, Label, Textarea, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { updateTimelineEntryAction, deleteTimelineEntryAction } from "./actions";

export const metadata: Metadata = {
  title: "Evento — Quintal",
  robots: { index: false, follow: false },
};

// Ao tocar num evento da Timeline (Fase 13): ver detalhes, editar
// (horário + observação — os dois únicos campos que todo evento tem de
// verdade, ver eventEditInputSchema) e excluir. Tipos com payload
// estruturado (refeição, sono, brincadeira) mostram o detalhe real aqui
// em cima, mas continuam editados pelo módulo que os criou — esta
// página nunca finge poder editar "o que foi comido" ou "quanto durou o
// sono".
export default async function TimelineEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { id } = await params;
  const { error, success } = await searchParams;

  const caregiverId = await getFamilySessionCaregiverId();
  if (!caregiverId) {
    redirect("/comecar");
  }

  const supabase = createServiceClient();
  const { data: caregiver } = await supabase
    .from("caregivers")
    .select("family_id")
    .eq("id", caregiverId)
    .maybeSingle();

  if (!caregiver) {
    redirect("/comecar");
  }

  const entry = await getTimelineEntry(id);
  if (!entry) {
    notFound();
  }

  const { data: child } = await supabase
    .from("children")
    .select("family_id, name")
    .eq("id", entry.childId)
    .maybeSingle();

  if (!child || child.family_id !== caregiver.family_id) {
    notFound();
  }

  const { verb } = describeEntry(entry);
  const detailLines = getTimelineDetailLines(entry);
  const hasStructuredPayload = entry.type === "meal" || entry.type === "sleep" || entry.type === "free_play";

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-8">
      <BackLink />

      <div className="space-y-1">
        <h1 className="text-xl font-bold text-ink">{verb}</h1>
        <p className="text-sm text-ink-muted">
          {child.name} ·{" "}
          {new Date(entry.occurredAt).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}
        </p>
        <p className="text-xs text-ink-muted">{eventOriginLabels[entry.origin]}</p>
      </div>

      {detailLines.length > 0 && (
        <div className="space-y-1 rounded-lg bg-secondary p-4">
          {detailLines.map((line) => (
            <p key={line} className="text-sm text-ink">
              {line}
            </p>
          ))}
        </div>
      )}

      <FieldError>{error}</FieldError>
      {success && <p className="text-sm text-ink-muted">Salvo com sucesso.</p>}

      <form
        action={updateTimelineEntryAction.bind(null, entry.id)}
        className="space-y-3 rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]"
      >
        <h2 className="text-sm font-medium text-ink-muted">Editar</h2>
        <div className="space-y-1">
          <Label htmlFor="occurred_at">Quando</Label>
          <Input
            id="occurred_at"
            type="datetime-local"
            name="occurred_at"
            required
            defaultValue={toDatetimeLocalValue(new Date(entry.occurredAt))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="notes">Observação</Label>
          <Textarea id="notes" name="notes" required defaultValue={entry.notes} rows={3} />
        </div>
        {hasStructuredPayload && (
          <p className="text-xs text-ink-muted">
            Para editar os detalhes específicos (o que foi comido, tipo de sono, feedback da
            atividade...), use o registro no módulo onde foi criado.
          </p>
        )}
        <Button type="submit">Salvar</Button>
      </form>

      <details className="group rounded-lg bg-primary shadow-[var(--shadow-card)]">
        <summary className="cursor-pointer list-none p-4 text-sm font-medium text-red-600 marker:content-none">
          Excluir este registro
        </summary>
        <div className="space-y-3 border-t border-neutral p-4">
          <p className="text-xs text-ink-muted">Essa ação não pode ser desfeita.</p>
          <form action={deleteTimelineEntryAction.bind(null, entry.id)}>
            <Button type="submit" variant="danger">
              Confirmar exclusão
            </Button>
          </form>
        </div>
      </details>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/quintal/timeline" className="text-sm text-ink-muted hover:text-ink">
      ← Timeline
    </Link>
  );
}
