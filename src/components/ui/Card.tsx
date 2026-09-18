import { type HTMLAttributes } from "react";

export function cardClassName(className = "") {
  return `rounded-sm border border-neutral bg-primary shadow-[var(--shadow-card)] ${className}`;
}

type CardProps = HTMLAttributes<HTMLElement> & { as?: "div" | "li" };

export function Card({ as: Tag = "div", className = "", ...props }: CardProps) {
  return <Tag className={cardClassName(className)} {...props} />;
}
