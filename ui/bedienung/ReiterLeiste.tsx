import type { ReactNode } from 'react';
import { Icon, type IconName } from '../icons/icons';
import { ReiterZaehler } from './ReiterZaehler';
import styles from './ReiterLeiste.module.scss';

export interface Reiter<T extends string> {
  id: T;
  label: string;
  icon: IconName;
  /** Eine Anzahl hinter dem Text, leiser gesetzt (Bereich „Anmeldungen“: „Warteliste 2“, U2-1). */
  zahl?: number;
  /**
   * **Roter Zähler** neben dem Text (Protokolle: fällige To-Dos). Mit `zaehlerName` als Name des Reiters für Vorleser
   * („To-Dos, 3 fällig“); 0 oder fehlend = kein Zähler.
   */
  zaehler?: number;
  zaehlerName?: string;
}

interface Props<T extends string> {
  reiter: Reiter<T>[];
  aktiv: T;
  /** Ausgegraute Reiter (z. B. Liedersammlung ohne Netz) – bleiben tippbar, der Aufrufer erklärt warum. */
  gedimmt?: T[];
  onWechsel: (id: T) => void;
  /** Tipp auf den schon aktiven Reiter – die Musik-App scrollt dann nach oben (wie in iOS-Apps). */
  onErneut?: () => void;
  /** Ziel der geführten Einführung (`data-tour`), falls die App eine hat. */
  tour?: string;
  /**
   * **Oben statt unten** (Musik-App am iPad, Scheibe S, 26.10.2026): Text mit blauer Unterstreichung wie die Reiter in
   * ChurchTools („Events“: Dienstplan · Abwesenheiten …), ohne Symbole. Am Handy bleibt die Leiste unten.
   */
  oben?: boolean;
  /**
   * **Die Leiste steht oben am Bildschirmrand** (nur mit `oben`): In der installierten App lässt sie Platz für die
   * Statusleiste samt Unschärfe-Band (`--reiter-oben-polster`). Reiter in einer Seite oder Karte (Anmeldungen) brauchen das nicht.
   */
  amRand?: boolean;
  /**
   * **Flach** (nur mit `oben`): ohne eigenen Hintergrund, Rand und Seitenabstand – die Zeile darum liefert den Rand
   * (Reiterzeile im Seitenkopf der Erweiterungen, `ErweiterungsSeite`, R4/E4 „Ruhige Bedienung“ B2).
   */
  flach?: boolean;
  /**
   * Etwas ganz rechts in der Zeile (nur mit `oben`): der Vollbild-Knopf der Musik-App („Vollbild rückt neben die Reiter“,
   * Entwurf B8). Die Lupe der Erweiterungen steht dagegen in der Reiterzeile der Seite (`ErweiterungsSeite`).
   */
  rechts?: ReactNode;
  /**
   * **App-Name klein über den Reitern** (nur mit `oben`, ohne `flach`; R8/E24 „Ruhige Bedienung“ B8c): Die Musik-App
   * zeichnet ihre Leiste selbst am Bildschirmrand – die Erweiterungen zeigen den Namen im Seitenkopf
   * (`ErweiterungsSeite`). Gleiche Schrift, damit jede App gleich beginnt. Am Handy (unten) gibt es keinen Namen.
   */
  appName?: string;
  /** Name für Vorleser – ohne „Bereiche“. Zweite Leiste auf einer Seite (Reiter in einer Karte) braucht einen eigenen. */
  name?: string;
}

/**
 * **Die Reiterleiste** im ChurchTools-Stil – eine für alle Apps (Dienstplaner E3; vorher nur `TabBar` der Musik-App,
 * die jetzt diese Leiste mit ihren Reitern füllt). Unten mit Symbol und Text (Handy), mit `oben` als Textreiter.
 */
export function ReiterLeiste<T extends string>({
  reiter,
  aktiv,
  gedimmt = [],
  onWechsel,
  onErneut,
  tour,
  oben = false,
  amRand = false,
  flach = false,
  rechts,
  appName,
  name = 'Bereiche',
}: Props<T>) {
  const mitName = oben && !flach && !!appName;
  const leiste = (
    <nav
      className={
        oben
          ? `${styles.oben}${amRand && !mitName ? ' ' + styles.rand : ''}${flach || mitName ? ' ' + styles.flach : ''}`
          : styles.tabbar
      }
      data-tour={tour}
      aria-label={name}
    >
      {reiter.map((r) => {
        const an = aktiv === r.id;
        const aus = gedimmt.includes(r.id);
        return (
          <button
            key={r.id}
            type="button"
            aria-pressed={an}
            className={`${styles.tab}${an ? ' ' + styles.on : ''}${aus ? ' ' + styles.off : ''}`}
            aria-label={r.zaehler ? r.zaehlerName : undefined}
            onClick={() => (an ? onErneut?.() : onWechsel(r.id))}
          >
            {!oben && <Icon name={r.icon} size={24} stroke={1.9} />}
            <span>
              {r.label}
              {r.zahl !== undefined && <span className={styles.zahl}> {r.zahl}</span>}
              {r.zaehler ? (
                <>
                  {' '}
                  <ReiterZaehler zahl={r.zaehler} />
                </>
              ) : null}
            </span>
          </button>
        );
      })}
      {oben && rechts ? <div className={styles.rechts}>{rechts}</div> : null}
    </nav>
  );
  if (!mitName) return leiste;
  return (
    <div className={`${styles.block}${amRand ? ' ' + styles.rand : ''}`}>
      <p className={styles.appName}>{appName}</p>
      {leiste}
    </div>
  );
}
