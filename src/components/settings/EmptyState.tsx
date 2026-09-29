import type { LucideIcon } from "lucide-react";

// Estado vazio para as seções de Configurações que ainda não têm lógica
// por trás (Preferências pessoais, Notificações, Preferências da
// criança, Permissões — Fase 17 pede explicitamente estrutura e
// navegação, não a lógica completa ainda). Deliberadamente não um
// formulário fantasma que pareceria salvar algo e não salva nada —
// melhor ser honesto que isso ainda não existe do que fingir.
export default function EmptyState({
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
