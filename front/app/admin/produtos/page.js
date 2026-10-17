'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/app/admin/layout';
import { apiUpload, productImageUrl } from '@/lib/api';
import { brl } from '@/lib/format';
import { useToast } from '@/context/ToastContext';

const ADMIN_PREFIX = '/manage';
const CATEGORIES   = ['society', 'futsal', 'campo', 'acessorios', 'blusas', 'kits'];
const CATEGORY_LABELS = {
  society: 'Society', futsal: 'Futsal', campo: 'Campo',
  acessorios: 'Acessórios', blusas: 'Blusas', kits: 'Kits de Treino',
};
const MAX_IMAGES   = 5;

const EMPTY_FORM = {
  name: '', brand: '', category: 'society', price: '', oldPrice: '',
  description: '', sizes: '', stock_qty: 0, is_active: true, is_featured: false,
  available_for_order: false,   // Pronta entrega
  available_on_request: true,   // Disponível para pedidos (encomenda)
};

const EMPTY_FILTERS = { category: '', brand: '', minPrice: '', maxPrice: '', size: '' };

export default function AdminProdutosPage() {
  const router = useRouter();
  const { token, adminRequest, isAuthenticated } = useAdminAuth();
  const showToast = useToast();

  const [products, setProducts] = useState([]);
  const [status,   setStatus]   = useState('loading');
  const [page,     setPage]     = useState(1);
  const [hasMore,  setHasMore]  = useState(false);
  const [total,    setTotal]    = useState(0);
  const [showInactive, setShowInactive] = useState(false);

  // ── Filtros (categoria, marca, faixa de preço, tamanho) ────────────────────
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filterMeta, setFilterMeta] = useState({ brands: [], sizes: [] });

  const [showForm,   setShowForm]   = useState(false);
  const [editingId,  setEditingId]  = useState(null);
  const [formData,   setFormData]   = useState(EMPTY_FORM);
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState('');

  // ── Galeria de imagens (até MAX_IMAGES por produto) ────────────────────────
  // Ao editar: galleryImages vem do produto (já salvas no banco) e cada ação
  // (adicionar/remover/reordenar/definir principal) chama a API na hora.
  // Ao criar: ainda não existe produto, então os arquivos ficam em
  // pendingFiles e só são enviados depois que o produto é criado.
  const [galleryImages, setGalleryImages] = useState([]);
  const [pendingFiles,  setPendingFiles]  = useState([]);
  const [galleryBusy,   setGalleryBusy]   = useState(false);

  // ── Variantes de tamanho/estoque (etapa 18) ─────────────────────────────
  // Só existem depois que o produto foi criado (precisam de product_id),
  // igual à galeria de imagens: carregadas ao abrir a edição, salvas com
  // seu próprio botão (PUT substitui a lista inteira de uma vez).
  const [variantRows,   setVariantRows]   = useState([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantsBusy,  setVariantsBusy]  = useState(false);
  const [variantsLoaded, setVariantsLoaded] = useState(false);
  const [customSize, setCustomSize] = useState('');

  // Produto marcado para exclusão — abre o modal de confirmação.
  // null = nenhum modal aberto.
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Exclusão em massa: exige digitar uma frase de confirmação, já que
  // afeta todos os produtos cadastrados de uma vez.
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deleteAllPhrase, setDeleteAllPhrase] = useState('');
  const [deletingAll, setDeletingAll] = useState(false);
  const DELETE_ALL_PHRASE = 'excluir todos';

  useEffect(() => {
    if (!isAuthenticated) { router.push('/admin/login'); return; }
    adminRequest('/products/meta')
      .then((data) => setFilterMeta({ brands: data.brands || [], sizes: data.sizes || [] }))
      .catch(() => {}); // filtros de marca/tamanho só não aparecem; painel continua funcionando
  }, [isAuthenticated]);

  function buildFilterQuery() {
    const qs = new URLSearchParams();
    if (filters.category)  qs.set('category', filters.category);
    if (filters.brand)     qs.set('brand', filters.brand);
    if (filters.minPrice)  qs.set('minPrice', filters.minPrice);
    if (filters.maxPrice)  qs.set('maxPrice', filters.maxPrice);
    if (filters.size)      qs.set('size', filters.size);
    // Sem isso, o total/paginação contam TODOS os produtos (ativos +
    // inativos) mesmo quando a tabela só mostra os ativos — daí o contador
    // não bater com "Nenhum produto encontrado" depois de excluir tudo.
    if (!showInactive)     qs.set('status', 'active');
    const s = qs.toString();
    return s ? `&${s}` : '';
  }

  async function loadProducts(p) {
    setStatus('loading');
    try {
      const data = await adminRequest(`/products?page=${p}&limit=20${buildFilterQuery()}`);
      setProducts(data.products || []);
      setHasMore(!!data.hasMore);
      setTotal(typeof data.total === 'number' ? data.total : (data.products || []).length);
      setPage(p);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  function handleFilterChange(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  // Recarrega sempre que um filtro (ou o toggle de inativos) muda (volta pra página 1).
  useEffect(() => {
    if (!isAuthenticated) return;
    loadProducts(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, showInactive]);

  function closeForm() {
    pendingFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setPendingFiles([]);
    setGalleryImages([]);
    setVariantRows([]);
    setShowForm(false);
  }

  function openCreate() {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setGalleryImages([]);
    setPendingFiles([]);
    setVariantRows([]);
    setVariantsLoaded(true);
    setCustomSize('');
    setFormError('');
    setShowForm(true);
  }

  function openEdit(product) {
    setEditingId(product.id);
    setFormData({
      name:        product.name || '',
      brand:       product.brand || '',
      category:    product.category || 'society',
      price:       product.price || '',
      oldPrice:    product.oldPrice || '',
      description: product.desc || '',
      sizes:       (product.sizes || []).join(', '),
      stock_qty:   product.stock_qty ?? 0,
      is_active:   product.is_active === undefined ? true : Boolean(product.is_active),
      is_featured: !!product.is_featured,
      available_for_order: !!product.available_for_order,
      available_on_request: !!product.available_on_request,
    });
    // Galeria já salva no banco — normaliza pra ordem de exibição.
    const existingImages = (product.images && product.images.length > 0)
      ? product.images
      : (product.image ? [{ id: null, url: product.image, isPrimary: true, sortOrder: 0 }] : []);
    setGalleryImages([...existingImages].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
    setPendingFiles([]);
    setFormError('');
    setShowForm(true);
    loadVariants(product.id);
  }

  function handleFieldChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  // ── Galeria: seleção de novos arquivos ─────────────────────────────────────
  // No modo criação: só guarda em memória (pendingFiles) até o produto ser
  // criado. No modo edição: já sobe pra API na hora (o produto já existe).
  async function handleAddFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const currentCount = galleryImages.length + pendingFiles.length;
    const allowed = MAX_IMAGES - currentCount;
    if (allowed <= 0) {
      showToast(`Limite de ${MAX_IMAGES} imagens por produto atingido.`, 'error');
      return;
    }
    const toAdd = files.slice(0, allowed);
    if (files.length > allowed) {
      showToast(`Só é possível adicionar mais ${allowed} imagem(ns) (máximo ${MAX_IMAGES} por produto).`, 'error');
    }

    if (editingId) {
      setGalleryBusy(true);
      try {
        const fd = new FormData();
        toAdd.forEach((f) => fd.append('images', f));
        const res = await apiUpload(`${ADMIN_PREFIX}/products/${editingId}/images`, { method: 'POST', formData: fd, token });
        const inserted = res.images || [];
        setGalleryImages((prev) => {
          const anyPrimary = inserted.some((img) => img.isPrimary);
          const base = anyPrimary ? prev.map((img) => ({ ...img, isPrimary: false })) : prev;
          return [...base, ...inserted];
        });
        showToast('Imagem(ns) adicionada(s) à galeria!', 'success');
      } catch (err) {
        showToast(err.message || 'Erro ao enviar imagem. Tente novamente.', 'error');
      } finally {
        setGalleryBusy(false);
      }
    } else {
      const withPreview = toAdd.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
      setPendingFiles((prev) => [...prev, ...withPreview]);
    }
  }

  function removePendingFile(index) {
    setPendingFiles((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function movePendingFile(index, direction) {
    setPendingFiles((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function removeExistingImage(imageId) {
    setGalleryBusy(true);
    try {
      await adminRequest(`/products/${editingId}/images/${imageId}`, { method: 'DELETE' });
      setGalleryImages((prev) => {
        const removed = prev.find((img) => img.id === imageId);
        const rest = prev.filter((img) => img.id !== imageId);
        // Mesma regra do backend: se a removida era a principal, a próxima
        // (por ordem) assume o posto.
        if (removed?.isPrimary && rest.length > 0) {
          const sorted = [...rest].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          sorted[0].isPrimary = true;
          return sorted;
        }
        return rest;
      });
      showToast('Imagem removida.', 'success');
    } catch (err) {
      showToast(err.message || 'Erro ao remover imagem. Tente novamente.', 'error');
    } finally {
      setGalleryBusy(false);
    }
  }

  async function setPrimaryImage(imageId) {
    setGalleryBusy(true);
    try {
      await adminRequest(`/products/${editingId}/images/${imageId}/primary`, { method: 'PATCH' });
      setGalleryImages((prev) => prev.map((img) => ({ ...img, isPrimary: img.id === imageId })));
      showToast('Imagem principal definida.', 'success');
    } catch (err) {
      showToast(err.message || 'Erro ao definir imagem principal. Tente novamente.', 'error');
    } finally {
      setGalleryBusy(false);
    }
  }

  async function moveExistingImage(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= galleryImages.length) return;
    const reordered = [...galleryImages];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    setGalleryImages(reordered);
    setGalleryBusy(true);
    try {
      await adminRequest(`/products/${editingId}/images/reorder`, {
        method: 'PATCH',
        body: { order: reordered.map((img) => img.id) },
      });
    } catch (err) {
      showToast(err.message || 'Erro ao reordenar imagens. Tente novamente.', 'error');
      setGalleryImages(galleryImages); // desfaz a reordenação otimista em caso de erro
    } finally {
      setGalleryBusy(false);
    }
  }

  // ── Variantes de tamanho/estoque (etapa 18) ─────────────────────────────
  async function loadVariants(productId) {
    setVariantsLoading(true);
    setVariantsLoaded(false);
    setCustomSize('');
    try {
      const rows = await adminRequest(`/products/${productId}/variants`);
      setVariantRows(rows.map((v) => ({ ...v, active: !!v.active })));
      setVariantsLoaded(true);
    } catch (err) {
      showToast(err.message || 'Erro ao carregar tamanhos. Tente novamente.', 'error');
      setVariantRows([]);
    } finally {
      setVariantsLoading(false);
    }
  }

  // ── Números em pronta entrega ──────────────────────────────────────────
  // O admin toca nos números que tem em estoque e informa a quantidade de cada
  // um. Chuteiras (society, futsal, campo) já mostram 37 ao 45; qualquer outro
  // número/tamanho entra pelo campo "Outro número".
  const isChuteiraCat = ['society', 'futsal', 'campo'].includes(formData.category);
  const baseSizes = isChuteiraCat ? Array.from({ length: 9 }, (_, i) => String(37 + i)) : [];

  function sortSizeRows(list) {
    return [...list].sort((a, b) => {
      const na = Number(a.size);
      const nb = Number(b.size);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      if (Number.isFinite(na)) return -1;
      if (Number.isFinite(nb)) return 1;
      return String(a.size).localeCompare(String(b.size));
    });
  }

  function toggleSize(size) {
    const key = String(size);
    setVariantRows((prev) => {
      const exists = prev.some((r) => String(r.size).trim() === key && r.active !== false);
      if (exists) return prev.filter((r) => String(r.size).trim() !== key);
      const withoutOld = prev.filter((r) => String(r.size).trim() !== key);
      return sortSizeRows([...withoutOld, { size: key, stock: 1, active: true }]);
    });
  }

  function setSizeStock(size, value) {
    const key = String(size);
    const n = Math.max(0, Math.floor(Number(value) || 0));
    setVariantRows((prev) => prev.map((r) => (String(r.size).trim() === key ? { ...r, stock: n } : r)));
  }

  function selectAllBase() {
    setVariantRows((prev) => {
      const have = new Set(prev.filter((r) => r.active !== false).map((r) => String(r.size).trim()));
      const rest = prev.filter((r) => !baseSizes.includes(String(r.size).trim()) || r.active !== false);
      const added = baseSizes.filter((n) => !have.has(n)).map((n) => ({ size: n, stock: 1, active: true }));
      return sortSizeRows([...rest, ...added]);
    });
  }

  function clearSizes() {
    setVariantRows([]);
  }

  function addCustomSize() {
    const value = customSize.trim();
    if (!value) return;
    if (value.length > 20) {
      showToast('Tamanho muito longo.', 'error');
      return;
    }
    setVariantRows((prev) => {
      if (prev.some((r) => String(r.size).trim().toLowerCase() === value.toLowerCase() && r.active !== false)) return prev;
      const withoutOld = prev.filter((r) => String(r.size).trim().toLowerCase() !== value.toLowerCase());
      return sortSizeRows([...withoutOld, { size: value, stock: 1, active: true }]);
    });
    setCustomSize('');
  }

  // Grava a lista inteira (PUT substitui tudo). Usada pelo botão "Salvar números"
  // e automaticamente ao salvar/criar o produto.
  async function persistVariants(productId) {
    const rows = variantRows.filter((v) => v.active !== false);
    const saved = await adminRequest(`/products/${productId}/variants`, {
      method: 'PUT',
      body: {
        variants: rows.map((v) => ({
          size: String(v.size).trim(),
          stock: Number(v.stock) || 0,
          active: true,
        })),
      },
    });
    setVariantRows(saved.map((v) => ({ ...v, active: !!v.active })));
    return saved;
  }

  async function saveVariants() {
    if (!editingId) return;
    setVariantsBusy(true);
    try {
      await persistVariants(editingId);
      showToast('Números e estoque salvos.', 'success');
    } catch (err) {
      showToast(err.message || 'Erro ao salvar os números. Tente novamente.', 'error');
    } finally {
      setVariantsBusy(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    const hasAnyImage = editingId ? galleryImages.length > 0 : pendingFiles.length > 0;
    if (!hasAnyImage) {
      setFormError('Selecione ao menos uma foto para criar o produto.');
      return;
    }
    setSaving(true);

    try {
      const fd = new FormData();
      fd.append('name',        formData.name.trim());
      fd.append('brand',       formData.brand.trim());
      fd.append('category',    formData.category);
      fd.append('price',       formData.price);
      if (formData.oldPrice) fd.append('old_price', formData.oldPrice);
      fd.append('description', formData.description.trim());
      fd.append('sizes_json',  JSON.stringify(
        formData.sizes.split(',').map((s) => s.trim()).filter(Boolean)
      ));
      fd.append('stock_qty',   formData.stock_qty);
      fd.append('is_active',   formData.is_active ? '1' : '0');
      fd.append('is_featured', formData.is_featured ? '1' : '0');
      fd.append('available_for_order', formData.available_for_order ? '1' : '0');
      fd.append('available_on_request', formData.available_on_request ? '1' : '0');
      // No modo criação, a primeira foto pendente vira a imagem de capa
      // (o restante da galeria sobe logo depois que o produto existe).
      if (!editingId && pendingFiles.length > 0) {
        fd.append('image', pendingFiles[0].file);
      }

      const path   = editingId ? `${ADMIN_PREFIX}/products/${editingId}` : `${ADMIN_PREFIX}/products`;
      const method = editingId ? 'PATCH' : 'POST';

      const result = await apiUpload(path, { method, formData: fd, token });

      // Produto recém-criado: sobe as fotos restantes da galeria (se houver).
      if (!editingId && result?.id && pendingFiles.length > 1) {
        const restFd = new FormData();
        pendingFiles.slice(1).forEach((p) => restFd.append('images', p.file));
        try {
          await apiUpload(`${ADMIN_PREFIX}/products/${result.id}/images`, { method: 'POST', formData: restFd, token });
        } catch (galleryErr) {
          // O produto já foi criado com sucesso — só avisa que a galeria
          // extra falhou, sem bloquear o fluxo.
          showToast(galleryErr.message || 'Produto criado, mas houve erro ao enviar as demais fotos da galeria.', 'error');
        }
      }

      // Pronta entrega: grava os números marcados (em produto novo, usa o id recém-criado).
      const savedId = editingId || result?.id;
      if (formData.available_for_order && savedId && variantsLoaded) {
        try {
          await persistVariants(savedId);
        } catch (variantErr) {
          showToast(variantErr.message || 'Produto salvo, mas houve erro ao gravar os números. Edite o produto e salve de novo.', 'error');
        }
      }

      closeForm();
      showToast(editingId ? 'Produto atualizado com sucesso!' : 'Produto criado com sucesso!', 'success');
      loadProducts(page);
    } catch (err) {
      const message = err.message || 'Erro ao salvar produto.';
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(product) {
    try {
      const fd = new FormData();
      fd.append('is_active', product.is_active ? '0' : '1');
      await apiUpload(`${ADMIN_PREFIX}/products/${product.id}`, { method: 'PATCH', formData: fd, token });
      showToast(product.is_active ? 'Produto desativado.' : 'Produto ativado.', 'success');
      await loadProducts(page);
    } catch (err) {
      showToast(err.message || 'Erro ao atualizar status. Tente novamente.', 'error');
    }
  }

  // ─── Exclusão (com confirmação) ───────────────────────────────────────────
  // Obs: o backend faz soft delete (is_active = 0) — mesma proteção de dados
  // já usada em "Desativar" — mas aqui o produto some da listagem em vez de
  // só ficar esmaecido, e exige confirmação explícita antes.
  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await adminRequest(`/products/${confirmDelete.id}`, { method: 'DELETE' });
      showToast('Produto excluído com sucesso!', 'success');
      setConfirmDelete(null);
      await loadProducts(page);
    } catch (err) {
      showToast(err.message || 'Erro ao excluir produto. Tente novamente.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  // ─── Exclusão em massa (todos os produtos) ────────────────────────────────
  // Mesmo soft delete (is_active = 0) usado na exclusão individual — nada é
  // apagado do banco, então dá pra reativar produto por produto depois se
  // for engano. Exige digitar a frase de confirmação antes de habilitar o
  // botão, já que afeta o catálogo inteiro de uma vez.
  async function handleConfirmDeleteAll() {
    if (deleteAllPhrase.trim().toLowerCase() !== DELETE_ALL_PHRASE) return;
    setDeletingAll(true);
    try {
      const res = await adminRequest('/products', { method: 'DELETE', body: { confirm: 'DELETE_ALL' } });
      showToast(`${res?.count ?? 0} produto(s) desativado(s).`, 'success');
      setConfirmDeleteAll(false);
      setDeleteAllPhrase('');
      loadProducts(1);
    } catch (err) {
      showToast(err.message || 'Erro ao excluir todos os produtos. Tente novamente.', 'error');
    } finally {
      setDeletingAll(false);
    }
  }

  const visibleProducts = products;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800 }}>Produtos</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>Gerencie o catálogo da loja.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setConfirmDeleteAll(true)}
            className="btn-secondary"
            style={{ fontSize: 13, color: 'var(--red, #ef4444)' }}
          >
            <iconify-icon className="iconify" icon="mdi:delete-sweep-outline" style={{ fontSize: 18 }} />
            Excluir todos
          </button>
          <button onClick={openCreate} className="btn-primary" style={{ fontSize: 13 }}>
            <iconify-icon className="iconify" icon="mdi:plus" style={{ fontSize: 18 }} />
            Novo produto
          </button>
        </div>
      </div>

      {/* Modal de formulário */}
      {showForm && (
        <div className="modal-overlay open" role="dialog" aria-modal="true" aria-label={editingId ? 'Editar produto' : 'Novo produto'}>
          <div className="modal-content" style={{ maxWidth: 560 }}>
            <div style={{ padding: '28px 28px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20 }}>
                {editingId ? 'Editar produto' : 'Novo produto'}
              </h2>
              <button onClick={closeForm} className="modal-close-btn" aria-label="Fechar">
                <iconify-icon className="iconify" icon="mdi:close" style={{ fontSize: 15 }} />
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: 28 }}>
              <div className="checkout-form-grid">
                <input type="text" placeholder="Nome do produto" className="field-input" required value={formData.name} onChange={(e) => handleFieldChange('name', e.target.value)} />
                <input type="text" placeholder="Marca (opcional)" className="field-input" value={formData.brand} onChange={(e) => handleFieldChange('brand', e.target.value)} />

                <select className="sort-select field-input" value={formData.category} onChange={(e) => handleFieldChange('category', e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
                </select>

                <input type="number" placeholder="Preço (ex: 299.90)" className="field-input" required step="0.01" min="0" value={formData.price} onChange={(e) => handleFieldChange('price', e.target.value)} />
                <input type="number" placeholder="Preço antigo (opcional)" className="field-input" step="0.01" min="0" value={formData.oldPrice} onChange={(e) => handleFieldChange('oldPrice', e.target.value)} />
                <input type="text" placeholder="Tamanhos (ex: 38, 39, 40, 41)" className="field-input" value={formData.sizes} onChange={(e) => handleFieldChange('sizes', e.target.value)} />
                <input type="number" placeholder="Estoque" className="field-input" min="0" value={formData.stock_qty} onChange={(e) => handleFieldChange('stock_qty', Number(e.target.value))} />

                <textarea
                  placeholder="Descrição"
                  className="field-input field-full"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  style={{ resize: 'vertical' }}
                />

                <div className="field-full" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ fontSize: 13, color: 'var(--muted)' }}>
                    Galeria de imagens {editingId ? '' : '*'} ({galleryImages.length + pendingFiles.length}/{MAX_IMAGES})
                  </label>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {/* Imagens já salvas (modo edição) */}
                    {galleryImages.map((img, i) => (
                      <div key={img.id ?? `existing-${i}`} style={{ position: 'relative', width: 92 }}>
                        <img
                          src={productImageUrl(img.url)}
                          alt=""
                          style={{
                            width: 92, height: 92, objectFit: 'cover', borderRadius: 10,
                            border: img.isPrimary ? '2px solid var(--amber-dk, #d6a330)' : '1px solid var(--border)',
                          }}
                        />
                        {img.isPrimary && (
                          <span style={{ position: 'absolute', top: 4, left: 4, background: 'var(--amber-dk, #d6a330)', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                            Principal
                          </span>
                        )}
                        <div style={{ display: 'flex', gap: 4, marginTop: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button type="button" disabled={galleryBusy || i === 0} onClick={() => moveExistingImage(i, -1)} className="btn-secondary" style={{ fontSize: 10, padding: '2px 5px' }} aria-label="Mover para a esquerda">←</button>
                          <button type="button" disabled={galleryBusy || i === galleryImages.length - 1} onClick={() => moveExistingImage(i, 1)} className="btn-secondary" style={{ fontSize: 10, padding: '2px 5px' }} aria-label="Mover para a direita">→</button>
                          <button type="button" disabled={galleryBusy || img.isPrimary} onClick={() => setPrimaryImage(img.id)} className="btn-secondary" style={{ fontSize: 10, padding: '2px 5px' }}>★</button>
                          <button type="button" disabled={galleryBusy} onClick={() => removeExistingImage(img.id)} className="btn-secondary" style={{ fontSize: 10, padding: '2px 5px', color: 'var(--red, #ef4444)' }}>✕</button>
                        </div>
                      </div>
                    ))}

                    {/* Fotos ainda não enviadas (modo criação) */}
                    {pendingFiles.map((p, i) => (
                      <div key={p.previewUrl} style={{ position: 'relative', width: 92 }}>
                        <img
                          src={p.previewUrl}
                          alt=""
                          style={{
                            width: 92, height: 92, objectFit: 'cover', borderRadius: 10,
                            border: i === 0 ? '2px solid var(--amber-dk, #d6a330)' : '1px solid var(--border)',
                          }}
                        />
                        {i === 0 && (
                          <span style={{ position: 'absolute', top: 4, left: 4, background: 'var(--amber-dk, #d6a330)', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                            Capa
                          </span>
                        )}
                        <div style={{ display: 'flex', gap: 4, marginTop: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button type="button" disabled={i === 0} onClick={() => movePendingFile(i, -1)} className="btn-secondary" style={{ fontSize: 10, padding: '2px 5px' }} aria-label="Mover para a esquerda">←</button>
                          <button type="button" disabled={i === pendingFiles.length - 1} onClick={() => movePendingFile(i, 1)} className="btn-secondary" style={{ fontSize: 10, padding: '2px 5px' }} aria-label="Mover para a direita">→</button>
                          <button type="button" onClick={() => removePendingFile(i)} className="btn-secondary" style={{ fontSize: 10, padding: '2px 5px', color: 'var(--red, #ef4444)' }}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {(galleryImages.length + pendingFiles.length) < MAX_IMAGES && (
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      disabled={galleryBusy}
                      style={{ fontSize: 13 }}
                      onChange={(e) => { handleAddFiles(e.target.files); e.target.value = ''; }}
                    />
                  )}
                  <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                    JPG, PNG ou WebP — máx. 5MB por foto, até {MAX_IMAGES} fotos por produto. A primeira foto é a capa; use ★ para trocar a principal.
                  </p>
                </div>

                <div className="field-full" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.is_active} onChange={(e) => handleFieldChange('is_active', e.target.checked)} />
                    Ativo
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.is_featured} onChange={(e) => handleFieldChange('is_featured', e.target.checked)} />
                    Destaque
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.available_for_order} onChange={(e) => handleFieldChange('available_for_order', e.target.checked)} />
                    Pronta entrega
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.available_on_request} onChange={(e) => handleFieldChange('available_on_request', e.target.checked)} />
                    Disponível para pedidos
                  </label>
                </div>
                <p className="field-full" style={{ fontSize: 12, color: 'var(--muted)', marginTop: -8 }}>
                  Pronta entrega: em estoque, o cliente compra direto pelo site (estoque por tamanho).
                  Disponível para pedidos: encomenda, o cliente combina prazo, valor e numeração pelo WhatsApp.
                  Pode marcar as duas.
                </p>

                {formData.available_for_order && (
                  <div className="field-full" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Números em pronta entrega</p>
                    <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                      Toque nos números que você tem em estoque e informe quantos pares de cada. O cliente só consegue comprar direto os números marcados aqui.
                    </p>

                    {variantsLoading ? (
                      <p style={{ fontSize: 13, color: 'var(--muted)' }}>Carregando…</p>
                    ) : (
                      <>
                        {(() => {
                          const activeRows = variantRows.filter((r) => r.active !== false);
                          const activeKeys = new Set(activeRows.map((r) => String(r.size).trim()));
                          const chipSizes = sortSizeRows(
                            Array.from(new Set([...baseSizes, ...activeRows.map((r) => String(r.size).trim())])).map((n) => ({ size: n }))
                          ).map((r) => r.size);
                          return (
                            <>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {chipSizes.map((size) => {
                                  const on = activeKeys.has(size);
                                  return (
                                    <button
                                      key={size}
                                      type="button"
                                      aria-pressed={on}
                                      onClick={() => toggleSize(size)}
                                      style={{
                                        minWidth: 52, height: 44, padding: '0 12px', borderRadius: 6, cursor: 'pointer',
                                        fontSize: 16, fontWeight: 600,
                                        border: `1px solid ${on ? 'var(--ink)' : 'var(--border)'}`,
                                        background: on ? 'var(--ink)' : '#fff',
                                        color: on ? '#fff' : 'var(--ink)',
                                      }}
                                    >
                                      {size}
                                    </button>
                                  );
                                })}
                                {chipSizes.length === 0 && (
                                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhum número ainda. Use "Outro número" abaixo.</p>
                                )}
                              </div>

                              {activeRows.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
                                  {activeRows.map((row) => (
                                    <label key={row.size} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                                      <span style={{ fontWeight: 600, minWidth: 28 }}>{row.size}</span>
                                      <input
                                        type="number"
                                        inputMode="numeric"
                                        min="0"
                                        className="field-input"
                                        style={{ width: 76 }}
                                        aria-label={`Quantidade do número ${row.size}`}
                                        value={row.stock}
                                        onChange={(e) => setSizeStock(row.size, e.target.value)}
                                      />
                                      <span style={{ color: 'var(--muted)' }}>pares</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                              {activeRows.length > 0 && (
                                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Quantidade 0 deixa o número esgotado para o cliente.</p>
                              )}
                            </>
                          );
                        })()}

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14, alignItems: 'center' }}>
                          <input
                            type="text"
                            placeholder="Outro número (ex: 36, 46, M)"
                            className="field-input"
                            style={{ maxWidth: 200 }}
                            maxLength={20}
                            value={customSize}
                            onChange={(e) => setCustomSize(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSize(); } }}
                          />
                          <button type="button" onClick={addCustomSize} className="btn-secondary" style={{ fontSize: 13 }}>
                            + Adicionar
                          </button>
                          {isChuteiraCat && (
                            <button type="button" onClick={selectAllBase} className="btn-secondary" style={{ fontSize: 13 }}>
                              Marcar todos (37 ao 45)
                            </button>
                          )}
                          <button type="button" onClick={clearSizes} className="btn-secondary" style={{ fontSize: 13 }}>
                            Limpar
                          </button>
                          {editingId && (
                            <button type="button" onClick={saveVariants} className="btn-primary" style={{ fontSize: 13 }} disabled={variantsBusy}>
                              {variantsBusy ? 'Salvando…' : 'Salvar números'}
                            </button>
                          )}
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
                          Os números também são salvos quando você clica em {editingId ? '"Salvar alterações"' : '"Criar produto"'}.
                        </p>
                      </>
                    )}
                  </div>
                )}

                {formError && <div className="error-box field-full">{formError}</div>}

                <div className="checkout-nav field-full">
                  <button type="button" onClick={closeForm} className="btn-secondary">Cancelar</button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Salvando…' : (editingId ? 'Salvar alterações' : 'Criar produto')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filtros do painel */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }} role="group" aria-label="Filtros de produtos">
        <select className="sort-select" aria-label="Filtrar por categoria" value={filters.category} onChange={(e) => handleFilterChange('category', e.target.value)}>
          <option value="">Todas as categorias</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
        </select>
        <select className="sort-select" aria-label="Filtrar por marca" value={filters.brand} onChange={(e) => handleFilterChange('brand', e.target.value)}>
          <option value="">Todas as marcas</option>
          {filterMeta.brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className="sort-select" aria-label="Filtrar por tamanho" value={filters.size} onChange={(e) => handleFilterChange('size', e.target.value)}>
          <option value="">Todos os tamanhos</option>
          {filterMeta.sizes.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="number" placeholder="Preço mín." className="field-input" style={{ width: 110 }} min="0" value={filters.minPrice} onChange={(e) => handleFilterChange('minPrice', e.target.value)} />
        <input type="number" placeholder="Preço máx." className="field-input" style={{ width: 110 }} min="0" value={filters.maxPrice} onChange={(e) => handleFilterChange('maxPrice', e.target.value)} />
        {(filters.category || filters.brand || filters.size || filters.minPrice || filters.maxPrice) && (
          <button type="button" className="btn-secondary" style={{ fontSize: 13 }} onClick={clearFilters}>
            <iconify-icon className="iconify" icon="mdi:filter-remove-outline" style={{ fontSize: 16 }} />
            Limpar filtros
          </button>
        )}
      </div>

      {/* Tabela de produtos */}
      {status === 'loading' && <p style={{ color: 'var(--muted)' }}>Carregando produtos…</p>}
      {status === 'error'   && <p style={{ color: 'var(--muted)' }}>Erro ao carregar. Tente novamente.</p>}

      {status === 'ready' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              {total} produto{total === 1 ? '' : 's'} encontrado{total === 1 ? '' : 's'} · página {page}
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Mostrar inativos/excluídos
            </label>
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.2em', background: 'var(--bg)' }}>
                    {['Imagem', 'Produto', 'Marca', 'Categoria', 'Preço', 'Estoque', 'Status', 'Ações'].map((h) => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!visibleProducts.length && (
                    <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Nenhum produto encontrado.</td></tr>
                  )}
                  {visibleProducts.map((product) => (
                    <tr key={product.id} style={{ borderBottom: '1px solid var(--border)', opacity: product.is_active ? 1 : 0.5 }}>
                      <td style={{ padding: '10px 16px' }}>
                        {product.image
                          ? <img src={productImageUrl(product.image)} alt={product.name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8 }} />
                          : <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--border)' }} />
                        }
                      </td>
                      <td style={{ padding: '10px 16px', fontWeight: 600 }}>{product.name}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--muted)' }}>{product.brand}</td>
                      <td style={{ padding: '10px 16px', textTransform: 'capitalize' }}>{product.category}</td>
                      <td style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--amber-dk)', fontFamily: 'var(--font-display)' }}>{brl(product.price)}</td>
                      <td style={{ padding: '10px 16px' }}>{product.stock_qty ?? '—'}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 12, background: product.is_active ? 'var(--green, #22c55e)' : 'var(--muted)', color: '#fff', fontWeight: 600 }}>
                          {product.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => openEdit(product)} className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}>
                            Editar
                          </button>
                          <button onClick={() => toggleActive(product)} className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}>
                            {product.is_active ? 'Desativar' : 'Ativar'}
                          </button>
                          <button
                            onClick={() => setConfirmDelete({ id: product.id, name: product.name })}
                            className="btn-secondary"
                            style={{ fontSize: 12, padding: '4px 10px', color: 'var(--red, #ef4444)' }}
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'center' }}>
            {page > 1 && (
              <button className="btn-secondary" onClick={() => loadProducts(page - 1)} style={{ fontSize: 13 }}>← Anterior</button>
            )}
            {hasMore && (
              <button className="btn-secondary" onClick={() => loadProducts(page + 1)} style={{ fontSize: 13 }}>Próxima →</button>
            )}
          </div>
        </>
      )}

      {/* Modal de confirmação de exclusão */}
      {confirmDelete && (
        <div className="modal-overlay open" role="dialog" aria-modal="true" aria-label="Confirmar exclusão">
          <div className="modal-content" style={{ maxWidth: 420 }}>
            <div style={{ padding: 28 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, marginBottom: 12 }}>
                Excluir produto?
              </h2>
              <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 24 }}>
                Tem certeza que deseja excluir <strong>{confirmDelete.name}</strong>? Ele deixará de
                aparecer na loja. Essa ação não pode ser desfeita por aqui.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className="btn-secondary"
                  disabled={deleting}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="btn-primary"
                  style={{ background: 'var(--red, #ef4444)', borderColor: 'var(--red, #ef4444)' }}
                  disabled={deleting}
                >
                  {deleting ? 'Excluindo…' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de exclusão em massa */}
      {confirmDeleteAll && (
        <div className="modal-overlay open" role="dialog" aria-modal="true" aria-label="Confirmar exclusão de todos os produtos">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div style={{ padding: 28 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, marginBottom: 12, color: 'var(--red, #ef4444)' }}>
                Excluir TODOS os produtos?
              </h2>
              <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 12 }}>
                Isso vai desativar <strong>todos os {products.filter((p) => p.is_active).length} produtos ativos</strong> do
                catálogo de uma vez — a loja ficará sem nenhum produto visível. É o mesmo tipo de exclusão usado
                individualmente (nada é apagado do banco), então dá pra reativar depois, produto por produto, em
                &quot;Mostrar inativos/excluídos&quot;.
              </p>
              <p style={{ fontSize: 13, marginBottom: 8 }}>
                Digite <strong>{DELETE_ALL_PHRASE}</strong> abaixo para confirmar:
              </p>
              <input
                type="text"
                className="field-input"
                style={{ width: '100%', marginBottom: 20 }}
                value={deleteAllPhrase}
                onChange={(e) => setDeleteAllPhrase(e.target.value)}
                placeholder={DELETE_ALL_PHRASE}
                autoComplete="off"
              />
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setConfirmDeleteAll(false); setDeleteAllPhrase(''); }}
                  className="btn-secondary"
                  disabled={deletingAll}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteAll}
                  className="btn-primary"
                  style={{ background: 'var(--red, #ef4444)', borderColor: 'var(--red, #ef4444)' }}
                  disabled={deletingAll || deleteAllPhrase.trim().toLowerCase() !== DELETE_ALL_PHRASE}
                >
                  {deletingAll ? 'Excluindo…' : 'Excluir todos'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}
