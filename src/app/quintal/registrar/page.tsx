import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionCaregiver } from "@/lib/authorization";
import { getActiveChildContext } from "@/lib/activeChild";
import { toDatetimeLocalValue } from "@/lib/format";
import { eventTypeLabels, type EventType } from "@/lib/validation/events";
import { Input, Select, Textarea, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { cardClassName } from "@/components/ui/Card";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { createQuickEventAction } from "./actions";

export const metadata: Metadata = {
  title: "Registrar — Quintal",
  robots: { index: false, follow: false },
};

// Registro genérico — o destino de "Rotina" e "Outro" no bottom sheet de
// Registrar (RegisterSheet). Sono e Alimentação já têm formulários
// próprios, com campos estruturados; para o resto, os dois campos que
// todo evento tem de verdade (quando + o que aconteceu) bastam — mesmo
// critério já usado na edição genérica da Timeline
// (eventEditInputSchema). Tipo é um <select>, não travado no valor que
// trouxe você aqui: "Rotina" e "Outro" são só um ponto de partida.
const QUICK_LOG_TYPES = ["routine", "development", "observation", "decision", "outing"] as const satisfies readonly EventType[];

function isQuickLogType(value: string | undefined): value is (typeof QUICK_LOG_TYPES)[number] {
  return (QUICK_LOG_TYPES as readonly string[]).includes(value ?? "");
}

export default async function RegistrarPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; error?: string }>;
}) {
  const { tipo, error } = await searchParams;
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const { active: activeChild } = await getActiveChildContext(session.caregiverId);
  const defaultType = isQuickLogType(tipo) ? tipo : "routine";

  if (!activeChild) {
    return (
      <PageContainer space={6}>
        <PageHeader title="Registrar" backHref="/quintal" backLabel="Hoje" />
        <p className={cardClassName("p-4 text-sm text-ink-muted")}>
          Nenhuma criança cadastrada ainda para esta família.
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer space={6}>
      <PageHeader title="Registrar" backHref="/quintal" backLabel="Hoje" />

      <FieldError>{error}</FieldError>

      <form action={createQuickEventAction} className={cardClassName("space-y-3 p-4")}>
        <input type="hidden" name="child_id" value={activeChild.id} />
        <div className="space-y-1">
          <Label htmlFor="type">Tipo</Label>
          <Select id="type" name="type" defaultValue={defaultType} required>
            {QUICK_LOG_TYPES.map((type) => (
              <option key={type} value={type}>
                {eventTypeLabels[type]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="occurred_at">Quando</Label>
          <Input
            id="occurred_at"
            type="datetime-local"
            name="occurred_at"
            required
            defaultValue={toDatetimeLocalValue(new Date())}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="notes">O que aconteceu</Label>
          <Textarea id="notes" name="notes" required rows={3} placeholder="Ex.: trocou de roupa sozinha, sem ajuda" />
        </div>
        <Button type="submit">Registrar</Button>
      </form>
    </PageContainer>
  );
}
