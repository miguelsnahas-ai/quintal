import Link from "next/link";

const TOTAL_STEPS = 7;

// A casca de toda tela de /comecar/* a partir de "Sobre você" — título
// grande, descrição curta, um indicador de progresso discreto (uma
// barrinha, não "passo 3 de 9" em números, que pesaria mais do que o
// design system pede) e um link de volta opcional. Nasceu desta
// refatoração porque as 7 telas do fluxo (Sobre você → Família →
// Criança → Cuidadores → Preferências → Alimentação → Resumo)
// repetiam exatamente essa composição.
export function OnboardingScreen({
  step,
  title,
  description,
  backHref,
  children,
}: {
  step?: number;
  title: string;
  description?: string;
  backHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-4 py-10">
      {backHref && (
        <Link href={backHref} className="mb-4 text-sm text-ink-muted hover:text-ink">
          ← Voltar
        </Link>
      )}
      {step !== undefined && (
        <div className="mb-6 h-1 w-full overflow-hidden rounded-full bg-neutral" aria-hidden>
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      )}
      <div className="mb-6 space-y-1.5">
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        {description && <p className="text-sm text-ink-muted">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
