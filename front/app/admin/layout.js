'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

// ——— Contexto de autenticação admin ———
const AdminAuthContext = createContext(null);

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth deve ser usado dentro de AdminLayout');
  return ctx;
}

const ADMIN_PREFIX = '/manage';
const UNSEEN_POLL_MS = 20000;

const NAV_ITEMS = [
  { href: '/admin',          icon: 'mdi:view-dashboard-outline', label: 'Dashboard' },
  { href: '/admin/produtos', icon: 'mdi:package-variant-outline', label: 'Produtos' },
  { href: '/admin/pedidos',  icon: 'mdi:receipt-text-outline',   label: 'Pedidos' },
  { href: '/admin/origens',  icon: 'mdi:warehouse',              label: 'Depósitos' },
  { href: '/admin/frete',    icon: 'mdi:truck-fast-outline',     label: 'Frete' },
  { href: '/admin/usuarios', icon: 'mdi:account-group-outline',  label: 'Usuários' },
];

function NotificationBell({ count, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={count > 0 ? `${count} pedido(s) novo(s)` : 'Notificações de pedidos'}
      title="Pedidos novos"
      style={{
        position: 'relative', width: 38, height: 38,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
        cursor: 'pointer', color: count > 0 ? 'var(--amber)' : 'var(--muted)',
        transition: 'background 0.2s, color 0.2s',
      }}
    >
      <iconify-icon
        className="iconify"
        icon={count > 0 ? 'mdi:bell-ring-outline' : 'mdi:bell-outline'}
        style={{ fontSize: 20, animation: count > 0 ? 'bell-shake 1.8s ease-in-out infinite' : 'none' }}
      />
      {count > 0 && (
        <span style={{
          position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, padding: '0 4px',
          borderRadius: 9, background: '#dc2626', color: '#fff', fontSize: 10.5, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        }}>
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}

export default function AdminLayout({ children }) {
  const router   = useRouter();
  const pathname = usePathname();

  const [token, setToken] = useState(null);
  const [user,  setUser]  = useState(null);
  const [unseenCount, setUnseenCount] = useState(0);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    router.push('/admin/login');
  }, [router]);

  const adminRequest = useCallback(
    (path, options = {}) => apiRequest(`${ADMIN_PREFIX}${path}`, { ...options, token }),
    [token]
  );

  const refreshUnseenCount = useCallback(() => {
    if (!token) return;
    apiRequest(`${ADMIN_PREFIX}/orders/unseen-count`, { token })
      .then((data) => setUnseenCount(data.count || 0))
      .catch(() => {});
  }, [token]);

  // Sininho: consulta pedidos não vistos ao logar e depois a cada 20s.
  useEffect(() => {
    if (!token) return;
    refreshUnseenCount();
    const interval = setInterval(refreshUnseenCount, UNSEEN_POLL_MS);
    return () => clearInterval(interval);
  }, [token, refreshUnseenCount]);

  const value = { token, setToken, user, setUser, logout, adminRequest, isAuthenticated: !!token, unseenCount, refreshUnseenCount };

  const isLoginPage = pathname === '/admin/login';

  if (isLoginPage) {
    return (
      <AdminAuthContext.Provider value={value}>
        {children}
      </AdminAuthContext.Provider>
    );
  }

  if (!token) {
    // Redireciona para login se não autenticado
    if (typeof window !== 'undefined') router.push('/admin/login');
    return null;
  }

  return (
    <AdminAuthContext.Provider value={value}>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
        {/* Sidebar */}
        <aside style={{
          width: 220,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          padding: '32px 0',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}>
          <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/ag12-sports-logo.jpeg" alt="AG12 Sports" className="nav-logo-mark" style={{ width: 32, height: 32 }} />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.5px' }}>AG12 SPORTS</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.2em' }}>Admin</p>
          </div>

          <nav style={{ flex: 1, padding: '0 12px' }}>
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
              const showBadge = item.href === '/admin/pedidos' && unseenCount > 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    marginBottom: 4,
                    fontSize: 14,
                    fontWeight: active ? 600 : 400,
                    color: active ? 'var(--amber)' : 'var(--text)',
                    background: active ? 'rgba(var(--amber-rgb,214,163,48),0.1)' : 'transparent',
                    textDecoration: 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ position: 'relative', display: 'inline-flex' }}>
                    <iconify-icon className="iconify" icon={item.icon} style={{ fontSize: 18 }} />
                    {showBadge && (
                      <span style={{
                        position: 'absolute', top: -5, right: -6, minWidth: 14, height: 14, padding: '0 3px',
                        borderRadius: 7, background: '#dc2626', color: '#fff', fontSize: 9, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                      }}>
                        {unseenCount > 9 ? '9+' : unseenCount}
                      </span>
                    )}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
            {user && (
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.username || user.email}
              </p>
            )}
            <button onClick={logout} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}>
              Sair
            </button>
          </div>
        </aside>

        {/* Conteúdo */}
        <main style={{ flex: 1, padding: '40px 32px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
            <NotificationBell count={unseenCount} onClick={() => router.push('/admin/pedidos')} />
          </div>
          {children}
        </main>
      </div>

      <style>{`
        @keyframes bell-shake {
          0%, 90%, 100% { transform: rotate(0deg); }
          92% { transform: rotate(-12deg); }
          94% { transform: rotate(10deg); }
          96% { transform: rotate(-6deg); }
          98% { transform: rotate(4deg); }
        }
      `}</style>
    </AdminAuthContext.Provider>
  );
}

