import type { ReactNode } from 'react';
import type { Fehlermeldung } from '../ct/fehlerMeldung';
import styles from './ErweiterungsSeite.module.scss';

/** Was die Seite gerade zeigt – geladen wird in der App, der Rahmen zeigt nur an. */
export type SeitenZustand =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | { art: 'fertig'; vorname: string; gemeinde: string | null };

interface Props {
  /** Name der App im Kopf, z. B. „Dienstplaner“. */
  app: string;
  zustand: SeitenZustand;
  /** Kleiner Text neben dem Gruß (z. B. das Datum). */
  nebenGruss?: string;
  /** „Erneut versuchen“ – erscheint nur, wenn der Fehler vorübergehend ist (`fehlerMeldung`). */
  onNochmal: () => void;
  /** Der Inhalt – nur bei `fertig`. */
  children?: ReactNode;
}

/**
 * **Der Rahmen einer Erweiterung dieses Repos** (Dienstplaner E2): Kopf mit App- und Gemeindename,
 * „Hallo …“, „Wird geladen …“, der Fehlerkasten mit „Erneut versuchen“ und die Version im Fuß. Aufgebaut
 * wie die Startseite der Anmeldungen (#474), die nach #493 auf diesen Rahmen umzieht.
 */
export function ErweiterungsSeite({ app, zustand, nebenGruss, onNochmal, children }: Props) {
  return (
    <main className={styles.seite}>
      <header className={styles.kopf}>
        <p className={styles.app}>
          {app}
          {zustand.art === 'fertig' && zustand.gemeinde && ` · ${zustand.gemeinde}`}
        </p>
        {zustand.art === 'fertig' && (
          <div className={styles.gruss}>
            <h1>{zustand.vorname ? `Hallo ${zustand.vorname}` : 'Hallo'}</h1>
            {nebenGruss && <span>{nebenGruss}</span>}
          </div>
        )}
      </header>

      {zustand.art === 'laedt' && <p className={styles.hinweis}>Wird geladen …</p>}

      {zustand.art === 'fehler' && (
        <div className={styles.fehler} role="alert">
          <p>{zustand.fehler.text}</p>
          {zustand.fehler.nochmal && (
            <button type="button" className={styles.knopf} onClick={onNochmal}>
              Erneut versuchen
            </button>
          )}
        </div>
      )}

      {zustand.art === 'fertig' && children}

      <footer className={styles.fuss}>Version {import.meta.env.VITE_APP_VERSION ?? 'dev'}</footer>
    </main>
  );
}
