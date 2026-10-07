import { AppShell } from "@/components/layout/AppShell";
import { getSessionCaregiver } from "@/lib/authorization";
import { getActiveChildContext } from "@/lib/activeChild";

// Aplica a navegação persistente e o seletor de criança global (Fase 16)
// a toda a experiência de família (/quintal e tudo abaixo dela) num só
// lugar, sem tocar em cada página. Não redireciona sem sessão aqui de
// propósito: cada página já resolve sua própria sessão e chama
// redirect() quando não há uma — o redirect() do Next.js aborta o render
// da árvore inteira (layout incluído) antes de qualquer HTML chegar ao
// navegador, então esta barra/seletor nunca aparecem "sozinhos" numa
// tela que devia redirecionar; daqui só precisamos tratar
// graciosamente o caso (nunca alcançado de verdade) de renderizar sem
// sessão.
export default async function QuintalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionCaregiver();
  const { active: activeChild, children: accessibleChildren } = session
    ? await getActiveChildContext(session.caregiverId)
    : { active: null, children: [] };

  return (
    <AppShell activeChild={activeChild} childrenList={accessibleChildren}>
      {children}
    </AppShell>
  );
}
