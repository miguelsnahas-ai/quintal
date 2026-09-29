import { describe, it, expect } from "vitest";
import { resolveActiveChild, type AccessibleChild } from "./activeChild";

const laura: AccessibleChild = { id: "laura", name: "Laura", birthDate: "2025-01-01" };
const pedro: AccessibleChild = { id: "pedro", name: "Pedro", birthDate: "2022-01-01" };

describe("resolveActiveChild", () => {
  it("returns null when the caregiver has no accessible children", () => {
    expect(resolveActiveChild([], undefined)).toBeNull();
  });

  it("falls back to the first (oldest) child when there is no cookie", () => {
    expect(resolveActiveChild([laura, pedro], undefined)).toBe(laura);
  });

  it("honors the cookie when it matches an accessible child", () => {
    expect(resolveActiveChild([laura, pedro], "pedro")).toBe(pedro);
  });

  it("falls back to the first child when the cookie points at a child not in the list (tampered, stale, or access revoked)", () => {
    expect(resolveActiveChild([laura, pedro], "some-other-childs-id")).toBe(laura);
  });

  it("falls back to the only child when there is exactly one, regardless of the cookie", () => {
    expect(resolveActiveChild([pedro], "laura")).toBe(pedro);
  });
});
