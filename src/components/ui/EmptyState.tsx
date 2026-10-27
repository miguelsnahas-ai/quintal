import type { LucideIcon } from "lucide-react";

// Estado vazio genérico — ícone num círculo amber, título, descrição.
// Nascido em Configurações (Fase 17 pedia estrutura e navegação para
// seções sem lógica ainda, sem fingir um formulário que não salva nada)
// e promovido para uso geral nesta troca, já que o mesmo visual serve
// qualquer lista/seção vazia do app.
export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg bg-primary p-8 text-center shadow-[var(--shadow-card)]">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent">
        <Icon className="h-5 w-5 text-ink" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-sm text-ink-muted">{description}</p>
      </div>
    </div>
  );
}
