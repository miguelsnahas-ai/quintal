import Link from "next/link";

// Cabeçalho de página compartilhado por toda tela de família — título +
// uma linha de contexto (nome da criança, ou uma descrição fixa) + um
// link de volta opcional. Generaliza o que já existia em duas formas
// diferentes: SettingsPageHeader (só em /quintal/configuracoes/*) e uma
// função local `BackLink` repetida à mão em seis páginas de módulo
// (sono, alimentação, brincadeiras, timeline, timeline/[id], materiais).
export function PageHeader({
  title,
  description,
  backHref,
  backLabel,
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="space-y-1">
      {backHref && (
        <Link href={backHref} className="text-sm text-ink-muted hover:text-ink">
          ← {backLabel}
        </Link>
      )}
      <h1 className="text-lg font-bold text-ink">{title}</h1>
      {description && <p className="text-sm text-ink-muted">{description}</p>}
    </div>
  );
}
