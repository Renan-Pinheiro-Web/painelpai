// Inicializa Supabase client
function getSupabase() {
    if (SUPABASE_URL.startsWith('COLE_')) {
        return null;
    }
    if (!window._supabaseClient) {
        window._supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return window._supabaseClient;
}

function showConfigError(container) {
    container = container || document.body;
    const div = document.createElement('div');
    div.className = 'state-error';
    div.innerHTML = '<p><strong>Supabase não configurado.</strong></p>' +
        '<p>Edite o arquivo <code>supabase-config.js</code> com a URL e anon key do seu projeto.</p>';
    container.innerHTML = '';
    container.appendChild(div);
}

async function getSession() {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session;
}

async function requireAuth() {
    const session = await getSession();
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }
    return session;
}

async function redirectIfLoggedIn() {
    const session = await getSession();
    if (session) {
        window.location.href = 'produtos.html';
    }
}

async function logout() {
    const sb = getSupabase();
    if (sb) {
        await sb.auth.signOut();
    }
    window.location.href = 'login.html';
}

function showToast(message, type) {
    type = type || 'success';
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 4000);
}

function formatPrice(value) {
    return parseFloat(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function slugify(text) {
    return text
        .toString()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function isValidSlug(slug) {
    return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

function getCategoryIcon(category) {
    switch (category) {
        case 'Kits': return '📦';
        case 'Reparadores': return '💧';
        case 'Protetores térmicos': return '🛡️';
        default: return '📦';
    }
}
