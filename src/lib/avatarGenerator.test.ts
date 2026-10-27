import { describe, it, expect } from "vitest";
import { buildAvatarPrompt } from "@/lib/avatarGenerator";
import { DEFAULT_AVATAR_ATTRIBUTES } from "@/lib/validation/avatar";

describe("buildAvatarPrompt", () => {
  it("descreve os atributos escolhidos em inglês, nunca como foto real", () => {
    const prompt = buildAvatarPrompt({
      skinTone: "morena",
      hairColor: "preto",
      hairStyle: "cacheado",
      eyeColor: "verde",
      vibe: "alegre",
    });

    expect(prompt).toContain("medium-brown skin");
    expect(prompt).toContain("curly black hair");
    expect(prompt).toContain("green eyes");
    expect(prompt).toContain("a big joyful smile");
    expect(prompt).toContain("Illustrated artwork, not a real photo");
  });

  it("nunca inclui texto/marca d'água no resultado pedido", () => {
    const prompt = buildAvatarPrompt(DEFAULT_AVATAR_ATTRIBUTES);
    expect(prompt).toContain("No text, no words, no letters, no watermark.");
  });
});
