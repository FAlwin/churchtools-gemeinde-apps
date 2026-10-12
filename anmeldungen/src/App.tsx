import { useCallback, useEffect, useState } from 'react';
import { tagAusIso } from '@shared/ct/zeit';
import { ladeStart } from './start';
import { ladeUebersicht } from './veranstaltungen';
import { datumText } from './anzeige';
import { Startseite } from './Startseite';
import { fehlerZustand, type Zustand } from './zustand';
import styles from './App.module.scss';

/**
 * Die Anmeldungen in ChurchTools: Wer angemeldet ist, seine Gruppen (#474, A1) und deren
 * Veranstaltungen (#480, A2). Erst die Person und ihre Gruppen, dann die Veranstaltungen darunter –
 * scheitert eines davon vorübergehend, gibt es „Erneut versuchen“ statt einer halben Seite.
 */
export function App() {
  const [zustand, setZustand] = useState<Zustand>({ art: 'laedt' });
  const zeitzone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const heute = tagAusIso(new Date().toISOString(), zeitzone);

  const laden = useCallback(() => {
    setZustand({ art: 'laedt' });
    ladeStart()
      .then(async (start) => ({ start, uebersicht: await ladeUebersicht(start.gruppen) }))
      .then(
        ({ start, uebersicht }) => setZustand({ art: 'fertig', start, uebersicht }),
        (e: unknown) => setZustand(fehlerZustand(e)),
      );
  }, []);

  useEffect(laden, [laden]);

  return (
    <main className={styles.seite}>
      <header className={styles.kopf}>
        <p className={styles.app}>
          Anmeldungen
          {zustand.art === 'fertig' && zustand.start.gemeinde && ` · ${zustand.start.gemeinde}`}
        </p>
        {zustand.art === 'fertig' && (
          <div className={styles.gruss}>
            <h1>{zustand.start.vorname ? `Hallo ${zustand.start.vorname}` : 'Hallo'}</h1>
            <span>{datumText(heute)}</span>
          </div>
        )}
      </header>

      {zustand.art === 'laedt' && <p className={styles.hinweis}>Wird geladen …</p>}

      {zustand.art === 'fehler' && (
        <div className={styles.fehler} role="alert">
          <p>{zustand.text}</p>
          {zustand.nochmal && (
            <button type="button" className={styles.knopf} onClick={laden}>
              Erneut versuchen
            </button>
          )}
        </div>
      )}

      {zustand.art === 'fertig' && (
        <Startseite
          start={zustand.start}
          uebersicht={zustand.uebersicht}
          heute={heute}
          zeitzone={zeitzone}
        />
      )}

      <footer className={styles.fuss}>Version {import.meta.env.VITE_APP_VERSION ?? 'dev'}</footer>
    </main>
  );
}
