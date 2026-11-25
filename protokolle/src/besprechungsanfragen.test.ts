import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { anfragenNachlesen, ladeKandidaten } from './besprechungsanfragen';
import { nachbauEnde, nachbauStarten, type Nachbau } from './nachbau.testhilfe';

let ct: Nachbau;
beforeEach(() => {
  ct = nachbauStarten();
});
afterEach(nachbauEnde);

describe('ladeKandidaten', () => {
  it('liest die Kandidaten des Kalenders (nicht das veraltete `meetingrequestpersons`) – entdoppelt', async () => {
    ct.kandidaten = [
      { type: 'person', person: { title: 'Alwin', domainType: 'person', domainIdentifier: '1' } },
      {
        type: 'groupMember',
        groupName: 'Leitung',
        person: { title: 'Alwin', domainType: 'person', domainIdentifier: '1' },
      },
    ];
    expect(await ladeKandidaten(4)).toEqual([{ id: 1, name: 'Alwin', gruppe: 'Leitung' }]);
    expect(ct.aufrufe).toContain('GET /calendars/4/meetingrequest/candidates');
    expect(ct.aufrufe.join()).not.toMatch(/meetingrequestpersons/);
  });

  it('ein Fehler wird geworfen – „niemand“ ist nicht „ChurchTools antwortet nicht“', async () => {
    ct.kandidatenFehler = true;
    await expect(ladeKandidaten(4)).rejects.toThrow();
  });
});

describe('anfragenNachlesen', () => {
  const termin = (anfragen: { person: number; state: string }[]) => {
    ct.termine.push({ kalender: 4, id: 700, titel: 'T', beginn: '2027-12-24T15:00:00Z', anfragen });
    return { kalender: 4, id: 700 };
  };

  it('alle da: nichts fehlt', async () => {
    const t = termin([
      { person: 1, state: 'accepted' },
      { person: 19, state: 'pending' },
    ]);
    expect(await anfragenNachlesen({ termin: t, gewuenscht: [1, 19] })).toEqual({
      fehlend: [],
      unklar: false,
    });
  });

  it('eine Person ohne Anfrage: sie steht in `fehlend`', async () => {
    const t = termin([{ person: 1, state: 'accepted' }]);
    expect(await anfragenNachlesen({ termin: t, gewuenscht: [1, 19] })).toEqual({
      fehlend: [19],
      unklar: false,
    });
  });

  it('Lesen gescheitert: unklar – nie „fehlt“', async () => {
    const t = termin([]);
    ct.anfragenLesenFehler = true;
    expect(await anfragenNachlesen({ termin: t, gewuenscht: [1, 19] })).toEqual({
      fehlend: [],
      unklar: true,
    });
  });

  it('nichts gewünscht: nichts gelesen', async () => {
    expect(await anfragenNachlesen({ termin: { kalender: 4, id: 1 }, gewuenscht: [] })).toEqual({
      fehlend: [],
      unklar: false,
    });
    expect(ct.aufrufe).toEqual([]);
  });
});
