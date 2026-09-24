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

## Fase 4 — candidatos (não implementados)

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
   embeddings.
5. **Feedback do usuário real em `/quintal`** — hoje só o operador registra
   "ajudou?" pela Inbox; a família não tem como avaliar a resposta que
   recebeu.
6. **Suporte real a múltiplas crianças** na experiência principal, não só
   no seletor.
7. **Transação na criação de família** (`/comecar`) para eliminar o risco
   de registros órfãos.
