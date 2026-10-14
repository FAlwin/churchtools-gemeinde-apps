import { useEffect, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { kandidatenAus, kandidatHinweis, type Kandidat } from '@shared/dienstplan/werKann';
import { ladeWerKann } from './ladeWerKann';
import styles from './WerKann.module.scss';

/** Welcher freie Platz – alles, was das Fach zum Laden und für die Überschrift braucht. */
export interface FreierPlatz {
  eventId: number;
  serviceId: number;
  dienst: string;
  termin: string;
  /** z. B. „So 08.11.“ */
  tag: string;
  uhrzeit: string;
  /** `JJJJ-MM` – für „N× im Monat“. */
  monat: string;
  monatName: string;
  /** Platz 1 … n dieses Dienstes an diesem Termin. */
  nr: number;
  von: number;
  /** Wer an diesem Dienst schon eingeteilt ist – steht nicht in der Liste. */
  schonDa: number[];
}

type Zustand =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | { art: 'fertig'; liste: Kandidat[] };

/** Ab so vielen Kandidaten gibt es ein Suchfeld (wie im Entwurf). */
const SUCHE_AB = 7;

/**
 * **Das Fach „Wer kann?“** (Bauplan E4-2, Entwurf v17): die Kandidaten für einen freien Platz, „frei und
 * selten dran“ zuerst, mit Abwesenheit, Diensten am selben Tag und Einsätzen im Monat. **Nur ansehen** –
 * Einteilen kommt mit E4-3. Frühere Absagen stehen bewusst nicht da (siehe `werKann.ts`).
 */
export function WerKann({ platz, onClose }: { platz: FreierPlatz; onClose: () => void }) {
  const [zustand, setZustand] = useState<Zustand>({ art: 'laedt' });
  const [versuch, setVersuch] = useState(0);
  const [suche, setSuche] = useState('');

  useEffect(() => {
    let aktuell = true;
    setZustand({ art: 'laedt' });
    ladeWerKann(platz.eventId, platz.serviceId).then(
      (roh) => {
        if (!aktuell) return;
        const liste = kandidatenAus(roh, { monat: platz.monat, schonDa: new Set(platz.schonDa) });
        setZustand({ art: 'fertig', liste });
      },
      (e: unknown) => aktuell && setZustand({ art: 'fehler', fehler: fehlerMeldung(e) }),
    );
    return () => {
      aktuell = false;
    };
  }, [platz.eventId, platz.serviceId, platz.monat, platz.schonDa, versuch]);

  const q = suche.trim().toLowerCase();
  return (
    <Sheet title={`${platz.dienst} · ${platz.tag}`} onClose={onClose} cancelLabel="Schließen">
      <p className={styles.unter}>
        {platz.termin} um {platz.uhrzeit} Uhr · Platz {platz.nr} von {platz.von}
      </p>
      {zustand.art === 'laedt' && <p className={styles.hinweis}>„Wer kann?“ wird geladen …</p>}
      {zustand.art === 'fehler' && (
        <FehlerKasten fehler={zustand.fehler} onNochmal={() => setVersuch((v) => v + 1)} />
      )}
      {zustand.art === 'fertig' && (
        <>
          {zustand.liste.length >= SUCHE_AB && (
            <input
              className={styles.suche}
              type="search"
              placeholder="Name suchen"
              aria-label="Name suchen"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              autoComplete="off"
            />
          )}
          <h3 className={styles.titel}>Wer kann? Oben: frei und selten dran</h3>
          {zustand.liste.length === 0 ? (
            <p className={styles.hinweis}>
              Für diesen Dienst schlägt ChurchTools niemanden vor – in der ChurchTools-Gruppe des
              Dienstes ist sonst niemand.
            </p>
          ) : (
            <ul className={styles.liste} aria-label="Wer kann?">
              {zustand.liste
                .filter((k) => q === '' || k.name.toLowerCase().includes(q))
                .map((k) => {
                  const h = kandidatHinweis(k);
                  return (
                    <li
                      key={k.personId}
                      className={`${styles.kandidat}${k.abwesend ? ' ' + styles.blass : ''}`}
                    >
                      <span className={styles.wer}>
                        <b>{k.name}</b>
                        <small className={h.warnung ? styles.warnung : undefined}>{h.text}</small>
                      </span>
                      <span className={styles.anzahl}>
                        {k.imMonat}× im {platz.monatName}
                      </span>
                    </li>
                  );
                })}
            </ul>
          )}
          <p className={styles.hinweis}>Einteilen kommt als Nächstes – vorerst nur zum Ansehen.</p>
        </>
      )}
    </Sheet>
  );
}
