(function() {
    var sb = getSupabase();
    if (!sb) {
        showConfigError(document.getElementById('product-list-container'));
        return;
    }

    var allProducts = [];
    var container = document.getElementById('product-list-container');
    var searchInput = document.getElementById('search');
    var filterCategory = document.getElementById('filter-category');
    var filterVisibility = document.getElementById('filter-visibility');

    // Delete modal
    var deleteModal = document.getElementById('delete-modal');
    var deleteProductName = document.getElementById('delete-product-name');
    var deleteCancelBtn = document.getElementById('delete-cancel');
    var deleteConfirmBtn = document.getElementById('delete-confirm');
    var pendingDeleteId = null;

    async function init() {
        var session = await requireAuth();
        if (!session) return;
        await loadProducts();

        searchInput.addEventListener('input', renderFiltered);
        filterCategory.addEventListener('change', renderFiltered);
        filterVisibility.addEventListener('change', renderFiltered);
    }

    async function loadProducts() {
        container.innerHTML = '<div class="state-loading">Carregando produtos...</div>';
        try {
            var result = await sb
                .from('site_products')
                .select('*, site_product_images(id, image_url, display_order)')
                .order('display_order', { ascending: true, nullsFirst: false })
                .order('created_at', { ascending: false });

            if (result.error) throw result.error;
            allProducts = result.data || [];
            renderFiltered();
        } catch (err) {
            container.innerHTML = '<div class="state-error">Erro ao carregar produtos: ' +
                escapeHtml(err.message || 'Erro desconhecido') + '</div>';
        }
    }

    function renderFiltered() {
        var search = searchInput.value.toLowerCase().trim();
        var cat = filterCategory.value;
        var vis = filterVisibility.value;

        var filtered = allProducts.filter(function(p) {
            if (search && p.name.toLowerCase().indexOf(search) === -1) return false;
            if (cat && p.category !== cat) return false;
            if (vis === 'visible' && !p.is_visible) return false;
            if (vis === 'hidden' && p.is_visible) return false;
            return true;
        });

        if (filtered.length === 0 && allProducts.length === 0) {
            container.innerHTML = '<div class="state-empty">Nenhum produto cadastrado ainda. Clique em "+ Novo produto" para começar.</div>';
            return;
        }
        if (filtered.length === 0) {
            container.innerHTML = '<div class="state-empty">Nenhum produto encontrado com esses filtros.</div>';
            return;
        }

        var html = '<div class="product-list">';
        filtered.forEach(function(p) {
            var images = (p.site_product_images || []).sort(function(a, b) {
                return (a.display_order || 0) - (b.display_order || 0);
            });
            var thumb = images.length > 0
                ? '<img class="product-card-thumb" src="' + escapeHtml(images[0].image_url) + '" alt="' + escapeHtml(p.name) + '">'
                : '<div class="product-card-thumb-placeholder">' + getCategoryIcon(p.category) + '</div>';

            html += '<div class="product-card" data-id="' + p.id + '">';
            html += thumb;
            html += '<div class="product-card-info">';
            html += '<h3>' + escapeHtml(p.name) + '</h3>';
            html += '<div class="product-card-meta">';
            html += '<span class="badge badge-category">' + escapeHtml(p.category) + '</span>';
            html += '<span>' + formatPrice(p.price) + '</span>';
            if (!p.is_visible) html += '<span class="badge badge-hidden">Oculto</span>';
            if (p.is_featured) html += '<span class="badge badge-featured">Destaque</span>';
            if (p.badge_tag) html += '<span class="badge badge-tag">' + escapeHtml(p.badge_tag) + '</span>';
            html += '</div></div>';

            html += '<div class="product-card-actions">';
            html += '<div class="product-card-toggles">';
            html += '<label title="Visível no site"><span>👁</span>';
            html += '<label class="toggle"><input type="checkbox" ' + (p.is_visible ? 'checked' : '') +
                ' onchange="window._toggleVisible(\'' + p.id + '\', this.checked)"><span class="toggle-slider"></span></label>';
            html += '</label>';
            html += '<label title="Destaque na home"><span>⭐</span>';
            html += '<label class="toggle"><input type="checkbox" ' + (p.is_featured ? 'checked' : '') +
                ' onchange="window._toggleFeatured(\'' + p.id + '\', this.checked)"><span class="toggle-slider"></span></label>';
            html += '</label>';
            html += '</div>';
            html += '<a href="produto-form.html?id=' + p.id + '" class="btn btn-secondary btn-small">Editar</a>';
            html += '<button class="btn btn-danger btn-small" onclick="window._confirmDelete(\'' + p.id + '\', \'' +
                escapeHtml(p.name).replace(/'/g, "\\'") + '\')">Excluir</button>';
            html += '</div>';
            html += '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
    }

    window._toggleVisible = async function(id, value) {
        var result = await sb.from('site_products').update({ is_visible: value }).eq('id', id);
        if (result.error) {
            showToast('Erro ao atualizar visibilidade: ' + result.error.message, 'error');
            await loadProducts();
            return;
        }
        var p = allProducts.find(function(x) { return x.id === id; });
        if (p) p.is_visible = value;
        showToast(value ? 'Produto visível no site' : 'Produto oculto do site');
        renderFiltered();
    };

    window._toggleFeatured = async function(id, value) {
        var result = await sb.from('site_products').update({ is_featured: value }).eq('id', id);
        if (result.error) {
            showToast('Erro ao atualizar destaque: ' + result.error.message, 'error');
            await loadProducts();
            return;
        }
        var p = allProducts.find(function(x) { return x.id === id; });
        if (p) p.is_featured = value;
        showToast(value ? 'Produto marcado como destaque' : 'Destaque removido');
        renderFiltered();
    };

    window._confirmDelete = function(id, name) {
        pendingDeleteId = id;
        deleteProductName.textContent = name;
        deleteModal.style.display = 'flex';
    };

    deleteCancelBtn.addEventListener('click', function() {
        deleteModal.style.display = 'none';
        pendingDeleteId = null;
    });

    deleteConfirmBtn.addEventListener('click', async function() {
        if (!pendingDeleteId) return;
        deleteConfirmBtn.disabled = true;
        deleteConfirmBtn.textContent = 'Excluindo...';

        try {
            var product = allProducts.find(function(x) { return x.id === pendingDeleteId; });

            // Delete storage files
            if (product && product.site_product_images) {
                var paths = product.site_product_images
                    .filter(function(img) { return img.storage_path; })
                    .map(function(img) { return img.storage_path; });
                if (paths.length > 0) {
                    // Need to fetch full image data including storage_path
                    var imgResult = await sb.from('site_product_images')
                        .select('storage_path')
                        .eq('product_id', pendingDeleteId);
                    if (imgResult.data) {
                        var storagePaths = imgResult.data
                            .filter(function(img) { return img.storage_path; })
                            .map(function(img) { return img.storage_path; });
                        if (storagePaths.length > 0) {
                            await sb.storage.from('product-images').remove(storagePaths);
                        }
                    }
                }
            }

            // Delete product (cascade deletes images rows)
            var result = await sb.from('site_products').delete().eq('id', pendingDeleteId);
            if (result.error) throw result.error;

            showToast('Produto excluído');
            deleteModal.style.display = 'none';
            pendingDeleteId = null;
            await loadProducts();
        } catch (err) {
            showToast('Erro ao excluir: ' + (err.message || 'Erro desconhecido'), 'error');
        } finally {
            deleteConfirmBtn.disabled = false;
            deleteConfirmBtn.textContent = 'Excluir';
        }
    });

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    init();
})();
