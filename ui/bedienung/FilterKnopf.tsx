import { Fragment, useId } from 'react';
import { Icon } from '../icons/icons';
import { useAufklapp } from './useAufklapp';
import { abschnittMitWahl, type FilterAbschnitt } from './filterAbschnitt';
import styles from './FilterKnopf.module.scss';

export type { FilterAbschnitt, FilterZusatz } from './filterAbschnitt';

/**
 * **Ein Knopf „Filter“ mit Menü** (Alwin, 14.10.2026, Entwurf A: „zu viele verschiedene Buttons“) – für
 * Termine-Liste und Matrix des Dienstplaners, seit 28.10.2026 die Abwesenheiten und seit 05.11.2026 die Terminliste der Musik-App (`ui/`, eine Komponente). Im Menü je Abschnitt eine Überschrift und Häkchen: angehakt heißt **wird
 * gezeigt**. Die Zahl am Knopf sagt, wie viel gerade ausgeblendet ist. Ersetzt die Filter-Pillen; was
 * gefiltert wird und wie es gemerkt wird, bleibt beim Aufrufer.
 */
export function FilterKnopf({
  abschnitte,
  className,
}: {
  abschnitte: FilterAbschnitt[];
  /** Für die Lage in der Leiste (z. B. rechtsbündig). */
  className?: string;
}) {
  const { offen, setOffen, rahmen } = useAufklapp();
  const id = useId();
  const sichtbar = abschnitte.filter(abschnittMitWahl);
  const ausgeblendet = sichtbar.reduce(
    (n, a) => n + a.optionen.filter((o) => a.aus.includes(o.wert)).length,
    0,
  );

  if (sichtbar.length === 0) return null;
  return (
    <div className={`${styles.rahmen}${className ? ' ' + className : ''}`} ref={rahmen}>
      <button
        type="button"
        className={`${styles.knopf}${ausgeblendet ? ' ' + styles.aktiv + ' ' + styles.mitZahl : ''}`}
        aria-expanded={offen}
        aria-controls={id}
        aria-label={ausgeblendet ? `Filter, ${ausgeblendet} ausgeblendet` : 'Filter'}
        onClick={() => setOffen(!offen)}
      >
        <Icon name="regler" size={15} />
        <span className={styles.text}>Filter</span>
        {ausgeblendet > 0 && <span className={styles.zahl}>{ausgeblendet}</span>}
      </button>
      {offen && (
        <div className={styles.menue} id={id} role="dialog" aria-label="Filter">
          {sichtbar.map((a) => (
            <fieldset key={a.titel} className={styles.abschnitt}>
              <legend>{a.titel}</legend>
              {a.optionen.map((o) => {
                const an = !a.aus.includes(o.wert);
                return (
                  <Fragment key={o.wert || '–'}>
                    <label className={styles.zeile}>
                      <input
                        type="checkbox"
                        checked={an}
                        onChange={() =>
                          a.onAus(an ? [...a.aus, o.wert] : a.aus.filter((x) => x !== o.wert))
                        }
                      />
                      {o.text}
                    </label>
                    {o.zusatz && (
                      <label className={`${styles.zeile} ${styles.zusatz}`}>
                        <input
                          type="checkbox"
                          checked={an && o.zusatz.an}
                          disabled={!an}
                          // Der Text steht unter jeder Möglichkeit gleich – vorgelesen wird, wozu er gehört.
                          aria-label={`${o.text}: ${o.zusatz.text}`}
                          onChange={o.zusatz.onUmschalten}
                        />
                        {o.zusatz.text}
                      </label>
                    )}
                  </Fragment>
                );
              })}
              {a.hinweis && <p className={styles.hinweis}>{a.hinweis}</p>}
            </fieldset>
          ))}
        </div>
      )}
    </div>
  );
}
