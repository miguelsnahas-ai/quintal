// Seis domínios do Quintal, cada um com sua cor (ver docs/design-system.md
// #Quintal Iconography e --palette-theme-* em globals.css). "main" é o
// traço do ícone sobre uma superfície neutra (cartão branco/creme — o
// caso comum no produto). "light" é o fundo de um selo/badge quando o
// ícone aparece sobre uma mancha de cor do próprio domínio. "dark" é
// reserva de contraste: usada como traço quando o fundo é "light",
// nunca como traço sobre superfície neutra (ver QuintalIcon — o traço
// main sobre a mancha light mede ~2:1 de contraste, abaixo do mínimo de
// 3:1 para elementos gráficos; dark sobre light mede ~3.3–4.2:1).
export type QuintalIconTheme = "sleep" | "play" | "meal" | "growth" | "hygiene" | "routine";

export const QUINTAL_ICON_THEME_LABELS: Record<QuintalIconTheme, string> = {
  sleep: "Sono",
  play: "Brincar",
  meal: "Comer",
  growth: "Desenvolvimento",
  hygiene: "Higiene",
  routine: "Rotina",
};

export const QUINTAL_ICON_THEMES: QuintalIconTheme[] = ["sleep", "play", "meal", "growth", "hygiene", "routine"];

export function themeMainVar(theme: QuintalIconTheme): string {
  return `var(--color-theme-${theme}-main)`;
}

export function themeLightVar(theme: QuintalIconTheme): string {
  return `var(--color-theme-${theme}-light)`;
}

export function themeDarkVar(theme: QuintalIconTheme): string {
  return `var(--color-theme-${theme}-dark)`;
}
