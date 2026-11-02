import { useCallback, useEffect, useRef, useState } from 'react';
import { uhrVersatz, type LiveGrund, type LiveStand } from '@shared/ct/liveAgenda';
import { ladeLive } from './ladeLive';

/** Wie oft nachgefragt wird – so oft wie die Live-Agenda von ChurchTools (gemessen 02.11.2026, Alwin: „wie CT“). */
export const TAKT_MS = 2500;
/** Wie oft die Uhr und die Restzeit weiterspringen. */
const UHR_MS = 1000;

/** Fehler, nach denen weiteres Nachfragen nichts bringt: abgemeldet, kein Recht, Antwort anders als gemessen. */
const ENDGUELTIG: readonly LiveGrund[] = ['abgemeldet', 'kein-recht', 'unlesbar'];

export interface LiveZustand {
  /** Der zuletzt gelesene Stand – bleibt bei einem Fehler stehen (vorübergehend ist nicht ungültig). */
  stand: LiveStand | null;
  /** Um wie viele ms die Uhr des Geräts der von ChurchTools vorausgeht (`uhrVersatz`). */
  versatz: number;
  /** Wann zuletzt erfolgreich gelesen wurde (Uhr des Geräts); `null` vor dem ersten Erfolg. */
  gelesenUm: number | null;
  /** Der letzte Fehler, `null` nach einem Erfolg. */
  fehler: LiveGrund | null;
  /** Jetzt, in der Uhr des Geräts – springt jede Sekunde. */
  jetzt: number;
  /**
   * Einen frisch geschriebenen und nachgelesenen Stand sofort zeigen (Steuern, L3) – nicht erst bei der nächsten
   * Abfrage. `empfangen` = wann die Antwort kam (Uhr des Geräts).
   */
  uebernehmen: (stand: LiveStand, empfangen: number) => void;
}

/**
 * **Den Live-Stand eines Termins verfolgen** (E6b-2 L2): sofort lesen, dann alle 2,5 s – die nächste Abfrage erst, wenn
 * die vorige zurück ist (keine Stapel bei langsamer Leitung). Nur solange die Seite sichtbar ist; wird sie wieder
 * sichtbar, wird sofort gelesen. Ein vorübergehender Fehler lässt den letzten Stand stehen und versucht es weiter;
 * nach „abgemeldet“, „kein Recht“ oder „unlesbar“ wird nicht mehr gefragt.
 */
export function useLive(
  eventId: number,
  agendaId: number,
  lesen: typeof ladeLive = ladeLive,
): LiveZustand {
  const [zustand, setZustand] = useState<Omit<LiveZustand, 'jetzt' | 'uebernehmen'>>({
    stand: null,
    versatz: 0,
    gelesenUm: null,
    fehler: null,
  });
  const [jetzt, setJetzt] = useState(() => Date.now());
  // Zählt jedes `uebernehmen`: Eine Abfrage, die davor losging, bringt einen älteren Stand – sie wird verworfen.
  const uebernommen = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => setJetzt(Date.now()), UHR_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let aus = false;
    let laeuft = false;
    // Nach einem endgültigen Fehler fragt auch das Wiederkehren auf die Seite nicht mehr nach.
    let beendet = false;
    let timer: number | undefined;

    // Verdeckt fragt `holen` selbst nicht – dort endet die Kette, beim Zurückkehren beginnt sie neu.
    const planen = () => {
      window.clearTimeout(timer);
      if (!aus) timer = window.setTimeout(() => void holen(), TAKT_MS);
    };

    async function holen(): Promise<void> {
      if (aus || beendet || laeuft || document.visibilityState === 'hidden') return;
      laeuft = true;
      const nr = uebernommen.current;
      const r = await lesen(eventId, agendaId);
      laeuft = false;
      if (aus) return;
      if (nr !== uebernommen.current) {
        planen();
        return;
      }
      const um = Date.now();
      if (r.ok) {
        setZustand({
          stand: r.stand,
          versatz: uhrVersatz(r.stand, um),
          gelesenUm: um,
          fehler: null,
        });
        setJetzt(um);
        planen();
        return;
      }
      setZustand((z) => ({ ...z, fehler: r.grund }));
      if (ENDGUELTIG.includes(r.grund)) beendet = true;
      else planen();
    }

    const sichtbar = () => {
      if (document.visibilityState !== 'hidden') void holen();
    };
    document.addEventListener('visibilitychange', sichtbar);
    void holen();
    return () => {
      aus = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', sichtbar);
    };
  }, [eventId, agendaId, lesen]);

  const uebernehmen = useCallback((stand: LiveStand, empfangen: number) => {
    uebernommen.current++;
    setZustand({
      stand,
      versatz: uhrVersatz(stand, empfangen),
      gelesenUm: empfangen,
      fehler: null,
    });
    setJetzt(empfangen);
  }, []);

  return { ...zustand, jetzt, uebernehmen };
}
