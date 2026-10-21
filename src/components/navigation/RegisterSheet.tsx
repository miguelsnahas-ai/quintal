"use client";

import { useRef } from "react";
import Link from "next/link";
import { Plus, Moon, Utensils, Blocks, Droplet, ListChecks, MoreHorizontal, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Diagnóstico de navegabilidade (fase dedicada): Higiene tinha módulo e
// rota de registro completos, mas não estava aqui — toda outra área do
// dia a dia (Sono/Alimentação/Brincadeira) é alcançável em 1 toque a
// partir de qualquer tela via este botão central; Higiene só era
// alcançável em 3 (Mais → Higiene → aba Registrar). Corrigido somando
// a sexta opção, mesmo critério das outras cinco.
const OPTIONS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/quintal/sono/registrar", label: "Sono", icon: Moon },
  { href: "/quintal/alimentacao#registrar", label: "Alimentação", icon: Utensils },
  { href: "/quintal/brincadeiras", label: "Brincadeira", icon: Blocks },
  { href: "/quintal/higiene/registrar", label: "Fralda", icon: Droplet },
  { href: "/quintal/registrar?tipo=routine", label: "Rotina", icon: ListChecks },
  { href: "/quintal/registrar?tipo=observation", label: "Outro", icon: MoreHorizontal },
];

// O botão central da navegação — abre um bottom sheet com os cinco
// registros rápidos (pedido explícito), cada um levando ao formulário
// que já existe para aquilo (Sono e Alimentação têm forms próprios com
// campos estruturados; Brincadeira leva à tela de sugestões/registro;
// Rotina e Outro caem no registro genérico em /quintal/registrar).
// <dialog> nativo — foco/Escape/clique-fora de graça, sem dependência
// nova; único lugar do app que precisa de um modal de verdade, os outros
// menus usam <details>.
export default function RegisterSheet() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        aria-label="Registrar"
        onClick={() => dialogRef.current?.showModal()}
        className="flex min-w-[56px] flex-1 flex-col items-center gap-0.5 px-1 py-1.5 text-center"
      >
        <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-ink shadow-[var(--shadow-lift)] transition-transform duration-150 active:translate-y-px">
          <Plus className="h-6 w-6" aria-hidden />
        </span>
        <span className="text-[11px] font-semibold leading-tight text-ink">Registrar</span>
      </button>

      <dialog
        ref={dialogRef}
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="q-sheet fixed inset-x-0 bottom-0 m-0 max-h-[85dvh] w-full overflow-y-auto rounded-t-[20px] border-none bg-primary p-0 shadow-[var(--shadow-lift)] backdrop:bg-ink/40 sm:bottom-6 sm:mx-auto sm:max-w-md sm:rounded-[20px]"
      >
        <div className="flex items-center justify-between border-b border-neutral px-4 py-3">
          <p className="text-sm font-semibold text-ink">Registrar</p>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Fechar"
            className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-neutral/40 hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <nav className="space-y-1 p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          {OPTIONS.map(({ href, label, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              onClick={() => dialogRef.current?.close()}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-ink transition-colors hover:bg-neutral/40"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent">
                <Icon className="h-4 w-4 text-ink" aria-hidden />
              </span>
              {label}
            </Link>
          ))}
        </nav>
      </dialog>
    </>
  );
}
