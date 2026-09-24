# Quintal

Copiloto de parentalidade via WhatsApp. Este repositório contém tanto a
ferramenta interna de operação (`/ops`) quanto a experiência de produto
para famílias (`/quintal`, `/comecar`).

## Setup local

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do projeto Supabase
npm run dev
```

Um operador precisa existir em Supabase Auth (Authentication → Users) para
conseguir entrar em `/login`; não há cadastro público para operadores.

## Stack

- Next.js (App Router, "Proxy" no lugar do middleware clássico) + TypeScript + Tailwind
- Supabase (Postgres + Auth)
- Groq (IA — classificação de eventos e geração de respostas)
- WhatsApp Cloud API (recepção de mensagens; envio real só a partir da triagem em `/ops/inbox`)
- Deploy: Vercel

## Estrutura

```
src/
  app/
    login/, ops/       # ferramenta interna, protegida por Supabase Auth
    comecar/            # onboarding público da família (cria família + sessão)
    quintal/            # experiência real de produto (sessão, não caregiverId na URL)
    test/[caregiverId]/ # link de teste/QA que o operador compartilha (id direto na URL, de propósito)
    api/whatsapp/       # webhook de recepção
  components/conversation/  # ConversationChat, ChildHeader — compartilhados por /test e /quintal
  lib/
    conversation.ts    # núcleo único de "gravar mensagem → IA → resposta", usado por todos os canais
    familySession.ts   # sessão mínima da família (cookie httpOnly + caregiver_sessions)
    groq/, knowledge.ts # geração de resposta/classificação de evento + base de conhecimento (RAG)
    supabase/           # clients (browser, server, service role) e o helper de sessão do Proxy
  proxy.ts              # gate de autenticação para /ops (Next.js "Proxy", ex-middleware)
```

## Documentação

- `docs/CURRENT_STATE.md` — diagnóstico técnico do sistema (arquitetura, fluxos, gaps, débito técnico).
- `docs/ARCHITECTURE_TARGET.md` — desenho do núcleo de conversa compartilhado e do modelo de sessão.
- `docs/PRODUCT_ROADMAP.md` — o que já foi entregue por fase e o que está planejado a seguir.
