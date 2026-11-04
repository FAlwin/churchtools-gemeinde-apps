// Test-Hilfe: ChurchTools zum Anfassen für den Schreibkern (einteilen.test.ts), das Senden (senden.test.ts) und die
// eigenen Antworten (antworten.test.ts, E7) – eine Stelle statt mehrerer Kopien (15.10.2026).
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
 * Seit E7 (gemessen 03.11.2026): `accept` sagt zu (neue ID), `decline` mit Grund hängt ihn an den leeren Platz,
 * `undo` setzt zurück auf „angefragt“ – nach einer Zusage mit deren ID (die ID bleibt), nach einer Absage mit der
 * **ursprünglichen** ID (sie kommt zurück); sonst oder mit `undoZuSpaet` → 400. Mit `nurSichtbarFuer` liest man wie
 * jemand ohne Recht auf den Dienst.
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
    /** Die zehn Minuten fürs Rückgängig sind vorbei (400). */
    undoZuSpaet: false,
    /** Abgesagte Plätze, wie sie vor der Absage aussahen – für `undo` (Schlüssel: ihre alte ID). */
    abgesagt: new Map<number, RohPlatz>(),
    /**
     * Ohne Recht auf den Dienst (gemessen 03.11.2026 als Spike): Lesen zeigt nur die Plätze dieser Person – ein freier
     * Platz nach der eigenen Absage fehlt dann ganz. `null` = alles sichtbar (Admin, Planer).
     */
    nurSichtbarFuer: null as number | null,
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
        eventServices: ct.plaetze
          .filter((p) => ct.nurSichtbarFuer === null || p.personId === ct.nurSichtbarFuer)
          .map((p) => ({ ...p })),
      } as RohTermin);
    },
    schreibe(pfad, auftrag) {
      ct.dazwischen?.();
      ct.dazwischen = null;
      ct.geschrieben.push({ pfad, method: auftrag.method, json: auftrag.json });
      const tun = pfad.endsWith('/eventservices')
        ? // Anzahl der Plätze (E4-5-3, gemessen E0): mehr → neue freie Plätze; weniger → leere zuerst weg.
          () => {
            const j = auftrag.json as { services: { serviceId: number; count: number }[] };
            for (const { serviceId, count } of j.services) {
              const eigene = () => ct.plaetze.filter((p) => p.serviceId === serviceId);
              while (eigene().length < count) {
                ct.plaetze.push({
                  id: naechsteId++,
                  serviceId,
                  index: null,
                  personId: null,
                  name: null,
                });
              }
              for (const p of [...eigene()].reverse()) {
                if (eigene().length <= count) break;
                if (!p.name) ct.plaetze.splice(ct.plaetze.indexOf(p), 1);
              }
            }
          }
        : () => {
            const id = Number(/servicerequests\/(\d+)/.exec(pfad)![1]);
            if (pfad.endsWith('/accept')) ersetze(id, { isAccepted: true });
            else if (pfad.endsWith('/undo')) {
              const jetzt = ct.plaetze.findIndex((p) => p.id === id);
              const alt = ct.abgesagt.get(id);
              if (jetzt >= 0 && ct.plaetze[jetzt].isAccepted === true) {
                ct.plaetze[jetzt] = { ...ct.plaetze[jetzt], isAccepted: false };
              } else if (alt) {
                const i = ct.plaetze.findIndex(
                  (p) => p.serviceId === alt.serviceId && (p.index ?? null) === (alt.index ?? null),
                );
                ct.plaetze[i] = { ...alt, isAccepted: false };
                ct.abgesagt.delete(id);
              }
            } else if (pfad.endsWith('/decline')) {
              const vorher = ct.plaetze.find((p) => p.id === id);
              if (vorher) ct.abgesagt.set(id, { ...vorher });
              const grund = (auftrag.json as { comment?: string | null } | null)?.comment ?? null;
              ersetze(id, { personId: null, name: null, isAccepted: false, comment: grund });
            } else {
              const j = auftrag.json as {
                personId: number | null;
                name: string | null;
                isAccepted: boolean;
              };
              const name = j.name ?? (j.personId === null ? null : `Person ${j.personId}`);
              ersetze(id, { personId: j.personId, name, isAccepted: j.isAccepted });
            }
          };
      if (pfad.endsWith('/undo')) {
        const id = Number(/servicerequests\/(\d+)/.exec(pfad)![1]);
        const moeglich =
          ct.plaetze.some((p) => p.id === id && p.isAccepted === true) || ct.abgesagt.has(id);
        if (ct.undoZuSpaet || !moeglich) return Promise.reject(new Fehler(400));
      }
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
