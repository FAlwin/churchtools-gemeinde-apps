// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { eventKalender } from '@shared/ct/eventRechte';
import { eventVorlagenAus } from '@shared/protokolle/terminEvents';
import { demoStarten } from './demo';
import { ladeEventVorlagen, eventsNachlesen } from './eventsLesen';
import { ctDaten } from '@ui/ct/verbindung';
import { terminLegen } from './terminEintragen';
import { eintragVorbelegung } from '@shared/protokolle/termine';
import { WIEDERHOLUNG } from '@shared/protokolle/terminWiederholung';

/** W15-3: In `?demo` gibt es Eventvorlagen (eine mit Nummer 0), das Recht „Events anlegen“ nur im Kalender 4, und Events entstehen wirklich. */
const echtesFetch = window.fetch;

const starten = (fall: string) => {
  _vergissCsrf();
  _bremseLoesen();
  (window as { settings?: { base_url?: string } }).settings = { base_url: 'https://ct.test/' };
  demoStarten(fall);
};
beforeEach(() => starten('x'));
afterEach(() => {
  window.fetch = echtesFetch;
  delete (window as { settings?: unknown }).settings;
  vi.restoreAllMocks();
});

describe('Demo: Events', () => {
  it('zwei Eventvorlagen, die erste mit der Nummer 0 („Standard“)', async () => {
    const v = await ladeEventVorlagen();
    expect(v).toHaveLength(2);
    expect(v[0]).toEqual({ id: 0, name: 'Standard' });
    expect(eventVorlagenAus(v)).toHaveLength(2);
  });

  it('Recht „Events anlegen“: die Leitung im Kalender 4, nicht im Kalender 2 – ein Mitglied in keinem', async () => {
    const leitung = eventKalender(await ctDaten('/permissions/global'));
    expect([...leitung]).toEqual([4]);
    expect(leitung.has(2)).toBe(false);
    starten('mitglied');
    expect(eventKalender(await ctDaten('/permissions/global')).size).toBe(0);
  });

  it('POST legt Events an, GET /events liefert sie – und das Nachlesen findet sie', async () => {
    const e = {
      ...eintragVorbelegung({ text: 'Abend, 18 Uhr', datum: '2027-02-02' }, 4),
      kalender: 4,
      art: WIEDERHOLUNG.woechentlich,
      wiederBis: '2027-02-09',
      events: { '2027-02-09': 0 },
    };
    const r = await terminLegen({ eintrag: e, zeitzone: 'Europe/Berlin' });
    expect(r.events).toEqual({ fehlend: [], unklar: false });
    // Ein Termin, der nicht angelegt wurde, hat auch kein Event.
    expect(
      await eventsNachlesen({
        termin: 99999,
        gewuenscht: [{ tag: '2027-02-09', startDate: '2027-02-09T17:00:00Z' }],
      }),
    ).toEqual({ fehlend: ['2027-02-09'], unklar: false });
  });
});
