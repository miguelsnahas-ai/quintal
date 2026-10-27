// A marca "quintal" — lettering em Caveat Brush com um sunrise de crayon
// amber sobre o "int". Stand-in flag do design system: a versão final
// deve ser desenhada à mão por um designer e entregue como vetor; até
// então, esta é a aproximação. Precisa de <CrayonDefs /> (ver
// CrayonMark.tsx) renderizado antes na página.
export function Wordmark({
  size = 48,
  tagline = false,
  onDark = false,
  style,
}: {
  size?: number;
  tagline?: boolean;
  onDark?: boolean;
  style?: React.CSSProperties;
}) {
  const ink = onDark ? "var(--color-secondary)" : "var(--color-ink)";
  return (
    <span
      role="img"
      aria-label="Quintal"
      className="relative inline-flex flex-col items-start leading-none"
      style={{ paddingTop: size * 0.36, ...style }}
    >
      <svg
        width={size * 0.875}
        height={size * 0.42}
        viewBox="0 0 84 40"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={4}
        strokeLinecap="round"
        filter="url(#q-crayon)"
        aria-hidden="true"
        className="absolute top-0"
        style={{ left: size * 0.96 }}
      >
        <path d="M22 38a20 20 0 0 1 40 0" />
        <path d="M42 10V2M22 16l-5-6M62 16l5-6M8 30l-7-2M76 30l7-2" />
      </svg>
      <span style={{ fontFamily: "var(--font-logo)", fontSize: size, lineHeight: 0.8, color: ink }}>quintal</span>
      {tagline && (
        <span
          className="font-sans"
          style={{
            fontSize: Math.max(12, Math.round(size * 0.18)),
            color: onDark ? "var(--color-tertiary)" : "var(--color-ink)",
            paddingLeft: size * 0.46,
            paddingTop: size * 0.06,
          }}
        >
          mais infância na vida real
        </span>
      )}
    </span>
  );
}
