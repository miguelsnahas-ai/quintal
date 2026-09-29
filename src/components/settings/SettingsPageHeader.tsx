import Link from "next/link";

// Cabeçalho compartilhado por toda página de /quintal/configuracoes/* —
// mesmo título + link de volta em todo lugar, em vez de cada página
// escrever o seu (padrão já visto em /quintal/sono, /quintal/timeline
// etc., só que ali cada BackLink era uma função local repetida arquivo a
// arquivo). No desktop o link "voltar" é redundante com a sidebar
// sempre visível, mas mantê-lo por padrão de fora do sistema não custa
// nada e mantém a página idêntica nos dois tamanhos de tela.
export default function SettingsPageHeader({
  title,
  description,
  backHref = "/quintal/configuracoes",
  backLabel = "Configurações",
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="space-y-1">
      <Link href={backHref} className="text-sm text-ink-muted hover:text-ink">
        ← {backLabel}
      </Link>
      <h1 className="text-lg font-bold text-ink">{title}</h1>
      {description && <p className="text-sm text-ink-muted">{description}</p>}
    </div>
  );
}
