'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/app/admin/layout';
import { apiRequest } from '@/lib/api';

const BRAZIL_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const EMPTY_FORM = {
  name: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', active: true,
};

function maskCep(v) {
  const d = (v || '').replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

function OriginFormModal({ initial, onClose, onSaved }) {
  const { adminRequest } = useAdminAuth();
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial, complemento: initial?.complemento || '' });
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
        await adminRequest(`/origins/${initial.id}`, { method: 'PATCH', body: payload });
      } else {
        await adminRequest('/origins', { method: 'POST', body: payload });
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
            <p className="checkout-section-title" style={{ marginBottom: 0 }}>
              {isEdit ? `Editar depósito #${initial.id}` : 'Novo depósito'}
            </p>
            <button type="button" onClick={onClose} className="modal-close-btn" style={{ alignSelf: 'auto' }} aria-label="Fechar">
              <iconify-icon className="iconify" icon="mdi:close" style={{ fontSize: 16 }} />
            </button>
          </div>

          <div className="checkout-form-grid">
            <input
              className="field-input field-full"
              placeholder="Nome do depósito (ex: CD Feira de Santana)"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <input
              className="field-input"
              placeholder="CEP"
              value={form.cep}
              onChange={(e) => setForm((f) => ({ ...f, cep: maskCep(e.target.value) }))}
              onBlur={handleCepBlur}
              maxLength={9}
              required
            />
            <input
              className="field-input"
              placeholder="Número"
              value={form.numero}
              onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))}
              required
            />
            <input
              className="field-input field-full"
              placeholder="Rua/logradouro"
              value={form.logradouro}
              onChange={(e) => setForm((f) => ({ ...f, logradouro: e.target.value }))}
              required
            />
            <input
              className="field-input"
              placeholder="Complemento (opcional)"
              value={form.complemento}
              onChange={(e) => setForm((f) => ({ ...f, complemento: e.target.value }))}
            />
            <input
              className="field-input"
              placeholder="Bairro"
              value={form.bairro}
              onChange={(e) => setForm((f) => ({ ...f, bairro: e.target.value }))}
              required
            />
            <input
              className="field-input"
              placeholder="Cidade"
              value={form.cidade}
              onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))}
              required
            />
            <select
              className="field-input"
              value={form.uf}
              onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value }))}
              required
            >
              <option value="">UF</option>
              {BRAZIL_UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13.5 }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            Depósito ativo (disponível pra escolher nos pedidos)
          </label>

          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
            {cepStatus === 'loading' ? 'Consultando CEP…' : 'A localização (lat/lng) é calculada automaticamente a partir do endereço ao salvar.'}
          </p>

          {error && <p style={{ color: '#b91c1c', fontSize: 12.5, marginTop: 8 }}>{error}</p>}

          <button type="submit" disabled={saving} className="btn-primary" style={{ fontSize: 13, marginTop: 16 }}>
            {saving ? 'Salvando…' : 'Salvar depósito'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminOrigensPage() {
  const router = useRouter();
  const { adminRequest, isAuthenticated } = useAdminAuth();

  const [origins, setOrigins] = useState([]);
  const [status, setStatus] = useState('loading');
  const [modalOrigin, setModalOrigin] = useState(null); // null = fechado, {} = novo, {id,...} = editar
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) { router.push('/admin/login'); return; }
    load();
  }, [isAuthenticated]);

  async function load() {
    setStatus('loading');
    try {
      const data = await adminRequest('/origins');
      setOrigins(data.origins || []);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  async function handleDelete(origin) {
    if (!confirm(`Excluir o depósito "${origin.name}"? Essa ação não pode ser desfeita.`)) return;
    setDeleting(origin.id);
    try {
      await adminRequest(`/origins/${origin.id}`, { method: 'DELETE' });
      setOrigins((prev) => prev.filter((o) => o.id !== origin.id));
    } catch (err) {
      alert(err.message || 'Não foi possível excluir.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800 }}>Depósitos/Origens</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
            Endereços de onde os pedidos podem sair — escolha a origem de cada pedido na tela de Pedidos.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={load} className="btn-secondary" style={{ fontSize: 13 }}>
            <iconify-icon className="iconify" icon="mdi:refresh" style={{ fontSize: 16 }} />
            Atualizar
          </button>
          <button onClick={() => setModalOrigin({})} className="btn-primary" style={{ fontSize: 13 }}>
            <iconify-icon className="iconify" icon="mdi:plus" style={{ fontSize: 16 }} />
            Novo depósito
          </button>
        </div>
      </div>

      {status === 'loading' && <p style={{ color: 'var(--muted)' }}>Carregando…</p>}
      {status === 'error' && <p style={{ color: 'var(--muted)' }}>Erro ao carregar. Tente novamente.</p>}

      {status === 'ready' && (
        <div style={{ background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.2em', background: 'var(--bg)' }}>
                  {['#', 'Nome', 'Endereço', 'Cidade/UF', 'Localização', 'Status', 'Ações'].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!origins.length && (
                  <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Nenhum depósito cadastrado ainda.</td></tr>
                )}
                {origins.map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--border)', opacity: o.active ? 1 : 0.5 }}>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>{o.id}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{o.name}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>
                      {o.logradouro}, {o.numero} — {o.bairro}
                    </td>
                    <td style={{ padding: '12px 16px' }}>{o.cidade}/{o.uf}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {o.latitude && o.longitude ? (
                        <span style={{ color: '#0f766e', fontSize: 12.5 }}>
                          <iconify-icon className="iconify" icon="mdi:map-marker-check-outline" style={{ fontSize: 14, verticalAlign: 'middle' }} /> encontrada
                        </span>
                      ) : (
                        <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>
                          <iconify-icon className="iconify" icon="mdi:map-marker-alert-outline" style={{ fontSize: 14, verticalAlign: 'middle' }} /> não encontrada
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 12, background: o.active ? 'var(--green, #22c55e)' : 'var(--muted)', color: '#fff', fontWeight: 600 }}>
                        {o.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
                      <button onClick={() => setModalOrigin(o)} className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}>
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(o)}
                        disabled={deleting === o.id}
                        className="btn-secondary"
                        style={{ fontSize: 12, padding: '4px 10px', color: '#b91c1c' }}
                      >
                        {deleting === o.id ? 'Excluindo…' : 'Excluir'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOrigin && (
        <OriginFormModal
          initial={modalOrigin}
          onClose={() => setModalOrigin(null)}
          onSaved={() => { setModalOrigin(null); load(); }}
        />
      )}
    </div>
  );
}
