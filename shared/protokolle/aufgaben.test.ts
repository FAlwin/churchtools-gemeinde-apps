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
  meineOffenen,
  statusText,
  aufgabenAbgleich,
  aufgabenIdsVergeben,
} from './aufgaben';
import { ableiten, type Block } from './dokument';
import { STANDARD_VORLAGEN, startDokument } from './vorlagen';

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

describe('meineOffenen (S3-3)', () => {
  const a = (id: string, teil: Partial<Aufgabe>): Aufgabe => ({
    ...neueAufgabe({
      id,
      gruppe: 1,
      sitzung: null,
      text: id,
      wer: [1],
      von: 1,
      am: '2026-10-01T10:00:00Z',
    }),
    ...teil,
  });
  it('nur meine, nicht erledigt, nicht gelöscht – überfällig, in Arbeit, offen; je nach Frist', () => {
    const liste = [
      a('offen-spaet', { bis: '2026-12-01' }),
      a('offen-frueh', { bis: '2026-11-01' }),
      a('arbeit', { status: 'arbeit', bis: '2026-12-24' }),
      a('ueberfaellig', { bis: '2026-10-01' }),
      a('erledigt', { status: 'erledigt' }),
      a('fremd', { wer: [19] }),
      a('weg', { geloescht: true }),
    ];
    expect(meineOffenen(liste, 1, '2026-10-23').map((x) => x.id)).toEqual([
      'ueberfaellig',
      'arbeit',
      'offen-frueh',
      'offen-spaet',
    ]);
  });
});

describe('statusText (S3-4b)', () => {
  it('„in Arbeit“ – die anderen heißen wie ihr Wert', () => {
    expect((['offen', 'arbeit', 'erledigt'] as const).map(statusText)).toEqual([
      'offen',
      'in Arbeit',
      'erledigt',
    ]);
  });
});

describe('Abgleich Protokoll ↔ To-Dos (S4-2)', () => {
  const AM = '2026-10-24T18:00:00Z';
  const aufgabeBlock = (
    id: string,
    aufgabe: string,
    text: string,
    children: Block[] = [],
  ): Block => ({
    id,
    type: 'aufgabe',
    props: { aufgabe },
    content: [{ type: 'text', text, styles: {} }],
    children,
  });
  const dok = (...b: Block[]): Block[] => [
    { id: 'p1', type: 'heading', props: { level: 1 }, content: 'Punkt' },
    ...b,
  ];
  const plan = (d: Block[], vorhanden: Aufgabe[] = []) =>
    aufgabenAbgleich({
      eintraege: ableiten(d).aufgaben,
      vorhanden,
      gruppe: 194,
      sitzung: 's1',
      von: 1,
      am: AM,
    });
  const todo = (id: string, text: string, teil: Partial<Aufgabe> = {}): Aufgabe => ({
    ...neueAufgabe({ id, gruppe: 194, sitzung: 's1', text, von: 1, am: '2026-10-20T10:00:00Z' }),
    ...teil,
  });

  it('neue Aufgabe mit Text → To-Do anlegen (offen, Sitzung und Gruppe gesetzt)', () => {
    const p = plan(dok(aufgabeBlock('b1', 't1', 'Beamer prüfen')));
    expect(p.aendern).toEqual([]);
    expect(p.anlegen).toHaveLength(1);
    expect(p.anlegen[0]).toMatchObject({
      id: 't1',
      text: 'Beamer prüfen',
      sitzung: 's1',
      gruppe: 194,
      status: 'offen',
    });
  });

  it('Aufgabe ohne Text oder ohne ID → nichts (eine angefangene Zeile ist noch kein To-Do)', () => {
    expect(plan(dok(aufgabeBlock('b1', 't1', '  '), aufgabeBlock('b2', '', 'x')))).toEqual({
      anlegen: [],
      aendern: [],
    });
  });

  it('auch in Unterpunkten', () => {
    const p = plan(
      dok({
        id: 'l',
        type: 'bulletListItem',
        content: 'x',
        children: [aufgabeBlock('b1', 't1', 'tief')],
      }),
    );
    expect(p.anlegen.map((a) => a.id)).toEqual(['t1']);
  });

  it('Text geändert → Text ins To-Do, Wer/Bis/Status bleiben', () => {
    const alt = todo('t1', 'Beamer', { wer: [7], bis: '2026-11-01', status: 'arbeit' });
    const p = plan(dok(aufgabeBlock('b1', 't1', 'Beamer reparieren')), [alt]);
    expect(p.anlegen).toEqual([]);
    expect(p.aendern).toEqual([{ ...alt, text: 'Beamer reparieren' }]);
  });

  it('unverändert → nichts zu schreiben', () => {
    expect(plan(dok(aufgabeBlock('b1', 't1', 'Beamer')), [todo('t1', 'Beamer')])).toEqual({
      anlegen: [],
      aendern: [],
    });
  });

  it('Aufgabe aus dem Protokoll gelöscht → To-Do als gelöscht vermerkt (Verlauf), nicht entfernt', () => {
    const p = plan(dok(), [todo('t1', 'Beamer')]);
    expect(p.aendern).toHaveLength(1);
    expect(p.aendern[0].geloescht).toBe(true);
    expect(p.aendern[0].verlauf.at(-1)).toEqual({ am: AM, von: 1, art: 'geloescht' });
  });

  it('wieder im Protokoll (Rückgängig) → wiederhergestellt', () => {
    const geloescht = alsGeloescht(todo('t1', 'Beamer'), 1, '2026-10-24T17:00:00Z');
    const p = plan(dok(aufgabeBlock('b1', 't1', 'Beamer')), [geloescht]);
    expect(p.aendern[0].geloescht).toBe(false);
    expect(p.aendern[0].verlauf.at(-1)?.art).toBe('wiederhergestellt');
  });

  it('To-Dos anderer Sitzungen bleiben unberührt – auch wenn ihre ID hier auftaucht', () => {
    const fremd = todo('t9', 'Altlast', { sitzung: 's0' });
    expect(plan(dok(), [fremd])).toEqual({ anlegen: [], aendern: [] });
    expect(plan(dok(aufgabeBlock('b1', 't9', 'anders')), [fremd])).toEqual({
      anlegen: [],
      aendern: [],
    });
  });

  it('dieselbe ID zweimal → nur einmal angelegt', () => {
    const p = plan(dok(aufgabeBlock('b1', 't1', 'A'), aufgabeBlock('b2', 't1', 'B')));
    expect(p.anlegen.map((a) => a.text)).toEqual(['A']);
  });
});

describe('aufgabenIdsVergeben (S4-2)', () => {
  let n = 0;
  const neueId = () => `neu${++n}`;
  const a = (id: string, aufgabe: string, children: Block[] = []): Block => ({
    id,
    type: 'aufgabe',
    props: { aufgabe },
    children,
  });

  it('ohne ID, doppelt (eingefügte Kopie) oder fremd → neue ID; der erste behält seine', () => {
    n = 0;
    const doc: Block[] = [
      a('b1', ''),
      a('b2', 't1'),
      { id: 'l', type: 'bulletListItem', children: [a('b3', 't1')] },
      a('b4', 'fremd'),
      a('b5', 't2'),
      { id: 'p', type: 'paragraph', props: { aufgabe: '' } },
    ];
    expect(aufgabenIdsVergeben(doc, (id) => id === 'fremd', neueId)).toEqual([
      { blockId: 'b1', aufgabe: 'neu1' },
      { blockId: 'b3', aufgabe: 'neu2' },
      { blockId: 'b4', aufgabe: 'neu3' },
    ]);
  });

  it('alles in Ordnung → nichts', () => {
    expect(aufgabenIdsVergeben([a('b1', 't1'), a('b2', 't2')], () => false, neueId)).toEqual([]);
  });

  it('die Aufgaben einer Vorlage bekommen IDs', () => {
    let k = 0;
    const start = startDokument(STANDARD_VORLAGEN[0], () => `v${k++}`);
    const vergeben = aufgabenIdsVergeben(start, () => false, neueId);
    const anzahl = JSON.stringify(start).split('"type":"aufgabe"').length - 1;
    expect(vergeben).toHaveLength(anzahl);
  });
});
