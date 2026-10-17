import Script from "next/script";
import Providers from "@/context/Providers";
import "./globals.css";
import "./ag12-theme.css";

export const metadata = {
  title: "AG12 Sports — Chuteiras & Moda",
  description: "Loja especializada em chuteiras Society, Futsal e Campo.",
};

// Zoom do navegador liberado (acessibilidade). O zoom das fotos nos
// lightboxes continua sendo feito em JS, com touch-action próprio.
export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,600;1,700;1,800&family=Barlow:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <Script src="https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js" strategy="beforeInteractive" />
        <div id="toastContainer" aria-live="polite" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
