// Bloco de carregamento — shimmer, nunca um spinner (guideline do design
// system: "Shimmer animation matching component dimensions. No circular
// spinners."). `className` controla altura/largura/radius de cada uso.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`q-skeleton rounded-lg ${className}`} aria-hidden />;
}
