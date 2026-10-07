import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionCaregiver } from "@/lib/authorization";
import { getActiveChildContext } from "@/lib/activeChild";
import { toDatetimeLocalValue } from "@/lib/format";
import { getOpenSleepSession, guessSleepType } from "@/lib/sleep";
import { sleepTypes, sleepTypeLabels } from "@/lib/validation/sleep";
import { Input, Label, Select, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { cardClassName } from "@/components/ui/Card";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { startSleepAction, endSleepAction, recordSleepPeriodAction } from "./actions";

export const metadata: Metadata = {
  title: "Registrar sono — Quintal",
  robots: { index: false, follow: false },
};

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// Tela 2 do módulo Sono: registrar. Dois caminhos reais, não três como o
// mockup de referência sugeria ("Agora"/"Retroativo"/"Manual") — o
// formulário de início+fim exatos já serve tanto "esqueci de registrar
// há pouco" quanto "lançar um período de ontem", então "Retroativo" e
// "Manual" convergem num só (desvio deliberado do mockup, documentado no
// relatório desta fase). Com um sono em aberto, a única coisa que faz
// sentido aqui é fechá-lo — o formulário "Agora"/"Manual" nem aparece.
export default async function RegistrarSonoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; aba?: string }>;
}) {
  const { error, aba } = await searchParams;
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const { active: activeChild } = await getActiveChildContext(session.caregiverId);
  if (!activeChild) {
    redirect("/quintal/sono");
  }

  const openSession = await getOpenSleepSession(activeChild.id);
  const now = toDatetimeLocalValue(new Date());
  const suggestedType = guessSleepType(new Date().getHours());
  const activeTab = aba === "manual" ? "manual" : "agora";

  return (
    <PageContainer space={6}>
      <PageHeader title="Registrar sono" description={activeChild.name} backHref="/quintal/sono" backLabel="Sono" />

      <FieldError>{error}</FieldError>

      {openSession ? (
        <div className={cardClassName("space-y-3 p-4")}>
          <p className="text-sm text-ink">
            <span className="font-medium">{activeChild.name} está dormindo desde {timeLabel(openSession.startedAt)}</span>
            <span className="text-ink-muted"> — {sleepTypeLabels[openSession.sleepType]}</span>
          </p>
          <form action={endSleepAction} className="space-y-3">
            <input type="hidden" name="child_id" value={activeChild.id} />
            <input type="hidden" name="event_id" value={openSession.id} />
            <div className="space-y-1">
              <Label htmlFor="ended_at">Acordou às</Label>
              <Input id="ended_at" type="datetime-local" name="ended_at" required defaultValue={now} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="end_notes">Observação (opcional)</Label>
              <Input id="end_notes" name="notes" placeholder="Ex.: acordou tranquila" />
            </div>
            <Button type="submit" className="w-full justify-center">
              Acordou
            </Button>
          </form>
        </div>
      ) : (
        <>
          <div className="flex gap-2" role="tablist">
            <Link
              href="/quintal/sono/registrar?aba=agora"
              role="tab"
              aria-selected={activeTab === "agora"}
              className={`flex-1 rounded-full px-3 py-2 text-center text-sm font-medium transition-colors ${
                activeTab === "agora" ? "bg-accent text-ink" : "border-[1.5px] border-neutral text-ink-muted"
              }`}
            >
              Agora
            </Link>
            <Link
              href="/quintal/sono/registrar?aba=manual"
              role="tab"
              aria-selected={activeTab === "manual"}
              className={`flex-1 rounded-full px-3 py-2 text-center text-sm font-medium transition-colors ${
                activeTab === "manual" ? "bg-accent text-ink" : "border-[1.5px] border-neutral text-ink-muted"
              }`}
            >
              Manual
            </Link>
          </div>

          {activeTab === "agora" ? (
            <div className={cardClassName("space-y-4 p-4")}>
              <p className="text-sm text-ink-muted">
                {activeChild.name} está dormindo? Comece a contar agora — quando ela acordar, você
                finaliza e a duração é calculada sozinha.
              </p>
              <form action={startSleepAction} className="space-y-3">
                <input type="hidden" name="child_id" value={activeChild.id} />
                <input type="hidden" name="started_at" value={now} />
                <div className="space-y-1">
                  <Label htmlFor="sleep_type_now">Tipo</Label>
                  <Select id="sleep_type_now" name="sleep_type" defaultValue={suggestedType} required>
                    {sleepTypes.map((type) => (
                      <option key={type} value={type}>
                        {sleepTypeLabels[type]}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit" className="w-full justify-center">
                  Começar a registrar
                </Button>
              </form>
            </div>
          ) : (
            <form action={recordSleepPeriodAction} className={cardClassName("space-y-3 p-4")}>
              <input type="hidden" name="child_id" value={activeChild.id} />
              <div className="space-y-1">
                <Label htmlFor="sleep_type">Tipo</Label>
                <Select id="sleep_type" name="sleep_type" defaultValue={suggestedType} required>
                  {sleepTypes.map((type) => (
                    <option key={type} value={type}>
                      {sleepTypeLabels[type]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="period_started_at">Início</Label>
                  <Input id="period_started_at" type="datetime-local" name="started_at" required defaultValue={now} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="period_ended_at">Fim</Label>
                  <Input id="period_ended_at" type="datetime-local" name="ended_at" required defaultValue={now} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="period_notes">Observação (opcional)</Label>
                <Input id="period_notes" name="notes" placeholder="Ex.: dormiu no colo" />
              </div>
              <Button type="submit" className="w-full justify-center">
                Registrar período
              </Button>
            </form>
          )}

          <p className={cardClassName("p-3 text-xs text-ink-muted")}>
            Dica: você também pode registrar o sono contando para o Quintal no chat.
          </p>
        </>
      )}
    </PageContainer>
  );
}
