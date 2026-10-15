-- ============================================================
-- Migration 002: RLS, Storage, políticas de acesso
-- Projeto: Painel Admin Renato Pinheiro
-- ============================================================

-- ============================================================
-- 1. Tabela de admins + função is_admin()
-- ============================================================

-- Tabela que define quem é admin (por e-mail do Supabase Auth)
CREATE TABLE admin_users (
    email text PRIMARY KEY
);

-- RLS na tabela admin_users: nenhum role externo pode ler ou alterar
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
-- Sem policies = anon e authenticated não têm acesso nenhum.
-- Apenas service_role (usado internamente) acessa.

-- Função que verifica se o usuário logado é admin.
-- SECURITY DEFINER: roda com privilégios do dono (consegue ler admin_users apesar do RLS).
-- search_path fixo em public: evita ataques por manipulação de schema.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.admin_users
        WHERE email = (auth.jwt() ->> 'email')
    );
END;
$$;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- IMPORTANTE: insira seu e-mail REAL abaixo antes de rodar!
-- Esse INSERT deve ser executado uma vez no SQL Editor.
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- INSERT INTO admin_users (email) VALUES ('COLE_SEU_EMAIL_AQUI');


-- ============================================================
-- 2. RLS em site_products
-- ============================================================
ALTER TABLE site_products ENABLE ROW LEVEL SECURITY;

-- Público (anon + authenticated): só lê produtos visíveis
CREATE POLICY "Público lê produtos visíveis"
    ON site_products
    FOR SELECT
    TO anon, authenticated
    USING (is_visible = true);

-- Admin: lê TUDO (inclusive ocultos) — precisa para o painel
CREATE POLICY "Admin lê todos os produtos"
    ON site_products
    FOR SELECT
    TO authenticated
    USING (is_admin());

-- Admin: insere produtos
CREATE POLICY "Admin insere produtos"
    ON site_products
    FOR INSERT
    TO authenticated
    WITH CHECK (is_admin());

-- Admin: atualiza produtos
CREATE POLICY "Admin atualiza produtos"
    ON site_products
    FOR UPDATE
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- Admin: deleta produtos
CREATE POLICY "Admin deleta produtos"
    ON site_products
    FOR DELETE
    TO authenticated
    USING (is_admin());


-- ============================================================
-- 3. RLS em site_product_images
-- ============================================================
ALTER TABLE site_product_images ENABLE ROW LEVEL SECURITY;

-- Público: só vê fotos de produtos visíveis (sub-select garante)
CREATE POLICY "Público lê fotos de produtos visíveis"
    ON site_product_images
    FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM site_products
            WHERE site_products.id = site_product_images.product_id
              AND site_products.is_visible = true
        )
    );

-- Admin: lê todas as fotos (inclusive de produtos ocultos)
CREATE POLICY "Admin lê todas as fotos"
    ON site_product_images
    FOR SELECT
    TO authenticated
    USING (is_admin());

-- Admin: insere fotos
CREATE POLICY "Admin insere fotos"
    ON site_product_images
    FOR INSERT
    TO authenticated
    WITH CHECK (is_admin());

-- Admin: atualiza fotos
CREATE POLICY "Admin atualiza fotos"
    ON site_product_images
    FOR UPDATE
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- Admin: deleta fotos
CREATE POLICY "Admin deleta fotos"
    ON site_product_images
    FOR DELETE
    TO authenticated
    USING (is_admin());


-- ============================================================
-- 4. Storage: bucket product-images
-- ============================================================

-- Cria bucket público (leitura pública via URL direta)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-images',
    'product-images',
    true,
    5242880,  -- 5 MB em bytes
    ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- Leitura pública dos objetos do bucket
CREATE POLICY "Leitura pública de imagens"
    ON storage.objects
    FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'product-images');

-- Admin: upload de imagens
CREATE POLICY "Admin faz upload de imagens"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'product-images'
        AND is_admin()
    );

-- Admin: atualiza imagens (substituir arquivo)
CREATE POLICY "Admin atualiza imagens"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'product-images'
        AND is_admin()
    );

-- Admin: deleta imagens
CREATE POLICY "Admin deleta imagens"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'product-images'
        AND is_admin()
    );


-- ============================================================
-- 5. Revogar privilégios desnecessários de anon
-- ============================================================

-- anon só pode SELECT onde RLS permitir; sem INSERT/UPDATE/DELETE direto
REVOKE INSERT, UPDATE, DELETE ON site_products FROM anon;
REVOKE INSERT, UPDATE, DELETE ON site_product_images FROM anon;
REVOKE ALL ON admin_users FROM anon;
REVOKE ALL ON admin_users FROM authenticated;
