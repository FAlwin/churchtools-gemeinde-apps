import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { KeinSpeicherRecht } from '@ui/ct/verbindung';
import * as E from './einrichten';
import { gemeindeVorgaben, gespeicherteVorgaben, speichereGemeindeVorgaben } from './gemeinde';

/**
 * Die Gemeinde-Einstellung der Anmeldungen (A6-2, #548) gegen einen nachgestellten Datenbereich – so, wie ihn die
 * Musik-App gemessen hat: Ohne Recht kommt eine leere Liste, ein „201“ ist kein Beleg.
 */
let kategorien: { id: number; shorty: string }[];
let werte: { id: number; dataCategoryId: number; value: string }[];
let stoerung: Error | null;
let schluckeWert: boolean;

vi.mock('@ui/ct/modulPort', async () => {
  const { ApiError: Fehler } = await import('@ui/ct/fehler');
  const { KeinSpeicherRecht: KeinRecht } = await import('@ui/ct/verbindung');
  return {
    modulId: () => Promise.resolve(7),
    modulPort: {
      kuerzel: () => 'anmeldungen',
      daten: (pfad: string) => {
        if (stoerung) return Promise.reject(stoerung);
        if (pfad.endsWith('/customdatacategories')) return Promise.resolve(kategorien);
        if (pfad.endsWith('/customdatavalues')) return Promise.resolve(werte);
        return Promise.reject(new Fehler(404, pfad));
      },
      schreibe: (pfad: string, a: { method: string; json?: Record<string, unknown> }) => {
        if (pfad.endsWith('/customdatacategories')) {
          kategorien.push({ id: 50, shorty: String(a.json!.shorty) });
        } else if (a.method === 'POST' && !schluckeWert) {
          werte.push({ id: werte.length + 100, dataCategoryId: 50, value: String(a.json!.value) });
        } else if (a.method === 'PUT' && !schluckeWert) {
          const w = werte.find((x) => pfad.endsWith(`/${x.id}`))!;
          w.value = String(a.json!.value);
        }
        return Promise.resolve();
      },
      fehler: (s: number, m: string) => new Fehler(s, m),
      istKeinRecht: (e: unknown) => e instanceof KeinRecht,
      istNichtGefunden: (e: unknown) => e instanceof Fehler && e.status === 404,
    },
  };
});
vi.mock('./einrichten', async (original) => ({
  ...(await original<typeof import('./einrichten')>()),
  stammdaten: vi.fn(),
}));
const ei = vi.mocked(E);

const STAMM = {
  status: [
    { id: 1, name: 'status.friend', nameTranslated: 'Freund', isMember: false },
    { id: 2, name: 'status.potential', nameTranslated: 'Interessent', isMember: false },
  ],
  standorte: [{ id: 0, name: 'Zentrale' }],
  bereiche: [{ id: 1, name: 'Gemeindeliste' }],
};
const VORSCHLAG = { statusId: 2, campusId: 0, departmentId: 1 };

beforeEach(() => {
  kategorien = [];
  werte = [];
  stoerung = null;
  schluckeWert = false;
  ei.stammdaten.mockResolvedValue(STAMM);
});

describe('Gemeinde-Einstellung: Vorgaben für neue Personen', () => {
  it('nichts gespeichert → der Vorschlag', async () => {
    expect(await gespeicherteVorgaben()).toBeNull();
    expect(await gemeindeVorgaben()).toEqual(VORSCHLAG);
  });

  it('gespeichert → gilt (auch „Freund“ statt „Interessent“), nachgelesen; zweites Speichern ändert denselben Wert', async () => {
    await speichereGemeindeVorgaben({ statusId: 1, campusId: 0, departmentId: 1 });
    expect(kategorien.map((k) => k.shorty)).toEqual(['anmeldungen-einstellungen']);
    expect(await gemeindeVorgaben()).toEqual({ statusId: 1, campusId: 0, departmentId: 1 });
    await speichereGemeindeVorgaben(VORSCHLAG);
    expect(werte).toHaveLength(1);
    expect(await gespeicherteVorgaben()).toEqual(VORSCHLAG);
  });

  it('Gespeichertes, das es in ChurchTools nicht mehr gibt (Standort gelöscht) → Vorschlag', async () => {
    await speichereGemeindeVorgaben({ statusId: 1, campusId: 9, departmentId: 1 });
    expect(await gemeindeVorgaben()).toEqual(VORSCHLAG);
  });

  it('kein Recht (leere Liste oder KeinSpeicherRecht) → Vorschlag', async () => {
    stoerung = new KeinSpeicherRecht('nein');
    expect(await gemeindeVorgaben()).toEqual(VORSCHLAG);
  });

  it('vorübergehend (503) → Fehler, NICHT still der Vorschlag', async () => {
    await speichereGemeindeVorgaben({ statusId: 1, campusId: 0, departmentId: 1 });
    stoerung = new ApiError(503, 'kurz weg');
    await expect(gemeindeVorgaben()).rejects.toMatchObject({ status: 503 });
  });

  it('übernimmt ChurchTools den Wert nicht → Fehler statt „gespeichert“', async () => {
    schluckeWert = true;
    await expect(speichereGemeindeVorgaben(VORSCHLAG)).rejects.toThrow(/nicht übernommen/);
  });

  it('fremder oder kaputter Wert in der Kategorie zählt nicht', async () => {
    kategorien = [{ id: 50, shorty: 'anmeldungen-einstellungen' }];
    werte = [
      { id: 1, dataCategoryId: 50, value: 'kein json' },
      { id: 2, dataCategoryId: 50, value: JSON.stringify({ art: 'andere', fassung: 1 }) },
    ];
    expect(await gespeicherteVorgaben()).toBeNull();
  });
});
