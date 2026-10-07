import { createClient } from "@/lib/supabase/server";
import { ageLabel, dayLabel } from "@/lib/format";

// ---------------------------------------------------------------------
// Refatoração do /ops — "Famílias" é a tela principal do backoffice:
// "quem está usando o Quintal?". Lê os MESMOS dados do produto (families,
// children, caregivers, events, messages) — nenhuma tabela paralela, ver
// o princípio de dados desta fase. Usa createClient() (sessão do
// operador via Supabase Auth), não createServiceClient(): as policies de
// "authenticated" já dão acesso de leitura a tudo que esta tela precisa,
// e ficar atrás de RLS é a mesma defesa em profundidade que todo o resto
// de /ops já usa.
// ---------------------------------------------------------------------

export type OpsFamilyStatus = "active" | "inactive";

export type OpsFamilySummary = {
  id: string;
  name: string;
  childCount: number;
  caregiverCount: number;
  createdAt: string;
  lastActivityAt: string | null;
  lastActivityLabel: string;
  status: OpsFamilyStatus;
};

// "Uma família ativa significa que existe uma conta/família utilizável
// no produto" — não um campo editável à mão (nada aqui garante que
// alguém lembraria de virar o botão), e sim uma janela de recência: teve
// atividade (evento registrado ou mensagem trocada) ou foi criada nos
// últimos 30 dias. Sem status próprio no schema hoje — deriva sempre na
// leitura, então nunca fica desatualizado.
const ACTIVE_WINDOW_DAYS = 30;

function deriveStatus(lastActivityAt: string | null, createdAt: string): OpsFamilyStatus {
  const reference = lastActivityAt ?? createdAt;
  const days = (Date.now() - new Date(reference).getTime()) / (1000 * 60 * 60 * 24);
  return days <= ACTIVE_WINDOW_DAYS ? "active" : "inactive";
}

function lastActivityLabel(lastActivityAt: string | null): string {
  return lastActivityAt ? dayLabel(lastActivityAt) : "Sem atividade ainda";
}

export type FamilyListFilters = {
  query?: string;
  status?: OpsFamilyStatus;
  sort?: "activity" | "created";
};

// Resolve uma busca livre (nome da família, nome da criança, ou telefone
// do cuidador — a "identidade de contato" real que este produto tem:
// caregivers nunca teve e-mail, é WhatsApp-first, ver
// src/lib/familySession.ts) para o conjunto de family_id que batem.
// Três lookups pequenos + união em vez de um .or() entre tabelas
// diferentes, que o PostgREST não faz num select só.
async function matchingFamilyIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  query: string,
): Promise<Set<string>> {
  const like = `%${query}%`;
  const [{ data: byName }, { data: byChild }, { data: byCaregiver }] = await Promise.all([
    supabase.from("families").select("id").ilike("name", like),
    supabase.from("children").select("family_id").ilike("name", like),
    supabase.from("caregivers").select("family_id").ilike("phone_number", like),
  ]);

  const ids = new Set<string>();
  for (const row of byName ?? []) ids.add(row.id);
  for (const row of byChild ?? []) ids.add(row.family_id);
  for (const row of byCaregiver ?? []) ids.add(row.family_id);
  return ids;
}

export async function getFamilyList(filters: FamilyListFilters): Promise<OpsFamilySummary[]> {
  const supabase = await createClient();

  const trimmedQuery = filters.query?.trim();
  const matchedIds = trimmedQuery ? await matchingFamilyIds(supabase, trimmedQuery) : null;

  // Sem resultado nenhum de busca — nem vale consultar o resto.
  if (matchedIds && matchedIds.size === 0) return [];

  let familiesQuery = supabase.from("families").select("id, name, created_at");
  if (matchedIds) familiesQuery = familiesQuery.in("id", [...matchedIds]);
  const { data: families } = await familiesQuery;
  if (!families || families.length === 0) return [];

  const familyIds = families.map((family) => family.id);

  const [{ data: children }, { data: caregivers }] = await Promise.all([
    supabase.from("children").select("id, family_id").in("family_id", familyIds),
    supabase.from("caregivers").select("id, family_id").in("family_id", familyIds),
  ]);

  const childIds = (children ?? []).map((child) => child.id);

  const [{ data: events }, { data: messages }] = await Promise.all([
    childIds.length > 0
      ? supabase.from("events").select("child_id, occurred_at").in("child_id", childIds)
      : Promise.resolve({ data: [] as { child_id: string; occurred_at: string }[] }),
    supabase.from("messages").select("family_id, wa_timestamp").in("family_id", familyIds),
  ]);

  const childToFamily = new Map((children ?? []).map((child) => [child.id, child.family_id]));
  const childCountByFamily = new Map<string, number>();
  for (const child of children ?? []) {
    childCountByFamily.set(child.family_id, (childCountByFamily.get(child.family_id) ?? 0) + 1);
  }
  const caregiverCountByFamily = new Map<string, number>();
  for (const caregiver of caregivers ?? []) {
    caregiverCountByFamily.set(caregiver.family_id, (caregiverCountByFamily.get(caregiver.family_id) ?? 0) + 1);
  }

  const lastActivityByFamily = new Map<string, string>();
  const bump = (familyId: string | undefined, timestamp: string | null) => {
    if (!familyId || !timestamp) return;
    const current = lastActivityByFamily.get(familyId);
    if (!current || new Date(timestamp) > new Date(current)) {
      lastActivityByFamily.set(familyId, timestamp);
    }
  };
  for (const event of events ?? []) bump(childToFamily.get(event.child_id), event.occurred_at);
  for (const message of messages ?? []) bump(message.family_id ?? undefined, message.wa_timestamp);

  const summaries: OpsFamilySummary[] = families.map((family) => {
    const lastActivityAt = lastActivityByFamily.get(family.id) ?? null;
    return {
      id: family.id,
      name: family.name,
      childCount: childCountByFamily.get(family.id) ?? 0,
      caregiverCount: caregiverCountByFamily.get(family.id) ?? 0,
      createdAt: family.created_at,
      lastActivityAt,
      lastActivityLabel: lastActivityLabel(lastActivityAt),
      status: deriveStatus(lastActivityAt, family.created_at),
    };
  });

  const filtered = filters.status ? summaries.filter((family) => family.status === filters.status) : summaries;

  const sortKey = filters.sort ?? "activity";
  return [...filtered].sort((a, b) => {
    if (sortKey === "created") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
    const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
    return bTime - aTime;
  });
}

export type OpsFamilyChild = {
  id: string;
  name: string;
  birthDate: string | null;
  ageLabel: string | null;
};

export type OpsFamilyCaregiver = {
  id: string;
  name: string;
  phoneNumber: string;
  role: string | null;
  accessRole: string;
  isPrimaryContact: boolean;
  lastActivityAt: string | null;
  lastActivityLabel: string;
};

export type OpsFamilyDetail = {
  id: string;
  name: string;
  notes: string | null;
  createdAt: string;
  status: OpsFamilyStatus;
  lastActivityAt: string | null;
  lastActivityLabel: string;
  children: OpsFamilyChild[];
  caregivers: OpsFamilyCaregiver[];
  lastEventAt: string | null;
  lastMessageAt: string | null;
  eventCount: number;
};

// "Quem é essa família e o que está acontecendo com ela?" — dados
// agregados, não uma segunda Timeline/Dashboard (pedido explícito desta
// fase). Cada cuidador ganha sua própria última atividade (última
// mensagem daquele número) para "última interação relevante" fazer
// sentido por pessoa, não só por família.
export async function getFamilyDetail(familyId: string): Promise<OpsFamilyDetail | null> {
  const supabase = await createClient();

  const [{ data: family }, { data: children }, { data: caregivers }] = await Promise.all([
    supabase.from("families").select("id, name, notes, created_at").eq("id", familyId).maybeSingle(),
    supabase
      .from("children")
      .select("id, name, birth_date")
      .eq("family_id", familyId)
      .order("created_at", { ascending: true }),
    supabase
      .from("caregivers")
      .select("id, name, phone_number, role, access_role, is_primary_contact")
      .eq("family_id", familyId)
      .order("created_at", { ascending: true }),
  ]);

  if (!family) return null;

  const childIds = (children ?? []).map((child) => child.id);

  const [{ data: events }, { data: messages }] = await Promise.all([
    childIds.length > 0
      ? supabase.from("events").select("occurred_at").in("child_id", childIds).order("occurred_at", { ascending: false })
      : Promise.resolve({ data: [] as { occurred_at: string }[] }),
    supabase
      .from("messages")
      .select("caregiver_id, wa_timestamp")
      .eq("family_id", familyId)
      .order("wa_timestamp", { ascending: false }),
  ]);

  const lastEventAt = events?.[0]?.occurred_at ?? null;
  const lastMessageAt = messages?.[0]?.wa_timestamp ?? null;

  const lastMessageByCaregiver = new Map<string, string>();
  for (const message of messages ?? []) {
    if (!message.caregiver_id || !message.wa_timestamp) continue;
    if (!lastMessageByCaregiver.has(message.caregiver_id)) {
      lastMessageByCaregiver.set(message.caregiver_id, message.wa_timestamp);
    }
  }

  const lastActivityAt = [lastEventAt, lastMessageAt].filter((value): value is string => value !== null).sort().at(-1) ?? null;

  return {
    id: family.id,
    name: family.name,
    notes: family.notes,
    createdAt: family.created_at,
    status: deriveStatus(lastActivityAt, family.created_at),
    lastActivityAt,
    lastActivityLabel: lastActivityLabel(lastActivityAt),
    children: (children ?? []).map((child) => ({
      id: child.id,
      name: child.name,
      birthDate: child.birth_date,
      ageLabel: ageLabel(child.birth_date),
    })),
    caregivers: (caregivers ?? []).map((caregiver) => {
      const caregiverLastActivity = lastMessageByCaregiver.get(caregiver.id) ?? null;
      return {
        id: caregiver.id,
        name: caregiver.name,
        phoneNumber: caregiver.phone_number,
        role: caregiver.role,
        accessRole: caregiver.access_role,
        isPrimaryContact: caregiver.is_primary_contact,
        lastActivityAt: caregiverLastActivity,
        lastActivityLabel: lastActivityLabel(caregiverLastActivity),
      };
    }),
    lastEventAt,
    lastMessageAt,
    eventCount: events?.length ?? 0,
  };
}
