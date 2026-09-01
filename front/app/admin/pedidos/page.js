'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/app/admin/layout';
import { brl, orderStatusLabel, shipmentScopeLabel, ORDER_STATUS_COLORS } from '@/lib/format';

const LIMIT = 20;

const STATUS_OPTIONS = [
  { value: 'pending',    label: 'Aguardando confirmação' },
  { value: 'paid',       label: 'Pago' },
  { value: 'processing', label: 'Processando' },
  { value: 'shipped',    label: 'Enviado' },
  { value: 'delivered',  label: 'Entregue' },
  { value: 'cancelled',  label: 'Cancelado' },
];

function OrderDetailModal({ orderId, onClose, onMarkedViewed }) {
  const { adminRequest } = useAdminAuth();
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState('loading');

  const [tracking, setTracking] = useState({ shipmentScope: 'nacional', trackingCarrier: '', trackingCode: '', trackingUrl: '' });
  const [savingTracking, setSavingTracking] = useState(false);
  const [trackingErr, setTrackingErr] = useState('');
  const [trackingSaved, setTrackingSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    adminRequest(`/orders/${orderId}`)
      .then((data) => {
        if (cancelled) return;
        setOrder(data.order);
        setTracking({
          shipmentScope: data.order.shipmentScope || 'nacional',
          trackingCarrier: data.order.tracking?.carrier || '',
          trackingCode: data.order.tracking?.code || '',
          trackingUrl: data.order.tracking?.url || '',
        });
        setStatus('ready');
        // Marca como visto ao abrir os detalhes — limpa a notificação do sininho.
        adminRequest(`/orders/${orderId}/viewed`, { method: 'PATCH' })
          .then(() => onMarkedViewed(orderId))
          .catch(() => {});
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => { cancelled = true; };
  }, [orderId, adminRequest, onMarkedViewed]);

  async function handleSaveTracking() {
    setSavingTracking(true);
    setTrackingErr('');
    setTrackingSaved(false);
    try {
      await adminRequest(`/orders/${orderId}/tracking`, { method: 'PATCH', body: tracking });
      setTrackingSaved(true);
    } catch (err) {
      setTrackingErr(err.message || 'Não foi possível salvar.');
    } finally {
      setSavingTracking(false);
    }
  }

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="checkout-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <p className="checkout-section-title" style={{ marginBottom: 0 }}>Pedido #{orderId}</p>
            <button onClick={onClose} className="modal-close-btn" style={{ alignSelf: 'auto' }} aria-label="Fechar">
              <iconify-icon className="iconify" icon="mdi:close" style={{ fontSize: 16 }} />
            </button>
          </div>

          {status === 'loading' && <p style={{ color: 'var(--muted)' }}>Carregando…</p>}
          {status === 'error' && <p style={{ color: 'var(--muted)' }}>Não foi possível carregar este pedido.</p>}

          {status === 'ready' && order && (
            <>
              <div style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.7 }}>
                <p><strong style={{ color: 'var(--ink)' }}>{order.customerName}</strong> · {order.email} · {order.phone}</p>
                <p>
                  {order.address.logradouro}, {order.address.numero}
                  {order.address.complemento ? ` — ${order.address.complemento}` : ''} · {order.address.bairro}
                </p>
                <p>{order.address.cidade}/{order.address.uf} · CEP {order.address.cep}</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {order.items.map((it, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span>{it.qty}x {it.name}{it.size ? ` (tam. ${it.size})` : ''}</span>
                    <span>{brl(it.lineTotal)}</span>
                  </div>
                ))}
              </div>

              <div className="checkout-summary">
                <div className="summary-row"><span>Subtotal</span><span>{brl(order.subtotal)}</span></div>
                <div className="summary-row"><span>Frete</span><span>{brl(order.shippingCost)}</span></div>
                <div className="summary-row"><span>Pagamento</span><span style={{ textTransform: 'capitalize' }}>{order.paymentMethod}</span></div>
                <div className="summary-row total"><span>Total</span><span>{brl(order.total)}</span></div>
              </div>

              <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 12 }}>
                Prazo estimado: {order.estimatedMinDays}–{order.estimatedMaxDays} dias úteis ·{' '}
                {order.createdAt ? new Date(order.createdAt).toLocaleString('pt-BR') : ''}
              </p>

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <p className="checkout-section-title" style={{ fontSize: 14, marginBottom: 10 }}>Envio e rastreio</p>

                <div className="checkout-form-grid">
                  <select
                    className="field-input"
                    value={tracking.shipmentScope}
                    onChange={(e) => setTracking((t) => ({ ...t, shipmentScope: e.target.value }))}
                  >
                    <option value="nacional">Nacional</option>
                    <option value="internacional">Internacional</option>
                  </select>
                  <input
                    className="field-input"
                    placeholder="Transportadora (ex: Correios)"
                    value={tracking.trackingCarrier}
                    onChange={(e) => setTracking((t) => ({ ...t, trackingCarrier: e.target.value }))}
                  />
                  <input
                    className="field-input"
                    placeholder="Código de rastreio"
                    value={tracking.trackingCode}
                    onChange={(e) => setTracking((t) => ({ ...t, trackingCode: e.target.value }))}
                  />
                  <input
                    className="field-input field-full"
                    placeholder="Link de rastreio (opcional)"
                    value={tracking.trackingUrl}
                    onChange={(e) => setTracking((t) => ({ ...t, trackingUrl: e.target.value }))}
                  />
                </div>

                {trackingErr && <p style={{ color: '#b91c1c', fontSize: 12.5, marginTop: 8 }}>{trackingErr}</p>}
                {trackingSaved && !trackingErr && <p style={{ color: '#15803d', fontSize: 12.5, marginTop: 8 }}>Salvo — já aparece pro cliente.</p>}

                <button
                  onClick={handleSaveTracking}
                  disabled={savingTracking}
                  className="btn-primary"
                  style={{ fontSize: 13, marginTop: 12 }}
                >
                  {savingTracking ? 'Salvando…' : 'Salvar envio e rastreio'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminPedidosPage() {
  const router = useRouter();
  const { adminRequest, isAuthenticated, refreshUnseenCount } = useAdminAuth();

  const [orders,  setOrders]  = useState([]);
  const [status,  setStatus]  = useState('loading');
  const [page,    setPage]    = useState(1);
  const [total,   setTotal]   = useState(0);
  const [updating, setUpdating] = useState(null); // id do pedido sendo atualizado
  const [detailId, setDetailId] = useState(null);  // id do pedido aberto no modal

  useEffect(() => {
    if (!isAuthenticated) { router.push('/admin/login'); return; }
    load(1);
  }, [isAuthenticated]);

  async function load(p) {
    setStatus('loading');
    try {
      const data = await adminRequest(`/orders?page=${p}&limit=${LIMIT}`);
      setOrders(data.orders || []);
      setTotal(data.total || 0);
      setPage(p);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  async function updateStatus(orderId, newStatus) {
    setUpdating(orderId);
    try {
      await adminRequest(`/orders/${orderId}/status`, {
        method: 'PATCH',
        body: { status: newStatus },
      });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
    } catch (err) {
      alert('Erro ao atualizar status: ' + (err.message || 'Tente novamente.'));
    } finally {
      setUpdating(null);
    }
  }

  function handleMarkedViewed(orderId) {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, viewed_by_admin: 1 } : o)));
    refreshUnseenCount();
  }

  const hasMore = page * LIMIT < total;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800 }}>Pedidos</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
            Gerencie todos os pedidos da loja{total > 0 ? ` · ${total} no total` : ''}.
          </p>
        </div>
        <button onClick={() => load(page)} className="btn-secondary" style={{ fontSize: 13 }}>
          <iconify-icon className="iconify" icon="mdi:refresh" style={{ fontSize: 16 }} />
          Atualizar
        </button>
      </div>

      {status === 'loading' && <p style={{ color: 'var(--muted)' }}>Carregando pedidos…</p>}
      {status === 'error'   && <p style={{ color: 'var(--muted)' }}>Erro ao carregar. Tente novamente.</p>}

      {status === 'ready' && (
        <>
          <div style={{ background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.2em', background: 'var(--bg)' }}>
                    {['#', 'Cliente', 'E-mail', 'Total', 'Forma', 'Envio', 'Status', 'Data', ''].map((h) => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!orders.length && (
                    <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Nenhum pedido encontrado.</td></tr>
                  )}
                  {orders.map((order) => {
                    const unseen = !order.viewed_by_admin;
                    return (
                      <tr key={order.id} style={{ borderBottom: '1px solid var(--border)', background: unseen ? 'rgba(220,38,38,0.04)' : 'transparent' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                          {unseen && (
                            <span
                              title="Pedido novo"
                              style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, background: '#dc2626', marginRight: 8 }}
                            />
                          )}
                          #{order.id}
                        </td>
                        <td style={{ padding: '14px 16px' }}>{order.customer_name}</td>
                        <td style={{ padding: '14px 16px', color: 'var(--muted)' }}>{order.email}</td>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--amber-dk)', fontFamily: 'var(--font-display)' }}>{brl(order.total_amount)}</td>
                        <td style={{ padding: '14px 16px', textTransform: 'capitalize' }}>{order.payment_method}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                            padding: '3px 8px', borderRadius: 999,
                            background: order.shipment_scope === 'internacional' ? 'rgba(124,58,237,0.1)' : 'rgba(15,118,110,0.1)',
                            color: order.shipment_scope === 'internacional' ? '#7c3aed' : '#0f766e',
                          }}>
                            {shipmentScopeLabel(order.shipment_scope)}
                          </span>
                          {order.tracking_code && (
                            <iconify-icon
                              className="iconify"
                              icon="mdi:truck-check-outline"
                              title={`Rastreio: ${order.tracking_code}`}
                              style={{ fontSize: 14, marginLeft: 6, color: 'var(--muted)', verticalAlign: 'middle' }}
                            />
                          )}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <select
                            value={order.status}
                            onChange={(e) => updateStatus(order.id, e.target.value)}
                            disabled={updating === order.id}
                            className="sort-select"
                            style={{ fontSize: 12, padding: '4px 8px', color: ORDER_STATUS_COLORS[order.status] }}
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--muted)' }}>
                          {order.created_at ? new Date(order.created_at).toLocaleString('pt-BR') : '—'}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {order.status === 'pending' && (
                              <button
                                onClick={() => updateStatus(order.id, 'paid')}
                                disabled={updating === order.id}
                                className="btn-primary"
                                style={{ fontSize: 12, padding: '6px 10px' }}
                                title="Confirmar que o pagamento foi recebido — o pedido passa a aparecer no perfil do cliente"
                              >
                                Confirmar pagamento
                              </button>
                            )}
                            <button onClick={() => setDetailId(order.id)} className="btn-secondary" style={{ fontSize: 12, padding: '6px 10px' }}>
                              Ver
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginação */}
          <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'center' }}>
            {page > 1 && (
              <button className="btn-secondary" onClick={() => load(page - 1)} style={{ fontSize: 13 }}>← Anterior</button>
            )}
            {hasMore && (
              <button className="btn-secondary" onClick={() => load(page + 1)} style={{ fontSize: 13 }}>Próxima →</button>
            )}
          </div>
        </>
      )}

      {detailId && (
        <OrderDetailModal orderId={detailId} onClose={() => setDetailId(null)} onMarkedViewed={handleMarkedViewed} />
      )}
    </div>
  );
}
