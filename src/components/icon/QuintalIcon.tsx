import { useId } from "react";
import { QUINTAL_ICON_PATHS, type QuintalIconName } from "./quintalIconPaths";
import { type QuintalIconTheme, themeDarkVar, themeLightVar, themeMainVar } from "./quintalIconTheme";

export type QuintalIconSize = "sm" | "md" | "lg" | number;

const SIZE_PX: Record<"sm" | "md" | "lg", number> = { sm: 16, md: 24, lg: 40 };

// Hash determinístico do nome do ícone → semente do filtro de "giz".
// Precisa ser estável entre render do servidor e do cliente (sem
// Math.random): o mesmo ícone sempre balança do mesmo jeito, a menos
// que quem chama passe `seed` para variar de propósito (ex.: o mesmo
// ícone repetido várias vezes na mesma tela, Demonstração de ícones).
function hashSeed(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return (hash % 12) + 1;
}

// A linguagem de ícones do Quintal ("traço de giz desenhado à mão" — ver
// docs/design-system.md #Quintal Iconography). Não é um ícone Lucide com
// stroke/strokeWidth/strokeLinecap trocados: os paths em
// quintalIconPaths.ts já nascem com curvas orgânicas e assimetria
// intencional, e o filtro SVG abaixo (feTurbulence + feDisplacementMap)
// aplica a imperfeição/variação de espessura por cima — a mesma técnica
// em todo ícone, para que a família toda tenha a mesma "mão".
//
// Ícones ≠ ilustrações: isto é só a camada pequena/funcional
// (navegação, cards, badges). Ilustrações maiores e mais expressivas são
// um sistema à parte, tratado em fase futura.
export function QuintalIcon({
  name,
  theme,
  size = "md",
  background = "none",
  strokeWidth = 1.85,
  seed,
  className,
  title,
}: {
  name: QuintalIconName;
  theme: QuintalIconTheme;
  size?: QuintalIconSize;
  // "none": o traço (main) aparece direto sobre a superfície do cartão —
  // o uso comum no produto. "light": o ícone senta sobre um selo redondo
  // na cor light do tema — nesse caso o traço muda para dark, porque
  // main sobre light mede ~2:1 de contraste (abaixo do mínimo de 3:1
  // para elementos gráficos), e dark sobre light mede ~3.3–4.2:1.
  background?: "none" | "light";
  strokeWidth?: number;
  // Override opcional da semente do filtro — útil só quando o mesmo
  // ícone se repete na mesma tela e a identidade visual pede variação
  // entre as cópias (ex.: grade de demonstração). Por padrão, deriva do
  // nome do ícone e é sempre a mesma.
  seed?: number;
  className?: string;
  // Quando o ícone carrega significado por si só (raro — a maioria tem
  // um rótulo de texto ao lado). Sem title, o SVG é aria-hidden.
  title?: string;
}) {
  const px = typeof size === "number" ? size : SIZE_PX[size];
  const filterId = useId();
  const filterSeed = seed ?? hashSeed(name);
  const strokeColor = background === "light" ? themeDarkVar(theme) : themeMainVar(theme);
  const paths = QUINTAL_ICON_PATHS[name];

  const svg = (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={background === "none" ? className : undefined}
    >
      <defs>
        <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves={2} seed={filterSeed} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${filterId})`}>
        {paths.map((d, index) => (
          <path key={index} d={d} />
        ))}
      </g>
    </svg>
  );

  if (background === "none") {
    return svg;
  }

  const padding = Math.round(px * 0.28);
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: px + padding * 2,
        height: px + padding * 2,
        borderRadius: 9999,
        background: themeLightVar(theme),
      }}
    >
      {svg}
    </span>
  );
}
