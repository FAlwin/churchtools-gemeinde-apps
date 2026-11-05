import { Fragment, useId, useState } from 'react';
import { Icon } from '../icons/icons';
import { monatName, plusTage } from '@shared/ct/datum';
import {
  LETZTE_MONATE,
  ohneDazu,
  spanneText,
  zeitraumGrenzen,
  zeitraumGueltig,
  type Zeitraum,
} from '@shared/ct/zeitraum';
import { useAufklapp } from './useAufklapp';
import styles from './ZeitraumKnopf.module.scss';

/**
 * **Der Zeitraum-Knopf** (Alwin, 14.10.2026, Entwurf „Zeitraum wählen“; seit 28.10.2026 in `ui/` – Dienstplaner ›
 * Planen und Abwesenheiten der Musik-App, eine Komponente): zeigt, was gerade zu
 * sehen ist, und öffnet ein Menü – ab heute (passend zur Fensterbreite), ein Monat zum Anklicken oder ein eigener
 * Zeitraum von–bis. **Seit E9-3 (Alwin, 05.11.2026, Entwurf `e9-zeitraum-scrollen.html` A):** zwölf Monatsfelder mit
 * Jahr ‹ › statt „Dieser/Nächster Monat“ – ein Klick zeigt den Monat; mit `vergangenheit` („Wer wie oft?“) oben die
 * letzten 3, 6 oder 12 Monate statt „Ab heute“. Was die Wahl bedeutet, regelt `shared/ct/zeitraum.ts`.
 */
export function ZeitraumKnopf({
  zeitraum,
  zeile1,
  zeile2,
  heute,
  abHeuteZusatz,
  spaetestens,
  fruehestens,
  vergangenheit = false,
  onWahl,
}: {
  zeitraum: Zeitraum;
  /** Was zu sehen ist, z. B. „18.10. – 08.11.2026“. */
  zeile1: string;
  /** Darunter, z. B. „7 Termine · passend zur Fensterbreite“. */
  zeile2: string;
  /** Heute (`YYYY-MM-DD`) – der Punkt im Monatsfeld und „Letzte N Monate“. */
  heute: string;
  /**
   * Was „Ab heute“ beim Aufrufer heißt – Matrix „passend zur Fensterbreite“ bzw. am Handy „die nächsten Termine“,
   * Abwesenheiten „die nächsten 4 Wochen“. Vorher kannte der Knopf nur die Matrix (`handy`).
   */
  abHeuteZusatz: string;
  /**
   * Spätester erlaubter Tag eines eigenen Zeitraums (`YYYY-MM-DD`) – die Abwesenheiten holen Termine höchstens ein Jahr
   * voraus (`MAX_VORAUS_TAGE`). Ohne Angabe gibt es keine Grenze (Matrix).
   */
  spaetestens?: string;
  /**
   * Frühester erlaubter Tag (`YYYY-MM-DD`) – die Abwesenheiten zeigen nichts Vergangenes, dort beginnen die Monatsfelder
   * beim laufenden Monat (E9-3). Ohne Angabe gibt es keine Grenze (Matrix, „Wer wie oft?“).
   */
  fruehestens?: string;
  /** „Wer wie oft?“ (E9-3): oben die letzten 3, 6 und 12 Monate bis heute statt „Ab heute“. */
  vergangenheit?: boolean;
  onWahl: (z: Zeitraum) => void;
}) {
  const { offen, setOffen, rahmen } = useAufklapp();
  const id = useId();
  const dieser = heute.slice(0, 7);
  const grenzen = zeitraumGrenzen(zeitraum, heute) ?? { von: heute, bis: plusTage(heute, 27) };
  const [von, setVon] = useState(grenzen.von);
  const [bis, setBis] = useState(grenzen.bis);
  // Das Jahr der Monatsfelder: beim Öffnen das des gezeigten Monats bzw. Zeitraums.
  const [jahr, setJahr] = useState(Number(grenzen.von.slice(0, 4)));
  const zuWeit = spaetestens !== undefined && bis > spaetestens;
  const gewaehlt = ohneDazu(zeitraum);

  const waehle = (z: Zeitraum) => {
    onWahl(z);
    setOffen(false);
  };
  // Gewählt ist ein Zeitraum auch mit ＋ daneben – „Dezember + 1 Termin“ ist immer noch der Dezember.
  const ist = (z: Zeitraum) => JSON.stringify(z) === JSON.stringify(gewaehlt);
  const option = (z: Zeitraum, text: string, zusatz: string) => (
    <button type="button" className={styles.option} aria-pressed={ist(z)} onClick={() => waehle(z)}>
      {text}
      <small>{zusatz}</small>
    </button>
  );

  return (
    <div className={styles.rahmen} ref={rahmen}>
      <button
        type="button"
        className={styles.knopf}
        aria-expanded={offen}
        aria-controls={id}
        aria-label={`Zeitraum: ${zeile1}, ${zeile2}`}
        onClick={() => {
          // Beim Öffnen die Felder auf den aktuellen Zeitraum setzen.
          if (!offen) {
            setVon(grenzen.von);
            setBis(grenzen.bis);
            setJahr(Number(grenzen.von.slice(0, 4)));
          }
          setOffen(!offen);
        }}
      >
        <b>
          {zeile1}
          <Icon name="chev-down" size={13} />
        </b>
        <small>{zeile2}</small>
      </button>
      {offen && (
        <div className={styles.menue} id={id} role="dialog" aria-label="Zeitraum wählen">
          {vergangenheit
            ? LETZTE_MONATE.map((n) => (
                <Fragment key={n}>
                  {option({ art: 'letzte', monate: n }, `Letzte ${n} Monate`, 'bis heute')}
                </Fragment>
              ))
            : option({ art: 'abHeute' }, 'Ab heute', abHeuteZusatz)}
          <fieldset className={styles.eigen}>
            <legend>Monat</legend>
            <div className={styles.jahr}>
              <button
                type="button"
                className={styles.jahrKnopf}
                aria-label="Jahr davor"
                disabled={fruehestens !== undefined && `${jahr - 1}-12-31` < fruehestens}
                onClick={() => setJahr(jahr - 1)}
              >
                <Icon name="chev-left" size={16} />
              </button>
              <b>{jahr}</b>
              <button
                type="button"
                className={styles.jahrKnopf}
                aria-label="Jahr danach"
                disabled={spaetestens !== undefined && `${jahr + 1}-01-01` > spaetestens}
                onClick={() => setJahr(jahr + 1)}
              >
                <Icon name="chev-right" size={16} />
              </button>
            </div>
            <div className={styles.monate}>
              {Array.from({ length: 12 }, (_, i) => {
                const monat = `${jahr}-${String(i + 1).padStart(2, '0')}`;
                const name = monatName(`${monat}-01`);
                return (
                  <button
                    key={monat}
                    type="button"
                    className={`${styles.monat}${monat === dieser ? ' ' + styles.heute : ''}`}
                    aria-pressed={ist({ art: 'monat', monat })}
                    aria-label={`${name} ${jahr}`}
                    disabled={
                      (spaetestens !== undefined && `${monat}-01` > spaetestens) ||
                      (fruehestens !== undefined && `${monat}-31` < fruehestens)
                    }
                    onClick={() => waehle({ art: 'monat', monat })}
                  >
                    {name.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <fieldset className={styles.eigen}>
            <legend>Eigener Zeitraum</legend>
            <div className={styles.felder}>
              <input
                type="date"
                aria-label="von"
                value={von}
                min={fruehestens}
                onChange={(e) => setVon(e.target.value)}
              />
              <span aria-hidden="true">–</span>
              <input
                type="date"
                aria-label="bis"
                value={bis}
                max={spaetestens}
                onChange={(e) => setBis(e.target.value)}
              />
            </div>
            {zuWeit && spaetestens && (
              <small className={styles.grenze}>
                Höchstens bis {spanneText(spaetestens, spaetestens)}
              </small>
            )}
            <button
              type="button"
              className={styles.anzeigen}
              disabled={!zeitraumGueltig(von, bis) || zuWeit}
              onClick={() => waehle({ art: 'eigen', von, bis })}
            >
              Anzeigen
            </button>
          </fieldset>
        </div>
      )}
    </div>
  );
}
