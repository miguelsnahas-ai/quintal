import OpenAI from "openai";

// Groq exposes an OpenAI-compatible Chat Completions API — reusing the
// official OpenAI SDK pointed at Groq's endpoint avoids a second SDK
// dependency for what is, from the client's perspective, the same
// request/response shape. Free tier, no credit card required.
export function createGroqClient() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
}
