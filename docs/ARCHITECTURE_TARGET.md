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
  histórico recarregado em `/quintal` ainda não re-renderiza o card** a
  partir dela (ver limitações).

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
  é gravado, mas `/quintal`'s hidratação de histórico (`page.tsx`) não
  busca `activity_id` nem re-monta o `ActivitySummary` ao reabrir a
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
  nesta fase (fora de escopo, listado no roadmap).
