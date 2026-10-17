'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WishPanel from '@/components/WishPanel';
import CartPanel from '@/components/CartPanel';
import { useToast } from '@/context/ToastContext';
import { wppLink } from '@/lib/store';

/**
 * Layout da loja (route group "(loja)"): navbar fixa, conteúdo, footer,
 * painéis de favoritos/carrinho e botão flutuante de WhatsApp.
 * Não afeta a URL (route group).
 */
export default function StoreLayout({ children }) {
  const [wishOpen, setWishOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const showToast = useToast();

  return (
    <>
      <a href="#conteudo" className="ag-skip">Pular para o conteúdo</a>
      <Navbar onOpenWish={() => setWishOpen(true)} onOpenCart={() => setCartOpen(true)} />

      <main id="conteudo" className="ag-main">
        {children}
      </main>

      <Footer />

      <a
        className="ag-wpp-fab"
        href={wppLink('Olá! Vim pelo site da AG12 Sports.')}
        target="_blank"
        rel="noopener"
        aria-label="Falar com a AG12 Sports no WhatsApp"
      >
        <iconify-icon className="iconify" icon="mdi:whatsapp" style={{ fontSize: 30 }} />
      </a>

      <WishPanel open={wishOpen} onClose={() => setWishOpen(false)} onToast={showToast} />
      <CartPanel open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
