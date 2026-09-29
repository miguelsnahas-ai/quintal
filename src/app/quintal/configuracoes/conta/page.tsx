import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check, Bell, SlidersHorizontal } from "lucide-react";
import { getSessionCaregiver } from "@/lib/authorization";
import { createServiceClient } from "@/lib/supabase/service";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import SettingsTabs from "@/components/settings/SettingsTabs";
import EmptyState from "@/components/settings/EmptyState";
import { Input, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { updateCaregiverNameAction } from "./actions";

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

// "Minha conta" (Fase 17). Perfil é a única aba com dado/ação de verdade
// nesta etapa (o próprio nome — telefone e papel de acesso ficam fora,
// ver updateCaregiverNameInputSchema); Preferências pessoais e
// Notificações ainda não têm um modelo de dados por trás (não existe
// "preferência pessoal" nem "configuração de notificação" hoje no
// schema) — aparecem como estado vazio honesto, não um formulário que
// finge salvar algo.
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
  const { data: caregiver } = await supabase
    .from("caregivers")
    .select("name, phone_number, role, access_role")
    .eq("id", session.caregiverId)
    .maybeSingle();

  if (!caregiver) {
    redirect("/comecar");
  }

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
        <form action={updateCaregiverNameAction} className="space-y-4 rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]">
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
              <Label>Papel</Label>
              <p className="rounded-sm border border-neutral bg-secondary px-3 py-2 text-sm text-ink-muted">
                {caregiver.access_role === "owner" ? "Administrador(a)" : "Cuidador(a)"}
                {caregiver.role ? ` · ${caregiver.role}` : ""}
              </p>
            </div>
          </div>
          <p className="text-xs text-ink-muted">
            Seu WhatsApp e seu papel na família não podem ser editados por aqui ainda.
          </p>
          <Button type="submit">Salvar nome</Button>
        </form>
      )}

      {activeTab === "preferencias" && (
        <EmptyState
          icon={SlidersHorizontal}
          title="Preferências pessoais em breve"
          description="Aqui você vai poder ajustar como o Quintal se comunica com você especificamente — tom, frequência, o que priorizar."
        />
      )}

      {activeTab === "notificacoes" && (
        <EmptyState
          icon={Bell}
          title="Notificações em breve"
          description="Aqui você vai poder escolher quando e como o Quintal te avisa sobre a rotina da família."
        />
      )}
    </div>
  );
}
