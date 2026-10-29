import { describe, expect, it } from 'vitest';
import {
  aenderungVon,
  kopfNachAbsage,
  mailsVon,
  planungVon,
  terminRumpf,
  terminSperre,
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
