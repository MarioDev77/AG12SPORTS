/**
 * next.config.mjs — headers de segurança (Vercel/Next) + imagens.
 *
 * CSP: montada a partir do que o site realmente usa:
 *  - scripts: próprio domínio + iconify-icon (code.iconify.design)
 *  - ícones: iconify busca os SVGs em api.iconify.design / simplesvg / unisvg
 *  - estilos/fontes: Google Fonts
 *  - API + imagens: origem de NEXT_PUBLIC_API_BASE (backend)
 * 'unsafe-inline' em script/style é exigido hoje pelo Next (scripts de
 * hidratação) e pelos style={{}} do projeto; o ganho real da CSP aqui é
 * bloquear scripts/conexões/frames de origens não listadas.
 *
 * ROLLOUT SEGURO: por padrão a CSP sai como *Report-Only* (só avisa no
 * console do navegador, não bloqueia nada). Depois de navegar por loja,
 * checkout, conta e admin sem avisos, defina CSP_ENFORCE=true na Vercel
 * e faça um novo deploy para passar a bloquear de verdade.
 */
const isProd = process.env.NODE_ENV === 'production';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://lojavirtual-production-2708.up.railway.app/api';
let apiOrigin = '';
try { apiOrigin = new URL(API_BASE).origin; } catch { /* mantém vazio */ }

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://code.iconify.design${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  `img-src 'self' data: blob: ${apiOrigin}`.trim(),
  `connect-src 'self' ${apiOrigin} https://api.iconify.design https://api.simplesvg.com https://api.unisvg.com`.replace(/\s+/g, ' '),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd ? ['upgrade-insecure-requests'] : []),
].join('; ');

const cspHeader =
  process.env.CSP_ENFORCE === 'true' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: cspHeader, value: csp },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        // geolocation=(self): o checkout usa navigator.geolocation para refinar o frete.
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()' },
      ],
    }];
  },
  images: {
    remotePatterns: [
      // Backend em produção (Railway) — serve /uploads e /seed-images
      {
        protocol: 'https',
        hostname: 'lojavirtual-production-2708.up.railway.app',
      },
      // Backend local em desenvolvimento
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
      },
    ],
  },
};

export default nextConfig;
