// Test-Hilfe: ChurchTools zum Anfassen für den Schreibkern (einteilen.test.ts) und das Senden (senden.test.ts) –
// eine Stelle statt zweier Kopien (15.10.2026).
import type { DienstPort } from './einteilen';
import type { RohPlatz, RohTermin } from './termine';

/** Ein Fehler mit HTTP-Status, wie ihn der Port wirft; `null` = keine Antwort. */
export class Fehler extends Error {
  constructor(readonly status: number | null) {
    super(`HTTP ${status}`);
  }
}

/**
 * ChurchTools zum Anfassen, wie in E0/E4-0 gemessen: jedes Schreiben vergibt eine **neue ID**, Schreiben
 * auf eine veraltete ID meldet trotzdem Erfolg und ändert **nichts**, `decline` leert den Platz.
 */
export function nachbau(plaetze: RohPlatz[]) {
  let naechsteId = 900;
  const ct = {
    plaetze: plaetze.map((p) => ({ ...p })),
    geschrieben: [] as { pfad: string; method: string; json: unknown }[],
    lesenFehler: [] as (number | null)[],
    /** `undefined` = Schreiben klappt; `null` = keine Antwort (Netz, Zeitüberschreitung). */
    schreibenFehler: undefined as number | null | undefined,
    /** Schreibt ChurchTools trotz Fehler (Antwort ging verloren)? */
    trotzdemSchreiben: false,
    /** Ein anderer Planer schreibt zwischen Lesen und Schreiben. */
    dazwischen: null as null | (() => void),
  };
  const ersetze = (alteId: number, neu: Partial<RohPlatz>) => {
    const i = ct.plaetze.findIndex((p) => p.id === alteId);
    if (i < 0) return; // veraltete ID: 200, aber nichts passiert
    ct.plaetze[i] = { ...ct.plaetze[i], ...neu, id: naechsteId++ };
  };
  const port: DienstPort = {
    termin(eventId) {
      const f = ct.lesenFehler.shift();
      if (f !== undefined) return Promise.reject(new Fehler(f));
      return Promise.resolve({
        id: eventId,
        name: 'Gottesdienst',
        startDate: '2026-10-18T08:00:00Z',
        endDate: '2026-10-18T09:30:00Z',
        eventServices: ct.plaetze.map((p) => ({ ...p })),
      } as RohTermin);
    },
    schreibe(pfad, auftrag) {
      ct.dazwischen?.();
      ct.dazwischen = null;
      ct.geschrieben.push({ pfad, method: auftrag.method, json: auftrag.json });
      const id = Number(/servicerequests\/(\d+)/.exec(pfad)![1]);
      const tun = () => {
        if (pfad.endsWith('/decline'))
          ersetze(id, { personId: null, name: null, isAccepted: false });
        else {
          const j = auftrag.json as {
            personId: number | null;
            name: string | null;
            isAccepted: boolean;
          };
          const name = j.name ?? (j.personId === null ? null : `Person ${j.personId}`);
          ersetze(id, { personId: j.personId, name, isAccepted: j.isAccepted });
        }
      };
      if (ct.schreibenFehler !== undefined) {
        if (ct.trotzdemSchreiben) tun();
        return Promise.reject(new Fehler(ct.schreibenFehler));
      }
      tun();
      return Promise.resolve();
    },
    status: (e) => (e instanceof Fehler ? e.status : null),
  };
  return { ct, port };
}
