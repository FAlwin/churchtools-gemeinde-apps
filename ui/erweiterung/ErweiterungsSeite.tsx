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
 */
export function ErweiterungsRahmen({ children }: { children?: ReactNode }) {
  return (
    <div className={styles.rolle}>
      <main className={styles.seite}>
        {children}
        <footer className={styles.fuss}>Version {import.meta.env.VITE_APP_VERSION ?? 'dev'}</footer>
      </main>
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
  onNochmal,
  children,
}: Props) {
  return (
    <ErweiterungsRahmen>
      <header className={styles.kopf}>
        <p className={styles.app}>
          {app}
          {zustand.art === 'fertig' && zustand.gemeinde && ` · ${zustand.gemeinde}`}
        </p>
        {zustand.art === 'fertig' && (
          <div className={styles.kopfzeile}>
            <div className={styles.gruss}>
              <h1>{zustand.vorname ? `Hallo ${zustand.vorname}` : 'Hallo'}</h1>
              {nebenGruss && <span>{nebenGruss}</span>}
            </div>
            {kopfAktion}
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
