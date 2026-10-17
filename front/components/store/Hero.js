import Image from 'next/image';
import Link from 'next/link';

/** Pronta entrega: mesmo destino do item "Pronta entrega" da Navbar. */
const CHUTEIRAS_HREF = '/produtos?cat=chuteiras&tipo=pronta';

/**
 * Não existe categoria/rota de "novidades" no projeto. O catálogo já abre
 * ordenado por "Mais recentes" (sort padrão de /produtos), então esse é o
 * destino válido hoje. Se a loja criar uma categoria própria, troque aqui.
 */
const NOVIDADES_HREF = '/produtos';

const TRUST = [
  { icon: 'mdi:truck-fast-outline', title: 'Pronta entrega', text: 'Entrega rápida' },
  { icon: 'mdi:shield-check-outline', title: 'Compra segura', text: 'Seus dados protegidos' },
  { icon: 'mdi:whatsapp', title: 'Atendimento', text: 'Pelo WhatsApp' },
];

/**
 * Hero da home: vitrine de marca + produto, sem formulário nem filtros.
 * Texto à esquerda; a foto real da chuteira à direita, esmaecida no fundo
 * escuro (sem moldura). No celular vira uma coluna: texto, depois a foto.
 */
export default function Hero() {
  return (
    <section className="ag-hero" aria-labelledby="heroTitle">
      <div className="ag-wrap ag-hero-inner">
        <div className="ag-hero-copy">
          <p className="ag-hero-kicker">Mizuno Morelia Neo</p>
          <h1 id="heroTitle" className="ag-hero-title">
            <span>Tradição japonesa.</span>
            <span className="is-gold">Performance real.</span>
          </h1>
          <p className="ag-hero-lead">
            A Mizuno entrega o equilíbrio perfeito entre leveza, conforto e precisão em campo.
          </p>
          <div className="ag-hero-actions">
            <Link href={CHUTEIRAS_HREF} className="ag-btn ag-btn-gold ag-hero-cta">
              Ver chuteiras <span aria-hidden="true">→</span>
            </Link>
            <Link href={NOVIDADES_HREF} className="ag-btn ag-hero-ghost">
              Ver novidades
            </Link>
          </div>
        </div>

        <ul className="ag-hero-trust" aria-label="Diferenciais da loja">
          {TRUST.map((t) => (
            <li key={t.title}>
              <iconify-icon className="iconify" icon={t.icon} aria-hidden="true" />
              <span><strong>{t.title}</strong><small>{t.text}</small></span>
            </li>
          ))}
        </ul>
      </div>

      <figure className="ag-hero-media">
        <Image
          src="/assets/img/hero-mizuno.webp"
          alt="Par de chuteiras Mizuno Morelia Neo pretas com detalhes vermelhos sobre o gramado"
          fill
          priority
          sizes="(max-width: 900px) 100vw, 46vw"
        />
      </figure>
    </section>
  );
}
