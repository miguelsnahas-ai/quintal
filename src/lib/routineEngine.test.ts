import { describe, it, expect } from "vitest";
import {
  detectState,
  computeTypicalMealTimes,
  computeTypicalBedtimeMinutes,
  buildRoutineSuggestions,
  type RoutineState,
} from "@/lib/routineEngine";
import type { SleepHistoryEntry } from "@/lib/sleep";
import type { MealHistoryEntry } from "@/lib/feeding";
import type { ActivityHistoryEntry } from "@/lib/play";

// Testes das principais regras da camada de rotina adaptativa (Fase
// 14) — cada teste fixa `now` explicitamente (as funções nunca leem o
// relógio por conta própria), então o resultado é 100% determinístico,
// sem depender da hora em que o teste roda.

function sleepEntry(overrides: Partial<SleepHistoryEntry>): SleepHistoryEntry {
  return {
    id: "evt-sleep",
    sleepType: "nap",
    startedAt: "2026-09-29T13:00:00.000Z",
    endedAt: "2026-09-29T13:30:00.000Z",
    durationMinutes: 30,
    notes: "Soneca",
    ...overrides,
  };
}

function mealEntry(overrides: Partial<MealHistoryEntry>): MealHistoryEntry {
  return {
    id: "evt-meal",
    occurredAt: "2026-09-29T12:00:00.000Z",
    slot: "lunch",
    foods: ["Arroz", "Feijão"],
    acceptance: "ate_well",
    notes: "Arroz, Feijão",
    ...overrides,
  };
}

function activityEntry(overrides: Partial<ActivityHistoryEntry>): ActivityHistoryEntry {
  return {
    id: "evt-play",
    occurredAt: "2026-09-28T10:00:00.000Z",
    activityId: "BRI-001",
    activityTitle: "Cabana",
    feedback: "loved",
    notes: "Cabana — Adorou",
    ...overrides,
  };
}

describe("detectState", () => {
  it("marca isNapping quando há um período de sono em aberto", () => {
    const state = detectState({
      now: new Date("2026-09-29T15:00:00.000Z"),
      openSleepSession: { startedAt: "2026-09-29T14:30:00.000Z" },
      sleepHistory: [],
      mealHistory: [],
      activityHistory: [],
    });
    expect(state.isNapping).toBe(true);
    expect(state.minutesAwake).toBeNull();
  });

  it("calcula minutesAwake a partir do fim do último sono concluído", () => {
    const state = detectState({
      now: new Date("2026-09-29T16:00:00.000Z"),
      openSleepSession: null,
      sleepHistory: [sleepEntry({ endedAt: "2026-09-29T15:30:00.000Z" })],
      mealHistory: [],
      activityHistory: [],
    });
    expect(state.isNapping).toBe(false);
    expect(state.minutesAwake).toBe(30);
  });

  it("nunca inventa minutesAwake quando não há sono concluído no histórico", () => {
    const state = detectState({
      now: new Date("2026-09-29T16:00:00.000Z"),
      openSleepSession: null,
      sleepHistory: [],
      mealHistory: [],
      activityHistory: [],
    });
    expect(state.minutesAwake).toBeNull();
  });

  it("identifica soneca curta (< 30 min)", () => {
    const state = detectState({
      now: new Date("2026-09-29T16:00:00.000Z"),
      openSleepSession: null,
      sleepHistory: [sleepEntry({ durationMinutes: 20, endedAt: "2026-09-29T15:30:00.000Z" })],
      mealHistory: [],
      activityHistory: [],
    });
    expect(state.lastNapWasShort).toBe(true);
  });

  it("não marca soneca curta quando durou 30 min ou mais", () => {
    const state = detectState({
      now: new Date("2026-09-29T16:00:00.000Z"),
      openSleepSession: null,
      sleepHistory: [sleepEntry({ durationMinutes: 45, endedAt: "2026-09-29T15:30:00.000Z" })],
      mealHistory: [],
      activityHistory: [],
    });
    expect(state.lastNapWasShort).toBe(false);
  });

  it("não confunde sono noturno curto com soneca curta", () => {
    // Regra é especificamente sobre SONECA — um sono noturno de 20min
    // seria um dado estranho, não motivo pra sugerir atividades calmas.
    const state = detectState({
      now: new Date("2026-09-29T16:00:00.000Z"),
      openSleepSession: null,
      sleepHistory: [sleepEntry({ sleepType: "night", durationMinutes: 20, endedAt: "2026-09-29T15:30:00.000Z" })],
      mealHistory: [],
      activityHistory: [],
    });
    expect(state.lastNapWasShort).toBe(false);
  });

  it("calcula minutesSinceLastMeal a partir da refeição mais recente", () => {
    const state = detectState({
      now: new Date("2026-09-29T13:00:00.000Z"),
      openSleepSession: null,
      sleepHistory: [],
      mealHistory: [mealEntry({ occurredAt: "2026-09-29T12:00:00.000Z" })],
      activityHistory: [],
    });
    expect(state.minutesSinceLastMeal).toBe(60);
  });

  it("encontra a atividade favorita mais recente com feedback 'loved'", () => {
    const state = detectState({
      now: new Date("2026-09-29T16:00:00.000Z"),
      openSleepSession: null,
      sleepHistory: [],
      mealHistory: [],
      activityHistory: [
        activityEntry({ feedback: "not_interested", activityId: "BRI-002", activityTitle: "Caça ao tesouro" }),
        activityEntry({ feedback: "loved", activityId: "BRI-001", activityTitle: "Cabana" }),
      ],
    });
    expect(state.favoriteActivity).toEqual({ id: "BRI-001", title: "Cabana" });
  });

  it("não elege favorita quando o feedback mais recente não é 'loved'", () => {
    const state = detectState({
      now: new Date("2026-09-29T16:00:00.000Z"),
      openSleepSession: null,
      sleepHistory: [],
      mealHistory: [],
      activityHistory: [activityEntry({ feedback: "liked" })],
    });
    expect(state.favoriteActivity).toBeNull();
  });
});

describe("computeTypicalMealTimes", () => {
  it("calcula a mediana do horário de cada refeição", () => {
    const times = computeTypicalMealTimes([
      mealEntry({ slot: "lunch", occurredAt: "2026-09-27T12:00:00" }),
      mealEntry({ slot: "lunch", occurredAt: "2026-09-28T12:20:00" }),
      mealEntry({ slot: "lunch", occurredAt: "2026-09-29T12:10:00" }),
    ]);
    expect(times.lunch).toBe(12 * 60 + 10);
  });

  it("não inclui uma refeição sem nenhum registro histórico", () => {
    const times = computeTypicalMealTimes([mealEntry({ slot: "lunch" })]);
    expect(times.dinner).toBeUndefined();
  });
});

describe("computeTypicalBedtimeMinutes", () => {
  it("considera só sono noturno, nunca sonecas", () => {
    const minutes = computeTypicalBedtimeMinutes([
      sleepEntry({ sleepType: "nap", startedAt: "2026-09-29T13:00:00" }),
      sleepEntry({ sleepType: "night", startedAt: "2026-09-28T20:00:00" }),
    ]);
    expect(minutes).toBe(20 * 60);
  });

  it("devolve null sem nenhum sono noturno no histórico", () => {
    const minutes = computeTypicalBedtimeMinutes([sleepEntry({ sleepType: "nap" })]);
    expect(minutes).toBeNull();
  });
});

describe("buildRoutineSuggestions", () => {
  // Sem sufixo "Z" de propósito: as funções testadas trabalham com
  // horário local (mesma convenção pragmática já usada em
  // toDatetimeLocalValue, src/lib/format.ts) — construir `now` e os
  // horários típicos (minutos desde a meia-noite LOCAL) de forma
  // consistente evita que o teste dependa do fuso horário de quem o
  // roda.
  const now = new Date("2026-09-29T15:30:00");
  const baseState: RoutineState = {
    isNapping: false,
    minutesAwake: 30,
    minutesSinceLastMeal: 180,
    lastNapWasShort: false,
    favoriteActivity: null,
    lastSleepType: "nap",
  };

  it("não sugere nada enquanto a criança está dormindo (nunca inventa hora de despertar)", () => {
    const suggestions = buildRoutineSuggestions(
      { ...baseState, isNapping: true },
      { now, typicalMealTimes: {}, typicalBedtimeMinutes: null, playSuggestion: null },
    );
    expect(suggestions).toEqual([]);
  });

  it("monta a sequência do exemplo do pedido: brincadeira → passeio → jantar → preparação para dormir", () => {
    const suggestions = buildRoutineSuggestions(baseState, {
      now,
      typicalMealTimes: { dinner: 18 * 60 + 30 },
      typicalBedtimeMinutes: 20 * 60 + 15,
      playSuggestion: { id: "BRI-010", category: "brincadeiras", title: "Empilhar blocos", ageDisplayLabel: null, imageUrl: null },
    });

    expect(suggestions.map((s) => s.kind)).toEqual(["play", "outing", "meal", "wind_down"]);

    // Ordem cronológica de verdade (timestamps absolutos), não só a
    // ordem em que foram inseridas na lista.
    const timestamps = suggestions.map((s) => new Date(s.suggestedAt).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1]);
    }
  });

  it("empurra a sugestão de refeição quando a última foi recente (< 2h)", () => {
    const withoutRecentMeal = buildRoutineSuggestions(baseState, {
      now,
      typicalMealTimes: { dinner: 15 * 60 + 45 },
      typicalBedtimeMinutes: null,
      playSuggestion: null,
    });
    const withRecentMeal = buildRoutineSuggestions(
      { ...baseState, minutesSinceLastMeal: 10 },
      { now, typicalMealTimes: { dinner: 15 * 60 + 45 }, typicalBedtimeMinutes: null, playSuggestion: null },
    );

    const at = (list: typeof withoutRecentMeal) => list.find((s) => s.kind === "meal")?.suggestedAt;
    expect(new Date(at(withRecentMeal)!).getTime()).toBeGreaterThan(new Date(at(withoutRecentMeal)!).getTime());
    expect(withRecentMeal.find((s) => s.kind === "meal")?.reason).toContain("Ainda não faz muito tempo");
  });

  it("não sugere nenhuma refeição quando não há próximo horário típico ainda hoje", () => {
    const suggestions = buildRoutineSuggestions(baseState, {
      now,
      typicalMealTimes: { lunch: 12 * 60 }, // já passou, nenhum horário típico restante
      typicalBedtimeMinutes: null,
      playSuggestion: null,
    });
    expect(suggestions.some((s) => s.kind === "meal")).toBe(false);
  });

  it("menciona a soneca curta na razão da sugestão de brincadeira", () => {
    const suggestions = buildRoutineSuggestions(
      { ...baseState, lastNapWasShort: true },
      {
        now,
        typicalMealTimes: {},
        typicalBedtimeMinutes: null,
        playSuggestion: { id: "BRI-020", category: "brincadeiras", title: "Cesto sensorial", ageDisplayLabel: null, imageUrl: null },
      },
    );
    expect(suggestions[0].reason).toContain("curta");
  });

  it("reconhece uma atividade favorita na razão da sugestão", () => {
    const suggestions = buildRoutineSuggestions(baseState, {
      now,
      typicalMealTimes: {},
      typicalBedtimeMinutes: null,
      playSuggestion: {
        id: "BRI-001",
        category: "brincadeiras",
        title: "Cabana",
        ageDisplayLabel: null,
        imageUrl: null,
        isFavorite: true,
      },
    });
    expect(suggestions[0].label).toContain("Cabana");
    expect(suggestions[0].reason).toContain("sucesso antes");
  });

  it("omite a preparação para dormir quando já passou do horário sugerido", () => {
    const suggestions = buildRoutineSuggestions(baseState, {
      now: new Date("2026-09-29T21:00:00"),
      typicalMealTimes: {},
      typicalBedtimeMinutes: 20 * 60, // 20h, e o lead time já ficou no passado às 21h
      playSuggestion: null,
    });
    expect(suggestions.some((s) => s.kind === "wind_down")).toBe(false);
  });

  it("omite a preparação para dormir sem nenhum histórico de sono noturno", () => {
    const suggestions = buildRoutineSuggestions(baseState, {
      now,
      typicalMealTimes: {},
      typicalBedtimeMinutes: null,
      playSuggestion: null,
    });
    expect(suggestions.some((s) => s.kind === "wind_down")).toBe(false);
  });
});
