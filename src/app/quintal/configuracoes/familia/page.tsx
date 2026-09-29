import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { getSessionCaregiver, canManageFamily } from "@/lib/authorization";
import { getFamilyProfile } from "@/lib/familyContext";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import SettingsTabs from "@/components/settings/SettingsTabs";
import { Input, Label, Textarea, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { updateFamilyNameAction, saveFamilyPreferencesAction } from "./actions";

export const metadata: Metadata = {
  title: "Minha família — Configurações — Quintal",
  robots: { index: false, follow: false },
};

const BASE_PATH = "/quintal/configuracoes/familia";
const TABS = [
  { value: "perfil", label: "Perfil da família" },
  { value: "preferencias", label: "Preferências da família" },
];

// "Minha família" (Fase 17) — as duas abas pedidas: perfil (hoje só o
// nome — o resto de "perfil da família" ainda não tem campo definido) e
// preferências (o formulário que já existia em /quintal/perfil, movido
// pra cá inteiro, sem mudar sua lógica).
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
          <form action={updateFamilyNameAction} className="space-y-3 rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]">
            <div className="space-y-1">
              <Label htmlFor="name">Nome da família</Label>
              <Input id="name" name="name" defaultValue={profile.family.name} required />
            </div>
            <Button type="submit">Salvar</Button>
          </form>
        ) : (
          <p className="rounded-lg bg-primary p-4 text-sm text-ink-muted shadow-[var(--shadow-card)]">
            Só quem administra a família ({profile.family.name}) pode renomeá-la.
          </p>
        ))}

      {activeTab === "preferencias" && (
        <form action={saveFamilyPreferencesAction} className="space-y-3 rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]">
          <p className="text-xs text-ink-muted">
            Preferências da família sobre alimentação, rotina, brincadeiras, materiais e como o
            Quintal deve conversar.
          </p>
          <div className="space-y-1">
            <Label htmlFor="feeding_notes">Alimentação</Label>
            <Textarea
              id="feeding_notes"
              name="feeding_notes"
              rows={2}
              defaultValue={profile.preferences?.feedingNotes ?? ""}
              placeholder="Ex.: evitamos açúcar, prefere comida em pedaços"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="routine_notes">Rotina</Label>
            <Textarea
              id="routine_notes"
              name="routine_notes"
              rows={2}
              defaultValue={profile.preferences?.routineNotes ?? ""}
              placeholder="Ex.: dorme cedo, soneca depois do almoço"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="play_notes">Brincadeiras</Label>
            <Textarea
              id="play_notes"
              name="play_notes"
              rows={2}
              defaultValue={profile.preferences?.playNotes ?? ""}
              placeholder="Ex.: prefere brincadeiras calmas, gosta de música"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="materials_notes">Materiais disponíveis</Label>
            <Textarea
              id="materials_notes"
              name="materials_notes"
              rows={2}
              defaultValue={profile.preferences?.materialsNotes ?? ""}
              placeholder="Ex.: temos blocos de montar, giz de cera, poucos brinquedos"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="interaction_style">Estilo de interação preferido</Label>
            <Textarea
              id="interaction_style"
              name="interaction_style"
              rows={2}
              defaultValue={profile.preferences?.interactionStyle ?? ""}
              placeholder="Ex.: respostas curtas e diretas, sem termos técnicos"
            />
          </div>
          <Button type="submit">Salvar preferências</Button>
        </form>
      )}
    </div>
  );
}
