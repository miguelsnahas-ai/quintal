import type { ReactNode } from "react";
import Link from "next/link";
import { inviteCardClassName, cardHoverLift } from "@/components/ui/Card";

// One compact tile in the dashboard's "resumo do dia" grid. Deliberately
// dumb/presentational — it never decides what counts as data vs. empty,
// the page passes `value: null` when there's nothing real to show yet
// (see src/lib/dashboard.ts). Sem borda, de propósito (refatoração da
// Home): "cards leves, evitar excesso de bordas e sombras" — mesmo tom
// "convite" que ActivityCard/MaterialCard já usam, em vez do
// `cardClassName` bordado mais denso do resto do produto. `href` é
// opcional — Alimentação (Fase 9) e Sono (Fase 10) têm módulo próprio
// pra linkar; Brincadeiras/Rotina ficam div simples até ganharem um.
export default function SummaryCard({
  icon,
  label,
  value,
  empty,
  href,
}: {
  // Elemento já pronto (ex.: <QuintalIcon name="moon" theme="sleep"
  // size="sm" />), não um componente de ícone — cada pilar escolhe seu
  // próprio ícone/tema no call site, este componente só posiciona.
  icon: ReactNode;
  label: string;
  value: string | null;
  empty: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center gap-1.5 text-ink-muted">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      {value ? (
        <p className="text-sm font-semibold leading-snug text-ink">{value}</p>
      ) : (
        <p className="text-sm leading-snug text-ink-muted">{empty}</p>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={inviteCardClassName(`block space-y-2 p-4 ${cardHoverLift}`)}>
        {content}
      </Link>
    );
  }

  return <div className={inviteCardClassName("space-y-2 p-4")}>{content}</div>;
}
