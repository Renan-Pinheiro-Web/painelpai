-- ============================================================
-- Migration 001: Tabelas site_products e site_product_images
-- Projeto: Painel Admin Renato Pinheiro
-- ============================================================

-- Tabela principal de produtos do site
CREATE TABLE site_products (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Slug único para URL pública (/produto/<slug>)
    slug          text NOT NULL UNIQUE,

    name          text NOT NULL,

    -- Preço nunca negativo; numeric(10,2) comporta até 99.999.999,99
    price         numeric(10,2) NOT NULL CHECK (price >= 0),

    brand         text,

    -- Apenas 3 categorias permitidas; o site usa esse valor para ícone de fallback
    category      text NOT NULL CHECK (category IN ('Kits', 'Reparadores', 'Protetores térmicos')),

    short_description text,
    full_description  text,

    -- Ex.: "300ml"
    volume_label  text,

    -- Na interface do site se chama "Indicado para"; ex.: ARRAY['Cabelos secos']
    fragrance_notes text[],

    -- Variante visual do card no site público
    background_variant text NOT NULL DEFAULT 'escuro'
        CHECK (background_variant IN ('escuro', 'claro', 'creme')),

    -- Ex.: "Mais pedido" — aparece como badge no card
    badge_tag     text,

    is_visible    boolean NOT NULL DEFAULT true,
    is_featured   boolean NOT NULL DEFAULT false,

    -- Ordem de exibição na home e na listagem
    display_order integer,

    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Índices para as queries do site público (filtros mais comuns)
CREATE INDEX idx_products_visible        ON site_products (is_visible);
CREATE INDEX idx_products_featured       ON site_products (is_featured);
CREATE INDEX idx_products_display_order  ON site_products (display_order);
CREATE INDEX idx_products_category       ON site_products (category);

-- Trigger: atualiza updated_at automaticamente em qualquer UPDATE
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON site_products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();


-- Tabela de imagens dos produtos
CREATE TABLE site_product_images (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Cascade: ao deletar produto, suas imagens somem junto
    product_id    uuid NOT NULL REFERENCES site_products(id) ON DELETE CASCADE,

    -- URL pública gerada pelo Supabase Storage
    image_url     text NOT NULL,

    -- Caminho dentro do bucket (para deletar do Storage)
    storage_path  text,

    -- Ordem de exibição; a primeira (menor valor) é a capa
    display_order integer,

    created_at    timestamptz NOT NULL DEFAULT now()
);

-- Índice composto para buscar fotos de um produto já ordenadas
CREATE INDEX idx_images_product_order ON site_product_images (product_id, display_order);
