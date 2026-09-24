# Arquitetura alvo — núcleo de conversa compartilhado

> Escrito na Fase 2 (produtização do `/test`), 2026-09-25, com a seção
> "ChildContext" adicionada na Fase 3 (memória da criança), 2026-09-25.
> Complementa `docs/CURRENT_STATE.md` (diagnóstico do estado anterior a
> essas fases).

## O núcleo permanece único

```
UI (ConversationChat)
  ↓
server action (por canal: sendTestMessage, sendQuintalMessage, futuro sendWhatsAppMessage)
  ↓
conversation core (recordConversationTurn, em src/lib/conversation.ts)
  ↓
getChildContext(childId)  — src/lib/childContext.ts
  ↓
suggestEventFromMessage + suggestReply (IA) + search_knowledge_chunks (RAG)
  ↓
messages / events (Postgres)
  ↓
resposta
```

`recordConversationTurn` (em `src/lib/conversation.ts`) continua sendo o
único lugar que sabe como gravar uma mensagem, buscar contexto e chamar a
IA — e é chamado por três canais hoje:

| Canal | Rota | Server action | Como resolve o `caregiverId` |
|---|---|---|---|
| Ferramenta interna (operador testando manualmente) | `/ops/playground` | `sendPlaygroundMessage(input)` | da sessão de operador (Supabase Auth) |
| Ferramenta interna (QA/link enviado pelo operador) | `/test/[caregiverId]` | `sendTestMessage(caregiverId, input)` | **da URL**, sem sessão |
| Produto real | `/quintal` | `sendQuintalMessage(input)` | **da sessão** (`caregiver_sessions`), nunca do cliente |

Um quarto canal (WhatsApp) é o próximo candidato natural — quando existir,
será uma nova server action fina chamando o mesmo `recordConversationTurn`,
sem duplicar lógica de IA/knowledge/persistência. Essa foi a razão de
extrair a UI de chat (antes duplicada em `TestChat.tsx`) para
`src/components/conversation/ConversationChat.tsx`: hoje ela serve dois
canais (test e quintal — o playground tem sua própria UI, mais parecida com
uma ferramenta de debug); o padrão (action fina → núcleo único) é o que
deve se repetir para o próximo canal.

## Modelo de acesso: por que `caregiver_sessions` e não algo maior

O `/test/[caregiverId]` original confiava inteiramente no UUID da URL:
quem tivesse o link (ou adivinhasse/vazasse o id) conseguia mandar
mensagens como aquele cuidador, ver os nomes das crianças da família (a
lista é enviada ao navegador ao carregar a página) e alimentar o contexto
de IA daquela família — sem sessão, sem verificação nenhuma além de "esse
`caregiver_id` existe".

Para o produto real (`/quintal`), isso não é aceitável: precisa ser
impossível trocar de família só editando a URL ou um cookie legível por
JavaScript.

**Decisão tomada nesta fase**: uma sessão mínima, própria, sem sistema de
login completo:

- Token opaco (`randomUUID()`, nunca o `caregiverId` em si) guardado numa
  tabela nova, `caregiver_sessions` (`token` PK, `caregiver_id`,
  `created_at`), sem nenhuma RLS policy — só o `service_role` a lê/escreve.
- Cookie **httpOnly** (`quintal_session`), `secure` em produção,
  `sameSite=lax`, 180 dias. Diferente do cookie antigo do `/test`
  (`quintal_caregiver_id`, legível por `document.cookie`, só uma
  conveniência de "lembrar o último link" — continua existindo, mas só
  para o `/test`).
- `/quintal` e a action `sendQuintalMessage` **nunca leem `caregiverId` do
  cliente**. O servidor resolve a identidade lendo o cookie e validando
  contra `caregiver_sessions`. Um cookie forjado ou um token que não existe
  na tabela simplesmente não resolve ninguém — testado manualmente (ver
  `docs/PRODUCT_ROADMAP.md`, seção "Como testar").

Isso resolve o pedido específico ("não implemente apenas esconder o ID"):
mesmo que alguém adivinhe/copie um `caregiverId` de outra família, não há
como fabricar um token de sessão válido para ele sem acesso ao banco.

### O que essa solução **não** é

Não é um sistema de autenticação completo — não há login, senha, e-mail ou
verificação de OTP. Isso foi deliberado (pedido explícito de não construir
"sistema complexo de autenticação" nesta fase). Consequências assumidas:

- **Não há como entrar de um segundo aparelho.** Se a família trocar de
  celular, limpar cookies, ou usar outro navegador, não existe hoje um
  jeito de "logar de novo" — precisaria refazer `/comecar`, criando uma
  família nova e duplicada. Um retorno real (ex.: "entrar com seu WhatsApp"
  + código de verificação) é a decisão definitiva ainda não tomada.
- **Sem expiração/revogação.** O token vive 180 dias e não há endpoint de
  "sair" nem rotação. Aceitável para uma sessão de conveniência de baixo
  risco (não é dado de pagamento nem PII sensível além do que a família já
  digitou), mas não é o padrão que se quer para produção madura.
- **`/test/[caregiverId]` continua com o modelo antigo, intencionalmente.**
  É uma ferramenta interna cujo link só o operador compartilha
  deliberadamente (via `/ops/families/[id]`) — não é a superfície que
  famílias reais devem usar continuamente. Não foi alterado porque alterá-lo
  quebraria seu propósito (link direto, sem fricção, para QA/demonstração)
  e não foi pedido.

**Decisão definitiva a tomar no futuro** (documentando para não perder o
fio): autenticação real de família, provavelmente ancorada no número de
WhatsApp verificado (o mesmo número que qualquer integração futura de
WhatsApp real precisaria confirmar de qualquer forma) — nesse momento,
`caregiver_sessions` pode virar a tabela de sessão desse sistema maior, ou
ser substituída por ele.

## Componentes novos da Fase 2

| Arquivo | Papel |
|---|---|
| `src/lib/familySession.ts` | cria/lê a sessão mínima acima |
| `src/components/conversation/ConversationChat.tsx` | UI de chat compartilhada por `/test` e `/quintal` (extraída de `TestChat.tsx`, que foi removido) |
| `src/components/conversation/ChildHeader.tsx` | cabeçalho "Quintal de {criança}" — puramente apresentacional, todo dado é real |
| `src/app/quintal/page.tsx` + `actions.ts` | a experiência de produto |
| `supabase/migrations/20260925120000_create_caregiver_sessions.sql` | a tabela de sessão |

### Bug encontrado e corrigido durante a extração

O `TestChat.tsx` original só mostrava o seletor de criança quando havia
mais de uma (`childrenList.length > 1`); com exatamente uma criança — o
caso mais comum — o `childId` nunca era definido, e a conversa rodava
**sem nenhum contexto da criança** (sem idade, sem eventos recentes, sem
registro automático de evento). Corrigido no `ConversationChat`
compartilhado: com exatamente uma criança, ela é selecionada
automaticamente. Isso também corrige silenciosamente conversas antigas do
`/test` que pareciam funcionar mas nunca usavam o contexto da criança.

## ChildContext (Fase 3) — a camada de memória da criança

### O que é

`getChildContext(supabase, childId)`, em `src/lib/childContext.ts`, é a
**única porta** pela qual `suggestEventFromMessage` e `suggestReply`
enxergam dados de uma criança. Antes desta fase, `conversation.ts` e as
duas actions da triagem (`suggestEvent`, `suggestReplyDraft`) tinham cada
uma sua própria query ad hoc para "buscar eventos recentes + calcular
idade" — três cópias quase idênticas da mesma lógica. Agora as três
chamam `getChildContext`.

É deliberadamente determinístico: sem embeddings, sem vector database,
sem ranking — só "os últimos N registros, filtrados por tipo, na tabela
`events` que já existe". Nenhuma tabela nova foi criada para isso; a
única mudança de schema desta fase (nenhuma, na verdade — `events` já
tinha tudo que era preciso) é zero.

### O que entra

```ts
ChildContext {
  child: { id, name, birthDate, sex, notes }   // colunas reais de `children`, nunca inventadas
  age: { label, months }                        // calculado de birthDate (ageLabel/ageInMonths)
  recentEvents: Event[]         // type in (sleep, routine, free_play, development) — "o dia a dia"
  recentObservations: Event[]   // type = observation — "coisas que continuam relevantes"
  recentDecisions: Event[]      // type = decision — "o que a família decidiu"
}
```

Cada `Event` é `{ type, notes, occurredAt }` — direto da tabela `events`,
sem transformação além de tipagem.

### O que NÃO entra (e por quê)

- **Mensagens (`messages`)**: propositalmente fora do `ChildContext`.
  `messages` não tem coluna `child_id` — só `family_id`/`caregiver_id` —
  então "o que foi conversado recentemente" é, na estrutura atual do
  banco, um conceito de **família**, não de **criança**. Numa família com
  duas crianças, o histórico de mensagens pode mencionar as duas.
  Misturar isso dentro de `ChildContext` teria criado uma falsa sensação
  de isolamento por criança que o schema não sustenta. Por isso
  `recordConversationTurn` busca `recentMessages` **separadamente**,
  direto de `messages`, e passa para `suggestReply` como um parâmetro à
  parte — não como parte do `ChildContext`. Ver "Distinção conceitual"
  abaixo.
- **`events.payload` (jsonb)**: nunca foi populado por nenhum código do
  projeto (sempre `{}`); `getChildContext` nem o seleciona.
- **Dados de outras crianças da mesma família**: nunca — toda query em
  `getChildContext` filtra por `child_id = :childId`, sem exceção.
- **Nada inferido ou fabricado**: se a criança não tem `birth_date`,
  `age.label`/`age.months` vêm `null` — o prompt final (via
  `formatChildContextForPrompt`) simplesmente omite a idade, nunca chuta
  um valor.

### Distinção conceitual (histórico vs. memória vs. evento vs. decisão)

| Conceito | O que é | Onde vive |
|---|---|---|
| **Histórico** | O que foi conversado recentemente (mensagens) | `messages`, escopo família, fora do `ChildContext` |
| **Memória** (nesta fase) | Dados permanentes/duráveis da criança + observações e decisões recentes | `children` + `events` (types `observation`/`decision`), dentro do `ChildContext` |
| **Evento** | Algo que aconteceu (sono, rotina, brincar livre, desenvolvimento) | `events` (demais types), dentro do `ChildContext` como `recentEvents` |
| **Decisão** | Algo que o cuidador decidiu e que continua valendo | `events` (type `decision`), `recentDecisions` |

Não existe ainda uma tabela ou conceito de "memória" além disso — a
"memória" desta fase é só uma forma diferente de olhar para `events` que
já existia. Uma camada de memória mais sofisticada (fatos permanentes
explícitos, resumos gerados, memória que expira) fica para depois, com
evidência de que os limites determinísticos abaixo não bastam.

### Limites (documentados, hardcoded em `childContext.ts`)

| Limite | Valor | Razão |
|---|---|---|
| `RECENT_EVENTS_LIMIT` | 10 | mesma janela que o resto do produto já usava antes desta fase |
| `RECENT_OBSERVATIONS_LIMIT` | 5 | observações são mais esparsas e mais duráveis; 5 já cobre bastante tempo real |
| `RECENT_DECISIONS_LIMIT` | 5 | decisões são raras por natureza; 5 é uma folga generosa, não um teto apertado |
| `RECENT_MESSAGES_LIMIT` | 8 | em `conversation.ts` (não em `childContext.ts` — é família, não criança); é a mesma janela da Fase 1 |

Nenhum desses limites é configurável por env var ou banco nesta fase —
são constantes de código, de propósito, para manter o comportamento
100% previsível e fácil de auditar lendo o próprio arquivo.

### suggestReply/suggestEvent não conhecem tabelas

Antes: `suggestReply` recebia `childName`, `childAge`, `childAgeMonths`,
`recentEvents` como 4 parâmetros soltos, e montava sozinho o texto do
"Histórico recente" concatenando eventos manualmente.

Agora: `suggestReply({ messageBody, childContext, recentMessages })` — um
único objeto estruturado. Quem sabe transformar isso em texto para o
prompt é `formatChildContextForPrompt` (em `childContext.ts`), não
`suggestReply`. Isso significa que se amanhã `ChildContext` ganhar um
campo novo, só `childContext.ts` precisa saber formatá-lo — `suggestReply`
continua igual.

### Como isso vai crescer no futuro

- **Mensagens por criança de verdade**: adicionar `child_id` a `messages`
  (ou uma tabela de junção, se uma mensagem puder ser sobre mais de uma
  criança) removeria a limitação atual de "histórico é por família, não
  por criança" — hoje documentada, não escondida.
- **Fatos permanentes explícitos**: uma tabela pequena tipo
  `child_facts` (algo como "não pode comer X", "usa chupeta", "está em
  adaptação escolar") seria o próximo passo natural de "memória", ainda
  sem precisar de embeddings — continua determinístico, só mais uma
  tabela pequena e um novo campo em `ChildContext`.
- **Resumos**: se o volume de eventos crescer muito, uma camada de
  resumo periódico (gerado por IA, revisado por humano, salvo como um
  tipo de evento ou campo próprio) é o caminho antes de qualquer
  embedding/vector search — que continua fora de cogitação até haver
  evidência real de que busca determinística não basta.

### Testes realizados

Sem framework de testes automatizados no repositório (ver
`docs/CURRENT_STATE.md`, débito técnico). Verificado manualmente contra o
schema real do Supabase (`izattwaiqjzhydzhxlns`), numa transação inserida
e revertida (`begin` ... `rollback`, nenhum dado de teste ficou no banco):

- **Caso A (criança sem eventos)**: as três queries retornam vazio; sem
  erro, sem `null` inesperado.
- **Caso B (criança com eventos recentes de todos os tipos)**: 5 eventos
  inseridos (2 sleep, 1 routine, 1 observation, 1 decision) — resultado
  saiu exatamente `recentEvents` com 3, `recentObservations` com 1,
  `recentDecisions` com 1. Nenhum evento apareceu em dois grupos.
- **Caso C (muitos eventos antigos)**: 15 eventos de sono inseridos ao
  longo de 15 dias; `recentEvents` retornou exatamente 10, sempre os mais
  recentes (do dia -1 ao dia -10), confirmando que o `limit` corta pelos
  mais novos, não por ordem de inserção.
- **Caso D (duas crianças na mesma família)**: os eventos da criança B
  (Bruno) nunca apareceram nos buckets da criança A (Ana) e vice-versa —
  isolamento garantido pelo filtro `child_id`, testado com as duas
  crianças na mesma `family_id`.

Consulta é fora do escopo desta fase; a chamada real de ponta a ponta ao
Groq com o novo contexto formatado não foi possível de reproduzir neste
ambiente (rede bloqueada para `api.groq.com` no sandbox de
desenvolvimento) — a montagem do prompt foi revisada por leitura de
código, seguindo o mesmo padrão já usado (e já testado em produção) antes
desta fase.
