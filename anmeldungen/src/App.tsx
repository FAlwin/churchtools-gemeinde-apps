import { useCallback, useEffect, useState } from 'react';
import { ladeStart } from './start';
import { fehlerZustand, type Zustand } from './zustand';
import styles from './App.module.scss';

/**
 * Das Grundgerüst der Anmeldungen (#474, A1): Es zeigt, wer angemeldet ist und in welchen Gruppen –
 * mehr noch nicht. Die Veranstaltungsliste kommt in A2.
 */
export function App() {
  const [zustand, setZustand] = useState<Zustand>({ art: 'laedt' });

  const laden = useCallback(() => {
    setZustand({ art: 'laedt' });
    ladeStart().then(
      (start) => setZustand({ art: 'fertig', start }),
      (e: unknown) => setZustand(fehlerZustand(e)),
    );
  }, []);

  useEffect(laden, [laden]);

  return (
    <main className={styles.seite}>
      <header className={styles.kopf}>
        <h1 className={styles.titel}>Anmeldungen</h1>
        {zustand.art === 'fertig' && zustand.start.gemeinde && (
          <p className={styles.gemeinde}>{zustand.start.gemeinde}</p>
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
        <>
          <p className={styles.gruss}>
            {zustand.start.vorname ? `Hallo, ${zustand.start.vorname}!` : 'Hallo!'}
          </p>
          <section className={styles.abschnitt} aria-labelledby="deine-gruppen">
            <h2 id="deine-gruppen" className={styles.ueberschrift}>
              Deine Gruppen
            </h2>
            {zustand.start.gruppen.length === 0 ? (
              <p className={styles.hinweis}>
                Du bist in keiner Gruppe. Veranstaltungen gehören immer zu einer Gruppe – frag die
                Verantwortlichen deiner Gemeinde, wenn du Anmeldungen anlegen möchtest.
              </p>
            ) : (
              <ul className={styles.liste}>
                {zustand.start.gruppen.map((g) => (
                  <li key={g.id} className={styles.gruppe}>
                    <span>{g.name}</span>
                    <span className={g.leitung ? styles.chipLeitung : styles.chip}>
                      {g.leitung ? 'Leitung' : 'Mitglied'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className={styles.hinweis}>
            Hier entstehen die Anmeldungen deiner Gruppen. Noch ist das nur das Grundgerüst.
          </p>
        </>
      )}

      <footer className={styles.fuss}>Version {import.meta.env.VITE_APP_VERSION ?? 'dev'}</footer>
    </main>
  );
}
