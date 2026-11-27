import { describe, expect, it } from 'vitest';
import { GRUPPENFELD_MAX } from './feldwert';
import {
  ZEILEN_MAX,
  listeAus,
  listeAusDaten,
  listeDaten,
  listeEinstellungFehler,
  listeFehlerTexte,
  listeLesbar,
  listePruefen,
  listenSumme,
  listenZahl,
  neueSpalte,
  neueSpaltenKennung,
  standardListe,
  summeFuerCt,
  zeilenZustand,
  type ListeAntwort,
  type ListeEinstellung,
} from './zeilenListe';

/** Baustein „Liste mit Zeilen“ (F6a, Entwurf `f6-liste-v1`): EINE Regel für Formular, Tabelle und ChurchTools-Text. */

/** Das Beispiel aus dem Entwurf. */
const INVENTAR: ListeEinstellung = {
  spalten: [
    { id: 'a', name: 'Gegenstand', art: 'text' },
    { id: 'b', name: 'Anzahl', art: 'zahl' },
    { id: 'c', name: 'Wert gesamt', art: 'zahl', einheit: '€', summe: true },
    { id: 'd', name: 'Zustand', art: 'auswahl', antworten: ['neu', 'gut', 'gebraucht'] },
  ],
  max: 15,
};
const zeile = (a: string, b: string, c: string, d: string) => ({ a, b, c, d });
const PAULA: ListeAntwort = {
  zeilen: [
    zeile('Zelt für 4 Personen', '1', '150', 'gut'),
    zeile('Gaskocher mit Kartusche', '1', '40', 'neu'),
    zeile('Bierbank-Garnitur', '2', '120', 'gebraucht'),
  ],
};

describe('listenZahl – wie man in Deutschland Zahlen tippt', () => {
  it.each([
    ['2,5', 2.5],
    ['1.234,50', 1234.5],
    ['1.234', 1234],
    ['1.234.567', 1234567],
    ['1.5', 1.5],
    ['12.75', 12.75],
    ['-3', -3],
    ['150', 150],
    [' 4 ', 4],
    ['1 000', 1000],
  ])('„%s“ → %s', (text, zahl) => expect(listenZahl(text)).toBe(zahl));

  it.each(['', '1e3', 'zwei', '1,2,3', '1.2.3', '1,234.5', '--1', '0x10'])(
    '„%s“ ist keine Zahl',
    (text) => expect(listenZahl(text)).toBeNull(),
  );
});

describe('zeilenZustand – leer, vollständig, angefangen', () => {
  it('leer: keine Zelle hat etwas (Leerzeichen zählen nicht)', () => {
    expect(zeilenZustand(INVENTAR, {})).toEqual({ art: 'leer' });
    expect(zeilenZustand(INVENTAR, zeile(' ', '', '', ''))).toEqual({ art: 'leer' });
  });

  it('vollständig: jede Zelle gültig', () => {
    expect(zeilenZustand(INVENTAR, PAULA.zeilen[0])).toEqual({ art: 'voll' });
  });

  it('angefangen: sagt, welche Spalten fehlen oder nicht passen (Zahl, Auswahl)', () => {
    const st = zeilenZustand(INVENTAR, zeile('Zelt', 'zwei', '', 'kaputt'));
    expect(st.art).toBe('angefangen');
    expect(st.art === 'angefangen' && st.fehlt.map((s) => s.name)).toEqual([
      'Anzahl',
      'Wert gesamt',
      'Zustand',
    ]);
  });

  it('Text über 255 Zeichen passt nicht', () => {
    const st = zeilenZustand(INVENTAR, zeile('x'.repeat(256), '1', '1', 'neu'));
    expect(st.art === 'angefangen' && st.fehlt.map((s) => s.id)).toEqual(['a']);
  });
});

describe('listePruefen – was das Absenden aufhält', () => {
  it('angefangene Zeile hält auch bei einer freiwilligen Liste auf – je fehlender Zelle ein Pfad', () => {
    const a = { zeilen: [PAULA.zeilen[0], zeile('Lampe', '', '', '')] };
    expect(listePruefen(INVENTAR, a, false)).toEqual(['1.b', '1.c', '1.d']);
  });

  it('leere Zeilen fallen weg und halten nichts auf', () => {
    expect(listePruefen(INVENTAR, { zeilen: [PAULA.zeilen[0], {}] }, true)).toEqual([]);
  });

  it('Pflicht: ohne vollständige Zeile das Feld selbst (leerer Pfad-Teil) – freiwillig nicht', () => {
    expect(listePruefen(INVENTAR, { zeilen: [{}] }, true)).toEqual(['']);
    expect(listePruefen(INVENTAR, undefined, true)).toEqual(['']);
    expect(listePruefen(INVENTAR, { zeilen: [] }, false)).toEqual([]);
  });

  it('mehr vollständige Zeilen als erlaubt → `max`', () => {
    const l = { ...INVENTAR, max: 2 };
    expect(listePruefen(l, PAULA, false)).toEqual(['max']);
  });

  it('passt „(Daten)“ nicht in ein Gruppenfeld (4.000 Zeichen) → `lang`, nie still gekürzt (M9)', () => {
    const l: ListeEinstellung = {
      spalten: [{ id: 'a', name: 'Was', art: 'text' }],
      max: ZEILEN_MAX,
    };
    // 50 Zeilen × 80 Zeichen ≈ 4.300 Zeichen Daten.
    const lang = { zeilen: Array.from({ length: 50 }, (_, i) => ({ a: `${i}`.padEnd(80, 'x') })) };
    expect(listeDaten(l, lang).length).toBeGreaterThan(GRUPPENFELD_MAX);
    expect(listePruefen(l, lang, false)).toEqual(['lang']);
    // Mit kürzeren Einträgen passt dieselbe Zeilenzahl.
    const kurz = { zeilen: lang.zeilen.map((z) => ({ a: z.a.slice(0, 60) })) };
    expect(listePruefen(l, kurz, false)).toEqual([]);
  });

  it('die Sätze darunter – wie im Entwurf', () => {
    expect(listeFehlerTexte(INVENTAR, ['', '1.b', '1.c', '0.d', 'lang'])).toEqual([
      'Bitte mindestens eine Zeile vollständig ausfüllen.',
      'Zeile 1: Zustand fehlt',
      'Zeile 2: Anzahl, Wert gesamt fehlen',
      'Die Liste ist zu lang zum Speichern – bitte kürzer fassen oder Zeilen weglassen.',
    ]);
  });
});

describe('Summe – nur über vollständige Zeilen, je Zeile der Gesamtwert', () => {
  it('Entwurf: 150 + 40 + 120 = 310 (kein Anzahl × Wert)', () => {
    expect(listenSumme(INVENTAR, PAULA)).toBe(310);
  });

  it('angefangene Zeilen zählen nicht mit', () => {
    const a = { zeilen: [...PAULA.zeilen, zeile('Lampe', '1', '999', '')] };
    expect(listenSumme(INVENTAR, a)).toBe(310);
  });

  it('auf Hundertstel gerundet, für ChurchTools mit Punkt (ein Komma lehnt ChurchTools ab, M9)', () => {
    const a = { zeilen: [zeile('A', '1', '0,1', 'neu'), zeile('B', '1', '0,2', 'neu')] };
    expect(listenSumme(INVENTAR, a)).toBe(0.3);
    expect(summeFuerCt(1234.5)).toBe('1234.5');
    expect(summeFuerCt(0.1 + 0.2)).toBe('0.3');
  });

  it('ohne „Summe zeigen“ keine Summe', () => {
    expect(listenSumme(standardListe(), { zeilen: [{ a: 'x', b: '2' }] })).toBeNull();
  });
});

describe('listeLesbar – der Text für ChurchTools', () => {
  it('Kopfzeile mit Einheit, eine Zeile je vollständigem Eintrag, Zahlen deutsch, kein Umbruch am Ende', () => {
    const a = { zeilen: [...PAULA.zeilen, {}, zeile('Kabel', '3', '1.234,5', 'gut')] };
    expect(listeLesbar(INVENTAR, a)).toBe(
      [
        'Gegenstand · Anzahl · Wert gesamt (€) · Zustand',
        'Zelt für 4 Personen · 1 · 150 · gut',
        'Gaskocher mit Kartusche · 1 · 40 · neu',
        'Bierbank-Garnitur · 2 · 120 · gebraucht',
        'Kabel · 3 · 1.234,5 · gut',
      ].join('\n'),
    );
  });

  it('ohne vollständige Zeile leer', () => {
    expect(listeLesbar(INVENTAR, { zeilen: [zeile('Zelt', '', '', '')] })).toBe('');
  });

  it('zu lang: hinten fallen Zeilen weg, die letzte sagt wie viele – nie über 4.000 Zeichen', () => {
    const l: ListeEinstellung = {
      spalten: [{ id: 'a', name: 'Was', art: 'text' }],
      max: ZEILEN_MAX,
    };
    const a = {
      zeilen: Array.from({ length: 50 }, (_, i) => ({ a: `Eintrag ${i + 1} `.padEnd(100, 'x') })),
    };
    const text = listeLesbar(l, a);
    expect(text.length).toBeLessThanOrEqual(GRUPPENFELD_MAX);
    const zeilen = text.split('\n');
    expect(zeilen[0]).toBe('Was');
    expect(zeilen.at(-1)).toMatch(/^… und \d+ weitere Zeilen$/);
    const rest = Number(/(\d+)/.exec(zeilen.at(-1)!)![1]);
    expect(zeilen.length - 2 + rest).toBe(50);
  });
});

describe('„(Daten)“ – feste Form, über die Kennung der Spalte', () => {
  it('nur vollständige Zeilen, Zahlen als Zahl, Kennungen der Spalten einmal', () => {
    const a = { zeilen: [PAULA.zeilen[0], {}, zeile('Kabel', '3', '1.234,5', 'gut')] };
    expect(JSON.parse(listeDaten(INVENTAR, a))).toEqual({
      v: 1,
      s: ['a', 'b', 'c', 'd'],
      z: [
        ['Zelt für 4 Personen', 1, 150, 'gut'],
        ['Kabel', 3, 1234.5, 'gut'],
      ],
    });
    expect(listeDaten(INVENTAR, { zeilen: [] })).toBe('');
  });

  it('zurückgelesen mit verschobenen, umbenannten und gelöschten Spalten – jede Zelle bleibt bei ihrer Spalte', () => {
    const text = listeDaten(INVENTAR, PAULA);
    const spaeter: ListeEinstellung = {
      ...INVENTAR,
      spalten: [
        { ...INVENTAR.spalten[3], name: 'Wie gut?' },
        INVENTAR.spalten[0],
        INVENTAR.spalten[2],
        { id: 'neu', name: 'Farbe', art: 'text' },
      ],
    };
    expect(listeAusDaten(spaeter, text)?.zeilen[0]).toEqual({
      d: 'gut',
      a: 'Zelt für 4 Personen',
      c: '150',
    });
  });

  it('Zahlen kommen deutsch zurück; Hin und Zurück ergibt dieselbe Summe und denselben Text', () => {
    const a = { zeilen: [zeile('Kabel', '3', '12,5', 'gut')] };
    const zurueck = listeAusDaten(INVENTAR, listeDaten(INVENTAR, a))!;
    expect(zurueck.zeilen[0].c).toBe('12,5');
    expect(listenSumme(INVENTAR, zurueck)).toBe(listenSumme(INVENTAR, a));
    expect(listeLesbar(INVENTAR, zurueck)).toBe(listeLesbar(INVENTAR, a));
  });

  it('Sonderzeichen, HTML und Emoji bleiben heil (in ChurchTools gemessen, M9 Punkt 9)', () => {
    const l = standardListe();
    const a = { zeilen: [{ a: ` "groß" \\ <b>&amp;</b> 😀 `, b: '1' }] };
    expect(listeAusDaten(l, listeDaten(l, a))?.zeilen[0].a).toBe('"groß" \\ <b>&amp;</b> 😀');
  });

  it('kein gültiges Format → `null` (dann zeigt das Tool den lesbaren Text)', () => {
    expect(listeAusDaten(INVENTAR, 'Zelt · 1')).toBeNull();
    expect(listeAusDaten(INVENTAR, '{"v":2,"s":[],"z":[]}')).toBeNull();
    expect(listeAusDaten(INVENTAR, '')).toEqual({ zeilen: [] });
  });
});

describe('listeEinstellungFehler – Baukasten', () => {
  it('der Baustein, wie er kommt, ist in Ordnung', () => {
    expect(listeEinstellungFehler(standardListe())).toBeNull();
    expect(listeEinstellungFehler(INVENTAR)).toBeNull();
  });

  it.each<[string, ListeEinstellung | undefined, RegExp]>([
    ['ohne Einstellung', undefined, /mindestens eine Spalte/],
    ['ohne Spalte', { spalten: [], max: 10 }, /mindestens eine Spalte/],
    [
      'sechs Spalten',
      {
        spalten: Array.from({ length: 6 }, (_, i) => ({
          id: `s${i}`,
          name: `S${i}`,
          art: 'text' as const,
        })),
        max: 10,
      },
      /Höchstens 5 Spalten/,
    ],
    ['Name leer', { spalten: [{ id: 'a', name: ' ', art: 'text' }], max: 10 }, /Namen/],
    [
      'zwei gleiche Namen',
      {
        spalten: [
          { id: 'a', name: 'Was', art: 'text' },
          { id: 'b', name: 'was ', art: 'zahl' },
        ],
        max: 10,
      },
      /Zwei Spalten heißen „was“/,
    ],
    [
      'Auswahl mit einer Antwort',
      { spalten: [{ id: 'a', name: 'Zustand', art: 'auswahl', antworten: ['neu', ' '] }], max: 10 },
      /bei „Zustand“ mindestens zwei Antworten/,
    ],
    [
      'zwei Summen',
      {
        spalten: [
          { id: 'a', name: 'A', art: 'zahl', summe: true },
          { id: 'b', name: 'B', art: 'zahl', summe: true },
        ],
        max: 10,
      },
      /Nur eine Spalte/,
    ],
    [
      'Summe an Text',
      { spalten: [{ id: 'a', name: 'A', art: 'text', summe: true }], max: 10 },
      /nur bei Zahl-Spalten/,
    ],
    [
      '21 Antworten (wie das Schema)',
      {
        spalten: [
          {
            id: 'a',
            name: 'Farbe',
            art: 'auswahl',
            antworten: Array.from({ length: 21 }, (_, i) => `F${i}`),
          },
        ],
        max: 10,
      },
      /höchstens 20 Antworten/,
    ],
    [
      'Antwort mit 256 Zeichen (wie das Schema)',
      {
        spalten: [{ id: 'a', name: 'Farbe', art: 'auswahl', antworten: ['rot', 'x'.repeat(256)] }],
        max: 10,
      },
      /länger als 255 Zeichen/,
    ],
    ['0 Zeilen', { ...standardListe(), max: 0 }, /1 bis 50/],
    ['51 Zeilen', { ...standardListe(), max: 51 }, /1 bis 50/],
  ])('%s', (_, l, fehler) => expect(listeEinstellungFehler(l)).toMatch(fehler));
});

describe('Kleinkram', () => {
  it('neue Spalten-Kennung: nie eine vergebene', () => {
    const spalten = standardListe().spalten;
    const ids = new Set(spalten.map((s) => s.id));
    for (let i = 0; i < 50; i++) {
      const id = neueSpaltenKennung(spalten);
      expect(ids.has(id)).toBe(false);
      expect(id).toMatch(/^[0-9a-z]{4}$/);
    }
  });

  it('neue Spalte: Text mit freiem Namen („Neue Spalte“, „Neue Spalte 2“ …)', () => {
    let spalten = standardListe().spalten;
    for (let i = 0; i < 3; i++) spalten = [...spalten, neueSpalte(spalten)];
    expect(spalten.slice(2).map((s) => [s.name, s.art])).toEqual([
      ['Neue Spalte', 'text'],
      ['Neue Spalte 2', 'text'],
      ['Neue Spalte 3', 'text'],
    ]);
    expect(listeEinstellungFehler({ spalten, max: 10 })).toBeNull();
  });

  it('listeAus: alles andere wird eine leere Liste, fremde Werte in Zellen fallen weg', () => {
    expect(listeAus('Text')).toEqual({ zeilen: [] });
    expect(listeAus({ zeilen: [{ a: 'x', b: 3 }, null] })).toEqual({ zeilen: [{ a: 'x' }, {}] });
  });
});
