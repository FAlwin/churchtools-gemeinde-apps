import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { kachel, tagKurz } from '@shared/ct/datum';
import { gemeindeZeitzone, heuteImKalender, tagAusIso, uhrText } from '@shared/ct/zeit';
import { bisDahin } from '@shared/dienstplan/start';
import type { GebetsTermin } from '@shared/gebetsabend/termin';
import styles from './Zuhoeren.module.scss';

/**
 * **Der nächste Gebetsabend als Kopf der Zuhören-Karte** (Entwurf v4): „Als Nächstes · in 7 Tagen“, Datumskachel,
 * Titel und „Do, 12.11. · 19:30 Uhr“ in der Uhr der Gemeinde – aufgebaut wie „Als Nächstes“ im Dienstplaner.
 */
export function TerminKopf({ termin }: { termin: GebetsTermin }) {
  const tag = tagAusIso(termin.beginn, gemeindeZeitzone());
  const k = kachel(tag);
  return (
    <>
      <span className={styles.vorzeile}>Als Nächstes · {bisDahin(heuteImKalender(), tag)}</span>
      <div className={styles.terminKopf}>
        <DatumKachel tag={k.tag} monat={k.monat} />
        <div>
          <h2 id="gebetsabend">{termin.titel}</h2>
          <p className={styles.leise}>
            {tagKurz(tag)} · {uhrText(termin.beginn)} Uhr
          </p>
        </div>
      </div>
    </>
  );
}
