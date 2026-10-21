import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionCaregiver } from "@/lib/authorization";
import { getActiveChildContext } from "@/lib/activeChild";
import { getHygieneOverview } from "@/lib/hygiene";
import { diaperResultLabels } from "@/lib/validation/hygiene";
import { cardClassName, inviteCardClassName } from "@/components/ui/Card";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { buttonClassName } from "@/components/ui/Button";
import { QuintalIcon } from "@/components/icon/QuintalIcon";
import { HygieneModuleNav } from "@/components/hygiene/HygieneModuleNav";

export const metadata: Metadata = {
  title: "Higiene — Quintal",
  robots: { index: false, follow: false },
};

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// Tela 1 do módulo Higiene: "o que já sabemos", só leitura — mesmo papel
// da Visão geral do Sono. Começa por fraldas (pedido explícito desta
// fase); o resto ("brincar"/"banho" como cuidado próprio etc.) fica
// para quando existir dado real por trás, nunca um placeholder vazio.
export default async function HigienePage() {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const { active: activeChild } = await getActiveChildContext(session.caregiverId);

  if (!activeChild) {
    return (
      <PageContainer space={6}>
        <PageHeader title="Higiene" backHref="/quintal/mais" backLabel="Mais" />
        <p className={cardClassName("p-4 text-sm text-ink-muted")}>
          Nenhuma criança cadastrada ainda para esta família.
        </p>
      </PageContainer>
    );
  }

  const overview = await getHygieneOverview(activeChild.id);
  const hasAnyStock = overview.stock.length > 0;

  return (
    <PageContainer>
      <PageHeader title="Higiene" backHref="/quintal/mais" backLabel="Mais" />
      <HygieneModuleNav active="/quintal/higiene" />

      <div className="grid grid-cols-2 gap-3">
        <div className={cardClassName("space-y-1 p-4")}>
          <p className="text-xs font-medium text-ink-muted">Última troca</p>
          <p className="text-sm font-semibold text-ink">
            {overview.lastChange ? (
              <>
                {timeLabel(overview.lastChange.occurredAt)}
                <span className="block text-xs font-normal text-ink-muted">
                  {overview.lastChange.diaperResult ? diaperResultLabels[overview.lastChange.diaperResult] : overview.lastChange.notes}
                </span>
              </>
            ) : (
              "Nenhuma ainda"
            )}
          </p>
        </div>
        <div className={cardClassName("space-y-1 p-4")}>
          <p className="text-xs font-medium text-ink-muted">Trocas hoje</p>
          <p className="text-sm font-semibold text-ink">{overview.changesToday}</p>
        </div>
      </div>

      {overview.changesToday > 0 && (
        <div className={cardClassName("space-y-2 p-4")}>
          <p className="text-xs font-medium text-ink-muted">Distribuição de hoje</p>
          <div className="flex gap-4 text-sm text-ink">
            <span className="flex items-center gap-1.5">
              <QuintalIcon name="drop" theme="hygiene" size="sm" /> Xixi: {overview.todayDistribution.pee}
            </span>
            <span className="flex items-center gap-1.5">
              <QuintalIcon name="poop" theme="hygiene" size="sm" /> Cocô: {overview.todayDistribution.poop}
            </span>
            <span className="flex items-center gap-1.5">
              <QuintalIcon name="drop" theme="hygiene" size="sm" />
              <QuintalIcon name="poop" theme="hygiene" size="sm" /> Os dois: {overview.todayDistribution.both}
            </span>
          </div>
        </div>
      )}

      {overview.recentLeakCount > 0 && (
        <div className={inviteCardClassName("flex items-center gap-3 p-4")}>
          <QuintalIcon name="leak" theme="hygiene" size="md" background="light" />
          <p className="text-sm text-ink">
            <span className="font-semibold">{overview.recentLeakCount}</span>{" "}
            {overview.recentLeakCount === 1 ? "vazamento registrado" : "vazamentos registrados"} nos últimos 7 dias.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className={cardClassName("space-y-1 p-4")}>
          <p className="text-xs font-medium text-ink-muted">Tamanho atual</p>
          <p className="text-sm font-semibold text-ink">{overview.currentDiaperSize ?? "Não informado"}</p>
        </div>
        <div className={cardClassName("space-y-1 p-4")}>
          <p className="text-xs font-medium text-ink-muted">Estoque</p>
          <p className="text-sm font-semibold text-ink">
            {hasAnyStock
              ? `${overview.stock.reduce((sum, line) => sum + line.quantity, 0)} fraldas`
              : "Não informado"}
          </p>
        </div>
      </div>

      {/* Sem ícone no botão de propósito — mesmo critério já documentado
          no módulo Sono: cor por tema é linguagem de classificação para
          conteúdo, não para o chrome de um botão sobre fundo âmbar
          sólido (o traço pastel do tema teria contraste insuficiente
          ali). */}
      <Link href="/quintal/higiene/registrar" className={buttonClassName("primary", "w-full justify-center")}>
        Registrar troca
      </Link>

      {!overview.lastChange && (
        <div className={inviteCardClassName("p-4 text-sm text-ink-muted")}>
          Nenhuma troca registrada ainda para {activeChild.name}. Assim que começar a registrar, o
          resumo e o histórico aparecem aqui.
        </div>
      )}
    </PageContainer>
  );
}
