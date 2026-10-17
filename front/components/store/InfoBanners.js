import Image from 'next/image';
import Link from 'next/link';
import { INFO_BANNERS } from '@/lib/store';

/**
 * Faixa do meio da home: rastreio do pedido, redes sociais e pagamento no
 * cartão (as três artes da loja). No celular vira uma fila de arrastar.
 */
export default function InfoBanners() {
  return (
    <section className="ag-info" aria-labelledby="infoTitle">
      <div className="ag-wrap ag-info-grid">
        <div className="ag-info-intro">
          <h2 id="infoTitle" className="ag-h2">Do pedido à entrega, você acompanha.</h2>
          <p className="ag-sub">
            Veja o rastreio, pague com segurança e fique por dentro das novidades no Instagram.
          </p>
        </div>

        <ul className="ag-info-cards">
          {INFO_BANNERS.map((b) => {
            const img = <Image src={b.src} alt={b.alt} width={b.w} height={b.h} sizes="(max-width: 700px) 72vw, 300px" />;
            return (
              <li key={b.src}>
                {b.external ? (
                  <a href={b.href} target="_blank" rel="noopener" className="ag-info-card">{img}</a>
                ) : (
                  <Link href={b.href} className="ag-info-card">{img}</Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
