import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cardClassName, cardHoverLift } from "@/components/ui/Card";

// One compact tile in the dashboard's "resumo do dia" grid. Deliberately
// dumb/presentational — it never decides what counts as data vs. empty,
// the page passes `value: null` when there's nothing real to show yet
// (see src/lib/dashboard.ts). Same warm family-tier surface as
// ActivityCard (rounded-lg, no border) rather than the operator tool's
// denser `cardClassName` (rounded-sm, bordered). `href` is optional —
// Alimentação (Fase 9) and Sono (Fase 10) have their own modules to link
// to; Brincadeiras/Rotina stay plain divs until they get one too.
export default function SummaryCard({
  icon: Icon,
  label,
  value,
  empty,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string | null;
  empty: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center gap-1.5 text-ink-muted">
        <Icon className="h-4 w-4" aria-hidden />
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
      <Link href={href} className={cardClassName(`block space-y-2 p-4 ${cardHoverLift}`)}>
        {content}
      </Link>
    );
  }

  return <div className={cardClassName("space-y-2 p-4")}>{content}</div>;
}
