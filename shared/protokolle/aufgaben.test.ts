import { describe, expect, it } from 'vitest';
import {
  alsGeloescht,
  erledigtAm,
  erledigtSeit,
  gruppieren,
  istAufgabe,
  istMeine,
  istUeberfaellig,
  naechsterStatus,
  neueAufgabe,
  notizHinzufuegen,
  statusSetzen,
  type Aufgabe,
} from './aufgaben';

const basis = (text: string, extra: Partial<Parameters<typeof neueAufgabe>[0]> = {}): Aufgabe =>
  neueAufgabe({
    id: text,
    gruppe: 11,
    sitzung: 's1',
    text,
    von: 1,
    am: '2026-10-16T19:30:00Z',
    ...extra,
  });

describe('neueAufgabe', () => {
  it('beginnt offen, mit Verlauf „angelegt“, bereinigt Text und doppelte Zuständige', () => {
    const a = basis('  Beamer  ', { wer: [3, 3, 4], extern: ' Hausmeister Müller ' });
    expect(a).toMatchObject({
      text: 'Beamer',
      wer: [3, 4],
      extern: 'Hausmeister Müller',
      status: 'offen',
      geloescht: false,
    });
    expect(a.verlauf).toEqual([{ am: '2026-10-16T19:30:00Z', von: 1, art: 'angelegt' }]);
    expect(istAufgabe(a)).toBe(true);
  });
});

describe('Status', () => {
  it('der Kreis geht offen → in Arbeit → erledigt → offen', () => {
    expect(naechsterStatus('offen')).toBe('arbeit');
    expect(naechsterStatus('arbeit')).toBe('erledigt');
    expect(naechsterStatus('erledigt')).toBe('offen');
  });
  it('statusSetzen schreibt den Verlauf und lässt das Original unberührt', () => {
    const a = basis('X');
    const b = statusSetzen(a, 'erledigt', 3, '2026-10-20T08:00:00Z');
    expect(a.status).toBe('offen');
    expect(b.status).toBe('erledigt');
    expect(erledigtAm(b)).toBe('2026-10-20T08:00:00Z');
    expect(statusSetzen(b, 'erledigt', 3, 'später')).toBe(b);
  });
  it('erledigtAm nimmt das letzte Erledigen und ist leer, wenn wieder offen', () => {
    let a = basis('X');
    a = statusSetzen(a, 'erledigt', 3, '2026-10-20T08:00:00Z');
    a = statusSetzen(a, 'offen', 3, '2026-10-21T08:00:00Z');
    expect(erledigtAm(a)).toBeNull();
    a = statusSetzen(a, 'erledigt', 3, '2026-10-22T08:00:00Z');
    expect(erledigtAm(a)).toBe('2026-10-22T08:00:00Z');
  });
});

describe('notizHinzufuegen / alsGeloescht', () => {
  it('leere Notizen zählen nicht', () => {
    const a = basis('X');
    expect(notizHinzufuegen(a, '   ', 1, 't')).toBe(a);
    expect(notizHinzufuegen(a, ' Angebot angefragt ', 1, 't').verlauf.at(-1)).toEqual({
      am: 't',
      von: 1,
      art: 'notiz',
      text: 'Angebot angefragt',
    });
  });
  it('löschen ist nur ein Vermerk – mit Verlauf, wer es war', () => {
    const a = alsGeloescht(basis('X', { wer: [5] }), 5, 't');
    expect(a.geloescht).toBe(true);
    expect(a.verlauf.at(-1)).toEqual({ am: 't', von: 5, art: 'geloescht' });
    expect(istMeine(a, 5)).toBe(false);
    expect(alsGeloescht(a, 6, 'später')).toBe(a);
  });
});

describe('istUeberfaellig', () => {
  it('nur offen/in Arbeit mit Datum vor heute', () => {
    expect(istUeberfaellig(basis('X', { bis: '2026-10-15' }), '2026-10-16')).toBe(true);
    expect(istUeberfaellig(basis('X', { bis: '2026-10-16' }), '2026-10-16')).toBe(false);
    expect(istUeberfaellig(basis('X'), '2026-10-16')).toBe(false);
    expect(
      istUeberfaellig(
        statusSetzen(basis('X', { bis: '2026-10-01' }), 'erledigt', 1, 't'),
        '2026-10-16',
      ),
    ).toBe(false);
  });
});

describe('gruppieren', () => {
  it('ordnet wie im Entwurf und lässt Gelöschte weg', () => {
    const heute = '2026-10-16';
    const liste = [
      basis('ohne Datum'),
      basis('später', { bis: '2026-11-30' }),
      basis('bald', { bis: '2026-10-20' }),
      basis('zu spät', { bis: '2026-10-10' }),
      statusSetzen(basis('läuft', { bis: '2026-10-30' }), 'arbeit', 1, 't'),
      statusSetzen(basis('fertig alt'), 'erledigt', 1, '2026-10-01T00:00:00Z'),
      statusSetzen(basis('fertig neu'), 'erledigt', 1, '2026-10-12T00:00:00Z'),
      alsGeloescht(basis('weg', { bis: '2026-10-01' }), 1, 't'),
    ];
    const g = gruppieren(liste, heute);
    expect(g.ueberfaellig.map((a) => a.text)).toEqual(['zu spät']);
    expect(g.arbeit.map((a) => a.text)).toEqual(['läuft']);
    expect(g.offen.map((a) => a.text)).toEqual(['bald', 'später', 'ohne Datum']);
    expect(g.erledigt.map((a) => a.text)).toEqual(['fertig neu', 'fertig alt']);
  });
});

describe('erledigtSeit', () => {
  it('nur nach der letzten Sitzung erledigte', () => {
    const liste = [
      statusSetzen(basis('vorher'), 'erledigt', 1, '2026-09-10T00:00:00Z'),
      statusSetzen(basis('danach'), 'erledigt', 1, '2026-10-01T00:00:00Z'),
      basis('offen'),
    ];
    expect(erledigtSeit(liste, '2026-09-18T19:30:00Z').map((a) => a.text)).toEqual(['danach']);
  });
});

describe('istAufgabe', () => {
  it('weist fremde Werte ab', () => {
    expect(istAufgabe(null)).toBe(false);
    expect(istAufgabe({ art: 'aufgabe', fassung: 2 })).toBe(false);
    expect(istAufgabe({ ...basis('X'), status: 'fertig' })).toBe(false);
  });
});
