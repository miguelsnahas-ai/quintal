# Roadmap de produto — Quintal

## Fase 1 — diagnóstico (concluída)

Mapeamento completo do estado existente sem alterar produto
(`docs/CURRENT_STATE.md`), seguido de dois ajustes técnicos de base, sem
integrar WhatsApp:

- **Memória de curto prazo da conversa**: `suggestReply` passou a receber
  as últimas 8 mensagens da conversa, não só a mensagem atual.
- **Registro automático de evento com base em confiança**: a IA agora
  também avalia `isConcreteEvent`; nos canais sem revisão humana
  (Playground/`/test`, e agora `/quintal`), o evento só é gravado quando
  esse sinal é `true`. Na triagem manual da Inbox nada mudou — continua
  exigindo clique do operador.

## Fase 2 — produtizar o `/test` (concluída, este documento)

Objetivo: transformar a experiência de teste existente na primeira
experiência real de produto para uma família, sem redesign, sem sistema de
autenticação completo, sem novas features grandes.

### O que foi entregue

1. **Lógica extraída para componentes/serviços reutilizáveis** antes de
   criar a experiência nova (`ConversationChat`, `ChildHeader`,
   `familySession.ts`) — ver `docs/ARCHITECTURE_TARGET.md` para o desenho
   completo.
2. **`/quintal`**: a experiência real. Sessão resolvida no servidor (não
   na URL), cabeçalho com nome/idade real da criança + contagem real de
   eventos registrados, histórico recente carregado ao abrir a página
   (antes o `/test` sempre começava vazio), conversa usando o mesmo núcleo
   de sempre (`recordConversationTurn`).
3. **`/comecar` virou onboarding real**: nome do responsável → WhatsApp →
   nome da criança → data de nascimento (agora obrigatórios, refletindo
   que a experiência principal depende de ter uma criança) → sessão criada
   → entra direto em `/quintal`.
4. **Modelo de acesso corrigido**: trocar o `caregiverId` na URL não dá
   mais acesso a `/quintal` de outra família — a rota nunca lê
   `caregiverId` do cliente, só da sessão validada no servidor. Detalhe
   completo e limitações assumidas em `docs/ARCHITECTURE_TARGET.md`.
5. **`/test/[caregiverId]` preservado**, sem quebrar, continua sendo a
   ferramenta interna que o operador usa para mandar um link de
   teste/QA a alguém específico — não é mais o "produto", mas não foi
   removido nem teve seu modelo de acesso alterado (fora do escopo desta
   fase, ver justificativa em ARCHITECTURE_TARGET.md).

### Mudanças de banco

- Nova tabela `caregiver_sessions` (token, caregiver_id, created_at), RLS
  ativado sem policies (só `service_role` acessa) —
  `supabase/migrations/20260925120000_create_caregiver_sessions.sql`.
- Nenhuma tabela existente teve coluna alterada.

### Como testar manualmente

1. `npm run build && npm run start`.
2. Abrir `/comecar` — confirmar que os 4 campos são obrigatórios
   (nome, WhatsApp, nome da criança, data de nascimento).
3. Preencher e enviar — deve criar família + cuidador + criança e cair em
   `/quintal` com uma sessão (cookie `quintal_session`, httpOnly — não
   aparece em `document.cookie` no console do navegador).
4. Em `/quintal`: o cabeçalho deve mostrar "Quintal de {nome}" + idade;
   mandar uma mensagem deve gerar resposta e, se a mensagem descrever algo
   concreto (ex. "ela dormiu 40 minutos"), aparecer depois como evento na
   ficha da criança em `/ops/children/[id]`.
5. Fechar e reabrir `/quintal` no mesmo navegador — deve continuar
   logado (sessão) e mostrar o histórico recente da conversa.
6. **Teste de segurança**: copiar o cookie `quintal_session` de uma
   sessão, trocar seu valor por qualquer string aleatória, recarregar
   `/quintal` — deve redirecionar para `/comecar` (token não encontrado
   em `caregiver_sessions`). Também: tentar acessar `/quintal` sem cookie
   nenhum — mesmo redirecionamento.
7. Confirmar que `/ops` (login), `/ops/families`, `/ops/inbox` continuam
   pedindo login normalmente (nada mudou lá).
8. Confirmar que `/test/[id-inválido]` continua devolvendo 404 e que um
   link de teste válido (gerado em `/ops/families/[id]`) ainda abre o chat
   e conversa normalmente.

### Limitações conhecidas desta fase

- Sem integração com WhatsApp real — `/quintal` é só web, exatamente como
  pedido para esta fase.
- Sem forma de "entrar" em `/quintal` de um segundo aparelho — perder o
  cookie (troca de celular, limpar dados) significa ter que fazer
  `/comecar` de novo, criando uma família nova. Autenticação real de
  família (provavelmente via WhatsApp verificado) é uma decisão em
  aberto, registrada em `docs/ARCHITECTURE_TARGET.md`.
- Sessão sem expiração/rotação/logout.
- Cada família tem exatamente uma criança "principal" mostrada em
  `/quintal` (a primeira cadastrada) — se a família tiver mais de uma
  (cadastradas via `/ops`), o seletor existente do `ConversationChat`
  aparece, mas o cabeçalho (`ChildHeader`) sempre mostra a primeira.
  Múltiplas crianças em pé de igualdade na experiência principal fica
  para uma fase futura.
- `/comecar` ainda cria família/cuidador/criança em três inserts
  separados sem transação (mesmo comportamento de antes desta fase) — uma
  falha no meio pode deixar uma família órfã sem criança. Não foi
  corrigido aqui por estar fora do escopo pedido para a Fase 2.

## Fase 3 — ChildContext / memória da criança (concluída)

Objetivo: o Quintal deixar de responder só com base na última mensagem e
passar a considerar o contexto recente da criança — sem arquitetura de
memória complexa, sem embeddings, sem vector database, sem tabelas novas.

### O que foi entregue

1. **`getChildContext(supabase, childId)`** (`src/lib/childContext.ts`) —
   a única porta pela qual `suggestEventFromMessage` e `suggestReply`
   enxergam dados de uma criança. Substitui três cópias quase idênticas
   da mesma lógica ad hoc que existiam em `conversation.ts` e nas duas
   actions da triagem (`suggestEvent`, `suggestReplyDraft`).
2. **Distinção conceitual** entre histórico (mensagens, escopo família),
   memória (dados permanentes da criança + observações/decisões
   recentes), evento (o que aconteceu) e decisão (o que foi decidido) —
   detalhada em `docs/ARCHITECTURE_TARGET.md`.
3. **Limites determinísticos e documentados**: 10 eventos de atividade
   (sono/rotina/livre-brincar/desenvolvimento), 5 observações, 5 decisões,
   8 mensagens de histórico — tudo hardcoded e comentado em código, nada
   configurável ainda.
4. **`suggestReply`/`suggestEventFromMessage` não conhecem mais tabelas**
   — recebem um `ChildContext` já pronto; quem sabe transformar isso em
   texto de prompt é `formatChildContextForPrompt`, não a função de IA.
5. **Isolamento entre crianças da mesma família testado e confirmado**
   (ver "Testes realizados" em `docs/ARCHITECTURE_TARGET.md`).

### Mudanças de banco

Nenhuma. `events` já tinha tudo que era necessário (`type`, `notes`,
`occurred_at`, `child_id`) — esta fase só mudou como o código consulta
essa tabela, não o schema.

### Arquivos principais alterados

- `src/lib/childContext.ts` (novo) — o serviço em si + o formatador de
  prompt.
- `src/lib/conversation.ts` — passou a chamar `getChildContext` em vez de
  buscar eventos/idade diretamente; exporta `RECENT_MESSAGES_LIMIT`.
- `src/lib/groq/suggestReply.ts` e `suggestEvent.ts` — assinatura trocada
  de campos soltos (`childName`, `childAge`, `recentEvents`...) para
  `childContext: ChildContext | null`.
- `src/app/ops/inbox/[messageId]/actions.ts` e `page.tsx` — as duas
  actions de IA da triagem agora usam `getChildContext` também; campos
  hidden `child_name`/`child_age` (que ficaram sem uso) foram removidos
  do formulário.

### Como testar manualmente

Sem framework de testes automatizados no repositório. Verificação feita
diretamente contra o schema real (Supabase `izattwaiqjzhydzhxlns`), numa
transação `begin`/`rollback` — nenhum dado de teste ficou no banco. Os
quatro casos pedidos (criança sem eventos; criança com eventos recentes;
criança com muitos eventos antigos; duas crianças na mesma família sem
contaminação) estão detalhados, com os números exatos obtidos, em
`docs/ARCHITECTURE_TARGET.md` → "ChildContext (Fase 3)" → "Testes
realizados". Para reproduzir localmente com a IA de verdade (não
disponível no sandbox de desenvolvimento, rede bloqueada para
`api.groq.com`): cadastrar uma criança com alguns eventos de tipos
diferentes em `/ops/children/[id]`, depois conversar sobre ela em
`/ops/playground`, `/test/[caregiverId]` ou `/quintal` e confirmar que a
resposta reflete esse histórico.

### Limitações conhecidas desta fase

- **Histórico de mensagens continua por família, não por criança** —
  `messages` não tem coluna `child_id`. Numa família com duas crianças, a
  IA pode ver mensagens sobre a outra criança na seção de "histórico da
  conversa" (que fica fora do `ChildContext`, deliberadamente — ver
  ARCHITECTURE_TARGET.md). Eventos/observações/decisões, por outro lado,
  são 100% isolados por criança.
- **Sem memória permanente explícita** — "memória" nesta fase é só
  observação/decisão recente; não há uma tabela de fatos duráveis (ex.:
  "tem alergia a X") fora do que já existe em `events`/`children.notes`.
- **Limites fixos no código**, não ajustáveis por configuração.
- **Sem teste de ponta a ponta com a IA real** — a montagem do prompt foi
  revisada por leitura de código; a chamada real ao Groq não pôde ser
  reproduzida neste ambiente de desenvolvimento (mesma limitação de rede
  de sempre).

## Fase 4 — conteúdo como experiência de produto (concluída)

Objetivo: uma recomendação da IA deixar de terminar em "você pode
brincar de X" e passar a poder abrir numa página de verdade — sem
reconstruir a biblioteca de conteúdo existente, sem tabela nova para o
conteúdo em si.

### O que foi entregue

1. **`getActivity(id)`** (`src/lib/activity.ts`) — lê as categorias
   `brincadeiras`/`materiais` de `knowledge_chunks` de volta como um
   objeto estruturado, reaproveitando os campos que a planilha de origem
   já tinha (parseados de volta do texto `"Cabeçalho: Valor"` de
   `content`) em vez de recriar a biblioteca ou inventar campos novos.
   Mapeamento completo e diagnóstico do conteúdo em
   `docs/ARCHITECTURE_TARGET.md`.
2. **`/atividades/[id]`** — página pública, com identidade visual mais
   quente que o `/ops` (fundo creme, cantos mais arredondados, sem borda),
   mostrando só as seções que a atividade realmente tem preenchidas.
3. **`ActivityCard`** (`src/components/conversation/ActivityCard.tsx`) —
   componente reutilizável, hoje usado no chat, desenhado para também
   servir numa futura home/lista de recomendações sem alteração.
4. **`suggestReply` estruturado**: de `string` para `{ text, activityId }`
   (Zod), no mesmo padrão `json_object` + validação manual já usado em
   `suggestEvent`. A IA só pode citar um `activityId` que ela mesma
   recebeu como candidato — um valor fora da lista é descartado, nunca
   confiado.
5. **Feedback mínimo**: nova tabela `activity_feedback` (a única tabela
   nova desta fase) + botão "essa atividade ajudou?" na página.

### Mudanças de banco

- `messages.activity_id` (nova coluna, nullable, `references
  knowledge_chunks(id) on delete set null`).
- Nova tabela `activity_feedback` (activity_id, child_id, caregiver_id,
  helpful, created_at) — RLS ligado, leitura para `authenticated`, sem
  policy de escrita (só `service_role`).
- `supabase/migrations/20260924233836_add_activity_reference_and_feedback.sql`.

### Como testar manualmente

1. `npm run build && npm run start`.
2. Pelo `/ops`, verificar que a base tem candidatos reais: uma busca por
   "Ela está entediada, o que posso fazer com ela?" contra
   `search_knowledge_chunks` retorna majoritariamente linhas de
   `brincadeiras` (verificado nesta fase: 5 de 6 resultados para uma
   criança de 14 meses).
3. Conversar em `/quintal` ou `/test/[caregiverId]` dizendo algo como "ela
   está entediada" — se a IA recomendar uma atividade específica, um
   `ActivityCard` aparece logo abaixo da resposta.
4. Clicar no card → abre `/atividades/[id]` com título, faixa etária, por
   que pode ser interessante, materiais, como fazer, desenvolvimento
   relacionado e segurança (quando a linha tiver esse campo).
5. Clicar em "Ajudou"/"Não ajudou" → grava uma linha em
   `activity_feedback`.
6. Acessar `/atividades/<id-de-outra-categoria>` (ex.: um id de
   `alimentos`) → 404, de propósito (essas categorias não viram
   "Activity" nesta fase).

### Limitações conhecidas desta fase

- Histórico recarregado em `/quintal` não re-renderiza o card (o texto
  continua, o card some ao reabrir a conversa) — `activity_id` fica
  gravado em `messages`, só não é reidratado ainda.
- Feedback não é atribuído a família/criança (sempre `null`) — dá pra
  medir "quantas pessoas acharam útil", não "esta família achou útil".
- Só `brincadeiras`/`materiais` viram atividade; as outras 8 categorias
  continuam só como contexto textual nas respostas.
- Sem teste de ponta a ponta com a IA real (rede bloqueada para
  `api.groq.com` no ambiente de desenvolvimento) — busca e parser foram
  verificados direto contra o banco real; a chamada ao Groq que decide o
  `activityId` não pôde ser reproduzida aqui.

## Fase 4.1 — banco de imagens de atividades (concluída)

Não uma fase pedida como bloco fechado — resposta a um pedido pontual: a
usuária começou a montar, à mão, um banco de imagens no Google Drive
(pastas `materiais`/`brincadeiras`, arquivos nomeados pelo id da linha —
`mat-031.png`, `bri-001.png`) e pediu para essas imagens aparecerem na
interface.

### O que foi entregue

1. **`knowledge_chunks.image_url`** (coluna nova, nullable) — o mesmo
   padrão de "coluna mínima, não tabela nova" já usado em
   `messages.activity_id`.
2. **`scripts/knowledge-base/sync_activity_images.py`** — script reutilizável
   que transforma uma lista `filename,fileId` (montada a partir de uma
   busca no Drive) em `UPDATE` SQL, no mesmo espírito do
   `sync_knowledge_base.py` já existente. Necessário porque o banco de
   imagens é pequeno e vai crescer aos poucos — não faz sentido automatizar
   o lado do Drive, só o último passo (gerar e aplicar o SQL) precisa ser
   repetível.
3. **17 imagens sincronizadas** (15 de `materiais`, 2 de `brincadeiras` —
   todas as que existiam no Drive nesta data) via esse script.
4. **`ActivitySummary`/`Activity`** ganharam `imageUrl`. `ActivityCard`
   mostra a foto como avatar circular quando existe (ícone padrão quando
   não); `/atividades/[id]` mostra a foto em destaque no topo da página.

### Por que Google Drive e não Supabase Storage

Arquiteturalmente, Supabase Storage seria o destino consistente com o
resto do projeto (tudo mais passa por Supabase). Não foi usado porque
subir os bytes de uma imagem para o Storage exige uma chamada à API REST
própria do Storage, e o ambiente de desenvolvimento usado nesta sessão
bloqueia chamadas HTTPS diretas para `*.supabase.co` (só as ferramentas
MCP do Supabase, que são só Postgres, passam por essa restrição) — não há
ferramenta MCP que exponha o upload de objetos do Storage. O Google Drive,
por outro lado, é acessível via suas próprias ferramentas MCP, então
`image_url` guarda por enquanto um link do tipo "thumbnail" do Drive
(`https://drive.google.com/thumbnail?id=<fileId>&sz=w1000`), que funciona
para qualquer arquivo compartilhado como "qualquer pessoa com o link" — e
a pasta já está assim.

Isso é uma decisão interina, não definitiva: nada na aplicação sabe que a
URL é do Drive especificamente, ela só consome o que estiver em
`image_url`. Migrar para Supabase Storage no futuro é trocar o valor
gravado nessa coluna, não mudar código de app.

### Como testar manualmente

1. `select id, image_url from knowledge_chunks where image_url is not null`
   deve retornar 17 linhas.
2. Abrir `/atividades/MAT-031` ou `/atividades/BRI-001` → deve mostrar a
   foto no topo da página.
3. Em `/quintal` ou `/test/[caregiverId]`, uma recomendação que caia num
   desses 17 ids mostra a foto como avatar do `ActivityCard`.

### Limitações

- **Não verificado visualmente nesta sessão**: o ambiente de
  desenvolvimento bloqueia acesso de rede a domínios arbitrários (inclusive
  `google.com`), então não foi possível confirmar por aqui que a URL do
  Drive realmente carrega uma imagem num navegador real — só que a URL foi
  montada corretamente a partir do `fileId` certo e que o arquivo tem
  permissão "qualquer pessoa com o link". Vale um clique manual de
  conferência.
- **Link do Drive, não um asset da aplicação**: sujeito à política de
  compartilhamento do Drive e a eventuais limites de uso do endpoint de
  thumbnail do Google — aceitável para 17 imagens num MVP, não é o destino
  final recomendado em produção com volume maior.
- **Sincronização é manual**: cada novo lote de imagens no Drive exige
  rodar o script de novo (listar as pastas, montar o CSV, aplicar o SQL) —
  não há automação de "arquivo novo no Drive → `image_url` atualizado
  sozinho".
- **Sem cobertura de todas as categorias**: só `brincadeiras`/`materiais`
  têm `image_url` (mesmo escopo de "Activity" da Fase 4) — as outras 8
  categorias de `knowledge_chunks` não têm essa coluna populada nem
  interface para exibi-la.

## Fase 5 — primeira recomendação contextual (concluída)

Objetivo: criar o primeiro momento realmente diferencial do Quintal — a
família relata uma situação cotidiana ("a Laura está entediada") e o
Quintal recomenda uma atividade real considerando idade, contexto
recente e o que já foi sugerido antes, explicando de forma natural por
que aquela sugestão faz sentido.

### O que foi entregue

1. **`src/lib/recommendation.ts`** — o Recommendation Engine, serviço
   separado de `suggestReply` (por pedido explícito desta fase). Pipeline
   completo: detecção de intenção → `ChildContext` → busca no
   conhecimento → candidatos → filtro de segurança etária → filtro de
   repetição → decisão → redação (LLM) → registro do histórico. Ver
   `docs/ARCHITECTURE_TARGET.md`, "Recommendation Engine (Fase 5)", para
   o desenho completo e a separação explícita entre DECISÃO (regra
   determinística, sem LLM) e REDAÇÃO (LLM, sem liberdade para escolher
   outra atividade).
2. **`activity_recommendations`** (tabela nova) — histórico mínimo de
   "esta atividade foi recomendada para esta criança, nesta hora",
   escopado por `child_id` (não por família), usado para não repetir uma
   recomendação recente para a mesma criança.
3. **`suggestReply` simplificado** — não escolhe mais atividade; volta a
   ser só a resposta conversacional geral, usada quando o Recommendation
   Engine decide que a mensagem não pede uma recomendação.
4. **UI**: rótulo "Uma ideia para agora" acima do `ActivityCard` quando a
   resposta da conversa trouxer uma atividade recomendada.

### Como testar manualmente

1. Numa conversa em `/quintal` ou `/test/[caregiverId]`, com uma criança
   com idade cadastrada, escrever algo como "ela está entediada" — se
   houver conteúdo etariamente adequado ainda não recomendado
   recentemente, a resposta explica por que aquela atividade pode fazer
   sentido, com o card logo abaixo.
2. Repetir a mesma situação daí a pouco (mesma criança) — a recomendação
   deve, quando houver alternativa etariamente segura, trocar para uma
   atividade diferente das últimas recomendadas.
3. Perguntar algo que não descreve uma situação de "preciso de uma
   atividade" (ex.: um relato de sono) — não deve aparecer card nenhum, a
   conversa segue normal.
4. `select * from activity_recommendations order by created_at desc` deve
   mostrar uma linha nova por atividade de fato recomendada.

### Limitações conhecidas desta fase

- Sem chamada real ao Groq nesta sessão (rede bloqueada para
  `api.groq.com` no ambiente de desenvolvimento) — a lógica
  determinística de decisão (o núcleo desta fase) foi verificada
  diretamente contra o banco real; ver os testes detalhados em
  `docs/ARCHITECTURE_TARGET.md`.
- Sem feedback loop completo (pedido explícito desta fase): não há ainda
  ligação entre `activity_recommendations` e `activity_feedback`.
- Pergunta de esclarecimento ("não há contexto suficiente") é única e
  fixa, não varia por situação.
- Sem tela de operador para visualizar `activity_recommendations`.

## Fase 6 — feedback e aprendizado (concluída)

Objetivo: fechar o loop `contexto → recomendação → experiência →
feedback → próxima recomendação melhor contextualizada`, sem treinar
nenhum modelo — só dado estruturado + regras simples + contexto pro LLM.

### O que foi entregue

1. **`activity_recommendation_feedback`** (tabela nova) — RECOMMENDATION_FEEDBACK,
   deliberadamente separada de RECOMMENDATION (`activity_recommendations`,
   que nunca é sobrescrita): três valores possíveis (`worked`,
   `did_not_work`, `wants_another`) + observação textual opcional.
2. **`activity_recommendations` ganhou dois campos de evento**:
   `source_message_id` (qual mensagem gerou a recomendação) e
   `opened_at` (quando a família de fato abriu a atividade a partir do
   card — "recommendation_opened").
3. **`decideActivity` agora evita, por um tempo, atividades com feedback
   negativo recente** para aquela criança especificamente — não
   permanentemente, e sem nunca inferir "essa criança não gosta disso"
   como fato fixo. Ver `docs/ARCHITECTURE_TARGET.md`, "Feedback e
   aprendizado (Fase 6)", para a regra exata e os testes que a
   comprovam.
4. **UI discreta na conversa**: três botões (Funcionou / Não funcionou /
   Quero outra ideia) + observação opcional, abaixo do `ActivityCard`
   sempre que uma recomendação específica aparece.
5. **`/ops/children/[id]`** ganhou uma seção "Recomendações de
   atividade" — o Concierge vê, para cada recomendação, o título da
   atividade, quando foi feita, se foi aberta, e todo o feedback (com
   observação) recebido.

### Como testar manualmente

1. Numa conversa em `/quintal` ou `/test/[caregiverId]`, receber uma
   recomendação → aparecem os três botões de feedback logo abaixo do
   card.
2. Tocar em "Não funcionou" (com ou sem observação) → substitui os
   botões por um agradecimento; a mesma atividade não deve voltar a ser
   recomendada para essa criança nas próximas sugestões (enquanto o
   feedback estiver dentro da janela recente).
3. Abrir `/ops/children/<id>` de uma criança que já recebeu
   recomendações → seção "Recomendações de atividade" mostra cada uma,
   com badge "aberta" quando o card foi clicado, e o feedback (se
   houver) com sua observação.

### Limitações conhecidas desta fase

- Sem chamada real ao Groq nesta sessão (mesma limitação de rede das
  fases anteriores) — a lógica de decisão (determinística) foi validada
  direto contra o banco.
- Feedback só via os três botões — uma família que digitar "não
  funcionou" na conversa normal não é reconhecida como feedback (sem
  detector de intenção dedicado nesta fase).
- Janelas de repetição/feedback são contagens fixas (5), iguais para
  todas as famílias, não configuráveis.
- `activity_feedback` (Fase 4, avulso) e `activity_recommendation_feedback`
  (Fase 6, ligado a uma recomendação específica) continuam sendo tabelas
  separadas, não unificadas.

## Fase 7 — Dashboard da família (concluída)

Objetivo: o Quintal deixa de ser só uma conversa e ganha uma Home — o
ponto central de entrada, respondendo rápido "como está o dia, o que já
aconteceu, o que vem a seguir, o que o Quintal recomenda". O chat
continua existindo por inteiro, só deixou de ser a única tela.

### O que foi entregue

1. **`/quintal` virou o Dashboard** (era o chat). A conversa se mudou
   para **`/quintal/chat`** — mesmo componente `ConversationChat`, mesmas
   server actions, mesmo comportamento, só num caminho novo. `/comecar`
   continua redirecionando para `/quintal`, então uma família nova já cai
   direto na Home, não mais direto na conversa.
2. **Header do Dashboard** (`DashboardHeader`, novo): nome da criança
   (link para o perfil), data de hoje, idade, e um botão de chat sempre
   visível — nunca mais que um toque de distância.
3. **"Hoje"**: grade de 4 cards compactos (`SummaryCard`, novo) — Sono,
   Alimentação, Brincadeiras, Rotina. Sono/Brincadeiras/Rotina usam
   contagens reais de `events` (tipos `sleep`/`free_play`/`routine`, já
   existentes desde as fases anteriores); Alimentação mostra um estado
   vazio elegante e permanente por enquanto — **não existe tipo de evento
   de alimentação no schema ainda**, então nenhum número foi inventado
   para preenchê-lo.
4. **"Para hoje"**: reaproveita o `ActivityCard` já existente (Fase 4/5)
   para mostrar as recomendações de `activity_recommendations` feitas
   hoje para a criança — zero componente novo de card, só uma lista
   nova que já sabia desenhar.
5. **Timeline de hoje** (`Timeline`, novo): os eventos de hoje
   (sleep/routine/free_play/development, mesmo recorte que `ChildContext`
   já usava) em ordem cronológica, com um estado vazio quando não há
   nada ainda.
6. **`/quintal/perfil`** (novo, mínimo): visão só-leitura dos dados da
   criança/família já existentes em `children`/`families` — existe só
   para o "acesso ao perfil" do header ter um destino real, não é o
   módulo completo de perfil do roadmap maior.

### Como testar manualmente

1. Entrar em `/quintal` (ou se cadastrar em `/comecar`) → cai na Home,
   não na conversa.
2. Sem nenhum evento/recomendação hoje → os 4 cards, a seção "Para hoje"
   e a timeline mostram estados vazios elegantes, nunca números
   inventados.
3. Registrar eventos de hoje (`sleep`, `routine`, `free_play`) via
   `/ops/children/[id]` ou pela própria conversa → os cards e a timeline
   passam a refletir isso na próxima visita ao Dashboard.
4. Tocar no botão de chat do header, ou no botão "Conversar com o
   Quintal" no fim da página → abre `/quintal/chat`, que tem um link "←
   Quintal" de volta para a Home.
5. Tocar no nome da criança no header → abre `/quintal/perfil`.

### Limitações conhecidas desta fase

- **Alimentação não tem dado real algum** — não existe tipo de evento de
  alimentação no schema (`sleep`, `routine`, `free_play`, `development`,
  `observation`, `decision` são os únicos). O card é um placeholder
  honesto até essa etapa ("Alimentação") ser desenvolvida de verdade.
- **Sem duração de sono** — só contagem de sonecas (`sleep` não tem
  campo de início/fim), não "1h42" como no exemplo ilustrativo do
  briefing — inventar uma duração a partir de dado que não existe
  contrariaria a regra de não inventar conteúdo.
- **"Rotina" mostra o último evento do dia, não o "próximo"** — não há
  agenda/rotina programada no schema, só o que já foi registrado.
- **Feedback de recomendação não aparece no Dashboard**, só no chat (onde
  a recomendação foi originada) — deliberado, para manter a Home leve e
  majoritariamente estática.
- **Continua assumindo uma criança por família** (a primeira cadastrada)
  — mesma simplificação já feita pelo chat e por `ChildHeader`; suporte
  real a múltiplas crianças continua um candidato de fase futura.
- Sem teste em navegador real de ponta a ponta (mesma limitação de rede
  das fases anteriores) — a lógica de contagem/timeline foi verificada
  direto contra o banco real; a responsividade foi validada pelas
  classes Tailwind usadas (mobile-first, com breakpoints `sm`/`lg`), não
  visualmente numa tela real.

## Fase 8 — candidatos (não implementados)

Nenhum destes foi tocado ainda. Em ordem sugerida de valor/risco:

1. **Autenticação real de família** (provavelmente via WhatsApp
   verificado) — resolve a limitação de "só funciona neste aparelho" e
   vira a base natural para autenticação também no canal de WhatsApp.
2. **Integração com WhatsApp real** — nova server action fina chamando o
   mesmo `recordConversationTurn`, como desenhado em
   `docs/ARCHITECTURE_TARGET.md`. Decisão de produto pendente: resposta
   100% automática, rascunho com aprovação do operador, ou só para uma
   lista fechada de números-piloto (ver a proposta já dada ao usuário
   antes da Fase 2).
3. **Mensagens vinculadas a uma criança específica** (`child_id` em
   `messages`, ou tabela de junção) — remove a limitação de histórico
   "por família" descrita acima e permite `ChildContext` incluir
   conversa de forma 100% isolada.
4. **Fatos permanentes explícitos da criança** (ex.: alergias,
   preferências) — próximo passo natural de memória, ainda sem
   embeddings. Distinto de propósito do feedback da Fase 6, que é sempre
   temporário/contextual, nunca um fato permanente.
5. **Rehidratar `ActivityCard` no histórico** de `/quintal/chat`, e
   atribuir `activity_feedback`/`activity_recommendations` a
   família/criança de forma mais rica.
6. **Detectar feedback por texto livre na conversa** (ex.: a família
   digita "ela adorou" em vez de tocar no botão) — exigiria um detector
   de intenção dedicado, deliberadamente fora do escopo da Fase 6.
7. **Unificar `activity_feedback` e `activity_recommendation_feedback`**
   numa visão só, para uma eventual tela de analytics mais completa.
8. **Suporte real a múltiplas crianças** na experiência principal, não só
   no seletor.
9. **Transação de verdade na criação de família** (`/comecar`) — a
   verificação de telefone duplicado adicionada em 2026-09-25 já evita a
   causa mais comum de registros órfãos, mas não é uma transação real
   (uma falha em qualquer outro ponto do fluxo ainda pode deixar uma
   família sem cuidador).
10. **Módulos completos de Alimentação, Sono, Brincadeiras, Materiais e
    Rotina** — o Dashboard (Fase 7) já reserva o espaço visual e usa
    dado real onde existe; cada um desses vira seu próprio sistema
    (registro estruturado, não só leitura de `events`) numa fase
    dedicada.
11. **Perfil completo da criança** — `/quintal/perfil` (Fase 7) é
    deliberadamente só-leitura; edição, foto, múltiplas crianças geridas
    ali, etc. ficam para quando o módulo de Perfil for desenvolvido de
    verdade.
