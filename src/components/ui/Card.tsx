import { type HTMLAttributes } from "react";

// rounded-lg (não rounded-sm): --radius-lg agora é o raio de card do
// design system (14px) — o mesmo valor que todo bloco "cartão" ad-hoc já
// usa em todo o app (`rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]`,
// o padrão mais comum do código). Este componente ficava inconsistente
// com esse padrão antes desta troca.
export function cardClassName(className = "") {
  return `rounded-lg border border-neutral bg-primary shadow-[var(--shadow-card)] ${className}`;
}

type CardProps = HTMLAttributes<HTMLElement> & { as?: "div" | "li" };

export function Card({ as: Tag = "div", className = "", ...props }: CardProps) {
  return <Tag className={cardClassName(className)} {...props} />;
}
