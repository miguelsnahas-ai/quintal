import { createClient } from "@/lib/supabase/server";
import { normalizeBrazilianPhone } from "@/lib/phone";

// ---------------------------------------------------------------------
// Refatoração do /ops — "Lista de interesse": pessoas que demonstraram
// interesse (waitlist_leads, alimentada pela landing page) mas ainda não
// são uma família ativa. Mesma tabela de sempre, só com status/
// observações/conversão adicionados nesta fase (ver a migration).
// ---------------------------------------------------------------------

export const leadStatuses = ["novo", "em_contato", "interessado", "convertido", "nao_interessado"] as const;
export type LeadStatus = (typeof leadStatuses)[number];

export const leadStatusLabels: Record<LeadStatus, string> = {
  novo: "Novo",
  em_contato: "Em contato",
  interessado: "Interessado",
  convertido: "Convertido",
  nao_interessado: "Não interessado",
};

export type OpsLeadSummary = {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  origin: string | null;
  status: LeadStatus;
  createdAt: string;
  updatedAt: string | null;
};

export type LeadListFilters = {
  query?: string;
  status?: LeadStatus;
  origin?: string;
  sort?: "created" | "updated";
};

// "Origem" reaproveita how_found (o que a pessoa respondeu no formulário)
// com utm_source como reforço quando how_found está vazio — nenhum campo
// novo, os dois já existiam.
function originOf(lead: { how_found: string | null; utm_source: string | null }): string | null {
  return lead.how_found ?? lead.utm_source ?? null;
}

export async function getLeadOrigins(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("waitlist_leads").select("how_found, utm_source");
  const origins = new Set<string>();
  for (const row of data ?? []) {
    const origin = originOf(row);
    if (origin) origins.add(origin);
  }
  return [...origins].sort();
}

export async function getLeadList(filters: LeadListFilters): Promise<OpsLeadSummary[]> {
  const supabase = await createClient();

  let query = supabase
    .from("waitlist_leads")
    .select("id, name, email, whatsapp, how_found, utm_source, status, created_at, updated_at");

  const trimmed = filters.query?.trim();
  if (trimmed) {
    const like = `%${trimmed}%`;
    query = query.or(`name.ilike.${like},email.ilike.${like},whatsapp.ilike.${like}`);
  }
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.origin) query = query.or(`how_found.eq.${filters.origin},utm_source.eq.${filters.origin}`);

  query = query.order(filters.sort === "updated" ? "updated_at" : "created_at", {
    ascending: false,
    nullsFirst: false,
  });

  const { data } = await query;

  return (data ?? []).map((lead) => ({
    id: lead.id,
    name: lead.name,
    email: lead.email,
    whatsapp: lead.whatsapp,
    origin: originOf(lead),
    status: lead.status as LeadStatus,
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
  }));
}

export type OpsLeadDetail = {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  origin: string | null;
  status: LeadStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
  convertedFamilyId: string | null;
  convertedFamilyName: string | null;
  // Respostas do próprio formulário — histórico básico do que a pessoa
  // disse de si, não um log de interações (isso não existe neste
  // produto; "histórico básico" pedido nesta fase é isto).
  surveyAnswers: { label: string; value: string }[];
};

function surveyList(values: string[] | null): string | null {
  if (!values || values.length === 0) return null;
  return values.join(", ");
}

export async function getLeadDetail(leadId: string): Promise<OpsLeadDetail | null> {
  const supabase = await createClient();
  const { data: lead } = await supabase.from("waitlist_leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) return null;

  let convertedFamilyName: string | null = null;
  if (lead.converted_family_id) {
    const { data: family } = await supabase
      .from("families")
      .select("name")
      .eq("id", lead.converted_family_id)
      .maybeSingle();
    convertedFamilyName = family?.name ?? null;
  }

  const surveyAnswers = [
    { label: "Quantidade de filhos", value: lead.child_count },
    { label: "Idade dos filhos", value: surveyList(lead.child_age) },
    { label: "Interesse em plano família", value: lead.family_setup_interest ? "Sim" : "Não" },
    { label: "Cuidadores envolvidos", value: surveyList(lead.caregivers) ?? lead.caregivers_other },
    { label: "Principais desafios", value: surveyList(lead.challenges) ?? lead.challenges_other },
    { label: "Rede de apoio", value: surveyList(lead.support_network) ?? lead.support_network_other },
    { label: "Profissionais acompanhando", value: lead.professionals ? surveyList(lead.professionals) : null },
    { label: "Já fez curso de parentalidade?", value: lead.course_which ?? lead.course_taken },
    { label: "Já usou outro app parecido?", value: lead.app_which ?? lead.app_used },
    { label: "O que espera do Quintal", value: lead.expectation },
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry.value));

  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    whatsapp: lead.whatsapp,
    origin: originOf(lead),
    status: lead.status as LeadStatus,
    notes: lead.notes,
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
    convertedFamilyId: lead.converted_family_id,
    convertedFamilyName,
    surveyAnswers,
  };
}

export async function updateLeadStatus(
  leadId: string,
  input: { status: LeadStatus; notes: string | null },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("waitlist_leads")
    .update({ status: input.status, notes: input.notes, updated_at: new Date().toISOString() })
    .eq("id", leadId);

  if (error) throw new Error(error.message);
}

// "Converter em família" — nunca duplica dados. Se o WhatsApp do lead já
// bate com um cuidador existente (a pessoa já criou a própria família
// pelo /comecar antes de alguém tratar o lead), só associa
// converted_family_id à família que já existe. Senão, cria a família e
// um cuidador owner — mesmo formato de dado que o fluxo de onboarding já
// usa (/comecar), sem herdar a lógica de sessão/redirect dele (esta ação
// roda de dentro do /ops, não abre sessão de família nenhuma). Preserva a
// origem do lead: converted_family_id aponta pra família nova/existente,
// mas a linha de waitlist_leads (com how_found/utm_*) nunca é apagada.
export async function convertLeadToFamily(leadId: string): Promise<{ familyId: string; reused: boolean }> {
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("waitlist_leads")
    .select("id, name, whatsapp, how_found")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) throw new Error("Interessado não encontrado.");

  const normalizedPhone = normalizeBrazilianPhone(lead.whatsapp);

  if (normalizedPhone) {
    const { data: existingCaregiver } = await supabase
      .from("caregivers")
      .select("family_id")
      .eq("phone_number", normalizedPhone)
      .maybeSingle();

    if (existingCaregiver) {
      await supabase
        .from("waitlist_leads")
        .update({
          status: "convertido",
          converted_family_id: existingCaregiver.family_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId);
      return { familyId: existingCaregiver.family_id, reused: true };
    }
  }

  const { data: family, error: familyError } = await supabase
    .from("families")
    .insert({
      name: `Família de ${lead.name}`,
      notes: lead.how_found ? `Convertido da lista de interesse (origem: ${lead.how_found}).` : "Convertido da lista de interesse.",
    })
    .select("id")
    .single();

  if (familyError || !family) {
    throw new Error(familyError?.message ?? "Não foi possível criar a família.");
  }

  if (normalizedPhone) {
    const { error: caregiverError } = await supabase.from("caregivers").insert({
      family_id: family.id,
      name: lead.name,
      phone_number: normalizedPhone,
      is_primary_contact: true,
      access_role: "owner",
    });
    if (caregiverError) {
      throw new Error(caregiverError.message);
    }
  }

  await supabase
    .from("waitlist_leads")
    .update({ status: "convertido", converted_family_id: family.id, updated_at: new Date().toISOString() })
    .eq("id", leadId);

  return { familyId: family.id, reused: false };
}
