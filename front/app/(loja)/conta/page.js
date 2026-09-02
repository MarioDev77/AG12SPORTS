'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useWish } from '@/context/WishContext';
import { apiRequest } from '@/lib/api';
import { brl, orderStatusLabel, shipmentScopeLabel, formatDeliveryWindow, ORDER_STATUS_COLORS, maskCep, maskPhone } from '@/lib/format';

const EMPTY_REGISTER = { name: '', username: '', email: '', phone: '', password: '' };

const BRAZIL_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const EMPTY_ADDRESS = { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', isDefault: false };

// ─── Modal de adicionar/editar endereço — mesmo padrão de CEP do checkout ────
function AddressFormModal({ initial, onClose, onSaved, token }) {
  const [form, setForm] = useState(initial ? { ...EMPTY_ADDRESS, ...initial, complemento: initial.complemento || '' } : EMPTY_ADDRESS);
  const [cepStatus, setCepStatus] = useState('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!initial?.id;

  async function handleCepBlur() {
    const digits = form.cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setCepStatus('loading');
    try {
      const addr = await apiRequest(`/cep/${digits}`);
      setForm((f) => ({
        ...f,
        logradouro: addr.logradouro || f.logradouro,
        bairro: addr.bairro || f.bairro,
        cidade: addr.cidade || f.cidade,
        uf: (addr.uf || f.uf).toUpperCase(),
      }));
      setCepStatus('idle');
    } catch {
      setCepStatus('error');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, cep: maskCep(form.cep) };
      if (isEdit) {
        await apiRequest(`/addresses/${initial.id}`, { method: 'PATCH', body: payload, token });
      } else {
        await apiRequest('/addresses', { method: 'POST', body: payload, token });
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Não foi possível salvar. Confira os campos.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="checkout-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <p className="checkout-section-title" style={{ marginBottom: 0 }}>{isEdit ? 'Editar endereço' : 'Novo endereço'}</p>
            <button type="button" onClick={onClose} className="modal-close-btn" style={{ alignSelf: 'auto' }} aria-label="Fechar">
              <iconify-icon className="iconify" icon="mdi:close" style={{ fontSize: 16 }} />
            </button>
          </div>

          <div className="checkout-form-grid">
            <input
              className="field-input"
              placeholder="CEP"
              value={form.cep}
              onChange={(e) => setForm((f) => ({ ...f, cep: maskCep(e.target.value) }))}
              onBlur={handleCepBlur}
              maxLength={9}
              required
            />
            <input className="field-input" placeholder="Número" value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} required />
            <input className="field-input field-full" placeholder="Rua/logradouro" value={form.logradouro} onChange={(e) => setForm((f) => ({ ...f, logradouro: e.target.value }))} required />
            <input className="field-input" placeholder="Complemento (opcional)" value={form.complemento} onChange={(e) => setForm((f) => ({ ...f, complemento: e.target.value }))} />
            <input className="field-input" placeholder="Bairro" value={form.bairro} onChange={(e) => setForm((f) => ({ ...f, bairro: e.target.value }))} required />
            <input className="field-input" placeholder="Cidade" value={form.cidade} onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))} required />
            <select className="field-input" value={form.uf} onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value }))} required>
              <option value="">UF</option>
              {BRAZIL_UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13.5 }}>
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} />
            Usar como endereço padrão
          </label>

          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
            {cepStatus === 'loading' ? 'Consultando CEP…' : ''}
          </p>

          {error && <p style={{ color: '#b91c1c', fontSize: 12.5, marginTop: 8 }}>{error}</p>}

          <button type="submit" disabled={saving} className="btn-primary" style={{ fontSize: 13, marginTop: 16 }}>
            {saving ? 'Salvando…' : 'Salvar endereço'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ContaPage() {
  const { user, token, login, register, logout, isAuthenticated, updateUser } = useAuth();

  const [tab, setTab] = useState('pedidos'); // 'pedidos' | 'perfil' | 'enderecos' | 'favoritos'

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

  // ── Meu perfil ────────────────────────────────────────────────────────────
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });
  const [profileStatus, setProfileStatus] = useState('idle'); // idle | saving | saved | error
  const [profileErr, setProfileErr] = useState('');

  useEffect(() => {
    if (user) setProfileForm({ name: user.name || '', phone: user.phone || '' });
  }, [user]);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setProfileStatus('saving');
    setProfileErr('');
    try {
      const payload = {};
      if (profileForm.name) payload.name = profileForm.name;
      if (profileForm.phone) payload.phone = profileForm.phone.replace(/[^\d()+\-\s]/g, '');
      const data = await apiRequest('/auth/me', { method: 'PATCH', body: payload, token });
      updateUser(data.user);
      setProfileStatus('saved');
    } catch (err) {
      setProfileErr(err.message || 'Não foi possível salvar.');
      setProfileStatus('error');
    }
  }

  // ── Endereços ────────────────────────────────────────────────────────────
  const [addresses, setAddresses] = useState([]);
  const [addressesStatus, setAddressesStatus] = useState('idle'); // idle | loading | ready | error
  const [addressModal, setAddressModal] = useState(null); // null fechado, {} novo, {id,...} editar

  function loadAddresses() {
    setAddressesStatus('loading');
    apiRequest('/addresses', { token })
      .then((data) => { setAddresses(data || []); setAddressesStatus('ready'); })
      .catch(() => setAddressesStatus('error'));
  }

  useEffect(() => {
    if (tab !== 'enderecos' || !isAuthenticated || addressesStatus !== 'idle') return;
    loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isAuthenticated, addressesStatus]);

  async function handleDeleteAddress(addr) {
    if (!confirm('Excluir este endereço?')) return;
    try {
      await apiRequest(`/addresses/${addr.id}`, { method: 'DELETE', token });
      setAddresses((prev) => prev.filter((a) => a.id !== addr.id));
    } catch (err) {
      alert(err.message || 'Não foi possível excluir.');
    }
  }

  async function handleSetDefaultAddress(addr) {
    try {
      await apiRequest(`/addresses/${addr.id}`, { method: 'PATCH', body: { isDefault: true }, token });
      loadAddresses();
    } catch (err) {
      alert(err.message || 'Não foi possível definir como padrão.');
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

      <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: 'var(--surface)', borderRadius: 10, padding: 4, width: 'fit-content', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setTab('pedidos')} className={tab === 'pedidos' ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: 13 }}>
          <iconify-icon className="iconify" icon="mdi:receipt-text-outline" style={{ fontSize: 15 }} />
          Meus pedidos
        </button>
        <button type="button" onClick={() => setTab('perfil')} className={tab === 'perfil' ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: 13 }}>
          <iconify-icon className="iconify" icon="mdi:account-outline" style={{ fontSize: 15 }} />
          Meu perfil
        </button>
        <button type="button" onClick={() => setTab('enderecos')} className={tab === 'enderecos' ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: 13 }}>
          <iconify-icon className="iconify" icon="mdi:map-marker-outline" style={{ fontSize: 15 }} />
          Endereços
        </button>
        <button type="button" onClick={() => setTab('favoritos')} className={tab === 'favoritos' ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: 13 }}>
          <iconify-icon className="iconify" icon="mdi:heart-outline" style={{ fontSize: 15 }} />
          Favoritos {wishIds.length > 0 ? `(${wishIds.length})` : ''}
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
                              {detail.origin && (
                                <p>Saiu de: {detail.origin.name} ({detail.origin.cidade}/{detail.origin.uf})</p>
                              )}
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

      {tab === 'perfil' && (
        <section>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Meu perfil</h2>
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', padding: 20, maxWidth: 480 }}>
            <form onSubmit={handleSaveProfile} className="checkout-form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <label style={{ fontSize: 12, color: 'var(--muted)' }}>
                Nome completo
                <input className="field-input" value={profileForm.name} onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))} />
              </label>
              <label style={{ fontSize: 12, color: 'var(--muted)' }}>
                Telefone
                <input className="field-input" value={profileForm.phone} onChange={(e) => setProfileForm((f) => ({ ...f, phone: maskPhone(e.target.value) }))} />
              </label>
              <label style={{ fontSize: 12, color: 'var(--muted)' }}>
                E-mail (não editável)
                <input className="field-input" value={user?.email || ''} disabled style={{ opacity: 0.6 }} />
              </label>
              <label style={{ fontSize: 12, color: 'var(--muted)' }}>
                Usuário (não editável)
                <input className="field-input" value={user?.username || ''} disabled style={{ opacity: 0.6 }} />
              </label>
              {profileErr && <div className="error-box">{profileErr}</div>}
              {profileStatus === 'saved' && <p style={{ color: '#15803d', fontSize: 12.5 }}>Perfil atualizado.</p>}
              <button type="submit" disabled={profileStatus === 'saving'} className="btn-primary" style={{ justifyContent: 'center' }}>
                {profileStatus === 'saving' ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </form>
          </div>
        </section>
      )}

      {tab === 'enderecos' && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>
              Meus endereços {addresses.length > 0 ? `(${addresses.length})` : ''}
            </h2>
            <button onClick={() => setAddressModal({})} className="btn-primary" style={{ fontSize: 13 }}>
              <iconify-icon className="iconify" icon="mdi:plus" style={{ fontSize: 15 }} />
              Adicionar
            </button>
          </div>

          {addressesStatus === 'loading' && <p style={{ color: 'var(--muted)' }}>Carregando endereços…</p>}
          {addressesStatus === 'error' && <p style={{ color: 'var(--muted)' }}>Não foi possível carregar seus endereços.</p>}

          {addressesStatus === 'ready' && addresses.length === 0 && (
            <div id="emptyState" role="status">
              <iconify-icon className="iconify" icon="mdi:map-marker-outline" style={{ fontSize: 36, color: 'var(--muted)', marginBottom: 12 }} />
              <h3>Nenhum endereço salvo</h3>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>Adicione um endereço pra agilizar seus próximos pedidos.</p>
            </div>
          )}

          {addressesStatus === 'ready' && addresses.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {addresses.map((addr) => (
                <div key={addr.id} style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    {!!addr.is_default && (
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--amber-dk)' }}>Padrão</span>
                    )}
                    <p style={{ fontSize: 14, marginTop: 2 }}>{addr.logradouro}, {addr.numero}{addr.complemento ? ` — ${addr.complemento}` : ''}</p>
                    <p style={{ fontSize: 13, color: 'var(--muted)' }}>{addr.bairro} · {addr.cidade}/{addr.uf} · CEP {addr.cep}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {!addr.is_default && (
                      <button onClick={() => handleSetDefaultAddress(addr)} className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}>Tornar padrão</button>
                    )}
                    <button onClick={() => setAddressModal(addr)} className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}>Editar</button>
                    <button onClick={() => handleDeleteAddress(addr)} className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px', color: '#b91c1c' }}>Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {addressModal && (
            <AddressFormModal
              initial={addressModal}
              token={token}
              onClose={() => setAddressModal(null)}
              onSaved={() => { setAddressModal(null); loadAddresses(); }}
            />
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
