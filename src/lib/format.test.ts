import { describe, it, expect } from "vitest";
import { formatDurationMinutes, dayLabel } from "@/lib/format";

// Smoke test: confirma que o setup do Vitest (config, alias "@/") está
// funcionando, cobrindo de brinde uma função pura já existente que
// nunca tinha teste automatizado.
describe("formatDurationMinutes", () => {
  it("mostra só minutos quando dá menos de uma hora", () => {
    expect(formatDurationMinutes(45)).toBe("45min");
  });

  it("mostra só horas quando é exato", () => {
    expect(formatDurationMinutes(120)).toBe("2h");
  });

  it("mostra horas e minutos com dois dígitos", () => {
    expect(formatDurationMinutes(95)).toBe("1h35");
  });
});

describe("dayLabel", () => {
  it("identifica hoje", () => {
    expect(dayLabel(new Date().toISOString())).toBe("Hoje");
  });

  it("identifica ontem", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(dayLabel(yesterday.toISOString())).toBe("Ontem");
  });
});
