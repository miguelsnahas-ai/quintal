import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFamilySessionCaregiverId } from "@/lib/familySession";
import { createServiceClient } from "@/lib/supabase/service";
import { ageInMonths, toDatetimeLocalValue, groupByDay } from "@/lib/format";
import {
  getChildFeedingMethod,
  getFeedingMethodOptions,
  getMealSuggestions,
  getMealHistory,
  guessMealSlot,
} from "@/lib/feeding";
import {
  mealSlots,
  mealSlotLabels,
  mealAcceptances,
  mealAcceptanceLabels,
  type MealSlot,
} from "@/lib/validation/feeding";
import { Input, Label, Select, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import MealSuggestionCard from "@/components/feeding/MealSuggestionCard";
import { logMeal, saveFeedingMethod } from "./actions";

export const metadata: Metadata = {
  title: "Alimentação — Quintal",
  robots: { index: false, follow: false },
};

// A experiência própria de Alimentação pedida nesta fase: registrar uma
// refeição em poucos segundos (o formulário fica logo no topo), ver
// sugestões adaptadas ao método escolhido, consultar o histórico, e
// configurar o método alimentar — sem apresentar nenhuma abordagem como
// a certa. Mesmo padrão de acesso das outras páginas de /quintal
// (sessão → family_id → primeira criança).
export default async function AlimentacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; slot?: string; foods?: string; suggestion?: string }>;
}) {
  const { error, success, slot: slotParam, foods: foodsParam, suggestion: suggestionParam } = await searchParams;
  const caregiverId = await getFamilySessionCaregiverId();
  if (!caregiverId) {
    redirect("/comecar");
  }

  const supabase = createServiceClient();
  const { data: caregiver } = await supabase
    .from("caregivers")
    .select("id, family_id")
    .eq("id", caregiverId)
    .maybeSingle();

  if (!caregiver) {
    redirect("/comecar");
  }

  const { data: childrenList } = await supabase
    .from("children")
    .select("id, name, birth_date")
    .eq("family_id", caregiver.family_id)
    .order("created_at", { ascending: true });

  // Mesma simplificação de "primeira criança da família" já usada em
  // /quintal e /quintal/perfil.
  const primaryChild = childrenList?.[0] ?? null;

  if (!primaryChild) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-6">
        <BackLink />
        <p className="rounded-lg bg-primary p-4 text-sm text-ink-muted shadow-[var(--shadow-card)]">
          Nenhuma criança cadastrada ainda para esta família.
        </p>
      </div>
    );
  }

  const defaultSlot: MealSlot = mealSlots.includes(slotParam as MealSlot)
    ? (slotParam as MealSlot)
    : guessMealSlot(new Date().getHours());

  const [feedingMethod, feedingMethodOptions, history] = await Promise.all([
    getChildFeedingMethod(primaryChild.id),
    getFeedingMethodOptions(),
    getMealHistory(primaryChild.id),
  ]);

  const currentMethodLabel = feedingMethod.option?.title ?? feedingMethod.custom ?? null;

  const suggestions = await getMealSuggestions({
    ageMonths: ageInMonths(primaryChild.birth_date),
    slot: defaultSlot,
    feedingMethodTitle: currentMethodLabel,
  });

  const historyGroups = groupByDay(history, (entry) => entry.occurredAt);

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 px-4 py-6">
      <BackLink />

      <div>
        <h1 className="text-lg font-bold text-ink">Alimentação</h1>
        <p className="text-sm text-ink-muted">{primaryChild.name}</p>
      </div>

      <FieldError>{error}</FieldError>
      {success && <p className="text-sm text-ink-muted">Salvo com sucesso.</p>}

      <section id="registrar" className="scroll-mt-4 space-y-3">
        <h2 className="text-sm font-medium text-ink-muted">Registrar refeição</h2>
        <form
          action={logMeal}
          className="space-y-3 rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]"
        >
          <input type="hidden" name="child_id" value={primaryChild.id} />
          {suggestionParam && <input type="hidden" name="suggestion_id" value={suggestionParam} />}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="slot">Refeição</Label>
              <Select id="slot" name="slot" defaultValue={defaultSlot} required>
                {mealSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {mealSlotLabels[slot]}
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
          </div>
          <div className="space-y-1">
            <Label htmlFor="foods">O que foi oferecido</Label>
            <Input
              id="foods"
              name="foods"
              defaultValue={foodsParam ?? ""}
              placeholder="Ex.: arroz, feijão, abóbora, frango"
            />
          </div>
          <div className="space-y-1">
            <Label>Aceitação</Label>
            <div className="flex flex-wrap gap-2">
              {mealAcceptances.map((acceptance, index) => (
                <label key={acceptance} className="cursor-pointer">
                  <input
                    type="radio"
                    name="acceptance"
                    value={acceptance}
                    className="peer sr-only"
                    defaultChecked={index === 0}
                    required
                  />
                  <span className="block rounded-full border-[1.5px] border-neutral px-3 py-2 text-sm text-ink transition-colors peer-checked:border-transparent peer-checked:bg-accent">
                    {mealAcceptanceLabels[acceptance]}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">Observação (opcional)</Label>
            <Input id="notes" name="notes" placeholder="Ex.: comeu tudo rapidinho" />
          </div>
          <Button type="submit">Registrar</Button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink-muted">Sugestões para {mealSlotLabels[defaultSlot].toLowerCase()}</h2>
        {suggestions.length > 0 ? (
          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <MealSuggestionCard key={suggestion.id} suggestion={suggestion} slot={defaultSlot} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-primary p-4 text-sm text-ink-muted shadow-[var(--shadow-card)]">
            Nenhuma sugestão disponível para essa faixa etária ainda.
          </p>
        )}
        <p className="text-xs text-ink-muted">
          Sugestões gerais, não uma prescrição — dúvidas específicas valem uma conversa com o
          pediatra ou nutricionista.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink-muted">Histórico</h2>
        {historyGroups.length === 0 ? (
          <p className="rounded-lg bg-primary p-4 text-sm text-ink-muted shadow-[var(--shadow-card)]">
            Nenhuma refeição registrada ainda.
          </p>
        ) : (
          <div className="space-y-4">
            {historyGroups.map((group) => (
              <div key={group.label} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {group.label}
                </h3>
                <div className="space-y-2">
                  {group.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex gap-3 rounded-lg bg-primary p-3 text-sm shadow-[var(--shadow-card)]"
                    >
                      <span className="shrink-0 pt-0.5 font-mono text-xs text-ink-muted">
                        {new Date(entry.occurredAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <p className="text-ink">
                        <span className="font-medium">{mealSlotLabels[entry.slot]}</span>
                        {entry.foods.length > 0 ? ` — ${entry.foods.join(", ")}` : ` — ${entry.notes}`}
                        {entry.acceptance !== "unknown" && (
                          <span className="text-ink-muted"> · {mealAcceptanceLabels[entry.acceptance]}</span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <details id="metodo" className="group scroll-mt-4 rounded-lg bg-primary shadow-[var(--shadow-card)]" open={!currentMethodLabel}>
        <summary className="cursor-pointer list-none p-4 text-sm font-medium text-ink marker:content-none">
          <span className="inline-flex items-center gap-1.5">
            Método alimentar
            <span className="text-ink-muted transition-transform duration-200 group-open:rotate-90">›</span>
          </span>
          <p className="mt-1 text-xs font-normal text-ink-muted">
            {currentMethodLabel ? `Atual: ${currentMethodLabel}` : "Ainda não configurado — a escolha é sua."}
          </p>
        </summary>
        <div className="space-y-3 border-t border-neutral p-4">
          <p className="text-xs text-ink-muted">
            Nenhuma abordagem é mais certa que a outra — a escolha é da família. Para dúvidas
            específicas, vale conversar com o pediatra.
          </p>
          <form action={saveFeedingMethod} className="space-y-2">
            <input type="hidden" name="child_id" value={primaryChild.id} />
            {feedingMethodOptions.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-start gap-2 rounded-lg border-[1.5px] border-neutral p-3 has-[:checked]:border-accent has-[:checked]:bg-accent/20"
              >
                <input
                  type="radio"
                  name="method_id"
                  value={option.id}
                  defaultChecked={feedingMethod.option?.id === option.id}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium text-ink">{option.title}</span>
                  {option.howItWorks && (
                    <span className="block text-xs text-ink-muted">{option.howItWorks}</span>
                  )}
                </span>
              </label>
            ))}
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border-[1.5px] border-neutral p-3 has-[:checked]:border-accent has-[:checked]:bg-accent/20">
              <input
                type="radio"
                name="method_id"
                value=""
                defaultChecked={!feedingMethod.option}
                className="mt-1"
              />
              <span className="block text-sm font-medium text-ink">Outro / personalizado</span>
            </label>
            <div className="space-y-1">
              <Label htmlFor="method_custom">Descreva (se escolheu &quot;outro&quot;)</Label>
              <Input
                id="method_custom"
                name="method_custom"
                defaultValue={feedingMethod.custom ?? ""}
                placeholder="Ex.: seguimos orientação da nutricionista"
              />
            </div>
            <Button type="submit">Salvar método</Button>
          </form>
        </div>
      </details>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/quintal" className="text-sm text-ink-muted hover:text-ink">
      ← Quintal
    </Link>
  );
}

