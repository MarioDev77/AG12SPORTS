'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useWish } from '@/context/WishContext';
import { apiRequest } from '@/lib/api';
import { brl, orderStatusLabel, shipmentScopeLabel, formatDeliveryWindow, ORDER_STATUS_COLORS } from '@/lib/format';

const EMPTY_REGISTER = { name: '', username: '', email: '', phone: '', password: '' };

export default function ContaPage() {
  const { user, token, login, register, logout, isAuthenticated } = useAuth();

  const [tab, setTab] = useState('favoritos'); // 'favoritos' | 'pedidos'

  const [orders, setOrders] = useState([]);
  const [ordersStatus, setOrdersStatus] = useState('idle'); // idle | loading | ready | error
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState({});

  useEffect(() => {
    if (tab !== 'pedidos' || !isAuthenticated || ordersStatus !== 'idle') return;
    setOrdersStatus('loading');
    apiRequest('/orders', { token })
      .then((data) => { setOrders(data.orders || []); setOrdersStatus('ready'); })
      .catch(() => setOrdersStatus('error'));
  }, [tab, isAuthenticated, ordersStatus, token]);

  function toggleOrder(id) {
    if (expandedOrder === id) { setExpandedOrder(null); return; }
    setExpandedOrder(id);
    if (!orderDetails[id]) {
      apiRequest(`/orders/${id}`, { token })
        .then((data) => setOrderDetails((prev) => ({ ...prev, [id]: data.order })))
        .catch(() => {});
    }
  }

  const [mode, setMode] = useState('login'); // 'login' | 'register'

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [logging,  setLogging]  = useState(false);

  const [regData,  setRegData]  = useState(EMPTY_REGISTER);
  const [regErr,   setRegErr]   = useState('');
  const [registering, setRegistering] = useState(false);

  const { ids: wishIds, snapshots: wishSnapshots, toggleWish } = useWish();

  async function handleLogin(e) {
    e.preventDefault();
    setLoginErr('');
    if (!username || !password) { setLoginErr('Preencha usuário e senha.'); return; }
    setLogging(true);
    try {
      await login(username, password);
    } catch (err) {
      setLoginErr(err.message || 'Falha ao autenticar.');
    } finally {
      setLogging(false);
    }
  }

  function handleRegisterField(field, value) {
    setRegData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleRegister(e) {
    e.preventDefault();
    setRegErr('');

    const { name, username: regUsername, email, phone, password: regPassword } = regData;
    if (!name || !regUsername || !email || !regPassword) {
      setRegErr('Preencha nome, usuário, e-mail e senha.');
      return;
    }
    if (regUsername.length < 3) {
      setRegErr('O nome de usuário precisa ter pelo menos 3 caracteres.');
      return;
    }
    if (!/^[\w@.-]+$/.test(regUsername)) {
      setRegErr('Nome de usuário só pode ter letras, números, ponto, @, - ou _.');
      return;
    }
    if (regPassword.length < 8) {
      setRegErr('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }

    setRegistering(true);
    try {
      const payload = { name, username: regUsername, email, password: regPassword };
      if (phone) payload.phone = phone;
      await register(payload);
    } catch (err) {
      const msg = err.message === 'Invalid payload'
        ? 'Verifique os dados: usuário só com letras/números (mín. 3), e-mail válido e senha com 8+ caracteres.'
        : (err.message || 'Falha ao criar conta.');
      setRegErr(msg);
    } finally {
      setRegistering(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div style={{ paddingTop: 100, display: 'flex', justifyContent: 'center', padding: '100px 24px 60px' }}>
        <div className="modal-content" style={{ width: '100%', maxWidth: 440 }}>
          <div className="checkout-body">
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--bg)', borderRadius: 10, padding: 4 }}>
              <button
                type="button"
                onClick={() => setMode('login')}
                className={mode === 'login' ? 'btn-primary' : 'btn-secondary'}
                style={{ flex: 1, justifyContent: 'center', fontSize: 13 }}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={mode === 'register' ? 'btn-primary' : 'btn-secondary'}
                style={{ flex: 1, justifyContent: 'center', fontSize: 13 }}
              >
                Criar conta
              </button>
            </div>

            {mode === 'login' && (
              <>
                <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.3em', color: 'var(--muted)', marginBottom: 24 }}>
                  Entrar na minha conta
                </p>
                <div className="checkout-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <input
                    type="text"
                    placeholder="E-mail ou usuário"
                    className="field-input"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                  <input
                    type="password"
                    placeholder="Senha"
                    className="field-input"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin(e)}
                  />
                  {loginErr && <div className="error-box">{loginErr}</div>}
                  <button onClick={handleLogin} className="btn-primary" style={{ justifyContent: 'center' }} disabled={logging}>
                    {logging ? 'Entrando…' : 'Entrar'}
                  </button>
                </div>
              </>
            )}

            {mode === 'register' && (
              <>
                <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.3em', color: 'var(--muted)', marginBottom: 24 }}>
                  Criar minha conta
                </p>
                <form onSubmit={handleRegister} className="checkout-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <input
                    type="text"
                    placeholder="Nome completo"
                    className="field-input"
                    autoComplete="name"
                    value={regData.name}
                    onChange={(e) => handleRegisterField('name', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Nome de usuário (mín. 3 caracteres)"
                    className="field-input"
                    autoComplete="username"
                    value={regData.username}
                    onChange={(e) => handleRegisterField('username', e.target.value)}
                  />
                  <input
                    type="email"
                    placeholder="E-mail"
                    className="field-input"
                    autoComplete="email"
                    value={regData.email}
                    onChange={(e) => handleRegisterField('email', e.target.value)}
                  />
                  <input
                    type="tel"
                    placeholder="Telefone (opcional)"
                    className="field-input"
                    autoComplete="tel"
                    value={regData.phone}
                    onChange={(e) => handleRegisterField('phone', e.target.value)}
                  />
                  <input
                    type="password"
                    placeholder="Senha (mín. 8 caracteres)"
                    className="field-input"
                    autoComplete="new-password"
                    value={regData.password}
                    onChange={(e) => handleRegisterField('password', e.target.value)}
                  />
                  {regErr && <div className="error-box">{regErr}</div>}
                  <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }} disabled={registering}>
                    {registering ? 'Criando conta…' : 'Criar conta'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 100, maxWidth: 900, margin: '0 auto', padding: '100px 24px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800 }}>Minha conta</h1>
          {user && <p style={{ color: 'var(--muted)', marginTop: 4, fontSize: 14 }}>{user.email || user.username}</p>}
        </div>
        <button onClick={logout} className="btn-secondary">Sair</button>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: 'var(--surface)', borderRadius: 10, padding: 4, width: 'fit-content', border: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={() => setTab('favoritos')}
          className={tab === 'favoritos' ? 'btn-primary' : 'btn-secondary'}
          style={{ fontSize: 13 }}
        >
          Favoritos {wishIds.length > 0 ? `(${wishIds.length})` : ''}
        </button>
        <button
          type="button"
          onClick={() => setTab('pedidos')}
          className={tab === 'pedidos' ? 'btn-primary' : 'btn-secondary'}
          style={{ fontSize: 13 }}
        >
          Meus pedidos
        </button>
      </div>

      {tab === 'pedidos' && (
        <section>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
            Meus pedidos {orders.length > 0 ? `(${orders.length})` : ''}
          </h2>

          {ordersStatus === 'loading' && <p style={{ color: 'var(--muted)' }}>Carregando pedidos…</p>}
          {ordersStatus === 'error' && <p style={{ color: 'var(--muted)' }}>Não foi possível carregar seus pedidos.</p>}

          {ordersStatus === 'ready' && orders.length === 0 && (
            <div id="emptyState" role="status">
              <iconify-icon className="iconify" icon="mdi:receipt-text-outline" style={{ fontSize: 36, color: 'var(--muted)', marginBottom: 12 }} />
              <h3>Nenhum pedido ainda</h3>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>
                Seus pedidos aparecerão aqui depois de finalizar uma compra.
              </p>
            </div>
          )}

          {ordersStatus === 'ready' && orders.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {orders.map((order) => {
                const detail = orderDetails[order.id];
                const open = expandedOrder === order.id;
                return (
                  <div key={order.id} style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => toggleOrder(order.id)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 14 }}>Pedido #{order.id}</p>
                        <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
                          {order.createdAt ? new Date(order.createdAt).toLocaleDateString('pt-BR') : ''}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span style={{
                          fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                          color: ORDER_STATUS_COLORS[order.status] || 'var(--muted)',
                        }}>
                          {orderStatusLabel(order.status)}
                        </span>
                        <strong style={{ fontFamily: 'var(--font-display)', color: 'var(--amber-dk)' }}>{brl(order.total)}</strong>
                        <iconify-icon className="iconify" icon={open ? 'mdi:chevron-up' : 'mdi:chevron-down'} style={{ fontSize: 18, color: 'var(--muted)' }} />
                      </div>
                    </button>

                    {open && (
                      <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--border)' }}>
                        {!detail && <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 14 }}>Carregando detalhes…</p>}
                        {detail && (
                          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {detail.items.map((it, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                <span>{it.qty}x {it.name}{it.size ? ` (tam. ${it.size})` : ''}</span>
                                <span>{brl(it.lineTotal)}</span>
                              </div>
                            ))}
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--muted)' }}>
                              <p>Entrega: {detail.address.logradouro}, {detail.address.numero} — {detail.address.cidade}/{detail.address.uf}</p>
                              <p>Frete: {brl(detail.shippingCost)} · Prazo: {detail.estimatedMinDays}–{detail.estimatedMaxDays} dias úteis</p>
                              {formatDeliveryWindow(detail.estimatedMinDate, detail.estimatedMaxDate) && (
                                <p>📦 Entrega estimada: {formatDeliveryWindow(detail.estimatedMinDate, detail.estimatedMaxDate)}</p>
                              )}
                              <p>Pagamento: {detail.paymentMethod === 'pix' ? 'Pix' : detail.paymentMethod === 'cartao' ? 'Cartão' : 'Boleto'}</p>
                              <p>Envio: {shipmentScopeLabel(detail.shipmentScope)}</p>
                              {detail.tracking?.code && (
                                <p>
                                  Rastreio: {detail.tracking.carrier ? `${detail.tracking.carrier} — ` : ''}
                                  {detail.tracking.url ? (
                                    <a href={detail.tracking.url} target="_blank" rel="noopener" style={{ color: 'var(--amber-dk)', fontWeight: 600 }}>
                                      {detail.tracking.code}
                                    </a>
                                  ) : (
                                    <strong style={{ color: 'var(--ink)' }}>{detail.tracking.code}</strong>
                                  )}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === 'favoritos' && (
      <section>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
          Meus favoritos {wishIds.length > 0 ? `(${wishIds.length})` : ''}
        </h2>

        {wishIds.length === 0 && (
          <div id="emptyState" role="status">
            <iconify-icon className="iconify" icon="mdi:heart-outline" style={{ fontSize: 36, color: 'var(--muted)', marginBottom: 12 }} />
            <h3>Nenhum favorito ainda</h3>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>Clique no ♡ de um produto para salvá-lo aqui.</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {wishIds.map((id) => {
            const p = wishSnapshots[id];
            return (
              <div key={id} style={{ background: 'var(--surface)', borderRadius: 16, padding: 16, border: '1px solid var(--border)' }}>
                <Link href={`/produto/${id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={(p && p.image) || ''}
                    alt={(p && p.name) || 'Produto'}
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10, marginBottom: 10 }}
                  />
                  <p style={{ fontSize: 12, color: 'var(--muted)' }}>{(p && p.brand) || ''}</p>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{(p && p.name) || `Produto #${id}`}</p>
                  {p && p.price ? (
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--amber-dk)', marginTop: 4 }}>{brl(p.price)}</p>
                  ) : null}
                </Link>
                <button
                  type="button"
                  onClick={() => toggleWish(id)}
                  className="btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 10, fontSize: 13 }}
                >
                  Remover dos favoritos
                </button>
              </div>
            );
          })}
        </div>
      </section>
      )}
    </div>
  );
}
