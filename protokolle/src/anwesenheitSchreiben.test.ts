import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NichtUebernommen } from '@ui/ct/fehler';
import {
  anwesenheitLesen,
  statusSetzen,
  treffenAbschliessen,
  vorbelegen,
} from './anwesenheitSchreiben';
import { nachbauEnde, nachbauStarten, type Nachbau } from './nachbau.testhilfe';

/** Anwesenheit im Gruppentreffen (S5-3) gegen die nachgestellte ChurchTools-Instanz – Wege wie gemessen 05.11.2026. */
let ct: Nachbau;
const G = 194;
const T = 15;

beforeEach(() => {
  ct = nachbauStarten();
  ct.treffen.set(G, [{ id: T, startDate: '2026-11-11T18:00:00Z' }]);
});
afterEach(nachbauEnde);

const schreibAufrufe = () => ct.aufrufe.filter((a) => !a.startsWith('GET'));

describe('anwesenheitLesen', () => {
  it('Treffen und Personen: noch nichts eingetragen = alle offen, nicht begonnen', async () => {
    expect(await anwesenheitLesen(G, T)).toEqual({
      abgeschlossen: false,
      begonnen: false,
      personen: [
        { person: 1, name: 'Alwin Friesen', status: 'offen' },
        { person: 19, name: 'Spike Musiker', status: 'offen' },
      ],
    });
  });
});

describe('anwesenheitLesen – große Gruppe', () => {
  it('liest alle Seiten (ChurchTools liefert die Liste seitenweise)', async () => {
    ct.teilnehmer = Array.from({ length: 112 }, (_, i) => ({
      person: 100 + i,
      vor: 'Person',
      nach: String(100 + i),
    }));
    expect((await anwesenheitLesen(G, T)).personen).toHaveLength(112);
  });
});

describe('statusSetzen', () => {
  it('anwesend über checkin, abwesend und wieder offen über DELETE mit Status – jeweils nachgelesen', async () => {
    expect((await statusSetzen(G, T, 1, 'da')).personen[0].status).toBe('da');
    expect((await statusSetzen(G, T, 1, 'weg')).personen[0].status).toBe('weg');
    const zurueck = await statusSetzen(G, T, 1, 'offen');
    expect(zurueck.personen[0].status).toBe('offen');
    expect(zurueck.begonnen).toBe(true);
    expect(schreibAufrufe()).toEqual([
      `POST /groups/${G}/checkin/1`,
      `DELETE /groups/${G}/meetings/${T}/members/1`,
      `DELETE /groups/${G}/meetings/${T}/members/1`,
    ]);
  });

  it('ChurchTools sagt 200, trägt aber nichts ein: NichtUebernommen', async () => {
    ct.teilnahmeSchlucken = true;
    await expect(statusSetzen(G, T, 1, 'da')).rejects.toBeInstanceOf(NichtUebernommen);
  });

  it('ohne Recht: die Meldung nennt „Gruppentreffen pflegen“', async () => {
    ct.treffenVerboten = true;
    await expect(statusSetzen(G, T, 1, 'da')).rejects.toThrow(/Gruppentreffen zu pflegen/);
  });
});

describe('vorbelegen', () => {
  const anfragen = [
    { person: 1, antwort: 'zugesagt' as const },
    { person: 19, antwort: 'abgesagt' as const },
  ];

  it('Zusage anwesend, Absage abwesend – alles schreiben, dann EINMAL nachlesen', async () => {
    const stand = await anwesenheitLesen(G, T);
    ct.aufrufe.length = 0;
    const neu = await vorbelegen(G, T, stand, anfragen);
    expect(neu.personen.map((p) => [p.person, p.status])).toEqual([
      [1, 'da'],
      [19, 'weg'],
    ]);
    expect(ct.aufrufe.filter((a) => a.startsWith('GET') && a.includes('/members'))).toHaveLength(1);
  });

  it('schon begonnen: schreibt nichts', async () => {
    await statusSetzen(G, T, 1, 'offen'); // jemand hat getippt und zurückgesetzt
    const stand = await anwesenheitLesen(G, T);
    ct.aufrufe.length = 0;
    expect(await vorbelegen(G, T, stand, anfragen)).toBe(stand);
    expect(schreibAufrufe()).toEqual([]);
  });

  it('ChurchTools übernimmt die Vorbelegung nicht: NichtUebernommen', async () => {
    const stand = await anwesenheitLesen(G, T);
    ct.teilnahmeSchlucken = true;
    await expect(vorbelegen(G, T, stand, anfragen)).rejects.toBeInstanceOf(NichtUebernommen);
  });
});

describe('treffenAbschliessen (S6-1, gemessen S6-0)', () => {
  it('schließt ab und behält Kommentar, Gäste und Rückmeldung (ganz gelesen, ganz zurück)', async () => {
    ct.treffen.set(G, [
      {
        id: T,
        startDate: '2026-11-11T18:00:00Z',
        comment: 'Kuchen',
        numGuests: 2,
        pollResult: { ja: 3 },
      },
    ]);
    await treffenAbschliessen(G, T);
    expect(ct.treffen.get(G)![0]).toMatchObject({
      isCompleted: true,
      isCanceled: false,
      comment: 'Kuchen',
      numGuests: 2,
      pollResult: { ja: 3 },
      startDate: '2026-11-11T18:00:00Z',
    });
    // Danach sperrt ChurchTools die Anwesenheit.
    await expect(statusSetzen(G, T, 19, 'da')).rejects.toThrow();
  });

  it('schon abgeschlossen: kein Schreiben', async () => {
    ct.treffen.set(G, [{ id: T, startDate: '2026-11-11T18:00:00Z', isCompleted: true }]);
    await treffenAbschliessen(G, T);
    expect(schreibAufrufe()).toEqual([]);
  });

  it('kein Recht: Fehler statt Erfolg', async () => {
    ct.treffenVerboten = true;
    await expect(treffenAbschliessen(G, T)).rejects.toThrow();
  });

  it('ChurchTools sagt 200, schließt aber nicht ab: nachgelesen → Fehler statt Erfolg', async () => {
    ct.treffenSchlucken = true;
    await expect(treffenAbschliessen(G, T)).rejects.toThrow(/Abschließen des Gruppentreffens/);
  });
});
