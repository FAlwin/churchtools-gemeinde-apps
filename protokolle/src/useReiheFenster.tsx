import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { heuteImKalender } from '@shared/ct/zeit';
import { neueThemenreihe, neueZeile, type Themenreihe } from '@shared/protokolle/themenreihe';
import type { MitarbeitOrt } from './mitarbeitWerte';
import { ReiheBearbeitenFenster } from './ReiheBearbeitenFenster';
import { ReiheUebertragenFenster } from './ReiheUebertragenFenster';
import { ladeThemenreihen } from './themenreiheSchreiben';

/** Eine Gruppe zur Wahl bei „Neue Reihe“ aus dem Reiter. */
export interface ReiheGruppeWahl {
  id: number;
  name: string;
}

export type ReiheFensterArt =
  | {
      art: 'bearbeiten';
      reihe: Themenreihe;
      gruppe: number;
      neu: boolean;
      fertig?: (id: string) => void;
      /** Nur bei „Neue Reihe“ aus dem Reiter: die Gruppen, unter denen man wählen kann. */
      gruppenwahl?: readonly ReiheGruppeWahl[];
    }
  | { art: 'uebertragen'; reihe: Themenreihe; gruppe: number };

export interface ReiheFensterEingabe {
  /** Wo die Reihen dieser Gruppe liegen („Mitarbeit“) – `null`: die Gruppe hat keine. Stabil halten (`useCallback`). */
  ortVon: (gruppe: number) => MitarbeitOrt | null;
  /** Der Stand im Speicher des Bildschirms – wenn das frische Lesen scheitert, geht es damit weiter. */
  bekannt: (id: string) => Themenreihe | undefined;
  /** Das frische Lesen hat die Reihen der Gruppe geliefert: der Bildschirm ersetzt seinen Stand (und verwirft `lokal`). */
  onFrisch: (gruppe: number, liste: readonly Themenreihe[]) => void;
  /** Gerade gespeichert – gilt sofort, ohne neu zu lesen. */
  onGespeichert: (r: Themenreihe) => void;
  ich: { person: number } | null;
  /** Kalender mit „edit events“ (`null` = alle) – für „In Events übertragen“. */
  eventKalender: readonly number[] | null;
}

export interface ReiheFensterSteuerung {
  /** Öffnet „Reihe“ mit der **frisch gelesenen** Reihe. */
  bearbeiten: (reihe: { id: string; gruppe: number }) => void;
  /** Öffnet „In Events übertragen“ mit der **frisch gelesenen** Reihe. */
  uebertragen: (reihe: { id: string; gruppe: number }) => void;
  /**
   * Eine neue Reihe: das Fenster geht mit einer schon vergebenen ID auf (ein zweiter Versuch legt nichts doppelt an). Mit
   * `gruppenwahl` (mehr als eine Gruppe, nur im Reiter) gibt es im Fenster das Feld „Gruppe“.
   */
  neu: (a: {
    gruppe: number;
    fertig?: (id: string) => void;
    gruppenwahl?: readonly ReiheGruppeWahl[];
  }) => void;
  /** Die offenen Fenster – an beliebiger Stelle im Baum rendern. */
  fenster: ReactNode;
}

/**
 * **Die Fenster der Reihe – EINE Stelle** für den Anbieter im Protokoll (`ReiheAnbieter`) und den Reiter „Reihen“: das Fenster
 * „Reihe“ (Bearbeiten/Neu, mit den Mitgliedern der Gruppe für „Wer“) und „In Events übertragen“.
 *
 * **Beide Fenster gehen mit der frisch gelesenen Reihe auf:** Der Stand im Speicher des Bildschirms kann veraltet sein (jemand
 * anderes hat gespeichert) – „Bitte öffne sie neu“ führte sonst wieder zum selben alten Stand. Scheitert das Lesen, geht es
 * mit dem bekannten Stand weiter (vorübergehend ist nicht ungültig); gespeichert wird ohnehin nur gegen den frisch gelesenen
 * (`themenreiheSpeichern`).
 */
export function useReiheFenster(p: ReiheFensterEingabe): ReiheFensterSteuerung {
  const { ortVon, bekannt, onFrisch, onGespeichert, ich, eventKalender } = p;
  const [fenster, setFenster] = useState<ReiheFensterArt | null>(null);

  const frisch = useCallback(
    async (id: string, gruppe: number): Promise<Themenreihe | undefined> => {
      try {
        const ort = ortVon(gruppe);
        if (!ort) return undefined;
        const liste = await ladeThemenreihen(ort);
        onFrisch(gruppe, liste);
        return liste.find((r) => r.id === id);
      } catch {
        return bekannt(id);
      }
    },
    [ortVon, onFrisch, bekannt],
  );

  // Stabil: das Fenster „In Events übertragen“ liest neu, sobald sich `rechte` ändert.
  const rechte = useMemo(
    () => ({ kalender: eventKalender, ich: ich?.person ?? null }),
    [eventKalender, ich],
  );

  // Das Speichern liest das Fenster, das gerade offen ist – nicht das beim Rendern des Aufrufers.
  const fensterRef = useRef(fenster);
  fensterRef.current = fenster;

  const bearbeiten = useCallback(
    (r: { id: string; gruppe: number }) =>
      void frisch(r.id, r.gruppe).then(
        (x) => x && setFenster({ art: 'bearbeiten', reihe: x, gruppe: r.gruppe, neu: false }),
      ),
    [frisch],
  );
  const uebertragen = useCallback(
    (r: { id: string; gruppe: number }) =>
      void frisch(r.id, r.gruppe).then(
        (x) => x && setFenster({ art: 'uebertragen', reihe: x, gruppe: r.gruppe }),
      ),
    [frisch],
  );
  const neu = useCallback(
    (a: {
      gruppe: number;
      fertig?: (id: string) => void;
      gruppenwahl?: readonly ReiheGruppeWahl[];
    }) => {
      if (!ich) return;
      setFenster({
        art: 'bearbeiten',
        neu: true,
        gruppe: a.gruppe,
        fertig: a.fertig,
        gruppenwahl: a.gruppenwahl,
        reihe: neueThemenreihe({
          id: crypto.randomUUID(),
          gruppe: a.gruppe,
          name: '',
          zeilen: [neueZeile(crypto.randomUUID(), heuteImKalender())],
          von: ich.person,
          am: new Date().toISOString(),
        }),
      });
    },
    [ich],
  );

  const gespeichert = (r: Themenreihe) => {
    onGespeichert(r);
    const f = fensterRef.current;
    setFenster(null);
    if (f?.art === 'bearbeiten' && f.neu) f.fertig?.(r.id);
  };

  return {
    bearbeiten,
    uebertragen,
    neu,
    fenster: (
      <>
        {ich && fenster?.art === 'bearbeiten' && (
          <ReiheBearbeitenFenster
            // Ein anderes Fenster ist ein neuer Zustand (gewählte Gruppe, Sperre) – nie vom vorigen erben.
            key={fenster.reihe.id}
            f={fenster}
            ortVon={ortVon}
            ich={ich}
            onGespeichert={gespeichert}
            onClose={() => setFenster(null)}
          />
        )}
        {ich && fenster?.art === 'uebertragen' && (
          <ReiheUebertragenFenster
            reihe={fenster.reihe}
            rechte={rechte}
            onClose={() => setFenster(null)}
          />
        )}
      </>
    ),
  };
}
