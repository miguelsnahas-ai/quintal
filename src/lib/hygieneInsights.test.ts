import { describe, it, expect } from "vitest";
import { describeLeakInsight, getHygieneInsightMessages } from "./hygieneInsights";

const now = new Date("2026-09-29T12:00:00");

describe("describeLeakInsight", () => {
  it("returns null when there are no leaks in the window (never says '0 vazamentos')", () => {
    expect(describeLeakInsight([], 7, now)).toBeNull();
    expect(
      describeLeakInsight([{ occurredAt: "2026-09-28T10:00:00", condition: "normal" }], 7, now),
    ).toBeNull();
  });

  it("counts only leaks, ignoring other conditions", () => {
    const entries = [
      { occurredAt: "2026-09-28T10:00:00", condition: "leaked" as const },
      { occurredAt: "2026-09-27T10:00:00", condition: "full" as const },
      { occurredAt: "2026-09-26T10:00:00", condition: "leaked" as const },
    ];
    expect(describeLeakInsight(entries, 7, now)).toBe("2 vazamentos foram registrados nos últimos 7 dias.");
  });

  it("uses singular phrasing for exactly one leak", () => {
    const entries = [{ occurredAt: "2026-09-28T10:00:00", condition: "leaked" as const }];
    expect(describeLeakInsight(entries, 7, now)).toBe("1 vazamento foi registrado nos últimos 7 dias.");
  });

  it("ignores leaks outside the window", () => {
    const entries = [{ occurredAt: "2026-09-01T10:00:00", condition: "leaked" as const }];
    expect(describeLeakInsight(entries, 7, now)).toBeNull();
  });

  it("never mentions a cause or diagnosis — only the count", () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({
      occurredAt: `2026-09-2${i}T10:00:00`,
      condition: "leaked" as const,
    }));
    const text = describeLeakInsight(entries, 7, now) ?? "";
    expect(text.toLowerCase()).not.toMatch(/pequena|tamanho|trocar|diagnóstic|problema/);
  });
});

describe("getHygieneInsightMessages", () => {
  it("returns an empty array when nothing is worth saying", () => {
    expect(getHygieneInsightMessages([], 7, now)).toEqual([]);
  });

  it("includes the leak message when there are leaks", () => {
    const entries = [{ occurredAt: "2026-09-28T10:00:00", condition: "leaked" as const }];
    expect(getHygieneInsightMessages(entries, 7, now)).toHaveLength(1);
  });
});
