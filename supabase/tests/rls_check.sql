-- ============================================================
-- Teste manual de RLS — rodar no SQL Editor do Supabase
-- ============================================================
-- Este script simula diferentes roles para verificar que as
-- políticas de segurança estão corretas.
--
-- Como usar: copie e cole cada bloco separadamente no SQL Editor
-- e confira o resultado esperado nos comentários.
-- ============================================================


-- ============================================================
-- PREPARAÇÃO: inserir dados de teste (rode como service_role / owner)
-- ============================================================

-- Produto visível
INSERT INTO site_products (slug, name, price, category, is_visible, is_featured, display_order)
VALUES ('kit-teste-visivel', 'Kit Teste Visível', 99.90, 'Kits', true, true, 1);

-- Produto oculto
INSERT INTO site_products (slug, name, price, category, is_visible, is_featured, display_order)
VALUES ('kit-teste-oculto', 'Kit Teste Oculto', 49.90, 'Kits', false, false, 2);

-- Foto do produto visível
INSERT INTO site_product_images (product_id, image_url, display_order)
SELECT id, 'https://exemplo.com/foto-teste.webp', 1
FROM site_products WHERE slug = 'kit-teste-visivel';

-- Foto do produto oculto
INSERT INTO site_product_images (product_id, image_url, display_order)
SELECT id, 'https://exemplo.com/foto-oculta.webp', 1
FROM site_products WHERE slug = 'kit-teste-oculto';


-- ============================================================
-- TESTE 1: anon vê só produtos visíveis
-- Esperado: retorna APENAS "Kit Teste Visível"
-- ============================================================
SET ROLE anon;

SELECT slug, name, is_visible FROM site_products;
-- ✅ Deve mostrar só kit-teste-visivel

SELECT si.image_url FROM site_product_images si;
-- ✅ Deve mostrar só foto-teste.webp (produto visível)

RESET ROLE;


-- ============================================================
-- TESTE 2: anon NÃO consegue inserir
-- Esperado: ERRO de permissão
-- ============================================================
SET ROLE anon;

INSERT INTO site_products (slug, name, price, category)
VALUES ('hack-anon', 'Hack', 0, 'Kits');
-- ❌ Deve dar erro (permission denied ou RLS violation)

RESET ROLE;


-- ============================================================
-- TESTE 3: anon NÃO consegue atualizar
-- Esperado: ERRO ou 0 linhas afetadas
-- ============================================================
SET ROLE anon;

UPDATE site_products SET name = 'Hackeado' WHERE slug = 'kit-teste-visivel';
-- ❌ Deve dar erro

RESET ROLE;


-- ============================================================
-- TESTE 4: anon NÃO consegue deletar
-- Esperado: ERRO ou 0 linhas afetadas
-- ============================================================
SET ROLE anon;

DELETE FROM site_products WHERE slug = 'kit-teste-visivel';
-- ❌ Deve dar erro

RESET ROLE;


-- ============================================================
-- TESTE 5: authenticated (NÃO admin) só lê visíveis
-- Esperado: mesma coisa que anon para SELECT
-- ============================================================
SET ROLE authenticated;

-- Simular JWT de um usuário que NÃO está em admin_users
-- (No SQL Editor isso funciona porque não há JWT, logo is_admin() = false)

SELECT slug, name, is_visible FROM site_products;
-- ✅ Deve mostrar só kit-teste-visivel (não-admin vê igual a anon)

RESET ROLE;


-- ============================================================
-- TESTE 6: authenticated (NÃO admin) NÃO consegue inserir
-- Esperado: ERRO (RLS violation)
-- ============================================================
SET ROLE authenticated;

INSERT INTO site_products (slug, name, price, category)
VALUES ('hack-auth', 'Hack Auth', 0, 'Kits');
-- ❌ Deve dar erro de RLS

RESET ROLE;


-- ============================================================
-- TESTE 7: anon NÃO consegue ler admin_users
-- Esperado: ERRO ou 0 linhas
-- ============================================================
SET ROLE anon;

SELECT * FROM admin_users;
-- ❌ Deve retornar 0 linhas (RLS sem policy = bloqueado)

RESET ROLE;


-- ============================================================
-- TESTE 8: authenticated NÃO consegue ler admin_users
-- Esperado: ERRO ou 0 linhas
-- ============================================================
SET ROLE authenticated;

SELECT * FROM admin_users;
-- ❌ Deve retornar 0 linhas

RESET ROLE;


-- ============================================================
-- LIMPEZA: remover dados de teste
-- ============================================================
-- Rode como owner/service_role
DELETE FROM site_products WHERE slug IN ('kit-teste-visivel', 'kit-teste-oculto');
-- (imagens são deletadas automaticamente pelo ON DELETE CASCADE)


-- ============================================================
-- NOTA sobre teste do admin:
-- Para testar que o admin ESCREVE, faça login no painel com seu
-- e-mail (que está em admin_users) e tente criar/editar/deletar
-- um produto pela interface. Ou rode no SQL Editor:
--
--   SET ROLE authenticated;
--   SET request.jwt.claims = '{"email":"SEU_EMAIL_AQUI"}';
--   INSERT INTO site_products (slug, name, price, category)
--   VALUES ('teste-admin', 'Teste Admin', 10, 'Kits');
--   SELECT * FROM site_products; -- deve ver TODOS (inclusive ocultos)
--   DELETE FROM site_products WHERE slug = 'teste-admin';
--   RESET ROLE;
--
-- ============================================================
