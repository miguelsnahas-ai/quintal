import type { Metadata } from "next";
import { Moon, Sun as PlayPlaceholder, Utensils, Sprout as GrowthPlaceholder, Droplet, Home as RoutinePlaceholder } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { QuintalIcon } from "@/components/icon/QuintalIcon";
import { QUINTAL_ICON_GROUPS } from "@/components/icon/quintalIconPaths";
import { QUINTAL_ICON_THEME_LABELS, QUINTAL_ICON_THEMES, type QuintalIconTheme } from "@/components/icon/quintalIconTheme";

export const metadata: Metadata = {
  title: "Ícones — Design System — Quintal Ops",
  robots: { index: false, follow: false },
};

// Página de validação visual (fase "Linguagem de ícones e ilustrações"):
// não é uma tela de produto, é onde a equipe compara os ícones novos
// (traço de giz desenhado à mão) com os atuais (geométricos, tipo
// biblioteca de UI) antes de decidir substituir qualquer coisa de
// verdade. Puramente estática — sem consulta ao banco, sem props vindos
// de fora — então renderiza igual em qualquer ambiente.
const LUCIDE_COMPARISON: Record<QuintalIconTheme, React.ComponentType<{ className?: string }>> = {
  sleep: Moon,
  play: PlayPlaceholder,
  meal: Utensils,
  growth: GrowthPlaceholder,
  hygiene: Droplet,
  routine: RoutinePlaceholder,
};

export default function IconsDesignSystemPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-lg font-bold text-ink">Ícones do Quintal</h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          Validação visual da nova linguagem de ícones — &ldquo;traço de giz desenhado à mão&rdquo;: orgânico,
          com pequenas imperfeições, nunca geométrico ou corporativo. Esta página não é produto —
          é onde avaliamos a consistência entre os seis domínios antes de substituir qualquer ícone
          de verdade (ver <code className="text-xs">docs/design-system.md</code> → Quintal
          Iconography).
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">Antes / depois</h2>
        <Card className="grid grid-cols-2 gap-6 p-5 sm:grid-cols-3 lg:grid-cols-6">
          {QUINTAL_ICON_THEMES.map((theme) => {
            const Lucide = LUCIDE_COMPARISON[theme];
            const firstIcon = QUINTAL_ICON_GROUPS[theme][0];
            return (
              <div key={theme} className="flex flex-col items-center gap-2 text-center">
                <div className="flex items-center gap-4">
                  <Lucide className="h-7 w-7 text-ink-muted" aria-hidden />
                  <QuintalIcon name={firstIcon} theme={theme} size="lg" />
                </div>
                <span className="text-xs text-ink-muted">{QUINTAL_ICON_THEME_LABELS[theme]}</span>
              </div>
            );
          })}
        </Card>
        <p className="text-xs text-ink-muted">À esquerda, o ícone Lucide atual (geométrico). À direita, o novo traço.</p>
      </section>

      {QUINTAL_ICON_THEMES.map((theme) => (
        <section key={theme} className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
              {QUINTAL_ICON_THEME_LABELS[theme]}
            </h2>
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: `var(--color-theme-${theme}-main)` }}
              aria-hidden
            />
          </div>

          <Card className="space-y-6 p-5">
            <div className="space-y-2">
              <p className="text-xs font-medium text-ink-muted">Sobre fundo neutro (uso comum — cartões/nav)</p>
              <div className="flex flex-wrap items-end gap-8">
                {QUINTAL_ICON_GROUPS[theme].map((iconName) => (
                  <div key={iconName} className="flex items-end gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <QuintalIcon name={iconName} theme={theme} size="sm" />
                      <span className="text-[10px] text-ink-muted">pequeno</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <QuintalIcon name={iconName} theme={theme} size="md" />
                      <span className="text-[10px] text-ink-muted">médio</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <QuintalIcon name={iconName} theme={theme} size="lg" />
                      <span className="text-[10px] text-ink-muted">grande</span>
                    </div>
                    <span className="self-center pl-1 text-xs text-ink-muted">{iconName}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 border-t border-neutral pt-4">
              <p className="text-xs font-medium text-ink-muted">
                Sobre o fundo claro do tema (selo/badge — traço muda para &ldquo;dark&rdquo; por contraste)
              </p>
              <div className="flex flex-wrap items-center gap-6">
                {QUINTAL_ICON_GROUPS[theme].map((iconName) => (
                  <div key={iconName} className="flex flex-col items-center gap-1">
                    <QuintalIcon name={iconName} theme={theme} size="lg" background="light" />
                    <span className="text-[10px] text-ink-muted">{iconName}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </section>
      ))}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink">Tokens de cor</h2>
        <Card className="divide-y divide-neutral">
          {QUINTAL_ICON_THEMES.map((theme) => (
            <div key={theme} className="flex flex-wrap items-center gap-4 px-4 py-3 text-xs">
              <span className="w-32 shrink-0 font-medium text-ink">{QUINTAL_ICON_THEME_LABELS[theme]}</span>
              {(["main", "light", "dark"] as const).map((shade) => (
                <span key={shade} className="flex items-center gap-1.5 text-ink-muted">
                  <span
                    className="h-4 w-4 rounded-full border border-neutral"
                    style={{ background: `var(--color-theme-${theme}-${shade})` }}
                    aria-hidden
                  />
                  {shade}
                </span>
              ))}
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
