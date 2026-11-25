// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { eintragVorbelegung } from '@shared/protokolle/termine';
import { ladeKandidaten } from './besprechungsanfragen';
import { demoStarten } from './demo';
import { ladeSchreibKalender } from './kalenderListe';
import { terminLegen } from './terminEintragen';

/** W15-4: In `?demo` hat der Gruppenkalender 4 Kandidaten (einer doppelt wie gemessen), der Gemeindekalender 2 keinen Reiter. */
const echtesFetch = window.fetch;
beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  (window as { settings?: { base_url?: string } }).settings = { base_url: 'https://ct.test/' };
  demoStarten('x');
});
afterEach(() => {
  window.fetch = echtesFetch;
  delete (window as { settings?: unknown }).settings;
  vi.restoreAllMocks();
});

describe('Demo: Besprechungsanfragen', () => {
  it('Gruppenkalender 4 mit Reiter, Gemeindekalender 2 ohne', async () => {
    const k = await ladeSchreibKalender([4, 2]);
    expect(k.find((x) => x.id === 4)?.gruppe).toBe(true);
    expect(k.find((x) => x.id === 2)?.gruppe).toBe(false);
  });

  it('vier Personen – Alwin kommt einmal, mit Gruppe', async () => {
    const l = await ladeKandidaten(4);
    expect(l).toHaveLength(4);
    expect(l.find((x) => x.id === 1)).toEqual({
      id: 1,
      name: 'Alwin Friesen',
      gruppe: 'Leitungsteam',
    });
  });

  it('Anlegen mit Besprechungsanfragen: das Nachlesen findet alle', async () => {
    const e = {
      ...eintragVorbelegung({ text: 'Abend, 18 Uhr', datum: '2027-02-02' }, 4),
      kalender: 4,
    };
    const r = await terminLegen({ eintrag: e, zeitzone: 'Europe/Berlin', eingeladen: [1, 19, 20] });
    expect(r.anfragen).toEqual({ fehlend: [], unklar: false });
  });
});
