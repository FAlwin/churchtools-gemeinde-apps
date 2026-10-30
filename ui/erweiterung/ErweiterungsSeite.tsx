import type { ReactNode } from 'react';
import type { Fehlermeldung } from '../ct/fehlerMeldung';
import styles from './ErweiterungsSeite.module.scss';

/** Was die Seite gerade zeigt – geladen wird in der App, der Rahmen zeigt nur an. */
export type SeitenZustand =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | { art: 'fertig'; vorname: string; gemeinde: string | null };

/**
 * **Der äußere Rahmen jeder Erweiterungsseite** (Dienstplaner E2, Anmeldungen): Breite, Abstände und die
 * Version im Fuß. Ohne Kopf – für Unterseiten wie eine einzelne Veranstaltung der Anmeldungen.
 *
 * Gescrollt wird im Rollbereich (`.rolle`), nicht in `#root` – siehe ErweiterungsSeite.module.scss.
 * `unten` (z. B. die Reiterleiste am Handy, Dienstplaner E3) steht UNTER dem Rollbereich und scrollt
 * nicht mit – ohne `position: fixed`, das in der Erweiterung am `#root` hinge.
 */
export function ErweiterungsRahmen({
  children,
  unten,
}: {
  children?: ReactNode;
  unten?: ReactNode;
}) {
  const rolle = (
    <div className={styles.rolle}>
      <main className={styles.seite}>
        {children}
        <footer className={styles.fuss}>Version {import.meta.env.VITE_APP_VERSION ?? 'dev'}</footer>
      </main>
    </div>
  );
  // Die Fläche über der Leiste ist der Bezug für Schwebendes (`SchwebePlus`, E6-3a): Es steht dann über der Leiste
  // statt dahinter – und scrollt nicht mit, weil sein Bezug außerhalb des Rollbereichs liegt.
  //
  // **Immer derselbe Aufbau, mit und ohne Leiste** (E6b-1, 30.10.2026): Vorher gab es ohne `unten` nur den Rollbereich,
  // mit `unten` zwei Hüllen mehr. Wechselte die Breite über die Handy-Grenze (Handy quer drehen), baute React deshalb die
  // ganze Seite neu – offene Fenster, „Ablauf zeigen“ und Bearbeiten gingen zu. Jetzt unterscheidet nur eine Klasse.
  return (
    <div className={`${styles.huelle}${unten ? ` ${styles.mitUnten}` : ''}`}>
      <div className={styles.flaeche}>{rolle}</div>
      {unten}
    </div>
  );
}

/**
 * **Der Fehlerkasten**: was `fehlerMeldung` sagt, und „Erneut versuchen“ nur, wenn es vorübergehend ist.
 * Eine Stelle für alle Seiten, damit kein Kasten den Knopf auch beim Abmelden anbietet.
 */
export function FehlerKasten({
  fehler,
  onNochmal,
}: {
  fehler: Fehlermeldung;
  onNochmal: () => void;
}) {
  return (
    <div className={styles.fehler} role="alert">
      <p>{fehler.text}</p>
      {fehler.nochmal && (
        <button type="button" className={styles.knopf} onClick={onNochmal}>
          Erneut versuchen
        </button>
      )}
    </div>
  );
}

interface Props {
  /** Name der App im Kopf, z. B. „Dienstplaner“. */
  app: string;
  zustand: SeitenZustand;
  /** Kleiner Text neben dem Gruß (z. B. das Datum). */
  nebenGruss?: string;
  /** Rechts neben dem Gruß, z. B. „Neue Veranstaltung“ – nur bei `fertig`. */
  kopfAktion?: ReactNode;
  /** Ein Hinweis unter dem Kopf in ruhiger Schrift (z. B. „Gruppenart fehlt“) – nur bei `fertig`. */
  hinweis?: ReactNode;
  /** Neben dem App-Namen, z. B. die Reiter am Computer (Dienstplaner E3). */
  reiter?: ReactNode;
  /** „Hallo …“ zeigen? Mit Reitern nur auf der Startseite (Entwurf v17). Vorgabe: ja. */
  gruss?: boolean;
  /** Unter dem Rollbereich, z. B. die Reiterleiste am Handy (siehe `ErweiterungsRahmen`). */
  unten?: ReactNode;
  /** „Erneut versuchen“ – erscheint nur, wenn der Fehler vorübergehend ist (`fehlerMeldung`). */
  onNochmal: () => void;
  /** Der Inhalt – nur bei `fertig`. */
  children?: ReactNode;
}

/**
 * **Die Startseite einer Erweiterung dieses Repos** (Dienstplaner E2, Anmeldungen): Kopf mit App- und
 * Gemeindename, „Hallo …“, „Wird geladen …“, der Fehlerkasten und die Version im Fuß.
 */
export function ErweiterungsSeite({
  app,
  zustand,
  nebenGruss,
  kopfAktion,
  hinweis,
  reiter,
  gruss = true,
  unten,
  onNochmal,
  children,
}: Props) {
  const appName = (
    <p className={styles.app}>
      {app}
      {zustand.art === 'fertig' && zustand.gemeinde && ` · ${zustand.gemeinde}`}
    </p>
  );
  return (
    <ErweiterungsRahmen unten={unten}>
      <header className={styles.kopf}>
        {reiter ? (
          <div className={styles.appzeile}>
            {appName}
            {reiter}
          </div>
        ) : (
          appName
        )}
        {zustand.art === 'fertig' && gruss && (
          <div className={styles.kopfzeile}>
            <div className={styles.gruss}>
              <h1>{zustand.vorname ? `Hallo ${zustand.vorname}` : 'Hallo'}</h1>
              {nebenGruss && <span>{nebenGruss}</span>}
            </div>
            {/* Mehrere Knöpfe bleiben zusammen rechts – sonst verteilt `space-between` sie über die Zeile. */}
            {kopfAktion && <div className={styles.aktionen}>{kopfAktion}</div>}
          </div>
        )}
      </header>

      {zustand.art === 'fertig' && hinweis && <p className={styles.hinweis}>{hinweis}</p>}

      {zustand.art === 'laedt' && <p className={styles.hinweis}>Wird geladen …</p>}

      {zustand.art === 'fehler' && <FehlerKasten fehler={zustand.fehler} onNochmal={onNochmal} />}

      {zustand.art === 'fertig' && children}
    </ErweiterungsRahmen>
  );
}
