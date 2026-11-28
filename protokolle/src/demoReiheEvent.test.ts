// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _bremseLoesen, _vergissCsrf, ctDaten } from '@ui/ct/verbindung';
import { eventKalender } from '@shared/ct/eventRechte';
import { schreibbareKalender } from '@shared/ct/kalenderRechte';
import { plusTage } from '@shared/ct/datum';
import { heuteImKalender } from '@shared/ct/zeit';
import { kalenderMitEvents } from '@shared/protokolle/reiheEventAnlegen';
import { demoStarten } from './demo';
import { eventsPfad } from './eventsLesen';
import { reiheEventsAnlegen } from './reiheEventAnlegen';

/** Reihe, Scheibe 3, in `?demo`: Das Anlegen ist durchklickbar – ein Event entsteht wirklich, ein Tag mit ähnlichem Termin nicht. */
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

const EINGABE = { kalender: 4, titel: 'Technik im Advent', von: '19:30', bis: '21:30', vorlage: 0 };
const anlegen = (tage: string[], titel = EINGABE.titel) =>
  reiheEventsAnlegen({
    abende: tage.map((tag, i) => ({ id: `z${i}`, tag })),
    eingabe: { ...EINGABE, titel },
    kalenderName: 'Gemeindeleitung',
    zeitzone: 'Europe/Berlin',
  });

describe('Demo: Event aus der Reihe anlegen', () => {
  it('die Leitung darf in Kalender 4 Termine UND Events anlegen, ein Mitglied in keinem', async () => {
    const recht = async () =>
      kalenderMitEvents(
        [...schreibbareKalender(await ctDaten('/permissions/global'))],
        [...eventKalender(await ctDaten('/permissions/global'))],
      );
    expect(await recht()).toEqual([4]);
    starten('mitglied');
    expect(await recht()).toEqual([]);
  });

  it('ein neuer Abend: Termin und Event entstehen, das Nachlesen findet das Event mit Nummer und Titel', async () => {
    const r = await anlegen(['2027-01-27'], 'Jugendabend');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      art: 'angelegt',
      tag: '2027-01-27',
      event: { name: 'Jugendabend', tag: '2027-01-27', kalenderId: 4 },
    });
    // Das Event steht danach auch in „Event wählen“ (`GET /events`).
    const liste = await ctDaten<{ id: number }[]>(eventsPfad('2027-01-26', '2027-01-28'));
    expect(liste.some((e) => r[0].art === 'angelegt' && e.id === r[0].event.id)).toBe(true);
  });

  it('der letzte Abend von „Technik im Advent“ hat im Kalender schon einen ähnlichen Termin – dort wird nichts angelegt', async () => {
    const heute = heuteImKalender();
    const frei = plusTage(heute, 21);
    const belegt = plusTage(heute, 28);
    const r = await anlegen([frei, belegt]);
    expect(r.map((x) => x.art)).toEqual(['angelegt', 'schonDa']);
    expect(r[1]).toMatchObject({ titel: 'Technik im Advent – Aufbau Heiligabend' });
    // Für den belegten Tag entstand kein Event.
    const am = await ctDaten<unknown[]>(eventsPfad(plusTage(belegt, -1), plusTage(belegt, 1)));
    expect(am).toEqual([]);
  });

  it('noch einmal für denselben Abend: jetzt steht der Termin da – nichts wird doppelt angelegt', async () => {
    const tag = '2027-03-03';
    expect((await anlegen([tag], 'Jugendabend'))[0].art).toBe('angelegt');
    expect((await anlegen([tag], 'Jugendabend'))[0].art).toBe('schonDa');
  });
});
