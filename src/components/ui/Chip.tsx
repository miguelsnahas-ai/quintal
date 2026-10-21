import Link from "next/link";
import { type ButtonHTMLAttributes } from "react";

// Um "pill" selecionado/não-selecionado — filtro, opção entre várias,
// tab. Antes desta troca, cada tela reescrevia a mesma string à mão:
// FilterChip (Timeline), a linha de abas de SettingsTabs, os botões de
// RecommendationFeedback e LogActivityOutcome. `chipClassName` é essa
// string com nome; `Chip` a embala num elemento (link, botão ou span)
// pronto pra usar.
export function chipClassName(selected = false, className = "") {
  return `inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${
    selected ? "bg-accent text-ink" : "border-[1.5px] border-neutral text-ink-muted hover:bg-neutral/40 hover:text-ink"
  } ${className}`;
}

type ChipBaseProps = { selected?: boolean; className?: string; children: React.ReactNode };

type ChipProps =
  | (ChipBaseProps & { href: string; onClick?: never })
  | (ChipBaseProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: never });

// `href` renderiza um <Link> (filtro por query param, sem estado de
// cliente — o padrão já usado em toda a área de família); sem `href`,
// um <button type="button"> (seleção via onClick, ex.: feedback rápido).
export function Chip({ selected = false, className = "", children, ...rest }: ChipProps) {
  if ("href" in rest && rest.href) {
    const { href } = rest;
    return (
      <Link href={href} aria-current={selected ? "true" : undefined} className={chipClassName(selected, className)}>
        {children}
      </Link>
    );
  }
  const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type="button" aria-pressed={selected} {...buttonProps} className={chipClassName(selected, className)}>
      {children}
    </button>
  );
}
