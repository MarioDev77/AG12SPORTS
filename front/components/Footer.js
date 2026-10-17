import Image from 'next/image';
import Link from 'next/link';
import { INSTAGRAM_HANDLE, INSTAGRAM_URL, WPP_NUMBER, wppLink } from '@/lib/store';

const SHOP_LINKS = [
  { label: 'Pronta entrega', href: '/produtos?cat=chuteiras&tipo=pronta' },
  { label: 'Encomenda', href: '/produtos?cat=chuteiras&tipo=encomenda' },
  { label: 'Society', href: '/produtos?cat=society' },
  { label: 'Futsal', href: '/produtos?cat=futsal' },
  { label: 'Campo', href: '/produtos?cat=campo' },
  { label: 'Acessórios', href: '/produtos?cat=acessorios' },
  { label: 'Blusas', href: '/produtos?cat=blusas' },
  { label: 'Kits de treino', href: '/produtos?cat=kits' },
];

const PAYMENTS = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Pix'];

// 557598756510 -> (75) 9875-6510
const phoneLabel = `(${WPP_NUMBER.slice(2, 4)}) ${WPP_NUMBER.slice(4, 8)}-${WPP_NUMBER.slice(8)}`;

export default function Footer() {
  return (
    <footer className="ag-footer">
      <div className="ag-wrap ag-footer-grid">
        <div className="ag-footer-brand">
          <Image src="/ag12-sports-logo.jpeg" alt="AG12 Sports" width={96} height={96} className="ag-footer-logo" />
          <p className="ag-footer-slogan">Você joga, a gente entende.</p>
          <p className="ag-footer-note">Chuteiras Society, Futsal e Campo, acessórios e blusas.</p>
        </div>

        <nav aria-label="Comprar">
          <h2 className="ag-footer-title">Comprar</h2>
          <ul>
            {SHOP_LINKS.map((l) => (
              <li key={l.label}><Link href={l.href}>{l.label}</Link></li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Atendimento">
          <h2 className="ag-footer-title">Atendimento</h2>
          <ul>
            <li>
              <a href={wppLink('Olá! Vim pelo site da AG12 Sports.')} target="_blank" rel="noopener">
                WhatsApp {phoneLabel}
              </a>
            </li>
            <li><a href={INSTAGRAM_URL} target="_blank" rel="noopener">Instagram {INSTAGRAM_HANDLE}</a></li>
            <li><Link href="/conta">Acompanhar pedido</Link></li>
            <li><Link href="/conta">Minha conta</Link></li>
          </ul>
        </nav>

        <div>
          <h2 className="ag-footer-title">Pagamento</h2>
          <ul className="ag-pay" aria-label="Formas de pagamento aceitas">
            {PAYMENTS.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <p className="ag-footer-note">Seus dados ficam protegidos durante toda a compra.</p>
        </div>
      </div>

      <div className="ag-wrap ag-footer-bottom">
        <p>© 2026 AG12 Sports. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}
