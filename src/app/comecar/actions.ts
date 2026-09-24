"use server";

import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeBrazilianPhone } from "@/lib/phone";

// No auth gate by design — this is the self-service signup a parent opens
// from a link the operator sends them. It only ever creates a brand-new
// family scoped to the caregiver record it also creates, then redirects
// straight into that caregiver's own /test/[caregiverId] chat.
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

  const supabase = createServiceClient();

  const { data: family, error: familyError } = await supabase
    .from("families")
    .insert({
      name: `Família de ${parentName}`,
      notes: "Cadastro via link público (/comecar)",
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

  if (childName) {
    await supabase.from("children").insert({
      family_id: family.id,
      name: childName,
      birth_date: childBirthDate || null,
    });
  }

  redirect(`/test/${caregiver.id}`);
}
