/**
 * **Eigene Anfragen beantworten** (Bauplan E7-1, Entwurf `e7-anfragen.html` Variante A, Alwin 03.11.2026): zusagen,
 * absagen (mit optionalem Grund), rückgängig. Dieselben Regeln wie beim Einteilen (`platzAendern`): der Platz über
 * Termin + Dienst + `index`, frisch gelesen; steht nicht mehr da, was man gesehen hat, wird nichts geschrieben
 * (`konflikt`); erst was danach am Platz steht, zählt.
 *
 * Gemessen 03.11.2026 als Spike (kein Admin, `docs/messung-e7.md`):
 * - Zusagen: `POST /events/{e}/servicerequests/{platz}/accept` → **neue ID**. Einen Kommentar speichert ChurchTools nur
 *   bei Diensten mit `allowCommentOnConfirmation` – deshalb schickt der Dienstplaner keinen.
 * - Absagen: `POST …/{platz}/decline` mit `{comment}` → der Platz ist frei (neue ID), der Grund hängt am freien Platz.
 * - Rückgängig: `POST …/{id}/undo` mit `{personId: ich}` → wieder „angefragt“. Nach einer Zusage mit der ID der Zusage,
 *   nach einer Absage mit der **ursprünglichen** ID. Nur die letzte Antwort, nur innerhalb von **zehn Minuten** – sonst
 *   400 (`zu-spaet`).
 */
import {
  gleicherStand,
  platzAendern,
  type Belegung,
  type DienstPort,
  type Ergebnis,
  type Grund,
  type PlatzOrt,
  type ZuSpaet,
} from './einteilen';
import type { MeinDienst, TerminZeile } from './termine';

/** So lange lässt ChurchTools eine Antwort zurücknehmen (laut Beschreibung der Schnittstelle). */
export const RUECKGAENGIG_MS = 10 * 60_000;

export type AntwortErgebnis = Ergebnis<Grund | ZuSpaet>;

/** Was sich zurücknehmen lässt – die ID, die `undo` braucht. */
export interface Letzte {
  art: 'zugesagt' | 'abgesagt';
  id: number;
}

const anfrage = (ichId: number): Belegung => ({ art: 'anfrage', personId: ichId });
const zusage = (ichId: number): Belegung => ({ art: 'zusage', personId: ichId });
const pfad = (ort: PlatzOrt, id: number, was: string) =>
  `/events/${ort.eventId}/servicerequests/${id}/${was}`;

/** Zusagen – nur eine offene Anfrage an mich. */
export function zusagen(port: DienstPort, ort: PlatzOrt, ichId: number): Promise<AntwortErgebnis> {
  return platzAendern(port, ort, {
    vorher: (ist) => gleicherStand(ist, anfrage(ichId)),
    fertig: (ist) => gleicherStand(ist, zusage(ichId)),
    auftrag: (id) => ({ pfad: pfad(ort, id, 'accept'), method: 'POST', json: { comment: null } }),
  });
}

/**
 * Absagen – nur eine offene Anfrage an mich; der Grund ist freiwillig (leer → keiner). Fertig ist es, sobald ich nicht
 * mehr am Platz stehe – auch wenn der Planer ihn gleich wieder vergeben hat.
 */
export function absagen(
  port: DienstPort,
  ort: PlatzOrt,
  ichId: number,
  grund: string,
): Promise<AntwortErgebnis> {
  return platzAendern(port, ort, {
    vorher: (ist) => gleicherStand(ist, anfrage(ichId)),
    fertig: (ist) => !(ist.art === 'anfrage' || ist.art === 'zusage') || ist.personId !== ichId,
    auftrag: (id) => ({
      pfad: pfad(ort, id, 'decline'),
      method: 'POST',
      json: { comment: grund.trim() || null },
    }),
    // Ohne Recht auf den Dienst ist der freie Platz danach unsichtbar – dann steht man auch nicht mehr dort.
    unsichtbarFertig: true,
  });
}

/**
 * Was sich nach einer Antwort zurücknehmen lässt – `null`, wenn nichts geschrieben wurde (die Antwort stand schon da,
 * etwa aus der ChurchTools-App): Dann gibt es auch nichts zurückzunehmen.
 */
export function letzteAus(art: Letzte['art'], r: AntwortErgebnis): Letzte | null {
  if (!r.ok || r.geschriebenAuf === undefined) return null;
  // Nach einer Zusage gilt die neue ID (der zugesagte Platz), nach einer Absage die ursprüngliche (gemessen).
  return { art, id: art === 'zugesagt' ? r.platzId : r.geschriebenAuf };
}

/**
 * Rückgängig – zurück auf „angefragt“. Steht nicht mehr da, was die Antwort hinterließ (der Planer hat den freien Platz
 * schon neu vergeben, oder die Zusage wurde anderswo geändert), wird nichts geschrieben (`konflikt`).
 */
export function rueckgaengig(
  port: DienstPort,
  ort: PlatzOrt,
  ichId: number,
  letzte: Letzte,
): Promise<AntwortErgebnis> {
  const undo = {
    pfad: pfad(ort, letzte.id, 'undo'),
    method: 'POST' as const,
    json: { personId: ichId },
  };
  return platzAendern(port, ort, {
    vorher: (ist) =>
      letzte.art === 'zugesagt' ? gleicherStand(ist, zusage(ichId)) : ist.art === 'frei',
    fertig: (ist) => gleicherStand(ist, anfrage(ichId)),
    auftrag: () => undo,
    bei400: 'zu-spaet' as const,
    // Nach einer Absage sieht man den freien Platz ohne Recht auf den Dienst nicht – dann trotzdem zurücknehmen; ob es
    // geklappt hat, zeigt das Nachlesen (danach steht man wieder dort).
    unsichtbarSchreiben: letzte.art === 'abgesagt' ? () => undo : undefined,
  });
}

/** Eine eben gegebene Antwort – was die Listen zehn Minuten lang mit „Rückgängig“ zeigen. */
export interface Antwort {
  art: Letzte['art'];
  /** Zeitpunkt der Antwort (ms) – nach `RUECKGAENGIG_MS` fällt sie weg. */
  seit: number;
  /** Was `undo` braucht; `null`, wenn nichts geschrieben wurde (dann kein „Rückgängig“). */
  letzte: Letzte | null;
  /** Der eigene Dienst, wie er vor der Antwort aussah – eine Absage fehlt in frisch geladenen Terminen ganz. */
  mein: MeinDienst;
}

/** Der Schlüssel eines eigenen Platzes – Termin, Dienst, `index` (nie die flüchtige ID). */
export function antwortSchluessel(
  terminId: number,
  ort: { serviceId: number; index: number | null },
): string {
  return `${terminId}:${ort.serviceId}:${ort.index ?? '-'}`;
}

/**
 * **Die Terminliste mit den eben gegebenen Antworten** (E7-1): Jede Antwort, die jünger als zehn Minuten ist, hängt
 * am eigenen Dienst (`MeinDienst.antwort`) – eine Zusage als zugesagt, eine Absage bleibt sichtbar, auch wenn die frisch
 * geladenen Termine sie nicht mehr kennen. Danach zeigen die Listen wieder nur, was ChurchTools liefert.
 */
export function mitAntworten(
  zeilen: TerminZeile[],
  antworten: ReadonlyMap<string, Antwort>,
  jetzt: number,
): TerminZeile[] {
  const gueltig = [...antworten].filter(([, a]) => jetzt - a.seit < RUECKGAENGIG_MS);
  if (gueltig.length === 0) return zeilen;
  return zeilen.map((z) => {
    const hier = gueltig.filter(([k]) => k.startsWith(`${z.id}:`));
    if (hier.length === 0) return z;
    const meine = z.meine.map((d) => {
      const a = d.ort && hier.find(([k]) => k === antwortSchluessel(z.id, d.ort!))?.[1];
      return a ? { ...d, zugesagt: a.art === 'zugesagt', antwort: a } : d;
    });
    // Abgesagt und schon neu geladen: Der Dienst fehlt – er bleibt mit „Rückgängig“ stehen.
    for (const [k, a] of hier) {
      if (!meine.some((d) => d.ort && antwortSchluessel(z.id, d.ort) === k)) {
        meine.push({ ...a.mein, zugesagt: a.art === 'zugesagt', antwort: a });
      }
    }
    return { ...z, meine };
  });
}
