(function() {
    var sb = getSupabase();
    if (!sb) {
        showConfigError(document.getElementById('form-container'));
        return;
    }

    var params = new URLSearchParams(window.location.search);
    var productId = params.get('id');
    var isEdit = !!productId;
    var originalSlug = '';
    var chips = [];
    var photos = []; // { id?, file?, url, storagePath?, isNew, markedForDeletion }

    // DOM refs
    var form = document.getElementById('product-form');
    var pageTitle = document.getElementById('page-title');
    var saveBtn = document.getElementById('save-btn');
    var nameInput = document.getElementById('name');
    var slugInput = document.getElementById('slug');
    var slugError = document.getElementById('slug-error');
    var categoryInput = document.getElementById('category');
    var priceInput = document.getElementById('price');
    var brandInput = document.getElementById('brand');
    var volumeInput = document.getElementById('volume_label');
    var shortDescInput = document.getElementById('short_description');
    var fullDescInput = document.getElementById('full_description');
    var bgVariantInput = document.getElementById('background_variant');
    var badgeInput = document.getElementById('badge_tag');
    var displayOrderInput = document.getElementById('display_order');
    var isVisibleInput = document.getElementById('is_visible');
    var isFeaturedInput = document.getElementById('is_featured');
    var chipsContainer = document.getElementById('chips-container');
    var chipsInput = document.getElementById('chips-input');
    var photoGrid = document.getElementById('photo-grid');
    var photoUploadArea = document.getElementById('photo-upload-area');
    var photoFileInput = document.getElementById('photo-input');
    var variantSwatch = document.getElementById('variant-swatch');
    var variantLabel = document.getElementById('variant-label');

    // Preview refs
    var previewImg = document.getElementById('preview-img');
    var previewBody = document.getElementById('preview-body');
    var previewBadge = document.getElementById('preview-badge');
    var previewCategory = document.getElementById('preview-category');
    var previewName = document.getElementById('preview-name');
    var previewBrand = document.getElementById('preview-brand');
    var previewPrice = document.getElementById('preview-price');
    var previewTags = document.getElementById('preview-tags');

    var variantColors = {
        escuro: { bg: '#2C2420', label: 'Fundo escuro' },
        claro:  { bg: '#FFFFFF', label: 'Fundo claro' },
        creme:  { bg: '#F5EDE6', label: 'Fundo creme' }
    };

    async function init() {
        var session = await requireAuth();
        if (!session) return;

        if (isEdit) {
            pageTitle.textContent = 'Editar produto';
            document.title = 'Editar produto — Painel Renato Pinheiro';
            await loadProduct();
        }

        setupEventListeners();
        updatePreview();
    }

    async function loadProduct() {
        var loading = document.getElementById('form-loading');
        loading.style.display = '';
        form.style.display = 'none';

        try {
            var result = await sb
                .from('site_products')
                .select('*, site_product_images(id, image_url, storage_path, display_order)')
                .eq('id', productId)
                .single();

            if (result.error) throw result.error;
            var p = result.data;

            nameInput.value = p.name || '';
            slugInput.value = p.slug || '';
            originalSlug = p.slug || '';
            categoryInput.value = p.category || '';
            priceInput.value = p.price || '';
            brandInput.value = p.brand || '';
            volumeInput.value = p.volume_label || '';
            shortDescInput.value = p.short_description || '';
            fullDescInput.value = p.full_description || '';
            bgVariantInput.value = p.background_variant || 'escuro';
            badgeInput.value = p.badge_tag || '';
            displayOrderInput.value = p.display_order != null ? p.display_order : '';
            isVisibleInput.checked = p.is_visible;
            isFeaturedInput.checked = p.is_featured;

            chips = (p.fragrance_notes || []).slice();
            renderChips();

            var images = (p.site_product_images || []).sort(function(a, b) {
                return (a.display_order || 0) - (b.display_order || 0);
            });
            photos = images.map(function(img) {
                return {
                    id: img.id,
                    url: img.image_url,
                    storagePath: img.storage_path,
                    isNew: false,
                    markedForDeletion: false
                };
            });
            renderPhotos();
            updateVariantSwatch();

            loading.style.display = 'none';
            form.style.display = '';
        } catch (err) {
            loading.innerHTML = '<div class="state-error">Erro ao carregar produto: ' + (err.message || 'Erro desconhecido') + '</div>';
        }
    }

    function setupEventListeners() {
        nameInput.addEventListener('input', function() {
            if (!isEdit || slugInput.value === slugify(nameInput.defaultValue || '')) {
                slugInput.value = slugify(nameInput.value);
            }
            if (!isEdit) {
                slugInput.value = slugify(nameInput.value);
            }
            updatePreview();
        });

        slugInput.addEventListener('input', function() {
            validateSlugFormat();
            updatePreview();
        });

        categoryInput.addEventListener('change', updatePreview);
        priceInput.addEventListener('input', updatePreview);
        brandInput.addEventListener('input', updatePreview);
        badgeInput.addEventListener('input', updatePreview);
        bgVariantInput.addEventListener('change', function() {
            updateVariantSwatch();
            updatePreview();
        });

        // Chips
        chipsInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                var val = chipsInput.value.trim();
                if (val && chips.indexOf(val) === -1) {
                    chips.push(val);
                    renderChips();
                    updatePreview();
                }
                chipsInput.value = '';
            }
            if (e.key === 'Backspace' && !chipsInput.value && chips.length > 0) {
                chips.pop();
                renderChips();
                updatePreview();
            }
        });
        chipsContainer.addEventListener('click', function() { chipsInput.focus(); });

        // Photo upload
        photoUploadArea.addEventListener('click', function() { photoFileInput.click(); });
        photoFileInput.addEventListener('change', function() {
            handleFiles(photoFileInput.files);
            photoFileInput.value = '';
        });
        photoUploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            photoUploadArea.classList.add('drag-active');
        });
        photoUploadArea.addEventListener('dragleave', function() {
            photoUploadArea.classList.remove('drag-active');
        });
        photoUploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            photoUploadArea.classList.remove('drag-active');
            handleFiles(e.dataTransfer.files);
        });

        // Form submit
        form.addEventListener('submit', handleSave);
    }

    function validateSlugFormat() {
        var slug = slugInput.value;
        slugError.style.display = 'none';
        slugInput.parentElement.classList.remove('has-error');

        if (slug && !isValidSlug(slug)) {
            slugError.textContent = 'Slug inválido. Use apenas letras minúsculas, números e hífens.';
            slugError.style.display = '';
            slugInput.parentElement.classList.add('has-error');
            return false;
        }
        return true;
    }

    function updateVariantSwatch() {
        var v = bgVariantInput.value;
        var info = variantColors[v] || variantColors.escuro;
        variantSwatch.style.background = info.bg;
        variantLabel.textContent = info.label;
    }

    // ---- Chips ----
    function renderChips() {
        var existingChips = chipsContainer.querySelectorAll('.chip');
        existingChips.forEach(function(c) { c.remove(); });

        chips.forEach(function(text, i) {
            var chip = document.createElement('span');
            chip.className = 'chip';
            chip.innerHTML = escapeHtml(text) + '<button type="button" data-index="' + i + '">×</button>';
            chip.querySelector('button').addEventListener('click', function() {
                chips.splice(i, 1);
                renderChips();
                updatePreview();
            });
            chipsContainer.insertBefore(chip, chipsInput);
        });
    }

    // ---- Photos ----
    async function handleFiles(fileList) {
        for (var i = 0; i < fileList.length; i++) {
            var file = fileList[i];
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                showToast('Formato não suportado: ' + file.name + '. Use JPEG, PNG ou WebP.', 'error');
                continue;
            }
            if (file.size > 5 * 1024 * 1024) {
                showToast('Arquivo muito grande: ' + file.name + '. Máximo 5 MB.', 'error');
                continue;
            }

            try {
                var processed = await processImage(file);
                photos.push({
                    file: processed.blob,
                    url: processed.dataUrl,
                    isNew: true,
                    markedForDeletion: false
                });
            } catch (err) {
                showToast('Erro ao processar ' + file.name, 'error');
            }
        }
        renderPhotos();
        updatePreview();
    }

    function processImage(file) {
        return new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onload = function(e) {
                var img = new Image();
                img.onload = function() {
                    var maxSize = 1600;
                    var w = img.width;
                    var h = img.height;
                    if (w > maxSize || h > maxSize) {
                        if (w > h) {
                            h = Math.round(h * maxSize / w);
                            w = maxSize;
                        } else {
                            w = Math.round(w * maxSize / h);
                            h = maxSize;
                        }
                    }
                    var canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    canvas.toBlob(function(blob) {
                        if (!blob) { reject(new Error('Falha ao converter')); return; }
                        var dataUrl = URL.createObjectURL(blob);
                        resolve({ blob: blob, dataUrl: dataUrl });
                    }, 'image/webp', 0.82);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function renderPhotos() {
        var visiblePhotos = photos.filter(function(p) { return !p.markedForDeletion; });
        if (visiblePhotos.length === 0) {
            photoGrid.innerHTML = '';
            return;
        }

        photoGrid.innerHTML = '';
        visiblePhotos.forEach(function(photo, index) {
            var realIndex = photos.indexOf(photo);
            var div = document.createElement('div');
            div.className = 'photo-item';
            div.draggable = true;
            div.dataset.index = realIndex;

            var img = document.createElement('img');
            img.src = photo.url;
            img.alt = 'Foto ' + (index + 1);
            div.appendChild(img);

            if (index === 0) {
                var badge = document.createElement('span');
                badge.className = 'photo-badge-cover';
                badge.textContent = 'CAPA';
                div.appendChild(badge);
            }

            var removeBtn = document.createElement('button');
            removeBtn.className = 'photo-remove';
            removeBtn.textContent = '×';
            removeBtn.type = 'button';
            removeBtn.addEventListener('click', function() {
                photo.markedForDeletion = true;
                renderPhotos();
                updatePreview();
            });
            div.appendChild(removeBtn);

            // Drag and drop reorder
            div.addEventListener('dragstart', function(e) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', realIndex);
                div.classList.add('dragging');
            });
            div.addEventListener('dragend', function() { div.classList.remove('dragging'); });
            div.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                div.classList.add('drag-over');
            });
            div.addEventListener('dragleave', function() { div.classList.remove('drag-over'); });
            div.addEventListener('drop', function(e) {
                e.preventDefault();
                div.classList.remove('drag-over');
                var fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                var toIdx = realIndex;
                if (fromIdx === toIdx) return;
                var item = photos.splice(fromIdx, 1)[0];
                photos.splice(toIdx, 0, item);
                renderPhotos();
                updatePreview();
            });

            photoGrid.appendChild(div);
        });
    }

    // ---- Preview ----
    function updatePreview() {
        var name = nameInput.value || 'Nome do produto';
        var category = categoryInput.value || 'Categoria';
        var price = priceInput.value ? formatPrice(priceInput.value) : 'R$ 0,00';
        var brand = brandInput.value;
        var badge = badgeInput.value;
        var variant = bgVariantInput.value || 'escuro';

        previewName.textContent = name;
        previewCategory.textContent = category;
        previewPrice.textContent = price;
        previewBrand.textContent = brand;
        previewBrand.style.display = brand ? '' : 'none';

        if (badge) {
            previewBadge.textContent = badge;
            previewBadge.style.display = '';
        } else {
            previewBadge.style.display = 'none';
        }

        previewBody.className = 'preview-card-body bg-' + variant;

        // Tags
        previewTags.innerHTML = '';
        chips.forEach(function(tag) {
            var span = document.createElement('span');
            span.className = 'preview-tag';
            span.textContent = tag;
            previewTags.appendChild(span);
        });

        // Image
        var visiblePhotos = photos.filter(function(p) { return !p.markedForDeletion; });
        if (visiblePhotos.length > 0) {
            previewImg.innerHTML = '<img class="preview-card-img" src="' + visiblePhotos[0].url + '" alt="Preview">';
            previewImg.className = '';
        } else {
            previewImg.innerHTML = getCategoryIcon(categoryInput.value);
            previewImg.className = 'fallback-icon';
        }
    }

    // ---- Save ----
    async function handleSave(e) {
        e.preventDefault();

        if (!validateSlugFormat()) {
            showToast('Corrija o slug antes de salvar.', 'error');
            return;
        }

        var slug = slugInput.value.trim();
        if (!slug) {
            showToast('Slug é obrigatório.', 'error');
            return;
        }

        // Check slug uniqueness
        if (slug !== originalSlug) {
            var slugCheck = await sb.from('site_products').select('id').eq('slug', slug);
            if (slugCheck.data && slugCheck.data.length > 0) {
                slugError.textContent = 'Esse slug já está em uso por outro produto.';
                slugError.style.display = '';
                slugInput.parentElement.classList.add('has-error');
                showToast('Slug duplicado.', 'error');
                return;
            }
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';

        try {
            var productData = {
                name: nameInput.value.trim(),
                slug: slug,
                category: categoryInput.value,
                price: parseFloat(priceInput.value),
                brand: brandInput.value.trim() || null,
                volume_label: volumeInput.value.trim() || null,
                short_description: shortDescInput.value.trim() || null,
                full_description: fullDescInput.value.trim() || null,
                fragrance_notes: chips.length > 0 ? chips : null,
                background_variant: bgVariantInput.value,
                badge_tag: badgeInput.value.trim() || null,
                display_order: displayOrderInput.value ? parseInt(displayOrderInput.value) : null,
                is_visible: isVisibleInput.checked,
                is_featured: isFeaturedInput.checked
            };

            var savedProductId;

            if (isEdit) {
                var result = await sb.from('site_products').update(productData).eq('id', productId).select().single();
                if (result.error) throw result.error;
                savedProductId = productId;
            } else {
                var result = await sb.from('site_products').insert(productData).select().single();
                if (result.error) throw result.error;
                savedProductId = result.data.id;
            }

            // Handle photo deletions
            var toDelete = photos.filter(function(p) { return p.markedForDeletion && !p.isNew && p.id; });
            for (var i = 0; i < toDelete.length; i++) {
                var photo = toDelete[i];
                if (photo.storagePath) {
                    await sb.storage.from('product-images').remove([photo.storagePath]);
                }
                await sb.from('site_product_images').delete().eq('id', photo.id);
            }

            // Upload new photos
            var visiblePhotos = photos.filter(function(p) { return !p.markedForDeletion; });
            for (var i = 0; i < visiblePhotos.length; i++) {
                var photo = visiblePhotos[i];
                if (photo.isNew && photo.file) {
                    var ts = Date.now();
                    var path = savedProductId + '/' + ts + '-' + i + '.webp';

                    var uploadResult = await sb.storage
                        .from('product-images')
                        .upload(path, photo.file, { contentType: 'image/webp', upsert: false });

                    if (uploadResult.error) throw uploadResult.error;

                    var publicUrl = sb.storage.from('product-images').getPublicUrl(path);

                    var imgInsert = await sb.from('site_product_images').insert({
                        product_id: savedProductId,
                        image_url: publicUrl.data.publicUrl,
                        storage_path: path,
                        display_order: i
                    });
                    if (imgInsert.error) throw imgInsert.error;

                    photo.isNew = false;
                    photo.id = imgInsert.data ? imgInsert.data[0].id : null;
                    photo.storagePath = path;
                    photo.url = publicUrl.data.publicUrl;
                } else if (!photo.isNew && photo.id) {
                    // Update display_order for existing photos
                    await sb.from('site_product_images').update({ display_order: i }).eq('id', photo.id);
                }
            }

            showToast(isEdit ? 'Produto atualizado!' : 'Produto criado!');
            setTimeout(function() {
                window.location.href = 'produtos.html';
            }, 800);

        } catch (err) {
            var msg = err.message || 'Erro desconhecido';
            if (msg.indexOf('duplicate') !== -1 || msg.indexOf('unique') !== -1) {
                msg = 'Slug duplicado. Escolha outro slug.';
                slugError.textContent = msg;
                slugError.style.display = '';
                slugInput.parentElement.classList.add('has-error');
            }
            showToast('Erro ao salvar: ' + msg, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar produto';
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    init();
})();
