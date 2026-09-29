import { type InputHTMLAttributes, forwardRef } from "react";

// Um <input type="checkbox"> de verdade (funciona em formulário nativo,
// name/defaultChecked, sem estado de cliente) desenhado como toggle —
// as preferências de notificação em /quintal/configuracoes/conta usavam
// checkboxes sem estilo nenhum antes desta troca. O track e a bolinha são
// desenhados via peer-* no <span> ao lado do input (que fica visualmente
// escondido mas continua no fluxo de foco/teclado).
export const Switch = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string }>(
  ({ label, className = "", ...props }, ref) => (
    <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm text-ink">
      <span className="relative inline-block h-6 w-10 shrink-0">
        <input
          ref={ref}
          type="checkbox"
          className={`peer absolute inset-0 h-full w-full cursor-pointer opacity-0 ${className}`}
          {...props}
        />
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-border-strong transition-colors duration-200 peer-checked:bg-success peer-focus-visible:shadow-[var(--focus-ring)]"
        />
        <span
          aria-hidden
          className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200 peer-checked:translate-x-4"
        />
      </span>
      {label}
    </label>
  ),
);
Switch.displayName = "Switch";
