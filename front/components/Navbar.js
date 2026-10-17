'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useWish } from '@/context/WishContext';
import { useCart } from '@/context/CartContext';
import { BRANDS } from '@/lib/store';

/**
 * Grupos do menu de categorias. A ordem importa: primeiro como o cliente
 * quer comprar (pronta entrega / encomenda), depois o piso, depois a marca.
 */
const NAV_GROUPS = [
  {
    label: 'Chuteiras',
    items: [
      { label: 'Pronta entrega', href: '/produtos?cat=chuteiras&tipo=pronta', highlight: true },
      { label: 'Encomenda', href: '/produtos?cat=chuteiras&tipo=encomenda', highlight: true },
      { label: 'Society', href: '/produtos?cat=society' },
      { label: 'Futsal', href: '/produtos?cat=futsal' },
      { label: 'Campo', href: '/produtos?cat=campo' },
    ],
  },
  {
    label: 'Marcas',
    items: BRANDS.map((b) => ({ label: b.name, href: `/produtos?brand=${encodeURIComponent(b.name)}` })),
  },
  {
    label: 'Mais',
    items: [
      { label: 'Acessórios', href: '/produtos?cat=acessorios' },
      { label: 'Blusas', href: '/produtos?cat=blusas' },
      { label: 'Kits de treino', href: '/produtos?cat=kits' },
    ],
  },
];

/**
 * Navbar em duas linhas: marca, busca e ações em cima; categorias embaixo
 * (no celular, a segunda linha vira uma fita de arrastar). Fundo sempre
 * sólido — sem troca por scroll — para o conteúdo nunca ficar sob texto
 * ilegível.
 */
export default function Navbar({ onOpenWish, onOpenCart }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navSearch, setNavSearch] = useState('');
  const { count: wishCount } = useWish();
  const { count: cartCount } = useCart();
  const router = useRouter();

  // Esc fecha o menu lateral.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  function handleNavSearchSubmit(e) {
    e.preventDefault();
    const term = navSearch.trim();
    router.push(term ? `/produtos?q=${encodeURIComponent(term)}` : '/produtos');
  }

  return (
    <>
      <header className="ag-nav">
        <div className="ag-wrap ag-nav-top">
          <Link href="/" className="ag-logo" aria-label="AG12 Sports, página inicial">
            <Image src="/ag12-sports-logo.jpeg" alt="" width={44} height={44} className="ag-logo-mark" priority />
            <span className="ag-logo-word">AG<b>12</b><small>SPORTS</small></span>
          </Link>

          <form className="ag-search" role="search" onSubmit={handleNavSearchSubmit}>
            <iconify-icon className="iconify ag-search-icon" icon="mdi:magnify" aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar chuteira, marca ou modelo"
              aria-label="Buscar produto"
              autoComplete="off"
              spellCheck="false"
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
            />
          </form>

          <div className="ag-nav-actions">
            <button type="button" className="ag-icon-btn ag-hide-sm" onClick={onOpenWish} aria-label={`Favoritos${wishCount ? `, ${wishCount} itens` : ''}`}>
              <iconify-icon className="iconify" icon="mdi:heart-outline" style={{ fontSize: 22 }} />
              {wishCount > 0 && <span className="ag-badge">{wishCount}</span>}
            </button>
            <Link href="/conta" className="ag-icon-btn ag-hide-sm" aria-label="Minha conta e pedidos">
              <iconify-icon className="iconify" icon="mdi:account-outline" style={{ fontSize: 22 }} />
            </Link>
            <button type="button" className="ag-icon-btn" onClick={onOpenCart} aria-label={`Carrinho${cartCount ? `, ${cartCount} itens` : ''}`}>
              <iconify-icon className="iconify" icon="mdi:cart-outline" style={{ fontSize: 22 }} />
              {cartCount > 0 && <span className="ag-badge">{cartCount}</span>}
            </button>
            <button
              type="button"
              className="ag-icon-btn ag-show-sm"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
              aria-expanded={mobileOpen}
              aria-controls="mobileMenu"
            >
              <iconify-icon className="iconify" icon="mdi:menu" style={{ fontSize: 24 }} />
            </button>
          </div>
        </div>

        <nav className="ag-subnav" aria-label="Categorias">
          <ul className="ag-wrap ag-subnav-list">
            {NAV_GROUPS.map((g, gi) => (
              <li key={g.label} className="ag-subnav-group" role="presentation">
                {gi > 0 && <span className="ag-subnav-sep" aria-hidden="true" />}
                <ul aria-label={g.label}>
                  {g.items.map((it) => (
                    <li key={it.label}>
                      <Link href={it.href} className={`ag-subnav-link${it.highlight ? ' is-key' : ''}`}>{it.label}</Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div id="mobileMenu" className={mobileOpen ? 'open' : ''} role="dialog" aria-label="Menu de navegação" aria-modal="true" aria-hidden={!mobileOpen}>
        <div className="mobile-backdrop" onClick={() => setMobileOpen(false)} />
        <div id="mobileMenuPanel">
          <div className="mobile-header">
            <span className="mobile-title">Menu</span>
            <button type="button" className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Fechar menu">
              <iconify-icon className="iconify" icon="mdi:close" style={{ fontSize: 20 }} />
            </button>
          </div>

          {NAV_GROUPS.map((g) => (
            <div key={g.label} className="mobile-group">
              <p className="mobile-group-title">{g.label}</p>
              {g.items.map((it) => (
                <Link key={it.label} href={it.href} className="mobile-link" tabIndex={mobileOpen ? 0 : -1} onClick={() => setMobileOpen(false)}>
                  {it.label}
                </Link>
              ))}
            </div>
          ))}

          <div className="mobile-group">
            <p className="mobile-group-title">Minha área</p>
            <button type="button" className="mobile-link" tabIndex={mobileOpen ? 0 : -1} onClick={() => { setMobileOpen(false); onOpenWish(); }}>
              Favoritos{wishCount > 0 ? ` (${wishCount})` : ''}
            </button>
            <Link href="/conta" className="mobile-link" tabIndex={mobileOpen ? 0 : -1} onClick={() => setMobileOpen(false)}>
              Minha conta e pedidos
            </Link>
            <Link href="/produtos" className="mobile-link accent" tabIndex={mobileOpen ? 0 : -1} onClick={() => setMobileOpen(false)}>
              Ver todos os produtos
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
