import Image from 'next/image';
import Link from 'next/link';
import { BRANDS } from '@/lib/store';

/** Filtro visual por marca: cada círculo leva ao catálogo já filtrado. */
export default function BrandCircles() {
  return (
    <section className="ag-brands" aria-labelledby="brandsTitle">
      <div className="ag-wrap">
        <h2 id="brandsTitle" className="ag-h2 ag-center">Compre por marca</h2>
        <ul className="ag-brand-row">
          {BRANDS.map((b) => (
            <li key={b.name}>
              <Link href={`/produtos?brand=${encodeURIComponent(b.name)}`} className="ag-brand">
                <Image src={b.img} alt="" width={400} height={400} sizes="(max-width: 700px) 28vw, 200px" />
                <span>{b.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
