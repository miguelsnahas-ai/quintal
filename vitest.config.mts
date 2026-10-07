import { defineConfig } from "vitest/config";
import path from "node:path";

// Mesmo alias "@/*" → "./src/*" do tsconfig.json — vitest não lê
// tsconfig paths por conta própria, então precisa do próprio resolve.
// Escopo desta fase é só a camada de regras (src/lib/**/*.test.ts),
// puras e sem Supabase/Next — nenhum ambiente de browser/DOM necessário.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
  },
});
