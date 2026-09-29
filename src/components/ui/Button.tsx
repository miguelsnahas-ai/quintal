import { type ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

// Pill radius — "pill for buttons, chips and avatars" (design system).
// Sem min-height forçada: muitas chamadas já sobrescrevem padding para
// botões compactos inline (ex.: "Confirmar remoção" em listas) — uma
// altura mínima fixa quebraria esses contextos.
const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 active:translate-y-px";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-ink font-bold hover:shadow-[var(--shadow-lift)] hover:brightness-95",
  secondary: "border-[1.5px] border-border-strong bg-transparent text-ink hover:bg-surface",
  ghost: "text-ink-muted hover:bg-neutral/30 hover:text-ink",
  danger: "text-danger hover:bg-danger/10",
};

// For non-<button> elements that need the same look (e.g. a Next.js
// <Link> styled as a button).
export function buttonClassName(variant: ButtonVariant = "primary", className = "") {
  return `${base} ${variants[variant]} ${className}`;
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }
>(({ variant = "primary", className = "", ...props }, ref) => (
  <button ref={ref} className={`${base} ${variants[variant]} ${className}`} {...props} />
));
Button.displayName = "Button";
