import { redirect } from "next/navigation";
import { getSessionCaregiver } from "@/lib/authorization";
import { getAccessibleChildren } from "@/lib/activeChild";
import SettingsSidebar from "@/components/settings/SettingsSidebar";

// Fase 17 — "Configurações" é o centro de gestão da conta, família,
// crianças e cuidadores: não uma tela isolada, uma ÁREA com navegação
// própria (pedido explícito). Este layout é o mesmo padrão já usado por
// src/app/quintal/layout.tsx (BottomNav) — um shell aplicado uma vez a
// toda a subárvore /quintal/configuracoes/*, sem cada página duplicar a
// navegação. Diferente daquele layout, este PRECISA verificar sessão
// (a sidebar depende de dados da família) — mas não impede que cada
// página também resolva a sua própria sessão via getSessionCaregiver,
// mesmo padrão de toda action de /quintal/*: nunca confiar só no
// layout, redirect() aborta a árvore inteira de qualquer forma.
export default async function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const accessibleChildren = await getAccessibleChildren(session.caregiverId);

  return (
    <div className="mx-auto flex w-full max-w-5xl gap-8 px-4 py-6 lg:px-6">
      <SettingsSidebar childrenList={accessibleChildren} />
      <div className="min-w-0 flex-1 space-y-6">{children}</div>
    </div>
  );
}
