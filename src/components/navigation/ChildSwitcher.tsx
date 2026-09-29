import { Baby, ChevronDown } from "lucide-react";
import { ageLabel } from "@/lib/format";
import { setActiveChildAction } from "@/app/quintal/actions";
import type { AccessibleChild } from "@/lib/activeChild";

// Seletor global de criança ativa (Fase 16) — renderizado uma vez pelo
// layout (src/app/quintal/layout.tsx), acima de todo módulo de
// /quintal/*, para nunca precisar ser duplicado por página. Zero JS de
// cliente de propósito, mesmo padrão já usado em outros menus desta
// fase do produto (método alimentar, registro retroativo de sono):
// <details>/<summary> para o dropdown, um <form> por opção que só troca
// o cookie e recarrega a página atual — consistente com a filosofia do
// projeto de reservar client components para widgets genuinamente
// interativos.
export default function ChildSwitcher({
  activeChild,
  childrenList,
}: {
  activeChild: AccessibleChild;
  childrenList: AccessibleChild[];
}) {
  // Uma única criança: mostra o nome, sem affordance de troca — não há
  // nada para trocar.
  if (childrenList.length <= 1) {
    return (
      <div className="mx-auto flex w-full max-w-lg items-center gap-1.5 px-4 pt-3 text-sm font-semibold text-ink">
        <Baby className="h-4 w-4 text-ink-muted" aria-hidden />
        {activeChild.name}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-3">
      <details className="group relative w-fit">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-ink marker:content-none">
          <Baby className="h-4 w-4" aria-hidden />
          {activeChild.name}
          <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180" aria-hidden />
        </summary>
        <div className="absolute left-0 z-[90] mt-1 w-60 space-y-1 rounded-lg bg-primary p-2 shadow-[var(--shadow-lift)]">
          <p className="px-2 pb-1 pt-0.5 text-xs font-medium text-ink-muted">Trocar criança</p>
          {childrenList.map((child) => {
            const label = ageLabel(child.birthDate);
            const isActive = child.id === activeChild.id;
            return (
              <form key={child.id} action={setActiveChildAction}>
                <input type="hidden" name="child_id" value={child.id} />
                <button
                  type="submit"
                  disabled={isActive}
                  className={`flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors ${
                    isActive ? "bg-accent/40 font-semibold text-ink" : "text-ink hover:bg-neutral/40"
                  }`}
                >
                  <span>{child.name}</span>
                  {label && <span className="text-xs text-ink-muted">{label}</span>}
                </button>
              </form>
            );
          })}
        </div>
      </details>
    </div>
  );
}
