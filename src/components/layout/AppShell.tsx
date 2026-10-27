import BottomNav from "@/components/navigation/BottomNav";
import ChildSwitcher from "@/components/navigation/ChildSwitcher";
import type { AccessibleChild } from "@/lib/activeChild";

// A casca de toda a experiência de família: seletor de criança ativa no
// topo, navegação fixa no rodapé, o conteúdo da página entre os dois.
// Extraído de src/app/quintal/layout.tsx para poder ter nome e API
// próprios — o layout em si só resolve a sessão/criança ativa e chama
// isto.
export function AppShell({
  activeChild,
  childrenList,
  chatBadge = false,
  children,
}: {
  activeChild: AccessibleChild | null;
  childrenList: AccessibleChild[];
  // "Indicadores ativos de navegação" (pedido explícito) — um ponto no
  // ícone de Chat quando o dia ainda está totalmente em branco. Resolvido
  // no layout (único lugar que já sabe a criança ativa pra toda a árvore
  // /quintal), não aqui — ver src/lib/chatSuggestions.ts.
  chatBadge?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="pb-20">
      {activeChild && <ChildSwitcher activeChild={activeChild} childrenList={childrenList} />}
      {children}
      <BottomNav chatBadge={chatBadge} />
    </div>
  );
}
