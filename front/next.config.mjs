/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
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
