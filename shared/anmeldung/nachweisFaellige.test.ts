import { describe, expect, it } from 'vitest';
import { plusTage, tagPunkt } from '../ct/datum';
import { NACHWEIS_BETREFF_MAX, NACHWEIS_TEXT_MAX, nachweisMail } from './nachweise';
import { LAEUFT_AB_TAGE, standText, type NachweisStand } from './nachweisStand';
import {
  faelligeEmpfaenger,
  faelligeMailFehler,
  faelligeMeldung,
  faelligeVorgabe,
  faelligeZahl,
  istFaellig,
  vermerkText,
  type FaelligeBilanz,
  type FaelligePerson,
} from './nachweisFaellige';

/**
 * Fällige anschreiben (N2c): Wer bekommt eine Mail, was steht darin, was im Vermerk, was in der Meldung. Die Stände kommen
 * aus den Erzeugern (`standText`, `LAEUFT_AB_TAGE`), die Tage aus `plusTage` – keine abgeschriebenen Literale.
 */
const HEUTE = '2026-11-20';
const BIS_BALD = plusTage(HEUTE, LAEUFT_AB_TAGE);
const BIS_VORBEI = plusTage(HEUTE, -49);

const P = (
  personId: number,
  name: string,
  stand: NachweisStand,
  p: Partial<FaelligePerson> = {},
): FaelligePerson => ({ personId, name, stand, luecke: null, aufgabe: null, ...p });

const ALLE: FaelligePerson[] = [
  P(1, 'Lena Probst', { art: 'fehlt', seit: '2026-10-01', wochen: 7 }),
  P(2, 'Jonas Weber', { art: 'ruecksprache' }),
  P(3, 'Mia Muster', { art: 'laeuftAb', bis: BIS_BALD }, { aufgabe: { id: 303 } }),
  P(
    4,
    'Ben Alt',
    { art: 'abgelaufen', bis: BIS_VORBEI },
    {
      aufgabe: { id: 304 },
      luecke: 'Antrag unvollständig: Adresse fehlt',
    },
  ),
  P(5, 'Paula Neu', { art: 'angefordert', seit: HEUTE }),
  P(6, 'Sara Weber', { art: 'gueltig', bis: plusTage(HEUTE, 900) }),
  P(7, 'Tim Neu', { art: 'keineAufgabe' }),
  P(8, 'Uwe Rest', { art: 'unvollstaendig' }),
  P(9, 'Anna Ab', { art: 'abgelaufen', bis: plusTage(HEUTE, -1) }),
];
const MAILS = new Map<number, string | null>(
  ALLE.map((p) => [p.personId, `p${p.personId}@x.test`]),
);

describe('Wer angeschrieben wird', () => {
  it('nur „läuft ab“ und „abgelaufen“ – nicht fehlt, Rücksprache, angefordert, gültig, noch keine Aufgabe, unvollständig', () => {
    expect(ALLE.filter((p) => istFaellig(p.stand)).map((p) => p.name)).toEqual([
      'Mia Muster',
      'Ben Alt',
      'Anna Ab',
    ]);
    expect(faelligeEmpfaenger(ALLE, MAILS).map((x) => x.name)).toEqual([
      'Anna Ab',
      'Ben Alt',
      'Mia Muster',
    ]);
    expect(faelligeZahl(ALLE)).toBe(3);
    expect(faelligeZahl([])).toBe(0);
  });

  it('abgelaufen steht vor „läuft ab“, auch wenn der Name der Person mit „läuft ab“ alphabetisch früher kommt', () => {
    const e = faelligeEmpfaenger(
      [
        P(11, 'Aaron Früh', { art: 'laeuftAb', bis: BIS_BALD }),
        P(12, 'Zoe Spät', { art: 'abgelaufen', bis: BIS_VORBEI }),
      ],
      MAILS,
    );
    expect(e.map((x) => x.name)).toEqual(['Zoe Spät', 'Aaron Früh']);
  });

  it('die Grenzen kommen aus der Regel des Stands: 56 Tage = läuft ab, gestern = abgelaufen, heute = läuft ab', () => {
    const e = faelligeEmpfaenger(ALLE, MAILS);
    expect(e.find((x) => x.name === 'Mia Muster')?.abgelaufen).toBe(false);
    expect(e.find((x) => x.name === 'Anna Ab')?.abgelaufen).toBe(true);
  });

  it('abgelaufen zuerst, dann nach Name; je Zeile Name, „läuft ab am / abgelaufen seit“ mit Jahr, Lücke, Aufgabe', () => {
    const e = faelligeEmpfaenger(ALLE, MAILS);
    expect(e.map((x) => x.abgelaufen)).toEqual([true, true, false]);
    expect(e[1]).toMatchObject({
      personId: 4,
      name: 'Ben Alt',
      email: 'p4@x.test',
      wann: `abgelaufen seit ${tagPunkt(BIS_VORBEI)}`,
      luecke: 'Antrag unvollständig: Adresse fehlt',
      aufgabeId: 304,
    });
    expect(e[2]).toMatchObject({ wann: `läuft ab am ${tagPunkt(BIS_BALD)}`, aufgabeId: 303 });
    // Dieselbe Aussage wie das Etikett der Seite – nur mit Jahr.
    const bald = ALLE[2].stand;
    expect(standText(bald)).toContain(tagPunkt(BIS_BALD).slice(0, 5));
  });

  it('ohne Mailadresse (fehlt, leer, nur Leerzeichen) bleibt die Person in der Liste, aber ohne Adresse', () => {
    const e = faelligeEmpfaenger(
      ALLE,
      new Map<number, string | null>([
        [3, null],
        [4, '   '],
        [9, ' a@x.test '],
      ]),
    );
    expect(e.map((x) => [x.name, x.email])).toEqual([
      ['Anna Ab', 'a@x.test'],
      ['Ben Alt', null],
      ['Mia Muster', null],
    ]);
  });

  it('eine Person ohne offene Aufgabe hat keine Aufgabennummer', () => {
    const e = faelligeEmpfaenger(ALLE, MAILS);
    expect(e.find((x) => x.name === 'Anna Ab')?.aufgabeId).toBeNull();
  });
});

describe('Die Vorgabe für Betreff und Text', () => {
  it('der Name der Art steht darin, [Vorname] als Gruß, Absender unten', () => {
    const v = faelligeVorgabe({ name: 'JuLeiCa', mitAntrag: false }, 'Otto');
    expect(v.betreff).toBe('Dein Nachweis „JuLeiCa“ läuft ab');
    expect(v.text.startsWith('Hallo [Vorname],')).toBe(true);
    expect(v.text).toContain('„JuLeiCa“');
    expect(v.text.endsWith('Viele Grüße\nOtto')).toBe(true);
  });

  it('mit Antrag steht der Weg zur Bescheinigung darin, ohne Antrag nicht', () => {
    const mit = faelligeVorgabe({ name: 'Führungszeugnis', mitAntrag: true }, 'Otto').text;
    const ohne = faelligeVorgabe({ name: 'Führungszeugnis', mitAntrag: false }, 'Otto').text;
    expect(mit).toContain('„Meine Gruppen“ → „Nachweis: Führungszeugnis“ → Bescheinigungen');
    expect(ohne).not.toContain('Meine Gruppen');
    expect(ohne).not.toContain('Bescheinigungen');
    expect(ohne).toContain('Vertrauensperson');
  });

  it('die Vorgabe ist selbst eine gültige Mail – und wird zu {{person.firstName}}', () => {
    for (const mitAntrag of [true, false]) {
      const v = faelligeVorgabe({ name: 'X', mitAntrag }, 'Otto');
      expect(faelligeMailFehler(v)).toBeNull();
      const m = nachweisMail(v);
      expect(m.unbekannt).toEqual([]);
      expect(m.html).toContain('{{person.firstName}}');
      expect(m.html).not.toContain('[Vorname]');
    }
  });

  it('ein sehr langer Name sprengt den Betreff nicht', () => {
    const v = faelligeVorgabe({ name: 'x'.repeat(500), mitAntrag: false }, 'Otto');
    expect(v.betreff.length).toBeLessThanOrEqual(NACHWEIS_BETREFF_MAX);
  });
});

describe('Prüfung von Betreff und Text', () => {
  const gut = { betreff: 'B', text: 'Hallo [Vorname]' };
  it('leer, zu lang, unbekannter Platzhalter – wie bei der Aufforderung der Art', () => {
    expect(faelligeMailFehler(gut)).toBeNull();
    expect(faelligeMailFehler({ ...gut, betreff: ' ' })).toMatch(/Betreff/);
    expect(faelligeMailFehler({ ...gut, text: '' })).toMatch(/Text/);
    expect(faelligeMailFehler({ ...gut, betreff: 'x'.repeat(NACHWEIS_BETREFF_MAX + 1) })).toMatch(
      /Betreff.*zu lang/,
    );
    expect(faelligeMailFehler({ ...gut, text: 'x'.repeat(NACHWEIS_TEXT_MAX + 1) })).toMatch(
      /Text.*zu lang/,
    );
    // [Nachname] kennt ChurchTools ebenfalls (`PERSON_PLATZHALTER`) – dieselbe Regel wie bei der Aufforderung der Art.
    expect(faelligeMailFehler({ ...gut, text: 'Hallo [Nachname]' })).toBeNull();
    expect(faelligeMailFehler({ ...gut, text: 'Hallo [Anmelde-Nr.]' })).toMatch(/\[Anmelde-Nr\.\]/);
    expect(faelligeMailFehler({ ...gut, text: 'Hallo [Vorname] [Betrag]' })).toMatch(/\[Betrag\]/);
  });
});

describe('Der Vermerk', () => {
  it('„Angeschrieben am TT.MM.JJJJ von Name“', () => {
    expect(vermerkText(HEUTE, 'Otto Messnull')).toBe(
      `Angeschrieben am ${tagPunkt(HEUTE)} von Otto Messnull`,
    );
    expect(vermerkText(HEUTE, '  Otto  ')).toBe(`Angeschrieben am ${tagPunkt(HEUTE)} von Otto`);
  });
});

describe('Die Meldung nach dem Senden', () => {
  const B: FaelligeBilanz = {
    gesendet: 2,
    bestaetigt: 2,
    adressen: 2,
    vermerkGewollt: true,
    vermerkt: ['Mia Muster', 'Ben Alt'],
    vermerkFehlt: [],
    ohneAufgabe: [],
    vermerkUnsicher: false,
  };
  it('alles gut: der Satz aus dem Entwurf', () => {
    expect(faelligeMeldung(B)).toBe('2 Mails verschickt, Vermerk an beiden Aufgaben.');
  });
  it('eine Mail, eine Aufgabe, drei und mehr', () => {
    expect(
      faelligeMeldung({ ...B, gesendet: 1, adressen: 1, bestaetigt: 1, vermerkt: ['A'] }),
    ).toBe('1 Mail verschickt, Vermerk an der Aufgabe.');
    expect(faelligeMeldung({ ...B, vermerkt: ['A', 'B', 'C'] })).toContain('Vermerk an 3 Aufgaben');
  });
  it('ohne Häkchen kein Wort über den Vermerk', () => {
    expect(faelligeMeldung({ ...B, vermerkGewollt: false, vermerkt: [] })).toBe(
      '2 Mails verschickt.',
    );
  });
  it('Protokoll nicht lesbar: ehrlich „nicht lesbar“, nicht „bestätigt“', () => {
    const t = faelligeMeldung({ ...B, bestaetigt: null });
    expect(t).toContain('verschickt');
    expect(t).toMatch(/nicht lesbar/);
    expect(t).not.toMatch(/laut Protokoll|bestätigt/);
  });
  it('im Protokoll fehlen Adressen: sagt es, und der Vermerk wurde nicht geschrieben', () => {
    const t = faelligeMeldung({ ...B, bestaetigt: 1, vermerkt: [], vermerkUnsicher: true });
    expect(t).toMatch(/nur 1 von 2 Adressen/);
    expect(t).toMatch(/Vermerk nicht geschrieben/);
  });
  it('Vermerk fehlt bei einer Person: Mail bleibt „verschickt“, die Person steht mit Grund da', () => {
    const t = faelligeMeldung({
      ...B,
      vermerkt: ['Mia Muster'],
      vermerkFehlt: [{ name: 'Ben Alt', grund: 'die Aufgabe gibt es nicht mehr' }],
    });
    expect(t).toBe(
      '2 Mails verschickt, Vermerk an der Aufgabe, Vermerk bei Ben Alt (die Aufgabe gibt es nicht mehr) fehlt.',
    );
  });
  it('Person ohne offene Aufgabe: genannt', () => {
    expect(faelligeMeldung({ ...B, vermerkt: ['Mia Muster'], ohneAufgabe: ['Anna Ab'] })).toMatch(
      /keine offene Aufgabe bei Anna Ab/,
    );
  });
});
