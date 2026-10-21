import { describe, it, expect } from "vitest";
import { buildCaregiverSummary, formatCaregiverSummaryText, type CaregiverSummary } from "@/lib/caregiverSummary";
import type { TimelineEntry } from "@/lib/timeline";

function entry(overrides: Partial<TimelineEntry>): TimelineEntry {
  return {
    id: "evt-1",
    type: "meal",
    occurredAt: "2026-09-29T12:00:00.000Z",
    notes: "Arroz, Feijão",
    payload: { slot: "lunch", foods: ["Arroz", "Feijão"], acceptance: "ate_well", offeringMethodId: null, suggestionId: null },
    durationMinutes: null,
    origin: "manual",
    ...overrides,
  };
}

describe("buildCaregiverSummary", () => {
  it("agrupa por tipo em destaques, nunca um tipo zerado", () => {
    const summary = buildCaregiverSummary("Nina", "today", new Date("2026-09-29T00:00:00"), [
      entry({ id: "1", type: "meal" }),
      entry({ id: "2", type: "meal" }),
      entry({ id: "3", type: "free_play", occurredAt: "2026-09-29T14:00:00.000Z" }),
    ]);

    expect(summary.highlights).toEqual([
      { type: "meal", icon: "meal", label: "2 refeições" },
      { type: "free_play", icon: "play", label: "1 brincadeira" },
    ]);
    expect(summary.highlights.some((h) => h.type === "sleep")).toBe(false);
  });

  it("soma a duração total do sono no destaque de sono", () => {
    const summary = buildCaregiverSummary("Nina", "today", new Date("2026-09-29T00:00:00"), [
      entry({ id: "1", type: "sleep", durationMinutes: 40, payload: { sleepType: "nap", startedAt: "2026-09-29T12:00:00.000Z", endedAt: "2026-09-29T12:40:00.000Z" } }),
      entry({ id: "2", type: "sleep", durationMinutes: 90, occurredAt: "2026-09-29T14:00:00.000Z", payload: { sleepType: "nap", startedAt: "2026-09-29T14:00:00.000Z", endedAt: "2026-09-29T15:30:00.000Z" } }),
    ]);

    expect(summary.highlights).toEqual([{ type: "sleep", icon: "sleep", label: "2 sonos · 2h10" }]);
  });

  it("agrupa por dia, mais recente primeiro, cada dia com as entradas mais recentes primeiro", () => {
    const summary = buildCaregiverSummary("Nina", "3d", new Date("2026-09-27T00:00:00"), [
      entry({ id: "1", occurredAt: "2026-09-27T08:00:00.000Z" }),
      entry({ id: "2", occurredAt: "2026-09-28T08:00:00.000Z" }),
      entry({ id: "3", occurredAt: "2026-09-28T16:00:00.000Z" }),
    ]);

    expect(summary.dayGroups).toHaveLength(2);
    expect(summary.dayGroups[0].entries.map((e) => e.id)).toEqual(["3", "2"]);
    expect(summary.dayGroups[1].entries.map((e) => e.id)).toEqual(["1"]);
  });

  it("não inventa nada quando não há nenhum registro no período", () => {
    const summary = buildCaregiverSummary("Nina", "today", new Date("2026-09-29T00:00:00"), []);
    expect(summary.highlights).toEqual([]);
    expect(summary.dayGroups).toEqual([]);
  });
});

describe("formatCaregiverSummaryText", () => {
  const base: CaregiverSummary = {
    childName: "Nina",
    period: "today",
    periodLabel: "Hoje",
    since: "2026-09-29T00:00:00.000Z",
    highlights: [{ type: "meal", icon: "meal", label: "2 alimentações" }],
    dayGroups: [
      {
        label: "Hoje",
        entries: [{ id: "1", timeLabel: "12:00", verb: "Almoço", icon: "meal", detailLines: ["Arroz, Feijão"] }],
      },
    ],
  };

  it("inclui nome da criança, período, destaques e eventos", () => {
    const text = formatCaregiverSummaryText(base);
    expect(text).toContain("Resumo de Nina — hoje");
    expect(text).toContain("• 2 alimentações");
    expect(text).toContain("12:00 — Almoço (Arroz, Feijão)");
  });

  it("avisa claramente quando não há nada registrado, nunca inventa atividade", () => {
    const text = formatCaregiverSummaryText({ ...base, highlights: [], dayGroups: [] });
    expect(text).toContain("Nada registrado ainda nesse período.");
  });
});
