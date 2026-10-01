import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionCaregiver } from "@/lib/authorization";
import { getActiveChildContext } from "@/lib/activeChild";
import { toDatetimeLocalValue, groupByDay, formatDurationMinutes } from "@/lib/format";
import { getSleepHistory, getOpenSleepSession, getTodaySleepSummary, type SleepHistoryEntry } from "@/lib/sleep";
import { sleepTypes, sleepTypeLabels } from "@/lib/validation/sleep";
import { Input, Label, Select, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { cardClassName } from "@/components/ui/Card";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { startSleepAction, endSleepAction, recordSleepPeriodAction } from "./actions";

export const metadata: Metadata = {
  title: "Sono — Quintal",
  robots: { index: false, follow: false },
};

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function sleepEntryLine(entry: SleepHistoryEntry): string {
  const typeLabel = entry.sleepType ? sleepTypeLabels[entry.sleepType] : "Sono";
  if (entry.endedAt === null) {
    return `${timeLabel(entry.startedAt)} — ${typeLabel} (em andamento)`;
  }
  return `${timeLabel(entry.startedAt)}–${timeLabel(entry.endedAt)} — ${typeLabel}`;
}

// Registro simples da rotina de sono — não uma ferramenta médica ou de
// diagnóstico (ver o aviso na página). Fluxo pensado para "poucos
// segundos": "Começou a dormir" (um toque, sem formulário) e depois
// "Acordou" (um toque, duração calculada sozinha); registro retroativo
// fica num formulário completo, recolhido, para quando a família esquece
// de registrar em tempo real. Sempre sobre a criança ATIVA (Fase 16) —
// trocada pelo seletor global no topo, nunca mais fixa na primeira
// criança da família.
export default async function SonoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const { active: activeChild } = await getActiveChildContext(session.caregiverId);

  if (!activeChild) {
    return (
      <PageContainer space={6}>
        <PageHeader title="Sono" backHref="/quintal/mais" backLabel="Mais" />
        <p className={cardClassName("p-4 text-sm text-ink-muted")}>
          Nenhuma criança cadastrada ainda para esta família.
        </p>
      </PageContainer>
    );
  }

  const [openSession, summary, history] = await Promise.all([
    getOpenSleepSession(activeChild.id),
    getTodaySleepSummary(activeChild.id),
    getSleepHistory(activeChild.id),
  ]);

  const historyGroups = groupByDay(history, (entry) => entry.startedAt);
  const now = toDatetimeLocalValue(new Date());

  return (
    <PageContainer>
      <PageHeader title="Sono" backHref="/quintal/mais" backLabel="Mais" />

      <FieldError>{error}</FieldError>
      {success && <p className="text-sm text-ink-muted">Salvo com sucesso.</p>}

      <p className="text-xs text-ink-muted">
        Este é um registro simples da rotina de sono — não uma ferramenta médica ou de
        diagnóstico. Mudanças bruscas no sono valem uma conversa com o pediatra.
      </p>

      <section id="registrar" className="scroll-mt-4 space-y-3">
        {openSession ? (
          <div className={cardClassName("space-y-3 p-4")}>
            <p className="text-sm text-ink">
              <span className="font-medium">Dormindo desde {timeLabel(openSession.startedAt)}</span>
              <span className="text-ink-muted"> — {sleepTypeLabels[openSession.sleepType]}</span>
            </p>
            <form action={endSleepAction} className="space-y-3">
              <input type="hidden" name="child_id" value={activeChild.id} />
              <input type="hidden" name="event_id" value={openSession.id} />
              <div className="space-y-1">
                <Label htmlFor="ended_at">Acordou às</Label>
                <Input id="ended_at" type="datetime-local" name="ended_at" required defaultValue={now} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="end_notes">Observação (opcional)</Label>
                <Input id="end_notes" name="notes" placeholder="Ex.: acordou tranquila" />
              </div>
              <Button type="submit">Acordou</Button>
            </form>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <form action={startSleepAction}>
              <input type="hidden" name="child_id" value={activeChild.id} />
              <input type="hidden" name="sleep_type" value="nap" />
              <input type="hidden" name="started_at" value={now} />
              <Button type="submit" variant="secondary" className="w-full justify-center">
                😴 Começou uma soneca
              </Button>
            </form>
            <form action={startSleepAction}>
              <input type="hidden" name="child_id" value={activeChild.id} />
              <input type="hidden" name="sleep_type" value="night" />
              <input type="hidden" name="started_at" value={now} />
              <Button type="submit" className="w-full justify-center">
                🌙 Começou o sono noturno
              </Button>
            </form>
          </div>
        )}
      </section>

      <details className={cardClassName("group")}>
        <summary className="cursor-pointer list-none p-4 text-sm font-medium text-ink marker:content-none">
          <span className="inline-flex items-center gap-1.5">
            Registro retroativo
            <span className="text-ink-muted transition-transform duration-200 group-open:rotate-90">›</span>
          </span>
          <p className="mt-1 text-xs font-normal text-ink-muted">
            Esqueceu de registrar na hora? Lance um período completo aqui.
          </p>
        </summary>
        <div className="border-t border-neutral p-4">
          <form action={recordSleepPeriodAction} className="space-y-3">
            <input type="hidden" name="child_id" value={activeChild.id} />
            <div className="space-y-1">
              <Label htmlFor="sleep_type">Tipo</Label>
              <Select id="sleep_type" name="sleep_type" defaultValue="nap" required>
                {sleepTypes.map((type) => (
                  <option key={type} value={type}>
                    {sleepTypeLabels[type]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="period_started_at">Início</Label>
                <Input id="period_started_at" type="datetime-local" name="started_at" required defaultValue={now} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="period_ended_at">Fim</Label>
                <Input id="period_ended_at" type="datetime-local" name="ended_at" required defaultValue={now} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="period_notes">Observação (opcional)</Label>
              <Input id="period_notes" name="notes" placeholder="Ex.: dormiu no colo" />
            </div>
            <Button type="submit">Registrar período</Button>
          </form>
        </div>
      </details>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink-muted">Resumo de hoje</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className={cardClassName("space-y-1 p-4")}>
            <p className="text-xs font-medium text-ink-muted">Sonecas</p>
            <p className="text-sm font-semibold text-ink">
              {summary.napCount > 0
                ? `${summary.napCount} · ${formatDurationMinutes(summary.napTotalMinutes)}`
                : "Nenhuma ainda hoje"}
            </p>
          </div>
          <div className={cardClassName("space-y-1 p-4")}>
            <p className="text-xs font-medium text-ink-muted">Último período</p>
            <p className="text-sm font-semibold text-ink">
              {summary.lastPeriod ? sleepEntryLine(summary.lastPeriod) : "Nenhum registro ainda hoje"}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink-muted">Histórico</h2>
        {historyGroups.length === 0 ? (
          <p className={cardClassName("p-4 text-sm text-ink-muted")}>
            Nenhum sono registrado ainda.
          </p>
        ) : (
          <div className="space-y-4">
            {historyGroups.map((group) => (
              <div key={group.label} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {group.label}
                </h3>
                <div className="space-y-2">
                  {group.entries.map((entry) => {
                    // Só mostra a observação quando ela diz algo além do
                    // rótulo padrão que recordSleepPeriod/startSleep já
                    // gravam como fallback (ex.: "Soneca") — senão a
                    // linha repetiria a mesma palavra duas vezes.
                    const fallbackLabel = entry.sleepType ? sleepTypeLabels[entry.sleepType] : null;
                    const hasExtraNote = entry.notes && entry.notes !== fallbackLabel;
                    return (
                      <div key={entry.id} className={cardClassName("flex gap-3 p-3 text-sm")}>
                        <p className="text-ink">
                          {sleepEntryLine(entry)}
                          {hasExtraNote && <span className="text-ink-muted"> · {entry.notes}</span>}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-ink-muted">
          Períodos que atravessam a meia-noite aparecem inteiros no dia em que começaram.
        </p>
      </section>
    </PageContainer>
  );
}
