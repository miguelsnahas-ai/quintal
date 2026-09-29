import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getSessionCaregiver } from "@/lib/authorization";
import { getActiveChildContext } from "@/lib/activeChild";
import { createServiceClient } from "@/lib/supabase/service";
import { ageInMonths, groupByDay } from "@/lib/format";
import {
  getLibraryActivities,
  getActivitySuggestions,
  getActivityHistory,
  getRecentNegativeLibraryFeedbackActivityIds,
  type ActivityFilterInput,
} from "@/lib/play";
import { activityFeedbackLabels } from "@/lib/validation/play";
import { Input, Label, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import ActivityCard from "@/components/conversation/ActivityCard";

export const metadata: Metadata = {
  title: "Brincadeiras — Quintal",
  robots: { index: false, follow: false },
};

const TIME_OPTIONS = [
  { value: "", label: "Qualquer duração" },
  { value: "15", label: "Até 15 minutos" },
  { value: "30", label: "Até 30 minutos" },
  { value: "60", label: "Até 1 hora" },
];

const ENVIRONMENT_OPTIONS = [
  { value: "", label: "Qualquer ambiente" },
  { value: "home", label: "Em casa" },
  { value: "outdoor", label: "Ao ar livre" },
];

function parseCommaList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// Biblioteca de atividades + "Para hoje" curado + histórico — tudo sobre
// o que já existia desde a Fase 4/5/6 (Activity, recommendation.ts,
// events.type='free_play'), sem tabela nova (ver
// docs/ARCHITECTURE_TARGET.md, "Módulo de Brincadeiras (Fase 11)").
// Filtros via GET (?ambiente=&tempo=&materiais=&interesses=), zero JS de
// cliente — mesmo padrão de formulário nativo já usado em
// /quintal/alimentacao e /quintal/sono. Sempre sobre a criança ATIVA
// (Fase 16), trocada pelo seletor global no topo.
export default async function BrincadeirasPage({
  searchParams,
}: {
  searchParams: Promise<{ ambiente?: string; tempo?: string; materiais?: string; interesses?: string }>;
}) {
  const { ambiente, tempo, materiais, interesses } = await searchParams;
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const { active: activeChild } = await getActiveChildContext(session.caregiverId);

  if (!activeChild) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-6">
        <BackLink />
        <p className="rounded-lg bg-primary p-4 text-sm text-ink-muted shadow-[var(--shadow-card)]">
          Nenhuma criança cadastrada ainda para esta família.
        </p>
      </div>
    );
  }

  // interests não faz parte de AccessibleChild (é uma lista por criança,
  // só usada aqui e em /quintal/materiais) — uma busca pequena e à parte
  // em vez de carregar esse campo pra toda criança da família no
  // seletor global, onde nunca é usado.
  const supabase = createServiceClient();
  const { data: childRow } = await supabase
    .from("children")
    .select("interests")
    .eq("id", activeChild.id)
    .maybeSingle();

  const defaultInterests = (childRow?.interests ?? []).join(", ");
  const environment = ambiente === "home" || ambiente === "outdoor" ? ambiente : undefined;

  const filterInput: ActivityFilterInput = {
    ageMonths: ageInMonths(activeChild.birthDate),
    interests: parseCommaList(interesses ?? defaultInterests),
    environment,
    maxMinutes: tempo ? Number(tempo) : null,
    availableMaterials: parseCommaList(materiais),
  };

  const avoidIds = await getRecentNegativeLibraryFeedbackActivityIds(activeChild.id);

  const [todaySuggestions, library, history] = await Promise.all([
    getActivitySuggestions({ ...filterInput, excludeIds: avoidIds }, 3),
    getLibraryActivities(filterInput),
    getActivityHistory(activeChild.id),
  ]);

  const historyGroups = groupByDay(history, (entry) => entry.occurredAt);

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 px-4 py-6">
      <BackLink />

      <div>
        <h1 className="text-lg font-bold text-ink">Brincadeiras</h1>
        <p className="text-sm text-ink-muted">{activeChild.name}</p>
      </div>

      <form method="get" className="space-y-3 rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="ambiente">Ambiente</Label>
            <Select id="ambiente" name="ambiente" defaultValue={ambiente ?? ""}>
              {ENVIRONMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="tempo">Tempo disponível</Label>
            <Select id="tempo" name="tempo" defaultValue={tempo ?? ""}>
              {TIME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="interesses">Interesses</Label>
          <Input
            id="interesses"
            name="interesses"
            defaultValue={interesses ?? defaultInterests}
            placeholder="Ex.: animais, música, água"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="materiais">Materiais disponíveis (opcional)</Label>
          <Input
            id="materiais"
            name="materiais"
            defaultValue={materiais ?? ""}
            placeholder="Ex.: potes, tecidos, papelão"
          />
        </div>
        <Button type="submit">Filtrar</Button>
      </form>

      <section className="space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink-muted">
          <Sparkles className="h-4 w-4" aria-hidden />
          Para hoje
        </h2>
        {todaySuggestions.length > 0 ? (
          <div className="space-y-3">
            {todaySuggestions.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-secondary p-4 text-sm text-ink-muted shadow-[var(--shadow-card)]">
            Nenhuma atividade encontrada com esses filtros ainda — tente ajustar o ambiente, o
            tempo ou os materiais.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink-muted">Biblioteca</h2>
        {library.length > 0 ? (
          <div className="space-y-3">
            {library.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-primary p-4 text-sm text-ink-muted shadow-[var(--shadow-card)]">
            Nenhuma atividade encontrada com esses filtros.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink-muted">Histórico</h2>
        {historyGroups.length === 0 ? (
          <p className="rounded-lg bg-primary p-4 text-sm text-ink-muted shadow-[var(--shadow-card)]">
            Nenhuma atividade registrada ainda.
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
                        {entry.activityTitle ?? "Atividade"}
                        {entry.feedback && (
                          <span className="text-ink-muted"> · {activityFeedbackLabels[entry.feedback]}</span>
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
