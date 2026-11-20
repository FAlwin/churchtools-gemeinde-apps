import { Fragment, useId } from 'react';
import { Icon } from '../icons/icons';
import { useAufklapp } from './useAufklapp';
import { useMenueImBild } from './useMenueImBild';
import { abschnittMitWahl, type FilterAbschnitt } from './filterAbschnitt';
import styles from './FilterKnopf.module.scss';

export type { FilterAbschnitt, FilterOption, FilterUnter, FilterZusatz } from './filterAbschnitt';

/**
 * **Ein Knopf „Filter“ mit Menü** (Alwin, 14.10.2026, Entwurf A: „zu viele verschiedene Buttons“) – für
 * Termine-Liste und Matrix des Dienstplaners, seit 28.10.2026 die Abwesenheiten und seit 05.11.2026 die Terminliste der Musik-App (`ui/`, eine Komponente). Im Menü je Abschnitt eine Überschrift und Häkchen: angehakt heißt **wird
 * gezeigt**. Die Zahl am Knopf sagt, wie viel gerade ausgeblendet ist. Ersetzt die Filter-Pillen; was
 * gefiltert wird und wie es gemerkt wird, bleibt beim Aufrufer.
 */
export function FilterKnopf({
  abschnitte,
  className,
  still = false,
  dataTour,
}: {
  abschnitte: FilterAbschnitt[];
  /**
   * **Still** (R2, „Ruhige Bedienung“ B3): ohne Rand und Fläche, wie die stillen Knöpfe daneben – der Normalfall in
   * Werkzeugzeilen. Gibt es aktive Filter, bleibt der Knopf blau getönt. Am Handy rahmt ihn die Werkzeugzeile (R12).
   */
  still?: boolean;
  /** Für die Lage in der Leiste (z. B. rechtsbündig). */
  className?: string;
  /** Ziel der geführten Einführung – an der Hülle, damit der Knopf direkt unter der Werkzeugzeile bleibt (R12-Rahmen am Handy). */
  dataTour?: string;
}) {
  const { offen, setOffen, rahmen, menue } = useAufklapp();
  useMenueImBild(menue, offen, 'rechts');
  const id = useId();
  const sichtbar = abschnitte.filter(abschnittMitWahl);
  const ausgeblendet = sichtbar.reduce(
    (n, a) =>
      a.anzeige || a.eine
        ? n
        : n +
          a.optionen.reduce(
            (m, o) =>
              m + (a.aus.includes(o.wert) ? 1 : (o.unter?.punkte.filter((p) => !p.an).length ?? 0)),
            0,
          ),
    0,
  );

  if (sichtbar.length === 0) return null;
  return (
    <div
      className={`${styles.rahmen}${className ? ' ' + className : ''}`}
      ref={rahmen}
      data-tour={dataTour}
    >
      <button
        type="button"
        className={`${styles.knopf}${still ? ' ' + styles.still : ''}${ausgeblendet ? ' ' + styles.aktiv + ' ' + styles.mitZahl : ''}`}
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
        <div ref={menue} className={styles.menue} id={id} role="dialog" aria-label="Filter">
          {sichtbar.map((a) => (
            <fieldset key={a.titel} className={styles.abschnitt}>
              <legend>{a.titel}</legend>
              {a.eine &&
                a.optionen.map((o) => (
                  <label key={o.wert} className={styles.zeile}>
                    <input
                      type="radio"
                      name={`${id}-${a.titel}`}
                      checked={a.eine?.wert === o.wert}
                      onChange={() => a.eine?.onWahl(o.wert)}
                    />
                    {o.text}
                  </label>
                ))}
              {!a.eine &&
                a.optionen.map((o) => {
                  const an = !a.aus.includes(o.wert);
                  return (
                    <Fragment key={o.wert || '–'}>
                      <label className={styles.zeile}>
                        <input
                          type="checkbox"
                          checked={an}
                          ref={(el) => {
                            if (el) el.indeterminate = an && !!o.unter?.teilweise;
                          }}
                          onChange={() =>
                            o.unter
                              ? o.unter.onAlle()
                              : a.onAus(an ? [...a.aus, o.wert] : a.aus.filter((x) => x !== o.wert))
                          }
                        />
                        {o.text}
                      </label>
                      {o.unter?.punkte.map((p, nr) => (
                        <label
                          key={`${p.text}-${nr}`}
                          className={`${styles.zeile} ${styles.zusatz}`}
                        >
                          <input
                            type="checkbox"
                            checked={p.an}
                            aria-label={`${o.text}: ${p.text}`}
                            onChange={p.onUmschalten}
                          />
                          {p.text}
                        </label>
                      ))}
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
              {a.kurz && (
                <div className={styles.kurz}>
                  {a.kurz.map((k) => (
                    <button key={k.text} type="button" onClick={k.onClick}>
                      {k.text}
                    </button>
                  ))}
                </div>
              )}
              {a.hinweis && <p className={styles.hinweis}>{a.hinweis}</p>}
            </fieldset>
          ))}
        </div>
      )}
    </div>
  );
}
