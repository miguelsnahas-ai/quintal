import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { Check, Heart, Sparkles, NotebookText } from "lucide-react";
import { getSessionCaregiver, canAccessChild, canEditChild, canManageFamily } from "@/lib/authorization";
import { createServiceClient } from "@/lib/supabase/service";
import { getChildContext, formatChildContextForPrompt } from "@/lib/childContext";
import { getChildPreferences } from "@/lib/childPreferences";
import { getFeedingMethodOptions, getChildFeedingMethod } from "@/lib/feeding";
import {
  childRoutinePreferences,
  childRoutinePreferenceLabels,
  childActivityStyles,
  childActivityStyleLabels,
} from "@/lib/validation/profile";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import SettingsTabs from "@/components/settings/SettingsTabs";
import EmptyState from "@/components/settings/EmptyState";
import { Input, Textarea, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import {
  saveChildProfileAction,
  saveChildPreferencesAction,
  saveChildFeedingMethodAction,
  removeChildAction,
} from "../actions";

export const metadata: Metadata = {
  title: "Criança — Configurações — Quintal",
  robots: { index: false, follow: false },
};

// Duas abas (revisão da área de Configurações: estrutura final pede só
// "Perfil da criança" e "Preferências da criança" — a antiga terceira
// aba "Contexto" virou parte de Preferências, ver abaixo).
const TABS = [
  { value: "perfil", label: "Perfil" },
  { value: "preferencias", label: "Preferências" },
];

// Página de uma criança específica (Fase 17, completa desde a Fase 20,
// consolidada na revisão da área de Configurações). Cada seção lê e
// escreve só pelo childId da URL — nunca há um "criança ativa" implícito
// aqui como em outras telas do produto, então dado de uma criança nunca
// aparece na página de outra. canEditChild (distinto de canAccessChild,
// ver src/lib/authorization.ts) decide se cada aba mostra um formulário
// ou um resumo somente-leitura: hoje todo cuidador com acesso à criança
// também tem permissão de edição (não existe ainda o conceito de
// cuidador só-leitura), mas a UI já está pronta para o dia em que essa
// distinção existir.
export default async function ChildSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string; error?: string; success?: string }>;
}) {
  const { id: childId } = await params;
  const { aba, error, success } = await searchParams;
  const activeTab = TABS.some((tab) => tab.value === aba) ? aba! : TABS[0].value;

  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const hasAccess = await canAccessChild(session.caregiverId, childId);
  if (!hasAccess) {
    notFound();
  }

  const supabase = createServiceClient();
  const [{ data: child }, isEditor, isOwner, preferences, feedingMethodOptions, feedingMethod] = await Promise.all([
    supabase.from("children").select("id, name, birth_date, sex, notes, avatar_url, interests").eq("id", childId).maybeSingle(),
    canEditChild(session.caregiverId, childId),
    canManageFamily(session.caregiverId, session.familyId),
    getChildPreferences(childId),
    getFeedingMethodOptions(),
    getChildFeedingMethod(childId),
  ]);

  if (!child) {
    notFound();
  }

  const initials = child.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const currentMethodLabel = feedingMethod.option?.title ?? feedingMethod.custom ?? null;

  return (
    <div className="space-y-6">
      <SettingsPageHeader title={child.name} backHref="/quintal/configuracoes/criancas" backLabel="Crianças" />
      <SettingsTabs basePath={`/quintal/configuracoes/criancas/${childId}`} tabs={TABS} active={activeTab} />

      <FieldError>{error}</FieldError>
      {success && (
        <p className="flex items-center gap-1.5 text-sm text-ink-muted">
          <Check className="h-4 w-4" aria-hidden />
          Salvo com sucesso.
        </p>
      )}

      {activeTab === "perfil" && (
        <div className="space-y-4">
          {isEditor ? (
            <form
              action={saveChildProfileAction}
              className="space-y-3 rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]"
            >
              <input type="hidden" name="child_id" value={child.id} />
              <div className="flex items-center gap-4">
                {child.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitrária, não um asset do projeto.
                  <img src={child.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover" />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-lg font-semibold text-ink">
                    {initials || "?"}
                  </span>
                )}
                <div className="flex-1 space-y-1">
                  <Label htmlFor="avatar_url">Foto (URL)</Label>
                  <Input
                    id="avatar_url"
                    name="avatar_url"
                    type="url"
                    placeholder="https://..."
                    defaultValue={child.avatar_url ?? ""}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" name="name" defaultValue={child.name} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="birth_date">Data de nascimento</Label>
                  <Input id="birth_date" type="date" name="birth_date" defaultValue={child.birth_date ?? ""} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sex">Sexo</Label>
                <Input id="sex" name="sex" defaultValue={child.sex ?? ""} placeholder="Opcional" />
              </div>
              <Button type="submit">Salvar perfil</Button>
            </form>
          ) : (
            <div className="flex items-center gap-4 rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]">
              {child.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitrária, não um asset do projeto.
                <img src={child.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover" />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-lg font-semibold text-ink">
                  {initials || "?"}
                </span>
              )}
              <div>
                <p className="text-sm font-semibold text-ink">{child.name}</p>
                <p className="text-sm text-ink-muted">
                  Você não tem permissão para editar o perfil desta criança.
                </p>
              </div>
            </div>
          )}

          <details id="metodo" className="group rounded-lg bg-primary shadow-[var(--shadow-card)]" open={!currentMethodLabel}>
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
                Isto configura a abordagem escolhida para {child.name} — o registro do dia a dia das
                refeições continua no módulo Alimentação.
              </p>
              {isEditor ? (
                <form action={saveChildFeedingMethodAction} className="space-y-2">
                  <input type="hidden" name="child_id" value={child.id} />
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
              ) : (
                <p className="text-sm text-ink-muted">
                  Você não tem permissão para alterar o método alimentar desta criança.
                </p>
              )}
            </div>
          </details>

          {isOwner && (
            <details className="group rounded-lg bg-primary shadow-[var(--shadow-card)]">
              <summary className="cursor-pointer list-none p-4 text-sm font-medium text-red-600 marker:content-none">
                Remover criança
              </summary>
              <form action={removeChildAction} className="space-y-2 border-t border-neutral p-4">
                <input type="hidden" name="child_id" value={child.id} />
                <p className="text-xs text-ink-muted">
                  Remove {child.name} e todo o histórico dela (sono, alimentação, brincadeiras, conversas).
                  Não pode ser desfeito.
                </p>
                <Button type="submit" variant="danger">
                  Confirmar remoção
                </Button>
              </form>
            </details>
          )}
        </div>
      )}

      {activeTab === "preferencias" &&
        (isEditor ? (
          <div className="space-y-4">
            <form
              action={saveChildPreferencesAction}
              className="space-y-6 rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]"
            >
              <input type="hidden" name="child_id" value={child.id} />

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-ink">Interesses e brincadeiras</legend>
                <div className="space-y-1">
                  <Label htmlFor="interests">
                    Interesses <span className="font-normal text-ink-muted">(separados por vírgula)</span>
                  </Label>
                  <Input
                    id="interests"
                    name="interests"
                    defaultValue={child.interests.join(", ")}
                    placeholder="Ex.: carros, música, animais"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="favorite_activities">
                    Brincadeiras favoritas <span className="font-normal text-ink-muted">(separadas por vírgula)</span>
                  </Label>
                  <Input
                    id="favorite_activities"
                    name="favorite_activities"
                    defaultValue={preferences.favoriteActivities.join(", ")}
                    placeholder="Ex.: esconde-esconde, massinha"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="preferred_materials">
                    Materiais de interesse <span className="font-normal text-ink-muted">(separados por vírgula)</span>
                  </Label>
                  <Input
                    id="preferred_materials"
                    name="preferred_materials"
                    defaultValue={preferences.preferredMaterials.join(", ")}
                    placeholder="Ex.: blocos de montar, giz de cera"
                  />
                </div>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-ink">Preferência de rotina</legend>
                <div className="flex flex-wrap gap-3">
                  {childRoutinePreferences.map((option) => (
                    <label key={option} className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="radio"
                        name="routine_preference"
                        value={option}
                        defaultChecked={preferences.routinePreference === option}
                      />
                      {childRoutinePreferenceLabels[option]}
                    </label>
                  ))}
                </div>
                <Textarea
                  name="routine_notes"
                  rows={2}
                  defaultValue={preferences.routineNotes ?? ""}
                  placeholder="Ex.: dorme às 20h, soneca depois do almoço"
                />
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-ink">Preferência de atividades</legend>
                <div className="flex flex-wrap gap-3">
                  {childActivityStyles.map((option) => (
                    <label key={option} className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="radio"
                        name="activity_style"
                        value={option}
                        defaultChecked={preferences.activityStyle === option}
                      />
                      {childActivityStyleLabels[option]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="space-y-1">
                <Label htmlFor="feeding_notes">Alimentação — preferências e contexto</Label>
                <Textarea
                  id="feeding_notes"
                  name="feeding_notes"
                  rows={2}
                  defaultValue={preferences.feedingNotes ?? ""}
                  placeholder="Ex.: não gosta de melancia, prefere comer sozinha"
                />
                <p className="text-xs text-ink-muted">
                  O método alimentar em si fica na aba Perfil — aqui é só preferência e contexto do dia a dia.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <NotebookText className="h-4 w-4 text-ink-muted" aria-hidden />
                  <Label htmlFor="notes">Sobre esta criança</Label>
                </div>
                <Textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  defaultValue={child.notes ?? ""}
                  placeholder="Ex.: está em fase de adaptação na escola nova"
                />
                <p className="text-xs text-ink-muted">
                  Um espaço livre para qualquer contexto relevante que não se encaixa nas preferências
                  estruturadas acima.
                </p>
              </div>

              <Button type="submit">Salvar preferências</Button>
            </form>

            <ChildContextView childId={child.id} childName={child.name} />
          </div>
        ) : (
          <EmptyState
            icon={Heart}
            title="Você não pode editar as preferências"
            description={`Você não tem permissão de edição para ${child.name}.`}
          />
        ))}
    </div>
  );
}

// À parte, para o fetch de getChildContext ficar isolado — dentro de um
// <details> fechado por padrão (reduz a complexidade visual da aba:
// dados estruturados/observações primeiro, este resumo é só para quem
// quer conferir). Mostra DADOS ESTRUTURADOS e OBSERVAÇÕES LIVRES juntos,
// exatamente como a IA os vê — não é editável diretamente aqui (a edição
// vive no formulário acima).
async function ChildContextView({ childId, childName }: { childId: string; childName: string }) {
  const supabase = createServiceClient();
  const context = await getChildContext(supabase, childId);

  if (!context) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Sem contexto ainda"
        description="Conforme a família for registrando sono, alimentação, brincadeiras e conversas, o que o Quintal sabe vai aparecer aqui."
      />
    );
  }

  const formatted = formatChildContextForPrompt(context);

  return (
    <details className="group rounded-lg bg-primary shadow-[var(--shadow-card)]">
      <summary className="cursor-pointer list-none p-4 text-sm font-medium text-ink marker:content-none">
        <span className="inline-flex items-center gap-1.5">
          O que o Quintal já sabe sobre {childName}
          <span className="text-ink-muted transition-transform duration-200 group-open:rotate-90">›</span>
        </span>
      </summary>
      <div className="space-y-3 border-t border-neutral p-4">
        <p className="text-xs text-ink-muted">
          Isto é, em texto simples, o que o Quintal considera hoje ao conversar e sugerir coisas para{" "}
          {childName} — não é editável diretamente aqui.
        </p>
        <pre className="whitespace-pre-wrap font-sans text-sm text-ink">{formatted}</pre>
      </div>
    </details>
  );
}
