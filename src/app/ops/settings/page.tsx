import type { Metadata } from "next";
import Link from "next/link";
import { Check, Inbox, Sparkles } from "lucide-react";
import { getCustomInstructions } from "@/lib/ai-settings";
import { cardClassName } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label, Textarea, FieldError } from "@/components/ui/Field";
import { updateCustomInstructionsAction } from "./actions";

export const metadata: Metadata = {
  title: "Configurações — Quintal Ops",
  robots: { index: false, follow: false },
};

// Área secundária de configurações operacionais (refatoração do /ops) —
// hoje só a instrução extra da IA, que antes vivia dentro da tela de
// "Chat de teste" removida nesta fase (ver
// playground/monitor/[caregiverId]/MonitorChat.tsx). Inbox continua
// existindo (é o único caminho para responder uma mensagem real do
// WhatsApp — ver o comentário em src/app/ops/inbox/page.tsx) mas saiu da
// navegação principal; o link aqui é o lugar combinado para quem precisa
// dele.
export default async function OpsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const customInstructions = await getCustomInstructions();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-bold text-ink">Configurações</h1>
        <p className="text-sm text-ink-muted">Ajustes operacionais do Quintal.</p>
      </div>

      <FieldError>{error}</FieldError>
      {success && (
        <p className="flex items-center gap-1.5 text-sm text-ink-muted">
          <Check className="h-4 w-4" aria-hidden />
          Salvo com sucesso.
        </p>
      )}

      <section className={cardClassName("space-y-3 p-4")}>
        <div className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <Sparkles className="h-4 w-4 text-tertiary" aria-hidden />
          Instruções extras para a IA
        </div>
        <p className="text-xs text-ink-muted">
          Vale para todas as conversas do Quintal — some no próximo texto que a IA gerar, não reescreve
          o que já foi respondido. Use para ajustar tom, prioridades ou coisas a evitar.
        </p>
        <form action={updateCustomInstructionsAction} className="space-y-3">
          <Label htmlFor="custom_instructions">Instruções</Label>
          <Textarea
            id="custom_instructions"
            name="custom_instructions"
            rows={5}
            defaultValue={customInstructions}
            placeholder="Ex.: seja mais breve; sempre pergunte a idade se não estiver clara; evite sugerir apps de terceiros..."
          />
          <Button type="submit">Salvar instruções</Button>
        </form>
      </section>

      <Link
        href="/ops/inbox"
        className="flex items-center gap-1.5 text-sm text-ink-muted underline hover:text-ink"
      >
        <Inbox className="h-4 w-4" aria-hidden />
        Inbox — responder mensagens do WhatsApp manualmente
      </Link>
    </div>
  );
}
