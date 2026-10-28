import { useId } from 'react';
import { Icon } from '../icons/icons';
import { useAufklapp } from './useAufklapp';
import styles from './FilterKnopf.module.scss';

/** Ein Abschnitt im Filter-Menü, z. B. „Veranstaltungen“ oder „Gruppen“. */
export interface FilterAbschnitt {
  titel: string;
  optionen: { wert: string; text: string }[];
  /** Die ausgeschalteten Werte. */
  aus: string[];
  /** Die neue Liste der ausgeschalteten Werte nach einem Tipp. */
  onAus: (aus: string[]) => void;
}

/**
 * **Ein Knopf „Filter“ mit Menü** (Alwin, 14.10.2026, Entwurf A: „zu viele verschiedene Buttons“) – für
 * Termine-Liste und Matrix des Dienstplaners und seit 28.10.2026 die Abwesenheiten der Musik-App (`ui/`, eine Komponente). Im Menü je Abschnitt eine Überschrift und Häkchen: angehakt heißt **wird
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
  const sichtbar = abschnitte.filter((a) => a.optionen.length > 1);
  const ausgeblendet = sichtbar.reduce(
    (n, a) => n + a.optionen.filter((o) => a.aus.includes(o.wert)).length,
    0,
  );

  if (sichtbar.length === 0) return null;
  return (
    <div className={`${styles.rahmen}${className ? ' ' + className : ''}`} ref={rahmen}>
      <button
        type="button"
        className={`${styles.knopf}${ausgeblendet ? ' ' + styles.aktiv : ''}`}
        aria-expanded={offen}
        aria-controls={id}
        aria-label={ausgeblendet ? `Filter, ${ausgeblendet} ausgeblendet` : 'Filter'}
        onClick={() => setOffen(!offen)}
      >
        <Icon name="regler" size={15} />
        Filter
        {ausgeblendet > 0 && <span className={styles.zahl}>{ausgeblendet}</span>}
      </button>
      {offen && (
        <div className={styles.menue} id={id} role="dialog" aria-label="Filter">
          {sichtbar.map((a) => (
            <fieldset key={a.titel} className={styles.abschnitt}>
              <legend>{a.titel}</legend>
              {a.optionen.map((o) => (
                <label key={o.wert || '–'} className={styles.zeile}>
                  <input
                    type="checkbox"
                    checked={!a.aus.includes(o.wert)}
                    onChange={() =>
                      a.onAus(
                        a.aus.includes(o.wert)
                          ? a.aus.filter((x) => x !== o.wert)
                          : [...a.aus, o.wert],
                      )
                    }
                  />
                  {o.text}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      )}
    </div>
  );
}
