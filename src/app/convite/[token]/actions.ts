"use server";

import { redirect } from "next/navigation";
import { acceptInvitation } from "@/lib/invitations";
import { acceptInvitationInputSchema } from "@/lib/validation/invitation";
import { normalizeBrazilianPhone } from "@/lib/phone";
import { createFamilySession } from "@/lib/familySession";

// Aceitar um convite (Fase 16) — mesmo modelo de "conta" que /comecar já
// usa (nome + WhatsApp, sem senha): ver acceptInvitation em
// src/lib/invitations.ts para a regra central (um telefone só pertence a
// uma família por vez neste MVP).
export async function acceptInvitationAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");

  const parsed = acceptInvitationInputSchema.safeParse({
    name: formData.get("name"),
    phone_number: formData.get("phone_number"),
  });

  if (!parsed.success) {
    redirect(`/convite/${token}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const phone = normalizeBrazilianPhone(parsed.data.phone_number);
  if (!phone) {
    redirect(
      `/convite/${token}?error=${encodeURIComponent("WhatsApp inválido. Use um número com DDD, ex: (11) 91234-5678.")}`,
    );
  }

  const result = await acceptInvitation(token, { name: parsed.data.name, phoneNumber: phone });

  if ("error" in result) {
    redirect(`/convite/${token}?error=${encodeURIComponent(result.error)}`);
  }

  try {
    await createFamilySession(result.caregiverId);
  } catch {
    redirect(
      `/convite/${token}?error=${encodeURIComponent("Convite aceito, mas não foi possível abrir sua sessão. Tente de novo.")}`,
    );
  }

  redirect("/quintal");
}
