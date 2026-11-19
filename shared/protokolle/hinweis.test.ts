import { describe, expect, it } from 'vitest';
import type { Wert } from '../ct/modulDaten';
import {
  alsGeloescht,
  neueAufgabe,
  statusSetzen,
  istUeberfaellig,
  meineOffenen,
  modusSetzen,
  teilSetzen,
} from './aufgaben';
import type { Aufgabe } from './aufgaben';
import {
  faelligZahl,
  faellige,
  hinweisText,
  istBaldFaellig,
  istTodoHinweis,
  istVorlauf,
  neuerHinweis,
  reiterName,
  STANDARD_VORLAUF,
  VORLAUF_WAHL,
  vorlaufAus,
  type Vorlauf,
} from './hinweis';

const HEUTE = '2026-11-19'; // Donnerstag
const ICH = 1;

function todo(id: string, bis: string | null, x: Partial<Aufgabe> = {}): Aufgabe {
  return {
    ...neueAufgabe({ id, gruppe: 11, sitzung: null, text: id, wer: [ICH], bis, von: ICH, am: 'x' }),
    ...x,
  };
}
const ids = (l: readonly Aufgabe[]) => l.map((a) => a.id);
const wert = (id: number, x: unknown): Wert => ({
  id,
  dataCategoryId: 5,
  value: typeof x === 'string' ? x : JSON.stringify(x),
});

describe('istBaldFaellig – die Grenzen', () => {
  it('heute und heute+N zählen, N+1 und gestern nicht', () => {
    expect(istBaldFaellig(todo('a', '2026-11-19'), HEUTE, 3)).toBe(true);
    expect(istBaldFaellig(todo('a', '2026-11-22'), HEUTE, 3)).toBe(true);
    expect(istBaldFaellig(todo('a', '2026-11-23'), HEUTE, 3)).toBe(false);
    expect(istBaldFaellig(todo('a', '2026-11-18'), HEUTE, 3)).toBe(false);
  });

  it('über den Monatswechsel gerechnet (heute+N = erster des Folgemonats)', () => {
    expect(istBaldFaellig(todo('a', '2026-12-01'), '2026-11-28', 3)).toBe(true);
    expect(istBaldFaellig(todo('a', '2026-12-02'), '2026-11-28', 3)).toBe(false);
  });

  it('erledigte, gelöschte und To-Dos ohne Datum nie', () => {
    expect(
      istBaldFaellig(statusSetzen(todo('a', '2026-11-20'), 'erledigt', ICH, 'x'), HEUTE, 3),
    ).toBe(false);
    expect(istBaldFaellig(alsGeloescht(todo('a', '2026-11-20'), ICH, 'x'), HEUTE, 3)).toBe(false);
    expect(istBaldFaellig(todo('a', null), HEUTE, 3)).toBe(false);
  });

  it('in Arbeit zählt (nicht erledigt)', () => {
    expect(
      istBaldFaellig(statusSetzen(todo('a', '2026-11-20'), 'arbeit', ICH, 'x'), HEUTE, 3),
    ).toBe(true);
  });

  it('ein überfälliges To-Do ist nie zugleich bald fällig', () => {
    for (const bis of ['2026-11-01', '2026-11-18', '2026-11-19', '2026-11-20']) {
      const a = todo('a', bis);
      expect(istUeberfaellig(a, HEUTE) && istBaldFaellig(a, HEUTE, 14)).toBe(false);
    }
  });
});

describe('faellige – meine To-Dos unter dem Vorlauf', () => {
  const liste = [
    todo('ueber', '2026-11-10'),
    todo('heute', '2026-11-19'),
    todo('in3', '2026-11-22'),
    todo('in4', '2026-11-23'),
    todo('in14', '2026-12-03'),
    todo('in15', '2026-12-04'),
    todo('ohne', null),
    todo('erledigt', '2026-11-10', { status: 'erledigt' }),
    todo('fremd', '2026-11-10', { wer: [2] }),
    todo('geloescht', '2026-11-10', { geloescht: true }),
  ];

  it('3 Tage (Standard): überfällig + heute…heute+3; nur meine, nur offene', () => {
    const f = faellige(liste, ICH, HEUTE, 3);
    expect(ids(f.ueberfaellig)).toEqual(['ueber']);
    expect(ids(f.bald)).toEqual(['heute', 'in3']);
    expect(faelligZahl(f)).toBe(3);
  });

  it('1, 7 und 14 Tage', () => {
    expect(ids(faellige(liste, ICH, HEUTE, 1).bald)).toEqual(['heute']);
    expect(ids(faellige(liste, ICH, HEUTE, 7).bald)).toEqual(['heute', 'in3', 'in4']);
    expect(ids(faellige(liste, ICH, HEUTE, 14).bald)).toEqual(['heute', 'in3', 'in4', 'in14']);
  });

  it('„Nur Überfällige“: keine bald Fälligen', () => {
    const f = faellige(liste, ICH, HEUTE, 'ueberfaellig');
    expect(ids(f.ueberfaellig)).toEqual(['ueber']);
    expect(f.bald).toEqual([]);
  });

  it('„Aus“: gar nichts – Zahl 0', () => {
    const f = faellige(liste, ICH, HEUTE, 'aus');
    expect(f).toEqual({ ueberfaellig: [], bald: [] });
    expect(faelligZahl(f)).toBe(0);
  });

  it('dieselbe Menge wie „Meine offenen To-Dos“ (meineOffenen): jedes Fällige steht dort', () => {
    const meine = new Set(ids(meineOffenen(liste, ICH, HEUTE)));
    const f = faellige(liste, ICH, HEUTE, 14);
    for (const a of [...f.ueberfaellig, ...f.bald]) expect(meine.has(a.id)).toBe(true);
    // …und die Überfälligen sind genau die, die `meineOffenen` als überfällig gruppiert.
    expect(ids(f.ueberfaellig)).toEqual(
      ids(meineOffenen(liste, ICH, HEUTE).filter((a) => istUeberfaellig(a, HEUTE))),
    );
  });

  it('ein anderer Nutzer zählt seine eigenen', () => {
    expect(ids(faellige(liste, 2, HEUTE, 3).ueberfaellig)).toEqual(['fremd']);
  });
});

describe('faellige – „Jeder für sich“ (W8a)', () => {
  it('hat jemand seinen Teil erledigt, hinweist es für ihn nicht mehr – für die anderen weiter', () => {
    const j = teilSetzen(
      modusSetzen(todo('abw', '2026-11-18', { wer: [ICH, 2, 3] }), true, 9, 'x'),
      ICH,
      true,
      ICH,
      'y',
    );
    expect(j.status).toBe('arbeit'); // Gesamtstand „in Arbeit“ – für mich trotzdem erledigt
    expect(ids(faellige([j], ICH, HEUTE, 3).ueberfaellig)).toEqual([]);
    expect(faelligZahl(faellige([j], ICH, HEUTE, 3))).toBe(0);
    expect(ids(faellige([j], 2, HEUTE, 3).ueberfaellig)).toEqual(['abw']);
  });
});

describe('Hinweis-Wert: Typwächter und Lesen', () => {
  it('gültig', () => {
    for (const w of VORLAUF_WAHL) expect(istTodoHinweis(neuerHinweis(w.wert))).toBe(true);
  });

  it('ungültig: falsche Art, Fassung, Vorlauf, kein Objekt', () => {
    expect(istTodoHinweis({ ...neuerHinweis(3), art: 'vorlage' })).toBe(false);
    expect(istTodoHinweis({ ...neuerHinweis(3), fassung: 2 })).toBe(false);
    expect(istTodoHinweis({ ...neuerHinweis(3), vorlauf: 5 })).toBe(false);
    expect(istTodoHinweis({ ...neuerHinweis(3), vorlauf: '3' })).toBe(false);
    expect(istTodoHinweis(null)).toBe(false);
    expect(istTodoHinweis('x')).toBe(false);
    expect(istVorlauf(30)).toBe(false);
  });

  it('der Standard ist 3 Tage und steht in der Auswahl', () => {
    expect(STANDARD_VORLAUF).toBe(3);
    expect(istVorlauf(STANDARD_VORLAUF)).toBe(true);
  });

  it('kein Wert / nur Vorlagen / fremde Fassung / kaputtes JSON → Standard', () => {
    expect(vorlaufAus([])).toEqual({ vorlauf: 3, wert: null });
    expect(vorlaufAus([wert(1, { art: 'vorlage', fassung: 1 })]).vorlauf).toBe(3);
    expect(vorlaufAus([wert(2, { art: 'todo-hinweis', fassung: 9, vorlauf: 7 })]).vorlauf).toBe(3);
    expect(vorlaufAus([wert(3, '{kaputt')]).vorlauf).toBe(3);
  });

  it('ungültiger Vorlauf im Wert → Standard, aber der Wert wird erkannt (zum Überschreiben)', () => {
    expect(vorlaufAus([wert(4, { art: 'todo-hinweis', fassung: 1, vorlauf: 99 })])).toEqual({
      vorlauf: 3,
      wert: 4,
    });
  });

  it('liest jeden gültigen Vorlauf – auch „aus“, gewählt neben Vorlagen', () => {
    for (const w of VORLAUF_WAHL) {
      expect(
        vorlaufAus([wert(1, { art: 'vorlage', fassung: 1 }), wert(2, neuerHinweis(w.wert))]),
      ).toEqual({ vorlauf: w.wert, wert: 2 });
    }
  });

  it('doppelt vorhanden: der mit der kleinsten ID gilt', () => {
    expect(vorlaufAus([wert(9, neuerHinweis(14)), wert(5, neuerHinweis('aus'))])).toEqual({
      vorlauf: 'aus',
      wert: 5,
    });
  });
});

describe('Band-Text', () => {
  const t = (liste: Aufgabe[], v: Vorlauf) => hinweisText(faellige(liste, ICH, HEUTE, v), v, HEUTE);

  it('nichts fällig → kein Band', () => {
    expect(t([todo('a', '2026-12-31'), todo('b', null)], 3)).toBeNull();
    expect(t([], 3)).toBeNull();
  });

  it('überfällig + ein bald fälliges mit Datum – rot', () => {
    expect(
      t([todo('a', '2026-11-10'), todo('b', '2026-11-12'), todo('c', '2026-11-21')], 3),
    ).toEqual({
      art: 'rot',
      fett: '2 To-Dos überfällig',
      rest: ', 1 bis Sa, 21.11. fällig',
    });
  });

  it('Singular: ein überfälliges To-Do', () => {
    expect(t([todo('a', '2026-11-10')], 3)).toEqual({
      art: 'rot',
      fett: '1 To-Do überfällig',
      rest: '',
    });
  });

  it('nur überfällig mit Vorlauf „nur überfällig“ – kein „bald“-Teil', () => {
    expect(t([todo('a', '2026-11-10'), todo('b', '2026-11-20')], 'ueberfaellig')).toEqual({
      art: 'rot',
      fett: '1 To-Do überfällig',
      rest: '',
    });
  });

  it('nur bald fällig, mehrere Fristen → Zeitraum, ruhig (nicht rot)', () => {
    expect(t([todo('a', '2026-11-20'), todo('b', '2026-11-25')], 7)).toEqual({
      art: 'ruhig',
      fett: '2 To-Dos',
      rest: ' in den nächsten 7 Tagen fällig',
    });
  });

  it('nur bald fällig, ein einziger Tag → mit Datum; heute → „heute“', () => {
    expect(t([todo('a', '2026-11-21'), todo('b', '2026-11-21')], 3)).toEqual({
      art: 'ruhig',
      fett: '2 To-Dos',
      rest: ' bis Sa, 21.11. fällig',
    });
    expect(t([todo('a', HEUTE)], 3)).toEqual({
      art: 'ruhig',
      fett: '1 To-Do',
      rest: ' heute fällig',
    });
  });

  it('1 Tag Vorlauf mit heute und morgen → „heute oder morgen“', () => {
    expect(t([todo('a', HEUTE), todo('b', '2026-11-20')], 1)?.rest).toBe(
      ' heute oder morgen fällig',
    );
  });

  it('„Aus“ → kein Band', () => {
    expect(t([todo('a', '2026-11-10')], 'aus')).toBeNull();
  });
});

describe('Name des Reiters', () => {
  it('mit Zahl: Klartext für Vorleser; ohne Zahl nur „To-Dos“', () => {
    expect(reiterName(3)).toBe('To-Dos, 3 fällig');
    expect(reiterName(0)).toBe('To-Dos');
  });
});
