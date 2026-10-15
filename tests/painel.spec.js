const { test, expect } = require('@playwright/test');

const MOCK_SUPABASE_CONFIG = `
    const SUPABASE_URL = 'https://fake-project.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-anon-key';
`;

const MOCK_PRODUCTS = [
    {
        id: '11111111-1111-1111-1111-111111111111',
        slug: 'kit-reparacao-completa',
        name: 'Kit Reparação Completa',
        price: 189.90,
        brand: 'Renato Pinheiro',
        category: 'Kits',
        short_description: 'Kit completo para reparação capilar',
        full_description: 'Descrição completa do kit',
        volume_label: '300ml',
        fragrance_notes: ['Cabelos secos', 'Cabelos danificados'],
        background_variant: 'escuro',
        badge_tag: 'Mais pedido',
        is_visible: true,
        is_featured: true,
        display_order: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        site_product_images: [
            { id: 'img-1', image_url: 'https://via.placeholder.com/400x400/E8D5C0/2C2420?text=Kit', display_order: 0 }
        ]
    },
    {
        id: '22222222-2222-2222-2222-222222222222',
        slug: 'protetor-termico-gold',
        name: 'Protetor Térmico Gold',
        price: 79.90,
        brand: 'Renato Pinheiro',
        category: 'Protetores térmicos',
        short_description: 'Proteção térmica profissional',
        full_description: null,
        volume_label: '200ml',
        fragrance_notes: ['Todos os tipos'],
        background_variant: 'claro',
        badge_tag: null,
        is_visible: false,
        is_featured: false,
        display_order: 2,
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        site_product_images: []
    }
];

async function setupSupabaseMock(page) {
    await page.route('**/supabase-config.js', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: MOCK_SUPABASE_CONFIG
        });
    });
    await page.route('**/realtime/**', (route) => route.abort());
}

async function mockAuthLoggedIn(page) {
    await page.addInitScript(() => {
        window.__MOCK_AUTH_LOGGED_IN__ = true;
    });
    await page.route('**/auth.js', async (route) => {
        const response = await route.fetch();
        const body = await response.text();
        const override = body + `
;(function() {
    var _origGetSession = getSession;
    var _origRequireAuth = requireAuth;

    window.getSession = async function() {
        if (window.__MOCK_AUTH_LOGGED_IN__) {
            return { access_token: 'fake', user: { id: 'u1', email: 'admin@test.com' } };
        }
        return null;
    };
    window.requireAuth = async function() {
        var s = await getSession();
        if (!s) { window.location.href = 'login.html'; return null; }
        return s;
    };
    window.redirectIfLoggedIn = async function() {
        if (window.__MOCK_AUTH_LOGGED_IN__) {
            window.location.href = 'produtos.html';
        }
    };
    window.getSupabase = function() {
        if (SUPABASE_URL.startsWith('COLE_')) return null;
        return {
            auth: {
                getSession: async function() { return { data: { session: window.__MOCK_AUTH_LOGGED_IN__ ? { access_token: 'fake', user: { id: 'u1', email: 'admin@test.com' } } : null } }; },
                signInWithPassword: async function() { return { error: { message: 'Invalid' } }; },
                signOut: async function() { return {}; }
            },
            from: function(table) { return window.__mockSupabaseFrom(table); },
            storage: { from: function(bucket) { return window.__mockSupabaseStorage(bucket); } }
        };
    };
})();
`;
        await route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: override
        });
    });
}

async function mockAuthLoggedOut(page) {
    await page.route('**/auth.js', async (route) => {
        const response = await route.fetch();
        const body = await response.text();
        const override = body + `
;(function() {
    window.getSupabase = function() {
        if (SUPABASE_URL.startsWith('COLE_')) return null;
        return {
            auth: {
                getSession: async function() { return { data: { session: null } }; },
                signInWithPassword: async function(creds) {
                    return { error: { message: 'Invalid login credentials' } };
                },
                signOut: async function() { return {}; }
            },
            from: function() { return {}; },
            storage: { from: function() { return {}; } }
        };
    };
})();
`;
        await route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: override
        });
    });
}

async function mockSupabaseRest(page) {
    await page.addInitScript((products) => {
        window.__mockProducts = products;
        window.__mockSupabaseFrom = function(table) {
            var data = table === 'site_products' ? window.__mockProducts : [];
            return {
                select: function() { return this; },
                eq: function() { return this; },
                neq: function() { return this; },
                order: function() { return this; },
                single: function() { return this; },
                insert: function(row) {
                    return { data: Object.assign({}, row, { id: 'new-id' }), error: null,
                        select: function() { return { single: function() { return { data: Object.assign({}, row, { id: 'new-id' }), error: null }; } }; }
                    };
                },
                update: function(row) {
                    return {
                        eq: function() {
                            return {
                                select: function() {
                                    return { single: function() { return { data: Object.assign({}, row, { id: '11111111-1111-1111-1111-111111111111' }), error: null }; } };
                                },
                                data: row, error: null
                            };
                        },
                        data: row, error: null
                    };
                },
                delete: function() { return { eq: function() { return { data: null, error: null }; } }; },
                then: function(resolve) { resolve({ data: data, error: null }); return Promise.resolve({ data: data, error: null }); }
            };
        };
        window.__mockSupabaseStorage = function(bucket) {
            return {
                upload: async function() { return { data: { path: 'test.webp' }, error: null }; },
                remove: async function() { return { data: null, error: null }; },
                getPublicUrl: function(path) { return { data: { publicUrl: 'https://fake.supabase.co/storage/' + path } }; }
            };
        };
    }, MOCK_PRODUCTS);
}


// ---- LOGIN PAGE ----

test.describe('Login', () => {
    test('shows login form', async ({ page }) => {
        await setupSupabaseMock(page);
        await mockAuthLoggedOut(page);
        await page.goto('/login.html');
        await expect(page.locator('#login-form')).toBeVisible();
        await expect(page.locator('h1')).toContainText('Renato Pinheiro');
        await page.screenshot({ path: `test-results/login-${test.info().project.name}.png` });
    });

    test('shows error on wrong credentials', async ({ page }) => {
        await setupSupabaseMock(page);
        await mockAuthLoggedOut(page);
        await page.goto('/login.html');

        await page.fill('#email', 'wrong@email.com');
        await page.fill('#password', 'wrongpass');
        await page.click('#login-btn');

        await expect(page.locator('#login-error')).toBeVisible();
        await expect(page.locator('#login-error')).toContainText('incorretos');
    });

    test('shows config error when not configured', async ({ page }) => {
        await page.route('**/supabase-config.js', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/javascript',
                body: "const SUPABASE_URL = 'COLE_SUA_PROJECT_URL_AQUI'; const SUPABASE_ANON_KEY = 'COLE_SUA_ANON_KEY_AQUI';"
            });
        });
        await page.goto('/login.html');
        await expect(page.locator('.state-error')).toBeVisible();
        await expect(page.locator('.state-error')).toContainText('supabase-config.js');
    });

    test('has noindex meta tag', async ({ page }) => {
        await page.goto('/login.html');
        const robots = await page.getAttribute('meta[name="robots"]', 'content');
        expect(robots).toContain('noindex');
    });
});

// ---- PRODUCTS PAGE ----

test.describe('Produtos', () => {
    test.beforeEach(async ({ page }) => {
        await setupSupabaseMock(page);
        await mockAuthLoggedIn(page);
        await mockSupabaseRest(page);
    });

    test('renders product list with mock data', async ({ page }) => {
        await page.goto('/produtos.html');
        await page.waitForSelector('.product-card', { timeout: 5000 });

        const cards = page.locator('.product-card');
        await expect(cards).toHaveCount(2);

        await expect(page.locator('.product-card').first()).toContainText('Kit Reparação Completa');
        await expect(page.locator('.product-card').last()).toContainText('Protetor Térmico Gold');

        await expect(page.locator('.badge-hidden')).toHaveCount(1);
        await expect(page.locator('.badge-featured')).toHaveCount(1);

        await page.screenshot({ path: `test-results/produtos-${test.info().project.name}.png` });
    });

    test('search filters products', async ({ page }) => {
        await page.goto('/produtos.html');
        await page.waitForSelector('.product-card');

        await page.fill('#search', 'protetor');
        await expect(page.locator('.product-card')).toHaveCount(1);
        await expect(page.locator('.product-card')).toContainText('Protetor');
    });

    test('category filter works', async ({ page }) => {
        await page.goto('/produtos.html');
        await page.waitForSelector('.product-card');

        await page.selectOption('#filter-category', 'Kits');
        await expect(page.locator('.product-card')).toHaveCount(1);
        await expect(page.locator('.product-card')).toContainText('Kit');
    });

    test('visibility filter works', async ({ page }) => {
        await page.goto('/produtos.html');
        await page.waitForSelector('.product-card');

        await page.selectOption('#filter-visibility', 'hidden');
        await expect(page.locator('.product-card')).toHaveCount(1);
        await expect(page.locator('.product-card')).toContainText('Protetor');
    });

    test('shows delete confirmation modal', async ({ page }) => {
        await page.goto('/produtos.html');
        await page.waitForSelector('.product-card');

        await page.locator('.btn-danger').first().click();
        await expect(page.locator('#delete-modal')).toBeVisible();
        await expect(page.locator('#delete-product-name')).toContainText('Kit Reparação Completa');

        await page.click('#delete-cancel');
        await expect(page.locator('#delete-modal')).not.toBeVisible();
    });

    test('has noindex meta tag', async ({ page }) => {
        await page.goto('/produtos.html');
        const robots = await page.getAttribute('meta[name="robots"]', 'content');
        expect(robots).toContain('noindex');
    });
});

// ---- PRODUCT FORM ----

test.describe('Formulário de produto', () => {
    test.beforeEach(async ({ page }) => {
        await setupSupabaseMock(page);
        await mockAuthLoggedIn(page);
        await mockSupabaseRest(page);
    });

    test('renders empty form for new product', async ({ page }) => {
        await page.goto('/produto-form.html');
        await expect(page.locator('#page-title')).toContainText('Novo produto');
        await expect(page.locator('#name')).toHaveValue('');
        await expect(page.locator('#preview-card')).toBeVisible();
        await page.screenshot({ path: `test-results/form-novo-${test.info().project.name}.png` });
    });

    test('auto-generates slug from name', async ({ page }) => {
        await page.goto('/produto-form.html');
        await page.waitForSelector('#name');

        await page.fill('#name', 'Kit Reparação Especial');
        await page.locator('#name').dispatchEvent('input');
        await expect(page.locator('#slug')).toHaveValue('kit-reparacao-especial');
    });

    test('validates invalid slug format', async ({ page }) => {
        await page.goto('/produto-form.html');
        await page.waitForSelector('#slug');

        await page.fill('#slug', 'INVALID SLUG!');
        await page.locator('#slug').dispatchEvent('input');
        await expect(page.locator('#slug-error')).toBeVisible();
        await expect(page.locator('#slug-error')).toContainText('inválido');
    });

    test('invalid slug blocks submit', async ({ page }) => {
        await page.goto('/produto-form.html');
        await page.waitForSelector('#name');

        await page.fill('#name', 'Test');
        await page.fill('#slug', 'INVALID SLUG!');
        await page.locator('#slug').dispatchEvent('input');
        await page.selectOption('#category', 'Kits');
        await page.fill('#price', '10');
        await page.click('#save-btn');

        await expect(page.locator('#slug-error')).toBeVisible();
    });

    test('adds and removes "Indicado para" chips', async ({ page }) => {
        await page.goto('/produto-form.html');
        await page.waitForSelector('#chips-input');

        await page.fill('#chips-input', 'Cabelos secos');
        await page.press('#chips-input', 'Enter');

        await expect(page.locator('.chip')).toHaveCount(1);
        await expect(page.locator('.chip').first()).toContainText('Cabelos secos');

        await expect(page.locator('.preview-tag')).toHaveCount(1);

        await page.fill('#chips-input', 'Cabelos oleosos');
        await page.press('#chips-input', 'Enter');
        await expect(page.locator('.chip')).toHaveCount(2);

        await page.locator('.chip button').first().click();
        await expect(page.locator('.chip')).toHaveCount(1);
        await expect(page.locator('.chip')).toContainText('Cabelos oleosos');
    });

    test('preview updates with form fields', async ({ page }) => {
        await page.goto('/produto-form.html');
        await page.waitForSelector('#name');

        await page.fill('#name', 'Óleo Capilar Premium');
        await page.locator('#name').dispatchEvent('input');
        await expect(page.locator('#preview-name')).toContainText('Óleo Capilar Premium');

        await page.selectOption('#category', 'Reparadores');
        await expect(page.locator('#preview-category')).toContainText('Reparadores');

        await page.fill('#price', '59.90');
        await page.locator('#price').dispatchEvent('input');
        await expect(page.locator('#preview-price')).toContainText('59,90');

        await page.fill('#badge_tag', 'Novo');
        await page.locator('#badge_tag').dispatchEvent('input');
        await expect(page.locator('#preview-badge')).toContainText('Novo');
        await expect(page.locator('#preview-badge')).toBeVisible();
    });

    test('background variant changes preview', async ({ page }) => {
        await page.goto('/produto-form.html');
        await page.waitForSelector('#background_variant');

        await page.selectOption('#background_variant', 'claro');
        await expect(page.locator('#preview-body')).toHaveClass(/bg-claro/);

        await page.selectOption('#background_variant', 'creme');
        await expect(page.locator('#preview-body')).toHaveClass(/bg-creme/);
    });

    test('has noindex meta tag', async ({ page }) => {
        await page.goto('/produto-form.html');
        const robots = await page.getAttribute('meta[name="robots"]', 'content');
        expect(robots).toContain('noindex');
    });

    test('shows three category options only', async ({ page }) => {
        await page.goto('/produto-form.html');
        await page.waitForSelector('#category');

        const options = page.locator('#category option:not([value=""])');
        await expect(options).toHaveCount(3);

        const values = await options.evaluateAll(els => els.map(el => el.value));
        expect(values).toEqual(['Kits', 'Reparadores', 'Protetores térmicos']);
    });
});

// ---- CONSOLE CLEAN ----

test.describe('Console limpo', () => {
    test('no console errors on login page', async ({ page }) => {
        const errors = [];
        page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

        await setupSupabaseMock(page);
        await mockAuthLoggedOut(page);
        await page.goto('/login.html');
        await page.waitForTimeout(1000);

        expect(errors).toEqual([]);
    });
});

// ---- NO HORIZONTAL OVERFLOW ----

test.describe('Sem overflow horizontal', () => {
    test('login page fits viewport', async ({ page }) => {
        await setupSupabaseMock(page);
        await mockAuthLoggedOut(page);
        await page.goto('/login.html');

        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });

    test('produtos page fits viewport', async ({ page }) => {
        await setupSupabaseMock(page);
        await mockAuthLoggedIn(page);
        await mockSupabaseRest(page);
        await page.goto('/produtos.html');
        await page.waitForSelector('.product-card');

        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });

    test('form page fits viewport', async ({ page }) => {
        await setupSupabaseMock(page);
        await mockAuthLoggedIn(page);
        await mockSupabaseRest(page);
        await page.goto('/produto-form.html');
        await page.waitForSelector('#product-form');

        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
});
