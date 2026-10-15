# Painel Admin — Renato Pinheiro Consultoria Capilar (contexto para Claude Code)

Este projeto é o **painel administrativo** onde o Renan (dono do projeto, único
usuário) cadastra, edita e remove os produtos do site do Renato Pinheiro. Os
produtos cadastrados aqui aparecem no site público do Renato, lendo o mesmo
banco Supabase. O painel é um **projeto separado** do site.

## Pessoas e papéis
- **Renan (José Renan Maia Pinheiro)** — desenvolvedor, dono do projeto, **único**
  que usa o painel. Escreve em português. Dúvida real: parar e escrever a pergunta
  isolada em texto simples (ele leva a outro Claude e volta com a resposta).
- **Renato Pinheiro** — cliente/amigo, consultor capilar em Ibicuitinga, CE. É o
  dono do site público. **Não acessa o painel, o Supabase nem qualquer API.**

## Regra principal de segurança
1. O Supabase deste projeto é **novo e exclusivo do Renato**. Nunca usar URL, chave,
   tabela ou código do sistema/Supabase da Essenza (outro negócio do Renan). Nada
   aqui pode tocar nos sistemas dele.
2. Só o Renan escreve no banco. Garantido **no banco** (RLS + Storage policies), não
   só na interface: o painel esconder um botão não é segurança.
3. Chave `anon` pode aparecer no front (é pública por desenho, protegida por RLS).
   **Nunca** colocar `service_role` em arquivo, front, commit ou chat.
4. Cadastro público de usuários desligado no Supabase Auth. Existe um único usuário.
5. O painel não deve ser indexável: `noindex`, `robots.txt` com `Disallow: /`,
   cabeçalhos de segurança no Netlify.
6. Segredos e e-mail do admin ficam fora do repositório (config local / placeholders).

## Stack (decidido)
- **HTML/CSS/JS puro, sem build step, sem framework** (mesma filosofia do site).
  Não migrar para React/Next.
- `@supabase/supabase-js` v2 via CDN com versão fixa (jsdelivr ou cdnjs), sem npm
  no front. Fontes: Cormorant Garamond + Inter (Google Fonts).
- Auth: Supabase Auth, e-mail + senha, um usuário.
- Banco: Supabase Postgres. Fotos: Supabase Storage.
- Deploy: site Netlify próprio do painel (ex.: renatostore-admin.netlify.app).
- Testes: Playwright (visual + fluxos), olhar os screenshots.

## O site público (que consome este banco)
Site estático HTML/CSS/JS em https://renatostore.netlify.app (repositório separado,
pasta `renato-site`). Loja de **consultoria capilar** com WhatsApp
(5588992583347). Categorias: **Kits**, **Reparadores**, **Protetores térmicos**.
O site não vende direto: cada produto abre o WhatsApp com "Oi! Quero o {nome}".
Identidade: Cacau #2C2420, Caramelo #C4956A, Areia #E8D5C0, Creme #F5EDE6,
Bronze #8B6F4E, Dourado #D4A574, Verde #2A7D5B; fontes Cormorant Garamond + Inter.
O painel deve usar essa mesma identidade (sóbrio, elegante, usável no celular).

### Como o site lê o banco (contrato — não quebrar)
Chamadas PostgREST com a chave anon:
- Home (destaques): `GET /site_products?select=*,site_product_images(image_url,display_order)&is_visible=eq.true&is_featured=eq.true&order=display_order.asc`
  - o primeiro item é o card grande; a primeira foto (menor display_order) é a capa.
- Detalhe: `GET /site_products?...&slug=eq.<slug>` e fotos de `site_product_images`
  ordenadas por `display_order`. Rota pública: `/produto/<slug>`.
- Relacionados: mesma `category`, `slug=neq.<slug>`, `is_visible=eq.true`, limite 4.
- Produto com `is_visible=false` **nunca** pode ser legível pelo público (RLS).

### Modelo de dados
`site_products`: id uuid pk, slug text **único** (kebab-case, sem acento), name,
price numeric(10,2) ≥ 0, brand, category (**só** `Kits` | `Reparadores` |
`Protetores térmicos`, com CHECK), short_description, full_description,
volume_label (ex.: "300ml"), fragrance_notes text[] (na interface se chama
**"Indicado para"**; ex.: "Cabelos secos"), background_variant
(`escuro`|`claro`|`creme`, padrão `escuro`), badge_tag (ex.: "Mais pedido"),
is_visible bool (padrão true), is_featured bool (padrão false), display_order int,
created_at, updated_at (trigger).
`site_product_images`: id uuid pk, product_id fk → site_products on delete cascade,
image_url text, storage_path text, display_order int, created_at.
Storage: bucket público `product-images` (leitura pública, escrita só admin; só
jpeg/png/webp; máx. 5 MB).
O valor de `category` define o ícone de fallback no site (prefixo kit / protetor /
demais). Nunca permitir texto livre nesse campo.

## O painel (escopo)
Telas: login; lista de produtos (busca, filtro por categoria/visibilidade, ordenar,
ações rápidas visível/destaque); criar/editar produto (todos os campos acima, slug
automático a partir do nome e editável, "Indicado para" em chips, preview do card);
upload de várias fotos com arrastar para reordenar (a 1ª é a capa), remover foto;
excluir produto com confirmação (apaga também as fotos do Storage); sair.
Requisitos: redimensionar/converter foto para WebP no navegador (máx. ~1600px)
antes de subir; validar preço/slug/campos; mensagens de erro claras em português;
funcionar bem no celular; estados de carregando/vazio/erro.

## Fases de trabalho (uma por vez, parar ao final de cada uma)
1. Banco: migrations SQL + RLS + Storage + guia de configuração manual.
2. Painel (UI + CRUD + fotos).
3. Ligar o site do Renato (preencher `supabase-config.js` no outro projeto — só com
   a anon key) e testar ponta a ponta com produtos de teste.
4. Deploy do painel e checklist de segurança final.

## Regras de trabalho
- Commit local ao final de cada tarefa aprovada. **Nunca dar push** sem o Renan pedir.
- Playwright para tudo; **olhar os screenshots** (375, 768, 1440). Console limpo,
  sem overflow horizontal.
- Mudanças de banco sempre em arquivo de migration numerado (`supabase/migrations/`),
  idempotente quando possível, com comentários. O Renan roda no SQL Editor.
- Não inventar conteúdo de marca/negócio; na dúvida, perguntar.
- Antes de criar algo grande, listar o plano em 5-8 linhas e seguir.
