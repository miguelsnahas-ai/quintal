"use server";

import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeBrazilianPhone } from "@/lib/phone";
import { createFamilySession } from "@/lib/familySession";
import { aboutCaregiverInputSchema } from "@/lib/validation/onboarding";

// Primeiro passo que grava alguma coisa de verdade: cria família +
// cuidador (owner) + sessão — o mínimo necessário pra existir uma
// família de verdade, que os próximos passos só vão complementando. Um
// WhatsApp já cadastrado é tratado como "bem-vindo de volta" (mesmo
// critério já usado em startFamily, a versão anterior deste fluxo): abre
// sessão pro cuidador existente e vai direto pra Home, sem repetir o
// onboarding.
export async function createCaregiverAction(formData: FormData) {
  const parsed = aboutCaregiverInputSchema.safeParse({
    role: formData.get("role"),
    name: formData.get("name"),
    phone_number: formData.get("phone_number"),
  });

  if (!parsed.success) {
    redirect(`/comecar/voce?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const phone = normalizeBrazilianPhone(parsed.data.phone_number);
  if (!phone) {
    redirect(
      `/comecar/voce?error=${encodeURIComponent("WhatsApp inválido. Use um número com DDD, ex: (11) 91234-5678.")}`,
    );
  }

  const supabase = createServiceClient();

  const { data: existingCaregiver } = await supabase
    .from("caregivers")
    .select("id")
    .eq("phone_number", phone)
    .maybeSingle();

  if (existingCaregiver) {
    try {
      await createFamilySession(existingCaregiver.id);
    } catch {
      redirect(
        `/comecar/voce?error=${encodeURIComponent("Esse WhatsApp já está cadastrado, mas não foi possível abrir sua sessão. Tente de novo.")}`,
      );
    }
    redirect("/quintal");
  }

  const { data: family, error: familyError } = await supabase
    .from("families")
    .insert({ name: `Família de ${parsed.data.name}` })
    .select("id")
    .single();

  if (familyError || !family) {
    redirect(`/comecar/voce?error=${encodeURIComponent("Não foi possível criar o cadastro. Tente de novo.")}`);
  }

  const { data: caregiver, error: caregiverError } = await supabase
    .from("caregivers")
    .insert({
      family_id: family.id,
      name: parsed.data.name,
      phone_number: phone,
      role: parsed.data.role,
      is_primary_contact: true,
      access_role: "owner",
    })
    .select("id")
    .single();

  if (caregiverError || !caregiver) {
    redirect(`/comecar/voce?error=${encodeURIComponent("Não foi possível criar o cadastro. Tente de novo.")}`);
  }

  try {
    await createFamilySession(caregiver.id);
  } catch {
    redirect(
      `/comecar/voce?error=${encodeURIComponent("Cadastro criado, mas não foi possível abrir sua sessão. Tente de novo.")}`,
    );
  }

  redirect("/comecar/familia");
}
