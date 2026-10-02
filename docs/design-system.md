---
version: "alpha"
name: "Minimalismo Sereno de Bem-Estar"
description: "Calm and minimalist landing page for a meditation and wellness app. Ideal for landing pages, modern websites. AI-ready template."
colors:
  primary: "#FFFFFF"
  secondary: "#FDF6E3"
  tertiary: "#A8DADC"
  neutral: "#E0E0E0"
  surface: "#87CEEB"
  accent: "#E6E6FA"
typography:
  h1:
    fontFamily: Nunito
    fontSize: 2.5rem
    fontWeight: 700
  body-md:
    fontFamily: Nunito
    fontSize: 1rem
    fontWeight: 400
rounded:
  sm: 8px
  md: 16px
  lg: 24px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    rounded: "{rounded.sm}"
    padding: 12px
---

## Overview

Calm and minimalist landing page for a meditation and wellness app. Ideal for landing pages, modern websites. AI-ready template. Before Headspace launched in 2012, nobody thought a meditation app needed a design language. Then Andy Puddicombe and his team proved that rounded shapes, muted palettes, and generous whitespace could actually lower your heart rate before you even pressed play. Calm followed with their dark blues and nature textures — a different bet on the same thesis: the interface itself is the first breath.

This wasn't accidental. The digital well-being movement emerged as a direct counter to attention-economy design. Where social platforms weaponized red notification badges and infinite scroll, wellness brands stripped everything back. No urgency. No visual noise. Every pixel earned its place by contributing to a feeling of spaciousness. The Swiss grid found new purpose here — not as corporate rationalism, but as structured calm.

What makes this lineage interesting is the constraint. You're designing for people in vulnerable states. Anxiety. Insomnia. Burnout. The typography can't shout. The transitions can't jar. Even the onboarding has to feel like permission to slow down. It's minimalism with emotional intelligence — form following feeling, not just function.

- Density: 3/10 — Airy
- Variance: 2/10 — Structured
- Motion: 4/10 — Subtle

- **Style:** Calm, Minimalist, Serene
- **Keywords:** meditation, wellness, calm, minimalist, serene, peaceful, intuitive, mindful, health, balanced
- **Era:** 2026+ Bem-Estar Digital
- **Light/Dark:** ✓ Full / ✗ No

## Colors

- **Branco** (#FFFFFF) — Light surface, card backgrounds
- **Bege Claro** (#FDF6E3) — Secondary surface or text color
- **Verde Água** (#A8DADC) — Supporting palette color
- **Cinza Suave** (#E0E0E0) — Secondary text, borders, muted elements
- **Azul Céu** (#87CEEB) — Secondary accent
- **Lavanda** (#E6E6FA) — Extended palette, decorative use
- **Verde Menta** (#98FB98) — Success states, positive indicators
- **Marrom Claro** (#D2B48C) — Extended palette, decorative use


## Typography

- **Display / Hero:** Nunito — Weight 700, tight tracking, used for headline impact
- **Body:** Nunito — Weight 400, 16px/1.6 line-height, max 72ch per line
- **UI Labels / Captions:** Nunito — 0.875rem, weight 500, slight letter-spacing
- **Monospace:** JetBrains Mono — Used for code, metadata, and technical values

Scale:
- Hero: clamp(2.5rem, 5vw, 4rem)
- H1: 2.25rem
- H2: 1.5rem
- Body: 1rem / 1.6
- Small: 0.875rem


## Layout

- **Grid:** CSS Grid primary. Max-width containment: 1280px centered with 1.5rem side padding.
- **Spacing rhythm:** Balanced. Base unit: 0.5rem (8px).
- **Section vertical gaps:** clamp(4rem, 8vw, 8rem).
- **Hero layout:** Split-screen (text left, visual right).
- **Feature sections:** Zig-zag alternating text+image rows. No 3-equal-columns.
- **Mobile collapse:** All multi-column layouts collapse below 768px. No horizontal overflow.
- **z-index contract:** base (0) / sticky-nav (100) / overlay (200) / modal (300) / toast (500).


## Elevation & Depth

Layouts arejados com muito espaço em branco, tipografia suave e arredondada, ilustrações minimalistas de natureza, animações de fundo sutis (ondas, nuvens), micro-interações de feedback tátil, transições fluidas e relaxantes.

- **Physics:** Ease-out curves, 200-300ms duration. Smooth and predictable.
- **Entry animations:** Fade + translate-Y (16px → 0) over 420ms ease-out. Staggered cascades for lists: 80ms between items.
- **Hover states:** Subtle color shift + shadow adjustment over 200ms.
- **Page transitions:** Fade only (200ms).
- **Performance:** Only transform and opacity animated. No layout-triggering properties.


## Shapes

Base corner radius: 8px. See rounded tokens in front matter for the full scale.


## Components

- **Primary Button:** Rounded (8px) shape. Accent color fill. Hover: 8% darken + subtle lift shadow. Active: -1px translate tactile press. Font weight 600. No outer glows.
- **Secondary / Ghost Button:** Outline variant. 1.5px border in muted color. Text in primary color. Hover: subtle background fill.
- **Cards:** Rounded (8px) corners. Surface background. Subtle shadow (0 2px 12px rgba(0,0,0,0.06)). 1px border stroke.
- **Inputs:** Label above input. 1px border stroke. Focus ring: 2px accent color offset 2px. Error text below in semantic red. No floating labels.
- **Navigation:** Primary surface background. Active item: accent color indicator. Font weight 500 when active.
- **Skeletons:** Shimmer animation matching component dimensions. No circular spinners.
- **Empty States:** Icon-based composition with descriptive text and action button.


## Do's and Don'ts

- No emojis in UI — use icon system only (Lucide, Heroicons)
- No decorative gradients — flat color only
- No shadows heavier than 0 2px 8px rgba(0,0,0,0.08)
- No pure black (#000000) — use off-black or charcoal variants
- No oversaturated accent colors (saturation cap: 80%)
- No 3-column equal-width feature layouts — use zig-zag or asymmetric grid
- No `h-screen` — use `min-h-[100dvh]`
- No AI copywriting clichés: "Elevate", "Seamless", "Unleash", "Next-Gen"
- No broken external image links — use picsum.photos or inline SVG
- No generic lorem ipsum in demos

- Do Layouts arejados
- Do Tipografia suave
- Do Ilustrações minimalistas
- Do Animações de fundo sutis
- Do Micro-interações táteis
- Do Transições relaxantes.


## Use Case

Landing pages, Modern websites

<!-- Source: https://designmd.app/library/minimalismo-sereno-de-bem-estar · designmd.app -->

<!--
  Nota: o conteúdo acima (front matter + corpo até aqui) é um template de
  referência genérico ("Minimalismo Sereno de Bem-Estar", meditação/bem-estar),
  não o design system do Quintal — ele não descreve o produto real. A seção
  abaixo é a primeira a documentar, de fato, uma decisão de design system do
  Quintal, e é a única parte deste arquivo que deve ser tratada como fonte
  de verdade atual.
-->

## Quintal Iconography

### Conceito

"Traço de giz desenhado à mão" — cada ícone deve parecer que alguém o
desenhou rapidamente com giz ou lápis sobre uma superfície, não que foi
gerado por uma biblioteca de UI. Isso é deliberado: ícones geométricos e
perfeitos (incluindo ícones de biblioteca com apenas stroke/cor trocados)
têm uma frieza corporativa que contradiz o tom do Quintal. A referência
mental é um adulto desenhando um símbolo pequeno no quadro-negro de um
quintal com um pedaço de giz — não se trata de aplicar textura de giz
pesada, e sim de reproduzir a sensação do traço.

### Características obrigatórias do traço

- Traço orgânico, com curvas naturais e pequenas imperfeições.
- Extremidades e junções sempre arredondadas (`stroke-linecap="round"`,
  `stroke-linejoin="round"`).
- Variação sutil de espessura ao longo do próprio traço (nunca uniforme
  como uma linha vetorial perfeita).
- Formas simples, poucos elementos por ícone, leitura imediata em
  tamanhos pequenos (16px).
- Assimetria intencional nas proporções — evitar círculos matematicamente
  perfeitos e simetria excessiva.

**Evitar:** linhas perfeitamente retas, simetria excessiva, cantos muito
precisos, aparência tecnológica/corporativa, 3D, gradientes, sombras,
excesso de detalhes, estilo cartoon infantil exagerado. O resultado deve
ser artesanal, nunca desleixado.

### Como o traço é construído

Não são ícones Lucide com `stroke`/`strokeWidth`/`strokeLinecap`
trocados — isso não é suficiente para a sensação de traço à mão. Cada
ícone tem um path SVG próprio (`src/components/icon/quintalIconPaths.ts`),
desenhado com curvas assimétricas desde a origem. Por cima disso, um
filtro SVG (`feTurbulence` + `feDisplacementMap`, aplicado em
`QuintalIcon.tsx`) adiciona a imperfeição e a variação de espessura de
forma consistente entre todos os ícones — a mesma "mão" para a família
inteira, sem precisar desenhar a imperfeição manualmente em cada path.
A semente do ruído deriva do nome do ícone (determinística — o mesmo
ícone sempre balança do mesmo jeito, sem depender de `Math.random` nem
quebrar hidratação servidor/cliente).

### Cores por tema

Cada domínio do produto tem sua própria cor. É uma **linguagem de
classificação**, não uma pintura da interface — nunca usar essas cores em
botões, fundos de página ou texto corrido fora do próprio ícone/selo do
domínio. O texto continua predominantemente neutro (`--color-ink` /
`--color-ink-muted`).

| Tema | main (traço) | light (fundo do selo) | dark (traço sobre light) |
|---|---|---|---|
| Sono | `#9AA8C7` | `#E8ECF5` | `#66759A` |
| Brincar | `#91A98B` | `#E8F0E5` | `#607A5C` |
| Comer | `#D89A7A` | `#F7E8DF` | `#A9684D` |
| Desenvolvimento | `#D4B45C` | `#F7F0D8` | `#987D32` |
| Higiene | `#7FB8B0` | `#E3F1EF` | `#528C84` |
| Rotina | `#B9A47D` | `#F1ECE2` | `#806D4D` |

Tokens em `globals.css`: `--color-theme-{sleep,play,meal,growth,hygiene,routine}-{main,light,dark}`.

**Regra de contraste (validada ao criar esta fase):** `main` sobre `light`
mede ~2:1 de contraste, abaixo do mínimo de 3:1 recomendado para
elementos gráficos (WCAG 1.4.11). Por isso `QuintalIcon` troca
automaticamente o traço para `dark` quando o ícone é renderizado com
`background="light"` (selo/badge) — `dark` sobre `light` mede ~3.3–4.2:1.
Sobre superfície neutra (cartão branco/creme, o uso mais comum no
produto), o traço continua `main`, como pedido.

### Tamanhos e stroke

| Tamanho | px | Uso típico |
|---|---|---|
| `sm` | 16 | inline com texto, badges compactos |
| `lg` | 40 | destaque, cabeçalhos de módulo, selos |
| `md` | 24 | padrão — navegação, cards |

`strokeWidth` tem padrão 1.85 e pode ser sobrescrito por chamada, mas na
prática não há motivo para variar: a espessura "sutilmente variável" já
vem do filtro, não de mudar o número.

### Arquitetura / como usar

```tsx
import { QuintalIcon } from "@/components/icon/QuintalIcon";

// Uso comum: traço main sobre o cartão
<QuintalIcon name="moon" theme="sleep" size="md" />

// Selo colorido (traço vira dark automaticamente)
<QuintalIcon name="drop" theme="hygiene" size="lg" background="light" />

// Tamanho customizado e rótulo acessível (raro — normalmente o ícone
// acompanha texto visível, e aí fica aria-hidden por padrão)
<QuintalIcon name="house" theme="routine" size={32} title="Rotina" />
```

Nunca espalhar SVG diretamente nas páginas — todo ícone novo da família
"traço de giz" entra em `quintalIconPaths.ts` e passa por `QuintalIcon`,
que centraliza tamanho, cor por tema, stroke e o filtro de textura.

Página de validação visual (não é tela de produto): `/ops/design-system/icons`
— compara o traço novo com os ícones Lucide atuais, tema por tema, em
três tamanhos e sobre os dois fundos.

### Ícones existentes (primeira família)

18 ícones, 3 por tema — suficiente para validar a linguagem antes de
expandir:

- **Sono:** `moon`, `bed`, `nap`
- **Brincar:** `blocks`, `ball`, `box`
- **Comer:** `plate`, `spoon`, `cup`
- **Desenvolvimento:** `sprout`, `growth`, `book`
- **Higiene:** `drop`, `bath`, `toothbrush`
- **Rotina:** `house`, `calendar`, `cycle`
- **Sono (extra, ver Integração abaixo):** `sun` — "acordou", distinto de `moon`

### Integração com o produto

A biblioteca nasceu só na página de validação (`/ops/design-system/icons`)
e, numa segunda etapa — depois de validada a linguagem —, substituiu os
pontos onde um ícone identifica um dos seis domínios para quem usa o
produto de verdade:

- **Home** (`/quintal`, `SummaryCard`): Sono/Alimentação/Brincadeiras/Rotina
  no "Resumo do dia".
- **Timeline** (`TimelineEventIcon`, usado pela Timeline completa e pelo
  resumo compacto da Home): 6 dos 8 tipos de evento (`sleep`, `wake`,
  `meal`, `play`, `routine`, `development`). `outing` e `observation` não
  pertencem a nenhum dos seis domínios e continuam com ícone Lucide
  genérico — forçar um tema aqui seria inventar uma classificação que não
  existe.
- **Sono** (`SleepEntryCard`, histórico e "último sono"): `moon`
  (sono noturno) / `nap` (soneca).

`PillarIcon` (o componente anterior, só com o pilar "sono" em uso real)
foi removido — sem chamadores restantes depois desta integração.

Ícone de **chrome de botão** (ex.: o ícone dentro do CTA "Registrar
sono") continua Lucide colorido com `text-ink`, de propósito: cor por
tema é linguagem de classificação para conteúdo, não para o chrome de um
botão sobre fundo âmbar sólido — ver "Cores por tema" acima.

Esta integração ainda não é total: qualquer outro Lucide/cor fixa fora
dos pontos acima (ex.: `CurrentMomentCard`, ícones de ação genéricos)
continua como estava — não é um redesign completo do app.

### Ícones vs. ilustrações

**Não misturar os dois sistemas.**

- **Ícones** (`QuintalIcon`, esta seção): pequenos, funcionais, só
  identificam um tema — navegação, cards, badges, selos. Poucos
  elementos, leitura instantânea.
- **Ilustrações**: maiores, mais expressivas, podem ter mais detalhes e
  composição própria (ex.: estados vazios, onboarding, momentos de
  celebração). Sistema à parte, ainda não criado — será tratado em fase
  futura.

Um ícone nunca deve crescer para virar ilustração (adicionando detalhe
até perder a leitura instantânea), e uma ilustração nunca deve ser
espremida para funcionar no lugar de um ícone pequeno.
