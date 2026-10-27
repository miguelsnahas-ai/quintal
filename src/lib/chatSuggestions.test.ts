import { describe, it, expect } from "vitest";
import { getSuggestedChatQuestions, hasNoRegistrationsToday, type TodayEventCounts } from "@/lib/chatSuggestions";

function counts(overrides: Partial<TodayEventCounts> = {}): TodayEventCounts {
  return { sleepCount: 0, mealCount: 0, freePlayCount: 0, routineCount: 0, ...overrides };
}

describe("getSuggestedChatQuestions", () => {
  it("sugere perguntas sobre o que ainda não foi registrado hoje", () => {
    const questions = getSuggestedChatQuestions(counts({ sleepCount: 2, mealCount: 1 }));
    expect(questions).toContain("Quais brincadeiras fizeram mais sucesso hoje?");
    expect(questions).toContain("Teve algum evento de rotina pra contar?");
    expect(questions).not.toContain("Como foi o sono hoje?");
    expect(questions).not.toContain("Como foi a alimentação hoje?");
  });

  it("nunca passa de 3 perguntas, mesmo com todas as categorias vazias", () => {
    const questions = getSuggestedChatQuestions(counts());
    expect(questions).toHaveLength(3);
  });

  it("completa com perguntas genéricas quando há só uma ou duas lacunas", () => {
    const questions = getSuggestedChatQuestions(counts({ sleepCount: 1, mealCount: 1, freePlayCount: 1 }));
    expect(questions).toHaveLength(3);
    expect(questions[0]).toBe("Teve algum evento de rotina pra contar?");
  });

  it("usa só perguntas genéricas quando tudo já foi registrado hoje", () => {
    const questions = getSuggestedChatQuestions(
      counts({ sleepCount: 1, mealCount: 1, freePlayCount: 1, routineCount: 1 }),
    );
    expect(questions).toHaveLength(3);
    expect(questions).toEqual([
      "Quer sugestões de brincadeira pra agora?",
      "Tem alguma dúvida sobre a rotina de hoje?",
      "Quer registrar mais alguma coisa sobre o dia?",
    ]);
  });
});

describe("hasNoRegistrationsToday", () => {
  it("é true só quando todas as categorias estão zeradas", () => {
    expect(hasNoRegistrationsToday(counts())).toBe(true);
  });

  it("é false assim que qualquer categoria tem pelo menos um registro", () => {
    expect(hasNoRegistrationsToday(counts({ mealCount: 1 }))).toBe(false);
    expect(hasNoRegistrationsToday(counts({ routineCount: 1 }))).toBe(false);
  });
});
