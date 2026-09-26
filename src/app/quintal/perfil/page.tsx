import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { redirect } from "next/navigation";
import { getFamilySessionCaregiverId } from "@/lib/familySession";
import { createServiceClient } from "@/lib/supabase/service";
import { getFamilyProfile } from "@/lib/familyContext";
import { Input, Label, Textarea, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { saveChildEssentials, saveFamilyPreferences } from "./actions";

export const metadata: Metadata = {
  title: "Perfil — Quintal",
  robots: { index: false, follow: false },
};

// Editable version of the Fase 7 read-only profile: essentials (name,
// birth date, interests) per child are always visible and each save
// independently; family-wide preferences live behind a native <details>
// disclosure ("configurações avançadas") — no client-side state needed
// for that split, just HTML that already knows how to collapse.
export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
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

  const profile = await getFamilyProfile(caregiver.family_id);
  if (!profile) {
    redirect("/comecar");
  }

  const primaryCaregiver =
    profile.caregivers.find((person) => person.isPrimaryContact) ?? profile.caregivers[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-6">
      <div>
        <Link href="/quintal" className="text-sm text-ink-muted hover:text-ink">
          ← Quintal
        </Link>
        <h1 className="text-lg font-bold text-ink">{profile.family.name}</h1>
        {primaryCaregiver && (
          <p className="text-sm text-ink-muted">
            {primaryCaregiver.name}
            {primaryCaregiver.role ? ` · ${primaryCaregiver.role}` : ""} · {primaryCaregiver.phoneNumber}
          </p>
        )}
      </div>

      <FieldError>{error}</FieldError>
      {success && (
        <p className="flex items-center gap-1.5 text-sm text-ink-muted">
          <Check className="h-4 w-4" aria-hidden />
          Salvo com sucesso.
        </p>
      )}

      {/* Essenciais primeiro — o que qualquer família quer ajustar mais
          frequentemente: nome, idade, o que a criança gosta. */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-ink-muted">Crianças</h2>
        {profile.children.length === 0 ? (
          <p className="rounded-lg bg-primary p-4 text-sm text-ink-muted shadow-[var(--shadow-card)]">
            Nenhuma criança cadastrada ainda.
          </p>
        ) : (
          <div className="space-y-3">
            {profile.children.map((child) => (
              <form
                key={child.id}
                action={saveChildEssentials}
                className="space-y-3 rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]"
              >
                <input type="hidden" name="child_id" value={child.id} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`name-${child.id}`}>Nome</Label>
                    <Input id={`name-${child.id}`} name="name" defaultValue={child.name} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`birth-${child.id}`}>Data de nascimento</Label>
                    <Input
                      id={`birth-${child.id}`}
                      type="date"
                      name="birth_date"
                      defaultValue={child.birthDate ?? ""}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`interests-${child.id}`}>
                    Interesses <span className="font-normal text-ink-muted">(separados por vírgula)</span>
                  </Label>
                  <Input
                    id={`interests-${child.id}`}
                    name="interests"
                    defaultValue={child.interests.join(", ")}
                    placeholder="Ex.: carros, música, animais"
                  />
                </div>
                <Button type="submit">Salvar {child.name}</Button>
              </form>
            ))}
          </div>
        )}
      </section>

      {/* Progressive disclosure: preferências da família ficam fechadas
          por padrão — quem quiser vai lá configurar, quem não quiser
          nunca vê um formulário grande. */}
      <details className="group rounded-lg bg-primary shadow-[var(--shadow-card)]">
        <summary className="cursor-pointer list-none p-4 text-sm font-medium text-ink marker:content-none">
          <span className="inline-flex items-center gap-1.5">
            Configurações avançadas
            <span className="text-ink-muted transition-transform duration-200 group-open:rotate-90">›</span>
          </span>
          <p className="mt-1 text-xs font-normal text-ink-muted">
            Preferências da família sobre alimentação, rotina, brincadeiras, materiais e como o
            Quintal deve conversar.
          </p>
        </summary>
        <form
          action={saveFamilyPreferences}
          className="space-y-3 border-t border-neutral p-4"
        >
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
      </details>
    </div>
  );
}
