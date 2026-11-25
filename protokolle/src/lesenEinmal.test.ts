import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { gruppeEinrichten } from './einrichten';
import { ladeUebersicht } from './lesen';
import {
  kategorieVon,
  LEITER,
  MODUL,
  nachbauEnde,
  nachbauStarten,
  TEILNEHMER,
  type Nachbau,
} from './nachbau.testhilfe';

/**
 * **Jede Adresse nur einmal je Ladevorgang** (gemessen 25.11.2026 live im Reiter „Termine“: 95 Abrufe, 52 doppelt). Gruppen
 * im selben Kalender lasen dieselben Termine, Besprechungsanfragen, Kategorien und Protokoll-Werte je Gruppe noch einmal
 * (`andereImKalender`, `termineMitAnfrage`). Gezählt wird gegen den Nachbau – mit Abfrage (`adressen`), damit
 * verschiedene Zeiträume nicht als Doppelung zählen.
 */
let ct: Nachbau;
const JETZT = new Date('2026-11-17T10:00:00Z');
const ZONE = 'Europe/Berlin';
const IDS = [194, 195, 196];
const gruppe = (id: number) => ({
  id,
  name: `G${id}`,
  versteckt: false,
  lage: 'eingerichtet' as const,
  protokolle: kategorieVon(ct, `protokolle-g${id}`),
  mitarbeit: kategorieVon(ct, `mitarbeit-g${id}`),
});
const laden = () => ladeUebersicht(MODUL, IDS.map(gruppe), ZONE, JETZT);
const doppelte = () => {
  const n = new Map<string, number>();
  for (const a of ct.adressen) n.set(a, (n.get(a) ?? 0) + 1);
  return [...n].filter(([, k]) => k > 1).map(([a]) => a);
};

beforeEach(async () => {
  ct = nachbauStarten();
  for (const id of IDS)
    await gruppeEinrichten(
      MODUL,
      { id, name: `G${id}`, versteckt: false },
      {
        rollen: [
          { rolle: LEITER, stufe: 'leitung' },
          { rolle: TEILNEHMER, stufe: 'mitglied' },
        ],
        punkte: 'vorschlagen',
        kalender: 4,
      },
    );
  ct.termine = [
    {
      kalender: 4,
      id: 114,
      titel: 'Treffen',
      beginn: '2026-11-24T18:00:00Z',
      anfragen: [{ person: 1, state: 'accepted' }],
    },
  ];
  ct.aufrufe.length = 0;
  ct.adressen.length = 0;
});
afterEach(nachbauEnde);

describe('ladeUebersicht – jede Adresse einmal', () => {
  it('drei Gruppen im selben Kalender: keine Adresse doppelt (vorher 30 Abrufe auf 15 Adressen)', async () => {
    const u = await laden();
    expect(doppelte()).toEqual([]);
    expect(ct.adressen).toHaveLength(15);
    // Termine, Besprechungsanfragen und die Kategorien kommen genau einmal – nicht je Gruppe.
    expect(ct.adressen.filter((a) => a.startsWith('GET /calendars/appointments?'))).toHaveLength(1);
    expect(ct.adressen.filter((a) => a.endsWith('/meetingrequests'))).toHaveLength(1);
    expect(ct.adressen.filter((a) => a.endsWith('/customdatacategories'))).toHaveLength(1);
    // Das Ergebnis ist dasselbe wie vorher: Jede Gruppe sieht den Termin mit der Zusage.
    for (const g of u)
      expect(g.sitzungen.kommend.map((s) => [s.termin?.id, s.anfragen?.length])).toEqual([
        [114, 1],
      ]);
  });

  it('ein neuer Ladevorgang fragt neu – nach „Eintragen“ oder „Erneut versuchen“ zählt der frische Stand', async () => {
    await laden();
    ct.termine[0].anfragen = [];
    const u = await laden();
    // Termine und Besprechungsanfragen je Ladevorgang einmal – also jetzt zweimal, und der neue Stand ist da.
    expect(ct.adressen.filter((a) => a.startsWith('GET /calendars/appointments?'))).toHaveLength(2);
    expect(ct.adressen.filter((a) => a.endsWith('/meetingrequests'))).toHaveLength(2);
    expect(u.map((g) => g.sitzungen.kommend.length)).toEqual([0, 0, 0]);
  });
});
