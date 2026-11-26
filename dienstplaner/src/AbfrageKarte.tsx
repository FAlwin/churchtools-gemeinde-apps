import { Etikett } from '@ui/bedienung/Etikett';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { Icon } from '@ui/icons/icons';
import {
  abfrageFrage,
  abfrageKartenEtikett,
  abfrageKartenText,
} from '@shared/dienstplan/abfrageStand';
import type { Karte } from './useAbfragen';
import styles from './AbfrageKarte.module.scss';

/**
 * **Die Karte „Wann kannst du im Februar und März?“ auf der Startseite** (R-3, Entwurf Schritt 4): Frage, Etikett (blau bis
 * zur Frist, rot danach), Text mit den offenen Terminen, schmaler Fortschrittsbalken und der Neben-Knopf „Jetzt eintragen“
 * (R1: keine zweite Hauptaktion; am Handy volle Breite). Die Zahlen kommen fertig aus `meinStand` – hier wird nur gezeigt.
 */
export function AbfrageKarte({
  karte,
  heute,
  onEintragen,
}: {
  karte: Karte;
  heute: string;
  onEintragen: () => void;
}) {
  const { abfrage, gruppe, stand } = karte;
  const art = karte.inhalt.verfuegbarkeit;
  const etikett = abfrageKartenEtikett(abfrage, heute);
  const fertig = Math.max(0, stand.gesamt - stand.offen);
  const anteil = stand.gesamt > 0 ? Math.round((fertig / stand.gesamt) * 100) : 0;
  const titel = `abfrage-${gruppe.id}`;
  return (
    <section className={styles.karte} aria-labelledby={titel}>
      <div className={styles.kopf}>
        <h2 id={titel}>{abfrageFrage(abfrage)}</h2>
        {etikett && <Etikett ton={etikett.ton}>{etikett.text}</Etikett>}
      </div>
      <div className={styles.rumpf}>
        <p className={styles.text}>
          {abfrageKartenText({ gruppe: gruppe.name, abfrage, stand, art })}
        </p>
        {/* Bei „Nur abwesend“ (V-4) gibt es keinen Fortschritt: Wer nicht abwesend ist, hat nichts getan – fertig ist man erst mit „Fertig“. */}
        {art === 'zusagen' && (
          <div
            className={`${styles.balken} ${etikett?.ton === 'rot' ? styles.rot : ''}`}
            role="progressbar"
            aria-label="Schon beantwortet"
            aria-valuemin={0}
            aria-valuemax={stand.gesamt}
            aria-valuenow={fertig}
          >
            <span style={{ width: `${anteil}%` }} />
          </div>
        )}
        <div className={styles.knoepfe}>
          <KopfKnopf
            onClick={onEintragen}
            label="Jetzt eintragen"
            symbol={<Icon name="chev-right" size={16} />}
            symbolHinten
            wortAmHandy
          />
        </div>
      </div>
    </section>
  );
}
