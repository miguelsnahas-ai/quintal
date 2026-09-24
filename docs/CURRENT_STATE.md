# Estado atual do Quintal — diagnóstico técnico

> Gerado em 2026-09-24 por análise direta do código, migrações e schema live
> (projeto Supabase `izattwaiqjzhydzhxlns`). Documento de leitura — nenhum
> código foi alterado para produzi-lo.

## Sumário executivo

O Quintal hoje é, na prática, **uma ferramenta operacional interna** (o
"cockpit" que Sprints 0–6 construíram) com **dois experimentos de
autoatendimento anexados a ela** (`/comecar` + `/test/[caregiverId]`) que
provam o conceito de "IA responde sozinha" mas **nunca tocam o WhatsApp
real**. O único caminho que efetivamente manda uma mensagem pelo WhatsApp é
a Inbox de triagem, e ele exige um operador humano em toda mensagem. Não
existe, hoje, nenhum caminho em que um usuário final converse pelo WhatsApp
de verdade e receba uma resposta gerada pela IA sem um humano no meio.

A "memória estruturada" (tabela `events`) também é 100% manual — a IA
sugere uma classificação, mas nenhum fluxo (webhook, playground, `/test`)
grava um evento sozinho; sempre precisa de um clique humano em "Registrar".

---

## 1. Arquitetura atual

- **Next.js 16.3.5** (App Router, Turbopack), **React 19.2.8**, TypeScript,
  Tailwind v4. Deploy em Vercel.
- **Auth/gate**: não existe mais `middleware.ts` — a versão instalada do
  Next.js renomeou o mecanismo para **Proxy** (`src/proxy.ts`, matcher
  `/((?!_next/static|_next/image|favicon.ico).*)`), que chama
  `updateSession()` (`src/lib/supabase/proxy.ts`). Essa função só faz duas
  coisas: redireciona `/ops/*` sem sessão para `/login`, e redireciona
  `/login` com sessão para `/ops`. `/comecar` e `/test/*` **não são
  cobertos por nenhum gate** — são públicos por padrão.
- **Banco**: Supabase Postgres, projeto `izattwaiqjzhydzhxlns`. Um único
  schema `public`. RLS habilitado em toda tabela; a policy padrão em quase
  todas é `for all to authenticated using (true) with check (true)` — ou
  seja, **qualquer conta operadora enxerga e edita todos os dados de todas
  as famílias**, sem isolamento por operador. Não existe tabela de
  "operadores" — qualquer linha em `auth.users` é, por definição, um
  operador.
- **IA**: Groq (`https://api.groq.com/openai/v1`, SDK oficial da OpenAI
  reaproveitado por compatibilidade), modelo `openai/gpt-oss-120b`. Duas
  funções: `suggestEventFromMessage` (classificação) e `suggestReply`
  (rascunho de resposta). Nenhuma outra chamada de IA existe no projeto
  (não há embeddings, não há streaming, não há tool calling).
- **WhatsApp**: Meta Graph API `v21.0`. Webhook recebe (`POST
  /api/whatsapp/webhook`, verificado por HMAC SHA-256); envio é uma função
  isolada (`sendWhatsAppTextMessage`) chamada **apenas** por uma única
  Server Action (`sendReply`, na triagem).
- **Landing page**: **não vive neste repositório**. É outro projeto Vercel
  que grava direto na tabela `waitlist_leads` deste mesmo Supabase (via
  `anon`, presumivelmente — não há policy de insert para `anon` em nenhuma
  migração deste repo, então essa policy foi criada fora daqui). `/ops`
  só lê essa tabela.
- Duas classes de cliente Supabase:
  - `createClient()` (browser/server, chave publicável + sessão via
    cookies) — usado em toda página/ação autenticada.
  - `createServiceClient()` (`service_role`, ignora RLS) — usado só em
    contexto sem sessão: webhook do WhatsApp, `/test/[caregiverId]`,
    `/comecar`, e leitura de `ai_settings`/`knowledge_chunks` (dados
    globais, não por família).

## 2. Rotas

| Rota | Auth | Descrição |
|---|---|---|
| `/` | pública | redirect puro para `/ops` |
| `/login` | pública | e-mail+senha (Supabase Auth) |
| `/ops` | operador | home, conta famílias |
| `/ops/families`, `/ops/families/[id]` | operador | CRUD família/cuidador/criança; mostra link `/test/[id]` e "Monitorar" por cuidador |
| `/ops/children/[id]` | operador | histórico de eventos da criança + registro manual |
| `/ops/inbox`, `/ops/inbox/[messageId]` | operador | lista/triagem de mensagens inbound (reais e simuladas) |
| `/ops/simulator` | operador | cria **uma** mensagem inbound falsa e manda para a triagem |
| `/ops/playground` | operador | chat autopilot (IA responde e salva sozinha) sobre uma família já existente |
| `/ops/playground/monitor/[caregiverId]` | operador | acompanha ao vivo (polling 4s) qualquer conversa por `caregiverId` + edita `ai_settings` (instruções globais) |
| `/ops/waitlist`, `/ops/waitlist/[id]` | operador | leitura da lista de interesse da landing page |
| `/comecar` | **pública** | autoatendimento: pai cria família+cuidador e cai direto no chat |
| `/test/[caregiverId]` | **pública** | chat autopilot para um cuidador específico (link individual ou vindo de `/comecar`) |
| `/api/whatsapp/webhook` | pública (verificada por assinatura/token) | `GET` = handshake Meta; `POST` = recebe mensagens inbound |

## 3. Tabelas (schema live)

| Tabela | Migração | RLS (authenticated) | Observação |
|---|---|---|---|
| `families` | `20260918001927` | all | — |
| `caregivers` | `20260918001927` | all | `phone_number` **unique** globalmente |
| `children` | `20260918001927` | all | — |
| `messages` | `20260918003756` + `..005804` + `..010627` | all | inbound/outbound, `wa_message_id` unique, `in_reply_to_message_id`, `helpful`/`feedback_notes`/`feedback_recorded_at` |
| `events` | `20260918004454` | all | `type` fixo (6 valores via CHECK), `payload jsonb` nunca usado (sempre `{}`) |
| `waitlist_leads` | **sem arquivo local** (aplicada como `20260922174313_align_waitlist_leads_with_landing_page_schema`, não salva no repo) | select only | schema real ≠ o que os dois primeiros commits desta sessão assumiram (ver §9) |
| `ai_settings` | `20260922165612` | all | linha única fixa (`id` hardcoded), `custom_instructions text` |
| `knowledge_chunks` | `20260924185301` | **select only** | 531 linhas, sem policy de escrita para `authenticated` (só `service_role`/migração escreve) |

Funções SQL (não-tabela) relevantes: `knowledge_chunks_tsvector(...)`
(coluna gerada) e `search_knowledge_chunks(...)` (RPC de busca), ambas em
`20260924193755_add_search_knowledge_chunks_function.sql`.

## 4. Serviços / bibliotecas (`src/lib`)

| Arquivo | Papel |
|---|---|
| `supabase/client.ts`, `server.ts`, `proxy.ts`, `service.ts` | os 3 clientes + o gate de auth |
| `groq/client.ts` | factory do client OpenAI apontado pra Groq |
| `groq/suggestEvent.ts` | classifica mensagem em 1 dos 6 tipos + reescreve `notes` |
| `groq/suggestReply.ts` | gera o rascunho de resposta; é o único lugar que lê `ai_settings` **e** `knowledge_chunks` |
| `ai-settings.ts` | get/set do texto global de instruções extras |
| `knowledge.ts` | wrapper fino sobre a RPC `search_knowledge_chunks` |
| `conversation.ts` | `recordConversationTurn()` — motor único do Playground e do `/test` (grava inbound, chama as duas funções de IA em paralelo, grava outbound, marca `handled_at`) |
| `whatsapp/send.ts` | única função que fala com a Graph API de verdade |
| `whatsapp/verify.ts` | valida assinatura HMAC do webhook |
| `whatsapp/schema.ts` | parse solto (`.loose()`) do payload do webhook |
| `validation/families.ts`, `validation/events.ts` | schemas Zod usados pelos forms de `/ops` |
| `format.ts` | `ageLabel`/`ageInMonths`, formatação de data |
| `phone.ts` | normaliza telefone BR digitado em `/comecar` pro formato E.164 |
| `testAccess.ts` | nome da cookie "lembrar este aparelho" do `/test` |

## 5. Fluxos mapeados

### 5.1 Fluxo atual de uma mensagem

Existem **dois motores completamente separados** para "mensagem chega → IA
responde", que nunca se cruzam:

**A) Caminho real do WhatsApp (com humano):**
`POST /api/whatsapp/webhook` → valida assinatura → dá upsert em `messages`
(por `wa_message_id`, ignora duplicata) → tenta casar `from` com um
`caregivers.phone_number` → **fim**. O webhook **não gera resposta, não
chama IA, não envia nada de volta**. A mensagem só ganha vida quando um
operador abre `/ops/inbox`, clica em "Triar", opcionalmente pede sugestão
de IA (`suggestEvent`/`suggestReplyDraft` — cada uma é um clique
separado, cada resultado cai em query params da própria página, nada é
salvo até o operador confirmar) e manualmente clica "Enviar pelo
WhatsApp" (`sendReply` → `sendWhatsAppTextMessage` → grava o outbound em
`messages`).

**B) Caminho autopilot (Playground / `/test`, sem humano):**
`recordConversationTurn()` (`src/lib/conversation.ts`) — grava o inbound
(`wa_message_id: sim-<uuid>`, `raw_payload.simulated=true`), chama
`suggestEventFromMessage` e `suggestReply` **em paralelo**, grava o
outbound automaticamente, marca `handled_at` na hora. Não existe revisão
humana neste caminho — nem em `/ops/playground` (uso interno do operador)
nem em `/test/[caregiverId]` (usuário externo de verdade). A única
diferença entre os dois é o `raw_payload.source` (`"playground"` vs.
`"test-link"`) e qual client Supabase é usado (sessão vs. `service_role`).

O **Simulador** (`/ops/simulator`) é um terceiro mecanismo, menor: cria
**uma única** mensagem inbound falsa e joga o operador na triagem normal
(caminho A) — ele testa a triagem manual, não o autopilot.

### 5.2 Fluxo de criação de família

Dois caminhos, ambos terminam nas mesmas 3 tabelas (`families`,
`caregivers`, opcionalmente `children`):
- **Operador**: `/ops/families` → `createFamily` (só nome+notas) → depois,
  na página da família, `addCaregiver`/`addChild` em forms separados.
- **Autoatendimento**: `/comecar` → `startFamily` (Server Action, sem
  auth, `service_role`) cria `families` (nome auto-gerado `"Família de
  {nome}"`, `notes: "Cadastro via link público (/comecar)"`) +
  `caregivers` (telefone normalizado por `normalizeBrazilianPhone`) +,
  se preenchido, `children` — tudo em sequência, sem transação (uma
  falha no meio deixa registros órfãos).

### 5.3 Fluxo de criação de criança

- Operador: `/ops/families/[id]` (`addChild`) ou implicitamente dentro de
  `/comecar` (um único filho opcional, sem opção de adicionar mais de um).
- **Não existe** fluxo de usuário final para adicionar uma segunda
  criança depois do cadastro inicial — `/comecar` só roda uma vez por
  cookie/família.

### 5.4 Como a memória é armazenada

- **Mensagens** (`messages`): log bruto de tudo, real ou simulado. É
  auditoria/histórico, não é "memória" no sentido de contexto para a IA —
  o histórico de mensagens **nunca é reenviado para a IA** (ver 5.5).
- **Eventos** (`events`): a única coisa que se parece com "memória
  estruturada da criança" de fato. **100% manual em todos os canais** —
  nenhum código insere em `events` automaticamente; mesmo quando a IA
  classifica uma mensagem (`suggestEventFromMessage`), o resultado só vira
  linha na tabela se um humano clicar "Registrar e marcar como tratada"
  na triagem, ou preencher o form em `/ops/children/[id]`. O Playground e
  o `/test` chamam essa mesma função de classificação só para mostrar um
  badge (`eventTypeLabel`) na tela — **o resultado é descartado, nunca
  persistido**.
- **Preferências globais** (`ai_settings`): uma linha única, editável só
  no Monitor, aplicada a **todas** as conversas do sistema — não há
  personalização por família.

### 5.5 Como a IA recebe contexto

`suggestEventFromMessage(messageBody, childName, childAge)` e
`suggestReply(messageBody, childName, childAge, childAgeMonths,
recentEvents[], + ai_settings + top-6 knowledge_chunks)` — **stateless por
chamada**. Cada chamada só enxerga:
1. o texto da mensagem atual (uma string, não um histórico);
2. nome/idade da criança selecionada;
3. até 10 `events` já registrados daquela criança (não mensagens — eventos
   manuais);
4. o texto global de `ai_settings`;
5. (só em `suggestReply`) até 6 trechos da base de conhecimento.

**Não existe memória de curto prazo da própria conversa.** Mesmo no
Playground/`/test`, onde a tela mostra um histórico de chat completo, só a
**última mensagem do usuário** é enviada para a IA — o resto do histórico
visual é só client-side, nunca chega ao prompt. Se um pai disser "ele fez
de novo", a IA não tem como saber a que "de novo" se refere, a menos que
por acaso já exista um `event` registrado sobre isso.

### 5.6 Como a knowledge base é consultada

Só `suggestReply` consulta (não `suggestEvent`). Chama a RPC
`search_knowledge_chunks(message, age_months, result_limit=6)`, que:
busca lexemas da mensagem (stemming português), pondera por IDF (raridade
do termo no corpus), soma bônus se o lexema bate no `title` (×3) ou no
`category` (×6), e trata idade como bônus de ranking — não como filtro
duro (uma criança de 8 meses ainda vê o conteúdo de "mel", cujo
`age_min_months=12`, porque isso é exatamente o alerta relevante). Não é
busca semântica (sem embeddings) — é keyword+IDF, com qualidade variável
para frases muito coloquiais (documentado no commit
`23671a4`/relatado ao usuário na sessão anterior).

### 5.7 Como o operador revisa mensagens

Só existe revisão humana no **caminho A** (WhatsApp real +
Simulador): Inbox lista inbounds → vincular à família se preciso → IA
sugere (opcional, sob clique) → operador edita o texto no textarea antes
de confirmar → só então grava. Há também um mini-loop de feedback: a
página de triagem mostra a última resposta outbound ainda sem
`feedback_recorded_at` daquela família e deixa o operador marcar
"ajudou"/"não ajudou" + nota — **preenchido pelo operador em nome da
família**, não pela própria família (nem `/test` tem botão de feedback).

### 5.8 Como uma resposta chega ao WhatsApp

Um único caminho no sistema inteiro: `sendReply` (Server Action em
`/ops/inbox/[messageId]/actions.ts`) → `sendWhatsAppTextMessage` → Graph
API `POST /{phoneNumberId}/messages`. Exige `WHATSAPP_PHONE_NUMBER_ID` e
`WHATSAPP_ACCESS_TOKEN` configurados — se ausentes, lança erro tratado
(mensagem amigável, não quebra a página). Nenhum outro fluxo (Playground,
`/test`, Monitor, webhook) chama essa função.

### 5.9 O que já funciona para um usuário final hoje

- **Pelo WhatsApp real**: nada sozinho. Uma pessoa pode mandar mensagem e
  ela é recebida e guardada, mas só recebe resposta se um operador entrar
  na Inbox e mandar manualmente.
- **Pela web** (`/comecar` → `/test/[caregiverId]`): sim, ponta a ponta e
  sem operador — cadastro próprio, conversa com resposta gerada por IA
  na hora, contexto de idade e base de conhecimento aplicados,
  "lembrar este aparelho" via cookie. É a única experiência realmente
  automática que existe hoje — mas roda inteiramente fora do WhatsApp.

### 5.10 O que ainda é exclusivamente operacional

- Toda conversa real de WhatsApp (recepção → resposta) depende de um
  humano.
- Toda escrita em `events` (memória estruturada), em qualquer canal.
- Vincular mensagem sem cuidador identificado a uma família.
- Registrar feedback ("ajudou?") de uma resposta.
- Editar `ai_settings` (prompt global) e acompanhar conversas ao vivo
  (Monitor).
- Todo CRUD de família/cuidador/criança depois do cadastro inicial via
  `/comecar` (não há autoatendimento de edição).
- Atualizar a base de conhecimento (`scripts/knowledge-base/
  sync_knowledge_base.py`, rodado manualmente por um operador/Claude).

## 6. Dependências

**Runtime**: `next@16.3.5`, `react@19.2.8`, `@supabase/ssr`,
`@supabase/supabase-js@2.116.0`, `openai@7.18.0` (usado contra a Groq, não
a OpenAI), `zod@4.6.5`, `lucide-react`.

**Serviços externos**: Supabase (DB+Auth), Groq (LLM), Meta Graph API
(WhatsApp Cloud API v21.0), Vercel (deploy). Variáveis de ambiente usadas:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `WHATSAPP_PHONE_NUMBER_ID`,
`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`,
`WHATSAPP_GRAPH_API_VERSION` (opcional).

## 7. Gaps (faltando para virar produto)

1. **Nenhum autopilot no WhatsApp real** — o motor que já existe
   (`recordConversationTurn`) nunca foi ligado ao webhook; hoje ele só
   roda em `/ops/playground` e `/test`.
2. **Sem memória conversacional de curto prazo** — cada resposta da IA só
   vê a última mensagem + eventos manuais. Qualquer produto real de chat
   vai precisar de algo entre "nada" e "reenviar o histórico inteiro".
3. **Extração de evento nunca é automática** — mesmo a IA acertando a
   classificação, sempre depende de clique humano. Isso trava qualquer
   tentativa de "linha do tempo automática" da criança.
4. **Sem feedback do usuário final** — só o operador registra "ajudou?"
   em nome da família; `/test` não tem nenhum mecanismo de avaliação.
5. **Sem isolamento de dados entre operadores** — qualquer conta
   autenticada vê/edita todas as famílias.
6. **Sem edição self-service** — família cadastrada via `/comecar` não
   tem como corrigir nome/telefone/filho depois, exceto pedindo a um
   operador.
7. **RAG por keyword, não semântico** — funciona bem quando a pergunta usa
   o termo exato do chunk (ex. "mel"), mas é ruidoso em frases coloquiais
   sem esses termos (ex. "acorda de madrugada" sem dizer "sono").

## 8. Technical debt

1. **Migração órfã**: `20260922174313_align_waitlist_leads_with_landing_page_schema`
   existe no histórico do Supabase mas **não tem arquivo correspondente no
   repo** — quebra a convenção "toda migração é código versionado" que o
   resto do projeto segue. O conteúdo original não é recuperável (Supabase
   só guarda `version`+`name` no `schema_migrations`, não o SQL). O schema
   resultante está corretamente refletido em `types.ts` hoje, mas a
   proveniência não está.
2. **Policy de `insert` de `waitlist_leads` para `anon`** existe no banco
   (a landing page grava sem login) mas não tem migração local nenhuma —
   foi criada fora deste repositório.
3. **`events.payload jsonb`** existe desde a Sprint 3 e nunca foi usado
   (sempre `'{}'`) — campo morto até hoje.
4. **Falta de transação** em `/comecar`'s `startFamily`: cria
   `families`→`caregivers`→`children` em 3 chamadas separadas; uma falha
   no meio deixa uma família órfã sem cuidador.
5. **`raw_payload.source`** (`"playground"` vs. `"test-link"` vs. ausente
   para Simulador/webhook) é a única forma de distinguir de onde uma
   mensagem veio, e nenhuma tela da Inbox filtra ou exibe isso — um
   operador olhando a Inbox não sabe, sem abrir o JSON bruto, se está
   vendo uma conversa real de piloto ou um teste interno.
6. **Telefone**: `caregivers.phone_number` é `unique` globalmente sem
   normalização garantida na entrada de `/ops/families` (só `/comecar` e
   `/lib/phone.ts` normalizam) — dois cuidadores com o "mesmo" número
   digitado diferente (`+5511...` vs `(11)...`) colidem ou duplicam
   dependendo de por onde entraram.
7. **Sem testes automatizados** no repositório (nenhum arquivo `*.test.*`
   ou `*.spec.*` encontrado) — toda verificação até aqui foi manual
   (build, lint, queries diretas no Supabase).

## 9. Funcionalidades duplicadas ou experimentais

- **Três formas de simular uma conversa**, com semânticas diferentes e
  sobreposição parcial:
  - `Simulador` → 1 mensagem falsa → triagem manual (caminho A).
  - `Playground` → chat completo, autopilot, sobre família existente
    (caminho B, uso interno).
  - `/test/[caregiverId]` → mesmo motor do Playground (caminho B), mas
    público, para uso externo real.
  Não há nenhuma indicação na UI de que Playground e `/test` compartilham
  o mesmo motor (`conversation.ts`) nem por que o Simulador é o único dos
  três que passa pela triagem de verdade.
- **`suggestEvent` chamado sem persistir**: em Playground/`/test`, a
  classificação de evento é gerada só para exibição (badge), nunca
  gravada — visualmente parece "a IA já registrou o evento", mas não
  registrou.
- **Duas fontes de verdade de idade da criança**: `ageLabel` (string,
  "8 meses"/"2 anos", pro prompt/exibição) e `ageInMonths` (número, pro
  filtro do RAG) — coexistem e são chamadas em paralelo nos mesmos
  pontos (`conversation.ts`, `inbox/[messageId]/actions.ts`); não é bug,
  mas é uma dependência implícita fácil de esquecer de manter em sincronia
  se `format.ts` mudar.
- **`docs/design-system.md`** existe mas não há como confirmar, sem
  inspeção visual, se ainda reflete 100% os componentes atuais de
  `src/components/ui/*` — não foi comparado neste diagnóstico.

---

*Este documento reflete o estado do código e do schema em 2026-09-24.
Nenhum arquivo de código-fonte foi alterado para produzi-lo.*
