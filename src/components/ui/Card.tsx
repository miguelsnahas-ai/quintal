import { type HTMLAttributes } from "react";

// rounded-lg (não rounded-sm): --radius-lg agora é o raio de card do
// design system (14px) — o mesmo valor que todo bloco "cartão" ad-hoc já
// usa em todo o app (`rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]`,
// o padrão mais comum do código). Este componente ficava inconsistente
// com esse padrão antes desta troca.
export function cardClassName(className = "") {
  return `rounded-lg border border-neutral bg-primary shadow-[var(--shadow-card)] ${className}`;
}

// Segundo tom do Card — linho, sem borda. ActivityCard, MealSuggestionCard,
// MaterialCard, UpcomingMoments e o tile com link do SummaryCard já usavam
// exatamente este visual, cada um reescrevendo a mesma string à mão; esta
// é essa string, com nome, para os cinco convergirem nela. `bg-surface`
// (linho, #efe7d6), não `bg-secondary` (creme, #faf5ea — o mesmo tom do
// fundo da página, `body` em globals.css): com a mesma cor do fundo, o
// card só se distinguia pela sombra, e ficava ilegível em telas/capturas
// onde a sombra não aparece — daí a queixa real de "tudo com o mesmo
// fundo". `bg-surface` já é o tom usado alhures (CopyInviteLink, hover do
// botão secundário) como "superfície elevada, ainda dentro da paleta
// creme" — mesma necessidade aqui.
export function inviteCardClassName(className = "") {
  return `rounded-lg bg-surface shadow-[var(--shadow-card)] ${className}`;
}

// Fragmento combinável para o hover de elevação — mesmos cinco lugares,
// quando o card é um link.
export const cardHoverLift = "transition-all duration-200 hover:shadow-[var(--shadow-lift)]";

type CardTone = "surface" | "invite";
type CardProps = HTMLAttributes<HTMLElement> & { as?: "div" | "li"; tone?: CardTone };

export function Card({ as: Tag = "div", tone = "surface", className = "", ...props }: CardProps) {
  const toClassName = tone === "invite" ? inviteCardClassName : cardClassName;
  return <Tag className={toClassName(className)} {...props} />;
}
