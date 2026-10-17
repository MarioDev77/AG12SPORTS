/**
 * Constantes compartilhadas da vitrine AG12 Sports.
 * Um único lugar para número de WhatsApp, Instagram, marcas, pisos e ofertas.
 */

export const WPP_NUMBER = '557598756510';
export const wppLink = (msg) => `https://wa.me/${WPP_NUMBER}?text=${encodeURIComponent(msg)}`;

export const INSTAGRAM_URL = 'https://www.instagram.com/ag12sports';
export const INSTAGRAM_HANDLE = '@ag12sports';

/** "Chuteiras" é o grupo dos três pisos (a API aceita category=chuteiras). */
export const CHUTEIRA_CATS = ['society', 'futsal', 'campo'];

export const FLOORS = [
  { slug: 'society', label: 'Society' },
  { slug: 'futsal', label: 'Futsal' },
  { slug: 'campo', label: 'Campo' },
];

/** Numeração de chuteira vendida na loja. */
export const SIZES = Array.from({ length: 45 - 35 + 1 }, (_, i) => String(35 + i));

/**
 * Disponibilidade. "pronta" = em estoque, compra direto no site;
 * "encomenda" = sob consulta, atendimento pelo WhatsApp.
 */
export const FULFILLMENT = [
  { value: 'pronta', label: 'Pronta entrega', hint: 'Em estoque, você compra agora pelo site.' },
  { value: 'encomenda', label: 'Encomenda', hint: 'Não está no estoque? A gente traz. Confirme prazo e numeração pelo WhatsApp.' },
];

export const BRANDS = [
  { name: 'Nike', img: '/assets/img/marcas/nike.png' },
  { name: 'Adidas', img: '/assets/img/marcas/adidas.png' },
  { name: 'Puma', img: '/assets/img/marcas/puma.png' },
  { name: 'Mizuno', img: '/assets/img/marcas/mizuno.svg' },
];

/** Artes promocionais da loja (usadas nos carrosséis). w/h = proporção real do arquivo. */
export const OFFERS = [
  {
    src: '/assets/img/ofertas/oferta-camisas-times.jpeg', w: 1024, h: 1365,
    alt: 'Camisas de times: Palmeiras, Flamengo, Lakers e Arsenal',
    href: wppLink('Olá! Quero saber mais sobre as camisas de times.'), external: true,
  },
  {
    src: '/assets/img/ofertas/oferta-blusas-termicas.jpeg', w: 1507, h: 1044,
    alt: 'Blusas térmicas AG12 Sports',
    href: '/produtos?cat=blusas',
  },
  {
    src: '/assets/img/ofertas/oferta-shorts-dryfit.jpeg', w: 1085, h: 1340,
    alt: 'Shorts Dry Fit Premium',
    href: wppLink('Olá! Quero saber mais sobre os shorts Dry Fit Premium.'), external: true,
  },
  {
    src: '/assets/img/ofertas/oferta-necessaire.jpeg', w: 1024, h: 1536,
    alt: 'Necessaire premium AG12 Sports',
    href: '/produtos?cat=acessorios',
  },
];

/** Banners informativos (rastreio, redes sociais, cartão). */
export const INFO_BANNERS = [
  {
    src: '/assets/img/info/rastreio.webp', w: 503, h: 1024,
    alt: 'Onde está meu pedido? Pedido mais código de rastreio. Acompanhe a entrega.',
    href: '/conta',
  },
  {
    src: '/assets/img/info/redes-sociais.webp', w: 503, h: 1024,
    alt: 'Siga nossas redes sociais: novidades e promoções exclusivas no Instagram @ag12sports.',
    href: INSTAGRAM_URL, external: true,
  },
  {
    src: '/assets/img/info/cartao.webp', w: 504, h: 1024,
    alt: 'Pague pelo cartão: seguro e prático. Visa, Mastercard, Elo, American Express e Pix.',
    href: '/produtos?cat=chuteiras&tipo=pronta',
  },
];
