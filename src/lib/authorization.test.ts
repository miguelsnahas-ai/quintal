import { describe, it, expect } from "vitest";
import { canRemoveCaregiverRole } from "./authorization";

// Regra central por trás de "remover cuidador" (familyContext.ts's
// removeCaregiver): uma família nunca pode ficar sem administrador.
describe("canRemoveCaregiverRole", () => {
  it("nunca permite remover um owner (a família não pode ficar sem administrador)", () => {
    expect(canRemoveCaregiverRole("owner")).toBe(false);
  });

  it("permite remover um cuidador comum", () => {
    expect(canRemoveCaregiverRole("caregiver")).toBe(true);
  });
});
