import { PostHog } from "posthog-node";

// Cliente PostHog do lado do servidor — hoje usado só para AI
// Observability nas chamadas de IA (ver src/lib/groq/client.ts), mas é o
// ponto único de onde qualquer capture() futuro deveria vir, em vez de
// cada módulo instanciar o seu. Sem POSTHOG_API_KEY configurada, fica
// null e nada é enviado — analytics nunca deve derrubar a aplicação nem
// exigir configuração em ambientes onde ainda não faz sentido (dev local
// sem chave, preview, etc.).
let client: PostHog | null | undefined;

export function getPostHogClient(): PostHog | null {
  if (client !== undefined) return client;

  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) {
    client = null;
    return client;
  }

  client = new PostHog(apiKey, {
    host: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
    // flushAt: 1 (em vez do padrão, que empilha eventos e manda em lote)
    // — cada request de servidor aqui roda como função serverless
    // (Server Action/Route Handler), que pode encerrar antes do próximo
    // flush agendado acontecer. Enviar imediatamente evita perder
    // eventos de chamadas de IA de baixo volume.
    flushAt: 1,
  });

  return client;
}
