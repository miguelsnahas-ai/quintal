import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { Check, Heart, Sparkles } from "lucide-react";
import { getSessionCaregiver, canAccessChild } from "@/lib/authorization";
import { createServiceClient } from "@/lib/supabase/service";
import { getChildContext, formatChildContextForPrompt } from "@/lib/childContext";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader";
import SettingsTabs from "@/components/settings/SettingsTabs";
import EmptyState from "@/components/settings/EmptyState";
import { Input, Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { saveChildEssentialsAction } from "../actions";

export const metadata: Metadata = {
  title: "Criança — Configurações — Quintal",
  robots: { index: false, follow: false },
};

const TABS = [
  { value: "perfil", label: "Perfil" },
  { value: "preferencias", label: "Preferências" },
  { value: "contexto", label: "Contexto" },
];

// Página de uma criança específica (Fase 17). Perfil reaproveita o
// mesmo formulário de essenciais que já existia em /quintal/perfil
// (nome/nascimento/interesses), agora com sua própria URL em vez de
// dividir espaço com as outras crianças numa lista só. Preferências (por
// criança, diferente das preferências da família) ainda não existe como
// conceito no schema — estado vazio honesto. Contexto reaproveita 100%
// getChildContext/formatChildContextForPrompt (já existentes, usados
// hoje só internamente pelos prompts de IA): mostra à família,
// literalmente, o que o Quintal já sabe sobre a criança.
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

  const allowed = await canAccessChild(session.caregiverId, childId);
  if (!allowed) {
    notFound();
  }

  const supabase = createServiceClient();
  const { data: child } = await supabase
    .from("children")
    .select("id, name, birth_date, interests")
    .eq("id", childId)
    .maybeSingle();

  if (!child) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        title={child.name}
        backHref="/quintal/configuracoes/criancas"
        backLabel="Crianças"
      />
      <SettingsTabs basePath={`/quintal/configuracoes/criancas/${childId}`} tabs={TABS} active={activeTab} />

      <FieldError>{error}</FieldError>
      {success && (
        <p className="flex items-center gap-1.5 text-sm text-ink-muted">
          <Check className="h-4 w-4" aria-hidden />
          Salvo com sucesso.
        </p>
      )}

      {activeTab === "perfil" && (
        <form action={saveChildEssentialsAction} className="space-y-3 rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]">
          <input type="hidden" name="child_id" value={child.id} />
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
          <Button type="submit">Salvar</Button>
        </form>
      )}

      {activeTab === "preferencias" && (
        <EmptyState
          icon={Heart}
          title="Preferências desta criança em breve"
          description={`Uma preferência específica de ${child.name} (diferente das preferências da família) vai poder ser configurada aqui.`}
        />
      )}

      {activeTab === "contexto" && <ChildContextView childId={child.id} />}
    </div>
  );
}

// À parte, para o fetch de getChildContext ficar isolado — só roda
// quando a aba "contexto" está ativa, e é o único trecho desta página
// que precisa de uma consulta mais pesada (histórico recente, preferências
// da família, método alimentar...).
async function ChildContextView({ childId }: { childId: string }) {
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
    <div className="space-y-3 rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]">
      <p className="text-xs text-ink-muted">
        Isto é, em texto simples, o que o Quintal considera hoje ao conversar e sugerir coisas para{" "}
        {context.child.name} — não é editável diretamente aqui.
      </p>
      <pre className="whitespace-pre-wrap font-sans text-sm text-ink">{formatted}</pre>
    </div>
  );
}
