import Link from "next/link";
import { cardClassName, cardHoverLift } from "@/components/ui/Card";
import { sleepTypeLabels } from "@/lib/validation/sleep";
import { formatDurationMinutes } from "@/lib/format";
import { QuintalIcon } from "@/components/icon/QuintalIcon";
import type { SleepHistoryEntry } from "@/lib/sleep";

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// Uma linha do Histórico — ícone (lua para sono noturno, "zzz" para
// soneca — mesmo tema sono da linguagem de ícones do Quintal, ver
// docs/design-system.md #Quintal Iconography), horário de início–fim e
// duração. Linka para o detalhe genérico da Timeline
// (/quintal/timeline/[id]) quando o id é conhecido — o mesmo
// editar/excluir que já existe ali, sem duplicar essa tela para o
// módulo Sono.
export function SleepEntryCard({ entry }: { entry: SleepHistoryEntry }) {
  const iconName = entry.sleepType === "night" ? "moon" : "nap";
  const typeLabel = entry.sleepType ? sleepTypeLabels[entry.sleepType] : "Sono";
  const fallbackNote = entry.sleepType ? sleepTypeLabels[entry.sleepType] : null;
  const hasExtraNote = entry.notes && entry.notes !== fallbackNote;

  return (
    <Link href={`/quintal/timeline/${entry.id}`} className={cardClassName(`flex items-center gap-3 p-3 ${cardHoverLift}`)}>
      <QuintalIcon name={iconName} theme="sleep" size="sm" background="light" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-medium text-ink">{typeLabel}</p>
          {entry.durationMinutes !== null && (
            <span className="shrink-0 text-xs font-medium text-ink-muted">{formatDurationMinutes(entry.durationMinutes)}</span>
          )}
        </div>
        <p className="text-xs text-ink-muted">
          {timeLabel(entry.startedAt)} {entry.endedAt ? `– ${timeLabel(entry.endedAt)}` : "(em andamento)"}
          {hasExtraNote && ` · ${entry.notes}`}
        </p>
      </div>
    </Link>
  );
}
