import OpenAI from "openai";
import { randomUUID } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import {
  avatarSkinToneDescriptors,
  avatarHairColorDescriptors,
  avatarHairStyleDescriptors,
  avatarEyeColorDescriptors,
  avatarVibeDescriptors,
  type AvatarAttributes,
} from "@/lib/validation/avatar";

// ---------------------------------------------------------------------
// Módulo de avatar em IA (pedido explícito, ver validation/avatar.ts
// para o vocabulário de atributos). Decisões:
//
// 1. ILUSTRAÇÃO, não foto: o produto não tem upload de foto da criança,
//    então não há nada "real" para a IA reconstruir — gerar algo que
//    fingisse ser uma foto seria inventar uma aparência que ninguém
//    forneceu. O prompt é explícito sobre isso ("illustrated artwork,
//    not a real photo"), no mesmo espírito "traço de giz" que já é a
//    identidade visual do produto (QuintalIcon).
// 2. OpenAI de verdade (gpt-image-1), chave própria (OPENAI_API_KEY) —
//    diferente de createGroqClient (groq/client.ts), que usa a SDK da
//    OpenAI só porque a API do Groq é compatível; aqui é o serviço de
//    imagem da própria OpenAI.
// 3. Supabase Storage para o resultado: bucket público "avatars" (ver a
//    migration), escrito sempre pelo service client (bypassa RLS, nunca
//    client-side) — mesmo padrão de toda escrita deste projeto.
// 4. Rate limit (5/dia, pedido explícito): por child_id quando a
//    criança já existe; por caregiver_id (só entre tentativas sem
//    criança ainda) durante o onboarding, antes da criança ser criada —
//    ver countGenerationsToday.
// ---------------------------------------------------------------------

export const AVATAR_DAILY_GENERATION_LIMIT = 5;

export class AvatarGenerationLimitError extends Error {}
export class AvatarGenerationNotConfiguredError extends Error {}

// Pura — monta o prompt em inglês (melhor fidelidade do modelo de
// imagem; a UI em pt-BR nunca mostra este texto) a partir dos atributos
// escolhidos. Testável sem rede nem chave de API.
export function buildAvatarPrompt(attributes: AvatarAttributes): string {
  const skin = avatarSkinToneDescriptors[attributes.skinTone];
  const hairColor = avatarHairColorDescriptors[attributes.hairColor];
  const hairStyle = avatarHairStyleDescriptors[attributes.hairStyle];
  const eyes = avatarEyeColorDescriptors[attributes.eyeColor];
  const expression = avatarVibeDescriptors[attributes.vibe];

  return [
    "A warm, hand-drawn children's-book illustration portrait avatar of a young child, chalk-and-watercolor style, soft pastel background.",
    `The child has ${skin}, ${hairStyle} ${hairColor} hair, ${eyes} eyes, and ${expression}.`,
    "Simple, friendly, gentle features. Square portrait, head and shoulders, centered, clean illustration suitable for a small circular profile picture.",
    "Illustrated artwork, not a real photo. No text, no words, no letters, no watermark.",
  ].join(" ");
}

type RateLimitScope = { childId: string } | { caregiverId: string };

function startOfToday(now: Date): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

async function countGenerationsToday(scope: RateLimitScope, now: Date): Promise<number> {
  const supabase = createServiceClient();
  const since = startOfToday(now).toISOString();

  const base = supabase.from("child_avatar_generations").select("id", { count: "exact", head: true }).gte("created_at", since);
  const { count, error } =
    "childId" in scope ? await base.eq("child_id", scope.childId) : await base.eq("caregiver_id", scope.caregiverId).is("child_id", null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export type GenerateChildAvatarInput = {
  // null durante o onboarding, antes da criança existir — ver o
  // comentário no topo do arquivo sobre o escopo do rate limit nesse caso.
  childId: string | null;
  caregiverId: string;
  attributes: AvatarAttributes;
  now?: Date;
};

// Único ponto assíncrono do módulo: checa o limite, chama a OpenAI, sobe
// o resultado pro Storage, registra o uso e — só quando a criança já
// existe — persiste os atributos e o novo avatar_url. Durante o
// onboarding (childId null), só devolve a URL: quem chama decide onde
// colocar (o mesmo campo avatar_url do formulário de criação).
export async function generateAndStoreChildAvatar(input: GenerateChildAvatarInput): Promise<{ url: string }> {
  const now = input.now ?? new Date();
  const scope: RateLimitScope = input.childId ? { childId: input.childId } : { caregiverId: input.caregiverId };

  const usedToday = await countGenerationsToday(scope, now);
  if (usedToday >= AVATAR_DAILY_GENERATION_LIMIT) {
    throw new AvatarGenerationLimitError(
      `Limite de ${AVATAR_DAILY_GENERATION_LIMIT} gerações de avatar por dia atingido. Tente de novo mais tarde.`,
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new AvatarGenerationNotConfiguredError("Geração de avatar por IA ainda não está configurada.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = buildAvatarPrompt(input.attributes);
  const result = await client.images.generate({ model: "gpt-image-1", prompt, size: "1024x1024", n: 1 });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("A geração da imagem não retornou um resultado válido.");
  }

  const supabase = createServiceClient();
  const path = `${input.childId ?? "onboarding"}/${randomUUID()}.png`;
  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, Buffer.from(b64, "base64"), {
    contentType: "image/png",
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = publicUrlData.publicUrl;

  const { error: logError } = await supabase
    .from("child_avatar_generations")
    .insert({ child_id: input.childId, caregiver_id: input.caregiverId });
  if (logError) throw new Error(logError.message);

  if (input.childId) {
    const { error: attributesError } = await supabase.from("child_avatar_attributes").upsert({
      child_id: input.childId,
      skin_tone: input.attributes.skinTone,
      hair_color: input.attributes.hairColor,
      hair_style: input.attributes.hairStyle,
      eye_color: input.attributes.eyeColor,
      vibe: input.attributes.vibe,
      updated_at: now.toISOString(),
    });
    if (attributesError) throw new Error(attributesError.message);

    const { error: childError } = await supabase.from("children").update({ avatar_url: url }).eq("id", input.childId);
    if (childError) throw new Error(childError.message);
  }

  return { url };
}

// Últimos atributos escolhidos para esta criança — só para pré-selecionar
// o formulário (não é "o avatar atual", isso é children.avatar_url).
// Ausência de linha (nunca gerou ainda) vira null, nunca um valor
// inventado.
export async function getChildAvatarAttributes(childId: string): Promise<AvatarAttributes | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("child_avatar_attributes")
    .select("skin_tone, hair_color, hair_style, eye_color, vibe")
    .eq("child_id", childId)
    .maybeSingle();

  if (!data) return null;

  return {
    skinTone: data.skin_tone as AvatarAttributes["skinTone"],
    hairColor: data.hair_color as AvatarAttributes["hairColor"],
    hairStyle: data.hair_style as AvatarAttributes["hairStyle"],
    eyeColor: data.eye_color as AvatarAttributes["eyeColor"],
    vibe: data.vibe as AvatarAttributes["vibe"],
  };
}
