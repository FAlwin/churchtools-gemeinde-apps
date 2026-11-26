import { Etikett } from '@ui/bedienung/Etikett';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { abfrageBandText, abfrageKartenEtikett } from '@shared/dienstplan/abfrageStand';
import type { Abfrage } from '@shared/dienstplan/abfragen';
import styles from './AbfrageBand.module.scss';

/**
 * **Das schmale Band über „Verfügbarkeit“** (R-3, Entwurf Schritt 5): Etikett, „Abfrage Musik · 01.02.–31.03. · noch 7 von 9
 * offen“ und rechts still „Alle Termine zeigen“ (die Seite ohne Abfrage). `stand` ist `null`, solange noch geladen wird – dann
 * steht das Band ohne Zahl da, statt eine falsche zu zeigen.
 */
export function AbfrageBand({
  gruppe,
  abfrage,
  stand,
  heute,
  onAlle,
}: {
  gruppe: string;
  abfrage: Abfrage;
  stand: { offen: number; gesamt: number } | null;
  heute: string;
  onAlle: () => void;
}) {
  const etikett = abfrageKartenEtikett(abfrage, heute);
  return (
    <div className={styles.band} role="note" aria-label="Abfrage">
      {etikett && <Etikett ton={etikett.ton}>{etikett.text}</Etikett>}
      <span className={styles.text}>{abfrageBandText({ gruppe, abfrage, stand })}</span>
      <span className={styles.rechts}>
        <TextKnopf onClick={onAlle}>Alle Termine zeigen</TextKnopf>
      </span>
    </div>
  );
}
