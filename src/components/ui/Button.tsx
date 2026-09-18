import { type ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const base =
  "inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2 text-sm font-semibold transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 active:translate-y-px";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-ink hover:shadow-[var(--shadow-lift)] hover:brightness-95",
  secondary: "border-[1.5px] border-neutral bg-transparent text-ink hover:bg-neutral/40",
  ghost: "text-ink-muted hover:bg-neutral/30 hover:text-ink",
  danger: "text-red-600 hover:bg-red-50 hover:text-red-700",
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
