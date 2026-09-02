'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/app/admin/layout';
import { brl } from '@/lib/format';

const BRAZIL_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const EMPTY_REGION = { uf: '', cidade: '', cep_prefix: '', delivery_min_days: 2, delivery_max_days: 5, shipping_cost: 15, active: true };

// ─── Seção 1: regras de frete (UF / cidade / CEP) ───────────────────────────
function RegionsSection() {
  const { adminRequest } = useAdminAuth();
  const [regions, setRegions] = useState([]);
  const [status, setStatus] = useState('loading');
  const [form, setForm] = useState(EMPTY_REGION);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setStatus('loading');
    try {
      const data = await adminRequest('/shipping-regions');
      setRegions(data);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  useEffect(() => { load(); }, []);

  function startEdit(r) {
    setEditingId(r.id);
    setForm({
      uf: r.uf, cidade: r.cidade || '', cep_prefix: r.cep_prefix || '',
      delivery_min_days: r.delivery_min_days, delivery_max_days: r.delivery_max_days,
      shipping_cost: r.shipping_cost, active: !!r.active,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_REGION);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, cidade: form.cidade || null, cep_prefix: form.cep_prefix || null };
      if (editingId) {
        await adminRequest(`/shipping-regions/${editingId}`, { method: 'PATCH', body: payload });
      } else {
        await adminRequest('/shipping-regions', { method: 'POST', body: payload });
      }
      cancelEdit();
      load();
    } catch (err) {
      setError(err.message || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(r) {
    if (!confirm(`Excluir a regra de ${r.uf}${r.cidade ? ` / ${r.cidade}` : ''}${r.cep_prefix ? ` / CEP ${r.cep_prefix}` : ''}?`)) return;
    try {
      await adminRequest(`/shipping-regions/${r.id}`, { method: 'DELETE' });
      setRegions((prev) => prev.filter((x) => x.id !== r.id));
    } catch (err) {
      alert(err.message || 'Não foi possível excluir.');
    }
  }

  function specificity(r) {
    if (r.cep_prefix) return 'CEP';
    if (r.cidade) return 'Cidade';
    if (r.uf === '*') return 'Padrão';
    return 'UF';
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--border)', padding: 24, marginBottom: 24 }}>
      <p className="checkout-section-title" style={{ marginBottom: 4 }}>Regras de frete</p>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        Prioridade na hora de calcular: CEP mais específico primeiro, depois cidade, depois UF, depois a regra padrão (<code>*</code>).
      </p>

      <form onSubmit={handleSubmit} className="checkout-form-grid" style={{ marginBottom: 16 }}>
        <select className="field-input" value={form.uf} onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value }))} required>
          <option value="">UF</option>
          <option value="*">* (padrão/fallback)</option>
          {BRAZIL_UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
        </select>
        <input className="field-input" placeholder="Cidade (opcional)" value={form.cidade} onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))} />
        <input className="field-input" placeholder="CEP, 5 dígitos (opcional, ex: 44700)" maxLength={5} value={form.cep_prefix} onChange={(e) => setForm((f) => ({ ...f, cep_prefix: e.target.value.replace(/\D/g, '') }))} />
        <input className="field-input" type="number" min={0} placeholder="Prazo mín. (dias)" value={form.delivery_min_days} onChange={(e) => setForm((f) => ({ ...f, delivery_min_days: e.target.value }))} required />
        <input className="field-input" type="number" min={0} placeholder="Prazo máx. (dias)" value={form.delivery_max_days} onChange={(e) => setForm((f) => ({ ...f, delivery_max_days: e.target.value }))} required />
        <input className="field-input" type="number" min={0} step="0.01" placeholder="Custo do frete (R$)" value={form.shipping_cost} onChange={(e) => setForm((f) => ({ ...f, shipping_cost: e.target.value }))} required />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
          <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
          Ativa
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={saving} className="btn-primary" style={{ fontSize: 13 }}>
            {saving ? 'Salvando…' : editingId ? 'Salvar edição' : 'Adicionar regra'}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="btn-secondary" style={{ fontSize: 13 }}>Cancelar</button>
          )}
        </div>
      </form>
      {error && <p style={{ color: '#b91c1c', fontSize: 12.5, marginBottom: 12 }}>{error}</p>}

      {status === 'loading' && <p style={{ color: 'var(--muted)' }}>Carregando…</p>}
      {status === 'error' && <p style={{ color: 'var(--muted)' }}>Erro ao carregar.</p>}
      {status === 'ready' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                {['Tipo', 'UF', 'Cidade', 'CEP', 'Prazo', 'Custo', 'Status', ''].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!regions.length && <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>Nenhuma regra cadastrada.</td></tr>}
              {regions.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', opacity: r.active ? 1 : 0.5 }}>
                  <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{specificity(r)}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.uf}</td>
                  <td style={{ padding: '10px 12px' }}>{r.cidade || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{r.cep_prefix || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{r.delivery_min_days}–{r.delivery_max_days}d</td>
                  <td style={{ padding: '10px 12px' }}>{brl(r.shipping_cost)}</td>
                  <td style={{ padding: '10px 12px' }}>{r.active ? 'Ativa' : 'Inativa'}</td>
                  <td style={{ padding: '10px 12px', display: 'flex', gap: 6 }}>
                    <button onClick={() => startEdit(r)} className="btn-secondary" style={{ fontSize: 12, padding: '3px 8px' }}>Editar</button>
                    <button onClick={() => handleDelete(r)} className="btn-secondary" style={{ fontSize: 12, padding: '3px 8px', color: '#b91c1c' }}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Seção 2: configurações do motor (preparo, margem, distância) ──────────
function SettingsSection() {
  const { adminRequest } = useAdminAuth();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    adminRequest('/shipping-settings').then((data) => {
      const s = data.settings || {};
      setForm({
        prepTimeDays: s.prep_time_days ?? 1,
        marginDays: s.margin_days ?? 1,
        distanceBaseFee: s.distance_base_fee ?? 12,
        distanceCostPerKm: s.distance_cost_per_km ?? 0.03,
        distanceDaysPer500Km: s.distance_days_per_500km ?? 1,
      });
    }).catch(() => setForm({ prepTimeDays: 1, marginDays: 1, distanceBaseFee: 12, distanceCostPerKm: 0.03, distanceDaysPer500Km: 1 }));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await adminRequest('/shipping-settings', { method: 'PATCH', body: form });
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  if (!form) return null;

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--border)', padding: 24, marginBottom: 24 }}>
      <p className="checkout-section-title" style={{ marginBottom: 4 }}>Configurações do motor de frete</p>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        O ajuste por distância só entra em ação quando o depósito padrão (em Depósitos) e o cliente têm localização — senão o cálculo usa só as regras acima.
      </p>
      <form onSubmit={handleSubmit} className="checkout-form-grid">
        <label style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          Tempo de preparação (dias úteis)
          <input className="field-input" type="number" min={0} max={30} value={form.prepTimeDays} onChange={(e) => setForm((f) => ({ ...f, prepTimeDays: e.target.value }))} />
        </label>
        <label style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          Margem de segurança (dias úteis)
          <input className="field-input" type="number" min={0} max={30} value={form.marginDays} onChange={(e) => setForm((f) => ({ ...f, marginDays: e.target.value }))} />
        </label>
        <label style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          Taxa base por distância (R$)
          <input className="field-input" type="number" min={0} step="0.01" value={form.distanceBaseFee} onChange={(e) => setForm((f) => ({ ...f, distanceBaseFee: e.target.value }))} />
        </label>
        <label style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          Custo por km (R$)
          <input className="field-input" type="number" min={0} step="0.0001" value={form.distanceCostPerKm} onChange={(e) => setForm((f) => ({ ...f, distanceCostPerKm: e.target.value }))} />
        </label>
        <label style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          Dias extra a cada 500km
          <input className="field-input" type="number" min={1} max={30} value={form.distanceDaysPer500Km} onChange={(e) => setForm((f) => ({ ...f, distanceDaysPer500Km: e.target.value }))} />
        </label>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button type="submit" disabled={saving} className="btn-primary" style={{ fontSize: 13 }}>{saving ? 'Salvando…' : 'Salvar configurações'}</button>
        </div>
      </form>
      {error && <p style={{ color: '#b91c1c', fontSize: 12.5, marginTop: 10 }}>{error}</p>}
      {saved && !error && <p style={{ color: '#15803d', fontSize: 12.5, marginTop: 10 }}>Salvo.</p>}
    </div>
  );
}

// ─── Seção 3: feriados ───────────────────────────────────────────────────────
function HolidaysSection() {
  const { adminRequest } = useAdminAuth();
  const [holidays, setHolidays] = useState([]);
  const [status, setStatus] = useState('loading');
  const [form, setForm] = useState({ date: '', name: '', scope: 'nacional', uf: '', cidade: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setStatus('loading');
    try {
      const data = await adminRequest('/holidays');
      setHolidays(data.holidays || []);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await adminRequest('/holidays', {
        method: 'POST',
        body: {
          date: form.date,
          name: form.name,
          uf: form.scope !== 'nacional' ? form.uf : null,
          cidade: form.scope === 'municipal' ? form.cidade : null,
        },
      });
      setForm({ date: '', name: '', scope: 'nacional', uf: '', cidade: '' });
      load();
    } catch (err) {
      setError(err.message || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(h) {
    if (!confirm(`Excluir o feriado "${h.name}"?`)) return;
    try {
      await adminRequest(`/holidays/${h.id}`, { method: 'DELETE' });
      setHolidays((prev) => prev.filter((x) => x.id !== h.id));
    } catch (err) {
      alert(err.message || 'Não foi possível excluir.');
    }
  }

  function scopeLabel(h) {
    if (h.cidade) return `Municipal — ${h.cidade}/${h.uf}`;
    if (h.uf) return `Estadual — ${h.uf}`;
    return 'Nacional';
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--border)', padding: 24 }}>
      <p className="checkout-section-title" style={{ marginBottom: 4 }}>Feriados</p>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        Usados no cálculo de dias úteis. Os feriados nacionais de data fixa de 2026 já vêm cadastrados — inclua aqui os móveis (Carnaval, Sexta-feira Santa, Corpus Christi) e os estaduais/municipais.
      </p>

      <form onSubmit={handleSubmit} className="checkout-form-grid" style={{ marginBottom: 16 }}>
        <input className="field-input" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required />
        <input className="field-input field-full" placeholder="Nome do feriado" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        <select className="field-input" value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}>
          <option value="nacional">Nacional</option>
          <option value="estadual">Estadual</option>
          <option value="municipal">Municipal</option>
        </select>
        {form.scope !== 'nacional' && (
          <select className="field-input" value={form.uf} onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value }))} required>
            <option value="">UF</option>
            {BRAZIL_UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        )}
        {form.scope === 'municipal' && (
          <input className="field-input" placeholder="Cidade" value={form.cidade} onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))} required />
        )}
        <button type="submit" disabled={saving} className="btn-primary" style={{ fontSize: 13 }}>{saving ? 'Salvando…' : 'Adicionar feriado'}</button>
      </form>
      {error && <p style={{ color: '#b91c1c', fontSize: 12.5, marginBottom: 12 }}>{error}</p>}

      {status === 'loading' && <p style={{ color: 'var(--muted)' }}>Carregando…</p>}
      {status === 'ready' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                {['Data', 'Nome', 'Abrangência', ''].map((h) => <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 500 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {!holidays.length && <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>Nenhum feriado cadastrado.</td></tr>}
              {holidays.map((h) => (
                <tr key={h.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px' }}>{new Date(h.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{h.name}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{scopeLabel(h)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <button onClick={() => handleDelete(h)} className="btn-secondary" style={{ fontSize: 12, padding: '3px 8px', color: '#b91c1c' }}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminFretePage() {
  const router = useRouter();
  const { isAuthenticated } = useAdminAuth();

  useEffect(() => {
    if (!isAuthenticated) router.push('/admin/login');
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800 }}>Frete e logística</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
          Regras de prazo/custo, configurações do motor de estimativa e feriados.
        </p>
      </div>

      <RegionsSection />
      <SettingsSection />
      <HolidaysSection />
    </div>
  );
}
