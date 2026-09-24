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

## Fase 3 — candidatos (não implementados)

Nenhum destes foi tocado nesta fase, por pedido explícito. Em ordem
sugerida de valor/risco:

1. **Autenticação real de família** (provavelmente via WhatsApp
   verificado) — resolve a limitação de "só funciona neste aparelho" e
   vira a base natural para autenticação também no canal de WhatsApp.
2. **Integração com WhatsApp real** — nova server action fina chamando o
   mesmo `recordConversationTurn`, como desenhado em
   `docs/ARCHITECTURE_TARGET.md`. Decisão de produto pendente: resposta
   100% automática, rascunho com aprovação do operador, ou só para uma
   lista fechada de números-piloto (ver a proposta já dada ao usuário
   antes desta fase).
3. **Feedback do usuário real em `/quintal`** — hoje só o operador registra
   "ajudou?" pela Inbox; a família não tem como avaliar a resposta que
   recebeu.
4. **Suporte real a múltiplas crianças** na experiência principal, não só
   no seletor.
5. **Transação na criação de família** (`/comecar`) para eliminar o risco
   de registros órfãos.
