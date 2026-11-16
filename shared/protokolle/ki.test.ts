import { describe, expect, it } from 'vitest';
import { ableiten, BLOCK, textAus, type Block } from './dokument';
import { vorabLesen } from './aufgaben';
import {
  antwortLesen,
  auftragBauen,
  datumMitWochentag,
  einfuegeStelleKI,
  tagesordnung,
  uebernahmePlanen,
  uebernehmbar,
  type AntwortKontext,
  type Eintrag,
} from './ki';
import { namenFinden, platzhalterAnwenden, type Person } from './platzhalter';

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
    expect(auftrag).toContain('"neue_punkte":[{"titel":"…","stichpunkte":["…"]}]');
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

  it('ohne Punkte im Dokument: Hinweis statt leerer Liste', () => {
    expect(
      auftragBauen({ gruppe: 'G', datum: '2026-11-18', dokument: [], transkript: 'x' }),
    ).toContain('noch keine Punkte');
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
    expect(todoB).toMatchObject({ wer: [{ name: '[Person 99]', personId: null }], bis: null });
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

    it('Platzhalter ohne Zuordnung bleibt als Text und ist extern', () => {
      expect(todo(['[Person 42]']).wer).toEqual([{ name: '[Person 42]', personId: null }]);
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
  it('„3.“ landet hinter 3.2 (vor 4.), „3.1“ vor 3.2', () => {
    expect(einfuegeStelleKI(punkte, 'h3')).toBe('h4');
    expect(einfuegeStelleKI(punkte, 'h31')).toBe('h32');
    expect(einfuegeStelleKI(punkte, 'h32')).toBe('h4');
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
    expect(plan.einfuegungen.map((e) => e.vor)).toEqual([null, 'h32', 'h4', null]);
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

  it('Gesamtbild: eingefügt in dieser Reihenfolge entsteht die erwartete Dokumentfolge', () => {
    // einfügen wie EditorGriff.einfuegen: vor Block `vor`, sonst ans Ende
    const doc = dokument();
    for (const e of plan.einfuegungen) {
      const i = e.vor === null ? doc.length : doc.findIndex((b) => b.id === e.vor);
      doc.splice(i, 0, ...e.bloecke);
    }
    const folge = doc.map((b) => textAus(b.content)).filter(Boolean);
    expect(folge.indexOf('Küche')).toBeLessThan(folge.indexOf('Kochteam steht.'));
    expect(folge.indexOf('Kochteam steht.')).toBeLessThan(folge.indexOf('Kinderbetreuung'));
    expect(folge.indexOf('Kinderbetreuung')).toBeLessThan(folge.indexOf('Zu 3 gesamt.'));
    expect(folge.indexOf('Zu 3 gesamt.')).toBeLessThan(folge.indexOf('Verschiedenes'));
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
