import Link from "next/link";
import { Sparkles, Blocks, MapPin, Utensils, Moon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { inviteCardClassName, cardHoverLift } from "@/components/ui/Card";
import type { RoutineSuggestion, RoutineSuggestionKind } from "@/lib/routineEngine";

const ICONS: Record<RoutineSuggestionKind, LucideIcon> = {
  play: Blocks,
  outing: MapPin,
  meal: Utensils,
  wind_down: Moon,
};

// "Próximos momentos" (Fase 14) — uma leitura leve da rotina adaptativa,
// nunca uma agenda: cada linha é uma possibilidade, com o motivo por
// trás dela sempre visível, e um link para o módulo onde a família pode
// de fato agir (registrar, ver sugestões de verdade, etc.). O texto de
// abertura é deliberado — "Uma possibilidade para o resto do dia", não
// "Sua agenda de hoje".
export default function UpcomingMoments({ suggestions }: { suggestions: RoutineSuggestion[] }) {
  if (suggestions.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink-muted">
          <Sparkles className="h-4 w-4" aria-hidden />
          Próximos momentos
        </h2>
        <Link href="/quintal/timeline" className="text-xs font-medium text-ink underline underline-offset-2">
          Ver agenda completa
        </Link>
      </div>
      <p className="text-xs text-ink-muted">
        Uma possibilidade para o restante do dia — não um compromisso. Vocês sabem melhor o que
        faz sentido agora.
      </p>
      <ol className="space-y-2">
        {suggestions.map((suggestion) => {
          const Icon = ICONS[suggestion.kind];
          return (
            <li key={suggestion.id}>
              <Link href={suggestion.href} className={inviteCardClassName(`flex items-start gap-3 p-3 ${cardHoverLift}`)}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent">
                  <Icon className="h-4 w-4 text-ink" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">{suggestion.label}</p>
                    <span className="shrink-0 font-mono text-xs text-ink-muted">
                      {new Date(suggestion.suggestedAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted">{suggestion.reason}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
