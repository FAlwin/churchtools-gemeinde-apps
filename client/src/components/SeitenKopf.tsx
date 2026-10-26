import type { ReactNode } from 'react';
import { KopfZurueck } from '@ui/bedienung/KopfKnopf';
import styles from './SeitenKopf.module.scss';

interface Props {
  titel: string;
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
 * die Knöpfe, darunter Titel und Unterzeile. Übersichten (Termine, Lieder …) haben Titel links und ihre Knöpfe rechts
 * in einer Zeile. Vorher schwebten runde Knöpfe über dem Inhalt (`KnopfReihe`) – Alwin: „wie eine iOS-App“.
 *
 * Der Kopf steht IM Inhalt und scrollt mit; `--inhalt-pad-top` hält ihn im Ruhezustand unter dem Unschärfe-Band, das
 * iOS 26/27 der installierten App oben überlegt (dort würde er milchig, siehe `client/index.html`).
 */
export function SeitenKopf({ titel, unterzeile, zurueck, zurueckLabel, aktionen }: Props) {
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
