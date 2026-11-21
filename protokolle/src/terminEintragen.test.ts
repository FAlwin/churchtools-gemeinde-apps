import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eintragVorbelegung } from '@shared/protokolle/termine';
import { Unklar } from '@ui/ct/fehler';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { nachbauEnde, nachbauStarten, type Nachbau } from './nachbau.testhilfe';
import { NICHT_NACHGELESEN, terminLegen } from './terminEintragen';

/** „Termin eintragen“ (W14), Schritt 1 – in ChurchTools – gegen die nachgestellte Instanz. */
let ct: Nachbau;
const ZONE = 'Europe/Berlin';
const MIT_UHR = {
  ...eintragVorbelegung({ text: 'Heiligabend, 16 Uhr', datum: '2027-12-24' }, 4),
  kalender: 4,
};
const GANZTAEGIG = {
  ...eintragVorbelegung({ text: 'Bibel-Action-Tag', datum: '2027-04-24' }, 4),
  kalender: 4,
};
const posts = () => ct.aufrufe.filter((a) => a.startsWith('POST') && a.includes('/appointments'));

beforeEach(() => {
  ct = nachbauStarten();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(nachbauEnde);

describe('terminLegen', () => {
  it('legt den Termin an und liest ihn nach – ohne Einladung, Zeit in UTC aus der Ortszeit', async () => {
    const r = await terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE });
    expect(r).toEqual({ art: 'angelegt', id: ct.termine[0].id });
    expect(ct.termine).toEqual([
      expect.objectContaining({
        kalender: 4,
        titel: 'Heiligabend',
        beginn: '2027-12-24T15:00:00Z',
        ende: '2027-12-24T16:00:00Z',
        anfragen: [],
      }),
    ]);
    expect(ct.mails).toEqual([]);
  });

  it('ganztägig: der Tag, nachgelesen als Tag', async () => {
    const r = await terminLegen({ eintrag: GANZTAEGIG, zeitzone: ZONE });
    expect(r.art).toBe('angelegt');
    expect(ct.termine[0]).toMatchObject({ beginn: '2027-04-24', ende: '2027-04-24' });
  });

  it('der Titel wird ohne Leerzeichen am Rand angelegt – und so auch nachgelesen', async () => {
    await terminLegen({ eintrag: { ...MIT_UHR, titel: '  Heiligabend ' }, zeitzone: ZONE });
    expect(ct.termine[0].titel).toBe('Heiligabend');
  });

  it('„Nur verknüpfen“: nichts wird angelegt, die Nummer des vorhandenen Termins kommt zurück', async () => {
    const r = await terminLegen({
      eintrag: MIT_UHR,
      zeitzone: ZONE,
      verknuepfen: {
        id: 161,
        titel: 'Heiligabend – Familiengottesdienst',
        beginn: '2027-12-24T09:00:00Z',
      },
    });
    expect(r).toEqual({ art: 'verknuepft', id: 161 });
    expect(posts()).toEqual([]);
    expect(ct.termine).toEqual([]);
  });

  it('kein Recht: Fehler mit Text, nichts angelegt', async () => {
    ct.terminFehler = { status: 403, angelegt: false, ctVerbot: true };
    await expect(terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE })).rejects.toThrow(
      /keine Termine anlegen/,
    );
    expect(ct.termine).toEqual([]);
  });

  it('unklare Antwort, aber angelegt: gefunden und nachgelesen – genau ein Termin', async () => {
    ct.terminFehler = { status: 504, angelegt: true };
    const r = await terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE });
    expect(r.id).toBe(ct.termine[0].id);
    expect(ct.termine).toHaveLength(1);
  });

  it('unklar und nicht da: „bitte nachsehen“ ohne Wort von Einladungen – es wird nichts als eingetragen gemeldet', async () => {
    ct.terminFehler = { status: 504, angelegt: false };
    const e: unknown = await terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE }).catch(
      (x: unknown) => x,
    );
    expect(e).toBeInstanceOf(Unklar);
    expect(fehlerMeldung(e).nochmal).toBe(false);
    expect(fehlerMeldung(e).text).not.toMatch(/Einladung/);
  });

  it('angelegt, aber nicht nachzulesen: Unklar mit „nicht noch einmal eintragen“ – der Termin steht trotzdem', async () => {
    ct.terminLesenFehler = true;
    const e: unknown = await terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE }).catch(
      (x: unknown) => x,
    );
    expect(e).toBeInstanceOf(Unklar);
    expect(fehlerMeldung(e)).toEqual({ text: NICHT_NACHGELESEN, nochmal: false });
    expect(ct.termine).toHaveLength(1);
  });

  it('ChurchTools hat den Termin anders übernommen als geschickt (Zeit): nicht als gelungen gemeldet', async () => {
    // Das Nachlesen zeigt eine andere Startzeit – ein 201 ist kein Beleg.
    ct.terminFehler = null;
    const echtesFetch = globalThis.fetch;
    vi.stubGlobal('fetch', async (...a: Parameters<typeof fetch>) => {
      const r = await echtesFetch(...a);
      const url = String(a[0] instanceof Request ? a[0].url : a[0]);
      if (/\/appointments\/\d+$/.test(url) && (a[1]?.method ?? 'GET') === 'GET') {
        const j = (await r.json()) as { data: { appointment: { startDate: string } } };
        j.data.appointment.startDate = '2027-12-24T08:00:00Z';
        return new Response(JSON.stringify(j), { status: 200 });
      }
      return r;
    });
    await expect(terminLegen({ eintrag: MIT_UHR, zeitzone: ZONE })).rejects.toBeInstanceOf(Unklar);
  });
});
