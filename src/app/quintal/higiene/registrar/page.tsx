import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionCaregiver } from "@/lib/authorization";
import { getActiveChildContext } from "@/lib/activeChild";
import { toDatetimeLocalValue } from "@/lib/format";
import { diaperResults, diaperResultLabels, diaperConditions, diaperConditionLabels, skinConditions, skinConditionLabels } from "@/lib/validation/hygiene";
import { Input, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { cardClassName } from "@/components/ui/Card";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { HygieneModuleNav } from "@/components/hygiene/HygieneModuleNav";
import { recordDiaperChangeAction } from "./actions";

export const metadata: Metadata = {
  title: "Registrar troca — Quintal",
  robots: { index: false, follow: false },
};

const radioChip = "flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-neutral p-3 text-center text-sm text-ink has-[:checked]:border-accent has-[:checked]:bg-accent/20";

// Tela 2: "exigir o mínimo de interação possível" — três grupos de chip
// (tipo/condição/pele), cada um já com um valor padrão marcado, e
// data/hora pré-preenchida com agora. Nenhum campo obrigatório além do
// que já vem selecionado: a família pode só apertar "Registrar troca"
// sem tocar em mais nada.
export default async function RegistrarHigienePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const { active: activeChild } = await getActiveChildContext(session.caregiverId);
  if (!activeChild) {
    redirect("/quintal/higiene");
  }

  const now = toDatetimeLocalValue(new Date());

  return (
    <PageContainer space={6}>
      <PageHeader title="Registrar troca" description={activeChild.name} backHref="/quintal/higiene" backLabel="Higiene" />
      <HygieneModuleNav active="/quintal/higiene/registrar" />

      <FieldError>{error}</FieldError>

      <form action={recordDiaperChangeAction} className={cardClassName("space-y-4 p-4")}>
        <input type="hidden" name="child_id" value={activeChild.id} />

        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <div className="grid grid-cols-3 gap-2">
            {diaperResults.map((result, index) => (
              <label key={result} className={radioChip}>
                <input type="radio" name="diaper_result" value={result} defaultChecked={index === 0} className="sr-only" required />
                {diaperResultLabels[result]}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Condição</Label>
          <div className="grid grid-cols-3 gap-2">
            {diaperConditions.map((condition, index) => (
              <label key={condition} className={radioChip}>
                <input type="radio" name="condition" value={condition} defaultChecked={index === 0} className="sr-only" required />
                {diaperConditionLabels[condition]}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Pele</Label>
          <div className="grid grid-cols-3 gap-2">
            {skinConditions.map((skin, index) => (
              <label key={skin} className={radioChip}>
                <input type="radio" name="skin_condition" value={skin} defaultChecked={index === 0} className="sr-only" required />
                {skinConditionLabels[skin]}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="occurred_at">Quando</Label>
          <Input id="occurred_at" type="datetime-local" name="occurred_at" required defaultValue={now} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="notes">Observação (opcional)</Label>
          <Input id="notes" name="notes" placeholder="Ex.: um pouco irritada" />
        </div>

        <Button type="submit" className="w-full justify-center">
          Registrar troca
        </Button>
      </form>
    </PageContainer>
  );
}
