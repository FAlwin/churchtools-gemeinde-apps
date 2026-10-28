import { useId, useState } from 'react';
import { Icon } from '../icons/icons';
import { monatName, monatPlus, plusTage } from '@shared/ct/datum';
import { spanneText, zeitraumGrenzen, zeitraumGueltig, type Zeitraum } from '@shared/ct/zeitraum';
import { useAufklapp } from './useAufklapp';
import styles from './ZeitraumKnopf.module.scss';

/**
 * **Der Zeitraum-Knopf** (Alwin, 14.10.2026, Entwurf „Zeitraum wählen“; seit 28.10.2026 in `ui/` – Dienstplaner ›
 * Planen und Abwesenheiten der Musik-App, eine Komponente): zeigt, was gerade zu
 * sehen ist, und öffnet ein Menü – ab heute (passend zur Fensterbreite), dieser Monat, nächster Monat oder
 * ein eigener Zeitraum von–bis. Was die Wahl bedeutet, regelt `shared/ct/zeitraum.ts`.
 */
export function ZeitraumKnopf({
  zeitraum,
  zeile1,
  zeile2,
  heute,
  abHeuteZusatz,
  spaetestens,
  onWahl,
}: {
  zeitraum: Zeitraum;
  /** Was zu sehen ist, z. B. „18.10. – 08.11.2026“. */
  zeile1: string;
  /** Darunter, z. B. „7 Termine · passend zur Fensterbreite“. */
  zeile2: string;
  /** Heute (`YYYY-MM-DD`) – für „dieser“ und „nächster Monat“. */
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
  onWahl: (z: Zeitraum) => void;
}) {
  const { offen, setOffen, rahmen } = useAufklapp();
  const id = useId();
  const dieser = heute.slice(0, 7);
  const naechster = monatPlus(dieser, 1);
  const grenzen = zeitraumGrenzen(zeitraum) ?? { von: heute, bis: plusTage(heute, 27) };
  const [von, setVon] = useState(grenzen.von);
  const [bis, setBis] = useState(grenzen.bis);
  const zuWeit = spaetestens !== undefined && bis > spaetestens;

  const waehle = (z: Zeitraum) => {
    onWahl(z);
    setOffen(false);
  };
  const ist = (z: Zeitraum) => JSON.stringify(z) === JSON.stringify(zeitraum);
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
          {option({ art: 'abHeute' }, 'Ab heute', abHeuteZusatz)}
          {option({ art: 'monat', monat: dieser }, 'Dieser Monat', monatName(`${dieser}-01`))}
          {option(
            { art: 'monat', monat: naechster },
            'Nächster Monat',
            monatName(`${naechster}-01`),
          )}
          <fieldset className={styles.eigen}>
            <legend>Eigener Zeitraum</legend>
            <div className={styles.felder}>
              <input
                type="date"
                aria-label="von"
                value={von}
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
