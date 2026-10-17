import Image from 'next/image';
import Link from 'next/link';
import { INSTAGRAM_HANDLE, INSTAGRAM_URL, wppLink } from '@/lib/store';

/** Fecho da home: o slogan da marca + atendimento direto pelo WhatsApp. */
export default function HelpBlock() {
  return (
    <section className="ag-help" aria-labelledby="helpTitle">
      <div className="ag-wrap ag-help-grid">
        <Image
          className="ag-help-logo"
          src="/ag12-sports-logo.jpeg"
          alt="AG12 Sports"
          width={220}
          height={220}
        />
        <div className="ag-help-copy">
          <h2 id="helpTitle" className="ag-help-title">Você joga, a gente entende.</h2>
          <p>
            Em dúvida entre Society e Futsal, sem saber o seu número ou procurando um modelo que não
            está no site? Conte como você joga e a gente indica a chuteira.
          </p>
          <div className="ag-help-actions">
            <a
              href={wppLink('Olá! Quero ajuda para escolher minha chuteira.')}
              target="_blank"
              rel="noopener"
              className="ag-btn ag-btn-gold"
            >
              <iconify-icon className="iconify" icon="mdi:whatsapp" style={{ fontSize: 20 }} />
              Chamar no WhatsApp
            </a>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener" className="ag-btn ag-btn-line">
              <iconify-icon className="iconify" icon="mdi:instagram" style={{ fontSize: 20 }} />
              {INSTAGRAM_HANDLE}
            </a>
            <Link href="/produtos" className="ag-help-link">Ver catálogo completo</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
