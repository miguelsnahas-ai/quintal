import { describe, it, expect } from "vitest";
import { summarizeDailyTotals, describeSleepTrend, bucketIntoWeeks } from "./sleepInsights";

describe("summarizeDailyTotals", () => {
  const now = new Date("2026-09-29T12:00:00");

  it("returns one entry per day in the window, zero-filled when there's no data", () => {
    const totals = summarizeDailyTotals([], 3, now);
    expect(totals).toEqual([
      { date: "2026-09-27", napMinutes: 0, nightMinutes: 0 },
      { date: "2026-09-28", napMinutes: 0, nightMinutes: 0 },
      { date: "2026-09-29", napMinutes: 0, nightMinutes: 0 },
    ]);
  });

  it("sums multiple entries from the same day into the same bucket", () => {
    const totals = summarizeDailyTotals(
      [
        { occurredAt: "2026-09-29T09:00:00", sleepType: "nap", durationMinutes: 30 },
        { occurredAt: "2026-09-29T14:00:00", sleepType: "nap", durationMinutes: 40 },
        { occurredAt: "2026-09-28T20:00:00", sleepType: "night", durationMinutes: 500 },
      ],
      2,
      now,
    );
    expect(totals).toEqual([
      { date: "2026-09-28", napMinutes: 0, nightMinutes: 500 },
      { date: "2026-09-29", napMinutes: 70, nightMinutes: 0 },
    ]);
  });

  it("ignores entries still in progress (durationMinutes null) or without a known sleep type", () => {
    const totals = summarizeDailyTotals(
      [
        { occurredAt: "2026-09-29T09:00:00", sleepType: "nap", durationMinutes: null },
        { occurredAt: "2026-09-29T10:00:00", sleepType: null, durationMinutes: 45 },
      ],
      1,
      now,
    );
    expect(totals).toEqual([{ date: "2026-09-29", napMinutes: 0, nightMinutes: 0 }]);
  });
});

describe("bucketIntoWeeks", () => {
  it("sums 7-day blocks, labeling each by the last day in the block", () => {
    const totals = summarizeDailyTotals([], 14, new Date("2026-09-29T12:00:00"));
    const buckets = bucketIntoWeeks(totals);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].date).toBe(totals[6].date);
    expect(buckets[1].date).toBe(totals[13].date);
  });

  it("adds up minutes across the bucketed days", () => {
    const totals = [
      { date: "d1", napMinutes: 30, nightMinutes: 500 },
      { date: "d2", napMinutes: 20, nightMinutes: 480 },
    ];
    expect(bucketIntoWeeks(totals)).toEqual([{ date: "d2", napMinutes: 50, nightMinutes: 980 }]);
  });
});

describe("describeSleepTrend", () => {
  it("returns null without at least 3 nights of data (never guesses from too little)", () => {
    expect(describeSleepTrend([{ date: "d1", napMinutes: 0, nightMinutes: 500 }])).toBeNull();
    expect(
      describeSleepTrend([
        { date: "d1", napMinutes: 0, nightMinutes: 500 },
        { date: "d2", napMinutes: 0, nightMinutes: 0 },
      ]),
    ).toBeNull();
  });

  it("describes a stable routine when nightly totals barely vary", () => {
    const totals = [500, 510, 495, 505].map((nightMinutes, i) => ({
      date: `d${i}`,
      napMinutes: 0,
      nightMinutes,
    }));
    expect(describeSleepTrend(totals)).toMatch(/relativamente estável/);
  });

  it("describes a variable routine when nightly totals swing a lot", () => {
    const totals = [300, 600, 350, 580].map((nightMinutes, i) => ({
      date: `d${i}`,
      napMinutes: 0,
      nightMinutes,
    }));
    expect(describeSleepTrend(totals)).toMatch(/variaram mais/);
  });

  it("never mentions medical/diagnostic language", () => {
    const totals = [300, 600, 350, 580].map((nightMinutes, i) => ({
      date: `d${i}`,
      napMinutes: 0,
      nightMinutes,
    }));
    const text = describeSleepTrend(totals) ?? "";
    expect(text.toLowerCase()).not.toMatch(/diagnóstic|anormal|problema|médic|insônia|distúrbio/);
  });
});
