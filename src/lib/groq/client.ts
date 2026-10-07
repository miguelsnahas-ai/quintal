import OpenAI from "openai";
import { OpenAI as PostHogOpenAI } from "@posthog/ai/openai";
import { getPostHogClient } from "@/lib/posthog";

// Groq exposes an OpenAI-compatible Chat Completions API — reusing the
// official OpenAI SDK pointed at Groq's endpoint avoids a second SDK
// dependency for what is, from the client's perspective, the same
// request/response shape. Free tier, no credit card required.
//
// AI Observability (PostHog): quando POSTHOG_API_KEY está configurada,
// devolve o mesmo client só que extendido por @posthog/ai — ele grava um
// evento $ai_generation (modelo, tokens, latência, prompt/completion) a
// cada .chat.completions.create() automaticamente, sem precisar mudar
// nenhum dos 5 módulos que chamam createGroqClient(). Sem a chave,
// devolve o OpenAI client normal — nunca um segundo caminho de código
// para manter.
// Tipo de retorno anotado explicitamente como OpenAI (a classe-base): sem
// isto, o TypeScript infere uma UNIÃO entre OpenAI e a subclasse
// PostHogOpenAI (cada uma com overloads ligeiramente diferentes de
// chat.completions.create) e recusa chamar o método em qualquer um dos 5
// módulos que usam este client — a união de overloads não é chamável.
export function createGroqClient(): OpenAI {
  const posthog = getPostHogClient();

  if (!posthog) {
    return new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }

  // PostHogOpenAI estende OpenAI de verdade (upcast seguro em runtime) —
  // o cast é só porque o tipo de embeddings.create() de @posthog/ai não
  // bate exatamente com o da classe-base (bug de tipos do pacote, não
  // usado aqui: este projeto nunca chama .embeddings, só
  // .chat.completions.create, cujo tipo É compatível).
  return new PostHogOpenAI({
    apiKey: process.env.GROQ_API_KEY ?? "",
    baseURL: "https://api.groq.com/openai/v1",
    posthog,
  }) as unknown as OpenAI;
}
