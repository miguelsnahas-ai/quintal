"use server";

import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeBrazilianPhone } from "@/lib/phone";
import { createFamilySession } from "@/lib/familySession";

// No auth gate by design — this is the onboarding a parent completes on
// their own phone/browser. It creates a brand-new family scoped to the
// caregiver record it also creates, opens a session for that caregiver
// (see src/lib/familySession.ts), and lands them in /quintal.
export async function startFamily(formData: FormData) {
  const parentName = String(formData.get("parent_name") ?? "").trim();
  const phoneRaw = String(formData.get("phone_number") ?? "").trim();
  const childName = String(formData.get("child_name") ?? "").trim();
  const childBirthDate = String(formData.get("child_birth_date") ?? "").trim();

  if (!parentName) {
    redirect(`/comecar?error=${encodeURIComponent("Informe seu nome.")}`);
  }

  const phone = normalizeBrazilianPhone(phoneRaw);
  if (!phone) {
    redirect(
      `/comecar?error=${encodeURIComponent(
        "WhatsApp inválido. Use um número com DDD, ex: (11) 91234-5678.",
      )}`,
    );
  }

  if (!childName) {
    redirect(`/comecar?error=${encodeURIComponent("Informe o nome da criança.")}`);
  }

  if (!childBirthDate) {
    redirect(
      `/comecar?error=${encodeURIComponent("Informe a data de nascimento da criança.")}`,
    );
  }

  const supabase = createServiceClient();

  const { data: family, error: familyError } = await supabase
    .from("families")
    .insert({
      name: `Família de ${parentName}`,
      notes: "Cadastro via onboarding público (/comecar)",
    })
    .select("id")
    .single();

  if (familyError || !family) {
    redirect(
      `/comecar?error=${encodeURIComponent("Não foi possível criar o cadastro. Tente de novo.")}`,
    );
  }

  const { data: caregiver, error: caregiverError } = await supabase
    .from("caregivers")
    .insert({
      family_id: family.id,
      name: parentName,
      phone_number: phone,
      is_primary_contact: true,
    })
    .select("id")
    .single();

  if (caregiverError || !caregiver) {
    redirect(
      `/comecar?error=${encodeURIComponent("Não foi possível criar o cadastro. Tente de novo.")}`,
    );
  }

  const { error: childError } = await supabase.from("children").insert({
    family_id: family.id,
    name: childName,
    birth_date: childBirthDate,
  });

  if (childError) {
    redirect(
      `/comecar?error=${encodeURIComponent("Não foi possível salvar os dados da criança. Tente de novo.")}`,
    );
  }

  try {
    await createFamilySession(caregiver.id);
  } catch {
    redirect(
      `/comecar?error=${encodeURIComponent("Cadastro criado, mas não foi possível abrir sua sessão. Tente de novo.")}`,
    );
  }

  redirect("/quintal");
}
