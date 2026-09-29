import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check, Bell } from "lucide-react";
import { getSessionCaregiver } from "@/lib/authorization";
import { createServiceClient } from "@/lib/supabase/service";
import { getCaregiverPreferences } from "@/lib/caregiverPreferences";
import { materialCategories, materialCategoryLabels } from "@/lib/validation/library";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import SettingsTabs from "@/components/settings/SettingsTabs";
import { Input, Textarea, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import {
  updateCaregiverProfileAction,
  updateCaregiverPersonalPreferencesAction,
  updateCaregiverNotificationPreferencesAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Minha conta — Configurações — Quintal",
  robots: { index: false, follow: false },
};

const BASE_PATH = "/quintal/configuracoes/conta";
const TABS = [
  { value: "perfil", label: "Perfil" },
  { value: "preferencias", label: "Preferências pessoais" },
  { value: "notificacoes", label: "Notificações" },
];

// "Minha conta" (Fase 17, dados reais desde a Fase 18). Perfil, Preferências
// pessoais e Notificações têm cada um seu próprio form/ação — salvar uma
// aba nunca mexe nas outras, nem na família/crianças (cada ação abaixo só
// toca a própria tabela/colunas: caregivers para Perfil, caregiver_preferences
// para as outras duas). Sem e-mail de propósito: não existe login por
// e-mail/senha neste produto (só telefone, ver familySession.ts) — inventar
// um campo aqui duplicaria uma credencial que não existe.
export default async function ContaPage({
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

  const supabase = createServiceClient();
  const [{ data: caregiver }, preferences] = await Promise.all([
    supabase
      .from("caregivers")
      .select("name, phone_number, role, access_role, avatar_url")
      .eq("id", session.caregiverId)
      .maybeSingle(),
    getCaregiverPreferences(session.caregiverId),
  ]);

  if (!caregiver) {
    redirect("/comecar");
  }

  const initials = caregiver.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="space-y-6">
      <SettingsPageHeader title="Minha conta" description="Seu perfil, preferências e notificações" />
      <SettingsTabs basePath={BASE_PATH} tabs={TABS} active={activeTab} />

      <FieldError>{error}</FieldError>
      {success && (
        <p className="flex items-center gap-1.5 text-sm text-ink-muted">
          <Check className="h-4 w-4" aria-hidden />
          Salvo com sucesso.
        </p>
      )}

      {activeTab === "perfil" && (
        <form
          action={updateCaregiverProfileAction}
          className="space-y-4 rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]"
        >
          <div className="flex items-center gap-4">
            {caregiver.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitrária colada pelo cuidador, não um asset do projeto.
              <img
                src={caregiver.avatar_url}
                alt=""
                className="h-14 w-14 rounded-full object-cover"
              />
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
                defaultValue={caregiver.avatar_url ?? ""}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" defaultValue={caregiver.name} required />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>WhatsApp</Label>
              <p className="rounded-sm border border-neutral bg-secondary px-3 py-2 text-sm text-ink-muted">
                {caregiver.phone_number}
              </p>
            </div>
            <div className="space-y-1">
              <Label>Papel na família</Label>
              <p className="rounded-sm border border-neutral bg-secondary px-3 py-2 text-sm text-ink-muted">
                {caregiver.access_role === "owner" ? "Administrador da família" : "Cuidador"}
                {caregiver.role ? ` · ${caregiver.role}` : ""}
              </p>
            </div>
          </div>
          <p className="text-xs text-ink-muted">
            Seu WhatsApp e seu papel na família não podem ser editados por aqui ainda.
          </p>
          <Button type="submit">Salvar perfil</Button>
        </form>
      )}

      {activeTab === "preferencias" && (
        <form
          action={updateCaregiverPersonalPreferencesAction}
          className="space-y-4 rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]"
        >
          <div className="space-y-2">
            <Label>Que tipo de conteúdo você quer ver mais?</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {materialCategories.map((category) => (
                <label key={category} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="content_interests"
                    value={category}
                    defaultChecked={preferences.contentInterests.includes(category)}
                  />
                  {materialCategoryLabels[category]}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="communication_style">Como você prefere que o Quintal fale com você?</Label>
            <Textarea
              id="communication_style"
              name="communication_style"
              rows={3}
              placeholder="Ex.: direto e objetivo, ou com mais explicação e contexto."
              defaultValue={preferences.communicationStyle ?? ""}
            />
          </div>
          <Button type="submit">Salvar preferências</Button>
        </form>
      )}

      {activeTab === "notificacoes" && (
        <form
          action={updateCaregiverNotificationPreferencesAction}
          className="space-y-4 rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]"
        >
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="notify_general" defaultChecked={preferences.notifyGeneral} />
              Notificações gerais
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="notify_reminders" defaultChecked={preferences.notifyReminders} />
              Lembretes
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="notify_recommendations"
                defaultChecked={preferences.notifyRecommendations}
              />
              Recomendações
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="notify_routine_updates"
                defaultChecked={preferences.notifyRoutineUpdates}
              />
              Atualizações da rotina
            </label>
          </div>
          <p className="flex items-start gap-1.5 text-xs text-ink-muted">
            <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Isso define suas preferências — o envio de notificações ainda não existe no Quintal.
          </p>
          <Button type="submit">Salvar notificações</Button>
        </form>
      )}
    </div>
  );
}
