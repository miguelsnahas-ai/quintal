import Link from "next/link";
import { Bell, ChevronDown } from "lucide-react";
import { ageLabel } from "@/lib/format";
import { setActiveChildAction } from "@/app/quintal/actions";
import { ChildAvatar } from "@/components/ui/ChildAvatar";
import type { AccessibleChild } from "@/lib/activeChild";

// Cabeçalho global de identidade — renderizado uma vez pelo AppShell,
// acima de todo módulo de /quintal/*, para nunca precisar ser repetido
// por página (cada tela chegou a duplicar nome/idade da criança no
// próprio título antes desta troca). Avatar + nome + idade sempre
// visíveis; o seletor (chevron + dropdown) só aparece quando há mais de
// uma criança para trocar. Zero JS de cliente de propósito, mesmo padrão
// já usado em outros menus do produto: <details>/<summary> para o
// dropdown, um <form> por opção que só troca o cookie e recarrega a
// página atual.
//
// O sino não abre uma caixa de notificações — isso não existe no
// produto (nenhuma notificação é enviada de verdade ainda, ver
// conta/preferências de notificação). Leva direto pra onde a família já
// consegue ajustar essa preferência, em vez de simular uma lista vazia.
export default function ChildSwitcher({
  activeChild,
  childrenList,
}: {
  activeChild: AccessibleChild;
  childrenList: AccessibleChild[];
}) {
  const label = ageLabel(activeChild.birthDate);

  const identity = (
    <span className="flex min-w-0 items-center gap-2.5">
      <ChildAvatar name={activeChild.name} avatarUrl={activeChild.avatarUrl} size={40} />
      <span className="min-w-0 text-left leading-tight">
        <span className="block truncate text-sm font-semibold text-ink">{activeChild.name}</span>
        {label && <span className="block text-xs text-ink-muted">{label}</span>}
      </span>
    </span>
  );

  const notificationsLink = (
    <Link
      href="/quintal/configuracoes/conta?aba=notificacoes"
      aria-label="Notificações"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-neutral/40 hover:text-ink"
    >
      <Bell className="h-5 w-5" aria-hidden />
    </Link>
  );

  if (childrenList.length <= 1) {
    return (
      <div className="mx-auto flex w-full max-w-lg items-center justify-between px-4 pt-3">
        {identity}
        {notificationsLink}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg items-center justify-between px-4 pt-3">
      <details className="group relative w-fit">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full py-1 pr-1 marker:content-none">
          {identity}
          <ChevronDown
            className="h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200 group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="absolute left-0 z-[90] mt-1.5 w-64 space-y-1 rounded-lg bg-primary p-2 shadow-[var(--shadow-lift)]">
          <p className="px-2 pb-1 pt-0.5 text-xs font-medium text-ink-muted">Trocar criança</p>
          {childrenList.map((child) => {
            const childLabel = ageLabel(child.birthDate);
            const isActive = child.id === activeChild.id;
            return (
              <form key={child.id} action={setActiveChildAction}>
                <input type="hidden" name="child_id" value={child.id} />
                <button
                  type="submit"
                  disabled={isActive}
                  className={`flex w-full items-center gap-2.5 rounded-sm px-2 py-2 text-left text-sm transition-colors ${
                    isActive ? "bg-accent/40 font-semibold text-ink" : "text-ink hover:bg-neutral/40"
                  }`}
                >
                  <ChildAvatar name={child.name} avatarUrl={child.avatarUrl} size={28} />
                  <span className="min-w-0 flex-1 truncate">{child.name}</span>
                  {childLabel && <span className="shrink-0 text-xs text-ink-muted">{childLabel}</span>}
                </button>
              </form>
            );
          })}
        </div>
      </details>
      {notificationsLink}
    </div>
  );
}
