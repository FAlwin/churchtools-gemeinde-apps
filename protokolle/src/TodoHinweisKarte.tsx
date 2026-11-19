import { useCallback, useEffect, useState } from 'react';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { STANDARD_VORLAUF, VORLAUF_WAHL, type Vorlauf } from '@shared/protokolle/hinweis';
import { ladeVorlauf, vorlaufSpeichern } from './todoHinweis';
import styles from './Verwaltung.module.scss';

type Zustand =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | { art: 'fertig'; vorlauf: Vorlauf };

/**
 * **Karte „Hinweis auf fällige To-Dos“ in der Verwaltung** (nur Admins, gemeindeweit): ab wann ein To-Do „bald fällig“
 * ist – oder gar kein Hinweis. Wirkt auf das Band der Startseite und den roten Zähler am Reiter „To-Dos“ bei allen. Die
 * Wahl wird sofort gespeichert und nachgelesen; scheitert das, bleibt die alte Wahl stehen und der Fehler steht da.
 * Lesen scheitert → „Erneut versuchen“ (die Karte zeigt nie einen Standard, der gar nicht eingestellt ist).
 */
export function TodoHinweisKarte({
  modul,
  onHinweis,
  onVorlauf,
}: {
  modul: number;
  onHinweis: (text: string) => void;
  onVorlauf?: (v: Vorlauf) => void;
}) {
  const [zustand, setZustand] = useState<Zustand>({ art: 'laedt' });
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);

  const laden = useCallback(() => {
    setZustand({ art: 'laedt' });
    ladeVorlauf(modul).then(
      (vorlauf) => setZustand({ art: 'fertig', vorlauf }),
      (e: unknown) => setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
  }, [modul]);

  useEffect(laden, [laden]);

  const waehlen = (text: string) => {
    const neu = VORLAUF_WAHL.find((v) => String(v.wert) === text)?.wert;
    if (neu === undefined || zustand.art !== 'fertig' || neu === zustand.vorlauf) return;
    setFehler(null);
    setLaeuft(true);
    vorlaufSpeichern(modul, neu)
      .then(
        () => {
          setZustand({ art: 'fertig', vorlauf: neu });
          onVorlauf?.(neu);
          onHinweis('Hinweis gespeichert');
        },
        (e: unknown) => setFehler(fehlerMeldung(e)),
      )
      .finally(() => setLaeuft(false));
  };

  return (
    <section className={styles.karte} aria-labelledby="hinweis-titel">
      <div className={styles.kopf}>
        <h2 id="hinweis-titel">Hinweis auf fällige To-Dos</h2>
      </div>
      <p className={styles.erklaerung}>
        Gemeindeweit: Wer ein überfälliges oder bald fälliges To-Do hat, sieht beim Öffnen ein Band
        auf der Startseite und eine rote Zahl am Reiter „To-Dos“. Standard:{' '}
        {VORLAUF_WAHL.find((v) => v.wert === STANDARD_VORLAUF)?.text.toLowerCase()}.
      </p>
      {zustand.art === 'laedt' && <p className={styles.innen}>Wird geladen …</p>}
      {zustand.art === 'fehler' && (
        <div className={styles.innen}>
          <FehlerKasten fehler={zustand.fehler} onNochmal={laden} />
        </div>
      )}
      {zustand.art === 'fertig' && (
        <div className={styles.innen}>
          <label className={styles.feldTitel} htmlFor="todo-hinweis">
            Wann weist ein To-Do hin?
          </label>
          <select
            id="todo-hinweis"
            className={styles.auswahl}
            value={String(zustand.vorlauf)}
            disabled={laeuft}
            onChange={(e) => waehlen(e.target.value)}
          >
            {VORLAUF_WAHL.map((v) => (
              <option key={String(v.wert)} value={String(v.wert)}>
                {v.text}
              </option>
            ))}
          </select>
          {fehler && (
            <p className={styles.fehlerText} role="alert">
              {fehler.text}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
