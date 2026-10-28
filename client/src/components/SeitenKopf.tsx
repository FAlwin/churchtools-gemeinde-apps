import type { ReactNode } from 'react';
import { KopfZurueck } from '@ui/bedienung/KopfKnopf';
import styles from './SeitenKopf.module.scss';

interface Props {
  titel: string;
  /** Steht statt der Überschrift oben (siehe `SeitenGeruest`); der Titel bleibt dann für Screenreader. */
  stattTitel?: ReactNode;
  /** Zweite Zeile unter dem Titel, z. B. Wochentag und Uhrzeit eines Ablaufs. */
  unterzeile?: string;
  /** Zurück – mit Ziel als Beschriftung („← Termine“). */
  zurueck?: () => void;
  zurueckLabel?: string;
  /** Knöpfe rechts (`KopfKnopf`: Teilen, Bearbeiten, Vollbild …). */
  aktionen?: ReactNode;
}

/**
 * **Der Seitenkopf** im ChurchTools-Stil (Scheibe S, 26.10.2026 – Entwurf „Seitenköpfe im ChurchTools-Look“).
 *
 * Detailansichten (Zurück oder eigene Aktionen) bekommen eine weiße Karte wie „Events › Ablaufpläne“: oben Zurück und
 * die Knöpfe, darunter Titel und Unterzeile. Übersichten haben Titel links und ihre Knöpfe rechts in einer Zeile; die
 * Seiten hinter einem Reiter (Termine, Lieder, Abwesenheiten, Mehr) zeigen dort statt des Titels ihren Wähler (`stattTitel`, 28.10.2026). Vorher schwebten runde Knöpfe über dem Inhalt (`KnopfReihe`) – Alwin: „wie eine iOS-App“.
 *
 * Der Kopf steht IM Inhalt und scrollt mit; `--inhalt-pad-top` hält ihn im Ruhezustand unter dem Unschärfe-Band, das
 * iOS 26/27 der installierten App oben überlegt (dort würde er milchig, siehe `client/index.html`).
 */
export function SeitenKopf({
  titel,
  stattTitel,
  unterzeile,
  zurueck,
  zurueckLabel,
  aktionen,
}: Props) {
  if (stattTitel) {
    return (
      <div className={styles.block}>
        <h1 className={styles.nurVorlesen}>{titel}</h1>
        <div className={`${styles.zeile} ${styles.zeileOben}`}>
          <div className={styles.stattTitel}>{stattTitel}</div>
          {aktionen && <div className={styles.knoepfe}>{aktionen}</div>}
        </div>
      </div>
    );
  }
  const ueberschrift = (
    <div className={styles.titelBlock}>
      <h1 className={styles.titel}>{titel}</h1>
      {unterzeile && <div className={styles.unterzeile}>{unterzeile}</div>}
    </div>
  );
  if (!zurueck) {
    return (
      <div className={styles.block}>
        <div className={styles.zeile}>
          {ueberschrift}
          {aktionen && <div className={styles.knoepfe}>{aktionen}</div>}
        </div>
      </div>
    );
  }
  return (
    <div className={styles.block}>
      <div className={styles.karte}>
        <div className={styles.zeile}>
          <KopfZurueck onClick={zurueck} ziel={zurueckLabel} />
          {aktionen && <div className={styles.knoepfe}>{aktionen}</div>}
        </div>
        {ueberschrift}
      </div>
    </div>
  );
}
