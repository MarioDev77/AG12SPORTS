'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import WishPanel from '@/components/WishPanel';
import CartPanel from '@/components/CartPanel';
import { useToast } from '@/context/ToastContext';

/**
 * Layout da loja (route group "(loja)") — réplica da estrutura comum a
 * todas as páginas do front vanilla: navbar fixa, painel de favoritos e
 * footer. Não afeta a URL (route group).
 */
export default function StoreLayout({ children }) {
  const [wishOpen, setWishOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const showToast = useToast();

  return (
    <>
      <Navbar onOpenWish={() => setWishOpen(true)} onOpenCart={() => setCartOpen(true)} />

      {children}

      <footer>
        <p style={{ marginBottom: 6 }}>
          <strong style={{ color: 'rgba(255,255,255,0.75)', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px' }}>
            AG12 SPORTS
          </strong>
          <span style={{ margin: '0 8px', opacity: 0.3 }}>·</span>
          Chuteiras Society, Futsal e Campo · Acessórios e Blusas
        </p>
        <p>© 2026 AG12 Sports. Todos os direitos reservados.</p>
      </footer>

      <WishPanel open={wishOpen} onClose={() => setWishOpen(false)} onToast={showToast} />
      <CartPanel open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
