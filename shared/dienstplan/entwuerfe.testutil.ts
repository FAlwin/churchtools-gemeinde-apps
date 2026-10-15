// Test-Hilfe: ein nachgebauter Speicher der Erweiterung für die Entwürfe (entwuerfe.test.ts) und das Senden
// (senden.test.ts) – eine Stelle statt zweier Kopien (15.10.2026).
import { expect } from 'vitest';
import type { Wert } from '../ct/modulDaten';
import type { EntwurfPort } from './entwuerfe';
import { Fehler } from './einteilen.testutil';

export const MODUL = 16;
export const KAT = 30;

export type Auftrag = { method: 'POST' | 'PUT' | 'DELETE'; json?: unknown };

/**
 * Ein nachgebauter Speicher der Erweiterung – verhält sich, wie gemessen: `POST` legt an, `PUT`/`DELETE` auf
 * eine fehlende ID → 404. Mit Haken lassen sich Fehler und ein zweiter Planer dazwischenschieben.
 */
export function speicher(werte: Wert[] = []) {
  let naechste = 100 + werte.length;
  let uhr = 0;
  const s = {
    werte: [...werte],
    schreibvorgaenge: [] as Auftrag[],
    /** Vor dem Lesen: werfen statt liefern. */
    lesenWirft: null as Fehler | null,
    /** Vor dem Schreiben (z. B. ein anderer Planer, der schneller ist). */
    vorher: null as ((a: Auftrag) => void) | null,
    /** Statt zu schreiben werfen – mit `trotzdemSchreiben` landet es vorher doch. */
    schreibenWirft: null as Fehler | null,
    trotzdemSchreiben: false,
    /** ChurchTools sagt OK, schreibt aber nichts (der Befund vom 11.08.2026). */
    verschlucken: false,
  };
  const ausfuehren = (pfad: string, a: Auftrag) => {
    const id = Number(pfad.split('/').pop());
    if (a.method === 'POST') {
      s.werte.push({
        id: naechste++,
        dataCategoryId: KAT,
        value: (a.json as { value: string }).value,
      });
      return;
    }
    const i = s.werte.findIndex((w) => w.id === id);
    if (i < 0) throw new Fehler(404);
    if (a.method === 'PUT')
      s.werte[i] = { ...s.werte[i], value: (a.json as { value: string }).value };
    else s.werte.splice(i, 1);
  };
  const port: EntwurfPort = {
    kuerzel: () => 'dienstplaner',
    daten: <T>(pfad: string) => {
      expect(pfad).toBe(`/custommodules/${MODUL}/customdatacategories/${KAT}/customdatavalues`);
      if (s.lesenWirft) return Promise.reject(s.lesenWirft);
      return Promise.resolve(structuredClone(s.werte) as T);
    },
    schreibe: (pfad, a) => {
      s.schreibvorgaenge.push({ method: a.method, json: a.json });
      try {
        s.vorher?.(a);
        if (s.schreibenWirft) {
          if (s.trotzdemSchreiben) ausfuehren(pfad, a);
          throw s.schreibenWirft;
        }
        if (!s.verschlucken) ausfuehren(pfad, a);
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e instanceof Error ? e : new Error(String(e)));
      }
    },
    fehler: (status, meldung) => Object.assign(new Fehler(status), { message: meldung }),
    istKeinRecht: (e) => e instanceof Fehler && e.status === 403,
    istNichtGefunden: (e) => e instanceof Fehler && e.status === 404,
    istAbgemeldet: (e) => e instanceof Fehler && e.status === 401,
    jetzt: () => `2026-10-14T20:00:${String(uhr++).padStart(2, '0')}.000Z`,
  };
  return { s, port };
}
