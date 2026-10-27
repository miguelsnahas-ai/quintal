"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionCaregiver, canInviteCaregiver } from "@/lib/authorization";
import { createInvitation } from "@/lib/invitations";
import { onboardingInviteInputSchema } from "@/lib/validation/onboarding";

export async function inviteCaregiverStepAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const allowed = await canInviteCaregiver(session.caregiverId, session.familyId);
  if (!allowed) {
    redirect("/comecar/preferencias");
  }

  const parsed = onboardingInviteInputSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    redirect(`/comecar/cuidadores?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  let token: string;
  try {
    ({ token } = await createInvitation({
      familyId: session.familyId,
      invitedBy: session.caregiverId,
      name: parsed.data.name,
      email: parsed.data.email,
      accessRole: "caregiver",
    }));
  } catch {
    redirect(`/comecar/cuidadores?error=${encodeURIComponent("Não foi possível criar o convite. Tente de novo.")}`);
  }

  const headersList = await headers();
  const origin = `${headersList.get("x-forwarded-proto") ?? "https"}://${headersList.get("host")}`;
  redirect(`/comecar/cuidadores?link=${encodeURIComponent(`${origin}/convite/${token}`)}`);
}
