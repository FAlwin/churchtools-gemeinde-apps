import type { Seite } from '@shared/anmeldung/formularSchritte';
import s from './AnmeldeFormular.module.scss';

/**
 * **Wo man im Formular steht** (F2b, Klick-Runde 7): „Schritt 2 von 3 · Wer kommt mit“ und ein dünner Balken – ein
 * Stück je Schritt, erledigte und der offene in der Akzentfarbe, übersprungene gestrichelt (sie zählen nicht mit).
 */
export function SchrittFortschritt({
  alle,
  gezeigt,
  nr,
  name,
}: {
  alle: Seite[];
  gezeigt: Seite[];
  nr: number;
  name: string;
}) {
  return (
    <div className={s.fortschritt}>
      <p className={s.fortschrittStand} aria-live="polite">
        Schritt {nr + 1} von {gezeigt.length} · <b>{name}</b>
      </p>
      <div className={s.fortschrittBalken} aria-hidden="true">
        {alle.map((x, i) => {
          const j = gezeigt.indexOf(x);
          return (
            <span
              key={x.schritt?.id ?? `erster-${i}`}
              className={j < 0 ? s.uebersprungen : j <= nr ? s.erledigt : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
