import { getTimelineEntries, describeEntry, getTimelineDetailLines, type TimelineEntry, type TimelineIcon } from "@/lib/timeline";
import type { EventType } from "@/lib/validation/events";
import { groupByDay, formatDurationMinutes } from "@/lib/format";

// Rótulos de CONTAGEM, não os mesmos de eventTypeLabels (events.ts):
// "2 alimentações"/"2 observações" soaria errado se só apêndice um "s"
// ao rótulo de categoria ("Alimentação" → "alimentaçãos") — português
// pluraliza "-ção" em "-ções", e "Livre brincar" nem é um substantivo
// contável. Explícito em vez de esperto, mesmo critério de
// mealSlotLabels/diaperResultLabels (nunca derivar um plural por regra).
const EVENT_TYPE_COUNT_LABELS: Record<EventType, { singular: string; plural: string }> = {
  sleep: { singular: "sono", plural: "sonos" },
  routine: { singular: "evento de rotina", plural: "eventos de rotina" },
  free_play: { singular: "brincadeira", plural: "brincadeiras" },
  development: { singular: "registro de desenvolvimento", plural: "registros de desenvolvimento" },
  observation: { singular: "observação", plural: "observações" },
  decision: { singular: "decisão", plural: "decisões" },
  meal: { singular: "refeição", plural: "refeições" },
  outing: { singular: "passeio", plural: "passeios" },
  hygiene: { singular: "troca de fralda", plural: "trocas de fralda" },
};

// ---------------------------------------------------------------------
// Resumo para um cuidador que não está ativamente presente, mas quer
// saber o que está acontecendo com o filho (pedido explícito) —
// diferente do Dashboard (src/lib/dashboard.ts), que só cobre "hoje" e
// mistura sugestões/recomendações; aqui é só o que JÁ foi registrado,
// num período maior e configurável, pensado pra alguém se atualizar
// rápido sem precisar abrir cada módulo. Reaproveita getTimelineEntries/
// describeEntry/getTimelineDetailLines (timeline.ts) em vez de duplicar
// a lógica de formatação — a mesma "Café da manhã"/"Soneca · 43min" que
// a Timeline central já mostra.
// ---------------------------------------------------------------------

export const CAREGIVER_SUMMARY_PERIODS = ["today", "3d", "7d"] as const;
export type CaregiverSummaryPeriod = (typeof CAREGIVER_SUMMARY_PERIODS)[number];

export const CAREGIVER_SUMMARY_PERIOD_LABELS: Record<CaregiverSummaryPeriod, string> = {
  today: "Hoje",
  "3d": "Últimos 3 dias",
  "7d": "Últimos 7 dias",
};

// Quantos dias corridos cada período cobre, incluindo hoje — "3d" = hoje
// + 2 dias anteriores, não "últimas 72h" a partir do minuto atual, pra
// bater com a leitura intuitiva de "últimos 3 dias" (mesmo critério já
// usado em startOfToday/dayLabel, format.ts).
const PERIOD_DAYS: Record<CaregiverSummaryPeriod, number> = { today: 1, "3d": 3, "7d": 7 };

export function isCaregiverSummaryPeriod(value: string | undefined): value is CaregiverSummaryPeriod {
  return (CAREGIVER_SUMMARY_PERIODS as readonly string[]).includes(value ?? "");
}

function periodSince(period: CaregiverSummaryPeriod, now: Date): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (PERIOD_DAYS[period] - 1));
  return start;
}

export type CaregiverSummaryEntry = {
  id: string;
  timeLabel: string;
  verb: string;
  icon: TimelineIcon;
  detailLines: string[];
};

export type CaregiverSummaryDayGroup = {
  label: string;
  entries: CaregiverSummaryEntry[];
};

// Uma linha por tipo com pelo menos um registro no período — nunca um
// tipo zerado (uma lista de zeros não ajuda ninguém a se atualizar
// rápido). Sono ganha a duração total também, mesmo critério do
// Dashboard (napTotalMinutesToday). `icon` vem de describeEntry sobre um
// evento real desse tipo (não um mapa paralelo) — EventType e
// TimelineIcon não são o mesmo conjunto (ex.: "free_play" vs "play"),
// então deriva do dado real em vez de arriscar divergir.
export type CaregiverSummaryHighlight = { type: EventType; icon: TimelineIcon; label: string };

export type CaregiverSummary = {
  childName: string;
  period: CaregiverSummaryPeriod;
  periodLabel: string;
  since: string;
  highlights: CaregiverSummaryHighlight[];
  dayGroups: CaregiverSummaryDayGroup[];
};

// Pura — testável sem banco, mesmo espírito de routineEngine.ts
// (DECISÃO/REDAÇÃO separada de busca de dado real).
export function buildCaregiverSummary(
  childName: string,
  period: CaregiverSummaryPeriod,
  since: Date,
  entries: TimelineEntry[],
): CaregiverSummary {
  const counts = new Map<EventType, number>();
  const firstEntryByType = new Map<EventType, TimelineEntry>();
  let sleepTotalMinutes = 0;
  for (const entry of entries) {
    counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);
    if (!firstEntryByType.has(entry.type)) firstEntryByType.set(entry.type, entry);
    if (entry.type === "sleep" && entry.durationMinutes !== null) {
      sleepTotalMinutes += entry.durationMinutes;
    }
  }

  const highlights: CaregiverSummaryHighlight[] = [];
  for (const [type, count] of counts) {
    const labels = EVENT_TYPE_COUNT_LABELS[type];
    const base = `${count} ${count === 1 ? labels.singular : labels.plural}`;
    highlights.push({
      type,
      icon: describeEntry(firstEntryByType.get(type)!).icon,
      label: type === "sleep" && sleepTotalMinutes > 0 ? `${base} · ${formatDurationMinutes(sleepTotalMinutes)}` : base,
    });
  }

  // Mais recente primeiro — pra quem está se atualizando, o que acabou
  // de acontecer importa mais que o início do período.
  const descending = [...entries].reverse();
  const groupedByDay = groupByDay(descending, (entry) => entry.occurredAt);

  const dayGroups: CaregiverSummaryDayGroup[] = groupedByDay.map((group) => ({
    label: group.label,
    entries: group.entries.map((entry) => {
      const { verb, icon } = describeEntry(entry);
      return {
        id: entry.id,
        timeLabel: new Date(entry.occurredAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        verb,
        icon,
        detailLines: getTimelineDetailLines(entry),
      };
    }),
  }));

  return {
    childName,
    period,
    periodLabel: CAREGIVER_SUMMARY_PERIOD_LABELS[period],
    since: since.toISOString(),
    highlights,
    dayGroups,
  };
}

// O único ponto assíncrono do módulo — busca o real, delega toda
// decisão pra buildCaregiverSummary acima.
export async function getCaregiverSummary(
  childId: string,
  childName: string,
  period: CaregiverSummaryPeriod,
  now: Date = new Date(),
): Promise<CaregiverSummary> {
  const since = periodSince(period, now);
  const entries = await getTimelineEntries(childId, { since: since.toISOString(), until: now.toISOString() });
  return buildCaregiverSummary(childName, period, since, entries);
}

// Texto simples pra compartilhar (WhatsApp etc.) — ver
// src/components/caregiver/ShareSummaryButton.tsx. Separado da
// renderização em tela de propósito: o texto plano não carrega ícone/
// cor, só o essencial.
export function formatCaregiverSummaryText(summary: CaregiverSummary): string {
  const lines = [`Resumo de ${summary.childName} — ${summary.periodLabel.toLowerCase()}`, ""];

  if (summary.highlights.length > 0) {
    for (const highlight of summary.highlights) {
      lines.push(`• ${highlight.label}`);
    }
    lines.push("");
  } else {
    lines.push("Nada registrado ainda nesse período.", "");
  }

  for (const group of summary.dayGroups) {
    lines.push(group.label);
    for (const entry of group.entries) {
      const detail = entry.detailLines.length > 0 ? ` (${entry.detailLines.join(", ")})` : "";
      lines.push(`${entry.timeLabel} — ${entry.verb}${detail}`);
    }
    lines.push("");
  }

  lines.push("Enviado pelo Quintal.");
  return lines.join("\n").trim();
}
