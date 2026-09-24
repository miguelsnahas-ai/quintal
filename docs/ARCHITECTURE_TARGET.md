# Arquitetura alvo — núcleo de conversa compartilhado

> Escrito na Fase 2 (produtização do `/test`), 2026-09-25. Complementa
> `docs/CURRENT_STATE.md` (diagnóstico do estado anterior a esta fase).

## O núcleo permanece único

```
UI (ConversationChat)
  ↓
server action (por canal: sendTestMessage, sendQuintalMessage, futuro sendWhatsAppMessage)
  ↓
conversation core (recordConversationTurn, em src/lib/conversation.ts)
  ↓
contexto + IA + knowledge base (suggestEventFromMessage, suggestReply, search_knowledge_chunks)
  ↓
messages / events (Postgres)
  ↓
resposta
```

`src/lib/conversation.ts` **não foi alterado** nesta fase (além dos ajustes
de memória de conversa/registro automático de evento feitos na fase
anterior). Ele continua sendo o único lugar que sabe como gravar uma
mensagem, buscar contexto e chamar a IA — e é chamado por dois canais hoje:

| Canal | Rota | Server action | Como resolve o `caregiverId` |
|---|---|---|---|
| Ferramenta interna (QA/link enviado pelo operador) | `/test/[caregiverId]` | `sendTestMessage(caregiverId, input)` | **da URL**, sem sessão |
| Produto real | `/quintal` | `sendQuintalMessage(input)` | **da sessão** (`caregiver_sessions`), nunca do cliente |

Um terceiro canal (WhatsApp) é o próximo candidato natural — quando existir,
será uma nova server action fina chamando o mesmo `recordConversationTurn`,
sem duplicar lógica de IA/knowledge/persistência. Essa foi a razão de
extrair a UI de chat (antes só em `TestChat.tsx`) para
`src/components/conversation/ConversationChat.tsx`: hoje ela serve dois
canais; o padrão (action fina → núcleo único) é o que deve se repetir para
o terceiro.

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

## Componentes novos desta fase

| Arquivo | Papel |
|---|---|
| `src/lib/familySession.ts` | cria/lê a sessão mínima acima |
| `src/components/conversation/ConversationChat.tsx` | UI de chat compartilhada por `/test` e `/quintal` (extraída de `TestChat.tsx`, que foi removido) |
| `src/components/conversation/ChildHeader.tsx` | cabeçalho "Quintal de {criança}" — puramente apresentacional, todo dado é real |
| `src/app/quintal/page.tsx` + `actions.ts` | a experiência de produto |
| `supabase/migrations/20260925120000_create_caregiver_sessions.sql` | a tabela de sessão |

## Bug encontrado e corrigido durante a extração

O `TestChat.tsx` original só mostrava o seletor de criança quando havia
mais de uma (`childrenList.length > 1`); com exatamente uma criança — o
caso mais comum — o `childId` nunca era definido, e a conversa rodava
**sem nenhum contexto da criança** (sem idade, sem eventos recentes, sem
registro automático de evento). Corrigido no `ConversationChat`
compartilhado: com exatamente uma criança, ela é selecionada
automaticamente. Isso também corrige silenciosamente conversas antigas do
`/test` que pareciam funcionar mas nunca usavam o contexto da criança.
