import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { istAufgabe, neueAufgabe, type Aufgabe } from '@shared/protokolle/aufgaben';
import { warumVon } from '@shared/protokolle/todoVorschlag';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { gruppeEinrichten } from './einrichten';
import { aufgabeAendern, aufgabenWerte } from './aufgabenSchreiben';
import { ladeAufgaben, ladeMitarbeit, ladeUebersicht } from './lesen';
import {
  kategorieVon,
  LEITER,
  MODUL,
  nachbauEnde,
  nachbauStarten,
  TEILNEHMER,
  werteVon,
  type Nachbau,
} from './nachbau.testhilfe';
import { toDoAendern, toDoLoeschen } from './todoSchreiben';
import {
  todoVorschlagAblehnen,
  todoVorschlagAendern,
  todoVorschlagUebernehmen,
  todoVorschlagZurueckziehen,
  vorschlagAnlegen,
} from './todoVorschlagSchreiben';

/**
 * **To-Do-Vorschläge schreiben und lesen** (W9b) – gegen die nachgestellte ChurchTools-Instanz (`nachbau.testhilfe.ts`): die
 * echten Leser und Schreibwege, nur ChurchTools ist nachgebaut. Ich bin Person 1; Peter (19) ist Mitarbeiter, Johann (7) Leitung.
 */
let ct: Nachbau;
const JETZT = new Date('2026-11-20T10:00:00Z');
const ZONE = 'Europe/Berlin';
const ICH = { person: 1, name: 'Alwin Friesen' };
const PETER = { person: 19, name: 'Peter Wiens' };
const LEITUNG = { person: 7, name: 'Johann Becker' };

const gruppe = () => ({
  id: 194,
  name: 'Technik',
  lage: 'eingerichtet' as const,
  protokolle: kategorieVon(ct, 'protokolle-g194'),
  mitarbeit: kategorieVon(ct, 'mitarbeit-g194'),
});
const ort = () => ({ modul: MODUL, kategorie: gruppe().mitarbeit });
const lies = (): Aufgabe[] =>
  werteVon(ct, gruppe().mitarbeit)
    .map((w) => JSON.parse(w.value) as unknown)
    .filter(istAufgabe);
const schreibVorgaenge = () => ct.aufrufe.filter((x) => !x.startsWith('GET')).length;

const vorschlagen = (id = 'v1', von = PETER, text = 'Kabel neu ordnen') =>
  vorschlagAnlegen(
    ort(),
    { neueId: id, gruppe: 194, text, bis: '2026-12-01', warum: 'Wir suchen jedes Mal.' },
    von,
  );
const meldung = async (p: Promise<unknown>): Promise<string> =>
  fehlerMeldung(
    await p.then(
      () => undefined,
      (e: unknown) => e,
    ),
  ).text;

beforeEach(async () => {
  ct = nachbauStarten();
  await gruppeEinrichten(
    MODUL,
    { id: 194, name: 'Technik', versteckt: false },
    {
      rollen: [
        { rolle: LEITER, stufe: 'leitung' },
        { rolle: TEILNEHMER, stufe: 'mitglied' },
      ],
      punkte: 'vorschlagen',
      kalender: null,
    },
  );
});
afterEach(nachbauEnde);

describe('vorschlagen und lesen', () => {
  it('ein Mitarbeiter schlägt vor: ein Datensatz mit Kennzeichen, nachgelesen', async () => {
    const a = await vorschlagen();
    expect(a.vorschlag).toMatchObject({ stand: 'offen', von: 19, name: 'Peter' });
    expect(lies()).toEqual([a]);
    expect(warumVon(a)).toBe('Wir suchen jedes Mal.');
  });

  it('zweiter Versuch mit derselben ID legt nichts doppelt an', async () => {
    await vorschlagen('v1');
    await vorschlagen('v1');
    expect(lies()).toHaveLength(1);
  });

  it('ohne Text: 409, nichts geschrieben', async () => {
    const vorher = schreibVorgaenge();
    expect(
      await meldung(
        vorschlagAnlegen(
          ort(),
          { neueId: 'x', gruppe: 194, text: ' ', bis: null, warum: '' },
          PETER,
        ),
      ),
    ).toMatch(/braucht einen Text/);
    expect(schreibVorgaenge()).toBe(vorher);
  });

  describe('LESER: ein Vorschlag ist kein To-Do', () => {
    const todo = () =>
      neueAufgabe({
        id: 't1',
        gruppe: 194,
        sitzung: null,
        text: 'Echtes To-Do',
        von: 7,
        am: '2026-11-01T10:00:00Z',
      });
    const ablegen = async () => {
      werteVon(ct, gruppe().mitarbeit).push({ id: ct.naechste++, value: JSON.stringify(todo()) });
      await vorschlagen('v1');
    };

    it('ladeMitarbeit: To-Dos ohne Vorschläge, die Vorschläge getrennt', async () => {
      await ablegen();
      const m = await ladeMitarbeit(MODUL, gruppe());
      expect(m.aufgaben.map((a) => a.id)).toEqual(['t1']);
      expect(m.todoVorschlaege.map((a) => a.id)).toEqual(['v1']);
    });

    it('ladeAufgaben (Startseite-Zähler, Hinweis am Reiter, feste Punkte, Suche): ohne Vorschläge', async () => {
      await ablegen();
      expect((await ladeAufgaben(MODUL, gruppe())).map((a) => a.id)).toEqual(['t1']);
    });

    it('ladeUebersicht (Reiter To-Dos, Startseite, Suche): `aufgaben` ohne, `todoVorschlaege` mit', async () => {
      await ablegen();
      const [u] = await ladeUebersicht(MODUL, [gruppe()], ZONE, JETZT);
      expect(u.aufgaben.map((a) => a.id)).toEqual(['t1']);
      expect(u.todoVorschlaege.map((a) => a.id)).toEqual(['v1']);
    });

    it('aufgabenWerte (Abgleich mit dem Protokoll, Protokoll löschen, Verschieben, Editor): ohne Vorschläge', async () => {
      await ablegen();
      expect((await aufgabenWerte(ort())).map((w) => w.aufgabe.id)).toEqual(['t1']);
    });

    it('zurückgezogene Vorschläge fehlen auch in `todoVorschlaege`', async () => {
      await ablegen();
      await todoVorschlagZurueckziehen(ort(), 'v1', PETER);
      expect((await ladeMitarbeit(MODUL, gruppe())).todoVorschlaege).toEqual([]);
    });
  });
});

describe('die normalen To-Do-Wege lehnen einen Vorschlag ab (409, nichts geschrieben)', () => {
  const nichtGeschrieben = async (f: () => Promise<unknown>, muster: RegExp) => {
    const vorher = schreibVorgaenge();
    expect(await meldung(f())).toMatch(muster);
    expect(schreibVorgaenge()).toBe(vorher);
  };

  it('Haken/Status (Mitarbeiter und Leitung), „Das mache ich“, Notiz', async () => {
    await vorschlagen();
    await nichtGeschrieben(
      () => toDoAendern(ort(), 'v1', { status: 'erledigt' }, PETER),
      /noch ein Vorschlag/,
    );
    await nichtGeschrieben(
      () => toDoAendern(ort(), 'v1', { status: 'erledigt' }, LEITUNG, true),
      /noch ein Vorschlag/,
    );
    await nichtGeschrieben(() => toDoAendern(ort(), 'v1', { wer: [1] }, ICH), /noch ein Vorschlag/);
    await nichtGeschrieben(
      () => toDoAendern(ort(), 'v1', { notiz: 'Hallo' }, ICH, true),
      /noch ein Vorschlag/,
    );
  });

  it('Löschen und der Editor-Weg (`aufgabeAendern`)', async () => {
    await vorschlagen();
    await nichtGeschrieben(() => toDoLoeschen(ort(), 'v1', LEITUNG, true), /noch ein Vorschlag/);
    await nichtGeschrieben(
      () =>
        aufgabeAendern(
          ort(),
          'v1',
          (a) => ({ ...a, status: 'erledigt' }),
          () => {
            throw new Error('nicht anlegen');
          },
          LEITUNG,
        ),
      /noch ein Vorschlag/,
    );
    expect(lies()[0].vorschlag?.stand).toBe('offen');
  });
});

describe('Rechte im Schreibweg', () => {
  it('ein Mitarbeiter übernimmt nicht (409)', async () => {
    await vorschlagen();
    const vorher = schreibVorgaenge();
    expect(
      await meldung(todoVorschlagUebernehmen(ort(), 'v1', { wer: [19] }, PETER, false)),
    ).toMatch(/nur die Leitung/);
    expect(await meldung(todoVorschlagAblehnen(ort(), 'v1', '', PETER, false))).toMatch(
      /nur die Leitung/,
    );
    expect(schreibVorgaenge()).toBe(vorher);
    expect(lies()[0].vorschlag?.stand).toBe('offen');
  });

  it('ein fremder Mitarbeiter zieht nicht zurück und ändert nicht (409)', async () => {
    await vorschlagen('v1', PETER);
    const vorher = schreibVorgaenge();
    expect(await meldung(todoVorschlagZurueckziehen(ort(), 'v1', ICH, false))).toMatch(
      /gemacht hat/,
    );
    expect(
      await meldung(
        todoVorschlagAendern(ort(), 'v1', { text: 'x', bis: null, warum: '' }, ICH, false),
      ),
    ).toMatch(/gemacht hat/);
    expect(schreibVorgaenge()).toBe(vorher);
    expect(lies()[0].geloescht).toBe(false);
  });

  it('die Leitung ändert den Vorschlag eines anderen nicht', async () => {
    await vorschlagen('v1', PETER);
    expect(
      await meldung(
        todoVorschlagAendern(ort(), 'v1', { text: 'x', bis: null, warum: '' }, LEITUNG, true),
      ),
    ).toMatch(/gemacht hat/);
  });
});

describe('übernehmen, ablehnen, ändern, zurückziehen', () => {
  it('Übernehmen durch die Leitung: derselbe Datensatz ist ein To-Do – nachgelesen, in der Übersicht, keine Kopie', async () => {
    await vorschlagen();
    const t = await todoVorschlagUebernehmen(ort(), 'v1', { wer: [19, 23] }, LEITUNG, true);
    expect(t.vorschlag).toBeUndefined();
    expect(t.wer).toEqual([19, 23]);
    const gelesen = lies();
    expect(gelesen).toHaveLength(1);
    expect(gelesen[0]).toEqual(t);
    expect(gelesen[0].verlauf.map((e) => e.art)).toContain('uebernommen');
    const m = await ladeMitarbeit(MODUL, gruppe());
    expect(m.aufgaben.map((a) => a.id)).toEqual(['v1']);
    expect(m.todoVorschlaege).toEqual([]);
  });

  it('nach dem Übernehmen gelten die normalen Wege: Peter hakt ab', async () => {
    await vorschlagen();
    await todoVorschlagUebernehmen(ort(), 'v1', { wer: [19] }, LEITUNG, true);
    const n = await toDoAendern(ort(), 'v1', { status: 'erledigt' }, PETER);
    expect(n.status).toBe('erledigt');
  });

  it('Übernehmen eines inzwischen zurückgezogenen Vorschlags: 409 „nicht mehr offen“, nichts wird zum To-Do', async () => {
    await vorschlagen();
    await todoVorschlagZurueckziehen(ort(), 'v1', PETER);
    expect(
      await meldung(todoVorschlagUebernehmen(ort(), 'v1', { wer: [19] }, LEITUNG, true)),
    ).toMatch(/nicht mehr offen/);
    expect(lies()[0]).toMatchObject({ geloescht: true });
    expect(lies()[0].vorschlag).toBeDefined();
  });

  it('Ablehnen: Stand, Begründung, 7 Tage; danach lässt er sich nicht mehr übernehmen', async () => {
    await vorschlagen();
    const n = await todoVorschlagAblehnen(ort(), 'v1', 'Haben wir schon.', LEITUNG, true);
    expect(n.vorschlag).toMatchObject({ stand: 'abgelehnt', grund: 'Haben wir schon.' });
    expect(await meldung(todoVorschlagUebernehmen(ort(), 'v1', {}, LEITUNG, true))).toMatch(
      /nicht mehr offen/,
    );
  });

  it('Ändern durch den Vorschlagenden: Text, Bis, Warum; Zurückziehen: gelöscht vermerkt, nie hart gelöscht', async () => {
    await vorschlagen();
    const g = await todoVorschlagAendern(
      ort(),
      'v1',
      { text: 'Kabel sortieren', bis: null, warum: 'Neu.' },
      PETER,
    );
    expect(g).toMatchObject({ text: 'Kabel sortieren', bis: null });
    expect(warumVon(g)).toBe('Neu.');
    const z = await todoVorschlagZurueckziehen(ort(), 'v1', PETER);
    expect(z.geloescht).toBe(true);
    expect(lies()).toHaveLength(1);
    expect(lies()[0].verlauf.at(-1)).toMatchObject({
      art: 'zurueckgezogen',
      von: 19,
      name: 'Peter',
    });
  });
});
