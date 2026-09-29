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

## Fase 8 — camada de contexto estruturado (concluída)

Objetivo: o Quintal deixa de depender só do histórico textual da
conversa (e do texto livre em `children.notes`) para saber o que uma
família precisa — família/criança ganham uma camada de dados
estruturados, reutilizável pelo Dashboard, pelo chat e por features
futuras.

### O que foi entregue

1. **`children.interests`** (coluna nova, `text[]`) — interesses
   observados da criança, editável em `/quintal/perfil`.
2. **`family_preferences`** (tabela nova, uma linha por família, criada
   sob demanda) — preferências de alimentação, rotina, brincadeiras,
   materiais e estilo de interação, também editável em `/quintal/perfil`.
3. **`events` ganhou `origin`** (`manual`/`chat`/`system`/`recommendation`)
   e **`duration_minutes`** — prepara o schema para uma futura extração
   automática a partir do chat (ex.: "ela dormiu das 14h às 15h20" virar
   um evento com duração), sem implementar essa extração ainda.
4. **Dois tipos de evento novos**: `meal` (alimentação) e `outing`
   (passeio) — preenchem uma lacuna que o Dashboard da Fase 7 já
   documentava (não existia tipo de evento de alimentação). Os tipos
   existentes NÃO foram renomeados nem removidos.
5. **`getChildContext` (Fase 3) agora inclui interesses e preferências**
   da família no prompt da IA — o chat passa a usar dado estruturado
   real em vez de depender só do histórico da conversa, sem nenhuma
   automação de IA nova.
6. **`/quintal/perfil` (Fase 7) virou editável** — essenciais (nome,
   nascimento, interesses) por criança sempre visíveis, preferências da
   família atrás de um "Configurações avançadas" recolhido por padrão
   (progressive disclosure, sem JavaScript extra — um `<details>` nativo).
7. **Dashboard (Fase 7) atualizado**: o card de Alimentação, que era um
   estado vazio permanente, agora mostra a contagem real de refeições do
   dia.

Ver `docs/ARCHITECTURE_TARGET.md`, "Camada de contexto estruturado (Fase
8)", para o desenho completo, os testes realizados e as limitações.

### Como testar manualmente

1. Abrir `/quintal/perfil` → editar os interesses de uma criança (ex.:
   "carros, música") e salvar → a mensagem de sucesso aparece, e reabrir
   a página mostra o valor salvo.
2. Abrir "Configurações avançadas" → preencher alguma preferência (ex.:
   alimentação) e salvar.
3. Conversar em `/quintal/chat` sobre algo relacionado ao interesse/
   preferência salvo — a resposta da IA passa a ter esse contexto
   disponível (não há como observar isso diretamente sem acesso à IA
   real neste ambiente, mas o dado chega ao prompt — ver testes na
   arquitetura).
4. Registrar um evento tipo "Alimentação" em `/ops/children/[id]` → o
   card de Alimentação em `/quintal` passa a mostrar a contagem real.

### Limitações conhecidas desta fase

- Extração automática de eventos a partir do texto do chat (o exemplo
  "ela dormiu das 14h às 15h20") não foi implementada — só o schema
  (`origin`, `duration_minutes`) está pronto para receber esse dado.
- Feedback por texto livre não vira evento nem preferência
  automaticamente — tudo em `/quintal/perfil` é editado manualmente pela
  família.
- Perfil continua sem edição de cuidadores, foto, ou múltiplas famílias
  — só o essencial de cada criança e as preferências da família.
- Sem teste em navegador real de ponta a ponta (mesma limitação de rede
  das fases anteriores) — lógica de schema/dados verificada direto no
  banco.

## Fase 9 — módulo de Alimentação (concluída)

Objetivo: alimentação deixa de ser só uma contagem de eventos no
Dashboard (Fase 7/8) e vira uma experiência própria — método alimentar
configurável pela família, sugestões de refeição contextualizadas,
registro rápido do que foi oferecido/aceito, e histórico simples. Sem
virar ferramenta de diagnóstico ou prescrição nutricional/médica.

### O que foi entregue

1. **Método alimentar configurável, sem enum hardcoded**:
   `children.feeding_method_id` referencia `knowledge_chunks` (categoria
   `metodos_alimentacao`, 5 linhas já existentes: Tradicional, BLW,
   BLISS, Participativa/mista, Alimentação responsiva) — o mesmo padrão
   de "conteúdo como referência" já usado para `brincadeiras`/`materiais`
   na Fase 4. Um método novo no futuro é uma linha de conteúdo, não uma
   migração. `children.feeding_method_custom` cobre "outro/personalizado"
   quando nenhuma opção listada serve — os dois campos são mutuamente
   exclusivos (escolher um limpa o outro). Nenhuma abordagem aparece como
   recomendada ou padrão; a escolha é sempre da família.
2. **Refeições estruturadas sem tabela nova**: reaproveita
   `events.type = 'meal'` (já existia desde a Fase 8) +
   `events.payload` jsonb (reservado desde a migração original para
   "quando houver evidência real do que gravar" — esta fase é essa
   evidência), guardando `{slot, foods, acceptance, offeringMethodId,
   suggestionId}`. `slot` cobre café da manhã, lanche da manhã, almoço,
   lanche da tarde, jantar e outros; `acceptance` cobre comeu
   bem/comeu um pouco/recusou/não informado.
3. **Sugestões de refeição a partir de conteúdo já existente**: lidas da
   categoria `receitas` de `knowledge_chunks` (60 linhas, já tinham os
   campos "Refeição", "Ingredientes", "Modo de preparo", "Métodos
   compatíveis", "Observação" prontos) — nenhum conteúdo novo escrito.
   `getMealSuggestions` filtra por idade (obrigatório) e por refeição do
   dia, e ordena priorizando receitas que citam o método da família no
   texto — regra simples e auditável, sem scoring, no mesmo espírito de
   `decideActivity` (Fase 5). Estruturada para uma futura camada de
   recomendação/IA assumir o lugar da função sem mudar o formato nem os
   call sites — mesma forma que `recommendActivity` assumiu de
   `suggestReply` na Fase 5.
4. **Registro rápido**: formulário único em `/quintal/alimentacao`
   (refeição pré-selecionada pelo horário do dia via `guessMealSlot`,
   horário já preenchido com agora, alimentos em texto livre, aceitação
   como pills de seleção única via CSS `peer`/`has-[:checked]` — zero
   JavaScript de cliente —, observação opcional). Um toque em "Registrar
   essa refeição" num card de sugestão pré-preenche refeição e alimentos
   via query params.
5. **Histórico simples**: lista cronológica agrupada por dia
   ("Hoje"/"Ontem"/data), no formato pedido ("Refeição — alimentos").
6. **Infraestrutura para o chat, sem extração de IA nesta fase**:
   `recordMealEvent` (`src/lib/feeding.ts`) é o único ponto que sabe
   transformar uma refeição em uma linha válida de `events` — hoje só é
   chamado pelo formulário manual (`origin: 'manual'`), mas uma futura
   extração automática do chat é só mais um chamador passando `origin:
   'chat'` e `sourceMessageId`, sem mudança de schema ou de lógica —
   exatamente o pedido de preparar a arquitetura sem construir o
   extrator.
7. **`ChildContext` (Fase 3) passou a incluir o método alimentar da
   família** e um resumo mais rico de refeições recentes (alimentos +
   aceitação, não só a nota livre) — a IA de conversa passa a saber, sem
   nenhum código novo em `suggestReply`/`suggestEvent`, qual método a
   família escolheu e o que a criança comeu recentemente.
8. **Dashboard (Fase 7/8)**: o card de Alimentação agora linka para
   `/quintal/alimentacao` e mostra a contagem do dia + a última refeição.
9. **Avisos de segurança**: a página deixa explícito que as sugestões são
   gerais, não uma prescrição, e que dúvidas específicas valem uma
   conversa com pediatra/nutricionista — tanto perto das sugestões quanto
   perto do seletor de método.

Ver `docs/ARCHITECTURE_TARGET.md`, "Módulo de Alimentação (Fase 9)", para
o desenho completo e os testes realizados.

### Como testar manualmente

1. `npm run build && npm run start`.
2. Abrir `/quintal` → o card de Alimentação deve linkar para
   `/quintal/alimentacao`.
3. Em `/quintal/alimentacao`, abrir "Método alimentar" (aberto por padrão
   se a família ainda não configurou nada) → escolher uma opção listada
   (ex.: BLW) e salvar → reabrir a página deve mostrar esse método
   escolhido; trocar para "Outro/personalizado" com um texto próprio deve
   substituir a opção listada (e vice-versa).
4. Ver a seção "Sugestões" mudar conforme a refeição selecionada no
   formulário (ex.: almoço vs. lanche) e, quando um método estiver
   configurado, priorizar receitas compatíveis com ele.
5. Tocar em "Registrar essa refeição" num card de sugestão → o
   formulário de registro deve vir pré-preenchido com a refeição e os
   alimentos daquela sugestão.
6. Preencher e enviar o formulário de registro → mensagem de sucesso,
   nova entrada aparece no topo do "Histórico" agrupada em "Hoje", e o
   card de Alimentação em `/quintal` reflete a contagem/última refeição
   atualizadas.
7. Conversar em `/quintal/chat` sobre alimentação — o prompt da IA passa
   a ter o método escolhido e as refeições recentes disponíveis (não há
   como observar isso diretamente sem a IA real neste ambiente, mas o
   dado chega ao prompt — ver testes em ARCHITECTURE_TARGET.md).

### Limitações conhecidas desta fase

- **Sem extração automática de refeições a partir do chat** — só a
  infraestrutura (`recordMealEvent`, `origin`) está pronta para receber
  isso; a mensagem "ela comeu bem no almoço" ainda não vira um registro
  sozinha.
- **Sugestões são regra simples de filtro/ordenação, não uma camada de
  recomendação/IA** — por pedido explícito desta fase ("não implementar
  ainda um sistema nutricional clínico"); o formato de `MealSuggestion`
  foi desenhado para uma recomendação mais sofisticada assumir o lugar
  no futuro sem mudar os componentes que a consomem.
- **`offeringMethodId` de uma refeição é uma foto do método configurado
  no momento do registro**, não perguntado de novo a cada refeição —
  se a família mudar de método depois, refeições antigas continuam
  guardando o método vigente quando foram registradas.
- **Continua assumindo uma criança por família** (a primeira cadastrada)
  — mesma simplificação já feita pelas demais páginas de `/quintal`.
- Sem teste em navegador real de ponta a ponta (mesma limitação de rede
  das fases anteriores) — lógica de schema/filtro/ordenação e o
  round-trip de `payload` verificados direto contra o banco real, em
  transações com rollback.

## Fase 10 — módulo de Sono (concluída)

Objetivo: sono deixa de ser só uma contagem genérica de eventos no
Dashboard (Fase 7/8) e vira um registro simples da rotina — início/fim,
duração calculada sozinha, tipo (noite/soneca), timeline do dia e
histórico. Sem virar ferramenta médica ou de diagnóstico.

### O que foi entregue

1. **Sem migração**: `events.type = 'sleep'` já existia desde a Fase 3,
   `events.duration_minutes` desde a Fase 8, `events.payload` desde a
   migração original. Esta fase só passou a usar os três juntos, mesmo
   padrão que a Fase 9 já validou para `meal` — nenhuma tabela ou coluna
   nova.
2. **Tipo (noite/soneca) sem coluna própria**: guardado em
   `events.payload` (`{sleepType, endedAt}`), a mesma ideia de "campo
   estruturado por tipo" que `meal` já usa. `endedAt` é o que diferencia
   um período já fechado de um ainda em andamento.
3. **"Começou a dormir" / "Acordou" em um toque cada**: dois botões
   grandes (Soneca / Sono noturno) gravam só o início
   (`duration_minutes` fica `null`); com um período em aberto, os botões
   somem e dão lugar a um único "Acordou", que calcula a duração
   automaticamente a partir do horário de início já gravado. Nenhum dos
   dois pede mais do que um horário (pré-preenchido com agora, editável)
   e uma observação opcional.
4. **Registro retroativo**: formulário recolhido por padrão (início, fim,
   tipo, observação) para quando a família esquece de registrar em tempo
   real — grava um período já fechado de uma vez, nunca passa pelo
   estado "em aberto".
5. **Nunca dois períodos em aberto ao mesmo tempo**: a action de início
   verifica se já existe um sono em andamento antes de criar outro, e
   pede para encerrar o atual primeiro.
6. **Timeline e histórico**: histórico cronológico agrupado por dia
   (Hoje/Ontem/data), cada período como "HH:mm–HH:mm — Soneca" (ou só o
   horário de início + "em andamento" para um período ainda aberto).
7. **Resumo**: quantidade de sonecas hoje, duração total das sonecas
   hoje, e o último período registrado hoje — sem nenhuma interpretação
   além de somar/contar o que foi de fato registrado.
8. **`ChildContext` (Fase 3) passou a mostrar sono com mais detalhe**: um
   evento de sono no prompt da IA agora diz "Soneca — 1h35" (ou "em
   andamento") em vez de só repetir `notes`.
9. **Dashboard (Fase 7/8)**: o card de Sono agora linka para
   `/quintal/sono` e mostra "2 sonecas · 1h35"; enquanto a criança está
   dormindo, mostra "Dormindo desde HH:mm" em vez da contagem — o único
   "próximo evento relacionado à rotina" para o qual existe dado real,
   sem prever nada que não tenha acontecido.
10. **Infraestrutura para o chat, sem NLP nesta fase**: `startSleep`,
    `endSleep` e `recordSleepPeriod` (`src/lib/sleep.ts`) são os únicos
    pontos que sabem gravar um período de sono — hoje só chamados pelo
    formulário manual (`origin: 'manual'`); uma futura extração de "Ela
    dormiu das 13:40 às 15:05" seria só mais um chamador de
    `recordSleepPeriod` com `origin: 'chat'`, sem mudança de schema.
11. **Avisos de segurança**: a página deixa explícito que é um registro
    simples da rotina, não uma ferramenta médica, e que mudanças bruscas
    valem uma conversa com o pediatra.

Ver `docs/ARCHITECTURE_TARGET.md`, "Módulo de Sono (Fase 10)", para o
desenho completo e os testes realizados.

### Como testar manualmente

1. `npm run build && npm run start`.
2. Abrir `/quintal` → o card de Sono deve linkar para `/quintal/sono`.
3. Em `/quintal/sono`, tocar em "Começou uma soneca" → o card muda para
   "Dormindo desde HH:mm — Soneca" com um botão "Acordou"; tentar abrir
   outro início nesse meio tempo não deve ser possível (o botão some).
4. Tocar em "Acordou" → volta a mostrar os dois botões de início; o
   período aparece no Histórico como "HH:mm–HH:mm — Soneca" e a duração
   bate com o intervalo real.
5. Abrir "Registro retroativo" e lançar um período completo (ex.: sono
   noturno de ontem à noite) → aparece no histórico agrupado no dia
   correto, com a duração calculada automaticamente.
6. Ver a seção "Resumo de hoje" refletir a quantidade e duração total das
   sonecas registradas, e o card de Sono em `/quintal` mostrar o mesmo
   resumo (ou "Dormindo desde HH:mm" se houver um período em aberto).
7. Conversar em `/quintal/chat` sobre o sono — o prompt da IA passa a ter
   o tipo e a duração dos períodos recentes disponíveis (não há como
   observar isso diretamente sem a IA real neste ambiente, mas o dado
   chega ao prompt — ver testes em ARCHITECTURE_TARGET.md).

### Limitações conhecidas desta fase

- **Sem extração automática de sono a partir do chat** — só a
  infraestrutura (`recordSleepPeriod`, `origin`) está pronta; a mensagem
  "ela dormiu das 13:40 às 15:05" ainda não vira um registro sozinha.
- **Períodos que atravessam a meia-noite aparecem inteiros no dia em que
  começaram** — a timeline não divide um sono noturno em duas linhas
  (uma para o início "ontem", outra para o despertar "hoje") como o
  exemplo ilustrativo do briefing sugeria; documentado na própria página,
  simplificação deliberada em vez de lógica adicional para um caso de
  exibição.
- **Eventos de sono antigos (Fase 3-8, sem payload estruturado) não
  entram na contagem de sonecas/duração** — só `sleepCount` (contagem
  genérica, já existia) os inclui; o resumo rico desta fase (napCount,
  napTotalMinutes) só conta o que passou pelo novo fluxo. Mesma
  limitação que meal teve com eventos antigos de `/ops` na Fase 9.
- **Continua assumindo uma criança por família** (a primeira cadastrada)
  — mesma simplificação já feita pelas demais páginas de `/quintal`.
- Sem teste em navegador real de ponta a ponta (mesma limitação de rede
  das fases anteriores) — lógica de payload/duração/filtro de sessão em
  aberto verificada direto contra o banco real, em transações com
  rollback.

## Fase 11 — módulo de Brincadeiras (concluída)

Objetivo: ajudar a família a descobrir atividades simples e adequadas ao
contexto da criança — biblioteca navegável, filtros, "Para hoje",
registro + feedback, e arquitetura pronta para uma futura personalização
por regras. Reaproveitando ao máximo o que as Fases 4/5/6 já construíram
para "Activity" em vez de recomeçar.

### O que foi entregue

1. **Sem nenhuma migração**: `events.type = 'free_play'` já existia
   desde a Fase 3, `events.payload` desde a migração original,
   `Activity`/`getActivity`/`ActivityCard`/`/atividades/[id]` desde a
   Fase 4, o Recommendation Engine (`decideActivity`,
   `activity_recommendations`) desde as Fases 5/6. Esta fase estende
   tudo isso em vez de recriar — nenhuma tabela ou coluna nova.
2. **Duas propriedades novas em `Activity`, nenhuma como coluna**:
   `estimatedMinutes` (parseada defensivamente de um campo "Duração" que
   a planilha-fonte atual simplesmente não tem — confirmado direto no
   banco; fica `null` para as 149 atividades existentes, sem inventar
   número nenhum, mas pronta para preencher sozinha se o conteúdo for
   enriquecido no futuro) e `environment` (casa/externo/ambos, uma
   heurística de palavras-chave sobre o campo "Onde" já existente para
   brincadeiras — "ambos" é o default inclusivo sempre que não há como
   saber, nunca usado para excluir por falta de dado).
3. **Registro + feedback num só passo**: `events.type='free_play'` com
   `payload = {activityId, activityTitle, feedback}`, onde `feedback` é
   uma das quatro opções pedidas — Adorou/Gostou/Não se
   interessou/Não fizemos — um terceiro mecanismo de feedback, distinto
   de `activity_feedback` (Fase 4, anônimo, sobre o conteúdo) e
   `activity_recommendation_feedback` (Fase 6, preso a uma recomendação
   específica do chat). Fica em `/atividades/[id]`, visível só para quem
   tem sessão de família (a página continua pública para quem chega de
   um link direto).
4. **Filtros reais, não só declarados**: idade (automática, sempre
   aplicada, nunca desligável — mesma regra de segurança de
   `decideActivity`), interesses (compara com título/"por que
   interessante"/tags), ambiente, tempo disponível e materiais
   disponíveis — cada filtro só exclui quando tem certeza; falta de
   dado (duração não informada, sem lista de materiais) nunca exclui por
   engano.
5. **"Para hoje" na própria página de Brincadeiras**: um punhado curado
   (3) usando os mesmos filtros, priorizado sobre a "Biblioteca"
   completa (até 200 resultados, sem paginação nesta fase) — as duas
   são a mesma função de filtro, só o limite muda.
6. **Histórico**: cronológico, agrupado por dia, "HH:mm — Atividade ·
   Feedback".
7. **Dashboard integrado**: o card de Brincadeiras agora linka para
   `/quintal/brincadeiras` e mostra a última atividade; a seção "Para
   hoje" do Dashboard, que já existia (Fase 7, alimentada só por
   recomendações do chat), ganhou um fallback determinístico — sem
   recomendação do chat hoje, mostra uma sugestão real vinda dos mesmos
   filtros de idade/interesses da Brincadeiras, em vez de um estado
   vazio.
8. **Personalização preparada, não implementada**: feedback negativo
   registrado na biblioteca (`não se interessou`/`não fizemos`) agora
   também entra no "evitar por enquanto" do Recommendation Engine do
   chat (`getActivityIdsToAvoidForNow`, Fase 5/6) — as duas superfícies
   (biblioteca e chat) passam a compartilhar um sinal, sem nenhum
   machine learning, só um `UNION` de conjuntos já existente. Nenhuma
   inferência de preferência permanente ("gosta de água") foi
   implementada — a estrutura de dados para uma regra futura ler isso já
   existe (ver "Personalização" em ARCHITECTURE_TARGET.md).
9. **"Habilidades" nunca tratadas como diagnóstico**: a seção "O que
   explora" em `/atividades/[id]` ganhou uma nota explícita — "áreas
   exploradas de forma geral, não uma avaliação ou diagnóstico de
   desenvolvimento".

Ver `docs/ARCHITECTURE_TARGET.md`, "Módulo de Brincadeiras (Fase 11)",
para o desenho completo e os testes realizados.

### Como testar manualmente

1. `npm run build && npm run start`.
2. Abrir `/quintal` → o card de Brincadeiras deve linkar para
   `/quintal/brincadeiras`; a seção "Para hoje" deve mostrar uma
   atividade mesmo sem nunca ter conversado com o chat (fallback
   determinístico).
3. Em `/quintal/brincadeiras`, ajustar os filtros (ambiente, tempo,
   materiais, interesses) e confirmar que "Para hoje" e "Biblioteca"
   mudam de acordo.
4. Abrir uma atividade a partir de um card → `/atividades/[id]` mostra
   duração estimada (quando houver) e ambiente, além dos campos já
   existentes; a seção "O que explora" mostra a nota sobre não ser
   diagnóstico.
5. Tocar em uma das quatro opções de "Fizeram essa atividade? Como
   foi?" → mensagem de confirmação; a atividade aparece no Histórico de
   `/quintal/brincadeiras` agrupada em "Hoje".
6. Marcar "Não se interessou" ou "Não fizemos" numa atividade, depois
   conversar em `/quintal/chat` pedindo uma sugestão parecida — essa
   atividade deve ficar de fora das próximas recomendações do chat por
   um tempo (não há como observar isso diretamente sem a IA real neste
   ambiente, mas a exclusão foi verificada direto no banco — ver testes
   em ARCHITECTURE_TARGET.md).

### Limitações conhecidas desta fase

- **Sem duração real em nenhuma atividade** — a planilha-fonte não tem
  esse campo; o filtro "tempo disponível" está pronto e funcionando, mas
  hoje nunca exclui nada por duração (todas as 149 atividades têm
  `estimatedMinutes = null`). Populações futuras de conteúdo passam a
  funcionar sem mudança de código.
- **Classificação de ambiente é uma heurística de palavras-chave sobre
  texto livre**, não um dado estruturado da planilha — pode classificar
  errado um caso ambíguo (ex.: "Escola", "Carro", que caem em "ambos"
  por não bater com nenhuma palavra-chave conhecida).
- **Biblioteca sem paginação de verdade** — mostra até 200 resultados
  (folga acima do total atual de 149), suficiente para o conteúdo de
  hoje, mas não escala indefinidamente.
- **Personalização unidirecional**: feedback da biblioteca já influencia
  recomendações do chat; o inverso (recomendações/feedback do chat
  influenciarem a lista "Para hoje" da biblioteca) ainda não foi feito —
  ver candidato correspondente abaixo.
- **Nenhuma regra de "aprendizado" foi implementada** (ex.: "essa
  criança gosta de atividades com água") — só a infraestrutura de dados
  (feedback estruturado por atividade, com tags/materiais/ambiente já
  modelados) está pronta para uma regra futura consumir, por pedido
  explícito desta fase.
- Sem teste em navegador real de ponta a ponta (mesma limitação de rede
  das fases anteriores) — lógica de filtro/payload/exclusão verificada
  direto contra o banco real, em transações com rollback.

## Fase 12 — biblioteca de Materiais (concluída)

Objetivo: dar à família um lugar para encontrar conteúdos/recursos
(artigos, guias, receitas, atividades...) relevantes ao contexto da
criança — navegável, buscável, filtrável, com uma seção "Recomendados
para vocês" por regras simples e transparentes. Sem parecer um catálogo
infinito.

### O que foi entregue

1. **Sem nenhuma migração, sem tabela de conteúdo nova**: os tipos
   pedidos ("receita", "atividade") e as categorias pedidas
   ("alimentação", "sono", "brincadeiras"...) batiam de forma quase
   exata com categorias que `knowledge_chunks` já tinha
   (`receitas`, `brincadeiras`/`materiais`, `metodos_alimentacao`...).
   Em vez de uma nova tabela de conteúdo, esta fase é um mapeamento das
   **10 categorias existentes (531 linhas)** para um vocabulário único
   de tipo/categoria — a mesma base que já alimentava `Activity` (Fase
   4) e as sugestões de refeição (Fase 9), agora vista por uma lente
   mais ampla.
2. **8 tipos de material suportados**, confirmados contra o banco antes
   de codificar: hoje só 4 (`atividade`, `referência`, `receita`,
   `guia`) têm conteúdo real atrás; `artigo`/`vídeo`/`livro`/`checklist`
   estão no vocabulário, prontos para quando existir conteúdo desses
   tipos, sem inventar nenhum.
3. **6 categorias pedidas** (alimentação, sono, brincadeiras,
   desenvolvimento, rotina, parentalidade) — 5 têm conteúdo real hoje;
   "parentalidade" fica vazia (nenhuma das 10 categorias de
   `knowledge_chunks` cobre esse tema), documentado honestamente em vez
   de forçar um mapeamento que não existe.
4. **Materiais de `brincadeiras`/`materiais` reaproveitam `/atividades/[id]`**
   (Fase 4/11) em vez de ganhar uma segunda página de detalhe — a
   biblioteca de Materiais é uma lente mais ampla sobre o mesmo
   conteúdo, não uma cópia dele. As outras 8 categorias ganharam
   `/materiais/[id]`, novo, genérico.
5. **Busca reaproveita a função RAG já existente**
   (`search_knowledge_chunks`, usada desde as fases iniciais para o
   chat) — nenhuma segunda implementação de busca.
6. **Filtros por categoria e tipo**, além da idade (automática,
   obrigatória).
7. **"Recomendados para vocês"**: regras simples e auditáveis (idade,
   interesses, método alimentar configurado, e o que a família registrou
   nos últimos 3 dias — "histórico de atividades"/"contexto atual") —
   cada material recomendado vem com um **motivo** (ex.: "Vocês
   registraram sono recentemente", "Combina com o método alimentar de
   vocês (BLW)"). Sem idade conhecida, sem recomendação nenhuma — mesma
   regra de segurança do Recommendation Engine (Fase 5).
8. **Princípio de "não parecer catálogo infinito" aplicado de verdade**:
   sem busca nem filtro, a página mostra só "Recomendados" (até 4) e
   atalhos de categoria — nunca as 531 linhas de uma vez. Mesmo
   filtrando por categoria, o resultado é limitado (12) em vez de
   despejar tudo (`alimentos` sozinha tem 176 linhas).
9. **Dashboard integrado**: nova seção "Materiais para vocês" (até 2),
   só aparece com idade conhecida — "quando houver contexto suficiente",
   como pedido.

Ver `docs/ARCHITECTURE_TARGET.md`, "Biblioteca de Materiais (Fase 12)",
para o desenho completo e os testes realizados.

### Como testar manualmente

1. `npm run build && npm run start`.
2. Abrir `/quintal` → se a criança tiver idade cadastrada, a seção
   "Materiais para vocês" aparece com até 2 sugestões e um link para a
   biblioteca completa.
3. Abrir `/quintal/materiais` → sem digitar nada, a página mostra
   "Recomendados para vocês" (poucos, com motivo) e os atalhos de
   categoria — nunca uma lista longa.
4. Buscar por um tema (ex.: "sono", "papinha") → resultados vêm de
   categorias diferentes (confirmado: uma busca por problema de sono
   retorna linhas de `formas_de_dormir`/`rotinas_sono`).
5. Filtrar por categoria/tipo → lista curta (até 12), sempre respeitando
   a idade da criança.
6. Abrir um material de alimentos/sono/desenvolvimento/higiene/passeios
   → `/materiais/[id]` mostra resumo + todos os campos reais da linha;
   abrir um material de brincadeiras → redireciona para
   `/atividades/[id]` (a página que já existia).

### Limitações conhecidas desta fase

- **4 dos 8 tipos pedidos não têm conteúdo real** (`artigo`, `vídeo`,
  `livro`, `checklist`) — o vocabulário suporta, o conteúdo da base de
  conhecimento atual não cobre nenhum desses formatos.
- **Categoria "parentalidade" está sempre vazia** — nenhuma das 10
  categorias de `knowledge_chunks` cobre esse tema hoje.
- **URL externa nunca é usada** — todo material é conteúdo próprio
  (texto já na base), "URL ou conteúdo" dos metadados pedidos sempre
  resolve para "conteúdo" nesta fase.
- **Biblioteca sem paginação de verdade** (mesma limitação já assumida
  na Fase 11) — filtrar por categoria mostra até 12 resultados, não
  todos; a busca é o caminho para achar algo específico numa categoria
  grande.
- **Recomendação é regra simples, não IA** — por pedido explícito;
  `getRecommendedMaterials` foi desenhada para uma curadoria/IA futura
  assumir só o "motivo" (a explicação) sem mudar a decisão nem o formato
  de saída, mesma separação DECISÃO/REDAÇÃO já validada pelo
  Recommendation Engine (Fase 5).
- Sem teste em navegador real de ponta a ponta (mesma limitação de rede
  das fases anteriores) — mapeamento de categorias, busca e sinais de
  recomendação verificados direto contra o banco real.

## Fase 13 — Timeline central (concluída)

Objetivo: consolidar os eventos de todos os módulos (Sono, Alimentação,
Brincadeiras, e os tipos já existentes mas sem módulo próprio — Rotina,
Desenvolvimento, Passeio, Observação) numa única lista cronológica,
filtrável, com edição e exclusão — a primeira vez que o produto oferece
essas duas últimas para a família. Objetivo de UX explícito: parecer
"o Quintal está acompanhando o dia", nunca um sistema burocrático de
registro.

### O que foi entregue

1. **Sem nenhuma migração**: tudo já vivia em `events` — a novidade
   desta fase é a leitura/formatação unificada e, pela primeira vez,
   `UPDATE`/`DELETE` nessa tabela pelo lado da família (até aqui, só
   `INSERT`).
2. **`/quintal/timeline`**: um dia por vez (navegação ← Hoje/Ontem/data
   →), com os quatro filtros pedidos (Sono/Alimentação/
   Brincadeiras/Rotina) mais "Todos" — "Brincadeiras" também cobre
   Passeio, e "Rotina" vira o balde para Rotina + Desenvolvimento +
   Observação, já que só 5 opções foram pedidas para 7 tipos reais.
3. **Formatação rica e específica por tipo**, reaproveitando os
   payloads estruturados já existentes (Fase 9/10/11): "Café da
   manhã"/"Almoço" em vez do genérico "Refeição" (lê o `slot`),
   "Soneca"/"Sono noturno" com a duração como detalhe, "Brincadeira"
   com o nome da atividade e o feedback como duas linhas — o mesmo
   formato ilustrado no pedido desta fase.
4. **"Acordou" como linha própria**: um sono noturno que atravessa a
   meia-noite agora aparece como duas coisas — o período em si (com a
   duração), no dia em que começou, e uma linha "Acordou" no horário
   real do despertar, no dia em que a criança de fato acordou. Isso
   resolve uma limitação documentada desde a Fase 10 ("períodos que
   atravessam a meia-noite aparecem inteiros, não divididos"), sem
   nenhuma mudança de schema — é puramente uma segunda linha de
   exibição para o mesmo evento.
5. **Fontes mostradas discretamente**: cada evento mostra "Registrado
   por você" / "Vindo da conversa" / "Registrado pelo Quintal"
   (`origin`, já existente desde a Fase 8), num texto pequeno e
   discreto, nunca um selo chamativo.
6. **Detalhe, edição e exclusão** (`/quintal/timeline/[id]`): tocar num
   evento mostra os detalhes completos, um formulário para editar
   horário e observação (os dois campos que todo evento tem, seja qual
   for o tipo), e uma exclusão de dois toques (recolhida por padrão,
   sem JavaScript). Campos estruturados por tipo (o que foi comido,
   tipo de sono, feedback de atividade) continuam editáveis só pelo
   módulo que os criou — esta página nunca finge poder editar isso,
   e diz explicitamente onde editar quando aplicável.
7. **Editar o horário de um sono já concluído recalcula a duração**
   automaticamente a partir do novo horário de início — verificado
   contra o banco real.
8. **Dashboard integrado**: o resumo "Timeline de hoje" (já existia
   desde a Fase 7) passou a usar a mesma formatação rica da Timeline
   central (em vez do rótulo genérico anterior), e ganhou um link "Ver
   timeline completa".
9. **Estrutura para o chat já estava pronta** — `origin`/
   `source_message_id` (Fase 8) já existiam e já eram usados por todo
   módulo de registro; esta fase não precisou adicionar nada de novo
   para isso, só passou a exibir `origin` de forma visível pela primeira
   vez.

Ver `docs/ARCHITECTURE_TARGET.md`, "Timeline central (Fase 13)", para o
desenho completo e os testes realizados.

### Como testar manualmente

1. `npm run build && npm run start`.
2. Abrir `/quintal` → "Timeline de hoje" mostra os eventos com o mesmo
   formato rico (ex.: "Café da manhã — Banana, pão"); "Ver timeline
   completa" leva a `/quintal/timeline`.
3. Em `/quintal/timeline`, navegar entre dias (← →) e trocar os filtros
   — a lista muda de acordo, sempre ordenada por horário.
4. Registrar um sono noturno que termine no dia seguinte (via
   `/quintal/sono`) → no dia em que começou, aparece o período com a
   duração; no dia em que a criança acordou, aparece uma linha
   "Acordou" no horário real do despertar.
5. Tocar num evento → abre o detalhe; editar o horário e a observação e
   salvar → volta refletido na lista. Para um evento de sono já
   concluído, mudar o horário de início e confirmar que a duração
   mostrada mudou de acordo.
6. Abrir "Excluir este registro" (recolhido por padrão), confirmar →
   o evento some da lista e do Dashboard.

### Limitações conhecidas desta fase

- **Edição não cobre campos estruturados por tipo** — só horário e
  observação são editáveis pela Timeline; o que foi comido, o tipo de
  sono, o feedback de uma atividade continuam editáveis só pelo módulo
  de origem. Documentado explicitamente na própria página de edição.
- **"Acordou" só existe para sono noturno**, não para sonecas — uma
  soneca continua sendo uma linha só, com a duração como detalhe
  (decisão deliberada: o despertar de uma soneca não é, por si, um
  momento narrativamente relevante do dia, diferente do despertar da
  manhã).
- **Sem criação de evento pela própria Timeline** — Rotina,
  Desenvolvimento, Passeio e Observação continuam só criáveis via
  `/ops/children/[id]` (não há módulo de família dedicado a eles ainda,
  candidato já registrado no roadmap).
- **Filtros "Brincadeiras"/"Rotina" agrupam mais de um tipo real** —
  cinco opções foram pedidas para sete tipos existentes; a decisão de
  agrupamento está documentada, não é uma limitação técnica, mas vale
  registrar que "Rotina" no filtro não é só o tipo `routine`.
- Sem teste em navegador real de ponta a ponta (mesma limitação de rede
  das fases anteriores) — a divisão "Acordou"/recálculo de duração na
  edição foi verificada direto contra o banco real, em transação com
  rollback.

## Fase 14 — rotina adaptativa (concluída)

Objetivo: uma camada de regras simples que sugere o resto do dia a
partir do que já foi registrado (sono, alimentação, atividades) — nunca
uma agenda fixa, nunca uma prescrição. Primeira fase do projeto com
testes automatizados de verdade.

### O que foi entregue

1. **Sem nenhuma migração**: a rotina adaptativa é uma camada de
   leitura sobre `events` (via os módulos que já existem — Sono,
   Alimentação, Brincadeiras), sem tabela nem coluna nova.
2. **`src/lib/routineEngine.ts`**: um pipeline de funções pequenas e
   nomeadas — `detectState` (o que está acontecendo agora: dormindo?
   há quanto tempo acordou? a última soneca foi curta? há uma atividade
   favorita?), `computeTypicalMealTimes`/`computeTypicalBedtimeMinutes`
   ("rotina histórica" de verdade: a mediana dos horários já
   registrados por esta família, não um horário fixo de tabela), e
   `buildRoutineSuggestions` (a sequência final). As três primeiras são
   puras — sem banco, sem relógio escondido (`now` é sempre parâmetro)
   — exatamente o pedido de "regras explícitas, testáveis, fáceis de
   modificar".
3. **As três regras de adaptação pedidas, implementadas literalmente**:
   soneca curta → prioriza uma atividade mais calma (via as mesmas
   palavras-chave de interesse que a Biblioteca de Brincadeiras já usa
   para desempate, Fase 11); acabou de comer → a próxima refeição é
   empurrada para depois de um intervalo mínimo, nunca sugerida em
   cima da hora; atividade favorita (feedback "Adorou", Fase 11) →
   considerada de novo antes de qualquer sugestão genérica.
4. **Sequência igual ao exemplo do pedido**: acordou → brincadeira →
   passeio → refeição → preparação para dormir, cada uma com um motivo
   visível e um link para o módulo onde a família pode agir de verdade.
5. **Nunca uma prescrição**: nenhuma sugestão aparece sem seu "porquê";
   o texto de abertura é literal ao pedido — "Uma possibilidade para o
   restante do dia" — e nenhuma linguagem médica em lugar nenhum.
6. **Nunca inventa um horário sem dado**: dormindo agora → nenhuma
   sugestão (não há como saber quando a criança vai acordar); sem
   nenhum sono noturno no histórico → sem sugestão de "preparação para
   dormir"; sem nenhuma refeição futura plausível ainda hoje → sem
   sugestão de refeição.
7. **Dashboard: "Próximos momentos"** — uma timeline leve e curta
   (até 4 itens), cada um com ícone, horário, motivo, e link — nunca
   aparece quando não há nada real para sugerir.
8. **Testes automatizados**: `npm test` (Vitest, adicionado nesta
   fase — primeiro framework de teste do repositório) roda 26 testes
   cobrindo as principais regras (detecção de estado, medianas
   históricas, e cada regra de adaptação). Escopo deliberadamente
   restrito às funções puras — nenhum teste toca o banco ou a rede.

Ver `docs/ARCHITECTURE_TARGET.md`, "Rotina adaptativa (Fase 14)", para
o desenho completo e a lista de testes.

### Como testar manualmente

1. `npm run build && npm run start`.
2. `npm test` → confirma que as 26 regras passam.
3. Abrir `/quintal` → se houver dado suficiente (sono/refeição/idade
   conhecidos), "Próximos momentos" aparece com uma sequência curta.
4. Registrar uma soneca curta (menos de 30 min) em `/quintal/sono` →
   recarregar `/quintal` → a sugestão de brincadeira deve vir com o
   motivo mencionando a soneca curta.
5. Registrar uma refeição agora em `/quintal/alimentacao` → recarregar
   `/quintal` → a próxima sugestão de refeição não deve aparecer logo
   em seguida (empurrada para mais tarde).
6. Marcar uma atividade como "Adorou" em `/atividades/[id]` →
   recarregar `/quintal` → a sugestão de brincadeira deve citar essa
   atividade especificamente.
7. Iniciar uma soneca (sem terminar) em `/quintal/sono` → "Próximos
   momentos" some do Dashboard enquanto a criança está dormindo.

### Limitações conhecidas desta fase

- **"Rotina histórica" é só a mediana de horários recentes** — não
  distingue dia de semana/fim de semana, nem tendências (uma família
  que mudou de rotina recentemente ainda pesa os dados antigos).
- **Idade influencia pouco** — hoje só afeta a escolha de atividade
  (via `getActivitySuggestions`, que já filtra por idade); não há
  ajuste de espaçamento entre sugestões por faixa etária (ex.: bebês
  menores provavelmente precisam de janelas mais curtas entre
  atividades e sono).
- **Preferências da família (`family_preferences`) não entram na
  regra** — são mostradas em `/quintal/perfil`, mas o motor de rotina
  ainda não as lê; um candidato natural de continuação.
- **Sem módulo de registro de Rotina** — esta fase é sobre SUGERIR o
  resto do dia, não sobre registrar rotina estruturada (isso continua
  um candidato separado no roadmap, ver abaixo).
- **Sem chamada real ao Groq nesta sessão** — a rotina adaptativa não
  depende de IA em nenhum ponto (é regra determinística, por pedido
  explícito), então essa limitação não se aplica da forma usual; a
  lógica foi testada de verdade via Vitest, não só verificada contra o
  banco.

## Fase 15 — candidatos (não implementados)

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
4. **Extração automática de eventos a partir do chat** (Fase 8 preparou
   o schema — `origin`, `duration_minutes` — e as Fases 9/10/11 deram a
   Alimentação, Sono e Brincadeiras seus próprios choke points de
   registro, mas nenhuma implementou a extração) — o próximo passo
   natural de "deixar de depender só de texto livre". A Timeline
   central (Fase 13) já está pronta para exibir esses eventos assim que
   existirem, incluindo a origem "vindo da conversa".
5. **Fatos permanentes explícitos e sensíveis da criança** (ex.:
   alergias) — deliberadamente fora da Fase 8 ("não criar campos médicos
   ou sensíveis desnecessários"); exigiria decisão própria sobre
   segurança/privacidade antes de existir.
6. **Rehidratar `ActivityCard` no histórico** de `/quintal/chat`, e
   atribuir `activity_feedback`/`activity_recommendations` a
   família/criança de forma mais rica.
7. **Detectar feedback por texto livre na conversa** (ex.: a família
   digita "ela adorou" em vez de tocar no botão) — exigiria um detector
   de intenção dedicado, deliberadamente fora do escopo da Fase 6.
8. **Unificar `activity_feedback`, `activity_recommendation_feedback` e
   o feedback de `events.payload` (Fase 11)** numa visão só, para uma
   eventual tela de analytics mais completa.
9. **Suporte real a múltiplas crianças** na experiência principal, não só
   no seletor (nem no novo formulário de perfil, que já lista todas mas
   trata cada uma independentemente).
10. **Transação de verdade na criação de família** (`/comecar`) — a
    verificação de telefone duplicado adicionada em 2026-09-25 já evita a
    causa mais comum de registros órfãos, mas não é uma transação real
    (uma falha em qualquer outro ponto do fluxo ainda pode deixar uma
    família sem cuidador).
11. **Módulo completo de Rotina** (registro estruturado, não só via
    `/ops`, e distinto da rotina ADAPTATIVA da Fase 14, que sugere sem
    registrar nada) — as Fases 9, 10 e 11 fizeram isso para
    Alimentação, Sono e Brincadeiras; Rotina/Desenvolvimento/Passeio/
    Observação continuam só criáveis pelo operador.
12. **Edição de cuidadores e foto no perfil** — `/quintal/perfil` (Fase
    8) edita só os essenciais da criança e as preferências da família.
13. **Camada de recomendação/IA real para sugestões de refeição,
    brincadeira, materiais e rotina** — as Fases 9, 11, 12 e 14
    deixaram `getMealSuggestions`, `getActivitySuggestions`,
    `getRecommendedMaterials` e `buildRoutineSuggestions` prontas para
    serem substituídas sem mudar o formato de saída nem os componentes
    que as consomem, mas todas continuam filtro/ordenação/regra
    simples, sem nenhum julgamento de IA.
14. **Regras explícitas de personalização a partir do feedback**
    (ex.: "essa criança gosta de atividades com água", "essa família
    prefere atividades de até 15 minutos") — a Fase 11 preparou o dado
    (feedback estruturado por atividade, tags/materiais/ambiente já
    modelados), mas não implementou nenhuma regra de inferência, por
    pedido explícito.
15. **Unificar o sinal de "evitar por enquanto" nos dois sentidos** —
    hoje só a biblioteca influencia o chat (Fase 11); recomendações e
    feedback do chat ainda não influenciam a lista "Para hoje" da
    biblioteca.
16. **Conteúdo real dos tipos artigo/vídeo/livro/checklist**, e da
    categoria "parentalidade" — a Fase 12 preparou o vocabulário; hoje
    nenhuma linha de `knowledge_chunks` é desses tipos/categoria.
17. **Paginação de verdade na biblioteca de Materiais** — hoje um limite
    fixo (12 por filtro) em vez de páginas, mesma limitação já aceita
    para a biblioteca de Brincadeiras (Fase 11).
18. **Edição dos campos estruturados por tipo direto na Timeline**
    (o que foi comido, tipo de sono, feedback de atividade) — a Fase 13
    deliberadamente só editou horário/observação; unificar a edição num
    só lugar (em vez de mandar de volta para o módulo de origem) é um
    candidato natural de continuação.
19. **Registro de Rotina/Desenvolvimento/Passeio/Observação pela própria
    Timeline** — hoje ela só lê e edita o que outros módulos (ou o
    operador) já criaram.
20. **Rotina adaptativa considerando preferências da família e idade de
    forma mais fina** — a Fase 14 deixou os dois como limitações
    conhecidas (ver acima).
21. **Cobertura de teste automatizado para o restante do backend** — a
    Fase 14 trouxe Vitest para o repositório, mas só cobriu a camada de
    rotina; toda a lógica anterior (feeding.ts, sleep.ts, play.ts,
    library.ts...) continua verificada só manualmente contra o banco.
