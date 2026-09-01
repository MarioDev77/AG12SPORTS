'use client';

import { AuthProvider } from '@/context/AuthContext';
import { WishProvider } from '@/context/WishContext';
import { CartProvider } from '@/context/CartContext';
import { ToastProvider } from '@/context/ToastContext';

/**
 * Providers — agrupa todo o estado global client-side em um só lugar.
 * Mantido separado de app/layout.js porque layout.js é Server Component
 * por padrão no App Router, e os contexts (useState/useContext) exigem
 * 'use client'.
 *
 * CartProvider entra por último (mais interno) — não depende de auth/wish,
 * mas fica perto de quem consome (Navbar, CartPanel, checkout).
 */
export default function Providers({ children }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <WishProvider>
          <CartProvider>{children}</CartProvider>
        </WishProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
