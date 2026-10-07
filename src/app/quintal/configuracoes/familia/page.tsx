import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check, Users } from "lucide-react";
import { getSessionCaregiver, canManageFamily } from "@/lib/authorization";
import { getFamilyProfile } from "@/lib/familyContext";
import { materialCategories, materialCategoryLabels } from "@/lib/validation/library";
import {
  recommendationStyles,
  recommendationStyleLabels,
  routineFlexibilities,
  routineFlexibilityLabels,
  routineActivityFocuses,
  routineActivityFocusLabels,
} from "@/lib/validation/profile";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import SettingsTabs from "@/components/settings/SettingsTabs";
import { Input, Textarea, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { updateFamilyProfileAction, saveFamilyPreferencesAction } from "./actions";

export const metadata: Metadata = {
  title: "Minha família — Configurações — Quintal",
  robots: { index: false, follow: false },
};

const BASE_PATH = "/quintal/configuracoes/familia";
const TABS = [
  { value: "perfil", label: "Perfil da família" },
  { value: "preferencias", label: "Preferências da família" },
];

// "Minha família" (Fase 17, dados estruturados desde a Fase 19). A família
// é uma entidade própria — este perfil e estas preferências pertencem a
// ela, não a quem está logado (por isso vêm de families/family_preferences,
// nunca de caregivers). Permissão: só o owner edita (canManageFamily);
// qualquer outro cuidador só visualiza — as duas abas seguem essa mesma
// regra agora, cada uma renderizando um form (owner) ou um resumo
// somente-leitura (demais cuidadores).
export default async function FamiliaSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; error?: string; success?: string }>;
}) {
  const { aba, error, success } = await searchParams;
  const activeTab = TABS.some((tab) => tab.value === aba) ? aba! : TABS[0].value;

  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const [profile, isOwner] = await Promise.all([
    getFamilyProfile(session.familyId),
    canManageFamily(session.caregiverId, session.familyId),
  ]);

  if (!profile) {
    redirect("/comecar");
  }

  const initials = profile.family.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const preferences = profile.preferences;

  return (
    <div className="space-y-6">
      <SettingsPageHeader title="Minha família" description={profile.family.name} />
      <SettingsTabs basePath={BASE_PATH} tabs={TABS} active={activeTab} />

      <FieldError>{error}</FieldError>
      {success && (
        <p className="flex items-center gap-1.5 text-sm text-ink-muted">
          <Check className="h-4 w-4" aria-hidden />
          Salvo com sucesso.
        </p>
      )}

      {activeTab === "perfil" &&
        (isOwner ? (
          <form
            action={updateFamilyProfileAction}
            className="space-y-4 rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-center gap-4">
              {profile.family.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitrária colada pela família, não um asset do projeto.
                <img
                  src={profile.family.avatarUrl}
                  alt=""
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-lg font-semibold text-ink">
                  {initials || "?"}
                </span>
              )}
              <div className="flex-1 space-y-1">
                <Label htmlFor="avatar_url">Foto da família (URL)</Label>
                <Input
                  id="avatar_url"
                  name="avatar_url"
                  type="url"
                  placeholder="https://..."
                  defaultValue={profile.family.avatarUrl ?? ""}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="name">Nome da família</Label>
              <Input id="name" name="name" defaultValue={profile.family.name} required />
            </div>
            <Button type="submit">Salvar perfil</Button>
          </form>
        ) : (
          <div className="flex items-center gap-4 rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]">
            {profile.family.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitrária, não um asset do projeto.
              <img src={profile.family.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-lg font-semibold text-ink">
                {initials || "?"}
              </span>
            )}
            <div>
              <p className="text-sm font-semibold text-ink">{profile.family.name}</p>
              <p className="text-sm text-ink-muted">
                Só quem administra a família pode editar o perfil.
              </p>
            </div>
          </div>
        ))}

      {activeTab === "preferencias" && (
        <div className="space-y-4">
          <p className="flex items-start gap-1.5 rounded-lg bg-secondary p-3 text-xs text-ink-muted">
            <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Estas preferências são compartilhadas com os outros cuidadores da família.
          </p>

          {isOwner ? (
            <form
              action={saveFamilyPreferencesAction}
              className="space-y-6 rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]"
            >
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-ink">Estilo de recomendações</legend>
                <div className="flex flex-wrap gap-3">
                  {recommendationStyles.map((style) => (
                    <label key={style} className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="radio"
                        name="recommendation_style"
                        value={style}
                        defaultChecked={preferences?.recommendationStyle === style}
                      />
                      {recommendationStyleLabels[style]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-ink">Rotina</legend>
                <div className="space-y-1">
                  <p className="text-xs text-ink-muted">Flexibilidade</p>
                  <div className="flex flex-wrap gap-3">
                    {routineFlexibilities.map((option) => (
                      <label key={option} className="flex items-center gap-2 text-sm text-ink">
                        <input
                          type="radio"
                          name="routine_flexibility"
                          value={option}
                          defaultChecked={preferences?.routineFlexibility === option}
                        />
                        {routineFlexibilityLabels[option]}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-ink-muted">Atividades</p>
                  <div className="flex flex-wrap gap-3">
                    {routineActivityFocuses.map((option) => (
                      <label key={option} className="flex items-center gap-2 text-sm text-ink">
                        <input
                          type="radio"
                          name="routine_activity_focus"
                          value={option}
                          defaultChecked={preferences?.routineActivityFocus === option}
                        />
                        {routineActivityFocusLabels[option]}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="routine_notes">Outras observações sobre a rotina</Label>
                  <Textarea
                    id="routine_notes"
                    name="routine_notes"
                    rows={2}
                    defaultValue={preferences?.routineNotes ?? ""}
                    placeholder="Ex.: dorme cedo, soneca depois do almoço"
                  />
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-ink">Conteúdo</legend>
                <div className="space-y-1">
                  <p className="text-xs text-ink-muted">O que priorizar</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {materialCategories.map((category) => (
                      <label key={category} className="flex items-center gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          name="content_focus"
                          value={category}
                          defaultChecked={preferences?.contentFocus.includes(category) ?? false}
                        />
                        {materialCategoryLabels[category]}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="feeding_notes">Alimentação — observações</Label>
                    <Textarea
                      id="feeding_notes"
                      name="feeding_notes"
                      rows={2}
                      defaultValue={preferences?.feedingNotes ?? ""}
                      placeholder="Ex.: evitamos açúcar, prefere comida em pedaços"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="play_notes">Brincadeiras — observações</Label>
                    <Textarea
                      id="play_notes"
                      name="play_notes"
                      rows={2}
                      defaultValue={preferences?.playNotes ?? ""}
                      placeholder="Ex.: prefere brincadeiras calmas, gosta de música"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="materials_notes">Materiais disponíveis</Label>
                    <Textarea
                      id="materials_notes"
                      name="materials_notes"
                      rows={2}
                      defaultValue={preferences?.materialsNotes ?? ""}
                      placeholder="Ex.: temos blocos de montar, giz de cera, poucos brinquedos"
                    />
                  </div>
                </div>
              </fieldset>

              <div className="space-y-1">
                <Label htmlFor="interaction_style">Estilo de interação preferido</Label>
                <Textarea
                  id="interaction_style"
                  name="interaction_style"
                  rows={2}
                  defaultValue={preferences?.interactionStyle ?? ""}
                  placeholder="Ex.: respostas curtas e diretas, sem termos técnicos"
                />
              </div>

              <Button type="submit">Salvar preferências</Button>
            </form>
          ) : (
            <div className="space-y-3 rounded-lg bg-primary p-4 text-sm text-ink shadow-[var(--shadow-card)]">
              <p>
                <span className="font-medium">Estilo de recomendações:</span>{" "}
                {preferences?.recommendationStyle
                  ? recommendationStyleLabels[preferences.recommendationStyle]
                  : "Sem preferência definida"}
              </p>
              <p>
                <span className="font-medium">Rotina:</span>{" "}
                {preferences?.routineFlexibility
                  ? routineFlexibilityLabels[preferences.routineFlexibility]
                  : "Sem preferência definida"}
                {preferences?.routineActivityFocus
                  ? ` · ${routineActivityFocusLabels[preferences.routineActivityFocus]}`
                  : ""}
              </p>
              <p>
                <span className="font-medium">Conteúdo priorizado:</span>{" "}
                {preferences && preferences.contentFocus.length > 0
                  ? preferences.contentFocus.map((category) => materialCategoryLabels[category]).join(", ")
                  : "Sem preferência definida"}
              </p>
              <p className="text-xs text-ink-muted">
                Só quem administra a família pode editar as preferências.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
