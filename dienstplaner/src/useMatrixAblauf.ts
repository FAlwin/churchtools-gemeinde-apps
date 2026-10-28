import { useCallback, useEffect, useRef, useState } from 'react';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import type { CtAgenda } from '@shared/ct/typen';
import { ladeAblauf, ladeMusikApp } from './ladeBeiwerk';
import type { Start } from './start';

/** Der Ablauf eines Termins in der Matrix: wird geladen, ließ sich nicht laden, oder steht da (`null` = keiner). */
export type AblaufZustand =
  | { art: 'laedt' }
  | { art: 'fehler'; text: string }
  | { art: 'fertig'; ablauf: CtAgenda | null };

/** Was Matrix und Handy-Ansicht über die Abläufe brauchen – aus `useMatrixAblauf`. */
export interface MatrixAblauf {
  start: Start;
  zeitzone: string;
  /** Adresse der Musik-App für die Lied-Ansicht (`undefined` = noch unbekannt, `null` = nicht installiert). */
  musikApp: string | null | undefined;
  zustand: (terminId: number) => AblaufZustand | undefined;
  /** Die Abläufe dieser Termine laden – nur, was noch nicht angefragt ist. */
  laden: (terminIds: number[]) => void;
  /** Einen Termin erneut laden (nach einem Fehler). */
  nochmal: (terminId: number) => void;
  /** Einen neu gelesenen Ablauf übernehmen (nach dem Speichern). */
  setzen: (terminId: number, ablauf: CtAgenda | null) => void;
  bearbeiten: boolean;
  setBearbeiten: (an: boolean) => void;
  zu: boolean;
  setZu: (zu: boolean) => void;
}

/**
 * Die Abläufe der gezeigten Termine – je Termin eine Abfrage (wie die Termin-Ansicht), nur für die Spalten, die gerade
 * zu sehen sind; schon geladene bleiben beim Blättern stehen. Ohne `anschluss` (Tests der Matrix ohne Ablauf) `null`.
 */
export function useMatrixAblauf(
  anschluss: { start: Start; zeitzone: string } | undefined,
  zu: boolean,
  setZu: (zu: boolean) => void,
): MatrixAblauf | null {
  const [ablaeufe, setAblaeufe] = useState<Map<number, AblaufZustand>>(new Map());
  const [bearbeiten, setBearbeiten] = useState(false);
  const [musikApp, setMusikApp] = useState<string | null | undefined>(undefined);
  // Was schon angefragt ist – als Ref, damit zwei Aufrufe im selben Durchgang nicht doppelt laden.
  const angefragt = useRef(new Set<number>());
  const aktiv = anschluss !== undefined;

  const laden = useCallback((ids: number[]) => {
    const neu = ids.filter((id) => !angefragt.current.has(id));
    if (neu.length === 0) return;
    for (const id of neu) angefragt.current.add(id);
    setAblaeufe((alt) => {
      const m = new Map(alt);
      for (const id of neu) m.set(id, { art: 'laedt' });
      return m;
    });
    for (const id of neu) {
      ladeAblauf(id).then(
        (ablauf) => setAblaeufe((alt) => new Map(alt).set(id, { art: 'fertig', ablauf })),
        (e: unknown) => {
          // Nicht als geladen merken – ein vorübergehender Fehler darf nichts endgültig machen („Erneut versuchen“).
          angefragt.current.delete(id);
          setAblaeufe((alt) =>
            new Map(alt).set(id, { art: 'fehler', text: fehlerMeldung(e).text }),
          );
        },
      );
    }
  }, []);

  // Beiwerk wie in der Termin-Ansicht: scheitert es, sagt die Lied-Ansicht nur, dass die Musik-App fehlt.
  useEffect(() => {
    if (!aktiv) return;
    let aktuell = true;
    ladeMusikApp().then(
      (url) => aktuell && setMusikApp(url),
      () => {},
    );
    return () => {
      aktuell = false;
    };
  }, [aktiv]);

  if (!anschluss) return null;
  return {
    ...anschluss,
    musikApp,
    zustand: (id) => ablaeufe.get(id),
    laden,
    nochmal: (id) => laden([id]),
    setzen: (id, ablauf) => setAblaeufe((alt) => new Map(alt).set(id, { art: 'fertig', ablauf })),
    bearbeiten,
    setBearbeiten,
    zu,
    setZu,
  };
}
