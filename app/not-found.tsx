import type { Metadata } from "next";
import s from "./not-found.module.css";

// La pagina che non c'è: il logo dei nove tasti (il centro d'oro), una frase, la strada di casa. Niente script.
// Il link è un <a> semplice: la home è una pagina statica, non una pagina di Next.

// (il noindex lo mette Next da sé, per ogni 404)
export const metadata: Metadata = { title: "Pagina non trovata" };

export default function NotFound() {
  return (
    <main className={s.page}>
      <div className={s.box}>
        <span className={s.logo} aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} className={i === 4 ? s.centre : undefined} />
          ))}
        </span>
        <p className={s.code}>404</p>
        <h1 className={s.title}>Questa pagina non c’è.</h1>
        <p className={s.text}>L’indirizzo forse è sbagliato, o la pagina si è spostata.</p>
        <a className={s.home} href="/">
          <span className={s.dot} aria-hidden="true" />
          Torna alla home
        </a>
      </div>
    </main>
  );
}
