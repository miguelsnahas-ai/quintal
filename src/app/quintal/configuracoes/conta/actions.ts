"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionCaregiver } from "@/lib/authorization";
import { updateCaregiverName } from "@/lib/familyContext";
import { updateCaregiverNameInputSchema } from "@/lib/validation/profile";

export async function updateCaregiverNameAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const parsed = updateCaregiverNameInputSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    redirect(`/quintal/configuracoes/conta?aba=perfil&error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  try {
    await updateCaregiverName(session.caregiverId, parsed.data.name);
  } catch {
    redirect(
      `/quintal/configuracoes/conta?aba=perfil&error=${encodeURIComponent("Não foi possível salvar. Tente de novo.")}`,
    );
  }

  revalidatePath("/quintal/configuracoes/conta");
  revalidatePath("/quintal/configuracoes");
  redirect("/quintal/configuracoes/conta?aba=perfil&success=1");
}
