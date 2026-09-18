# Quintal

Copiloto de parentalidade via WhatsApp. Este repositório é a ferramenta
interna de operação do MVP concierge (Next.js + Supabase).

## Setup local

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do projeto Supabase "familyos"
npm run dev
```

Um operador precisa existir em Supabase Auth (Authentication → Users) para
conseguir entrar em `/login`; não há cadastro público.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Postgres + Auth)
- Deploy: Vercel

## Estrutura

```
src/
  app/
    login/        # tela de login do operador (Supabase Auth)
    ops/          # ferramenta interna, protegida por auth
  lib/supabase/    # clients (browser, server) e o helper de sessão do Proxy
  proxy.ts         # gate de autenticação para /ops (Next.js "Proxy", ex-middleware)
```

## Roadmap

Ver histórico de decisões técnicas no acompanhamento do projeto. Sprint 0
(atual): fundação — auth de operador, schema inicial (`families`,
`caregivers`, `children`), deploy. Próximo: Sprint 1 — CRUD de famílias e
crianças na ferramenta interna.
