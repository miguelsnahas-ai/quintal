"use client";

import { Sprout } from "lucide-react";
import { Button } from "@/components/ui/Button";

// Limite de erro de /quintal/* (exigência do Next.js: precisa ser client
// component). Estado de "erro" pedido explicitamente nesta refatoração —
// sem linguagem técnica/alarmante, e com um jeito real de tentar de novo
// em vez de um beco sem saída.
export default function QuintalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center px-4 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
        <Sprout className="h-6 w-6 text-ink" aria-hidden />
      </span>
      <div className="mt-6 space-y-2">
        <h1 className="text-lg font-bold text-ink">Algo não carregou direito</h1>
        <p className="text-sm text-ink-muted">
          Foi só um tropeço por aqui — seus registros estão salvos. Vale tentar de novo.
        </p>
      </div>
      <Button type="button" onClick={reset} className="mt-6 w-full justify-center">
        Tentar de novo
      </Button>
    </div>
  );
}
