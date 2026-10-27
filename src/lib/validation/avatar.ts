import { z } from "zod";

// ---------------------------------------------------------------------
// Módulo de avatar em IA (pedido explícito): "uma imagem que seja
// parecida com o filho, selecionada com base em alguns atributos
// selecionáveis". O produto não tem upload de foto nenhum — então a
// única forma honesta de cumprir isso é gerar uma ILUSTRAÇÃO a partir de
// atributos escolhidos pela família, nunca fingir reconstruir o rosto
// real de ninguém (ver avatarGenerator.ts, que explicita isso no
// prompt). Mesmo critério de childRoutinePreference/childActivityStyle
// (validation/profile.ts): vocabulário fixo, rótulo pt-BR explícito —
// mas aqui cada opção também carrega um DESCRITOR em inglês, porque o
// prompt enviado ao modelo de imagem é em inglês (melhor fidelidade),
// enquanto a UI é toda em pt-BR.
// ---------------------------------------------------------------------

export const avatarSkinTones = ["clara", "morena_clara", "morena", "escura"] as const;
export type AvatarSkinTone = (typeof avatarSkinTones)[number];
export const avatarSkinToneLabels: Record<AvatarSkinTone, string> = {
  clara: "Clara",
  morena_clara: "Morena clara",
  morena: "Morena",
  escura: "Escura",
};
export const avatarSkinToneDescriptors: Record<AvatarSkinTone, string> = {
  clara: "light skin",
  morena_clara: "light-medium skin",
  morena: "medium-brown skin",
  escura: "dark skin",
};

export const avatarHairColors = ["preto", "castanho", "castanho_claro", "ruivo", "loiro"] as const;
export type AvatarHairColor = (typeof avatarHairColors)[number];
export const avatarHairColorLabels: Record<AvatarHairColor, string> = {
  preto: "Preto",
  castanho: "Castanho",
  castanho_claro: "Castanho claro",
  ruivo: "Ruivo",
  loiro: "Loiro",
};
export const avatarHairColorDescriptors: Record<AvatarHairColor, string> = {
  preto: "black",
  castanho: "brown",
  castanho_claro: "light brown",
  ruivo: "red",
  loiro: "blonde",
};

export const avatarHairStyles = ["liso", "ondulado", "cacheado", "crespo", "careca"] as const;
export type AvatarHairStyle = (typeof avatarHairStyles)[number];
export const avatarHairStyleLabels: Record<AvatarHairStyle, string> = {
  liso: "Liso",
  ondulado: "Ondulado",
  cacheado: "Cacheado",
  crespo: "Crespo",
  careca: "Sem cabelo",
};
export const avatarHairStyleDescriptors: Record<AvatarHairStyle, string> = {
  liso: "straight",
  ondulado: "wavy",
  cacheado: "curly",
  crespo: "coily",
  careca: "no hair, bald",
};

export const avatarEyeColors = ["castanho", "preto", "verde", "azul", "mel"] as const;
export type AvatarEyeColor = (typeof avatarEyeColors)[number];
export const avatarEyeColorLabels: Record<AvatarEyeColor, string> = {
  castanho: "Castanho",
  preto: "Preto",
  verde: "Verde",
  azul: "Azul",
  mel: "Mel",
};
export const avatarEyeColorDescriptors: Record<AvatarEyeColor, string> = {
  castanho: "brown",
  preto: "dark brown",
  verde: "green",
  azul: "blue",
  mel: "hazel",
};

// "Vibe": expressão/personalidade do avatar — não é um dado real sobre a
// criança, só o tom da ilustração que a família prefere.
export const avatarVibes = ["alegre", "tranquilo", "aventureiro", "sonhador"] as const;
export type AvatarVibe = (typeof avatarVibes)[number];
export const avatarVibeLabels: Record<AvatarVibe, string> = {
  alegre: "Alegre",
  tranquilo: "Tranquilo",
  aventureiro: "Aventureiro",
  sonhador: "Sonhador",
};
export const avatarVibeDescriptors: Record<AvatarVibe, string> = {
  alegre: "a big joyful smile",
  tranquilo: "a calm, gentle expression",
  aventureiro: "an excited, curious expression",
  sonhador: "a dreamy, soft expression",
};

export type AvatarAttributes = {
  skinTone: AvatarSkinTone;
  hairColor: AvatarHairColor;
  hairStyle: AvatarHairStyle;
  eyeColor: AvatarEyeColor;
  vibe: AvatarVibe;
};

export const DEFAULT_AVATAR_ATTRIBUTES: AvatarAttributes = {
  skinTone: avatarSkinTones[0],
  hairColor: avatarHairColors[0],
  hairStyle: avatarHairStyles[0],
  eyeColor: avatarEyeColors[0],
  vibe: avatarVibes[0],
};

export const avatarAttributesInputSchema = z.object({
  skinTone: z.enum(avatarSkinTones),
  hairColor: z.enum(avatarHairColors),
  hairStyle: z.enum(avatarHairStyles),
  eyeColor: z.enum(avatarEyeColors),
  vibe: z.enum(avatarVibes),
});
