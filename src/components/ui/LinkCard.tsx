import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cardClassName, cardHoverLift } from "@/components/ui/Card";

// Uma linha de navegação — ícone, título, descrição, seta. Nasceu em
// Configurações (SettingsCard, local àquela página) e virou compartilhado
// nesta troca porque a página "Mais" precisava exatamente do mesmo
// visual para os mesmos fins (entrar numa seção).
export function LinkCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  href: string;
}) {
  return (
    <Link href={href} className={cardClassName(`flex items-center gap-3 p-4 ${cardHoverLift}`)}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent">
        <Icon className="h-4 w-4 text-ink" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{title}</p>
        {description && <p className="truncate text-sm text-ink-muted">{description}</p>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
    </Link>
  );
}
