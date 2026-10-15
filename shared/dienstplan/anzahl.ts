/**
 * **Anzahl der Plätze ändern** (Bauplan E4-5-3): wie viele Plätze ein Dienst an einem Termin hat. Gespeichert wird
 * **sofort** (Alwin, 15.10.2026) – gemessen verschickt ChurchTools dabei nichts (E4-5-0).
 *
 * Gemessen (E0): `PUT /events/{id}/eventservices` `{eventId, services: [{serviceId, count}]}` → 204. Nicht
 * genannte Dienste bleiben; beim Verkleinern fallen **leere Plätze zuerst** weg, belegte bleiben.
 *
 * Wie im Schreibkern (`einteilen.ts`): frisch lesen → mit dem vergleichen, was der Planer gesehen hat (sonst
 * Konflikt, nichts geschrieben) → schreiben, **nie** wiederholt → nachlesen. Erst die nachgelesene Zahl ist der
 * Erfolg, nicht der Statuscode.
 */
import { lesegrund, type DienstPort, type Grund } from './einteilen';
import { istFrei, type RohTermin } from './termine';

export type AnzahlErgebnis =
  | { ok: true; anzahl: number }
  /** `jetzt`: so viele Plätze hat der Dienst jetzt (bei Konflikt und „nicht angekommen“). */
  | { ok: false; grund: Grund | 'belegt'; jetzt?: number };

/** Wie viele Plätze der Dienst am Termin hat und wie viele davon belegt sind. */
export function zaehle(t: RohTermin, serviceId: number): { anzahl: number; belegt: number } {
  const plaetze = (t.eventServices ?? []).filter((p) => p.serviceId === serviceId);
  return { anzahl: plaetze.length, belegt: plaetze.filter((p) => !istFrei(p)).length };
}

async function lesen(
  port: DienstPort,
  eventId: number,
  serviceId: number,
): Promise<{ anzahl: number; belegt: number } | { grund: Grund }> {
  try {
    return zaehle(await port.termin(eventId), serviceId);
  } catch (e) {
    return { grund: lesegrund(port, e) };
  }
}

/**
 * **Die Anzahl auf `neu` setzen.** `gesehen` ist die Zahl, die der Planer vor sich hatte: Steht inzwischen eine
 * andere da, wird nicht geschrieben (`konflikt`). Weniger als belegt geht nicht (`belegt`) – erst die Person
 * zurückziehen, dann den Platz.
 */
export async function anzahlAendern(
  port: DienstPort,
  eventId: number,
  serviceId: number,
  gesehen: number,
  neu: number,
): Promise<AnzahlErgebnis> {
  // 1. Frisch lesen.
  const erst = await lesen(port, eventId, serviceId);
  if ('grund' in erst) return { ok: false, grund: erst.grund };
  if (erst.anzahl === neu) return { ok: true, anzahl: neu };
  if (erst.anzahl !== gesehen) return { ok: false, grund: 'konflikt', jetzt: erst.anzahl };
  if (neu < erst.belegt) return { ok: false, grund: 'belegt', jetzt: erst.anzahl };

  // 2. Schreiben – nie wiederholt.
  let sonst: Grund = 'nicht-angekommen';
  try {
    await port.schreibe(`/events/${eventId}/eventservices`, {
      method: 'PUT',
      json: { eventId, services: [{ serviceId, count: neu }] },
    });
  } catch (e) {
    const s = port.status(e);
    if (s === 401) return { ok: false, grund: 'abgemeldet' };
    if (s === 403) return { ok: false, grund: 'kein-recht' };
    // Alles andere: Vielleicht ist es doch angekommen – nachlesen statt raten.
    sonst = 'voruebergehend';
  }

  // 3. Nachlesen – erst die Zahl am Termin ist der Erfolg.
  const nach = await lesen(port, eventId, serviceId);
  if ('grund' in nach) return { ok: false, grund: nach.grund };
  return nach.anzahl === neu
    ? { ok: true, anzahl: neu }
    : { ok: false, grund: sonst, jetzt: nach.anzahl };
}
