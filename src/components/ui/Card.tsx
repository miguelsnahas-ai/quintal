import { type HTMLAttributes } from "react";

// rounded-lg (não rounded-sm): --radius-lg agora é o raio de card do
// design system (14px) — o mesmo valor que todo bloco "cartão" ad-hoc já
// usa em todo o app (`rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]`,
// o padrão mais comum do código). Este componente ficava inconsistente
// com esse padrão antes desta troca.
export function cardClassName(className = "") {
  return `rounded-lg border border-neutral bg-primary shadow-[var(--shadow-card)] ${className}`;
}

// Segundo tom do Card — cream, sem borda. ActivityCard, MealSuggestionCard,
// MaterialCard, UpcomingMoments e o tile com link do SummaryCard já usavam
// exatamente este visual, cada um reescrevendo a mesma string à mão; esta
// é essa string, com nome, para os cinco convergirem nela.
export function inviteCardClassName(className = "") {
  return `rounded-lg bg-secondary shadow-[var(--shadow-card)] ${className}`;
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
