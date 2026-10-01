import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";

// ---------------------------------------------------------------------
// Fase 16 — seleção global de criança ativa. Antes desta fase, toda
// página de /quintal/* usava "a primeira criança da família"
// (`childrenList?.[0] ?? null`) sem nenhuma forma de trocar — o mesmo
// código já buscava a lista completa de crianças em vários lugares, só
// nunca deixava escolher outra além da primeira. Este módulo substitui
// esse padrão por um cookie leve (mesmo estilo do cookie de sessão em
// src/lib/familySession.ts, mas para uma preocupação diferente: não é
// autenticação, é só "qual criança estou olhando agora"), sempre
// revalidado contra o acesso real do cuidador — nunca confia cegamente
// no valor do cookie.
// ---------------------------------------------------------------------

const ACTIVE_CHILD_COOKIE = "quintal_active_child";
const ACTIVE_CHILD_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export type AccessibleChild = {
  id: string;
  name: string;
  birthDate: string | null;
  avatarUrl: string | null;
};

// Toda criança que este cuidador pode ver — via caregiver_child (Fase
// 16), não mais via family_id diretamente. Ordenada por created_at
// (mais antiga primeiro), a mesma ordem que "primeira criança" já usava
// implicitamente antes desta fase, para o fallback abaixo continuar
// escolhendo a mesma criança que escolheria hoje quando não há nada
// salvo ainda.
export async function getAccessibleChildren(caregiverId: string): Promise<AccessibleChild[]> {
  const supabase = createServiceClient();

  const { data: links } = await supabase
    .from("caregiver_child")
    .select("child_id")
    .eq("caregiver_id", caregiverId);

  const childIds = (links ?? []).map((link) => link.child_id);
  if (childIds.length === 0) return [];

  const { data: children } = await supabase
    .from("children")
    .select("id, name, birth_date, avatar_url, created_at")
    .in("id", childIds)
    .order("created_at", { ascending: true });

  return (children ?? []).map((child) => ({
    id: child.id,
    name: child.name,
    birthDate: child.birth_date,
    avatarUrl: child.avatar_url,
  }));
}

// Chamado só a partir de uma Server Action (o switcher, ver
// src/app/quintal/actions.ts) — nunca durante a renderização de um
// Server Component, onde o Next.js proíbe escrever cookies.
export async function setActiveChildId(childId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_CHILD_COOKIE, childId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACTIVE_CHILD_MAX_AGE_SECONDS,
  });
}

// A decisão pura de "qual criança está ativa" — sem cookies, sem banco —
// isolada do código assíncrono ao redor pelo mesmo motivo de
// detectState/buildRoutineSuggestions em routineEngine.ts: testável sem
// mockar Next.js/Supabase. O valor do cookie só vale se apontar para uma
// criança que está em `children` (já filtrado por caregiver_child do
// lado de fora) — um cookie adulterado, copiado de outra sessão, ou
// apontando para uma criança removida do acesso simplesmente não bate
// com nada na lista e cai no fallback: a primeira da lista, a mesma
// escolha implícita que "primeira criança" sempre fazia antes desta
// fase.
export function resolveActiveChild(
  children: AccessibleChild[],
  cookieChildId: string | undefined,
): AccessibleChild | null {
  if (children.length === 0) return null;
  const fromCookie = cookieChildId ? children.find((child) => child.id === cookieChildId) : undefined;
  return fromCookie ?? children[0];
}

// A criança ativa agora + a lista completa de crianças acessíveis, numa
// só chamada — usado tanto pelo layout (precisa das duas, para o
// seletor) quanto por cada página (que só usa `.active`, mas ganhar a
// lista de graça é mais barato que uma segunda função que buscaria tudo
// de novo).
export async function getActiveChildContext(
  caregiverId: string,
): Promise<{ active: AccessibleChild | null; children: AccessibleChild[] }> {
  const children = await getAccessibleChildren(caregiverId);
  const cookieStore = await cookies();
  const cookieChildId = cookieStore.get(ACTIVE_CHILD_COOKIE)?.value;

  return { active: resolveActiveChild(children, cookieChildId), children };
}
