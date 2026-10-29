import { describe, expect, it } from 'vitest';
import {
  aenderungVon,
  ausnahmeRumpf,
  endeRumpf,
  ersterDerSerie,
  kopfNachAbsage,
  mailsSerie,
  mailsVon,
  nochInSerie,
  planungVon,
  serienWeg,
  teilRumpf,
  terminRumpf,
  terminSperre,
  verschoben,
} from './bearbeiten';
import { geplanterKopf } from './planen';

const ZONE = 'Europe/Berlin';
const ALT = {
  titel: 'Leitungssitzung',
  beginn: '2027-05-26T17:30:00Z',
  ende: '2027-05-26T19:30:00Z',
};

describe('planungVon', () => {
  it('Ortszeit und Dauer aus dem Termin', () => {
    expect(planungVon(ALT, ZONE)).toEqual({
      titel: 'Leitungssitzung',
      tag: '2027-05-26',
      uhrzeit: '19:30',
      dauer: 120,
    });
  });
  it('ohne Ende: zwei Stunden', () => {
    expect(planungVon({ titel: 'x', beginn: ALT.beginn }, ZONE).dauer).toBe(120);
  });
});

describe('aenderungVon + mailsVon', () => {
  const a = (neu: Partial<typeof ALT>, nachher = [1, 19]) =>
    aenderungVon({ alt: ALT, neu: { ...ALT, ...neu }, vorher: [1, 19], nachher });

  it('nichts geändert', () => {
    expect(a({})).toEqual({ titel: false, zeit: false, dazu: [], weg: [] });
  });
  it('nur Leerzeichen am Titel zählen nicht', () => {
    expect(a({ titel: ' Leitungssitzung ' }).titel).toBe(false);
  });
  it('nur die Dauer ist auch eine neue Zeit', () => {
    expect(a({ ende: '2027-05-26T20:00:00Z' }).zeit).toBe(true);
  });
  it('neue Zeit + neu einladen: „Termin geändert“ an die Bleibenden, nicht an mich und nicht an Neue', () => {
    const x = a({ beginn: '2027-05-27T17:30:00Z' }, [1, 19, 7]);
    expect(x.dazu).toEqual([7]);
    expect(mailsVon(x, { nachher: [1, 19, 7], neuEinladen: true, ich: 1 })).toEqual({
      geaendert: 1,
      eingeladen: 1,
      ausgeladen: 0,
    });
  });
  it('neue Zeit ohne neu einladen: still', () => {
    const x = a({ beginn: '2027-05-27T17:30:00Z' });
    expect(mailsVon(x, { nachher: [1, 19], neuEinladen: false, ich: 1 }).geaendert).toBe(0);
  });
  it('nur Titel, neu einladen an: still', () => {
    const x = a({ titel: 'Klausur' });
    expect(mailsVon(x, { nachher: [1, 19], neuEinladen: true, ich: 1 }).geaendert).toBe(0);
  });
  it('ausladen', () => {
    const x = a({}, [1]);
    expect(x.weg).toEqual([19]);
    expect(mailsVon(x, { nachher: [1], neuEinladen: false, ich: 1 }).ausgeladen).toBe(1);
  });
});

describe('terminRumpf', () => {
  const gelesen = {
    title: 'Alt',
    subtitle: 'Unter',
    description: 'Text',
    link: 'https://example.org',
    address: { name: 'Gemeindehaus' },
    isInternal: false,
    startDate: ALT.beginn,
    endDate: ALT.ende,
    repeatId: 0,
    id: 70,
    calendar: { id: 4 },
  };
  it('alles wie gelesen (ein `PUT` leert, was fehlt), nur Titel und Zeit neu; ohne Liste keine Einladungen', () => {
    const r = terminRumpf(gelesen, { titel: ' Neu ', beginn: 'B', ende: 'E' });
    expect(r).toEqual({
      title: 'Neu',
      subtitle: 'Unter',
      description: 'Text',
      link: 'https://example.org',
      address: { name: 'Gemeindehaus' },
      isInternal: false,
      startDate: 'B',
      endDate: 'E',
      repeatId: 0,
    });
  });
  it('mit Liste: `meetingrequests`', () => {
    expect(
      terminRumpf(gelesen as never, { titel: 'x', beginn: 'B', ende: 'E' }, [1, 19])
        .meetingrequests,
    ).toEqual([{ inviteeId: 1 }, { inviteeId: 19 }]);
  });
});

describe('terminSperre', () => {
  it.each([
    [{ repeatId: 0, signup: null }, null],
    [{ repeatId: 7 }, 'serie'],
    [{ repeatId: 0, signup: { groups: [] } }, 'anmeldung'],
    [{ repeatId: 7, signup: { groups: [] } }, 'anmeldung'],
  ])('%o → %s', (t, erwartet) => {
    expect(terminSperre(t)).toBe(erwartet);
  });
});

describe('kopfNachAbsage', () => {
  const kopf = geplanterKopf(
    { titel: 'x', beginn: ALT.beginn, termin: { kalender: 4, id: 70 }, treffen: 80 },
    's1',
  );
  it('geplant verschwindet', () => expect(kopfNachAbsage(kopf)).toBe('loeschen'));
  it('Entwurf bleibt ohne Termin und Treffen', () =>
    expect(kopfNachAbsage({ ...kopf, status: 'entwurf' })).toEqual({
      ...kopf,
      status: 'entwurf',
      termin: null,
      treffen: null,
    }));
  it('freigegeben: nicht anfassen', () =>
    expect(kopfNachAbsage({ ...kopf, status: 'frei' })).toBeNull());
});

describe('Serien (K2b-2)', () => {
  // Wöchentlich ab Mi 07.07.2027 19:30 (Berlin), wie gemessen.
  const serie = {
    title: 'Leitungssitzung',
    description: 'Text',
    address: { name: 'Gemeindehaus' },
    isInternal: false,
    startDate: '2027-07-07T17:30:00Z',
    endDate: '2027-07-07T19:30:00Z',
    repeatId: 7,
    repeatFrequency: 1,
    repeatUntil: '2027-08-25',
    exceptions: [{ date: '2027-07-07' }, { date: '2027-07-21' }, { date: '2027-08-11' }],
    additionals: [
      { date: '2027-07-10', isRepeated: false },
      { date: '2027-08-20', isRepeated: false },
    ],
  };
  const NEU = { titel: 'Klausur', beginn: '2027-07-14T18:00:00Z', ende: '2027-07-14T20:00:00Z' };

  it('Tag in Ortszeit: 0:30 Uhr deutscher Zeit ist schon der nächste Tag', () => {
    expect(ersterDerSerie(serie, '2027-07-06T22:30:00Z', ZONE)).toBe(true);
    expect(ersterDerSerie(serie, '2027-07-07T22:30:00Z', ZONE)).toBe(false);
  });

  it.each([
    [{ titel: false, zeit: false }, 'diese', false, null],
    [{ titel: true, zeit: false }, 'diese', true, 'teilen-diese'],
    [{ titel: false, zeit: true }, 'ab', false, 'teilen-ab'],
    [{ titel: false, zeit: true }, 'ab', true, 'serie'],
  ] as const)('serienWeg %o %s erster=%s → %s', (a, umfang, erster, erwartet) => {
    expect(serienWeg(a, umfang, erster)).toBe(erwartet);
  });

  it('nochInSerie: Ausnahme oder Ende davor = schon geteilt', () => {
    expect(nochInSerie(serie, '2027-07-14', ZONE)).toBe(true);
    expect(nochInSerie(serie, '2027-07-21', ZONE)).toBe(false);
    expect(nochInSerie({ ...serie, repeatUntil: '2027-07-13' }, '2027-07-14', ZONE)).toBe(false);
    expect(nochInSerie({ ...serie, repeatUntil: null }, '2027-09-01', ZONE)).toBe(true);
  });

  it('nochInSerie: zum Einzeltermin geworden (nur einer blieb übrig) – nur sein eigener Tag zählt', () => {
    // Gefunden in der Test-Instanz 29.10.2026: „ab hier beenden“ ließ einen Termin übrig, ChurchTools machte die Serie
    // zum Einzeltermin ohne `repeatUntil` – die Absage galt als „nicht übernommen“.
    const einzeln = { ...serie, repeatId: 0, repeatUntil: null, exceptions: [] };
    expect(nochInSerie(einzeln, '2027-07-14', ZONE)).toBe(false);
    expect(nochInSerie(einzeln, '2027-07-07', ZONE)).toBe(true);
  });

  it('„nur diese“: Einzeltermin, Felder wie gelesen, ohne Einladungsliste', () => {
    expect(teilRumpf(serie, NEU, 'diese', '2027-07-14')).toEqual({
      title: 'Klausur',
      description: 'Text',
      address: { name: 'Gemeindehaus' },
      isInternal: false,
      startDate: NEU.beginn,
      endDate: NEU.ende,
      repeatId: 0,
      repeatFrequency: null,
      repeatUntil: null,
      exceptions: [],
      additionals: [],
      splitDate: '2027-07-14',
      splitUntilEnd: false,
    });
  });

  it('„ab dieser“: Wiederholung bleibt, nur Ausnahmen und Zusatztermine ab dem Tag', () => {
    const r = teilRumpf(serie, NEU, 'ab', '2027-07-14');
    expect(r).toMatchObject({
      repeatId: 7,
      repeatUntil: '2027-08-25',
      exceptions: [{ date: '2027-07-21' }, { date: '2027-08-11' }],
      additionals: [{ date: '2027-08-20', isRepeated: false }],
      splitDate: '2027-07-14',
      splitUntilEnd: true,
      description: 'Text',
    });
    expect(r).not.toHaveProperty('meetingrequests');
  });

  it('absagen: Ausnahme dazu bzw. Ende am Vortag, sonst alles wie gelesen', () => {
    expect(ausnahmeRumpf(serie, '2027-07-14')).toEqual({
      ...serie,
      exceptions: [...serie.exceptions, { date: '2027-07-14' }],
    });
    expect(endeRumpf(serie, '2027-08-04')).toEqual({ ...serie, repeatUntil: '2027-08-03' });
  });

  it('verschoben: gleiche Tagesverschiebung, neue Uhrzeit – auch über die Zeitumstellung', () => {
    // Diese Sitzung Mi 06.10.2027 19:30 → Do 07.10. 20:00 (1:30). Spätere am Mi 03.11. (Winterzeit) → Do 04.11. 20:00.
    const q = {
      alt: '2027-10-06T17:30:00Z',
      neu: { beginn: '2027-10-07T18:00:00Z', ende: '2027-10-07T19:30:00Z' },
    };
    expect(verschoben('2027-11-03T18:30:00Z', q, ZONE)).toEqual({
      beginn: '2027-11-04T19:00:00Z',
      ende: '2027-11-04T20:30:00Z',
    });
  });

  it('mailsSerie: geteilt laden alle neu ein (außer mir); „nur diese“ lädt an der Serie zusätzlich aus', () => {
    const x = aenderungVon({
      alt: ALT,
      neu: { ...ALT, beginn: '2027-05-26T18:00:00Z' },
      vorher: [1, 19, 7],
      nachher: [1, 19, 8],
    });
    const q = { nachher: [1, 19, 8], neuEinladen: true, ich: 1 };
    expect(mailsSerie(x, 'teilen-diese', q)).toEqual({
      geaendert: 0,
      eingeladen: 2,
      ausgeladen: 1,
    });
    expect(mailsSerie(x, 'teilen-ab', q)).toEqual({ geaendert: 0, eingeladen: 2, ausgeladen: 0 });
    expect(mailsSerie(x, 'serie', q)).toEqual(mailsVon(x, q));
  });
});
