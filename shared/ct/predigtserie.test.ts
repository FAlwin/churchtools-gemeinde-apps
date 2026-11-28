import { describe, expect, it } from 'vitest';
import {
  ABLAUF_ABGESCHLOSSEN,
  ABLAUF_VERWEIGERT,
  SERIE_MAX,
  serieAus,
  serieFehler,
  serieSetzen,
  type CtSchreiber,
  type SchreibAuftrag,
} from './schreibKern';

/**
 * **Predigtserie setzen** (Dienstplaner, 27.11.2026). Gemessen an der Test-Instanz: `PUT …/agenda` mit nur `{ series }`
 * genügt; mitgeschickte `items` ersetzten die ganze Liste. Der Test prüft deshalb den RUMPF, den der Kern baut – nicht
 * nur, dass geschrieben wird.
 */
class Fehler extends Error {
  constructor(
    public status: number,
    m: string,
  ) {
    super(m);
  }
}

function attrappe(o: { gesperrt?: boolean; verweigern?: boolean } = {}) {
  const geschrieben: { pfad: string; auftrag: SchreibAuftrag }[] = [];
  const s: CtSchreiber = {
    agenda: () => Promise.resolve({ id: 1, items: [], calendarId: 2, isLocked: o.gesperrt }),
    song: () => Promise.reject(new Error('nicht gebraucht')),
    vorlage: () => Promise.reject(new Error('nicht gebraucht')),
    schreibe: (pfad, auftrag) => {
      geschrieben.push({ pfad, auftrag });
      if (o.verweigern) return Promise.reject(new Error(auftrag.verweigert));
      return Promise.resolve(null);
    },
    fehler: (status, m) => new Fehler(status, m),
  };
  return { s, geschrieben };
}

describe('serieSetzen', () => {
  it('schreibt NUR { series } an den Ablauf des Termins – keine Punkte, keine Grenze, kein Kalender', async () => {
    const { s, geschrieben } = attrappe();
    await expect(serieSetzen(s, 160, 'Die Psalmen')).resolves.toBe('Die Psalmen');
    expect(geschrieben).toHaveLength(1);
    expect(geschrieben[0].pfad).toBe('/events/160/agenda');
    expect(geschrieben[0].auftrag.method).toBe('PUT');
    expect(geschrieben[0].auftrag.json).toEqual({ series: 'Die Psalmen' });
  });

  it('kürzt Rand-Leerzeichen; leer, nur Leerzeichen und null entfernen die Serie (null)', async () => {
    for (const [ein, aus] of [
      ['  Römer  ', 'Römer'],
      ['', null],
      ['   ', null],
      [null, null],
    ] as const) {
      const { s, geschrieben } = attrappe();
      await expect(serieSetzen(s, 1, ein)).resolves.toBe(aus);
      expect(geschrieben[0].auftrag.json).toEqual({ series: aus });
    }
  });

  it(`höchstens ${SERIE_MAX} Zeichen: genau ${SERIE_MAX} geht, eins mehr → 400, nichts geschrieben`, async () => {
    const gut = attrappe();
    await serieSetzen(gut.s, 1, 'ä'.repeat(SERIE_MAX));
    expect(gut.geschrieben).toHaveLength(1);

    const zuLang = attrappe();
    await expect(serieSetzen(zuLang.s, 1, 'x'.repeat(SERIE_MAX + 1))).rejects.toMatchObject({
      status: 400,
    });
    expect(zuLang.geschrieben).toHaveLength(0);
  });

  it('abgeschlossener Ablauf → 423 mit der Abschluss-Meldung; sonst bleibt „Keine Berechtigung“', async () => {
    await expect(
      serieSetzen(attrappe({ verweigern: true, gesperrt: true }).s, 1, 'X'),
    ).rejects.toMatchObject({ status: 423, message: ABLAUF_ABGESCHLOSSEN });
    await expect(serieSetzen(attrappe({ verweigern: true }).s, 1, 'X')).rejects.toThrow(
      ABLAUF_VERWEIGERT,
    );
  });
});

describe('serieAus / serieFehler', () => {
  it('serieAus: wie ChurchTools speichert', () => {
    expect(serieAus(' a ')).toBe('a');
    expect(serieAus('')).toBeNull();
    expect(serieAus(undefined)).toBeNull();
  });

  it('serieFehler: leer ist erlaubt, Rand-Leerzeichen zählen nicht mit', () => {
    expect(serieFehler('')).toBeNull();
    expect(serieFehler(` ${'a'.repeat(SERIE_MAX)} `)).toBeNull();
    expect(serieFehler('a'.repeat(SERIE_MAX + 1))).toMatch(/höchstens 100/);
  });
});
