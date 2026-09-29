import { createServiceClient } from "@/lib/supabase/service";
import { getFamilySessionCaregiverId } from "@/lib/familySession";

// ---------------------------------------------------------------------
// Fase 16 — camada de autorização centralizada. Antes desta fase, cada
// action.ts de /quintal/* reimplementava o mesmo trecho ("resolver
// caregiverId da sessão → buscar family_id → comparar") com pequenas
// variações; isso é exatamente o "não espalhar verificações diferentes
// por toda a aplicação" que esta fase pede para corrigir. Daqui em
// diante, toda checagem de acesso passa por uma destas funções — nunca
// uma comparação de family_id/child_id escrita à mão num arquivo novo.
//
// IMPORTANTE sobre onde isso roda: todo /quintal/* usa o cliente
// service-role (createServiceClient), que ignora RLS por design — não
// há sessão do Supabase Auth para uma família (ver src/lib/familySession.ts).
// Isso significa que esta camada de aplicação É a camada de autorização
// de fato para o produto de família, não uma segunda linha de defesa
// sobre RLS. Nenhuma rota de família expõe o Supabase ao navegador
// diretamente (nem anon key, nem a URL de dados) — todo acesso passa por
// Server Components/Server Actions, então esta é a única superfície que
// precisa aplicar essas regras, e ela as aplica sempre no servidor, nunca
// confiando em nada vindo do cliente além de IDs que são sempre
// revalidados aqui. RLS nas tabelas novas (caregiver_child,
// family_invitations) segue a policy "authenticated" já usada em todo o
// resto do schema (uso interno do /ops via Supabase Auth) — não é a
// camada que protege o produto de família.
// ---------------------------------------------------------------------

export type AccessRole = "owner" | "caregiver";

export type SessionCaregiver = {
  caregiverId: string;
  familyId: string;
  accessRole: AccessRole;
};

// Substitui o `requireFamilyId()` duplicado em cada actions.ts: resolve o
// cookie de sessão (src/lib/familySession.ts) até um caregiver de verdade
// e sua família, num só lugar. Retorna null (em vez de redirecionar ou
// lançar) de propósito — cada chamador já sabe se deve `redirect()` (a
// maioria das páginas/actions) ou lançar um Error (as poucas actions
// chamadas via client-side startTransition, como logActivityOutcomeAction
// e sendQuintalMessage); esta função não teria como adivinhar qual.
export async function getSessionCaregiver(): Promise<SessionCaregiver | null> {
  const caregiverId = await getFamilySessionCaregiverId();
  if (!caregiverId) return null;

  const supabase = createServiceClient();
  const { data: caregiver } = await supabase
    .from("caregivers")
    .select("id, family_id, access_role")
    .eq("id", caregiverId)
    .maybeSingle();

  if (!caregiver) return null;

  return {
    caregiverId: caregiver.id,
    familyId: caregiver.family_id,
    accessRole: caregiver.access_role as AccessRole,
  };
}

// Um cuidador só acessa dados da(s) família(s) de que participa. No MVP
// atual, um caregiver pertence a exatamente uma família (phone_number é
// único globalmente — ver a migração desta fase), então esta checagem é
// hoje uma comparação simples; ela existe como função nomeada porque o
// dia que um cuidador puder participar de mais de uma família (fora do
// escopo desta fase, ver seção 19 do pedido), só esta função precisa
// mudar — nenhum chamador.
export async function canAccessFamily(caregiverId: string, familyId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("caregivers")
    .select("id")
    .eq("id", caregiverId)
    .eq("family_id", familyId)
    .maybeSingle();
  return data !== null;
}

// Um cuidador só acessa uma criança à qual foi explicitamente vinculado
// (caregiver_child, criada nesta fase). Hoje todo cuidador de uma
// família é vinculado a toda criança da mesma família automaticamente
// (ver addChildToFamily/acceptFamilyInvitation) — restringir o acesso a
// um subconjunto de crianças por cuidador é a extensão natural desta
// mesma tabela, sem mudar esta função nem seus chamadores.
export async function canAccessChild(caregiverId: string, childId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("caregiver_child")
    .select("caregiver_id")
    .eq("caregiver_id", caregiverId)
    .eq("child_id", childId)
    .maybeSingle();
  return data !== null;
}

// Ações que afetam a família inteira (editar nome da família, gerenciar
// cuidadores/convites) — reservadas ao owner. Um único owner por família
// é garantido no banco (índice único parcial, ver a migração desta
// fase), não só aqui.
export async function canManageFamily(caregiverId: string, familyId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("caregivers")
    .select("access_role")
    .eq("id", caregiverId)
    .eq("family_id", familyId)
    .maybeSingle();
  return data?.access_role === "owner";
}

// Mesma regra de canManageFamily hoje (só o owner convida) — nomeada à
// parte porque "quem pode convidar" e "quem pode renomear a família"
// já são, conceitualmente, decisões independentes mesmo coincidindo
// agora (ex.: um futuro role "admin" poderia convidar sem poder excluir
// a família).
export async function canInviteCaregiver(caregiverId: string, familyId: string): Promise<boolean> {
  return canManageFamily(caregiverId, familyId);
}

// Editar os dados de uma criança (nome, data de nascimento, interesses)
// hoje segue a mesma regra de "tem acesso à criança" — qualquer cuidador
// vinculado pode editar, não só o owner (mesmo comportamento que já
// existia antes desta fase, quando bastava pertencer à família). Nomeada
// à parte de canAccessChild pelo mesmo motivo de canInviteCaregiver:
// "ver" e "editar" já são perguntas conceitualmente diferentes, mesmo
// com a mesma resposta hoje — um futuro acesso "somente leitura" (seção
// 19 do pedido) muda só esta função.
export async function canEditChild(caregiverId: string, childId: string): Promise<boolean> {
  return canAccessChild(caregiverId, childId);
}
