import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionCaregiver } from "@/lib/authorization";
import { getActiveChildContext } from "@/lib/activeChild";
import { getDiaperProfiles, getDiaperStock } from "@/lib/hygiene";
import { Input, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { cardClassName, inviteCardClassName } from "@/components/ui/Card";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { HygieneModuleNav } from "@/components/hygiene/HygieneModuleNav";
import {
  createDiaperProfileAction,
  addDiaperStockAction,
  updateDiaperStockAction,
  deleteDiaperStockAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Fraldas — Quintal",
  robots: { index: false, follow: false },
};

function dateLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function stockLineLabel(line: { brand: string | null; model: string | null; size: string | null }): string {
  const parts = [line.size, line.brand, line.model].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Sem marca/tamanho informado";
}

// Tela 3: perfil da fralda (marca/modelo/tamanho — histórico, a mais
// recente por "a partir de" é "a atual") + estoque (sem catálogo, sem
// cálculo de consumo — pedido explícito desta fase). Dois formulários
// pequenos, nenhum passa de poucos campos opcionais.
export default async function FraldasPage({
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

  const [profiles, stock] = await Promise.all([getDiaperProfiles(activeChild.id), getDiaperStock(activeChild.id)]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <PageContainer>
      <PageHeader title="Fraldas" description={activeChild.name} backHref="/quintal/higiene" backLabel="Higiene" />
      <HygieneModuleNav active="/quintal/higiene/fraldas" />

      <FieldError>{error}</FieldError>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink-muted">Fralda atual e histórico</h2>

        {profiles.length === 0 ? (
          <p className={cardClassName("p-4 text-sm text-ink-muted")}>Nenhuma fralda informada ainda.</p>
        ) : (
          <div className="space-y-2">
            {profiles.map((profile, index) => (
              <div key={profile.id} className={index === 0 ? inviteCardClassName("space-y-1 p-4") : cardClassName("space-y-1 p-3")}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium text-ink">
                    {[profile.size, profile.brand, profile.model].filter(Boolean).join(" · ") || "Sem detalhes"}
                  </p>
                  {index === 0 && <span className="shrink-0 text-xs font-medium text-ink-muted">Atual</span>}
                </div>
                <p className="text-xs text-ink-muted">Desde {dateLabel(profile.startedAt)}</p>
                {profile.notes && <p className="text-xs text-ink-muted">{profile.notes}</p>}
              </div>
            ))}
          </div>
        )}

        <details className="group">
          <summary className="cursor-pointer list-none text-sm font-medium text-ink underline underline-offset-2 marker:content-none">
            Adicionar fralda
          </summary>
          <form action={createDiaperProfileAction} className={cardClassName("mt-2 space-y-3 p-4")}>
            <input type="hidden" name="child_id" value={activeChild.id} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="profile_size">Tamanho</Label>
                <Input id="profile_size" name="size" placeholder="Ex.: M" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="profile_started_at">A partir de</Label>
                <Input id="profile_started_at" type="date" name="started_at" required defaultValue={today} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="profile_brand">Marca</Label>
                <Input id="profile_brand" name="brand" placeholder="Ex.: Pampers" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="profile_model">Modelo</Label>
                <Input id="profile_model" name="model" placeholder="Ex.: Confort Sec" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile_notes">Observação (opcional)</Label>
              <Input id="profile_notes" name="notes" placeholder="Ex.: trocou de tamanho por vazamento" />
            </div>
            <Button type="submit" className="w-full justify-center">
              Salvar fralda
            </Button>
          </form>
        </details>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink-muted">Estoque</h2>

        {stock.length === 0 ? (
          <p className={cardClassName("p-4 text-sm text-ink-muted")}>Nenhum estoque informado ainda.</p>
        ) : (
          <div className={cardClassName("divide-y divide-neutral")}>
            {stock.map((line) => (
              <div key={line.id} className="space-y-2 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-ink">{stockLineLabel(line)}</p>
                  <form action={deleteDiaperStockAction}>
                    <input type="hidden" name="child_id" value={activeChild.id} />
                    <input type="hidden" name="stock_id" value={line.id} />
                    {/* Alvo de toque real (antes: texto sem padding, achado
                        do diagnóstico de navegabilidade) — mesmo padrão de
                        "Confirmar remoção" em Configurações > Cuidadores. */}
                    <Button type="submit" variant="danger" className="px-2 py-1.5 text-xs">
                      Remover
                    </Button>
                  </form>
                </div>
                <form action={updateDiaperStockAction} className="flex items-center gap-2">
                  <input type="hidden" name="child_id" value={activeChild.id} />
                  <input type="hidden" name="stock_id" value={line.id} />
                  <Input
                    type="number"
                    name="quantity"
                    min={0}
                    defaultValue={line.quantity}
                    className="w-24"
                    aria-label="Quantidade"
                  />
                  <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
                    Atualizar
                  </Button>
                </form>
              </div>
            ))}
          </div>
        )}

        <details className="group">
          <summary className="cursor-pointer list-none text-sm font-medium text-ink underline underline-offset-2 marker:content-none">
            Adicionar ao estoque
          </summary>
          <form action={addDiaperStockAction} className={cardClassName("mt-2 space-y-3 p-4")}>
            <input type="hidden" name="child_id" value={activeChild.id} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="stock_size">Tamanho</Label>
                <Input id="stock_size" name="size" placeholder="Ex.: M" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="stock_quantity">Quantidade</Label>
                <Input id="stock_quantity" type="number" name="quantity" min={0} required defaultValue={0} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="stock_brand">Marca</Label>
                <Input id="stock_brand" name="brand" placeholder="Ex.: Pampers" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="stock_model">Modelo</Label>
                <Input id="stock_model" name="model" placeholder="Ex.: Confort Sec" />
              </div>
            </div>
            <Button type="submit" className="w-full justify-center">
              Adicionar
            </Button>
          </form>
        </details>

        <p className="text-xs text-ink-muted">
          O estoque mostra só o que você informou — o Quintal ainda não calcula quanto tempo ele
          deve durar.
        </p>
      </section>
    </PageContainer>
  );
}
