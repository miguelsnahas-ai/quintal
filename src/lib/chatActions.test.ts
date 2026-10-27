import { describe, it, expect } from "vitest";
import {
  planSleepDispatch,
  planMealDispatch,
  planPlayDispatch,
  planPreferenceDispatch,
  planNoteDispatch,
  matchesAffirmativeConfirmation,
} from "./chatActions";

describe("planSleepDispatch", () => {
  it("asks for confirmation when both start and end are given (a complete retroactive report)", () => {
    const plan = planSleepDispatch(
      { sleepType: null, startedAt: "2026-09-29T14:00", endedAt: "2026-09-29T15:20" },
      false,
    );
    expect(plan.kind).toBe("confirm_complete");
    if (plan.kind === "confirm_complete") {
      expect(plan.startedAt).toBe("2026-09-29T14:00");
      expect(plan.endedAt).toBe("2026-09-29T15:20");
      // 14h vira "nap" pelo heurístico de guessSleepType — não é sono
      // noturno, e nada no exemplo diz o contrário.
      expect(plan.sleepType).toBe("nap");
    }
  });

  it("records a start-only message directly when there is no open session", () => {
    const plan = planSleepDispatch({ sleepType: "nap", startedAt: "2026-09-29T14:00", endedAt: null }, false);
    expect(plan).toEqual({ kind: "start", sleepType: "nap", startedAt: "2026-09-29T14:00" });
  });

  it("treats a start-only message as insufficient when a session is already open (never opens a second one)", () => {
    const plan = planSleepDispatch({ sleepType: "nap", startedAt: "2026-09-29T14:00", endedAt: null }, true);
    expect(plan).toEqual({ kind: "insufficient" });
  });

  it("closes an open session on an end-only message", () => {
    const plan = planSleepDispatch({ sleepType: null, startedAt: null, endedAt: "2026-09-29T15:20" }, true);
    expect(plan).toEqual({ kind: "end", endedAt: "2026-09-29T15:20" });
  });

  it("has nothing to close on an end-only message with no open session", () => {
    const plan = planSleepDispatch({ sleepType: null, startedAt: null, endedAt: "2026-09-29T15:20" }, false);
    expect(plan).toEqual({ kind: "insufficient" });
  });

  it("is insufficient with no times at all", () => {
    expect(planSleepDispatch({ sleepType: "night", startedAt: null, endedAt: null }, false)).toEqual({
      kind: "insufficient",
    });
  });

  it("ignores an unparseable date string", () => {
    expect(planSleepDispatch({ sleepType: null, startedAt: "não sei que horas", endedAt: null }, false)).toEqual({
      kind: "insufficient",
    });
  });

  it("infers night for a late start hour", () => {
    const plan = planSleepDispatch({ sleepType: null, startedAt: "2026-09-29T20:30", endedAt: null }, false);
    expect(plan.kind === "start" && plan.sleepType).toBe("night");
  });
});

describe("planMealDispatch", () => {
  it("records when foods are given, guessing the slot from the time", () => {
    const plan = planMealDispatch({
      slot: null,
      foods: ["arroz", "feijão", "abóbora"],
      acceptance: null,
      occurredAt: "2026-09-29T12:30",
    });
    expect(plan).toEqual({
      kind: "record",
      slot: "lunch",
      foods: ["arroz", "feijão", "abóbora"],
      acceptance: "unknown",
      occurredAt: "2026-09-29T12:30",
    });
  });

  it("records when only a slot is given, with no foods", () => {
    const plan = planMealDispatch({ slot: "breakfast", foods: [], acceptance: null, occurredAt: null });
    expect(plan.kind).toBe("record");
  });

  it("is insufficient with neither foods nor a slot", () => {
    expect(planMealDispatch({ slot: null, foods: [], acceptance: null, occurredAt: null })).toEqual({
      kind: "insufficient",
    });
  });
});

describe("planPlayDispatch", () => {
  it("records a freeform activity with duration and no feedback (never invents a reaction)", () => {
    const plan = planPlayDispatch({
      activityTitle: "Empilhar blocos",
      durationMinutes: 20,
      feedback: null,
      occurredAt: null,
    });
    expect(plan.kind).toBe("record");
    if (plan.kind === "record") {
      expect(plan.activityTitle).toBe("Empilhar blocos");
      expect(plan.durationMinutes).toBe(20);
      expect(plan.feedback).toBeNull();
    }
  });

  it("is insufficient with no activity title", () => {
    expect(planPlayDispatch({ activityTitle: null, durationMinutes: 20, feedback: null, occurredAt: null })).toEqual({
      kind: "insufficient",
    });
  });
});

describe("planPreferenceDispatch / planNoteDispatch", () => {
  it("always routes a preference through confirmation, never straight to insufficient with real text", () => {
    expect(planPreferenceDispatch({ category: "play", note: "Não gosta de barulho" }).kind).toBe("confirm");
  });

  it("is insufficient with an empty note", () => {
    expect(planPreferenceDispatch({ category: "play", note: "   " }).kind).toBe("insufficient");
  });

  it("records a note with text", () => {
    expect(planNoteDispatch({ kind: "observation", text: "Primeira vez que ficou de pé sozinha" }).kind).toBe(
      "record",
    );
  });

  it("is insufficient with empty note text", () => {
    expect(planNoteDispatch({ kind: "observation", text: "" }).kind).toBe("insufficient");
  });
});

describe("matchesAffirmativeConfirmation", () => {
  it.each(["sim", "Sim!", "pode", "confirma", "isso mesmo", "ok"])("accepts %s", (text) => {
    expect(matchesAffirmativeConfirmation(text)).toBe(true);
  });

  it.each(["não", "nao, espera", "talvez", "oi", ""])("rejects %s", (text) => {
    expect(matchesAffirmativeConfirmation(text)).toBe(false);
  });
});
