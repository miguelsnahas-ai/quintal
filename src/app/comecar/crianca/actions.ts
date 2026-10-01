"use server";

import { redirect } from "next/navigation";
import { getSessionCaregiver } from "@/lib/authorization";
import { getAccessibleChildren } from "@/lib/activeChild";
import { createChild } from "@/lib/familyContext";
import { childStepInputSchema } from "@/lib/validation/onboarding";

export async function addChildStepAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const intent = String(formData.get("intent") ?? "continue");
  const nameRaw = String(formData.get("name") ?? "").trim();

  // Campo em branco: só é um erro quando há algo que exigiria um nome
  // (nenhuma criança ainda, ou pediu explicitamente "adicionar outra") —
  // continuar com quem já está na lista, sem adicionar mais ninguém,
  // não precisa preencher nada.
  if (!nameRaw) {
    const existing = await getAccessibleChildren(session.caregiverId);
    if (intent === "add_another" || existing.length === 0) {
      redirect(`/comecar/crianca?error=${encodeURIComponent("Informe o nome da criança.")}`);
    }
    redirect("/comecar/cuidadores");
  }

  const parsed = childStepInputSchema.safeParse({
    name: nameRaw,
    birth_date: formData.get("birth_date"),
    avatar_url: formData.get("avatar_url"),
  });

  if (!parsed.success) {
    redirect(`/comecar/crianca?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  try {
    await createChild(session.familyId, {
      name: parsed.data.name,
      birthDate: parsed.data.birth_date,
      avatarUrl: parsed.data.avatar_url,
    });
  } catch {
    redirect(`/comecar/crianca?error=${encodeURIComponent("Não foi possível salvar. Tente de novo.")}`);
  }

  redirect(intent === "add_another" ? "/comecar/crianca" : "/comecar/cuidadores");
}
