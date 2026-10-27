import Link from "next/link";
import { cardClassName, cardHoverLift } from "@/components/ui/Card";
import { diaperResultLabels, diaperConditionLabels, skinConditionLabels } from "@/lib/validation/hygiene";
import { QuintalIcon } from "@/components/icon/QuintalIcon";
import type { HygieneHistoryEntry } from "@/lib/hygiene";

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// Uma linha do Histórico de Higiene — ícone (gota para xixi, "cocô" para
// cocô/os dois — mesma lógica visual de SleepEntryCard), horário, tipo e
// condição. Linka para o detalhe genérico da Timeline, mesmo
// reaproveitamento de editar/excluir que SleepEntryCard já usa — sem
// duplicar essa tela para o módulo Higiene.
export function HygieneEntryCard({ entry }: { entry: HygieneHistoryEntry }) {
  // null só para um evento criado pelo fallback genérico do chat (sem
  // passar pelo formulário de registro) — ver HygieneHistoryEntry. Cai
  // para as notas livres (que o evento sempre tem) em vez de inventar
  // um tipo/condição que não foi de fato informado.
  const iconName = entry.diaperResult === "poop" || entry.diaperResult === "both" ? "poop" : "drop";
  const hasHighlight = entry.condition === "leaked" || entry.skinCondition === "rash" || entry.skinCondition === "red";

  const title = entry.diaperResult ? diaperResultLabels[entry.diaperResult] : "Higiene";
  const detail = entry.diaperResult
    ? [
        entry.condition === "normal" || entry.condition === null ? null : diaperConditionLabels[entry.condition],
        entry.skinCondition && entry.skinCondition !== "normal" ? `Pele ${skinConditionLabels[entry.skinCondition].toLowerCase()}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Fralda normal"
    : entry.notes;

  return (
    <Link href={`/quintal/timeline/${entry.id}`} className={cardClassName(`flex items-center gap-3 p-3 ${cardHoverLift}`)}>
      <QuintalIcon name={iconName} theme="hygiene" size="sm" background="light" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-medium text-ink">{title}</p>
          <span className="shrink-0 text-xs font-medium text-ink-muted">{timeLabel(entry.occurredAt)}</span>
        </div>
        <p className={`text-xs ${hasHighlight ? "font-medium text-danger" : "text-ink-muted"}`}>{detail}</p>
      </div>
    </Link>
  );
}
