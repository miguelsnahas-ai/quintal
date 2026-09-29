"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionCaregiver, canAccessChild } from "@/lib/authorization";
import { setActiveChildId } from "@/lib/activeChild";

// A ação do seletor de criança global (ChildSwitcher, renderizado pelo
// layout — src/app/quintal/layout.tsx). Nunca confia no child_id vindo
// do formulário sem revalidar: canAccessChild confere de novo que esta
// criança pertence ao cuidador da sessão, mesma defesa em profundidade
// já usada em toda action de /quintal/*.
export async function setActiveChildAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const childId = String(formData.get("child_id") ?? "");
  const allowed = await canAccessChild(session.caregiverId, childId);
  if (!allowed) {
    redirect("/quintal");
  }

  await setActiveChildId(childId);

  // Volta pra mesma página onde o seletor foi aberto, não sempre pro
  // Dashboard — trocar de criança na Timeline deveria continuar na
  // Timeline, revalidada com o novo contexto. Só confia no referer
  // quando ele aponta pro mesmo host (nunca redireciona pra fora daqui).
  const headersList = await headers();
  const referer = headersList.get("referer");
  const host = headersList.get("host");
  let backTo = "/quintal";
  if (referer && host) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.host === host) {
        backTo = `${refererUrl.pathname}${refererUrl.search}`;
      }
    } catch {
      // referer malformado — mantém o fallback "/quintal".
    }
  }

  redirect(backTo);
}
