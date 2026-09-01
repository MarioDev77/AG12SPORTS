'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWish } from '@/context/WishContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { apiRequest } from '@/lib/api';
import { brl } from '@/lib/format';
import ProductGallery from '@/components/ProductGallery';

const WPP_NUMBER = '557598756510';
const IG_URL     = 'https://www.instagram.com/ag12sports/';

function Stars({ rating }) {
  return (
    <div className="stars">
      {[1,2,3,4,5].map((i) => (
        <span key={i} className={`star${i <= Math.round(rating) ? ' filled' : ''}`}>★</span>
      ))}
    </div>
  );
}

export default function ProdutoPage() {
  const { id }    = useParams();
  const router    = useRouter();
  const showToast = useToast();
  const { isWished, toggleWish } = useWish();
  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const [selectedSize, setSelectedSize] = useState(null);
  const [qty, setQty] = useState(1);

  const [reviews,       setReviews]       = useState(null);
  const [reviewsStatus, setReviewsStatus] = useState('loading');

  // ——— Busca produto ———
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    apiRequest(`/products/${id}`)
      .then((data) => {
        // A API pode devolver { product: {...} } ou o produto direto na raiz,
        // dependendo da versão publicada no backend — cobre os dois formatos.
        const p = (data && data.product) ? data.product : data;
        if (!p || !p.id) {
          setError('Produto não encontrado.');
          setProduct(null);
          return;
        }
        setProduct(p);
        setSelectedSize((p.sizes && p.sizes[0]) || null);
      })
      .catch((err) => setError(err.message || 'Produto não encontrado.'))
      .finally(() => setLoading(false));
  }, [id]);

  // ——— Busca reviews ———
  useEffect(() => {
    if (!id) return;
    setReviewsStatus('loading');
    apiRequest(`/products/${id}/reviews?limit=5`)
      .then((data) => {
        setReviews(data);
        setReviewsStatus('ready');
      })
      .catch(() => setReviewsStatus('error'));
  }, [id]);

  function handleBuyNow() {
    if (!product) return;
    if (product.sizes && product.sizes.length > 0 && !selectedSize) {
      showToast('Selecione um tamanho antes de continuar.', 'error');
      return;
    }
    addToCart(product, selectedSize, qty);
    router.push('/checkout');
  }

  function handleAddToCart() {
    if (!product) return;
    if (product.sizes && product.sizes.length > 0 && !selectedSize) {
      showToast('Selecione um tamanho antes de continuar.', 'error');
      return;
    }
    addToCart(product, selectedSize, qty);
    showToast(`${product.name} adicionado ao carrinho`, 'success');
    setQty(1);
  }

  function handleWish() {
    if (!product) return;
    const nowWished = toggleWish(product.id, product);
    showToast(
      nowWished ? `${product.name} salvo nos favoritos ♡` : `${product.name} removido dos favoritos`,
      nowWished ? 'success' : 'info'
    );
  }

  // Copia o link direto do produto (esta própria URL) para a área de
  // transferência, para o usuário colar e enviar por WhatsApp, Instagram etc.
  async function handleCopyLink() {
    if (!product) return;
    const url = `${window.location.origin}/produto/${product.id}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback para navegadores/contextos sem Clipboard API (ex: http).
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      showToast('Link do produto copiado!', 'success');
    } catch (err) {
      showToast('Não foi possível copiar o link.', 'error');
    }
  }

  if (loading) {
    return (
      <div style={{ paddingTop: 120, textAlign: 'center', color: 'var(--muted)' }}>
        <iconify-icon className="iconify" icon="mdi:loading" style={{ fontSize: 36, animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: 12 }}>Carregando produto…</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div style={{ paddingTop: 120, textAlign: 'center' }}>
        <iconify-icon className="iconify" icon="mdi:alert-circle-outline" style={{ fontSize: 48, color: 'var(--muted)' }} />
        <h2 style={{ marginTop: 16 }}>Produto não encontrado</h2>
        <p style={{ color: 'var(--muted)', marginTop: 8 }}>{error}</p>
        <button className="btn-primary" style={{ marginTop: 20 }} onClick={() => router.back()}>
          ← Voltar
        </button>
      </div>
    );
  }

  const hasDiscount = product.oldPrice && product.oldPrice > product.price;
  const wished      = isWished(product.id);
  const wppLink     = `https://wa.me/${WPP_NUMBER}?text=${encodeURIComponent(`Olá! Tenho interesse no produto: ${product.name}`)}`;

  return (
    <div style={{ paddingTop: 100, maxWidth: 960, margin: '0 auto', padding: '100px 24px 60px' }}>
      {/* Breadcrumb */}
      <nav style={{ marginBottom: 24, fontSize: 13, color: 'var(--muted)' }} aria-label="Breadcrumb">
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13 }}>
          Início
        </button>
        <span style={{ margin: '0 8px' }}>›</span>
        <button onClick={() => router.push('/produtos')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 13 }}>
          Produtos
        </button>
        <span style={{ margin: '0 8px' }}>›</span>
        <span style={{ color: 'var(--text)' }}>{product.name}</span>
      </nav>

      {/* Grid: imagem + dados */}
      <div className="modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start' }}>
        {/* Imagens — galeria com miniaturas, setas, teclado e lightbox */}
        <ProductGallery images={product.images} productName={product.name} />

        {/* Dados */}
        <div className="modal-body">
          <p className="modal-brand-label">Marca · <span>{product.brand}</span></p>
          <h1 className="modal-name" style={{ fontSize: 26, marginBottom: 16 }}>{product.name}</h1>

          <div className="modal-prices" style={{ marginBottom: 16 }}>
            <span className="modal-price">{brl(product.price)}</span>
            {hasDiscount && (
              <span className="modal-old-price" style={{ marginLeft: 10 }}>{brl(product.oldPrice)}</span>
            )}
          </div>

          {product.desc && (
            <p className="modal-desc" style={{ marginBottom: 20 }}>{product.desc}</p>
          )}

          {/* Tamanhos */}
          {product.sizes && product.sizes.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p className="modal-sizes-label">Tamanhos</p>
              <div className="modal-sizes-grid">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={`size-btn${String(size) === String(selectedSize) ? ' selected' : ''}`}
                    onClick={() => setSelectedSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantidade */}
          <div style={{ marginBottom: 20 }}>
            <p className="modal-sizes-label">Quantidade</p>
            <div className="qty-row">
              <button type="button" className="qty-btn" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Diminuir quantidade">−</button>
              <span className="qty-display">{qty}</span>
              <button type="button" className="qty-btn" onClick={() => setQty((q) => Math.min(10, q + 1))} aria-label="Aumentar quantidade">+</button>
            </div>
          </div>

          {/* Ações principais */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <button onClick={handleBuyNow} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              <iconify-icon className="iconify" icon="mdi:flash-outline" style={{ fontSize: 16 }} />
              Comprar agora
            </button>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
            <button onClick={handleAddToCart} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
              <iconify-icon className="iconify" icon="mdi:cart-plus" style={{ fontSize: 16 }} />
              Adicionar ao carrinho
            </button>
            <button
              onClick={handleWish}
              className="btn-secondary"
              title={wished ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              aria-label={wished ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
            >
              <iconify-icon className="iconify" icon={wished ? 'mdi:heart' : 'mdi:heart-outline'} style={{ fontSize: 16 }} />
            </button>
            <button
              onClick={handleCopyLink}
              className="btn-secondary"
              title="Copiar link do produto"
              aria-label="Copiar link do produto"
              style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
            >
              <iconify-icon className="iconify" icon="mdi:link-variant" style={{ fontSize: 16 }} />
            </button>
          </div>

          {/* Links */}
          <div className="modal-links">
            <a href={wppLink} target="_blank" rel="noopener" className="modal-link">
              <iconify-icon className="iconify" icon="mdi:whatsapp" /> WhatsApp
            </a>
            <a href={IG_URL} target="_blank" rel="noopener" className="modal-link">
              <iconify-icon className="iconify" icon="mdi:instagram" /> Instagram
            </a>
          </div>

          {/* Reviews */}
          <div id="modalReviews" style={{ marginTop: 28 }} aria-label="Avaliações do produto">
            {reviewsStatus === 'loading' && (
              <p className="reviews-loading">Carregando avaliações…</p>
            )}
            {reviewsStatus === 'error' && (
              <p className="reviews-empty">Não foi possível carregar as avaliações.</p>
            )}
            {reviewsStatus === 'ready' && reviews && (
              <>
                {!reviews.total ? (
                  <p className="reviews-empty">Nenhuma avaliação ainda. Seja o primeiro!</p>
                ) : (
                  <>
                    <div className="reviews-header">
                      <Stars rating={reviews.avg} />
                      <span className="reviews-avg">{reviews.avg} / 5</span>
                      <span className="reviews-count">({reviews.total} avaliação{reviews.total !== 1 ? 'ões' : ''})</span>
                    </div>
                    {reviews.reviews.map((r, i) => (
                      <div className="review-item" key={i}>
                        <div className="review-top">
                          <span className="review-name">{r.name || 'Cliente'}</span>
                          <span className="review-date">{r.date || ''}</span>
                        </div>
                        <Stars rating={r.rating} />
                        {r.comment && <p className="review-comment">{r.comment}</p>}
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Responsivo mobile */}
      <style>{`
        @media (max-width: 640px) {
          .modal-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
        }
      `}</style>
    </div>
  );
}
