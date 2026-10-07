import { PageHeader } from "@/components/layout/PageHeader";

// Fininho por cima do PageHeader genérico — só fixa os defaults de volta
// que toda página de /quintal/configuracoes/* usa. No desktop o link
// "voltar" é redundante com a sidebar sempre visível, mas mantê-lo por
// padrão de fora do sistema não custa nada e mantém a página idêntica
// nos dois tamanhos de tela.
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
  return <PageHeader title={title} description={description} backHref={backHref} backLabel={backLabel} />;
}
