import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eintragVorbelegung } from '@shared/protokolle/termine';
import { vorlageAnwenden } from '@shared/protokolle/terminVorlagen';
import { Unklar } from '@ui/ct/fehler';
import { nachbauEnde, nachbauStarten, type Nachbau } from './nachbau.testhilfe';
import {
  ladeTags,
  ladeVorlagen,
  VORLAGE_NICHT_GEFUNDEN,
  vorlageSpeichern,
} from './terminVorlagenLesen';

/** Termin-Vorlagen und Tags lesen, „Als Vorlage speichern“ mit Nachlesen (W15-1) gegen die nachgestellte Instanz. */
let ct: Nachbau;
const E = {
  ...eintragVorbelegung({ text: 'Heiligabend, 16 Uhr', datum: '2027-12-24' }, 4),
  kalender: 4,
};

beforeEach(() => {
  ct = nachbauStarten();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(nachbauEnde);

describe('lesen', () => {
  it('Vorlagen: die Liste von ChurchTools, nach Titel; Tags nach Namen', async () => {
    ct.vorlagen.push(
      { id: 2, calendarId: 4, title: 'Zweite', startTime: '10:00', duration: 3600 },
      { id: 1, calendarId: 4, title: 'Erste', startTime: '10:00', duration: 3600 },
    );
    ct.tags.push({ id: 2, name: 'Zebra' }, { id: 1, name: 'Alpha' });
    expect((await ladeVorlagen()).map((v) => v.titel)).toEqual(['Erste', 'Zweite']);
    expect((await ladeTags()).map((t) => t.name)).toEqual(['Alpha', 'Zebra']);
  });

  it('ein Fehler beim Lesen wird geworfen – „keine Vorlagen“ wäre eine Lüge', async () => {
    ct.vorlagenLesenFehler = true;
    await expect(ladeVorlagen()).rejects.toBeDefined();
  });
});

describe('vorlageSpeichern', () => {
  it('legt die Vorlage an, liest die Liste neu und liefert sie – es entsteht KEIN Termin', async () => {
    const liste = await vorlageSpeichern(E, []);
    expect(ct.vorlagen).toHaveLength(1);
    expect(liste.map((v) => v.titel)).toEqual(['Heiligabend']);
    expect(ct.termine).toEqual([]);
    expect(ct.terminRumpf).toBeNull();
    // Und sie lässt sich wieder anwenden (Rundreise über die Instanz).
    expect(vorlageAnwenden(E, liste[0])).toMatchObject({
      titel: 'Heiligabend',
      von: '16:00',
      bis: '17:00',
    });
  });

  it('schickt Pflichtfelder: title, calendarId, startTime, duration', async () => {
    await vorlageSpeichern(E, []);
    expect(ct.vorlagen[0]).toMatchObject({
      calendarId: 4,
      title: 'Heiligabend',
      startTime: '16:00',
      duration: 3600,
    });
  });

  it('ChurchTools sagt 201, speichert aber nichts: kein Erfolg, sondern Unklar', async () => {
    ct.vorlagenSchlucken = true;
    const e: unknown = await vorlageSpeichern(E, []).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(Unklar);
    expect((e as Error).message).toBe(VORLAGE_NICHT_GEFUNDEN);
  });

  it('ausdrücklich abgelehnt (kein Recht): Fehler, kein Nachsehen nötig', async () => {
    ct.vorlagenFehler = { status: 403, angelegt: false, ctVerbot: true };
    await expect(vorlageSpeichern(E, [])).rejects.toThrow(/keine Termin-Vorlagen/);
    expect(ct.vorlagen).toEqual([]);
  });

  it('unklare Antwort (504), aber gespeichert: wird beim Nachlesen gefunden', async () => {
    ct.vorlagenFehler = { status: 504, angelegt: true };
    const liste = await vorlageSpeichern(E, []);
    expect(liste).toHaveLength(1);
  });

  it('unklare Antwort und nicht da: Unklar', async () => {
    ct.vorlagenFehler = { status: 504, angelegt: false };
    await expect(vorlageSpeichern(E, [])).rejects.toBeInstanceOf(Unklar);
  });

  it('das Nachlesen scheitert: Unklar, nicht „gespeichert“', async () => {
    const echtesFetch = globalThis.fetch;
    vi.stubGlobal('fetch', async (...a: Parameters<typeof fetch>) => {
      const url = String(a[0] instanceof Request ? a[0].url : a[0]);
      if (/templates$/.test(url) && (a[1]?.method ?? 'GET') === 'GET')
        return new Response('{}', { status: 500 });
      return echtesFetch(...a);
    });
    await expect(vorlageSpeichern(E, [])).rejects.toBeInstanceOf(Unklar);
  });

  it('ohne Nummer in der Antwort zählt nur eine NEUE Vorlage – eine gleichnamige alte beweist nichts', async () => {
    ct.vorlagen.push({
      id: 5,
      calendarId: 4,
      title: 'Heiligabend',
      startTime: '16:00',
      duration: 3600,
    });
    ct.vorlagenSchlucken = true;
    await expect(vorlageSpeichern(E, [5])).rejects.toBeInstanceOf(Unklar);
  });
});
