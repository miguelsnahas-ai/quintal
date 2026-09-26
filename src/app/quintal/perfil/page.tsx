import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { getFamilySessionCaregiverId } from "@/lib/familySession";
import { ageLabel } from "@/lib/format";

export const metadata: Metadata = {
  title: "Perfil — Quintal",
  robots: { index: false, follow: false },
};

// Deliberately minimal and read-only — "Perfil da criança" as its own
// full module (edição, fotos, múltiplas crianças geridas aqui) is a
// separate future step (docs/PRODUCT_ROADMAP.md), not part of the
// Dashboard phase. This exists only so the dashboard header's "acesso ao
// perfil" tap target leads somewhere real instead of nowhere, using
// fields that already exist on `children`/`families` — no new schema.
export default async function PerfilPage() {
  const caregiverId = await getFamilySessionCaregiverId();
  if (!caregiverId) {
    redirect("/comecar");
  }

  const supabase = createServiceClient();

  const { data: caregiver } = await supabase
    .from("caregivers")
    .select("id, family_id, families(name)")
    .eq("id", caregiverId)
    .maybeSingle();

  if (!caregiver) {
    redirect("/comecar");
  }

  const { data: childrenList } = await supabase
    .from("children")
    .select("id, name, birth_date, sex, notes")
    .eq("family_id", caregiver.family_id)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-6">
      <div>
        <Link href="/quintal" className="text-sm text-ink-muted hover:text-ink">
          ← Quintal
        </Link>
        <h1 className="text-lg font-bold text-ink">{caregiver.families?.name ?? "Perfil"}</h1>
      </div>

      {!childrenList || childrenList.length === 0 ? (
        <p className="rounded-lg bg-primary p-4 text-sm text-ink-muted shadow-[var(--shadow-card)]">
          Nenhuma criança cadastrada ainda.
        </p>
      ) : (
        <div className="space-y-3">
          {childrenList.map((child) => (
            <div key={child.id} className="space-y-1 rounded-lg bg-primary p-4 shadow-[var(--shadow-card)]">
              <p className="font-semibold text-ink">{child.name}</p>
              <p className="text-sm text-ink-muted">
                {ageLabel(child.birth_date) ?? "Idade não informada"}
                {child.sex ? ` · ${child.sex}` : ""}
              </p>
              {child.notes && <p className="text-sm text-ink">{child.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
