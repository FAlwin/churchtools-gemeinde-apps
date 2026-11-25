// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _bremseLoesen, _vergissCsrf, ctAnfrage, ctDaten } from '@ui/ct/verbindung';
import { _vergissGemeindeZeitzone, merkeGemeindeZeitzone } from '@shared/ct/zeit';
import { gruppenTypenAnlegen } from '@shared/ct/gruppenTypRechte';
import { eintragVorbelegung } from '@shared/protokolle/termine';
import { WIEDERHOLUNG } from '@shared/protokolle/terminWiederholung';
import { demoStarten } from './demo';
import { anmeldungNachlesen, ladeGruppenDesTyps, ladeGruppentypen } from './anmeldungLesen';
import { terminLegen } from './terminEintragen';

/**
 * W15-5: In `?demo` gibt es drei Gruppentypen (einer nicht erlaubt), je Typ 1–3 Gruppen als Kopiervorlage, und `POST` mit
 * `signup` legt die Gruppen wirklich an (und Löschen nimmt sie mit).
 */
const echtesFetch = window.fetch;

const starten = (fall: string) => {
  _vergissCsrf();
  _bremseLoesen();
  (window as { settings?: { base_url?: string } }).settings = { base_url: 'https://ct.test/' };
  demoStarten(fall);
};
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-25T12:00:00Z'));
  merkeGemeindeZeitzone({ timezone: 'Europe/Berlin' });
  starten('x');
});
afterEach(() => {
  vi.useRealTimers();
  _vergissGemeindeZeitzone();
  window.fetch = echtesFetch;
  delete (window as { settings?: unknown }).settings;
  vi.restoreAllMocks();
});

describe('Demo: Anmeldung', () => {
  it('Recht: die Leitung darf in zwei Typen anlegen (nicht „Dienst“), ein Mitglied in keinem – dann fehlt der Reiter', async () => {
    expect([...gruppenTypenAnlegen(await ctDaten('/permissions/global'))]).toEqual([1, 5]);
    starten('mitglied');
    expect(gruppenTypenAnlegen(await ctDaten('/permissions/global')).size).toBe(0);
  });

  it('drei Gruppentypen in der Demo, die Auswahl führt nur die erlaubten', async () => {
    expect(await ctDaten<unknown[]>('/group/grouptypes')).toHaveLength(3);
    expect((await ladeGruppentypen(new Set([1, 5]))).map((t) => t.id)).toEqual([1, 5]);
  });

  it('je Typ 1 bis 3 Gruppen als Kopiervorlage – nur die des gewählten Typs', async () => {
    expect((await ladeGruppenDesTyps(1)).map((g) => g.name)).toEqual([
      'Hauskreis Nord',
      'Jugendkreis',
    ]);
    expect(await ladeGruppenDesTyps(2)).toHaveLength(1);
    expect(await ladeGruppenDesTyps(5)).toHaveLength(3);
  });

  it('POST mit `signup` legt die Gruppen an, GET liefert sie, das Nachlesen findet sie – Löschen nimmt sie mit', async () => {
    const e = {
      ...eintragVorbelegung({ text: 'Demo-Anmeldung, 19 Uhr', datum: '2026-11-26' }, 4),
      kalender: 4,
      art: WIEDERHOLUNG.woechentlich,
      wiederBis: '2026-12-24',
      anmeldung: { typ: 5, tage: 14, vorlage: 304, beenden: null },
    };
    const r = await terminLegen({ eintrag: e, zeitzone: 'Europe/Berlin' });
    expect(r.anmeldung).toEqual({ signupFehlt: false, fehlend: [], unklar: false });
    const neu = (await ladeGruppenDesTyps(5)).filter((g) => g.name.startsWith('Demo-Anmeldung'));
    expect(neu.map((g) => g.name)).toEqual([
      'Demo-Anmeldung – 03.12.2026, 19:00',
      'Demo-Anmeldung – 26.11.2026, 19:00',
    ]);
    // Ein Termin, der nicht angelegt wurde, hat auch kein `signup`.
    expect(
      await anmeldungNachlesen({ signup: null, typ: 5, titel: 'x', erwartet: [] }),
    ).toMatchObject({ signupFehlt: true });
    await ctAnfrage(`/calendars/4/appointments/${r.id}`, { method: 'DELETE' });
    expect(
      (await ladeGruppenDesTyps(5)).filter((g) => g.name.startsWith('Demo-Anmeldung')),
    ).toEqual([]);
  });
});
