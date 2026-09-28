# Arquitetura alvo — núcleo de conversa compartilhado

> Escrito na Fase 2 (produtização do `/test`), 2026-09-25, com a seção
> "ChildContext" adicionada na Fase 3 (memória da criança) e "Activity"
> adicionada na Fase 4 (conteúdo como experiência), ambas em 2026-09-25.
> Complementa `docs/CURRENT_STATE.md` (diagnóstico do estado anterior a
> essas fases).

## O núcleo permanece único

```
UI (ConversationChat)
  ↓
server action (por canal: sendTestMessage, sendQuintalMessage [em /quintal/chat desde a Fase 7], futuro sendWhatsAppMessage)
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
| Produto real | `/quintal/chat` (desde a Fase 7 — `/quintal` é a Home/Dashboard) | `sendQuintalMessage(input)` | **da sessão** (`caregiver_sessions`), nunca do cliente |

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

Para o produto real (`/quintal/chat`), isso não é aceitável: precisa ser
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
- `/quintal/chat` e a action `sendQuintalMessage` **nunca leem `caregiverId` do
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
| `src/components/conversation/ConversationChat.tsx` | UI de chat compartilhada por `/test` e `/quintal/chat` (extraída de `TestChat.tsx`, que foi removido) |
| `src/components/conversation/ChildHeader.tsx` | cabeçalho "Quintal de {criança}" — puramente apresentacional, todo dado é real |
| `src/app/quintal/chat/page.tsx` + `actions.ts` | a experiência de produto: conversa (desde a Fase 7, `/quintal` em si é a Home/Dashboard — ver seção própria) |
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

## Activity (Fase 4) — conteúdo existente como experiência de produto

### Diagnóstico do conteúdo (antes de codificar)

`knowledge_chunks` já tinha tudo que essa fase precisava — nenhuma coluna
nova nela, nenhuma tabela de biblioteca reconstruída. O que existe:

- **531 linhas**, 10 categorias. Duas delas descrevem literalmente "coisas
  para fazer com a criança": `brincadeiras` (84 linhas, prefixo `BRI-`) e
  `materiais` (65 linhas, prefixo `MAT-`).
- Cada linha tem `id`, `category`, `title`, `age_min_months`,
  `age_max_months`, `tags` (colunas estruturadas) e `content` — um texto
  com uma linha `"Cabeçalho: Valor"` por coluna que a planilha de origem
  tinha para aquela aba (ver `scripts/knowledge-base/sync_knowledge_base.py`,
  `CONFIGS`). Os cabeçalhos **são diferentes por categoria**:
  - `brincadeiras`: `Nome, Tipo, Interesses, Como brincar, O que
    desenvolve, Materiais, Onde, Segurança (às vezes ausente), Tags`.
  - `materiais`: `Material, Categoria, Como conseguir / custo, Estilos de
    brincadeira, Ideias de atividades por idade, Áreas de desenvolvimento,
    Supervisão, Segurança, Tags`.
- `Faixa etária` já é um rótulo humano pronto (`"6m+"`, `"4m–3a"`) —
  reaproveitado tal qual, em vez de recalcular algo a partir de
  `age_min_months`/`age_max_months` que poderia divergir do que a
  planilha realmente escreveu.

Conclusão do diagnóstico: dava para fazer tudo sem tabela nova para o
conteúdo em si — só faltava (1) um jeito de ler esses campos de volta do
`content` de forma estruturada e (2) dois lugares onde um dado de produto
de verdade (não conteúdo de referência) precisava existir e não existia
em lugar nenhum: a referência de "esta mensagem recomendou esta
atividade" e o feedback da família sobre uma atividade.

### `src/lib/activity.ts` — a abstração de "Activity"

Sem tabela nova para o conteúdo. `getActivity(id)` busca a linha em
`knowledge_chunks`, recusa (retorna `null`) se a categoria não for
`brincadeiras`/`materiais`, e usa `parseContentFields` para reler as
linhas `"Cabeçalho: Valor"` de `content` de volta para um mapa —
exatamente os mesmos cabeçalhos que a planilha já usava, nenhum
inventado. `mapFieldsToActivity` é o único lugar que sabe que os
cabeçalhos diferem entre as duas categorias, e normaliza os dois formatos
para o mesmo formato de saída:

```ts
Activity {
  id, category, title
  ageDisplayLabel      // "Faixa etária" da planilha, verbatim
  ageMinMonths, ageMaxMonths, tags
  why                  // brincadeiras: Interesses · materiais: Estilos de brincadeira
  materials            // brincadeiras: Materiais · materiais: título + Como conseguir/custo
  howTo                // brincadeiras: Como brincar · materiais: Ideias de atividades por idade
  developmentAreas     // brincadeiras: O que desenvolve · materiais: Áreas de desenvolvimento
  safety               // Segurança (quando existir na linha)
  extra                // qualquer outro campo real (Tipo, Onde, Categoria, Supervisão) — nada é descartado
}
```

Verificado manualmente contra duas linhas reais (`BRI-003` "Cabana" e
`MAT-001` "Rolos de papel higiênico") traçando o parser à mão contra o
`content` de verdade — todos os campos bateram, nada ficou vazio que não
devesse, nada foi inventado.

### `/atividades/[id]` — a página

Pública (mesmo nível de `/comecar`/`/test` — conteúdo de referência, nada
pessoal), gerada a partir de `getActivity`. Renderiza só as seções que
`Activity` de fato preenche (uma linha de `brincadeiras` sem campo
"Segurança" simplesmente não mostra a seção — nunca um "não informado").
Estilo deliberadamente mais quente que o `Card`/`cardClassName` do `/ops`
(`rounded-sm`, `bg-primary`, borda fina, pensado pra lista densa de
operador): aqui, `rounded-lg`, fundo `bg-secondary` (o creme do próprio
design system, não branco puro), sem borda, mais espaço — ainda usando os
tokens existentes (`docs/design-system.md`), só com um tratamento
diferente para a experiência de família. Tem também um controle de
feedback ("essa atividade ajudou?") no fim da página.

### `ActivityCard` — o componente reutilizável

`src/components/conversation/ActivityCard.tsx` recebe só um
`ActivitySummary` (`id`, `category`, `title`, `ageDisplayLabel` — o
suficiente pra desenhar o card sem outra consulta ao banco) e linka para
`/atividades/[id]`. Não depende de nada do chat — é por isso que também
serve, sem alteração, numa futura home ou lista de recomendações, como
pedido.

### Como uma atividade chega da IA até a UI

```
suggestReply (Zod: {text, activityId})
  ↓ activityId (ou null)
conversation.ts → getActivity(activityId) → toActivitySummary
  ↓
messages.activity_id (persistido) + retorno de recordConversationTurn
  ↓
sendTestMessage / sendQuintalMessage (retornam {reply, activity})
  ↓
ConversationChat (estado local do turno) → <ActivityCard activity={...} />
```

Detalhes que valem registrar:

- **`suggestReply` deixou de devolver uma string solta.** Agora devolve
  `{ text, activityId }`, validado com Zod (`z.object({ text: z.string(),
  activityId: z.string().nullable() })`), no mesmo padrão de
  `response_format: json_object` + validação manual que `suggestEvent.ts`
  já usava — não um schema novo de confiança duvidosa.
- **A IA só pode citar um `activityId` que ela mesma recebeu como
  candidato no prompt** (os resultados de `search_knowledge_chunks` que
  são `brincadeiras`/`materiais`, listados explicitamente por id+título
  num bloco à parte do restante da base de conhecimento). Se ela citar
  qualquer outro valor, `suggestReply` descarta e devolve `null` — a
  resposta em texto continua valendo, só sem o card. Isso evita um card
  quebrado por alucinação, mas não impede a IA de mencionar uma atividade
  pelo nome sem ID válido (nesse caso o texto cita, mas não há card —
  aceitável para esta fase).
- **A triagem manual da Inbox não usa `activityId`.** `suggestReplyDraft`
  (em `/ops/inbox/[messageId]/actions.ts`) já tem revisão humana antes de
  qualquer envio; estender esse fluxo para também anexar um card de
  atividade à mensagem que sai pelo WhatsApp de verdade ficou fora do
  escopo desta fase — deliberado, não esquecido.
- **`messages.activity_id`** (nova coluna, nullable, `references
  knowledge_chunks(id) on delete set null`) grava a referência junto com
  a mensagem que a gerou. Serve para auditoria/analytics agora; **o
  histórico recarregado em `/quintal/chat` (o chat mudou de caminho na
  Fase 7) ainda não re-renderiza o card** a partir dela (ver limitações).

### `activity_feedback` — a nova tabela

A única tabela nova desta fase. Não cabia em `knowledge_chunks`
(conteúdo de referência, só leitura, sem policy de escrita para
`authenticated`) nem em `events` (tipos fixos, sempre atrelado a uma
criança, sem conceito de "sim/não"). RLS ligado, com policy de leitura
para `authenticated` (visibilidade futura em `/ops`) e nenhuma de
escrita — só o `service_role` grava, mesmo padrão de `ai_settings`.
Deliberadamente não vinculada a família/criança nesta fase (ver
limitações) — grava só `activity_id` + `helpful`.

### O que NÃO foi feito nesta fase (por pedido explícito)

Marketplace, comunidade, gamificação, assinatura, feed complexo, busca
avançada — nada disso foi tocado. `ActivityCard` também não aparece ainda
em nenhum lugar além do chat (home/recomendações ficaram como "capaz de",
não "implementado").

### Limitações

- **Histórico recarregado não re-renderiza o card.** `messages.activity_id`
  é gravado, mas a hidratação de histórico do chat (`/quintal/chat/page.tsx`
  desde a Fase 7) não busca `activity_id` nem re-monta o `ActivitySummary`
  ao reabrir a
  conversa — o texto da resposta continua lá, o card não. Passo natural
  seguinte: selecionar `activity_id` junto do histórico e resolver os
  `ActivitySummary` em lote.
- **Feedback não é atribuído a família/criança.** `activity_feedback`
  grava `child_id`/`caregiver_id` como `null` sempre nesta fase — o link
  do `ActivityCard` não carrega essa informação. Só dá para ver
  "quantas pessoas acharam essa atividade útil", não "esta família achou
  útil esta atividade".
- **Só `brincadeiras`/`materiais` viram "Activity".** As outras 8
  categorias (alimentos, receitas, sono, higiene, passeios etc.)
  continuam só como contexto textual em `suggestReply`, sem página
  própria — decisão deliberada: elas não têm o mesmo formato de "coisa
  concreta para fazer agora".
- **Sem teste de ponta a ponta com a IA real** (mesma limitação de rede
  das fases anteriores) — a busca (`search_knowledge_chunks`) e o parser
  (`getActivity`) foram verificados diretamente contra o banco real com a
  mensagem de teste pedida ("Ela está entediada..."); a chamada real ao
  Groq que decide o `activityId` não pôde ser reproduzida neste ambiente.

## Imagens de atividades (Fase 4.1) — por que Drive e não Storage

A usuária mantém, à mão, um banco de imagens no Google Drive
correlacionado por id (`mat-031.png` → `MAT-031`, `bri-001.png` →
`BRI-001`). `knowledge_chunks` ganhou uma coluna `image_url text`
nullable — mesmo padrão de coluna mínima de `messages.activity_id`, sem
tabela nova.

O ponto que vale registrar é a escolha do destino da URL. Supabase
Storage seria a opção consistente com o resto do projeto, mas subir bytes
de imagem para lá exige uma chamada à API REST do Storage, e:

- Esse ambiente de desenvolvimento bloqueia chamadas HTTPS diretas a
  `*.supabase.co` (confirmado de novo nesta fase: `curl` para o projeto
  fecha com `CONNECT tunnel failed, response 403` via o proxy de saída) —
  só as ferramentas MCP do Supabase passam, e elas são só Postgres
  (`execute_sql`/`apply_migration`/`generate_typescript_types`/...), sem
  nada equivalente a "subir um objeto no Storage".
- O Google Drive, ao contrário, tem ferramentas MCP de leitura completas
  neste ambiente (`search_files`, `get_file_permissions`, etc.).

Dado isso, `image_url` guarda por enquanto o link "thumbnail" do próprio
Drive (`https://drive.google.com/thumbnail?id=<fileId>&sz=w1000`), que
serve qualquer arquivo compartilhado como "qualquer pessoa com o link" —
confirmado que a pasta já está assim (`get_file_permissions` retornou uma
permissão `{"type":"anyone","role":"writer"}` no arquivo checado). Nenhum
código da aplicação sabe que a URL é do Drive: `ActivityCard` e
`/atividades/[id]` só renderizam `activity.imageUrl` como está. Trocar a
origem por Supabase Storage no futuro é reescrever o valor gravado na
coluna (um novo passo de sync que baixa do Drive e sobe pro Storage), não
mudar a UI.

`scripts/knowledge-base/sync_activity_images.py` é o passo repetível:
recebe uma lista `filename,fileId` (montada a partir de uma busca no
Drive feita por uma sessão com acesso MCP) e gera as instruções
`update ... set image_url = ...` a aplicar via `execute_sql`. Documentado
no próprio arquivo, mesmo padrão de "como rodar" do
`sync_knowledge_base.py`.

**Não verificado visualmente**: o mesmo bloqueio de rede que impede testar
Supabase também impede testar `google.com` a partir deste ambiente (a
mesma consulta ao proxy mostrou `CONNECT` rejeitado para
`www.google.com`), então a URL do Drive não pôde ser carregada num
navegador real por aqui — só confirmada como bem formada (fileId correto)
e como apontando para um arquivo com permissão pública de leitura.

## Recommendation Engine (Fase 5) — a primeira recomendação contextual

### Objetivo

Até a Fase 4, uma recomendação de atividade era um efeito colateral de
`suggestReply`: a mesma chamada que escrevia a resposta também escolhia
(ou não) um `activityId` entre os resultados da busca textual, sem
nenhuma regra de segurança etária nem memória de "isso já foi sugerido".
Esta fase separa essa decisão num serviço próprio,
`src/lib/recommendation.ts`, com uma pipeline explícita e regras simples
e auditáveis — sem scoring, sem ranking próprio (a única ordenação usada
é a que `search_knowledge_chunks` já produz).

### Pipeline

```
Mensagem do pai/mãe
  ↓
detectActivityRequest (Groq)         — "isso é uma situação para sugerir
  ↓  wantsActivitySuggestion?          atividade?" + situationSummary
  │
  ├─ false → { kind: "none" }         → conversation.ts cai para o
  │                                      suggestReply de sempre
  │
  └─ true
      ↓
     ChildContext.age.months          — sem idade conhecida, nunca
      │                                  recomenda (ver Limitações)
      ↓
     searchKnowledge(situationSummary, ageMonths)   — RAG existente
      ↓
     candidatos = resultados em brincadeiras/materiais
      ↓
     getActivity(id) por candidato    — para ter age_min/age_max reais
      ↓
     filtro 1: adequação etária (obrigatório, é segurança)
      ↓
     filtro 2: não recomendada recentemente PARA ESTA CRIANÇA
      ↓
     decisão = primeiro sobrevivente (ordem de relevância preservada)
      │
      ├─ nenhum sobrevivente → { kind: "clarify", question: <fixa> }
      │
      └─ existe → explainRecommendation (Groq, REDAÇÃO)
                    ↓
                  activity_recommendations (INSERT — histórico)
                    ↓
                  { kind: "activity", activity, reason }
                    ↓
     conversation.ts: reply = reason; activity = decisão
                    ↓
     UI: bolha de texto (reason) + "Uma ideia para agora" + ActivityCard
```

### DECISÃO vs. REDAÇÃO — por que são duas chamadas separadas

- **`decideActivity`** (função pura de `src/lib/recommendation.ts`, sem
  LLM) escolhe QUAL atividade recomendar. Só examina dados reais
  (resultado da busca, `age_min_months`/`age_max_months` de
  `knowledge_chunks`, histórico em `activity_recommendations`) — nenhum
  texto livre de IA entra nessa decisão.
- **`explainRecommendation`** (`src/lib/groq/explainRecommendation.ts`,
  com LLM) só escreve o texto que explica a escolha JÁ FEITA. O prompt
  nomeia a atividade decidida uma única vez e instrui explicitamente a
  não sugerir nenhuma outra — o modelo nunca vê uma lista de opções para
  escolher, então não tem como substituir a decisão por outra atividade
  (inventada ou não). Se essa chamada falhar, a decisão não se perde: um
  texto padrão (`defaultReason`) assume o lugar da explicação.

Essa separação é o que garante "a IA não deve ter liberdade irrestrita
para inventar atividades", pedido explicitamente nesta fase — a única
forma de uma atividade aparecer no card é ter sido resolvida por
`getActivity(id)` a partir de uma linha real de `knowledge_chunks`.

### Regra de decisão (sem scoring)

1. `search_knowledge_chunks(situationSummary, ageMonths, limit=8)` — a
   mesma função RAG das fases anteriores, já ordenada por relevância.
2. Filtra só `brincadeiras`/`materiais` (as únicas categorias que viram
   "Activity", ver Fase 4).
3. **Filtro de segurança (obrigatório):** descarta qualquer atividade cuja
   `age_min_months`/`age_max_months` seja incompatível com a idade real
   da criança (`ChildContext.age.months`). Este filtro nunca é
   flexibilizado.
4. **Filtro de repetição:** descarta as últimas
   `RECENT_RECOMMENDATIONS_LIMIT` (5) atividades já recomendadas para
   ESTA criança (`activity_recommendations`, filtrado por `child_id`).
5. A decisão é o primeiro item que sobrou (ou seja: o resultado
   etariamente seguro mais relevante que ainda não foi recomendado
   recentemente). Se o filtro de repetição zerar tudo mas ainda existir
   opção etariamente segura, a mais relevante é repetida mesmo assim —
   deliberado: melhor repetir uma sugestão do que não sugerir nada,
   enquanto a idade nunca é flexibilizada da mesma forma.
6. Se nem o filtro de segurança sobrar nada, a resposta é `{ kind:
   "clarify" }`, nunca uma atividade forçada.

### Por que não repete uma recomendação recente

`activity_recommendations` (tabela nova, ver migração
`20260925150000_create_activity_recommendations.sql`) grava
`child_id` + `activity_id` + `created_at` toda vez que o passo 5 acima
decide uma atividade. `child_id` é obrigatório de propósito: diferente de
`messages` (que só tem `family_id`), isso permite consultar "o que já foi
recomendado para a Laura" sem misturar com o que foi recomendado para um
irmão na mesma família — mesmo princípio de isolamento por criança já
estabelecido em `ChildContext` (Fase 3). Verificado nesta fase: inserir
uma recomendação para a criança A e consultar a recência da criança B
retorna vazio.

### Quando não há contexto suficiente

Duas situações diferentes, tratadas diferente:

- **Sem `childId`/idade conhecida**: `recommendActivity` retorna `{ kind:
  "none" }` imediatamente, sem chamar `detectActivityRequest` nem buscar
  nada — não há como checar segurança etária sem idade, então o Quintal
  simplesmente não entra no fluxo de recomendação (a conversa segue pelo
  `suggestReply` de sempre).
- **Idade conhecida, mas nenhuma atividade sobrevive aos filtros** (ex.:
  recém-nascido de 0 meses, onde a maioria do conteúdo pede idade
  mínima maior): `{ kind: "clarify", question: <pergunta fixa> }`. A
  pergunta é uma string fixa no código
  (`GENERIC_CLARIFYING_QUESTION`), não gerada por LLM — pedir uma
  pergunta a um modelo arriscaria a mesma invenção de preferências que
  esta fase pede para evitar.

### Arquivos e tabelas alterados

- **Novo** `src/lib/recommendation.ts` — `recommendActivity`,
  `decideActivity`, filtros de idade/repetição, registro do histórico.
- **Novo** `src/lib/groq/detectActivityRequest.ts` — intent + resumo da
  situação (passo 1 da pipeline).
- **Novo** `src/lib/groq/explainRecommendation.ts` — redação (passo final
  antes da UI).
- **Nova tabela** `activity_recommendations` (`child_id`, `activity_id`,
  `created_at`) — histórico mínimo de recomendação, RLS ligado, só
  leitura para `authenticated`, mesmo padrão de `activity_feedback`.
- **`src/lib/groq/suggestReply.ts`** — simplificado: não escolhe mais
  `activityId` (campo removido do schema/retorno); volta a ser só a
  resposta conversacional geral, usada quando o Recommendation Engine
  decide que a mensagem não é uma dessas situações.
- **`src/lib/conversation.ts`** — chama `recommendActivity` em paralelo a
  `suggestEventFromMessage`; só chama `suggestReply` quando a
  recomendação volta `{ kind: "none" }`. O retorno de
  `recordConversationTurn` não mudou de forma (`{eventTypeLabel, reply,
  inboundMessageId, activity}`) — só a origem interna de `activity`
  mudou.
- **`src/components/conversation/ConversationChat.tsx`** — rótulo "Uma
  ideia para agora" acima do `ActivityCard` quando a resposta trouxer uma
  atividade.

### Testes realizados (contra o banco real, sem chamar o Groq — ver
limitações)

Mesma metodologia das fases anteriores: rede bloqueada para
`api.groq.com` neste ambiente, então `detectActivityRequest`/
`explainRecommendation` (as duas chamadas de IA) não puderam ser
exercitadas de ponta a ponta. As regras determinísticas — que são o
núcleo desta fase — foram verificadas diretamente contra dados reais:

1. **Criança pequena (4 meses), "criança entediada, sem saber o que
   fazer"**: busca retorna `BRI-001` (4–36m) e `BRI-052` (9–48m). Filtro
   de idade corretamente mantém só `BRI-001` (4 ≥ 4) e descarta `BRI-052`
   (4 < 9).
2. **Criança maior (24 meses), mesma situação**: 3 candidatos
   sobrevivem ao filtro de idade (`BRI-001`, `BRI-052`, `MAT-020`).
   Decisão = o primeiro (`BRI-001`, mais relevante).
3. **Atividade recomendada recentemente**: gravando `BRI-001` como
   recomendação recente da criança de 24 meses, a decisão passa a ser
   `BRI-052` (segundo mais relevante) — confirma que o filtro de
   repetição de fato troca a escolha, não só a registra.
4. **Repetição como único caminho seguro**: para a criança de 4 meses
   (onde só `BRI-001` é etariamente seguro), gravar `BRI-001` como
   recomendação recente e reconsultar mostra que ele seria excluído pelo
   filtro de repetição — confirmando que, sem alternativa etariamente
   segura, o código recai em `ageAppropriate[0]` (repete) em vez de
   `{ kind: "clarify" }`.
5. **Sem contexto suficiente (recém-nascido, 0 meses)**: mesma busca
   retorna só `BRI-001` (4–36m) como candidato de atividade — que o
   filtro de idade descarta (0 < 4). Zero sobreviventes → o código cairia
   em `{ kind: "clarify" }`.
6. **Isolamento entre irmãos**: gravar uma recomendação para a criança A
   e consultar a recência da criança B retorna vazio — confirma que
   `activity_recommendations` é escopada por criança, não por família.
7. **Sem `childId`/idade**: verificado por leitura de código — o guard
   `!childContext || childContext.age.months === null` retorna `{ kind:
   "none" }` antes de qualquer chamada de rede (nem `detectActivityRequest`
   nem `searchKnowledge` rodam).
8. **Atividade inexistente**: verificado por leitura de código —
   `decideActivity` descarta `null`s de `getActivity` via `.filter(...)`,
   o mesmo guard já usado (e testado) desde a Fase 4 para ids
   alucinados/removidos.

### Limitações

- **Sem chamada real ao Groq nesta sessão** (mesma limitação de rede das
  fases anteriores) — `detectActivityRequest` e `explainRecommendation`
  não puderam ser exercitadas de ponta a ponta; a lógica determinística
  (a parte que decide QUAL atividade, que é o núcleo do pedido desta
  fase) foi verificada diretamente, como listado acima.
- **`getActivity` por candidato (N+1)**: para ter `age_min_months`/
  `age_max_months` reais (a função RPC de busca não devolve esses
  campos), cada candidato da busca é buscado individualmente. Aceitável
  para uma lista pequena (até 8 por turno), mas não escala — se o volume
  de conteúdo crescer muito, vale considerar devolver idade direto de
  `search_knowledge_chunks`.
- **Sem feedback loop completo** (pedido explícito desta fase): a
  recomendação é registrada em `activity_recommendations`, mas não há
  ainda ligação entre essa linha e o `activity_feedback` (thumbs
  up/down) já existente da Fase 4 — não dá para responder ainda "essa
  recomendação específica ajudou?", só "quantas pessoas acharam essa
  atividade útil" (mesma limitação de atribuição da Fase 4).
- **Pergunta de esclarecimento é única e fixa**: `GENERIC_CLARIFYING_QUESTION`
  é a mesma pergunta para qualquer situação sem candidato seguro — não
  varia por idade nem por situação relatada. Evita inventar preferências
  à custa de generalidade.
- **Intent detection é uma classificação binária simples**: mensagens
  ambíguas (nem claramente "sugira uma atividade" nem claramente outra
  coisa) dependem inteiramente do julgamento do modelo em
  `detectActivityRequest` — não há uma segunda camada de verificação
  além do isolamento entre decisão e redação já descrito.
- **Histórico de recomendação não é exposto em `/ops`** ainda — a tabela
  existe e é populada, mas não há tela de operador para visualizá-la
  **(resolvido na Fase 6, ver abaixo — `/ops/children/[id]` agora mostra
  recomendação + feedback + observação).**

## Feedback e aprendizado (Fase 6) — fechando o loop

### O loop

```
Context (ChildContext)
  ↓
Recommendation (activity_recommendations — Fase 5, imutável depois de criada)
  ↓
Outcome (a família abre a atividade → activity_recommendations.opened_at)
  ↓
Feedback (activity_recommendation_feedback — nova tabela, nunca sobrescreve
           a recomendação; um evento novo, não uma edição do antigo)
  ↓
Context (a próxima chamada a decideActivity já enxerga esse feedback ao
          decidir a próxima recomendação para a MESMA criança)
```

O "aprendizado" desta fase é literalmente isso: dado estruturado (uma
linha em `activity_recommendation_feedback`) + regra simples (excluir a
atividade das próximas sugestões por um tempo) + contexto pro LLM (a
explicação da próxima recomendação continua vindo de
`explainRecommendation`, sem qualquer treinamento de modelo). Nenhum
modelo é treinado, ajustado ou fica sabendo do feedback de forma alguma —
só o Postgres.

### Por que RECOMMENDATION e RECOMMENDATION_FEEDBACK são tabelas diferentes

`activity_recommendations` (Fase 5) é a decisão em si: qual atividade,
para qual criança, quando, a partir de qual mensagem. Depois de criada,
nunca é sobrescrita por um feedback — só ganha, no máximo, um
`opened_at` (ver abaixo), que é a própria recomendação registrando que
foi vista, não uma reinterpretação do que foi decidido.

`activity_recommendation_feedback` (nova) é informação que só existe
DEPOIS da recomendação, potencialmente muito depois, e que pode nem
existir (nem toda recomendação recebe feedback) ou existir mais de uma
vez (a família pode reagir de novo mais tarde). Cada linha aponta para
uma recomendação específica via `recommendation_id` — nunca "esta
atividade em geral", mas "esta sugestão específica, nesta conversa,
naquele momento". `child_id`/`activity_id` também aparecem na própria
linha de feedback (cópias do momento do insert, a partir de
`recommendation_id`) só para consultas simples sem join — a fonte da
verdade continua sendo `recommendation_id`.

### Schema

```sql
-- Fase 5, agora com dois campos de evento a mais:
alter table activity_recommendations
  add column source_message_id uuid references messages(id) on delete set null,
  add column opened_at timestamptz;

-- Nova:
create table activity_recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references activity_recommendations(id) on delete cascade,
  child_id uuid not null references children(id) on delete cascade,
  activity_id text not null references knowledge_chunks(id) on delete cascade,
  feedback text not null check (feedback in ('worked', 'did_not_work', 'wants_another')),
  note text,
  created_at timestamptz not null default now()
);
```

`activity_feedback` (Fase 4, thumbs up/down avulso em `/atividades/[id]`)
continua existindo, sem alteração — é um mecanismo diferente (feedback
sobre o CONTEÚDO, de qualquer visitante da página pública, sem saber se
veio de uma recomendação) do que `activity_recommendation_feedback`
(feedback sobre UMA recomendação específica dentro de uma conversa). Os
dois convivem de propósito.

### Analytics: os três eventos pedidos, sem plataforma nova

- **`recommendation_created`** = o INSERT em `activity_recommendations`
  (já existia desde a Fase 5; `source_message_id` só enriquece esse
  registro).
- **`recommendation_opened`** = `activity_recommendations.opened_at`,
  setado por `markRecommendationOpened` na primeira vez que
  `/atividades/[id]?rec=<id>` é aberto a partir daquele card específico
  (`.is("opened_at", null)` faz disso um "primeira vez", não "última
  vez").
- **`recommendation_feedback`** = o INSERT em
  `activity_recommendation_feedback`.

Nenhuma tabela genérica de eventos foi criada — os três "eventos" pedidos
já são, cada um, uma escrita com significado próprio numa tabela que já
faz sentido sozinha, mesmo padrão de `messages.handled_at` já usado no
projeto.

### Arquivos alterados

- **`src/lib/recommendation.ts`**:
  - `recordRecommendation` agora recebe `sourceMessageId` e retorna o
    `id` da linha criada (antes não precisava retornar nada).
  - `decideActivity` troca "descarta recomendado recentemente" por
    "descarta o que deve ser evitado por enquanto" —
    `getActivityIdsToAvoidForNow`, união de `getRecentlyRecommendedIds`
    (já existia) com a nova `getRecentNegativeFeedbackActivityIds`.
  - Novo: `submitRecommendationFeedback` (grava a linha de feedback,
    resolvendo `child_id`/`activity_id` a partir da recomendação).
  - Novo: `markRecommendationOpened` (seta `opened_at`, validando que o
    `activityId` da URL bate com o da recomendação antes de gravar).
  - `RecommendationResult`'s `{kind: "activity"}` ganhou
    `recommendationId`.
- **`src/lib/groq/detectActivityRequest.ts`, `explainRecommendation.ts`**:
  sem mudanças — o feedback nunca entra no prompt destas chamadas
  (permanece decisão + redação puras, ver Fase 5).
- **`src/lib/conversation.ts`**: passa `sourceMessageId: inboundMessage.id`
  para `recommendActivity`; `recordConversationTurn` retorna
  `recommendationId` além de `activity`.
- **`src/components/conversation/ConversationChat.tsx`**: `ConversationTurn`
  ganhou `recommendationId`; novo prop opcional `onFeedback`; renderiza
  `<RecommendationFeedback>` abaixo do `ActivityCard` quando há uma
  recomendação.
- **Novo `src/components/conversation/RecommendationFeedback.tsx`**: os
  três botões (Funcionou / Não funcionou / Quero outra ideia) + campo de
  observação opcional, discreto, sem estrelas/notas.
- **`src/components/conversation/ActivityCard.tsx`**: aceita
  `recommendationId` opcional, usado para montar
  `/atividades/[id]?rec=<id>`.
- **`src/app/atividades/[id]/page.tsx`**: lê `?rec=` e chama
  `markRecommendationOpened` quando presente.
- **`src/app/quintal/actions.ts`** (hoje `src/app/quintal/chat/actions.ts`
  — o arquivo se mudou junto com o chat na Fase 7)**, `src/app/test/[caregiverId]/actions.ts`**:
  cada um ganhou um `sendXRecommendationFeedback`, wrapper fino em cima de
  `submitRecommendationFeedback` — mesmo padrão de duplicação mínima já
  usado para `sendXMessage`.
- **`src/app/ops/children/[id]/page.tsx`**: nova seção "Recomendações de
  atividade" — junta `activity_recommendations` (com `knowledge_chunks`
  para o título) e `activity_recommendation_feedback` (1:N) numa lista só,
  sem exigir que o Concierge cruze tabelas manualmente.

### Como o feedback afeta as próximas recomendações

Só através de `getActivityIdsToAvoidForNow`, dentro de `decideActivity` —
em nenhum outro lugar do código o feedback é lido. A regra:

1. As últimas 5 recomendações da criança (qualquer feedback) continuam
   bloqueadas por um turno (Fase 5, inalterado).
2. AGORA TAMBÉM: as últimas 5 atividades com feedback
   `did_not_work`/`wants_another` daquela criança ficam bloqueadas,
   mesmo que já tenham saído da janela de "recomendado recentemente" —
   é o sinal explícito da família pesando mais do que só o tempo.
3. Feedback `worked` NÃO adiciona bloqueio nenhum — uma atividade que
   funcionou pode voltar a ser sugerida assim que sair da janela de
   repetição simples do item 1. Verificado: inserir feedback `worked`
   para uma atividade e consultar o conjunto de "evitar por feedback"
   retorna vazio para ela.
4. As duas janelas (item 1 e 2) são contagens fixas (5), não permanentes
   — uma atividade excluída por feedback antigo volta a ser candidata
   assim que outras 5 mais recentes a empurram para fora da janela.
   Verificado com 6 feedbacks negativos inseridos em ordem: o mais antigo
   (6h atrás) não aparece mais na consulta com `limit 5`.
5. Se o filtro do item 1+2 zerar todas as opções etariamente seguras, a
   mais relevante é repetida mesmo assim (mesma regra de fallback da
   Fase 5) — a idade nunca cede, a preferência da família, no limite, sim.

Isso é deliberadamente O OPOSTO de inferir uma preferência permanente:
não existe em lugar nenhum do código uma tabela ou campo do tipo
"child_dislikes_activity" que persista para sempre. Um "não funcionou"
hoje só significa "não recomende de novo nos próximos ~5 feedbacks/turnos
dessa criança" — depois disso, a atividade volta ao pool normal de
candidatos, exatamente como se o feedback nunca tivesse existido. Essa
distinção foi verificada diretamente (item 4 acima).

### Testes realizados (contra o banco real, mesma limitação de rede das fases anteriores)

1. **Feedback positivo**: inserida uma recomendação de `BRI-001` com
   feedback `worked` + observação "Ela adorou" — confirmado que `BRI-001`
   NÃO aparece na consulta de "evitar por feedback negativo" (contagem
   zero).
2. **Feedback negativo**: inserida uma recomendação de `BRI-052` com
   feedback `did_not_work` — confirmado que `BRI-052` aparece na consulta
   de "evitar por feedback negativo" para aquela criança.
3. **Feedback textual**: a observação "Ela adorou" foi persistida e lida
   de volta sem erro (coluna `note`, nullable, sem transformação).
4. **Duas crianças diferentes (isolamento)**: com o feedback negativo de
   `BRI-052` gravado para a criança A, a mesma consulta para a criança B
   retorna vazio — feedback de uma criança nunca influencia a outra.
5. **Feedback antigo vs. recente**: 6 feedbacks negativos inseridos para
   a mesma criança, em ordem cronológica — a consulta com `limit 5`
   (réplica exata de `getRecentNegativeFeedbackActivityIds`) retorna
   exatamente os 5 mais recentes; o mais antigo (6h atrás) fica de fora,
   confirmando que o bloqueio por feedback tem janela, não é permanente.
6. **Atividade recomendada novamente**: réplica completa de
   `decideActivity` para a situação "criança de 24 meses, entediada"
   (candidatos `BRI-001`, `BRI-052`, `MAT-020`, ordem de relevância já
   verificada na Fase 5) com `BRI-001` carregando feedback
   `did_not_work` — a decisão corretamente recai em `BRI-052`, o próximo
   mais relevante, em vez de insistir em `BRI-001`.

### Limitações

- **Sem chamada real ao Groq nesta sessão** (mesma limitação de rede das
  fases anteriores) — `detectActivityRequest`/`explainRecommendation`
  não mudaram nesta fase e não puderam ser reexercitados de ponta a
  ponta; toda a lógica nova (que é puramente determinística, sem LLM)
  foi verificada diretamente contra o banco real, como listado acima.
- **Feedback é por botão, não por texto livre na conversa**: se a família
  disser "não funcionou" digitando na conversa normal (em vez de tocar no
  botão), isso não é reconhecido como `RECOMMENDATION_FEEDBACK` — vira
  só uma mensagem comum, sem nenhum detector de intenção de feedback
  dedicado (decisão deliberada, para não adicionar mais uma chamada de
  IA nesta fase).
- **`recommendation_opened` só cobre o clique no card**: se a família abre
  `/atividades/[id]` de outra forma (ex.: um link salvo antigo sem
  `?rec=`), esse acesso não conta como abertura de nenhuma recomendação
  específica — comportamento esperado, não um bug.
- **Janelas de 5 são fixas e compartilhadas entre todas as famílias** —
  não configuráveis por criança/família nesta fase, mesmo estilo de
  constante simples já usado em `RECENT_RECOMMENDATIONS_LIMIT` (Fase 5).
- **`activity_feedback` (Fase 4) e `activity_recommendation_feedback`
  (Fase 6) não são unificados** — um relatório que quisesse "todo
  feedback sobre atividades" precisaria consultar as duas tabelas
  separadamente. Deliberado (motivos diferentes de existir, ver acima),
  mas vale registrar como ponto de atenção para uma eventual tela de
  analytics mais completa.

## Dashboard da família (Fase 7) — `/quintal` deixa de ser o chat

### O que mudou estruturalmente

Até a Fase 6, `/quintal` ERA a conversa: uma única página que montava
`ChildHeader` + `ConversationChat` direto. Esta fase introduz a ideia de
que o produto tem mais de uma tela, e a conversa é só uma delas — então:

```
/quintal              → Home/Dashboard (novo — esta fase)
/quintal/chat          → a conversa (o que /quintal era antes, movido
                          sem alterar lógica nenhuma)
/quintal/perfil         → visão só-leitura da criança/família (novo, mínimo)
```

`recordConversationTurn`, `recommendActivity`, `suggestReply`,
`ChildContext` — o núcleo inteiro descrito no topo deste documento — não
mudou uma linha. Só o "endereço" da tela que fala com ele mudou. Isso foi
possível porque a UI de chat sempre foi um componente (`ConversationChat`)
consumido por uma página fina, não uma página monolítica — mover a
conversa foi só copiar `page.tsx`/`actions.ts` para `chat/`. Nenhum
`redirect` precisou mudar: `/comecar` sempre apontava para `"/quintal"`,
e continua apontando — só o que existe nesse endereço mudou de conversa
para Dashboard, que é exatamente o efeito pretendido ("`/quintal` vira o
ponto central de entrada").

### `src/lib/dashboard.ts` — a única fonte de dado do Dashboard

Mesmo padrão de `getChildContext`/`getActivity`/`recommendActivity`:
toda a lógica de "o que mostrar hoje" vive numa função de lib
(`getDashboardSummary(childId)`), a página só renderiza o que ela
devolve. Duas queries, ambas filtradas por `child_id` e por "hoje" (meia-
noite no horário local do servidor — mesma simplificação de fuso já
assumida em `toDatetimeLocalValue`, `src/lib/format.ts`, e sem
tratamento de fuso por família em nenhum lugar do projeto ainda):

1. `events` do dia, filtrados pelos mesmos tipos que `ChildContext` já
   trata como "atividade do dia a dia" (`ACTIVITY_EVENT_TYPES`, agora
   exportada de `childContext.ts` para não duplicar essa lista) — vira a
   timeline E as contagens de Sono/Brincadeiras/Rotina.
2. `activity_recommendations` de hoje — reaproveita `getActivity` (o
   mesmo helper que `recommendActivity`/`/atividades/[id]` já usam) para
   virar `ActivitySummary[]`, consumido pelo `ActivityCard` já existente.

Nenhuma tabela nova. Nenhum campo novo. O Dashboard é, deliberadamente,
uma nova forma de olhar para dado que a Fase 3, 4 e 5/6 já produziam.

### Por que "Alimentação" é sempre um estado vazio

`eventTypes` (`src/lib/validation/events.ts`) só tem `sleep`, `routine`,
`free_play`, `development`, `observation`, `decision` — não existe (e
não foi criado nesta fase, de propósito) um tipo de evento de
alimentação. O card de Alimentação no Dashboard mostra sempre o estado
vazio ("Em breve por aqui"), nunca um número — inventar uma contagem a
partir de um dado que não existe seria exatamente o tipo de "conteúdo
inventado" que o pedido desta fase proibiu. Quando o módulo de
Alimentação for desenvolvido (candidato de fase futura,
`docs/PRODUCT_ROADMAP.md`), este card passa a ler dado real do mesmo
jeito que Sono/Brincadeiras/Rotina já leem.

Pelo mesmo motivo, o card de Sono mostra só a CONTAGEM de sonecas
(`sleep` não tem campo de início/fim, só `occurred_at` + `notes` livre) —
não uma duração como "1h42" (exemplo ilustrativo do briefing). E o card
de Rotina mostra o ÚLTIMO evento de rotina já registrado hoje, não um
"próximo evento" (não existe agenda/rotina programada no schema — só
histórico do que já aconteceu).

### Componentes novos, todos em `src/components/dashboard/`

- **`DashboardHeader`**: nome da criança (link para `/quintal/perfil`),
  data de hoje, idade, botão de chat (`/quintal/chat`) sempre visível.
  Deliberadamente um componente novo, não uma extensão de `ChildHeader`
  — `ChildHeader` continua servindo só o chat, sem ganhar campos que não
  fazem sentido lá (data, link de perfil).
- **`SummaryCard`**: a peça repetida da grade "Hoje" — ícone, rótulo,
  valor real OU texto de estado vazio. Puramente apresentacional, quem
  decide "tem dado ou não" é sempre `getDashboardSummary`, nunca o
  componente.
- **`Timeline`**: lista cronológica dos eventos de hoje, com o mesmo
  estado vazio elegante quando não há nenhum.

`ActivityCard` (Fase 4) não foi tocado — é reaproveitado tal como já
existia na seção "Para hoje", primeira vez que aparece fora do chat,
exatamente como o roadmap já previa ("`ActivityCard` em mais lugares").

### Testado

Mesma limitação de rede das fases anteriores (sem navegador real contra
o Supabase de produção neste ambiente) — a lógica de `getDashboardSummary`
foi verificada direto contra o banco: eventos de hoje de
sleep/routine/free_play/observation inseridos numa transação de teste
(com rollback), confirmando que (1) a timeline traz exatamente os quatro
tipos de atividade em ordem cronológica e exclui `observation`, (2) a
contagem de sono/brincadeiras bate com o número de linhas de cada tipo,
(3) "último evento de rotina" pega corretamente o mais recente do dia
(não o primeiro), e (4) a recomendação do dia aparece na consulta
filtrada por `child_id` + "hoje". Responsividade validada pelas classes
Tailwind usadas (mobile-first com breakpoints `sm`/`lg`, grade 2→4
colunas), não visualmente numa tela real.

### Limitações

- Ver a seção "Limitações conhecidas desta fase" em
  `docs/PRODUCT_ROADMAP.md`, Fase 7 — mesma lista, sem duplicar aqui.

## Camada de contexto estruturado (Fase 8)

### Objetivo

Até aqui, "o que sabemos sobre uma família" vivia em três lugares
diferentes e nenhum era realmente estruturado: `children.notes` (texto
livre), o histórico de mensagens (texto livre, escopado por família, não
por criança — ver "O núcleo permanece único" acima), e `events.notes`
(texto livre, por criança). Esta fase adiciona a peça que faltava: dados
estruturados e editáveis pela própria família, que tanto o Dashboard
quanto o chat conseguem consumir sem precisar reinterpretar texto.

### O que já existia e o que é novo

| Conceito pedido | Já existia como | O que a Fase 8 adicionou |
|---|---|---|
| Family | `families` | nada — já servia |
| Child | `children` | `interests text[]` |
| Caregiver | `caregivers` | nada — já servia, sem UI de edição no perfil da família (deliberado, ver limitações) |
| Preferences | nada | `family_preferences` (tabela nova) |
| Child Interests | nada | `children.interests` (mesma coluna acima) |
| Events (genérico) | `events` (6 tipos) | +`meal`, +`outing`, +`origin`, +`duration_minutes` |

Nada foi renomeado ou removido — critério de aceite explícito desta fase
("nenhuma funcionalidade existente foi quebrada").

### `events`: por que somar tipos em vez de renomear

O pedido desta fase listava tipos conceituais `sleep`/`meal`/`play`/
`outing`/`routine`/`note`. Comparando com o que já existia
(`sleep`/`routine`/`free_play`/`development`/`observation`/`decision`):
`play` e `note` já tinham exatamente esse papel, só com nomes diferentes
(`free_play`/`observation`) — e esses nomes já estão espalhados por
`eventTypeLabels`, `ChildContext.ACTIVITY_EVENT_TYPES`, o formulário de
`/ops/children/[id]`, o prompt de classificação de `suggestEvent.ts`, e
dados já gravados no banco. Renomear quebraria tudo isso sem nenhum
ganho real — a arquitetura já tinha o conceito, só com outro rótulo. Só
`meal` e `outing` eram lacunas de verdade (nenhum tipo existente cobria
"alimentação" ou "passeio"), então só esses dois foram somados à
constraint `events_type_check`.

`meal`/`outing` entraram também em `ACTIVITY_EVENT_TYPES`
(`src/lib/childContext.ts`) — o mesmo grupo "dia a dia, frequente,
baixo risco" que `sleep`/`routine`/`free_play`/`development` já
formavam. Automaticamente, isso significa: (1) entram na timeline e nas
contagens do Dashboard (que já reusa essa constante — ver Fase 7), e (2)
entram no bloco "Atividades recentes" do prompt da IA, sem precisar
tocar em `getChildContext` ou em `formatChildContextForPrompt` para
isso.

### `origin` e `duration_minutes`: preparação, não extração

O pedido é explícito: o chat deve poder gerar eventos estruturados no
futuro (ex.: "ela dormiu das 14h às 15h20" virando
`{type: sleep, duration_minutes: 80, origin: chat}`), mas esta fase NÃO
implementa essa extração — só prepara o schema para recebê-la:

- **`origin`** (`manual`/`chat`/`system`/`recommendation`, default
  `'manual'`) grava explicitamente de onde um evento veio, em vez de só
  poder inferir isso indiretamente de `source_message_id` (que só diz
  "veio de alguma mensagem", não "veio de uma extração automática").
  Backfill aplicado na migração: linhas com `source_message_id` não nulo
  viraram `origin = 'chat'` (é literalmente o que já significavam).
  `'system'`/`'recommendation'` ainda não são emitidos por nenhum
  código — ficam modelados para quando fizer sentido (ex.: um evento
  gerado ao aceitar uma recomendação).
- **`duration_minutes`** (nullable, `> 0` quando presente) — hoje só
  preenchível manualmente em `/ops/children/[id]` (campo novo no
  formulário). `suggestEventFromMessage` (`src/lib/groq/suggestEvent.ts`)
  **não foi alterado** — continua sem extrair duração/horário
  estruturado de uma mensagem; isso é o próximo passo natural (Fase 9),
  não desta fase.
- Os três pontos que gravam em `events` foram todos atualizados para
  declarar `origin` explicitamente: `/ops/children/[id]/actions.ts`
  (`'manual'`, a operadora digitou direto), `/ops/inbox/[messageId]/actions.ts`
  (`'chat'`, o conteúdo vem de uma mensagem de WhatsApp real),
  `src/lib/conversation.ts` (`'chat'`, o registro automático a partir do
  texto da conversa).

### `family_preferences` e `children.interests` — como chegam ao chat

`getChildContext` (`src/lib/childContext.ts`, Fase 3) ganhou dois campos
novos: `child.interests` (direto de `children.interests`) e
`familyPreferences` (busca `family_preferences` pelo `family_id` da
criança — por isso o select de `children` passou a incluir `family_id`,
que antes não precisava). `formatChildContextForPrompt` — o único lugar
que transforma um `ChildContext` em texto de prompt — ganhou duas seções
novas, com a mesma disciplina de sempre: omitidas quando vazias, nunca
"nenhum interesse registrado" de preenchimento. Como `suggestReply`,
`suggestEvent` e `explainRecommendation` já consomem `ChildContext`
(direta ou indiretamente) sem conhecer sua forma interna, esse dado
passou a estar disponível para a IA em TODAS as chamadas existentes, sem
tocar em nenhum desses arquivos.

`src/lib/familyContext.ts` (novo) é o módulo separado para o caso de uso
diferente: leitura + edição pela família em `/quintal/perfil`, não
leitura para prompt. `getChildContext` continua só-leitura e focado em
"o que a IA precisa saber agora"; `familyContext.ts` expõe
`getFamilyProfile` (família inteira: cuidadores, todas as crianças,
preferências) e `updateChildEssentials`/`updateFamilyPreferences` — as
duas únicas mutações desta fase.

### `/quintal/perfil`: de só-leitura (Fase 7) para editável

Reescrita completa da página, mas o padrão de acesso não mudou
(sessão → `caregiver.family_id`, igual a `/quintal` e `/quintal/chat`).
Progressive disclosure implementada com `<details>`/`<summary>` nativos
— zero JavaScript novo no cliente, zero componente de estado — as
preferências da família ficam fechadas por padrão, cada criança tem seu
próprio formulário pequeno e independente (nome, nascimento, interesses
como texto separado por vírgula, convertido em array no servidor por
`childEssentialsInputSchema`). Cuidadores continuam só-leitura aqui
(edição completa já existe para o operador em
`/ops/families/[id]` — duplicar essa UI no lado da família não foi
pedido e ficaria fora do escopo de "não criar formulário gigantesco").

### Testado

Mesma limitação de rede das fases anteriores (sem navegador real contra
o Supabase de produção neste ambiente) — verificado direto no banco, em
transações com rollback: (1) `meal`/`outing` aceitos pela constraint
nova, com `origin` default `'manual'`; (2) round-trip de
`children.interests` (array de strings); (3) upsert de
`family_preferences` e leitura via join por `family_id`, replicando
exatamente a query de `getChildContext`; (4) a query de timeline do
Dashboard (Fase 7) incluindo `meal`/`outing` nos tipos filtrados,
confirmando que `mealCount` passa a refletir dado real.

### Limitações

- **Extração automática de eventos a partir do chat não foi
  implementada** — o pedido foi explícito em preparar a arquitetura, não
  construir a extração. `suggestEventFromMessage` continua exatamente
  como estava.
- **Sem campos médicos/sensíveis** — por pedido explícito. "Fatos
  permanentes" como alergias ficam para uma decisão própria de
  produto/segurança (Fase 9).
- **Perfil não edita cuidadores nem tem foto** — só essenciais da
  criança e preferências da família.
- **`interests` é uma lista simples, sem proveniência** — não registra
  se um interesse veio de edição manual ou (no futuro) de uma inferência
  do chat; se isso importar um dia, é um campo a mais, não uma tabela
  nova.

## Módulo de Alimentação (Fase 9)

### Objetivo

Até aqui, "Alimentação" no Dashboard (Fase 7) era um placeholder honesto
e, na Fase 8, uma contagem de `events.type = 'meal'` — sem nenhuma
experiência própria: não havia como configurar um método alimentar, ver
sugestões, ou registrar o que foi comido além de uma nota livre. Esta
fase constrói essa experiência inteira sobre o que já existia,
deliberadamente sem tabela nova para refeições e sem hardcodar métodos
alimentares.

### Por que nenhuma tabela nova para "refeições"

`events.type = 'meal'` já existia desde a Fase 8; `events.payload`
(jsonb) é documentado desde a migração original da tabela como
"reservado para campos estruturados por tipo quando houver evidência
real do que gravar". Esta fase é essa evidência: uma refeição precisa de
`slot` (qual refeição do dia), `foods` (o que foi oferecido),
`acceptance` (como a criança reagiu), e duas referências opcionais
(`offeringMethodId`, `suggestionId`) — nenhum desses cabe bem como coluna
própria de `events` (são específicos de `meal`, os outros tipos não têm
uso para eles), então viram o primeiro uso real de `payload`:

```ts
// src/lib/validation/feeding.ts
type MealEventPayload = {
  slot: MealSlot;                    // breakfast | morning_snack | lunch | afternoon_snack | dinner | other
  foods: string[];
  acceptance: MealAcceptance;        // ate_well | ate_some | refused | unknown
  offeringMethodId: string | null;   // foto do children.feeding_method_id no momento do registro
  suggestionId: string | null;       // se veio de um card de sugestão, qual
};
```

`events.notes` (NOT NULL) continua preenchido também — com o texto
digitado pela família ou, na ausência dele, a lista de alimentos ou o
nome da refeição — para que qualquer código que já lê `events.notes`
sem saber de `payload` (ex.: a Timeline do Dashboard, Fase 7) continue
funcionando sem alteração nenhuma.

### Por que método alimentar é uma referência a `knowledge_chunks`, não um enum

O pedido era explícito: "a arquitetura deve permitir métodos diferentes
sem hardcode excessivo" e "nenhuma abordagem [deve ser] universalmente
correta". Em vez de um `check` constraint com uma lista fixa de métodos
em código, `children.feeding_method_id` referencia
`knowledge_chunks(id)` — mesmo padrão já estabelecido na Fase 4 para
`brincadeiras`/`materiais` como "conteúdo de referência". A categoria
`metodos_alimentacao` já existia na base de conhecimento sincronizada
(`scripts/knowledge-base/sync_knowledge_base.py`), com 5 linhas prontas
(Tradicional, BLW — Baby-Led Weaning, BLISS, Participativa/mista,
Alimentação responsiva), cada uma com um campo "Como funciona" que a
página expõe como está, sem reescrever. Um método novo no futuro (ex.:
uma variação regional) é uma linha de conteúdo a mais — nenhuma migração,
nenhum deploy de código.

`children.feeding_method_custom` (texto livre) cobre o caso "nenhuma
opção listada serve" — pedido explicitamente pela ideia de "outro/
personalizado". Os dois campos são mutuamente exclusivos por construção
em `updateChildFeedingMethod` (`src/lib/feeding.ts`): passar um
`methodId` sempre grava `feeding_method_custom = null` junto, e
vice-versa — a página nunca precisa reconciliar duas respostas
diferentes para "qual é o método atual".

```sql
-- supabase/migrations/20260928124642_add_child_feeding_method.sql
alter table public.children
  add column feeding_method_id text references public.knowledge_chunks (id) on delete set null,
  add column feeding_method_custom text;
```

### Sugestões de refeição — reaproveitando `receitas`, sem scoring

A categoria `receitas` de `knowledge_chunks` (60 linhas) já tinha,
verbatim, quase todos os campos pedidos para o card de sugestão:
"Refeição" (ex.: "Almoço/jantar"), "Ingredientes", "Modo de preparo" (o
"como oferecer"), "Métodos compatíveis" (ex.: "BLW; BLISS; Mista"), e
"Observação" (orientação de textura/segurança já presente na receita).
`getMealSuggestions` (`src/lib/feeding.ts`) só precisou ler esses campos
de volta com `parseContentFields` — a mesma função exportada de
`activity.ts` (Fase 4) que já sabia parsear o formato `"Cabeçalho:
Valor"` do `content`, agora reaproveitada em vez de duplicada.

A regra de filtro/ordenação, deliberadamente sem scoring — mesmo
espírito de `decideActivity` (Fase 5):

1. **Filtro de idade (obrigatório)**: descarta receitas cujo
   `age_min_months` seja maior que a idade real da criança. Nunca
   flexibilizado.
2. **Filtro de refeição do dia**: se a família está olhando "almoço",
   prioriza receitas cujo campo "Refeição" contém uma palavra-chave
   compatível (`SLOT_LABEL_KEYWORDS`) — mas se isso zerar o pool
   (nenhuma receita etariamente segura menciona aquela refeição
   especificamente), cai de volta para todo o pool etariamente seguro em
   vez de mostrar "nenhuma sugestão" — melhor uma sugestão de refeição
   adjacente do que nenhuma.
3. **Desempate por método (não um filtro)**: se a família configurou um
   método, receitas cujo "Métodos compatíveis" cita esse método (via
   `methodKeyword`, que reduz "BLW (Baby-Led Weaning)" para a palavra-
   chave curta "blw" que a planilha usa) vêm primeiro — mas uma receita
   que não cita o método nunca é removida, só reordenada para depois.

Isso mantém a promessa do pedido ("as sugestões devem ser estruturadas
de forma que futuramente possam vir de uma camada de recomendação/IA"):
`getMealSuggestions` tem a mesma assinatura de entrada/saída que uma
função de recomendação mais sofisticada teria — os call sites
(`MealSuggestionCard`, a página) não precisam saber a diferença.

### Fluxo de registro (a UX de "poucos segundos")

```
/quintal (Dashboard)
  ↓ card "Alimentação" → /quintal/alimentacao
/quintal/alimentacao
  ↓ guessMealSlot(hora atual) pré-seleciona a refeição
  ↓ getMealSuggestions({ageMonths, slot, feedingMethodTitle}) → cards
  ↓ (opcional) toque em "Registrar essa refeição" num card
  ↓   → mesma página, mesma URL, com ?slot=X&foods=Y&suggestion=Z#registrar
  ↓     (zero JS — só um <Link>, o formulário lê searchParams no servidor)
  ↓ formulário: refeição, horário (default: agora), alimentos, aceitação
  ↓   (pills CSS via peer/has-[:checked], zero estado de cliente), observação opcional
  ↓ logMeal (server action) → recordMealEvent → INSERT events
  ↓ revalidatePath("/quintal/alimentacao") + revalidatePath("/quintal")
  ↓ redirect com ?success=1 → histórico e Dashboard já refletem o novo registro
```

Nenhum componente de cliente foi criado para nada disso — toda a
interatividade (seleção de aceitação, pré-preenchimento a partir de uma
sugestão) usa formulários nativos, query params e seletores CSS
(`peer`/`has-[:checked]`), o mesmo padrão já estabelecido em
`/quintal/perfil` (Fase 8) para progressive disclosure sem JavaScript.

### `recordMealEvent` — a infraestrutura para o chat pedida nesta fase

O pedido foi explícito: "implemente apenas a infraestrutura necessária
[para integração com o chat], sem tentar criar uma IA complexa de
extração". `recordMealEvent` (`src/lib/feeding.ts`) é o único lugar que
sabe transformar os dados de uma refeição num INSERT válido de `events`
(monta `payload`, decide o fallback de `notes`, grava `origin` e
`source_message_id`). Hoje só é chamado pela action do formulário manual
(`origin: 'manual'`, sem `sourceMessageId`). Uma futura extração
automática a partir do chat (ex.: "ela comeu bem o almoço, arroz e
feijão") seria só mais um chamador — um extrator que resolve `slot`/
`foods`/`acceptance` a partir do texto e chama a mesma função com
`origin: 'chat'` e o `sourceMessageId` da mensagem — sem precisar de
nenhuma mudança de schema ou desta função. Isso é literalmente a
"infraestrutura pronta para o chat", não uma promessa vaga: o choke point
já existe, só falta escrever o extrator (fora do escopo desta fase, por
pedido).

### `ChildContext` (Fase 3) ganhou o método alimentar e refeições mais ricas

Duas mudanças em `src/lib/childContext.ts`, ambas seguindo o padrão já
estabelecido nas Fases 3 e 8 (a IA nunca lê tabelas diretamente, só o
`ChildContext` já formatado):

1. **`ChildContext.child.feedingMethod`** (string | null) — resolvido por
   uma quinta query paralela (join com `knowledge_chunks` pelo
   `feeding_method_id` da criança), incluída em
   `formatChildContextForPrompt` como uma linha "Método alimentar
   escolhido pela família: ...".
2. **`ChildContextEvent.payload`** (novo campo, `Json`) chega junto de
   cada evento de atividade recente; uma nova função `formatMealDetail`
   usa esse `payload` para enriquecer a linha de um evento `meal` no
   prompt com os alimentos e a aceitação reais (ex.: "Almoço: arroz,
   feijão, abóbora, frango — comeu bem"), em vez de só a `notes` livre
   que os outros tipos de evento continuam usando.

Como `suggestReply`/`suggestEvent`/`explainRecommendation` já consomem
`ChildContext` sem conhecer sua forma interna (desde a Fase 3), esse
dado passa a estar disponível para a IA em todas as chamadas existentes
sem tocar em nenhum desses três arquivos — mesmo efeito já obtido pela
Fase 8 para interesses/preferências.

### Arquivos novos e alterados

- **Nova migração**
  `supabase/migrations/20260928124642_add_child_feeding_method.sql` —
  `children.feeding_method_id`/`feeding_method_custom`.
- **Novo `src/lib/validation/feeding.ts`** — `mealSlots`/
  `mealSlotLabels`, `mealAcceptances`/`mealAcceptanceLabels`,
  `mealEventPayloadSchema` (Zod, valida o jsonb de `payload`),
  `mealLogInputSchema` (form-facing, converte `foods` de texto separado
  por vírgula para array), `feedingMethodInputSchema`.
- **Novo `src/lib/feeding.ts`** — `guessMealSlot`, `recordMealEvent`,
  `getMealHistory`, `getFeedingMethodOptions`, `getChildFeedingMethod`,
  `updateChildFeedingMethod`, `getMealSuggestions`. Descrito nas seções
  acima.
- **`src/lib/activity.ts`**: `parseContentFields` deixou de ser privada
  (agora `export`) — reaproveitada por `feeding.ts`, em vez de
  duplicada.
- **`src/lib/childContext.ts`**: `feedingMethod` no `child`, `payload`
  nos eventos de atividade, `formatMealDetail`, linha nova em
  `formatChildContextForPrompt` — ver seção acima.
- **`src/lib/dashboard.ts`**: `DashboardSummary.lastMeal` (mesmo padrão
  de `lastRoutine` já existente).
- **`src/components/dashboard/SummaryCard.tsx`**: ganhou um `href`
  opcional (envolve o conteúdo num `<Link>` quando presente) — usado
  pela primeira vez pelo card de Alimentação, que agora linka para
  `/quintal/alimentacao`; os outros três cards continuam sem link.
- **Novo `src/components/feeding/MealSuggestionCard.tsx`** — mesmo
  estilo visual de `ActivityCard` (Fase 4): `rounded-lg`, `bg-secondary`,
  sem borda.
- **Novo `src/app/quintal/alimentacao/actions.ts`** — `logMeal`,
  `saveFeedingMethod`; mesmo padrão de resolução de sessão e checagem de
  posse (`assertChildInFamily`) já usado em `/quintal/perfil/actions.ts`
  (Fase 8).
- **Novo `src/app/quintal/alimentacao/page.tsx`** — a página em si:
  formulário de registro, sugestões, histórico agrupado por dia,
  seletor de método (progressive disclosure via `<details>`, aberto por
  padrão só quando nenhum método foi configurado ainda).

### Testes realizados (contra o banco real, mesma limitação de rede das fases anteriores)

Sem chamada real ao Groq nesta sessão (rede bloqueada para
`api.groq.com`) — a lógica determinística (o núcleo desta fase) foi
verificada diretamente contra o schema real (`izattwaiqjzhydzhxlns`), em
transações com rollback:

1. **Método alimentar chega ao `ChildContext` corretamente**: setando
   `feeding_method_id = 'MET-002'` numa criança de teste, a query
   réplica de `getChildContext`/`getChildFeedingMethod` resolveu
   `"BLW (Baby-Led Weaning)"` como esperado.
2. **Round-trip de refeição**: inserido um evento `meal` com `payload`
   estruturado (`{slot: "lunch", foods: [...], acceptance:
   "ate_well", ...}`) — a query réplica de `getMealHistory` leu de volta
   `notes` ("Arroz, feijão, abóbora, frango") e `payload->>'acceptance'`
   ("ate_well") corretamente.
3. **`meal` continua incluído em `ACTIVITY_EVENT_TYPES`**: a mesma
   query filtrada pela lista completa (usada tanto pelo prompt da IA
   quanto pela Timeline/contagens do Dashboard) trouxe o evento `meal`
   com seu `payload`, confirmando que Fase 7/8 e Fase 9 continuam
   integradas sem exigir mudança nesses dois consumidores.
4. **`getMealSuggestions` — filtro de idade, refeição e desempate por
   método**: réplica exata da query (idade ≤ 8 meses, refeição =
   "almoço", desempate por "blw") retornou 6 receitas de "Almoço/jantar"
   (ou compatíveis), todas citando BLW nos "Métodos compatíveis" —
   confirmando que o filtro de idade, o filtro de refeição via
   palavra-chave no rótulo, e o desempate por método funcionam como
   `getMealSuggestions` implementa.
5. **`updateChildFeedingMethod` — exclusão mútua**: réplica exata da
   sequência de updates (método listado → limpa custom; custom → limpa
   método listado; método listado de novo → limpa custom de novo) contra
   uma linha fixa de `children` confirmou os três estados esperados em
   sequência — a primeira tentativa usou `select id from children limit
   1` sem `order by` em cada passo, o que (por não ser determinístico
   sem ordenação) acabou testando linhas diferentes a cada UPDATE e
   produziu um resultado aparentemente incoerente; fixar a linha alvo
   numa tabela temporária corrigiu o teste e confirmou o comportamento
   correto do código (o bug era do script de verificação, não de
   `updateChildFeedingMethod`).

### Limitações

- **Sem extração automática de refeições a partir do chat** — só a
  infraestrutura (`recordMealEvent`, `origin`, `payload`) está pronta;
  nenhum extrator foi escrito nesta fase, por pedido explícito.
- **Sugestões são filtro/ordenação determinística, não uma camada de
  recomendação/IA** — por pedido explícito ("não implementar ainda um
  sistema nutricional clínico"). O formato de `MealSuggestion` foi
  desenhado para uma função mais sofisticada assumir o lugar sem exigir
  mudança nos componentes que a consomem — mesmo padrão que
  `recommendActivity` (Fase 5) já validou para `suggestReply`.
- **`offeringMethodId` é uma foto do método no momento do registro**,
  não perguntado de novo a cada refeição — refeições antigas mantêm o
  método vigente quando foram registradas, mesmo que a família mude de
  método depois.
- **Sem chamada real ao Groq nesta sessão** (mesma limitação de rede das
  fases anteriores) — a integração do método alimentar/refeições
  recentes no prompt foi revisada por leitura de código e verificada
  indiretamente (a query que alimenta o prompt foi replicada e retornou
  os valores esperados), mas a resposta final da IA usando esse contexto
  não pôde ser observada de ponta a ponta neste ambiente.
- **Continua assumindo uma criança por família** — mesma simplificação
  já feita pelas demais páginas de `/quintal`.

## Módulo de Sono (Fase 10)

### Objetivo

Até aqui, "Sono" no Dashboard (Fase 7/8) era uma contagem genérica de
`events.type = 'sleep'` — sem tipo (noite vs. soneca), sem início/fim,
sem duração calculada, sem experiência própria. Esta fase constrói essa
experiência sobre exatamente o que já existia, sem nenhuma migração:
`events.type = 'sleep'` já existia desde a Fase 3, `duration_minutes`
desde a Fase 8, `payload` desde a migração original da tabela — o mesmo
trio que a Fase 9 já validou funcionar bem para `meal`.

### Por que nenhuma coluna nova, de novo

`payload` (jsonb) guarda `{sleepType, endedAt}`:

```ts
// src/lib/validation/sleep.ts
type SleepEventPayload = {
  sleepType: "night" | "nap";
  endedAt: string | null;   // null = período ainda em andamento
};
```

`occurred_at` (já existente) grava o **início** do período;
`duration_minutes` (já existente, Fase 8) grava a duração só depois que
o período é fechado — antes disso, fica `null`. Ou seja: início, fim e
duração de um período de sono cabem inteiramente nas colunas que a
tabela `events` já tinha, mais um campo estruturado (`sleepType`) em
`payload`, exatamente como `meal` fez para `slot`/`foods`/`acceptance`
na Fase 9.

A escolha de `endedAt` em vez de derivar "está em andamento" de
`duration_minutes is null` sozinho é deliberada: eventos de sono
**antigos** (Fase 3 a 8, criados manualmente em `/ops/children/[id]`)
também podem ter `duration_minutes` nulo — simplesmente porque a
operadora não preencheu, não porque a criança "ainda está dormindo".
Sem um jeito de distinguir os dois casos, qualquer sono antigo sem
duração viraria, incorretamente, "em andamento" para sempre. Por isso
`getOpenSleepSession` (`src/lib/sleep.ts`) exige as duas condições ao
mesmo tempo — `payload` tem a chave `sleepType` (ou seja: passou por
este módulo) **e** `payload.endedAt` é nulo:

```ts
const { data } = await supabase
  .from("events")
  .select("id, occurred_at, payload")
  .eq("child_id", childId)
  .eq("type", "sleep")
  .not("payload->>sleepType", "is", null)
  .is("payload->>endedAt", null)
  .order("occurred_at", { ascending: false })
  .limit(1)
  .maybeSingle();
```

Verificado diretamente contra o banco real (ver "Testes realizados"
abaixo): um evento de sono legado com `payload = {}` nunca aparece nessa
consulta, mesmo tendo `duration_minutes` nulo — só um período que de
fato passou por `startSleep` (abaixo) e ainda não foi fechado aparece.

### Três operações, três formas de gravar um período

`src/lib/sleep.ts` expõe exatamente três formas de um período de sono
chegar a `events`, cobrindo os dois fluxos pedidos (registro em tempo
real de dois toques, e registro retroativo):

- **`startSleep`** — "Começou a dormir". Um único INSERT com
  `occurred_at` = início, `duration_minutes = null`,
  `payload = {sleepType, endedAt: null}`. É o único jeito de um período
  nascer "em aberto".
- **`endSleep`** — "Acordou". Recebe o `eventId` do período em aberto
  (resolvido por `getOpenSleepSession`, nunca confiado cegamente vindo
  do formulário — a action revalida que o evento existe, pertence à
  criança certa, e é mesmo do tipo `sleep` antes de fechar). Calcula
  `duration_minutes = round((endedAt - occurred_at) / 60000)` e faz um
  UPDATE no mesmo evento — nunca cria uma linha nova. Duração negativa
  (um horário de fim digitado antes do início) é grampeada em zero em
  vez de quebrar o registro; a família ainda pode corrigir o horário
  depois.
- **`recordSleepPeriod`** — registro retroativo. Um único INSERT já
  fechado (início, fim e duração todos gravados de uma vez), nunca passa
  pelo estado "em aberto" — para quando a família esquece de registrar
  em tempo real e quer lançar um período inteiro depois.

A action de início (`startSleepAction`,
`src/app/quintal/sono/actions.ts`) chama `getOpenSleepSession` antes de
chamar `startSleep`, e recusa criar um segundo período se já existe um
em aberto — a UI já esconde os botões de início nesse caso (ver
abaixo), mas a action não confia só nisso.

### UX de "poucos segundos": dois botões, depois um botão

```
/quintal (Dashboard)
  ↓ card "Sono" → /quintal/sono
/quintal/sono, sem período em aberto
  ↓ dois botões grandes: "😴 Começou uma soneca" / "🌙 Começou o sono noturno"
  ↓   (horário = agora, embutido no próprio formulário — um toque)
  ↓ startSleepAction → startSleep → INSERT (em aberto)
/quintal/sono, com período em aberto
  ↓ "Dormindo desde HH:mm — Soneca" + um botão "Acordou"
  ↓   (horário de fim pré-preenchido com agora, editável)
  ↓ endSleepAction → endSleep → UPDATE (duração calculada)
```

Nenhum componente de cliente novo — mesmo padrão já estabelecido em
`/quintal/alimentacao` (Fase 9) e `/quintal/perfil` (Fase 8): formulários
nativos, campos escondidos para os valores que não precisam de decisão
da família (`child_id`, `sleep_type`, `started_at`/`ended_at`
pré-preenchidos com "agora" no momento em que a página renderizou).
Registro retroativo fica num `<details>` recolhido por padrão, com um
formulário completo (tipo, início, fim, observação) — só aparece para
quem precisa dele.

### `ChildContext` (Fase 3) ganhou detalhe de sono

Mesmo padrão de `formatMealDetail` (Fase 9): uma nova
`formatSleepDetail` em `src/lib/childContext.ts` lê `payload` de um
evento `sleep` e, quando ele parseia como um período desta fase, mostra
"Soneca — 1h35" (com `formatDurationMinutes`, novo em `src/lib/format.ts`)
ou "Soneca (em andamento)" em vez de só repetir `notes`. Isso exigiu um
campo novo em `ChildContextEvent` — `durationMinutes` — que as três
queries de `getChildContext` agora selecionam (`duration_minutes`) para
todo evento, não só sono; os outros tipos simplesmente não o usam ainda,
mesmo espírito genérico que `payload` já tinha desde a Fase 9. Como
`suggestReply`/`suggestEvent`/`explainRecommendation` continuam sem
conhecer a forma interna de `ChildContext`, esse detalhe chega à IA sem
tocar em nenhum dos três arquivos.

### Dashboard (Fase 7/8): "2 sonecas · 1h35" e "Dormindo desde HH:mm"

`DashboardSummary` ganhou `napCountToday`, `napTotalMinutesToday` e
`openSleepSession`. Os dois primeiros são calculados a partir do mesmo
array `timeline` que o Dashboard já buscava para os outros cards (uma
única query, filtrada por `ACTIVITY_EVENT_TYPES` + "hoje") — sem round-trip
extra ao banco, só um filtro a mais: evento tipo `sleep`, com
`payload.sleepType === 'nap'` e `duration_minutes` não nulo. Isso
deliberadamente exclui sono noturno (não é "soneca") e eventos antigos
sem payload estruturado (mesma limitação que `meal` teve com eventos
manuais antigos, Fase 9).

`openSleepSession`, ao contrário, **não** vem desse filtro "hoje" — um
sono noturno pode ter começado ontem à noite e ainda estar em andamento
quando a família abre o Dashboard de manhã; filtrar por
`occurred_at >= hoje` o perderia. Por isso é buscado à parte, com
`getOpenSleepSession`, em paralelo às outras duas queries do Dashboard.

O card de Sono mostra `"Dormindo desde HH:mm"` quando existe um período
em aberto (o único "próximo evento relacionado à rotina" para o qual há
dado real — nunca uma previsão inventada de quando a próxima soneca
"deveria" ser) e cai para `"{n} soneca(s) · {duração}"` caso contrário,
mesmo padrão de `formatDurationMinutes` usado na página e no
`ChildContext`.

### `groupByDay`: extraído para `src/lib/format.ts`

A Fase 9 já tinha um `dayLabel`/`groupHistoryByDay` local dentro de
`/quintal/alimentacao/page.tsx`. Com o histórico de sono precisando de
exatamente a mesma lógica de agrupamento (e mais um módulo do roadmap,
Brincadeiras/Rotina, prestes a precisar dela de novo), esta fase moveu
os dois para `src/lib/format.ts` como `dayLabel`/`groupByDay<T>`
(genérico por um `getDate: (entry: T) => string`), e atualizou
`/quintal/alimentacao/page.tsx` para usar a versão compartilhada em vez
da cópia local — sem mudar nenhum comportamento, só removendo a
duplicação assim que ela apareceu pela segunda vez.

### Testes realizados (contra o banco real, mesma limitação de rede das fases anteriores)

Sem chamada real ao Groq nesta sessão — a lógica determinística (o
núcleo desta fase) foi verificada diretamente contra o schema real
(`izattwaiqjzhydzhxlns`), numa transação com rollback:

1. **Filtro de sessão em aberto (`getOpenSleepSession`)**: com um evento
   de sono legado (`payload = {}`, sem `sleepType`) e um período de
   soneca aberto de verdade (`payload.sleepType = 'nap'`,
   `payload.endedAt = null`) inseridos para a mesma criança, a consulta
   réplica exata do filtro (`payload->>'sleepType' is not null and
   payload->>'endedAt' is null`) retornou só o período de verdade — o
   evento legado nunca apareceu, confirmando que as duas condições juntas
   são necessárias e suficientes para não confundir "sem dado" com "em
   andamento".
2. **`endSleep` — cálculo de duração**: fechando o período aberto acima
   (iniciado 40 minutos antes), a réplica do UPDATE gravou
   `duration_minutes = 40` e `payload.endedAt` preenchido — confirma que
   a duração é calculada a partir do `occurred_at` já gravado no início,
   não de um valor novo.
3. **Resumo "hoje" — só sonecas contam**: com três eventos de sono
   inseridos hoje (um sono noturno de 8h, o evento legado sem payload, e
   a soneca de 40min do teste 2), a consulta réplica de
   `getTodaySleepSummary`/Dashboard filtrando por
   `payload.sleepType = 'nap' and duration_minutes is not null` isolou
   corretamente só a soneca de 40 minutos — o sono noturno (480 min) e o
   evento legado (duração nula) ficaram de fora, como esperado.

### Limitações

- **Sem extração automática de sono a partir do chat** — só a
  infraestrutura (`recordSleepPeriod`, `origin`) está pronta; nenhum
  extrator foi escrito nesta fase, por pedido explícito.
- **Períodos que atravessam a meia-noite não são divididos na timeline**
  — um sono noturno das 20h às 7h aparece como uma linha só, agrupado no
  dia em que começou, não como duas linhas (início "ontem", despertar
  "hoje") como o exemplo ilustrativo do briefing sugeria. Simplificação
  deliberada, documentada na própria página.
- **Eventos de sono antigos (Fase 3-8) não entram no resumo rico desta
  fase** — `sleepCount` (contagem genérica, Fase 7) continua incluindo
  qualquer evento `sleep`; `napCountToday`/`napTotalMinutesToday` só
  contam o que passou por `startSleep`/`recordSleepPeriod`.
- **Sem chamada real ao Groq nesta sessão** (mesma limitação de rede das
  fases anteriores) — a integração do detalhe de sono no prompt foi
  revisada por leitura de código e verificada indiretamente (a mesma
  query que alimenta o prompt foi replicada e retornou os valores
  esperados), mas a resposta final da IA usando esse contexto não pôde
  ser observada de ponta a ponta neste ambiente.
- **Continua assumindo uma criança por família** — mesma simplificação
  já feita pelas demais páginas de `/quintal`.

## Módulo de Brincadeiras (Fase 11)

### Objetivo

Diferente de Alimentação (Fase 9) e Sono (Fase 10), que partiram de um
tipo de evento simples e precisaram construir tudo em cima dele,
Brincadeiras herda uma base bem mais larga: `Activity`/`getActivity`
(Fase 4), `ActivityCard`/`/atividades/[id]` (Fase 4), o Recommendation
Engine (`decideActivity`, Fase 5) e o feedback por recomendação (Fase
6) já existiam. O trabalho desta fase foi menos "construir do zero" e
mais "expor essa base como uma experiência navegável própria, com
filtros de verdade e um mecanismo de feedback pessoal que não dependia
de ter vindo de uma recomendação do chat".

### Duas propriedades novas em `Activity`, nenhuma delas uma coluna

Confirmado direto no banco antes de codificar (mesma disciplina de
diagnóstico-antes-de-código da Fase 4): a planilha-fonte de
`brincadeiras`/`materiais` **não tem** um campo de duração — nenhuma
linha, em nenhuma das duas categorias, menciona minutos em lugar
nenhum. E `environment` (o "ambiente: casa/externo/ambos" pedido) não
existe como um enum — só um campo de texto livre "Onde" (só em
`brincadeiras`; `materiais` não tem nada parecido), com valores como
"Casa, parque", "Quintal, banho, varanda", "Qualquer lugar".

Em vez de uma migração (`estimated_minutes` nullable em
`knowledge_chunks`) ou de inventar dado, os dois viraram **parsers
defensivos** sobre o `content` que `parseContentFields` já expõe (Fase
4), no mesmo arquivo que já sabe transformar linhas cruas em `Activity`
(`src/lib/activity.ts`):

```ts
// Nunca preenchido hoje (a planilha não tem "Duração"), mas pronto para
// quando tiver — zero mudança de código nesse dia.
function parseEstimatedMinutes(fields: Map<string, string>): number | null {
  const raw = fields.get("Duração");
  if (!raw) return null;
  const match = raw.match(/\d+/);
  return match ? Number(match[0]) : null;
}

// Heurística de palavras-chave sobre "Onde" — nunca exclui por falta de
// dado: sem o campo (todo "materiais") ou um termo não reconhecido
// ("Escola", "Carro", "Qualquer lugar") caem em "both", o default
// inclusivo.
function classifyEnvironment(fields: Map<string, string>): ActivityEnvironment {
  const onde = fields.get("Onde");
  if (!onde) return "both";
  const normalized = onde.toLowerCase();
  const isOutdoor = OUTDOOR_KEYWORDS.some((k) => normalized.includes(k));
  const isHome = HOME_KEYWORDS.some((k) => normalized.includes(k));
  if (isOutdoor && isHome) return "both";
  if (isOutdoor) return "outdoor";
  if (isHome) return "home";
  return "both";
}
```

Isso significa: hoje, **toda** atividade tem `estimatedMinutes = null`
— o campo existe no tipo `Activity`, é exibido na página quando não
nulo, e o filtro de "tempo disponível" está funcionando de verdade, mas
não tem, ainda, nenhum dado real para filtrar por cima (ver
Limitações). `environment` já tem dado real (derivado de "Onde"), então
o filtro de ambiente já filtra de verdade hoje, com a ressalva de ser
uma heurística sobre texto livre, não um campo estruturado da planilha.

### Registro + feedback: um terceiro mecanismo, não um substituto dos outros dois

O projeto já tinha dois mecanismos de feedback sobre atividades:
`activity_feedback` (Fase 4 — anônimo, "essa atividade ajudou?", sobre
o conteúdo em si) e `activity_recommendation_feedback` (Fase 6 —
`worked`/`did_not_work`/`wants_another`, preso a uma
`activity_recommendation_id` específica, só existe quando a atividade
veio de uma recomendação do chat). Nenhum dos dois serve para "a
família navegou a biblioteca, fez uma atividade que NUNCA foi
recomendada por IA, e quer registrar como foi" — não há
`recommendation_id` nesse caso.

Esta fase resolve isso com um terceiro mecanismo, no mesmo espírito de
`meal`/`sleep`: `events.type = 'free_play'` (já existia desde a Fase 3)
com `payload` estruturado:

```ts
// src/lib/validation/play.ts
type PlayEventPayload = {
  activityId: string;
  activityTitle: string; // gravado junto, não só o id — ver abaixo
  feedback: "loved" | "liked" | "not_interested" | "did_not_do";
};
```

`activityTitle` é gravado junto (não só uma referência a resolver
depois) pelo mesmo motivo que `meal` grava `foods` por extenso em vez
de só uma referência à receita: `formatPlayDetail`
(`src/lib/childContext.ts`) e `getActivityHistory`
(`src/lib/play.ts`) são ambos síncronos/sem N+1 — nenhum dos dois
precisa de uma segunda consulta ao banco para saber o título, só ler o
`payload` que já foi gravado.

`logActivityOutcome` (`src/lib/play.ts`) é o único ponto que grava
isso — chamado hoje só por `/atividades/[id]`'s
`logActivityOutcomeAction`, quando existe sessão de família (a página
continua pública/sem sessão para quem chega de um link direto — só essa
seção some). "Registro" e "Feedback" (pedidos como critérios separados)
chegam juntos num só passo, mesmo raciocínio de `logMeal` (Fase 9)
combinar "o que foi oferecido" e "aceitação" numa única ação em vez de
duas.

### Filtros: cada um só exclui quando tem certeza

`getActivitySuggestions` (`src/lib/play.ts`) é a função única por trás
de "Para hoje" (limit 3) e da "Biblioteca" (limit 200) — só o `limit`
muda, a regra de filtro é a mesma, no mesmo espírito de
`getMealSuggestions` (Fase 9) servir tanto a lista completa quanto um
recorte pequeno.

| Filtro | Regra | Quando não exclui |
|---|---|---|
| Idade | obrigatório, nunca desligável | `ageMonths === null` (idade desconhecida) |
| Ambiente | `activity.environment === filtro` | atividade é `"both"`, ou filtro não foi pedido |
| Tempo disponível | `estimatedMinutes <= maxMinutes` | `estimatedMinutes === null` (não informado) |
| Materiais disponíveis | pelo menos um material da família aparece em `activity.materials` | atividade não lista materiais, ou lista "Nenhum" |
| Interesses | desempate, não filtro duro — se zerar a lista, cai de volta no pool sem esse critério | sempre, por design (nunca é a razão de mostrar zero resultados) |

Isso segue a mesma regra que `decideActivity` (Fase 5) e
`getMealSuggestions` (Fase 9) já estabeleceram: nunca inventar um "não"
a partir da ausência de dado. Um filtro só reduz o pool quando tem
evidência real para reduzir.

### Personalização preparada — o que foi unificado de verdade nesta fase

O pedido era explícito: preparar a arquitetura para uma futura
inferência ("essa criança gosta de atividades com água"), sem
implementar nenhuma regra de aprendizado. O que esta fase entregou, sem
ML nenhum, foi a costura de um sinal já existente:

```
Biblioteca (Fase 11)                     Chat (Fase 5/6)
events.payload                            activity_recommendation_feedback
{feedback: not_interested/did_not_do} ┐   {feedback: did_not_work/wants_another}
                                       │
                                       ▼
                    getActivityIdsToAvoidForNow (recommendation.ts)
                    UNION dos dois conjuntos + recentemente recomendado
                                       │
                                       ▼
                    decideActivity nunca sugere essas atividades
                    de novo tão cedo — de nenhuma das duas origens
```

`recommendation.ts` importa `getRecentNegativeLibraryFeedbackActivityIds`
de `play.ts` (uma única direção de dependência — `play.ts` não importa
nada de `recommendation.ts`, sem ciclo) e passa a unir os dois sinais
dentro de `getActivityIdsToAvoidForNow`, já existente desde a Fase 6.
Isso significa: marcar "não se interessou" numa atividade encontrada na
biblioteca já muda o que o chat recomenda depois — verificado direto no
banco (ver Testes). A volta (o chat influenciar a lista "Para hoje" da
biblioteca) não foi feita — ver Limitações.

O que **não** foi feito, por pedido explícito: nenhuma tabela ou campo
de "preferência inferida" (ex.: `child_preferences.likes_water = true`)
foi criado. A base para uma regra futura ler isso já existe — cada
atividade tem `tags`, `materials`, `environment` estruturados, e cada
feedback é uma linha com `activityId` real — uma regra simples do tipo
"se as últimas N atividades com feedback `loved` têm a tag 'água' em
comum, sugerir mais do tipo água" seria uma função nova em `play.ts`
consultando dado que já existe, sem qualquer mudança de schema.

### Dashboard: fallback determinístico para "Para hoje"

O Dashboard (Fase 7) já tinha uma seção "Para hoje" alimentada só por
`activity_recommendations` (o que o chat recomendou hoje) — uma família
que nunca conversou via chat sempre via o estado vazio. `getDashboardSummary`
(`src/lib/dashboard.ts`) ganhou um `playSuggestion: ActivitySummary |
null`, calculado incondicionalmente (idade + interesses da criança,
mesmos filtros da Brincadeiras, excluindo feedback negativo recente) —
a página decide qual mostrar: recomendações do chat quando existirem,
senão essa sugestão determinística, senão (só se não houver conteúdo
algum para a idade) o estado vazio original com o convite para
conversar.

### Arquivos novos e alterados

- **`src/lib/activity.ts`**: `ActivityEnvironment` (novo tipo),
  `estimatedMinutes`/`environment` em `Activity`,
  `parseEstimatedMinutes`/`classifyEnvironment` (novos, privados),
  `toActivity`/`KnowledgeChunkRow` passaram a ser exportados (reuso por
  `play.ts`, mesmo padrão de `parseContentFields` ter sido exportado na
  Fase 9 para `feeding.ts`).
- **Novo `src/lib/validation/play.ts`** — `activityFeedbackOptions`/
  `activityFeedbackLabels`, `playEventPayloadSchema`,
  `logActivityInputSchema`.
- **Novo `src/lib/play.ts`** — `logActivityOutcome`, `getActivityHistory`,
  `getRecentNegativeLibraryFeedbackActivityIds`, `getActivitySuggestions`,
  `getLibraryActivities`. Descrito nas seções acima.
- **`src/lib/recommendation.ts`**: `getActivityIdsToAvoidForNow` passou a
  unir também `getRecentNegativeLibraryFeedbackActivityIds` (import de
  `play.ts`).
- **`src/lib/childContext.ts`**: `formatPlayDetail` (novo), aplicado a
  eventos `free_play` em `formatEventGroup` — mesmo padrão de
  `formatMealDetail`/`formatSleepDetail`.
- **`src/lib/dashboard.ts`**: `DashboardSummary.lastActivity` (mesmo
  padrão de `lastMeal`/`lastRoutine`) e `.playSuggestion` (novo,
  descrito acima).
- **`src/app/atividades/[id]/actions.ts`**: novo
  `logActivityOutcomeAction` (resolve sessão → família → criança
  primária do zero, nunca confia num `childId` vindo do cliente — mesmo
  padrão de segurança de `requireFamilyId` em `/quintal/*/actions.ts`).
- **Novo `src/app/atividades/[id]/LogActivityOutcome.tsx`** — componente
  de cliente com os quatro botões, mesmo padrão de
  `ActivityFeedback.tsx` (Fase 4, que continua existindo, inalterado, ao
  lado deste).
- **`src/app/atividades/[id]/page.tsx`**: mostra `estimatedMinutes`/
  `environment` perto do título; seção "O que explora" ganhou a nota de
  "não é diagnóstico"; renderiza `LogActivityOutcome` só quando há
  sessão de família.
- **Novo `src/app/quintal/brincadeiras/page.tsx`** — biblioteca +
  filtros (formulário GET, zero JS) + "Para hoje" + histórico. Reaproveita
  `ActivityCard` (Fase 4) sem alteração — `ActivitySummary` não ganhou
  nenhum campo novo, só `Activity` (a forma completa), então o card
  continua exatamente como era.
- **`src/app/quintal/page.tsx`**: card de Brincadeiras ganhou `href` e
  passou a mostrar a última atividade; seção "Para hoje" ganhou o
  fallback para `playSuggestion`.

### Testes realizados (contra o banco real, mesma limitação de rede das fases anteriores)

Sem chamada real ao Groq nesta sessão — verificado direto contra o
schema real (`izattwaiqjzhydzhxlns`), em transação com rollback:

1. **Diagnóstico de conteúdo (antes de codificar)**: confirmado que
   nenhuma linha de `brincadeiras`/`materiais` tem um campo de duração
   no `content`, e que os valores reais de "Onde" (28 valores distintos
   revisados) são texto livre variado ("Casa, parque", "Quintal, banho,
   varanda", "Qualquer lugar") — a base para desenhar `classifyEnvironment`
   como heurística em vez de mapeamento direto.
2. **Round-trip de `free_play`**: inserido um evento com
   `payload = {activityId, activityTitle, feedback: 'loved'}` — leitura
   de volta bateu exatamente, confirmando o formato que
   `getActivityHistory`/`formatPlayDetail` esperam.
3. **Filtro de feedback negativo da biblioteca**: com três eventos
   `free_play` inseridos para a mesma criança (um `loved`, um
   `not_interested`, um evento `free_play` legado sem `payload`
   estruturado), a réplica exata do filtro de
   `getRecentNegativeLibraryFeedbackActivityIds`
   (`payload->>'activityId' is not null and payload->>'feedback' in
   (...)`) isolou corretamente só o `not_interested` — o evento `loved`
   e o legado ficaram de fora, confirmando que o sinal de "evitar por
   enquanto" nunca confunde feedback positivo (ou falta de payload) com
   negativo.
4. **Contagem real do catálogo**: `brincadeiras` (84) + `materiais` (65)
   = 149 linhas — usado para calibrar `LIBRARY_LIMIT` em 200 (folga
   confortável acima do total real, não um número arbitrário).

### Limitações

- **Nenhuma atividade tem duração real** — a planilha-fonte não tem esse
  campo; o filtro de tempo disponível funciona, mas hoje nunca reduz o
  pool por causa disso.
- **`environment` é uma heurística de palavras-chave**, não um dado
  estruturado — pode classificar errado um valor ambíguo não coberto
  pelas palavras-chave conhecidas (cai em "both", nunca em uma exclusão
  errada, mas também nunca filtra um caso que deveria).
- **Biblioteca sem paginação de verdade** — um limite alto (200) em vez
  de páginas; funciona para o catálogo atual (149), não escala
  indefinidamente.
- **Personalização unidirecional**: biblioteca → chat (via
  `getActivityIdsToAvoidForNow`) está feito; chat → biblioteca (as
  recomendações/feedback do chat influenciarem "Para hoje" na
  biblioteca) não foi implementado nesta fase.
- **Nenhuma regra de inferência de preferência foi implementada** (ex.:
  "gosta de atividades com água") — só a base de dados estruturados que
  uma regra futura precisaria (feedback por atividade + tags/materiais/
  ambiente) está pronta, por pedido explícito de não implementar ML
  nesta fase.
- **Sem chamada real ao Groq nesta sessão** (mesma limitação de rede das
  fases anteriores) — a integração do feedback da biblioteca no
  Recommendation Engine foi verificada diretamente contra o banco (item
  3 dos testes); a chamada real que decide uma recomendação de chat não
  pôde ser reproduzida neste ambiente.
- **Continua assumindo uma criança por família** — mesma simplificação
  já feita pelas demais páginas de `/quintal`.
