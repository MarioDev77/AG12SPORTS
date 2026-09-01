'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { apiRequest, ApiError } from '@/lib/api';
import { brl, maskCep, maskCpf, maskPhone, onlyDigits } from '@/lib/format';

const WPP_NUMBER = '557598756510';

const STEPS = [
  { id: 1, label: 'Dados' },
  { id: 2, label: 'Frete' },
  { id: 3, label: 'Pagamento' },
  { id: 4, label: 'Revisão' },
];

const BRAZIL_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const PAYMENT_OPTIONS = [
  { value: 'pix', name: 'Pix', desc: 'Aprovação imediata' },
  { value: 'cartao', name: 'Cartão', desc: 'Crédito ou débito' },
  { value: 'boleto', name: 'Boleto', desc: 'Até 3 dias úteis' },
];

const EMPTY_FORM = {
  name: '', cpf: '', email: '', phone: '',
  cep: '', street: '', number: '', complement: '', bairro: '', city: '', state: '',
};

export default function CheckoutPage() {
  const router = useRouter();
  const showToast = useToast();
  const { isAuthenticated, user, token, login, register } = useAuth();
  const { items, subtotal, hydrated, clearCart } = useCart();

  // ——— Mini login/register (checkout exige conta, pedidos ficam vinculados ao usuário) ———
  const [authMode, setAuthMode] = useState('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authReg, setAuthReg] = useState({ name: '', username: '', email: '', phone: '', password: '' });
  const [authErr, setAuthErr] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  // ——— Wizard ———
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [cepStatus, setCepStatus] = useState('idle'); // idle | loading | error
  const [stepError, setStepError] = useState('');

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [saveAddress, setSaveAddress] = useState(true);

  const [shipping, setShipping] = useState({ status: 'idle' }); // idle|loading|ready|unavailable|error
  const [paymentMethod, setPaymentMethod] = useState('pix');

  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState(null);

  // Prefill nome/e-mail assim que autenticado.
  useEffect(() => {
    if (user) {
      setForm((f) => ({ ...f, name: f.name || user.name || '', email: f.email || user.email || '' }));
    }
  }, [user]);

  // Endereços salvos do cliente.
  useEffect(() => {
    if (!isAuthenticated) return;
    apiRequest('/addresses', { token }).then(setSavedAddresses).catch(() => {});
  }, [isAuthenticated, token]);

  function field(name) {
    return { value: form[name], onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) };
  }

  async function handleCepBlur() {
    const digits = onlyDigits(form.cep);
    if (digits.length !== 8) return;
    setCepStatus('loading');
    try {
      const addr = await apiRequest(`/cep/${digits}`);
      setForm((f) => ({
        ...f,
        street: addr.logradouro || f.street,
        bairro: addr.bairro || f.bairro,
        city: addr.cidade || f.city,
        state: (addr.uf || f.state).toUpperCase(),
      }));
      setCepStatus('idle');
    } catch (err) {
      setCepStatus('error');
      showToast(err.message || 'Não foi possível consultar o CEP.', 'error');
    }
  }

  function pickSavedAddress(addr) {
    setForm((f) => ({
      ...f,
      cep: maskCep(addr.cep),
      street: addr.logradouro,
      number: addr.numero,
      complement: addr.complemento || '',
      bairro: addr.bairro,
      city: addr.cidade,
      state: addr.uf,
    }));
    setSaveAddress(false);
    showToast('Endereço preenchido.', 'success');
  }

  async function handleLogin(e) {
    e.preventDefault();
    setAuthErr('');
    if (!authUsername || !authPassword) { setAuthErr('Preencha usuário e senha.'); return; }
    setAuthBusy(true);
    try {
      await login(authUsername, authPassword);
    } catch (err) {
      setAuthErr(err.message || 'Falha ao autenticar.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setAuthErr('');
    const { name, username, email, phone, password } = authReg;
    if (!name || !username || !email || !password) { setAuthErr('Preencha nome, usuário, e-mail e senha.'); return; }
    if (username.length < 3) { setAuthErr('O nome de usuário precisa ter pelo menos 3 caracteres.'); return; }
    if (!/^[\w@.-]+$/.test(username)) { setAuthErr('Nome de usuário só pode ter letras, números, ponto, @, - ou _.'); return; }
    if (password.length < 8) { setAuthErr('A senha precisa ter pelo menos 8 caracteres.'); return; }
    setAuthBusy(true);
    try {
      const payload = { name, username, email, password };
      if (phone) payload.phone = phone;
      await register(payload);
    } catch (err) {
      const msg = err.message === 'Invalid payload'
        ? 'Verifique os dados: usuário só com letras/números (mín. 3), e-mail válido e senha com 8+ caracteres.'
        : (err.message || 'Falha ao criar conta.');
      setAuthErr(msg);
    } finally {
      setAuthBusy(false);
    }
  }

  function validateStep1() {
    const { name, cpf, email, phone, cep, street, number, bairro, city, state } = form;
    if (!name || !cpf || !email || !phone) return 'Preencha seus dados de contato.';
    if (onlyDigits(cpf).length !== 11) return 'CPF inválido.';
    if (!cep || onlyDigits(cep).length !== 8) return 'CEP inválido.';
    if (!street || !number || !bairro || !city) return 'Complete o endereço de entrega.';
    if (!state || !BRAZIL_UFS.includes(state.toUpperCase())) return 'Selecione o estado (UF) do endereço.';
    return '';
  }

  async function calculateShipping() {
    setShipping({ status: 'loading' });
    try {
      const data = await apiRequest('/shipping/calculate', { method: 'POST', body: { state: form.state } });
      if (!data.available) {
        setShipping({ status: 'unavailable' });
        return;
      }
      setShipping({ status: 'ready', ...data });
    } catch (err) {
      setShipping({ status: 'error' });
      showToast(err.message || 'Não foi possível calcular o frete.', 'error');
    }
  }

  async function goToStep2() {
    const err = validateStep1();
    if (err) { setStepError(err); return; }
    setStepError('');
    setStep(2);
    calculateShipping();
  }

  const shippingCost = shipping.status === 'ready' ? shipping.shippingCost : 0;
  const total = Number((subtotal + shippingCost).toFixed(2));

  async function handleSubmitOrder() {
    setSubmitting(true);
    setStepError('');
    try {
      const payload = {
        customer: { name: form.name, cpf: onlyDigits(form.cpf), email: form.email, phone: form.phone },
        address: {
          cep: maskCep(form.cep),
          street: form.street,
          number: form.number,
          complement: form.complement || undefined,
          bairro: form.bairro,
          city: form.city,
          state: form.state.toUpperCase(),
        },
        payment: { method: paymentMethod },
        items: items.map((it) => ({
          productId: it.productId,
          size: it.size ? String(it.size) : 'ÚNICO',
          qty: it.qty,
        })),
      };

      const result = await apiRequest('/orders', { method: 'POST', body: payload, token });
      setOrderResult(result);
      clearCart();

      if (saveAddress) {
        apiRequest('/addresses', {
          method: 'POST',
          token,
          body: {
            cep: maskCep(form.cep),
            logradouro: form.street,
            numero: form.number,
            complemento: form.complement || undefined,
            bairro: form.bairro,
            cidade: form.city,
            uf: form.state.toUpperCase(),
            isDefault: savedAddresses.length === 0,
          },
        }).catch(() => {});
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Não foi possível concluir o pedido. Tente novamente.';
      setStepError(msg);
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function buildWhatsappMessage() {
    if (!orderResult) return '';
    const lines = [
      `Olá! Acabei de finalizar o pedido #${orderResult.orderId} na AG12 Sports.`,
      '',
      ...items.map((it) => `• ${it.qty}x ${it.name}${it.size ? ` (tam. ${it.size})` : ''}`),
      '',
      `Subtotal: ${brl(orderResult.subtotal)}`,
      `Frete: ${brl(orderResult.shippingCost)}`,
      `Total: ${brl(orderResult.total)}`,
      `Pagamento: ${paymentMethod === 'pix' ? 'Pix' : paymentMethod === 'cartao' ? 'Cartão' : 'Boleto'}`,
      `Prazo estimado: ${orderResult.estimatedMinDays}-${orderResult.estimatedMaxDays} dias úteis`,
    ];
    return encodeURIComponent(lines.join('\n'));
  }

  // ——— Estados de guarda ———

  if (!hydrated) {
    return (
      <div style={{ paddingTop: 120, textAlign: 'center', color: 'var(--muted)' }}>
        <iconify-icon className="iconify" icon="mdi:loading" style={{ fontSize: 36, animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!orderResult && items.length === 0) {
    return (
      <div style={{ paddingTop: 120, textAlign: 'center', padding: '120px 24px 60px' }}>
        <iconify-icon className="iconify" icon="mdi:cart-off" style={{ fontSize: 48, color: 'var(--muted)' }} />
        <h2 style={{ marginTop: 16 }}>Seu carrinho está vazio</h2>
        <p style={{ color: 'var(--muted)', marginTop: 8 }}>Adicione produtos antes de finalizar a compra.</p>
        <Link href="/produtos" className="btn-primary" style={{ display: 'inline-flex', marginTop: 20, justifyContent: 'center' }}>
          Ver produtos
        </Link>
      </div>
    );
  }

  if (!isAuthenticated && !orderResult) {
    return (
      <div style={{ paddingTop: 100, display: 'flex', justifyContent: 'center', padding: '100px 24px 60px' }}>
        <div className="modal-content" style={{ width: '100%', maxWidth: 440 }}>
          <div className="checkout-body">
            <p className="checkout-section-title">Entre para continuar</p>
            <p className="checkout-section-sub">Seu pedido fica salvo na sua conta — você acompanha o status em &quot;Minha conta&quot;.</p>

            <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg)', borderRadius: 10, padding: 4 }}>
              <button type="button" onClick={() => setAuthMode('login')} className={authMode === 'login' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, justifyContent: 'center', fontSize: 13 }}>
                Entrar
              </button>
              <button type="button" onClick={() => setAuthMode('register')} className={authMode === 'register' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, justifyContent: 'center', fontSize: 13 }}>
                Criar conta
              </button>
            </div>

            {authMode === 'login' ? (
              <div className="checkout-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <input type="text" placeholder="E-mail ou usuário" className="field-input" value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} />
                <input type="password" placeholder="Senha" className="field-input" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin(e)} />
                {authErr && <div className="error-box">{authErr}</div>}
                <button onClick={handleLogin} className="btn-primary" style={{ justifyContent: 'center' }} disabled={authBusy}>
                  {authBusy ? 'Entrando…' : 'Entrar'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="checkout-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <input type="text" placeholder="Nome completo" className="field-input" value={authReg.name} onChange={(e) => setAuthReg((r) => ({ ...r, name: e.target.value }))} />
                <input type="text" placeholder="Nome de usuário (mín. 3 caracteres)" className="field-input" value={authReg.username} onChange={(e) => setAuthReg((r) => ({ ...r, username: e.target.value }))} />
                <input type="email" placeholder="E-mail" className="field-input" value={authReg.email} onChange={(e) => setAuthReg((r) => ({ ...r, email: e.target.value }))} />
                <input type="tel" placeholder="Telefone (opcional)" className="field-input" value={authReg.phone} onChange={(e) => setAuthReg((r) => ({ ...r, phone: e.target.value }))} />
                <input type="password" placeholder="Senha (mín. 8 caracteres)" className="field-input" value={authReg.password} onChange={(e) => setAuthReg((r) => ({ ...r, password: e.target.value }))} />
                {authErr && <div className="error-box">{authErr}</div>}
                <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }} disabled={authBusy}>
                  {authBusy ? 'Criando conta…' : 'Criar conta'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ——— Sucesso ———
  if (orderResult) {
    return (
      <div style={{ paddingTop: 100, display: 'flex', justifyContent: 'center', padding: '100px 24px 60px' }}>
        <div className="modal-content" style={{ width: '100%', maxWidth: 560 }}>
          <div className="checkout-body">
            <div className="checkout-success">
              <iconify-icon className="iconify" icon="mdi:whatsapp" style={{ fontSize: 44, color: '#16a34a' }} />
              <h3>Pedido #{orderResult.orderId} registrado!</h3>
              <p>
                Total {brl(orderResult.total)} · entrega em {orderResult.estimatedMinDays}–{orderResult.estimatedMaxDays} dias úteis.
                <br />
                Envie o comprovante de pagamento pelo WhatsApp para confirmarmos — assim que confirmado,
                seu pedido aparece em &quot;Meus pedidos&quot;.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
              <a
                href={`https://wa.me/${WPP_NUMBER}?text=${buildWhatsappMessage()}`}
                target="_blank"
                rel="noopener"
                className="btn-primary"
                style={{ justifyContent: 'center' }}
              >
                <iconify-icon className="iconify" icon="mdi:whatsapp" style={{ fontSize: 16 }} />
                Finalizar pelo WhatsApp
              </a>
              <button onClick={() => router.push('/produtos')} className="btn-secondary" style={{ justifyContent: 'center' }}>
                Ver mais produtos
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ——— Wizard ———
  return (
    <div style={{ paddingTop: 100, display: 'flex', justifyContent: 'center', padding: '100px 24px 60px' }}>
      <div className="modal-content" style={{ width: '100%', maxWidth: 680 }}>
        <div className="checkout-body">
          <div className="checkout-steps-row">
            {STEPS.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'initial' }}>
                <div className={`step-circle ${s.id < step ? 'done' : s.id === step ? 'current' : 'pending'}`}>
                  {s.id < step ? <iconify-icon className="iconify" icon="mdi:check" /> : s.id}
                </div>
                {i < STEPS.length - 1 && <div className={`step-line ${s.id < step ? 'done' : ''}`} />}
              </div>
            ))}
          </div>

          {/* Passo 1 — Dados e endereço */}
          {step === 1 && (
            <>
              <p className="checkout-section-title">Seus dados</p>
              <p className="checkout-section-sub">Usados para identificar o pedido e a nota fiscal.</p>
              <div className="checkout-form-grid">
                <input className="field-input field-full" placeholder="Nome completo" {...field('name')} />
                <input className="field-input" placeholder="CPF" value={form.cpf} onChange={(e) => setForm((f) => ({ ...f, cpf: maskCpf(e.target.value) }))} />
                <input className="field-input" placeholder="Telefone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: maskPhone(e.target.value) }))} />
                <input className="field-input field-full" type="email" placeholder="E-mail" {...field('email')} />
              </div>

              <p className="checkout-section-title" style={{ marginTop: 28 }}>Endereço de entrega</p>
              <p className="checkout-section-sub">Preenchemos rua, bairro e cidade a partir do CEP.</p>

              {savedAddresses.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  {savedAddresses.map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => pickSavedAddress(addr)}
                      className="btn-secondary"
                      style={{ fontSize: 12.5, textAlign: 'left' }}
                    >
                      <iconify-icon className="iconify" icon="mdi:map-marker-outline" style={{ fontSize: 14 }} />
                      {addr.logradouro}, {addr.numero} — {addr.cidade}/{addr.uf}
                    </button>
                  ))}
                </div>
              )}

              <div className="checkout-form-grid">
                <input
                  className="field-input"
                  placeholder="CEP"
                  value={form.cep}
                  onChange={(e) => setForm((f) => ({ ...f, cep: maskCep(e.target.value) }))}
                  onBlur={handleCepBlur}
                />
                <input className="field-input" placeholder="Número" {...field('number')} />
                <input className="field-input field-full" placeholder="Rua / Logradouro" {...field('street')} />
                <input className="field-input" placeholder="Bairro" {...field('bairro')} />
                <input className="field-input" placeholder="Complemento (opcional)" {...field('complement')} />
                <input className="field-input" placeholder="Cidade" {...field('city')} />
                <select
                  className="field-input"
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                >
                  <option value="">UF</option>
                  {BRAZIL_UFS.map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
              {cepStatus === 'loading' && <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8 }}>Consultando CEP…</p>}

              {isAuthenticated && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 13, color: 'var(--muted)' }}>
                  <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                  Salvar este endereço para próximas compras
                </label>
              )}

              {stepError && <div className="error-box">{stepError}</div>}

              <div className="checkout-nav">
                <button onClick={goToStep2} className="btn-primary">Continuar</button>
              </div>
            </>
          )}

          {/* Passo 2 — Frete */}
          {step === 2 && (
            <>
              <p className="checkout-section-title">Frete e prazo</p>
              <p className="checkout-section-sub">Calculado a partir do estado do endereço ({form.state}).</p>

              {shipping.status === 'loading' && <p style={{ color: 'var(--muted)' }}>Calculando frete…</p>}

              {shipping.status === 'ready' && (
                <div className="checkout-summary">
                  <div className="summary-row">
                    <span>Valor do frete</span>
                    <strong>{brl(shipping.shippingCost)}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Prazo estimado</span>
                    <strong>{shipping.estimatedMinDays}–{shipping.estimatedMaxDays} dias úteis</strong>
                  </div>
                </div>
              )}

              {shipping.status === 'unavailable' && (
                <div className="error-box">Infelizmente ainda não entregamos nesse endereço.</div>
              )}
              {shipping.status === 'error' && (
                <div className="error-box">
                  Não foi possível calcular o frete.{' '}
                  <button type="button" onClick={calculateShipping} style={{ background: 'none', border: 'none', color: '#dc2626', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
                    Tentar novamente
                  </button>
                </div>
              )}

              <div className="checkout-nav spaced">
                <button onClick={() => setStep(1)} className="btn-secondary">Voltar</button>
                <button onClick={() => setStep(3)} className="btn-primary" disabled={shipping.status !== 'ready'}>Continuar</button>
              </div>
            </>
          )}

          {/* Passo 3 — Pagamento */}
          {step === 3 && (
            <>
              <p className="checkout-section-title">Forma de pagamento</p>
              <p className="checkout-section-sub">Escolha como prefere pagar.</p>

              <div className="payment-options">
                {PAYMENT_OPTIONS.map((opt) => (
                  <label key={opt.value} className="payment-option">
                    <input type="radio" name="payment" checked={paymentMethod === opt.value} onChange={() => setPaymentMethod(opt.value)} />
                    <div className="pay-name">{opt.name}</div>
                    <div className="pay-desc">{opt.desc}</div>
                  </label>
                ))}
              </div>

              <div className="checkout-nav spaced">
                <button onClick={() => setStep(2)} className="btn-secondary">Voltar</button>
                <button onClick={() => setStep(4)} className="btn-primary">Continuar</button>
              </div>
            </>
          )}

          {/* Passo 4 — Revisão */}
          {step === 4 && (
            <>
              <p className="checkout-section-title">Revise seu pedido</p>
              <p className="checkout-section-sub">Confira os itens antes de finalizar.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {items.map((it) => (
                  <div key={`${it.productId}:${it.size || ''}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                    <span>{it.qty}x {it.name}{it.size ? ` (tam. ${it.size})` : ''}</span>
                    <strong>{brl(it.unitPrice * it.qty)}</strong>
                  </div>
                ))}
              </div>

              <div className="checkout-summary">
                <p className="summary-label">Resumo</p>
                <div className="summary-row"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
                <div className="summary-row"><span>Frete</span><span>{brl(shippingCost)}</span></div>
                <div className="summary-row total"><span>Total</span><span>{brl(total)}</span></div>
              </div>

              {stepError && <div className="error-box">{stepError}</div>}

              <div className="checkout-nav spaced">
                <button onClick={() => setStep(3)} className="btn-secondary" disabled={submitting}>Voltar</button>
                <button onClick={handleSubmitOrder} className="btn-primary" disabled={submitting}>
                  {submitting ? 'Finalizando…' : 'Finalizar pedido'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}