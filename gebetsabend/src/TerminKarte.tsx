import { useEffect, useState } from 'react';
import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { kachel, wochentagName } from '@shared/ct/datum';
import { gemeindeZeitzone, tagAusIso, uhrText } from '@shared/ct/zeit';
import type { GebetsTermin } from '@shared/gebetsabend/termin';
import { ladeEinstellungen, ladeTermin } from './lesen';
import styles from './Zuhoeren.module.scss';

/** **Der nächste Gebetsabend** (Entwurf v2): Datumskachel, Titel, „Donnerstag · 19:30 Uhr“ in der Uhr der Gemeinde. */
export function TerminKarte({ termin }: { termin: GebetsTermin }) {
  const tag = tagAusIso(termin.beginn, gemeindeZeitzone());
  const k = kachel(tag);
  return (
    <section className={`${styles.karte} ${styles.termin}`} aria-label="Nächster Gebetsabend">
      <DatumKachel tag={k.tag} monat={k.monat} />
      <div>
        <p className={styles.titel}>{termin.titel}</p>
        <p className={styles.leise}>
          {wochentagName(tag)} · {uhrText(termin.beginn)} Uhr
        </p>
      </div>
    </section>
  );
}

/**
 * **Lädt den nächsten Termin und zeigt ihn** – oder nichts: ohne gewählten Kalender, ohne passenden Termin und auch,
 * wenn ChurchTools gerade nicht antwortet. Der Termin ist Beiwerk; das Zuhören darf daran nicht hängen.
 */
export function NaechsterTermin({ modul, kategorie }: { modul: number; kategorie: number | null }) {
  const [termin, setTermin] = useState<GebetsTermin | null>(null);
  useEffect(() => {
    if (kategorie === null) return;
    let aktuell = true;
    ladeEinstellungen(modul, kategorie)
      .then((e) => ladeTermin(e))
      .then(
        (t) => {
          if (aktuell) setTermin(t);
        },
        () => undefined,
      );
    return () => {
      aktuell = false;
    };
  }, [modul, kategorie]);
  return termin ? <TerminKarte termin={termin} /> : null;
}
