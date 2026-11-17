import { describe, expect, it } from 'vitest';
import { ableiten, BLOCK, textAus, type Block } from './dokument';
import { vorabLesen } from './aufgaben';
import {
  antwortLesen,
  auftragBauen,
  datumMitWochentag,
  einfuegeStelleKI,
  offenePlatzhalter,
  tagesordnung,
  uebernahmePlanen,
  uebernehmbar,
  type AntwortKontext,
  type Eintrag,
} from './ki';
import {
  namenFinden,
  platzhalterAnwenden,
  unzugeordnet,
  zuordnungErgaenzen,
  type Person,
} from './platzhalter';

const P = (id: number, vorname: string, nachname: string): Person => ({ id, vorname, nachname });
const ALWIN = P(1, 'Alwin', 'Friesen');
const PETER = P(3, 'Peter', 'Wiens');
const MARIA = P(5, 'Maria', 'Dück');
const DANIEL = P(4, 'Daniel', 'Schmidt');
const JOHANN = P(7, 'Johann', 'Becker');
const GRUPPE = [ALWIN, PETER, MARIA, DANIEL, JOHANN];
const ALLE = [...GRUPPE, P(6, 'Anna', 'Klassen'), P(8, 'Viktor', 'Neumann')];

/** Beispiel-Transkript aus dem abgenommenen Entwurf `s8-ki-v1`. */
const TRANSKRIPT = `Alwin: Gut, dann fangen wir an. Peter hat heute die Andacht.
Peter: Psalm 91, Verse 1 bis 6. Danach beten wir für Familie Neumann. Und für Anna Klassen, sie hat eine Krebserkrankung.
Alwin: Dann zum Gemeindeessen am 13. Dezember. Maria, wie sieht es in der Küche aus?
Maria: Das Kochteam steht, wir kochen für 70 Personen. Die Tischdekoration besorge ich bis zum 6. Dezember.
Alwin: Und die Kinderbetreuung?
Daniel: Johann Becker hat schon zwei Jugendliche gefragt. Johann, holst du dir bis nächsten Freitag die Zusagen?
Johann: Mach ich.
Alwin: Dann halten wir fest: Das Essen beginnt um 12:30 Uhr. Aufgebaut wird am Samstag, 12. Dezember, ab 15 Uhr.
Peter: Noch ein neues Thema: Auf dem Parkplatz fehlen Hinweisschilder. Viktor Neumann hat angeboten, einen Entwurf zu machen.
Alwin: Gut. Viktor Neumann, zeigst du uns den bis zum 30. November?`;

let zaehler = 0;
const neueId = (): string => `neu-${++zaehler}`;

const text = (t: string) => [{ type: 'text', text: t, styles: {} }];
const heading = (id: string, level: number, t: string): Block => ({
  id,
  type: 'heading',
  props: { level },
  content: text(t),
  children: [],
});
const absatz = (id: string, t: string): Block => ({
  id,
  type: 'paragraph',
  content: text(t),
  children: [],
});

/** 1 Andacht · 2 Rückblick (fester Punkt) · 3 Gemeindeessen mit 3.1 Küche, 3.2 Kinderbetreuung · 4 Verschiedenes. */
function dokument(): Block[] {
  return [
    heading('h1', 1, 'Andacht & Gebet'),
    heading('h2', 1, 'Rückblick'),
    { id: 'v2', type: BLOCK.verweis, props: { art: 'letztes-protokoll' }, children: [] },
    heading('h3', 1, 'Gemeindeessen am 13.12.'),
    absatz('a3', 'Rückmeldungen bisher 64.'),
    heading('h31', 2, 'Küche'),
    heading('h32', 2, 'Kinderbetreuung'),
    heading('h4', 1, 'Verschiedenes'),
  ];
}

const funde = namenFinden(TRANSKRIPT, { alle: ALLE, gruppe: GRUPPE }, ['Krebserkrankung']);
const angewendet = platzhalterAnwenden(TRANSKRIPT, funde);
const ph = (name: string): string => {
  const f = funde.find((x) => x.text === name);
  if (!f) throw new Error(`kein Fund für ${name}`);
  return f.platzhalter;
};
const kontext = (dok: readonly Block[] = dokument()): AntwortKontext => ({
  dokument: dok,
  zuordnung: angewendet.zuordnung,
  funde,
  gruppe: GRUPPE,
});
const lesen = (roh: string, dok?: readonly Block[]): Eintrag[] => {
  const r = antwortLesen(roh, kontext(dok));
  if (!r.ok) throw new Error(r.meldung);
  return r.eintraege;
};

describe('tagesordnung', () => {
  it('nummeriert Punkte und Unterpunkte wie im Protokoll (punktNummer) und kennzeichnet feste Punkte', () => {
    expect(tagesordnung(dokument()).map((p) => [p.nummer, p.titel, p.fest])).toEqual([
      ['1.', 'Andacht & Gebet', false],
      ['2.', 'Rückblick', true],
      ['3.', 'Gemeindeessen am 13.12.', false],
      ['3.1', 'Küche', false],
      ['3.2', 'Kinderbetreuung', false],
      ['4.', 'Verschiedenes', false],
    ]);
  });

  it('stimmt mit den Punkten aus ableiten überein (dieselbe Zählung, auch bei übersprungener Ebene)', () => {
    const dok = [heading('a', 1, 'Eins'), heading('b', 4, 'Tief'), heading('c', 1, 'Zwei')];
    expect(tagesordnung(dok).map((p) => [p.blockId, p.nummer, p.tiefe])).toEqual(
      ableiten(dok).punkte.map((p) => [
        p.blockId,
        p.tiefe === 0 ? `${p.nummer}.` : p.nummer,
        p.tiefe,
      ]),
    );
  });

  it('ein fester Punkt in einem Unterblock oder Unterpunkt-Abschnitt zählt nur für seinen Punkt', () => {
    const dok = [
      heading('a', 1, 'A'),
      heading('b', 2, 'B'),
      { id: 'v', type: BLOCK.verweis, props: { art: 'anwesenheit' }, children: [] },
      heading('c', 2, 'C'),
      { id: 'x', type: 'paragraph', children: [{ id: 'y', type: BLOCK.verweis, children: [] }] },
    ];
    expect(tagesordnung(dok).map((p) => [p.nummer, p.fest])).toEqual([
      ['1.', false],
      ['1.1', true],
      ['1.2', true],
    ]);
  });
});

describe('datumMitWochentag', () => {
  it('Wochentag und TT.MM.JJJJ', () => {
    expect(datumMitWochentag('2026-11-18')).toBe('Mittwoch, 18.11.2026');
    expect(datumMitWochentag('2026-11-22')).toBe('Sonntag, 22.11.2026');
  });
  it('ungültiges Datum bleibt unverändert', () => {
    expect(datumMitWochentag('2026-02-30')).toBe('2026-02-30');
  });
});

describe('auftragBauen', () => {
  const auftrag = auftragBauen({
    gruppe: 'Leitungsteam',
    datum: '2026-11-18',
    dokument: dokument(),
    transkript: angewendet.text,
    funde,
  });

  it('enthält keinen einzigen gefundenen Namen (Beispiel-Transkript aus dem Entwurf)', () => {
    expect(funde.length).toBeGreaterThan(8);
    for (const f of funde) {
      const wort = new RegExp(`(?<![\\p{L}\\p{N}_])${f.text}(?![\\p{L}\\p{N}_])`, 'u');
      expect(auftrag, f.text).not.toMatch(wort);
    }
    expect(auftrag).toContain('[Person 1]');
    expect(auftrag).toContain('[Vertraulich 1]');
  });

  it('nennt Gruppe, Sitzungsdatum mit Wochentag, die Platzhalter-Regel und den JSON-Aufbau', () => {
    expect(auftrag).toContain('Gruppe „Leitungsteam“ vom Mittwoch, 18.11.2026');
    expect(auftrag).toContain('Sitzungsdatum (Mittwoch, 18.11.2026)');
    expect(auftrag).toContain('Verwende genau diese Platzhalter und erfinde keine Namen');
    expect(auftrag).toContain(
      '"neue_punkte":[{"titel":"…","stichpunkte":["…"],"beschluesse":["…"],"todos":[{"text":"…","wer":["[Person 2]"],"bis":"JJJJ-MM-TT"}],"termine":[{"datum":"JJJJ-MM-TT","text":"…"}]}]',
    );
    expect(auftrag).toContain('Antworte ausschließlich mit JSON');
    expect(auftrag.endsWith(angewendet.text)).toBe(true);
  });

  it('listet die Tagesordnung mit Unterpunkten und kennzeichnet den festen Punkt', () => {
    expect(auftrag).toContain(
      [
        '1. Andacht & Gebet',
        '2. Rückblick (fester Punkt – nichts zuordnen)',
        '3. Gemeindeessen am 13.12.',
        '3.1 Küche',
        '3.2 Kinderbetreuung',
        '4. Verschiedenes',
      ].join('\n'),
    );
  });

  it('ersetzt Namen auch in den Titeln der Tagesordnung, wenn die Funde mitgegeben werden', () => {
    const dok = [heading('a', 1, 'Andacht Peter')];
    const mit = auftragBauen({
      gruppe: 'G',
      datum: '2026-11-18',
      dokument: dok,
      transkript: 'x',
      funde,
    });
    const ohne = auftragBauen({ gruppe: 'G', datum: '2026-11-18', dokument: dok, transkript: 'x' });
    expect(mit).toContain(`1. Andacht ${ph('Peter')}`);
    expect(mit).not.toContain('Peter');
    expect(ohne).toContain('1. Andacht Peter');
  });

  it('ohne Punkte im Dokument: die KI soll selbst gliedern – Beschlüsse, To-Dos und Termine beim jeweiligen Punkt', () => {
    const leer = auftragBauen({ gruppe: 'G', datum: '2026-11-18', dokument: [], transkript: 'x' });
    expect(leer).toContain(
      '(keine Tagesordnung – gliedere den Inhalt selbst in sinnvolle Punkte unter „neue_punkte“, Beschlüsse, To-Dos und Termine dort beim jeweiligen Punkt)',
    );
    expect(leer).not.toContain('noch keine Punkte');
    // Mit Tagesordnung steht die Zeile nicht im Auftrag.
    expect(auftrag).not.toContain('keine Tagesordnung');
  });

  it('der übrige Text ist gegenüber dem bisherigen Auftrag unverändert (nur Beispiel und Zeile bei leerer Tagesordnung neu)', () => {
    // Der bisherige Auftrag (Stand vor 17.11.2026), aus dem Quelltext von damals übernommen.
    const bisher = (gruppe: string, datum: string, zeilen: string[], transkript: string): string =>
      `Du bekommst das Transkript einer Sitzung der Gruppe „${gruppe}“ vom ${datum}.
Personen und vertrauliche Angaben sind durch Platzhalter wie [Person 1] oder [Vertraulich 1] ersetzt. Verwende genau diese Platzhalter und erfinde keine Namen.

Tagesordnung (nr = Nummer des Punkts):
${zeilen.join('\n')}

Ordne den Inhalt diesen Punkten zu – so fein wie möglich, also auch den Unterpunkten – und schreibe zu jedem Punkt knappe Stichpunkte auf Deutsch. Nimm nur auf, was im Transkript steht, und erfinde nichts – keine Namen, Zahlen oder Termine.
Rechne Angaben wie „bis nächsten Freitag“ vom Sitzungsdatum (${datum}) in ein Datum um.
Passt ein Thema zu keinem Punkt, schlage unter „neue_punkte“ einen neuen Punkt mit Titel vor.
Antworte ausschließlich mit JSON in genau diesem Aufbau:
{"punkte":[{"nr":"3.1","stichpunkte":["…"]}],"beschluesse":[{"nr":"3","text":"…"}],"todos":[{"nr":"3.2","text":"…","wer":["[Person 2]"],"bis":"JJJJ-MM-TT"}],"termine":[{"nr":"4","datum":"JJJJ-MM-TT","text":"…"}],"neue_punkte":[{"titel":"…","stichpunkte":["…"]}]}

Transkript:
${transkript}`;
    const neuesBeispiel =
      '"neue_punkte":[{"titel":"…","stichpunkte":["…"],"beschluesse":["…"],"todos":[{"text":"…","wer":["[Person 2]"],"bis":"JJJJ-MM-TT"}],"termine":[{"datum":"JJJJ-MM-TT","text":"…"}]}]';
    const altesBeispiel = '"neue_punkte":[{"titel":"…","stichpunkte":["…"]}]';
    const zeilen = tagesordnung(dokument()).map(
      (p) => `${p.nummer} ${p.titel}${p.fest ? ' (fester Punkt – nichts zuordnen)' : ''}`,
    );
    const mit = auftragBauen({
      gruppe: 'G',
      datum: '2026-11-18',
      dokument: dokument(),
      transkript: 'x',
    });
    expect(mit.replace(neuesBeispiel, altesBeispiel)).toBe(
      bisher('G', 'Mittwoch, 18.11.2026', zeilen, 'x'),
    );
    const leer = auftragBauen({ gruppe: 'G', datum: '2026-11-18', dokument: [], transkript: 'x' });
    const neueZeile = leer.split('\n')[4];
    expect(
      leer
        .replace(neuesBeispiel, altesBeispiel)
        .replace(neueZeile, '(noch keine Punkte – schlage neue Punkte vor)'),
    ).toBe(
      bisher('G', 'Mittwoch, 18.11.2026', ['(noch keine Punkte – schlage neue Punkte vor)'], 'x'),
    );
  });
});

describe('antwortLesen', () => {
  const antwort = {
    punkte: [
      { nr: '1', stichpunkte: [`Andacht von ${ph('Peter')}: Psalm 91.`] },
      { nr: '3.1', stichpunkte: ['Das Kochteam steht.', `${ph('Maria')} besorgt die Dekoration.`] },
    ],
    beschluesse: [{ nr: '3', text: 'Das Essen beginnt um 12:30 Uhr.' }],
    todos: [
      { nr: '3.1', text: 'Tischdekoration besorgen', wer: [ph('Maria')], bis: '2026-12-06' },
      { nr: '4', text: 'Entwurf zeigen', wer: [ph('Viktor Neumann')], bis: '2026-11-30' },
    ],
    termine: [{ nr: '3', datum: '2026-12-12', text: 'Aufbau ab 15 Uhr' }],
    neue_punkte: [{ titel: 'Parkplatz', stichpunkte: ['Hinweisschilder fehlen.'] }],
  };

  it('liest eine Antwort im ```json-Codeblock mit Text davor und danach, Namen kommen zurück', () => {
    const roh = `Gerne! Hier ist die Auswertung:\n\n\`\`\`json\n${JSON.stringify(antwort, null, 1)}\n\`\`\`\n\nSag Bescheid, wenn ich etwas ändern soll. {Klammer} im Text.`;
    const e = lesen(roh);
    expect(e.map((x) => x.id)).toEqual([
      'stichpunkt-0',
      'stichpunkt-1',
      'stichpunkt-2',
      'beschluss-0',
      'todo-0',
      'todo-1',
      'termin-0',
      'neuerPunkt-0',
    ]);
    const s = e[0];
    expect(s.art === 'stichpunkt' && s.text).toBe('Andacht von Peter: Psalm 91.');
    expect(e[2].art === 'stichpunkt' && e[2].text).toBe('Maria besorgt die Dekoration.');
    expect(e.every(uebernehmbar)).toBe(true);
  });

  it('liest auch reines JSON ohne Codeblock und Text drumherum ohne Zaun', () => {
    expect(lesen(JSON.stringify(antwort)).length).toBe(8);
    expect(lesen(`Hier: ${JSON.stringify(antwort)} Fertig.`).length).toBe(8);
  });

  it('nr als Zahl oder Text, „3“ wie „3.“, „Punkt 3.1“', () => {
    const e = lesen(
      JSON.stringify({
        punkte: [
          { nr: 3, stichpunkte: ['a'] },
          { nr: '3.', stichpunkte: ['b'] },
          { nr: 3.1, stichpunkte: ['c'] },
          { nr: ' Punkt 3.2 ', stichpunkte: ['d'] },
        ],
      }),
    );
    expect(e.map((x) => x.art === 'stichpunkt' && x.ziel.art === 'punkt' && x.ziel.nummer)).toEqual(
      ['3.', '3.', '3.1', '3.2'],
    );
  });

  it('unbekannter Punkt und fehlende Nummer: nicht übernehmbar, aber sichtbar', () => {
    const e = lesen(
      JSON.stringify({
        beschluesse: [{ nr: '9', text: 'X' }, { text: 'Y' }, { nr: '9.9', text: 'Z' }],
      }),
    );
    expect(e.map((x) => x.art !== 'neuerPunkt' && x.ziel)).toEqual([
      { art: 'unbekannt', nr: '9' },
      { art: 'unbekannt', nr: '' },
      { art: 'unbekannt', nr: '9.9' },
    ]);
    expect(e.some(uebernehmbar)).toBe(false);
  });

  it('fester Punkt: nicht übernehmbar', () => {
    const e = lesen(JSON.stringify({ punkte: [{ nr: '2', stichpunkte: ['Nichts'] }] }));
    expect(e[0].art === 'stichpunkt' && e[0].ziel).toMatchObject({ art: 'fest', nummer: '2.' });
    expect(uebernehmbar(e[0])).toBe(false);
  });

  it.each([
    ['Gerne! Hier ist eine Zusammenfassung ohne Struktur.', /kein JSON/],
    ['```json\n{"punkte": [{"nr": "1", "stichpunkte": ["a"]}\n```', /kein lesbares JSON/],
    ['{"punkte": [', /kein lesbares JSON/],
    ['{"irgendwas": 1}', /erwarteten Aufbau/],
    ['[1, 2, 3]', /kein JSON/],
    ['{"punkte": []}', /nichts, was sich übernehmen lässt/],
    ['', /kein JSON/],
  ])('wirft nicht, sondern meldet verständlich: %s', (roh, muster) => {
    const r = antwortLesen(roh, kontext());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.meldung).toMatch(muster);
  });

  it('falsche Typen werden verworfen statt abzustürzen', () => {
    const e = lesen(
      JSON.stringify({
        punkte: [
          'text',
          null,
          { nr: '1', stichpunkte: 'Einzeln als Text' },
          { nr: '1', stichpunkte: [1, null, { a: 1 }, '', '  ', '- mit Strich', 'ok'] },
          { nr: {}, stichpunkte: ['Nummer kaputt'] },
        ],
        beschluesse: [
          { nr: '1', text: 5 },
          { nr: '1', text: '' },
          'x',
          { nr: '1', text: 'gültig' },
        ],
        todos: [
          { nr: '1', text: 'a', wer: 'nur ein String', bis: 20261201 },
          { nr: '1', text: 'b', wer: [1, null, '[Person 99]'], bis: ['x'] },
          { nr: '1', text: 7 },
        ],
        termine: [
          { nr: '1', text: 'a', datum: 5 },
          { nr: '1', datum: '2026-12-01' },
        ],
        neue_punkte: [
          { titel: 5 },
          { titel: 'Neu', stichpunkte: 'nicht Liste' },
          { titel: 'Neu2', stichpunkte: [3, 'x'] },
        ],
        todos2: 'egal',
      }),
    );
    const texte = e.map((x) => (x.art === 'neuerPunkt' ? x.titel : x.text));
    expect(texte).toEqual([
      'Einzeln als Text',
      'mit Strich',
      'ok',
      'Nummer kaputt',
      'gültig',
      'a',
      'b',
      'a',
      'Neu',
      'Neu2',
    ]);
    const todoB = e.find((x) => x.art === 'todo' && x.text === 'b');
    // Ein unbekannter Platzhalter ist kein externer Name: niemand zuständig, der Platzhalter steht in `offen`.
    expect(todoB).toMatchObject({ wer: [], bis: null, offen: ['[Person 99]'] });
    const termin = e.find((x) => x.art === 'termin');
    expect(termin).toMatchObject({ datum: null });
    expect(e.find((x) => x.art === 'neuerPunkt' && x.titel === 'Neu')).toMatchObject({
      stichpunkte: ['nicht Liste'],
    });
  });

  it('setzt Namen in ALLEN Texten zurück: Stichpunkt, Beschluss, To-Do, Termin, neuer Punkt (Titel und Stichpunkte)', () => {
    const p = ph('Viktor Neumann');
    const e = lesen(
      JSON.stringify({
        punkte: [{ nr: '1', stichpunkte: [`S ${p}`] }],
        beschluesse: [{ nr: '1', text: `B ${p}` }],
        todos: [{ nr: '1', text: `T ${p}`, wer: [] }],
        termine: [{ nr: '1', datum: '2026-12-01', text: `M ${p}` }],
        neue_punkte: [{ titel: `N ${p}`, stichpunkte: [`NS ${p}`] }],
      }),
    );
    const alleTexte = e.flatMap((x) =>
      x.art === 'neuerPunkt' ? [x.titel, ...x.stichpunkte] : [x.text],
    );
    expect(alleTexte).toEqual([
      'S Viktor Neumann',
      'B Viktor Neumann',
      'T Viktor Neumann',
      'M Viktor Neumann',
      'N Viktor Neumann',
      'NS Viktor Neumann',
    ]);
    expect(alleTexte.join(' ')).not.toMatch(/\[Person/);
  });

  describe('To-Do: Zuständige und Datum', () => {
    const todo = (wer: unknown, bis?: unknown) => {
      const e = lesen(JSON.stringify({ todos: [{ nr: '3.1', text: 'T', wer, bis }] }));
      const t = e[0];
      if (t.art !== 'todo') throw new Error('kein To-Do');
      return t;
    };

    it('Platzhalter einer Person der Gruppe → Mitglied (personId)', () => {
      expect(todo([ph('Maria')]).wer).toEqual([{ name: 'Maria', personId: 5 }]); // im Transkript steht nur „Maria“
      expect(todo([ph('Johann Becker')]).wer).toEqual([{ name: 'Johann Becker', personId: 7 }]);
    });

    it('Platzhalter einer Person außerhalb der Gruppe → extern (mit Namen)', () => {
      expect(todo([ph('Viktor Neumann')]).wer).toEqual([
        { name: 'Viktor Neumann', personId: null },
      ]);
      expect(todo([ph('Anna Klassen')]).wer).toEqual([{ name: 'Anna Klassen', personId: null }]);
    });

    it('Platzhalter ohne Zuordnung ist KEIN externer Name: niemand zuständig, der Platzhalter steht in `offen`', () => {
      const t = todo(['[Person 42]']);
      expect(t.wer).toEqual([]);
      expect(t.offen).toEqual(['[Person 42]']);
      // Gemischt: der bekannte bleibt Zuständiger, nur der unbekannte fällt heraus.
      const gemischt = todo([ph('Maria'), '[Person 42]', '[Person 42]', 'Fremde Frau']);
      expect(gemischt.wer).toEqual([
        { name: 'Maria', personId: 5 },
        { name: 'Fremde Frau', personId: null },
      ]);
      expect(gemischt.offen).toEqual(['[Person 42]']);
      // Ohne unbekannten Platzhalter gibt es das Feld nicht.
      expect('offen' in todo([ph('Maria')])).toBe(false);
    });

    it('von Hand zugeordnet (zuordnungErgaenzen): ein Mitglied wird zuständige Person, ein Fremder extern', () => {
      const zuordnung = zuordnungErgaenzen(platzhalterAnwenden(TRANSKRIPT, funde).zuordnung, {
        '[Person 42]': ' Daniel Schmidt ',
        '[Person 43]': 'Fremde Frau',
        '[Person 44]': '   ',
      });
      const r = antwortLesen(
        JSON.stringify({
          todos: [{ nr: '3.1', text: 'T', wer: ['[Person 42]', '[Person 43]', '[Person 44]'] }],
        }),
        { dokument: dokument(), zuordnung, funde, gruppe: GRUPPE },
      );
      if (!r.ok) throw new Error(r.meldung);
      const t = r.eintraege[0];
      if (t.art !== 'todo') throw new Error('kein To-Do');
      expect(t.wer).toEqual([
        { name: 'Daniel Schmidt', personId: 4 },
        { name: 'Fremde Frau', personId: null },
      ]);
      expect(t.offen).toEqual(['[Person 44]']);
    });

    it('ein ausgeschriebener Name (Fund nicht ersetzt) trifft das Mitglied über den vollen Namen', () => {
      expect(todo(['Maria Dück', 'Fremde Frau']).wer).toEqual([
        { name: 'Maria Dück', personId: 5 },
        { name: 'Fremde Frau', personId: null },
      ]);
    });

    it('Bis-Datum wird übernommen, ein ungültiges (auch 30.02.) verworfen', () => {
      expect(todo([], '2026-12-06').bis).toBe('2026-12-06');
      expect(todo([], '2026-02-30').bis).toBeNull();
      expect(todo([], '6.12.2026').bis).toBeNull();
      expect(todo([], undefined).bis).toBeNull();
    });
  });

  it('Termin: gültiges Datum bleibt, ungültiges wird null', () => {
    const e = lesen(
      JSON.stringify({
        termine: [
          { nr: '3', datum: '2026-12-12', text: 'a' },
          { nr: '3', datum: '2026-13-01', text: 'b' },
        ],
      }),
    );
    expect(e.map((x) => x.art === 'termin' && x.datum)).toEqual(['2026-12-12', null]);
  });
});

describe('einfuegeStelleKI', () => {
  const punkte = ableiten(dokument()).punkte;
  it('„3.“ mit Unterpunkten landet vor 3.1 (nicht hinter 3.2), „3.1“ vor 3.2, „3.2“ vor 4.', () => {
    expect(einfuegeStelleKI(punkte, 'h3')).toBe('h31');
    expect(einfuegeStelleKI(punkte, 'h31')).toBe('h32');
    expect(einfuegeStelleKI(punkte, 'h32')).toBe('h4');
  });
  it('ein Punkt ohne Unterpunkte: vor den nächsten Punkt', () => {
    expect(einfuegeStelleKI(punkte, 'h1')).toBe('h2');
  });
  it('letzter Punkt oder unbekannter Block → null', () => {
    expect(einfuegeStelleKI(punkte, 'h4')).toBeNull();
    expect(einfuegeStelleKI(punkte, 'gibtsnicht')).toBeNull();
  });
  it('letzter Unterpunkt eines vorletzten Punkts steht vor dem nächsten Punkt höherer Stufe', () => {
    const dok = [heading('a', 1, 'A'), heading('a1', 2, 'A1'), heading('b', 1, 'B')];
    expect(einfuegeStelleKI(ableiten(dok).punkte, 'a1')).toBe('b');
  });
});

describe('uebernahmePlanen', () => {
  const alle = lesen(
    JSON.stringify({
      punkte: [
        { nr: '3', stichpunkte: ['Zu 3 gesamt.'] },
        { nr: '3.1', stichpunkte: ['Kochteam steht.', `${ph('Maria')} besorgt Deko.`] },
        { nr: '4', stichpunkte: ['Noch offen.'] },
        { nr: '2', stichpunkte: ['Fester Punkt'] },
        { nr: '77', stichpunkte: ['Gibt es nicht'] },
      ],
      beschluesse: [{ nr: '3.1', text: 'Essen um 12:30 Uhr.' }],
      todos: [
        {
          nr: '3.1',
          text: 'Deko besorgen',
          wer: [ph('Maria'), ph('Viktor Neumann')],
          bis: '2026-12-06',
        },
        { nr: '3.1', text: 'Ohne alles' },
      ],
      termine: [{ nr: '3.1', datum: '2026-12-12', text: 'Aufbau' }],
      neue_punkte: [
        {
          titel: 'Parkplatz',
          stichpunkte: ['Schilder fehlen.', `${ph('Viktor Neumann')} macht Entwurf.`],
        },
        { titel: 'Nur Titel' },
      ],
    }),
  );

  const plan = uebernahmePlanen(alle, dokument(), neueId);
  const gesamt = (b: Block[]) => b.map((x) => [x.type, textAus(x.content)]);

  it('Einfügungen: je Ziel ein Aufruf; später im Dokument zuerst, neue Punkte zuletzt mit vor = null', () => {
    expect(plan.einfuegungen.map((e) => e.vor)).toEqual([null, 'h32', 'h31', null]);
    // 4. (letzter Punkt) und die neuen Punkte gehen beide ans Ende – 4. kommt zuerst
    expect(gesamt(plan.einfuegungen[0].bloecke)).toEqual([['bulletListItem', 'Noch offen.']]);
    expect(plan.einfuegungen[3].bloecke[0].type).toBe('heading');
  });

  it('Reihenfolge je Ziel: Stichpunkte, Beschlüsse, To-Dos, Termine', () => {
    expect(gesamt(plan.einfuegungen[1].bloecke)).toEqual([
      ['bulletListItem', 'Kochteam steht.'],
      ['bulletListItem', 'Maria besorgt Deko.'],
      ['beschluss', 'Essen um 12:30 Uhr.'],
      ['aufgabe', 'Deko besorgen'],
      ['aufgabe', 'Ohne alles'],
      ['termin', 'Aufbau'],
    ]);
    expect(gesamt(plan.einfuegungen[2].bloecke)).toEqual([['bulletListItem', 'Zu 3 gesamt.']]);
  });

  it('Aufgaben-Block: vorab Wer/Bis im Format aus aufgaben.ts, Mitglied → wer, Extern → extern, keine To-Do-ID', () => {
    const [a, leer] = plan.einfuegungen[1].bloecke.filter((b) => b.type === BLOCK.aufgabe);
    expect(a.props?.aufgabe).toBe('');
    expect(vorabLesen(a.props?.vorab)).toEqual({
      wer: [5],
      extern: 'Viktor Neumann',
      bis: '2026-12-06',
    });
    expect(leer.props).toEqual({ aufgabe: '', vorab: '' });
    expect(vorabLesen(leer.props?.vorab)).toBeNull();
  });

  it('Extern: derselbe Name zweimal erscheint nur einmal, Mitglieder doppelt nur einmal in wer', () => {
    const e = lesen(
      JSON.stringify({
        todos: [
          {
            nr: '3.1',
            text: 'T',
            wer: [ph('Viktor Neumann'), ph('Viktor Neumann'), ph('Maria'), ph('Maria')],
          },
        ],
      }),
    );
    const t = uebernahmePlanen(e, dokument(), neueId).einfuegungen[0].bloecke[0];
    expect(vorabLesen(t.props?.vorab)).toEqual({ wer: [5], extern: 'Viktor Neumann', bis: null });
  });

  it('Termin-Block mit Datum wie im Editor (props.datum), ohne Datum leer', () => {
    const t = plan.einfuegungen[1].bloecke.find((b) => b.type === BLOCK.termin)!;
    expect(t.props).toEqual({ datum: '2026-12-12' });
    const ohne = uebernahmePlanen(
      lesen(JSON.stringify({ termine: [{ nr: '1', text: 'x', datum: 'kaputt' }] })),
      dokument(),
      neueId,
    );
    expect(ohne.einfuegungen[0].bloecke[0].props).toEqual({ datum: '' });
  });

  it('neue Punkte: Tagesordnungspunkt (Überschrift Stufe 1) mit Stichpunkten am Ende', () => {
    expect(plan.einfuegungen[3].bloecke.map((b) => [b.type, b.props, textAus(b.content)])).toEqual([
      ['heading', { level: 1 }, 'Parkplatz'],
      ['bulletListItem', undefined, 'Schilder fehlen.'],
      ['bulletListItem', undefined, 'Viktor Neumann macht Entwurf.'],
      ['heading', { level: 1 }, 'Nur Titel'],
    ]);
  });

  it('unbekannter und fester Punkt werden übersprungen und gemeldet', () => {
    expect(plan.uebersprungen.map((e) => e.art === 'stichpunkt' && e.ziel.art)).toEqual([
      'fest',
      'unbekannt',
    ]);
  });

  it('Block-IDs sind eindeutig und kommen aus dem übergebenen Erzeuger', () => {
    const ids = plan.einfuegungen.flatMap((e) => e.bloecke.map((b) => b.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((i) => i.startsWith('neu-'))).toBe(true);
    let n = 0;
    const a = uebernahmePlanen(alle, dokument(), () => `t${++n}`);
    n = 0;
    const b = uebernahmePlanen(alle, dokument(), () => `t${++n}`);
    expect(a).toEqual(b);
  });

  it('nur gewählte Einträge werden übernommen; nichts gewählt → nichts', () => {
    expect(uebernahmePlanen([], dokument(), neueId)).toEqual({
      einfuegungen: [],
      uebersprungen: [],
    });
    const nur = uebernahmePlanen(
      alle.filter((e) => e.art === 'beschluss'),
      dokument(),
      neueId,
    );
    expect(nur.einfuegungen.map((e) => e.vor)).toEqual(['h32']);
  });

  it('ein Punkt, der inzwischen aus dem Dokument verschwunden ist, wird übersprungen statt falsch eingefügt', () => {
    const dok = dokument().filter((b) => b.id !== 'h31');
    const r = uebernahmePlanen(
      alle.filter((e) => e.art === 'beschluss'),
      dok,
      neueId,
    );
    expect(r.einfuegungen).toEqual([]);
    expect(r.uebersprungen).toHaveLength(1);
  });

  it('Beschluss und Termin für einen Punkt MIT Unterpunkten zählen zu diesem Punkt, nicht zum letzten Unterpunkt (Fund TF-PROT-12)', () => {
    const e = lesen(
      JSON.stringify({
        beschluesse: [{ nr: '3', text: 'Für 3.' }],
        termine: [{ nr: '3', datum: '2026-12-12', text: 'Für 3.' }],
      }),
    );
    const doc = dokument();
    for (const f of uebernahmePlanen(e, doc, neueId).einfuegungen) {
      const i = f.vor === null ? doc.length : doc.findIndex((b) => b.id === f.vor);
      doc.splice(i, 0, ...f.bloecke);
    }
    const a = ableiten(doc);
    expect(a.beschluesse.map((b) => b.punkt)).toEqual(['h3']);
    expect(a.termine.map((t) => t.punkt)).toEqual(['h3']);
  });

  it('Gesamtbild: eingefügt in dieser Reihenfolge entsteht die erwartete Dokumentfolge', () => {
    // einfügen wie EditorGriff.einfuegen: vor Block `vor`, sonst ans Ende
    const doc = dokument();
    for (const e of plan.einfuegungen) {
      const i = e.vor === null ? doc.length : doc.findIndex((b) => b.id === e.vor);
      doc.splice(i, 0, ...e.bloecke);
    }
    const folge = doc.map((b) => textAus(b.content)).filter(Boolean);
    // 3. hat Unterpunkte: sein Inhalt steht hinter dem eigenen Text, VOR 3.1 (Alwin 16.11.2026)
    expect(folge.indexOf('Rückmeldungen bisher 64.')).toBeLessThan(folge.indexOf('Zu 3 gesamt.'));
    expect(folge.indexOf('Zu 3 gesamt.')).toBeLessThan(folge.indexOf('Küche'));
    expect(folge.indexOf('Küche')).toBeLessThan(folge.indexOf('Kochteam steht.'));
    expect(folge.indexOf('Kochteam steht.')).toBeLessThan(folge.indexOf('Kinderbetreuung'));
    expect(folge.indexOf('Kinderbetreuung')).toBeLessThan(folge.indexOf('Verschiedenes'));
    expect(folge.indexOf('Noch offen.')).toBeLessThan(folge.indexOf('Parkplatz'));
    // Das Ergebnis liest die gemeinsame Ableitung: Beschluss und Termin stehen bei 3.1
    const a = ableiten(doc);
    expect(a.beschluesse.map((b) => b.punkt)).toEqual(['h31']);
    expect(a.termine[0]).toMatchObject({ punkt: 'h31', datum: '2026-12-12' });
    expect(a.aufgaben.map((x) => x.punkt)).toEqual(['h31', 'h31']);
    expect(a.aufgaben[0].vorab).toEqual({ wer: [5], extern: 'Viktor Neumann', bis: '2026-12-06' });
    expect(a.punkte.at(-2)?.titel).toBe('Parkplatz');
  });
});

describe('offenePlatzhalter – was in der Vorschau ohne Namen stehen bleibt', () => {
  const kontext = (zuordnung: Record<string, string>): AntwortKontext => ({
    dokument: dokument(),
    zuordnung,
    funde: [],
    gruppe: GRUPPE,
  });
  const antwort = JSON.stringify({
    punkte: [{ nr: '1', stichpunkte: ['[Person 1] spricht.', 'Ohne Namen.'] }],
    beschluesse: [{ nr: '3', text: 'Beschluss von [Vertraulich 2].' }],
    todos: [{ nr: '3.1', text: 'Machen', wer: ['[Person 1]', '[Person 3]'] }],
    neue_punkte: [{ titel: 'Thema [Person 4]', stichpunkte: ['Zu [Person 1].'] }],
  });
  const lesen = (zuordnung: Record<string, string>) => {
    const r = antwortLesen(antwort, kontext(zuordnung));
    if (!r.ok) throw new Error(r.meldung);
    return r.eintraege;
  };

  it('sammelt jeden Platzhalter einmal – in Texten, Zuständigen und neuen Punkten', () => {
    expect(offenePlatzhalter(lesen({}))).toEqual([
      '[Person 1]',
      '[Vertraulich 2]',
      '[Person 3]',
      '[Person 4]',
    ]);
  });

  it('zugeordnete Platzhalter sind weg; ist alles zugeordnet, bleibt nichts offen', () => {
    const z = zuordnungErgaenzen(
      {},
      {
        '[Person 1]': 'Maria Dück',
        '[Vertraulich 2]': 'Krebserkrankung',
        '[Person 3]': 'Peter Wiens',
        '[Person 4]': 'Johann Becker',
      },
    );
    expect(offenePlatzhalter(lesen(z))).toEqual([]);
    expect(offenePlatzhalter(lesen({ '[Person 1]': 'Maria Dück' }))).not.toContain('[Person 1]');
  });
});

describe('unzugeordnet / zuordnungErgaenzen (Platzhalter von Hand)', () => {
  it('unzugeordnet nennt nur, was die Zuordnung nicht kennt – jeden einmal, in Reihenfolge', () => {
    expect(
      unzugeordnet('[Person 2] und [Person 1], [Person 2], [Vertraulich 1] [Person 9]', {
        '[Person 1]': 'Anna Klassen',
      }),
    ).toEqual(['[Person 2]', '[Vertraulich 1]', '[Person 9]']);
    expect(unzugeordnet('kein Platzhalter [Person] [Person x]', {})).toEqual([]);
  });

  it('zuordnungErgaenzen: ein bekannter Platzhalter behält seinen Namen, Leeres und Unechtes kommt nicht hinein', () => {
    expect(
      zuordnungErgaenzen(
        { '[Person 1]': 'Anna Klassen' },
        {
          '[Person 1]': 'Jemand anderes',
          '[Person 2]': ' Peter Wiens ',
          '[Person 3]': ' ',
          Quatsch: 'x',
        },
      ),
    ).toEqual({ '[Person 1]': 'Anna Klassen', '[Person 2]': 'Peter Wiens' });
  });
});

describe('neue Punkte mit Beschlüssen, To-Dos und Terminen (17.11.2026)', () => {
  const neuerPunkt = {
    titel: 'Parkplatz',
    stichpunkte: ['Schilder fehlen.'],
    beschluesse: ['Wir bestellen Schilder.', { text: `${ph('Maria')} prüft den Preis.` }],
    todos: [
      { text: 'Entwurf zeigen', wer: [ph('Viktor Neumann'), ph('Maria')], bis: '2026-11-30' },
      { text: 'Ohne alles' },
    ],
    termine: [
      { datum: '2026-12-12', text: 'Aufbau' },
      { text: 'Ohne Datum', datum: 'kaputt' },
    ],
  };
  const leeresProtokoll = (): Block[] => [absatz('p0', '')];
  const punktVon = (e: Eintrag[]) => {
    const x = e.find((y) => y.art === 'neuerPunkt');
    if (x?.art !== 'neuerPunkt') throw new Error('kein neuer Punkt');
    return x;
  };

  describe('Lesen', () => {
    it('Beschlüsse als Text und als { text } – leere und falsch getypte werden verworfen', () => {
      const e = punktVon(
        lesen(
          JSON.stringify({
            neue_punkte: [
              {
                titel: 'N',
                beschluesse: ['a', { text: 'b' }, '', '  ', 5, null, { text: 7 }, ['x']],
              },
            ],
          }),
          leeresProtokoll(),
        ),
      );
      expect(e.beschluesse).toEqual([{ text: 'a' }, { text: 'b' }]);
    });

    it('To-Dos wie bei den Einträgen mit nr: Zuständige (Mitglied/extern), Datum, unzugeordneter Platzhalter → offen', () => {
      const e = punktVon(
        lesen(
          JSON.stringify({
            neue_punkte: [
              {
                titel: 'N',
                todos: [
                  {
                    text: `T ${ph('Maria')}`,
                    wer: [ph('Maria'), ph('Viktor Neumann'), '[Person 99]'],
                    bis: '2026-12-06',
                  },
                  { text: 'Datum kaputt', bis: '2026-02-30' },
                  { text: '' },
                  { text: 5 },
                  'x',
                ],
              },
            ],
          }),
          leeresProtokoll(),
        ),
      );
      expect(e.todos).toEqual([
        {
          text: 'T Maria',
          wer: [
            { name: 'Maria', personId: 5 },
            { name: 'Viktor Neumann', personId: null },
          ],
          bis: '2026-12-06',
          offen: ['[Person 99]'],
        },
        { text: 'Datum kaputt', wer: [], bis: null },
      ]);
    });

    it('Termine: Datum nach terminDatum, Termin ohne Text fällt weg, Namen kommen zurück', () => {
      const e = punktVon(
        lesen(
          JSON.stringify({
            neue_punkte: [
              {
                titel: 'N',
                termine: [
                  { datum: '2026-12-12', text: `Mit ${ph('Peter')}` },
                  { datum: 'kaputt', text: 'Kaputt' },
                  { datum: '2026-02-30', text: 'Gibt es nicht' },
                  { text: 'Ohne Datum' },
                  { datum: '2026-12-12' },
                  { datum: 5, text: 'Zahl' },
                ],
              },
            ],
          }),
          leeresProtokoll(),
        ),
      );
      expect(e.termine).toEqual([
        { text: 'Mit Peter', datum: '2026-12-12' },
        { text: 'Kaputt', datum: null },
        { text: 'Gibt es nicht', datum: null },
        { text: 'Ohne Datum', datum: null },
        { text: 'Zahl', datum: null },
      ]);
    });

    it('Namen werden in Beschlüssen, To-Dos und Terminen eines neuen Punkts zurückgesetzt', () => {
      const p = ph('Viktor Neumann');
      const e = punktVon(
        lesen(
          JSON.stringify({
            neue_punkte: [
              {
                titel: 'N',
                beschluesse: [`B ${p}`],
                todos: [{ text: `T ${p}` }],
                termine: [{ text: `M ${p}` }],
              },
            ],
          }),
          leeresProtokoll(),
        ),
      );
      expect([e.beschluesse[0].text, e.todos[0].text, e.termine[0].text]).toEqual([
        'B Viktor Neumann',
        'T Viktor Neumann',
        'M Viktor Neumann',
      ]);
    });

    it('alte Antwort ohne die neuen Felder: leere Listen, sonst wie bisher', () => {
      const e = punktVon(
        lesen(
          JSON.stringify({ neue_punkte: [{ titel: 'Alt', stichpunkte: ['a'] }] }),
          leeresProtokoll(),
        ),
      );
      expect(e).toMatchObject({
        titel: 'Alt',
        stichpunkte: ['a'],
        beschluesse: [],
        todos: [],
        termine: [],
      });
    });

    it('ein leeres Protokoll lässt sich aus einer Antwort NUR mit neue_punkte füllen – alles übernehmbar', () => {
      const e = lesen(JSON.stringify({ neue_punkte: [neuerPunkt] }), leeresProtokoll());
      expect(e).toHaveLength(1);
      expect(e.every(uebernehmbar)).toBe(true);
    });
  });

  describe('offenePlatzhalter', () => {
    const lesenOffen = (np: object, zuordnung: Record<string, string> = {}) => {
      const r = antwortLesen(JSON.stringify({ neue_punkte: [{ titel: 'N', ...np }] }), {
        dokument: [],
        zuordnung,
        funde: [],
        gruppe: GRUPPE,
      });
      if (!r.ok) throw new Error(r.meldung);
      return offenePlatzhalter(r.eintraege);
    };

    it('findet Platzhalter in Beschlüssen, To-Dos (Text und Zuständige) und Terminen des neuen Punkts', () => {
      expect(lesenOffen({ beschluesse: ['B [Person 1]'] })).toEqual(['[Person 1]']);
      expect(lesenOffen({ todos: [{ text: 'T [Person 2]' }] })).toEqual(['[Person 2]']);
      expect(lesenOffen({ todos: [{ text: 'T', wer: ['[Person 3]'] }] })).toEqual(['[Person 3]']);
      expect(lesenOffen({ termine: [{ text: 'M [Vertraulich 4]' }] })).toEqual(['[Vertraulich 4]']);
    });

    it('zugeordnete Platzhalter sind weg', () => {
      expect(
        lesenOffen(
          {
            beschluesse: ['B [Person 1]'],
            todos: [{ text: 'T [Person 1]', wer: ['[Person 1]'] }],
            termine: [{ text: 'M [Person 1]' }],
          },
          { '[Person 1]': 'Maria Dück' },
        ),
      ).toEqual([]);
    });
  });

  describe('Übernahme', () => {
    const uebernehmen = (dok: Block[], np: object = neuerPunkt) => {
      const e = lesen(
        JSON.stringify({ neue_punkte: [np, { titel: 'Zweiter', stichpunkte: ['z'] }] }),
        dok,
      );
      return uebernahmePlanen(e, dok, neueId);
    };

    it('ein neuer Punkt wird Tagesordnungspunkt, Stichpunkte, Beschlüsse, To-Dos, Termine – in dieser Reihenfolge, vor den Schlusszeilen (vor = null)', () => {
      const plan = uebernehmen(leeresProtokoll());
      expect(plan.einfuegungen).toHaveLength(1);
      expect(plan.einfuegungen[0].vor).toBeNull();
      expect(plan.uebersprungen).toEqual([]);
      expect(
        plan.einfuegungen[0].bloecke.map((b) => [b.type, b.props?.level, textAus(b.content)]),
      ).toEqual([
        ['heading', 1, 'Parkplatz'],
        ['bulletListItem', undefined, 'Schilder fehlen.'],
        [BLOCK.beschluss, undefined, 'Wir bestellen Schilder.'],
        [BLOCK.beschluss, undefined, 'Maria prüft den Preis.'],
        [BLOCK.aufgabe, undefined, 'Entwurf zeigen'],
        [BLOCK.aufgabe, undefined, 'Ohne alles'],
        [BLOCK.termin, undefined, 'Aufbau'],
        [BLOCK.termin, undefined, 'Ohne Datum'],
        ['heading', 1, 'Zweiter'],
        ['bulletListItem', undefined, 'z'],
      ]);
    });

    it('Beschluss-, To-Do- und Termin-Block haben dieselbe Form wie bei einem vorhandenen Punkt (gleiche Erzeugung)', () => {
      const dok = dokument();
      const einzeln = uebernahmePlanen(
        lesen(
          JSON.stringify({
            beschluesse: [{ nr: '3.1', text: 'Wir bestellen Schilder.' }],
            todos: [
              {
                nr: '3.1',
                text: 'Entwurf zeigen',
                wer: [ph('Viktor Neumann'), ph('Maria')],
                bis: '2026-11-30',
              },
              { nr: '3.1', text: 'Ohne alles' },
            ],
            termine: [
              { nr: '3.1', datum: '2026-12-12', text: 'Aufbau' },
              { nr: '3.1', datum: 'kaputt', text: 'Ohne Datum' },
            ],
          }),
          dok,
        ),
        dok,
        neueId,
      ).einfuegungen[0].bloecke;
      const neu = uebernehmen(leeresProtokoll()).einfuegungen[0].bloecke;
      const form = (b: Block) => [b.type, b.props, textAus(b.content), b.children];
      const nimm = (bl: Block[], t: string, n: number) =>
        bl
          .filter((b) => b.type === t)
          .slice(0, n)
          .map(form);
      expect(nimm(neu, BLOCK.beschluss, 1)).toEqual(nimm(einzeln, BLOCK.beschluss, 1));
      expect(nimm(neu, BLOCK.aufgabe, 2)).toEqual(nimm(einzeln, BLOCK.aufgabe, 2));
      expect(nimm(neu, BLOCK.termin, 2)).toEqual(nimm(einzeln, BLOCK.termin, 2));
      const a = neu.find((b) => textAus(b.content) === 'Entwurf zeigen')!;
      expect(vorabLesen(a.props?.vorab)).toEqual({
        wer: [5],
        extern: 'Viktor Neumann',
        bis: '2026-11-30',
      });
      expect(neu.find((b) => textAus(b.content) === 'Ohne alles')!.props).toEqual({
        aufgabe: '',
        vorab: '',
      });
      expect(neu.find((b) => textAus(b.content) === 'Aufbau')!.props).toEqual({
        datum: '2026-12-12',
      });
      expect(neu.find((b) => textAus(b.content) === 'Ohne Datum')!.props).toEqual({ datum: '' });
    });

    it('der neue Punkt ist ein echter Tagesordnungspunkt: ableiten ordnet Beschluss, To-Do und Termin ihm zu', () => {
      const dok = leeresProtokoll();
      for (const f of uebernehmen(dok).einfuegungen) {
        const i = f.vor === null ? dok.length : dok.findIndex((b) => b.id === f.vor);
        dok.splice(i, 0, ...f.bloecke);
      }
      const a = ableiten(dok);
      expect(a.punkte.map((p) => [p.nummer, p.titel])).toEqual([
        ['1', 'Parkplatz'],
        ['2', 'Zweiter'],
      ]);
      const hId = a.punkte[0].blockId;
      expect(a.beschluesse.map((b) => b.punkt)).toEqual([hId, hId]);
      expect(a.aufgaben.map((b) => b.punkt)).toEqual([hId, hId]);
      expect(a.termine.map((b) => [b.punkt, b.datum])).toEqual([
        [hId, '2026-12-12'],
        [hId, null],
      ]);
    });
  });
});
