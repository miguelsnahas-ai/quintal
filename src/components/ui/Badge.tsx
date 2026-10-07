import { type HTMLAttributes } from "react";

type BadgeVariant = "neutral" | "accent" | "success" | "decorative";

const variants: Record<BadgeVariant, string> = {
  neutral: "bg-neutral/50 text-ink-muted",
  accent: "bg-accent text-ink",
  success: "bg-success/50 text-ink",
  decorative: "bg-decorative/30 text-ink",
};

export function Badge({
  variant = "neutral",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
