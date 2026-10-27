import { describe, it, expect } from "vitest";
import { buildOnboardingProgress } from "@/lib/onboardingProgress";

describe("buildOnboardingProgress", () => {
  it("nenhum item feito, tour não visto: nada concluído", () => {
    const progress = buildOnboardingProgress({
      tourCompletedAt: null,
      viewedTimelineAt: null,
      dismissedAt: null,
      hasEvent: false,
      hasChatMessage: false,
      hasMultipleCaregivers: false,
    });

    expect(progress.tourCompleted).toBe(false);
    expect(progress.dismissed).toBe(false);
    expect(progress.items).toEqual({ registrar: false, chat: false, timeline: false, convidar: false });
    expect(progress.allDone).toBe(false);
  });

  it("deriva cada item do dado real correspondente, nunca inventa", () => {
    const progress = buildOnboardingProgress({
      tourCompletedAt: "2026-10-01T00:00:00.000Z",
      viewedTimelineAt: "2026-10-02T00:00:00.000Z",
      dismissedAt: null,
      hasEvent: true,
      hasChatMessage: false,
      hasMultipleCaregivers: true,
    });

    expect(progress.tourCompleted).toBe(true);
    expect(progress.items).toEqual({ registrar: true, chat: false, timeline: true, convidar: true });
    expect(progress.allDone).toBe(false);
  });

  it("allDone só quando os quatro itens estão de verdade concluídos", () => {
    const progress = buildOnboardingProgress({
      tourCompletedAt: "2026-10-01T00:00:00.000Z",
      viewedTimelineAt: "2026-10-02T00:00:00.000Z",
      dismissedAt: null,
      hasEvent: true,
      hasChatMessage: true,
      hasMultipleCaregivers: true,
    });

    expect(progress.allDone).toBe(true);
  });

  it("dismissed reflete checklist_dismissed_at independentemente do allDone", () => {
    const progress = buildOnboardingProgress({
      tourCompletedAt: null,
      viewedTimelineAt: null,
      dismissedAt: "2026-10-03T00:00:00.000Z",
      hasEvent: false,
      hasChatMessage: false,
      hasMultipleCaregivers: false,
    });

    expect(progress.dismissed).toBe(true);
    expect(progress.allDone).toBe(false);
  });
});
