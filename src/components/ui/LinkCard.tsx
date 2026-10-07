import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cardClassName, cardHoverLift } from "@/components/ui/Card";

// Uma linha de navegação — ícone, título, descrição, seta. Nasceu em
// Configurações (SettingsCard, local àquela página) e virou compartilhado
// nesta troca porque a página "Mais" precisava exatamente do mesmo
// visual para os mesmos fins (entrar numa seção).
//
// `icon` é um elemento já pronto (não mais um componente LucideIcon) —
// mudança da Fase Higiene, para permitir que uma entrada use a
// linguagem de ícones do Quintal (QuintalIcon) em vez de Lucide, sem
// criar um segundo componente de navegação só para isso. Todo call site
// existente só passou a envolver o próprio ícone Lucide que já usava
// (ex.: `<Moon className="h-4 w-4 text-ink" aria-hidden />`) — visual
// idêntico a antes.
export function LinkCard({
  icon,
  // "accent" (padrão): o selo amber de sempre, em volta de um ícone
  // Lucide simples. "none": sem selo — para um ícone que já é seu
  // próprio selo completo (ex.: QuintalIcon com background="light"),
  // caso contrário ficaria um selo dentro do outro.
  iconBackground = "accent",
  title,
  description,
  href,
}: {
  icon: ReactNode;
  iconBackground?: "accent" | "none";
  title: string;
  description?: string;
  href: string;
}) {
  return (
    <Link href={href} className={cardClassName(`flex items-center gap-3 p-4 ${cardHoverLift}`)}>
      {iconBackground === "accent" ? (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent">{icon}</span>
      ) : (
        icon
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{title}</p>
        {description && <p className="truncate text-sm text-ink-muted">{description}</p>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
    </Link>
  );
}
