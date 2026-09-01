'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { apiRequest } from '@/lib/api';
import { brl, maskCep, onlyDigits } from '@/lib/format';

// Mesmos dados de contato do app.js original — centralizar aqui evita
// duplicar a constante em vários componentes.
const WPP_NUMBER = '557598756510';
const WPP_BASE = `https://wa.me/${WPP_NUMBER}`;
const IG_URL = 'https://www.instagram.com/ag12sports/';

/**
 * CartPanel — réplica do #cartOverlay/.cart-panel do index.html, com a
 * lógica de renderCartPanel() do app.js. `open`/`onClose` controlam a
 * visibilidade (equivalente à classe .open alternada por toggleCart()).
 *
 * Inclui uma calculadora de frete inline (CEP → UF → frete/prazo), igual
 * ao padrão de carrinho de e-commerce (ex.: "Meios de envio" na Shopee/ML),
 * pra o cliente já ver o total com frete antes de ir pro checkout.
 */
export default function CartPanel({ open, onClose }) {
  const router = useRouter();
  const { items, subtotal, updateQty, removeFromCart } = useCart();

  const [cep, setCep] = useState('');
  const [shipping, setShipping] = useState(null); // null | { cost, minDays, maxDays }
  const [shipStatus, setShipStatus] = useState('idle'); // idle | loading | error

  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const wppText = encodeURIComponent('Olá! Gostaria de finalizar minha compra na AG12 Sports.');

  async function handleCalcShipping() {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) return;
    setShipStatus('loading');
    try {
      const addr = await apiRequest(`/cep/${digits}`);
      const result = await apiRequest('/shipping/calculate', { method: 'POST', body: { state: addr.uf } });
      if (!result.available) {
        setShipStatus('error');
        setShipping(null);
        return;
      }
      setShipping({ cost: result.shippingCost, minDays: result.estimatedMinDays, maxDays: result.estimatedMaxDays });
      setShipStatus('idle');
    } catch {
      setShipStatus('error');
      setShipping(null);
    }
  }

  function handleChangeCep() {
    setShipping(null);
    setShipStatus('idle');
  }

  const shippingCost = shipping ? shipping.cost : 0;
  const total = Number((subtotal + shippingCost).toFixed(2));

  function handleCheckout() {
    onClose();
    router.push('/checkout');
  }

  return (
    <div className={`cart-overlay${open ? ' open' : ''}`} role="dialog" aria-modal="true" aria-label="Carrinho de compras">
      <div className="cart-panel">
        <div className="cart-panel-head">
          <div>
            <p>Carrinho</p>
            <h3>{totalQty} {totalQty === 1 ? 'item' : 'itens'}</h3>
          </div>
          <button className="cart-close-btn" onClick={onClose} aria-label="Fechar carrinho">
            <iconify-icon className="iconify" icon="mdi:close" style={{ fontSize: 16 }} />
          </button>
        </div>

        <div>
          {items.length === 0 && <p>Seu carrinho está vazio.</p>}

          {items.map((it) => (
            <div className="cart-line-item" key={`${it.productId}:${it.size || ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.image || ''} alt={it.name || ''} />
              <div className="cart-line-info">
                <div className="name">{it.name || ''}</div>
                <div className="meta">Tam. {it.size || '—'} · {it.brand || ''}</div>
                <div className="qty-stepper">
                  <button type="button" onClick={() => updateQty(it.productId, it.size, it.qty - 1)}>−</button>
                  <span>{it.qty}</span>
                  <button type="button" onClick={() => updateQty(it.productId, it.size, it.qty + 1)}>+</button>
                </div>
              </div>
              <div className="cart-line-price-col">
                <div className="cart-line-price">{brl(it.unitPrice * it.qty)}</div>
                <button type="button" className="cart-remove-btn" onClick={() => removeFromCart(it.productId, it.size)}>
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <div id="cartFooter" style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid var(--border)' }}>

            {/* Meios de envio */}
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <iconify-icon className="iconify" icon="mdi:truck-outline" style={{ fontSize: 15 }} />
                Meios de envio
              </p>

              {!shipping && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="field-input"
                    placeholder="Seu CEP"
                    value={cep}
                    onChange={(e) => setCep(maskCep(e.target.value))}
                    onKeyDown={(e) => e.key === 'Enter' && handleCalcShipping()}
                    style={{ flex: 1, fontSize: 13 }}
                  />
                  <button type="button" onClick={handleCalcShipping} className="btn-secondary" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }} disabled={shipStatus === 'loading'}>
                    {shipStatus === 'loading' ? 'Calculando…' : 'Calcular'}
                  </button>
                </div>
              )}

              {shipStatus === 'error' && (
                <p style={{ fontSize: 12, color: '#dc2626', marginTop: 6 }}>Não foi possível calcular o frete para esse CEP.</p>
              )}

              {shipping && (
                <div>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                    Entregas para o CEP: {cep}{' '}
                    <button type="button" onClick={handleChangeCep} style={{ background: 'none', border: 'none', color: 'var(--amber-dk)', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: 12 }}>
                      Alterar CEP
                    </button>
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700 }}>{shipping.cost === 0 ? 'Frete grátis' : 'Envio a domicílio'}</p>
                      <p style={{ fontSize: 12, color: 'var(--muted)' }}>Chega em {shipping.minDays}–{shipping.maxDays} dias úteis</p>
                    </div>
                    <strong style={{ fontSize: 13 }}>{shipping.cost === 0 ? 'Grátis' : brl(shipping.cost)}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Resumo */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
              <span>Subtotal</span>
              <span>{brl(subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              <span>Frete</span>
              <span>{shipping ? (shipping.cost === 0 ? 'Grátis' : brl(shipping.cost)) : 'a calcular'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Total</span>
              <strong style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'var(--amber-dk)' }}>
                {brl(total)}
              </strong>
            </div>
            <button onClick={handleCheckout} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              Iniciar Compra
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <a
                href={`${WPP_BASE}?text=${wppText}`}
                target="_blank"
                rel="noopener"
                style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
              >
                <iconify-icon className="iconify" icon="mdi:whatsapp" /> WhatsApp
              </a>
              <a
                href={IG_URL}
                target="_blank"
                rel="noopener"
                style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
              >
                <iconify-icon className="iconify" icon="mdi:instagram" /> Instagram
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
