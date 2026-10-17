'use client';

import { useId, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FLOORS, FULFILLMENT, SIZES, wppLink } from '@/lib/store';

/**
 * Hero da home: em vez de um banner decorativo, um bloco de compra direta.
 * O cliente escolhe disponibilidade, piso e numeração e cai no catálogo já
 * filtrado (/produtos?cat=society&tipo=pronta&size=40).
 */
export default function HeroFinder() {
  const router = useRouter();
  const uid = useId();
  const [tipo, setTipo] = useState('pronta');
  const [piso, setPiso] = useState('society');
  const [size, setSize] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const qs = new URLSearchParams({ cat: piso, tipo });
    if (size) qs.set('size', size);
    router.push(`/produtos?${qs.toString()}`);
  }

  return (
    <section className="ag-hero" aria-labelledby="heroTitle">
      <div className="ag-wrap ag-hero-grid">
        <div className="ag-hero-copy">
          <h1 id="heroTitle" className="ag-hero-title">Chuteira certa para o seu jogo.</h1>
          <p className="ag-hero-lead">
            Society, Futsal e Campo. Escolha o piso e a numeração e veja só o que serve pra você.
          </p>

          <form className="ag-finder" onSubmit={handleSubmit} aria-label="Encontrar chuteira">
            <fieldset className="ag-field">
              <legend>Como você quer comprar</legend>
              <div className="ag-opts">
                {FULFILLMENT.map((f) => (
                  <label key={f.value} className="ag-opt">
                    <input
                      type="radio"
                      name={`${uid}-tipo`}
                      value={f.value}
                      checked={tipo === f.value}
                      onChange={() => setTipo(f.value)}
                    />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="ag-field">
              <legend>Onde você joga</legend>
              <div className="ag-opts">
                {FLOORS.map((f) => (
                  <label key={f.slug} className="ag-opt">
                    <input
                      type="radio"
                      name={`${uid}-piso`}
                      value={f.slug}
                      checked={piso === f.slug}
                      onChange={() => setPiso(f.slug)}
                    />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="ag-field ag-field-row">
              <label htmlFor={`${uid}-size`} className="ag-field-label">Numeração</label>
              <select
                id={`${uid}-size`}
                className="ag-select"
                value={size}
                onChange={(e) => setSize(e.target.value)}
              >
                <option value="">Qualquer número</option>
                {SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <button type="submit" className="ag-btn ag-btn-gold">Ver chuteiras</button>
            </div>
          </form>

          <p className="ag-hero-help">
            Não achou o seu modelo?{' '}
            <a href={wppLink('Olá! Estou procurando uma chuteira e queria ajuda.')} target="_blank" rel="noopener">
              Fale com a gente no WhatsApp
            </a>
          </p>
        </div>

        <figure className="ag-hero-photo">
          <Image
            src="/assets/img/hero.webp"
            alt="Parede de chuteiras da loja AG12 Sports, com modelos de várias cores"
            width={736}
            height={981}
            priority
            sizes="(max-width: 900px) 100vw, 460px"
          />
          <figcaption>Parede de chuteiras da loja</figcaption>
        </figure>
      </div>
    </section>
  );
}
