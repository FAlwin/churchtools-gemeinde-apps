import { Etikett } from '@ui/bedienung/Etikett';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { tagMonat } from '@shared/ct/datum';
import { tagAusIso, gemeindeZeitzone } from '@shared/ct/zeit';
import {
  abfrageEtikett,
  type StandAbschnitte,
  type Zeitzeile,
} from '@shared/dienstplan/abfrageFenster';
import type { Abfrage } from '@shared/dienstplan/abfragen';
import { AbfrageZeitleiste } from './AbfrageZeitleiste';
import { abgleichText, automatikHinweis, bekommenErinnerungenText } from './abfragenTexte';
import styles from './AbfrageFenster.module.scss';

/**
 * **Der Stand einer laufenden Abfrage** (Entwurf Schritt 6, rechts): Etikett (blau bis zur Frist, rot danach), wer noch
 * offen ist, wer fertig ist, wer pausiert, und „Was passiert wann“ – die vergangenen Tage grau, ohne zu behaupten, dass
 * dort etwas verschickt wurde (das wüsste erst die Automatik, R-5). Nur die Anzeige; Rechnen im Fenster.
 */
export function AbfrageStand({
  abfrage,
  heute,
  gruppeName,
  abschnitte,
  laedt,
  grund,
  nochmal,
  onNochmal,
  zeilen,
  eingerichtet,
  automatik = null,
}: {
  abfrage: Abfrage;
  heute: string;
  gruppeName: string;
  /** `null`: nicht zu berechnen (laedt noch oder gesperrt). */
  abschnitte: StandAbschnitte | null;
  laedt: boolean;
  /** Warum es nicht zu berechnen ist. */
  grund: string | null;
  nochmal: boolean;
  onNochmal: () => void;
  zeilen: Zeitzeile[];
  /** Die Erinnerungen sind in ChurchTools eingerichtet (`inhalt.einrichtung`). */
  eingerichtet: boolean;
  /** Der Abgleich beim Öffnen: wer noch Erinnerungen bekommt, wer inzwischen ausgetragen wurde (`null`: noch nicht / nicht möglich). */
  automatik?: { drin: number; ausgetragen: number } | null;
}) {
  const etikett = abfrageEtikett(abfrage, heute);
  const am = tagMonat(tagAusIso(abfrage.gestartet.zeit, gemeindeZeitzone()));
  return (
    <>
      <div className={styles.kopfzeile}>
        {etikett && <Etikett ton={etikett.ton}>{etikett.text}</Etikett>}
        <span>
          gestartet am {am} von {abfrage.gestartet.name}
        </span>
      </div>

      {laedt && !abschnitte && (
        <p className={styles.leise} role="status">
          Wer noch offen ist, wird berechnet …
        </p>
      )}
      {!laedt && !abschnitte && (
        <>
          <p className={styles.fehler} role="status">
            Wer noch offen ist, lässt sich gerade nicht sagen{grund ? `: ${grund}` : ''}.
          </p>
          {nochmal && (
            <p className={styles.nochmal}>
              <TextKnopf onClick={onNochmal}>Nochmal versuchen</TextKnopf>
            </p>
          )}
        </>
      )}
      {abschnitte && (
        <>
          <h3 className={styles.titel}>Noch offen · {abschnitte.offen.length}</h3>
          {abschnitte.offen.length === 0 ? (
            <p className={styles.namen}>Niemand – alle haben geantwortet.</p>
          ) : (
            <ul className={styles.personen} aria-label="Noch offen">
              {abschnitte.offen.map((p) => (
                <li key={p.personId}>
                  {p.name}{' '}
                  <small>
                    · {p.offen} von {p.von} offen
                  </small>
                </li>
              ))}
            </ul>
          )}
          <h3 className={styles.titel}>Fertig · {abschnitte.fertig.length}</h3>
          <p className={styles.namen}>
            {abschnitte.fertig.length === 0
              ? 'Noch niemand.'
              : abschnitte.fertig.map((p) => p.name).join(', ')}
          </p>
          <h3 className={styles.titel}>
            Pausiert – keine Erinnerung · {abschnitte.pausiert.length}
          </h3>
          <p className={styles.namen}>
            {abschnitte.pausiert.length === 0
              ? 'Niemand.'
              : abschnitte.pausiert
                  .map(
                    (p) =>
                      `${p.name} (${p.bis ? `Pause bis ${tagMonat(p.bis)}` : 'Pause ohne Ende'})`,
                  )
                  .join(', ')}
          </p>
        </>
      )}

      <AbfrageZeitleiste zeilen={zeilen} />
      <p className={styles.leise}>{automatikHinweis(gruppeName, eingerichtet)}</p>
      {automatik && (
        <p className={styles.leise} role="status">
          {bekommenErinnerungenText(automatik.drin)}
          {automatik.ausgetragen > 0 && ` ${abgleichText(automatik.ausgetragen)}`}
        </p>
      )}
    </>
  );
}
