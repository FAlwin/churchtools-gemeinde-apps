import { describe, expect, it } from 'vitest';
import type { AblaufZeile } from './ablaufZeile';
import {
  BLATT_VORGABE,
  blattDienste,
  dauerText,
  minutenZwischen,
  terminBlatt,
  zustaendigeKurz,
  type BlattEinstellungen,
  type BlattQuelle,
  type BlattZeile,
  type Zelle,
} from './terminBlatt';

let id = 0;
const z = (title: string, x: Partial<AblaufZeile> = {}): AblaufZeile => ({
  id: ++id,
  title,
  type: x.isHeader ? 'header' : 'normal',
  isHeader: false,
  responsible: [],
  responsibleText: '',
  song: null,
  time: null,
  vorBeginn: false,
  durationMin: null,
  note: '',
  ...x,
});
const kopf = (title: string, x: Partial<AblaufZeile> = {}) => z(title, { isHeader: true, ...x });

const ZEILEN: AblaufZeile[] = [
  kopf('Vor dem Gottesdienst', { vorBeginn: true }),
  z('Soundcheck', {
    time: '09:30',
    durationMin: 25,
    vorBeginn: true,
    infos: [{ gruppeId: 2, text: 'Funk prüfen' }],
  }),
  z('Countdown', { time: '09:55', durationMin: 5, vorBeginn: true }),
  kopf('Eventstart'),
  z('Lied', {
    time: '10:00',
    durationMin: 4,
    song: { title: 'Jesus, du bist König', originalKey: 'F', bpm: 66, arrangement: 'Standard' },
    responsible: [
      { label: 'Irene Lang', open: false, dienst: 'Gesang' },
      { label: 'Elvira Koch', open: false, dienst: 'Gesang' },
    ],
  }),
  z('Begrüßung', {
    time: '10:04',
    durationMin: 10,
    note: 'mit Kindern',
    responsible: [{ label: 'Jakob Weber', open: false, dienst: 'Moderation' }],
  }),
  z('Video', { weggelassen: true, durationMin: 7 }),
  kopf('Predigt'),
  z('Predigt', { time: '10:14', durationMin: 30, responsible: [{ label: 'Predigt', open: true }] }),
];

const QUELLE: BlattQuelle = {
  titel: 'Gottesdienst',
  tag: '2026-11-01',
  beginn: '10:00',
  gemeinde: 'ECG Donrath',
  app: 'Dienstplaner',
  stand: 'Stand 05.11.2026, 09:25',
  zeilen: ZEILEN,
  dienste: [
    {
      id: 1,
      name: 'Programm',
      dienste: [
        { name: 'Moderation', personen: [{ name: 'Jakob Weber', angefragt: false }], frei: 0 },
      ],
    },
    {
      id: 2,
      name: 'Technik',
      dienste: [
        { name: 'Ton', personen: [{ name: 'Tobias Hahn', angefragt: true }], frei: 0 },
        { name: 'Licht', personen: [], frei: 1 },
      ],
    },
  ],
  infoGruppen: [
    { id: 1, name: 'Programm' },
    { id: 2, name: 'Technik' },
    { id: 3, name: 'Musik' },
  ],
  ansichtInfos: [2, 3],
};

const mit = (f: (e: BlattEinstellungen) => void): BlattEinstellungen => {
  const e = structuredClone(BLATT_VORGABE);
  f(e);
  return e;
};
const text = (c: Zelle) => c.absaetze.map((a) => a.laeufe.map((l) => l.text).join('')).join(' / ');
const eintraege = (zeilen: BlattZeile[]) => zeilen.filter((r) => r.art === 'eintrag');
const art = (zeilen: BlattZeile[]) =>
  zeilen.map((r) =>
    r.art === 'eintrag' ? text(r.zellen[2]) : `[${r.art}${'titel' in r ? ` ${r.titel}` : ''}]`,
  );

describe('Termin-Blatt: Kopf', () => {
  it('Titel, Datum mit Jahr, Beginn und Ende aus dem Ablauf, Dateiname mit Datum', () => {
    const b = terminBlatt(QUELLE, BLATT_VORGABE);
    expect(b.untertitel).toBe('Sonntag, 1. November 2026 · 10:00 – 10:44 Uhr');
    expect(b.dateiname).toBe('Gottesdienst 01.11.2026');
  });

  it('ohne Ablauf: nur der Beginn, kein Ablauf auf dem Blatt', () => {
    const b = terminBlatt({ ...QUELLE, zeilen: null }, BLATT_VORGABE);
    expect(b.untertitel).toBe('Sonntag, 1. November 2026 · 10:00 Uhr');
    expect(b.ablauf).toBeNull();
  });
});

describe('Termin-Blatt: Ablauf', () => {
  it('Vorlauf, dann „Beginn“, Abschnitte, Einträge, am Ende „Ende“ – weggelassene fehlen', () => {
    const b = terminBlatt(QUELLE, BLATT_VORGABE);
    expect(art(b.ablauf!.zeilen)).toEqual([
      '[abschnitt Vor dem Gottesdienst]',
      'Soundcheck',
      'Countdown',
      '[beginn]',
      '[abschnitt Eventstart]',
      'Lied · Jesus, du bist KönigF',
      'Begrüßung',
      '[abschnitt Predigt]',
      'Predigt',
      '[ende]',
    ]);
  });

  it('Abschnitte mit ihrer Dauer (ohne weggelassene), Ende mit Dauer ab Beginn und mit Vorlauf', () => {
    const b = terminBlatt(
      QUELLE,
      mit((e) => (e.ablauf.weggelassen = true)),
    );
    const zeilen = b.ablauf!.zeilen;
    expect(zeilen.find((r) => r.art === 'abschnitt' && r.titel === 'Eventstart')).toMatchObject({
      dauer: 'ca. 14 Min',
    });
    expect(zeilen.at(-1)).toEqual({
      art: 'ende',
      zeit: '10:44',
      dauer: 'Dauer 44 Min · mit Vorlauf 1 Std. 14 Min',
    });
    expect(text(eintraege(zeilen)[4].zellen[2])).toBe('Video (weggelassen)');
  });

  it('ohne Vorlauf: „Beginn“ ganz oben, Ende ohne „mit Vorlauf“', () => {
    const b = terminBlatt(
      QUELLE,
      mit((e) => (e.ablauf.vorlauf = false)),
    );
    expect(art(b.ablauf!.zeilen).slice(0, 2)).toEqual(['[beginn]', '[abschnitt Eventstart]']);
    expect(b.ablauf!.zeilen.at(-1)).toMatchObject({ dauer: 'Dauer 44 Min' });
  });

  it('Spalten: Zeit, Dauer, Eintrag, Zuständig und nur Info-Gruppen mit Text – leere Spalten fallen weg', () => {
    const b = terminBlatt(QUELLE, BLATT_VORGABE);
    // Musik ist in der Ansicht gewählt, hat aber keinen Text an diesem Termin.
    expect(b.ablauf!.kopf).toEqual(['Zeit', 'Dauer', 'Eintrag', 'Zuständig', 'Technik']);
    expect(text(eintraege(b.ablauf!.zeilen)[0].zellen[4])).toBe('Funk prüfen');
  });

  it('Infos im Fenster gewählt: gilt statt der Ansicht; aus → keine Info-Spalte', () => {
    expect(
      terminBlatt(
        QUELLE,
        mit((e) => (e.infos.gruppen = [1, 3])),
      ).ablauf!.kopf,
    ).not.toContain('Technik');
    expect(
      terminBlatt(
        QUELLE,
        mit((e) => (e.infos.an = false)),
      ).ablauf!.kopf,
    ).toEqual(['Zeit', 'Dauer', 'Eintrag', 'Zuständig']);
  });

  it('Infos unter dem Eintrag: keine Spalte, eine kleine Zeile „Technik: …“ im Eintrag', () => {
    const b = terminBlatt(
      QUELLE,
      mit((e) => (e.infos.unter = true)),
    );
    expect(b.ablauf!.kopf).not.toContain('Technik');
    expect(text(eintraege(b.ablauf!.zeilen)[0].zellen[2])).toBe(
      'Soundcheck / Technik: Funk prüfen',
    );
  });

  it('Zuständig unter dem Eintrag: keine Spalte, klein im Eintrag; Notiz und Arrangement nur nach Wahl', () => {
    const b = terminBlatt(
      QUELLE,
      mit((e) => {
        e.ablauf.zustaendigUnter = true;
        e.ablauf.notiz = true;
        e.ablauf.arrangement = true;
        e.ablauf.tempo = true;
      }),
    );
    expect(b.ablauf!.kopf).not.toContain('Zuständig');
    const [, , lied, begr] = eintraege(b.ablauf!.zeilen);
    expect(text(lied.zellen[2])).toBe(
      'Lied · Jesus, du bist KönigF · 66 bpm / Arrangement Standard / Gesang',
    );
    expect(text(begr.zellen[2])).toBe('Begrüßung / Jakob Weber / mit Kindern');
  });

  it('Uhrzeit und Dauer abwählbar', () => {
    const b = terminBlatt(
      QUELLE,
      mit((e) => {
        e.ablauf.uhrzeit = false;
        e.ablauf.dauer = false;
      }),
    );
    expect(b.ablauf!.kopf.slice(0, 2)).toEqual(['Eintrag', 'Zuständig']);
  });

  it('Ablauf aus → kein Ablauf, die Dienste bleiben', () => {
    const b = terminBlatt(
      QUELLE,
      mit((e) => (e.ablauf.an = false)),
    );
    expect(b.ablauf).toBeNull();
    expect(b.dienste).toHaveLength(2);
  });
});

describe('Termin-Blatt: Zuständige kurz', () => {
  it('mehrere über denselben Dienst → nur der Dienst; einzelne mit Namen; offene rot mit „frei“', () => {
    expect(
      zustaendigeKurz([
        { label: 'Irene Lang', open: false, dienst: 'Gesang' },
        { label: 'Jakob Weber', open: false, dienst: 'Moderation' },
        { label: 'Elvira Koch', open: false, dienst: 'Gesang' },
        { label: 'Klavier', open: true },
        { label: 'Gast Müller', open: false },
      ]),
    ).toEqual([
      { text: 'Gesang', stil: 'grau' },
      { text: ', ', stil: 'grau' },
      { text: 'Jakob Weber' },
      { text: ', ' },
      { text: 'Klavier – frei', stil: 'rot' },
      { text: ', ', stil: 'rot' },
      { text: 'Gast Müller' },
    ]);
  });
});

describe('Termin-Blatt: Dienste', () => {
  it('abgewählte Gruppen fallen weg, Freie und „angefragt“ nach Wahl, leere Dienste und Gruppen fallen weg', () => {
    const gruppen = QUELLE.dienste;
    expect(
      blattDienste(gruppen, { ...BLATT_VORGABE.dienste, ohne: [1] }).map((g) => g.name),
    ).toEqual(['Technik']);
    const ohneFrei = blattDienste(gruppen, {
      ...BLATT_VORGABE.dienste,
      frei: false,
      angefragt: false,
    });
    expect(ohneFrei[1].dienste).toEqual([
      { name: 'Ton', personen: [{ name: 'Tobias Hahn', angefragt: false }], frei: 0 },
    ]);
  });

  it('Dienste aus → keine Dienste; „unten“ wird weitergegeben', () => {
    expect(
      terminBlatt(
        QUELLE,
        mit((e) => (e.dienste.an = false)),
      ).dienste,
    ).toBeNull();
    expect(
      terminBlatt(
        QUELLE,
        mit((e) => (e.dienste.unten = true)),
      ).diensteUnten,
    ).toBe(true);
  });
});

describe('Hilfen', () => {
  it('dauerText und minutenZwischen', () => {
    expect([dauerText(14), dauerText(60), dauerText(95)]).toEqual([
      '14 Min',
      '1 Std.',
      '1 Std. 35 Min',
    ]);
    expect(minutenZwischen('10:00', '11:35')).toBe(95);
    expect(minutenZwischen('23:30', '00:15')).toBe(45);
    expect(minutenZwischen('x', '10:00')).toBeNull();
  });
});
