import { Etikett } from '@ui/bedienung/Etikett';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { Icon } from '@ui/icons/icons';
import {
  ABFRAGE_FERTIG_KNOPF,
  ABFRAGE_FERTIG_TEXT,
  abfrageBandText,
  abfrageBandTextAbwesend,
  abfrageKartenEtikett,
} from '@shared/dienstplan/abfrageStand';
import type { Abfrage } from '@shared/dienstplan/abfragen';
import styles from './AbfrageBand.module.scss';

/**
 * Was nur das Band einer Abfrage „Nur abwesend“ braucht (V-4): ob ich fertig bin und was der Knopf „Fertig“ darf.
 */
export interface FertigBand {
  /** Mein Stand: `true` = bestätigt oder überall abwesend, `false` = noch nicht fertig, `null` = noch nicht berechnet (lädt). */
  fertig: boolean | null;
  /** Die Speichern-Leiste ist offen: erst speichern, dann „Fertig“ – sonst bestätigte der Knopf Häkchen, die noch nicht stehen. */
  erstSpeichern: boolean;
  /** Kein anderer Knopf der Ansicht ist gefüllt (R1): dann ist „Fertig“ die Hauptaktion, sonst ein Neben-Knopf. */
  haupt: boolean;
  /** Das Speichern läuft. */
  arbeitet: boolean;
  /** Warum es nicht ging – steht unter dem Band. */
  fehler: string | null;
  onFertig: () => void;
}

/**
 * **Das schmale Band über „Verfügbarkeit“** (R-3, Entwurf Schritt 5): Etikett, „Abfrage Musik · 01.02.–31.03. · noch 7 von 9
 * offen“ und rechts still „Alle Termine zeigen“ (die Seite ohne Abfrage). `stand` ist `null`, solange noch geladen wird – dann
 * steht das Band ohne Zahl da, statt eine falsche zu zeigen.
 *
 * **Bei „Nur abwesend“** (`fertigBand` gesetzt, V-4): keine Zahl – ein freier Termin ist dort keine Antwort. Vor dem Fertigsein steht
 * „… Häkchen setzen, wo du nicht kannst, dann:“ mit dem Knopf **„Fertig“**; danach ein grünes Band „fertig · Danke! …“.
 */
export function AbfrageBand({
  gruppe,
  abfrage,
  stand,
  heute,
  onAlle,
  fertigBand,
}: {
  gruppe: string;
  abfrage: Abfrage;
  stand: { offen: number; gesamt: number } | null;
  heute: string;
  onAlle: () => void;
  fertigBand?: FertigBand;
}) {
  const etikett = abfrageKartenEtikett(abfrage, heute);
  const alle = (
    <span className={styles.rechts}>
      <TextKnopf onClick={onAlle}>Alle Termine zeigen</TextKnopf>
    </span>
  );
  if (!fertigBand) {
    return (
      <div className={styles.band} role="note" aria-label="Abfrage">
        {etikett && <Etikett ton={etikett.ton}>{etikett.text}</Etikett>}
        <span className={styles.text}>{abfrageBandText({ gruppe, abfrage, stand })}</span>
        {alle}
      </div>
    );
  }
  const f = fertigBand;
  if (f.fertig === true)
    return (
      <div className={`${styles.band} ${styles.gruen}`} role="note" aria-label="Abfrage">
        <Etikett ton="gruen">fertig</Etikett>
        <span className={styles.text}>{ABFRAGE_FERTIG_TEXT}</span>
        {alle}
      </div>
    );
  return (
    <>
      <div className={styles.band} role="note" aria-label="Abfrage">
        {etikett && <Etikett ton={etikett.ton}>{etikett.text}</Etikett>}
        <span className={styles.text}>{abfrageBandTextAbwesend({ gruppe, abfrage })}</span>
        {f.fertig === false &&
          (f.erstSpeichern ? (
            <span className={styles.leise}>erst speichern</span>
          ) : (
            <KopfKnopf
              haupt={f.haupt}
              label={ABFRAGE_FERTIG_KNOPF}
              symbol={<Icon name="check" size={16} />}
              wortAmHandy
              disabled={f.arbeitet}
              onClick={f.onFertig}
            />
          ))}
        {alle}
      </div>
      {f.fehler && (
        <p className={styles.fehler} role="alert">
          {f.fehler}
        </p>
      )}
    </>
  );
}
