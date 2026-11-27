import { describe, expect, it } from 'vitest';
import { plusTage } from '../ct/datum';
import { anmeldungenAus, mitgliederstandAus, type ListenAnmeldung } from './liste';
import { FELDER, PERSONEN, STICHTAG, e, mitglieder } from './liste.testdaten';
import { antworten } from './senden.testdaten';
import type { NachweisBedarf } from './nachweisBedarf';
import type { OeffentlicheEinstellungen } from './formular';
import type { NachweisAblage } from './nachweisStandAblage';
import {
  NACHWEIS_HINWEIS_TAGE,
  imHinweisFenster,
  nachweisLageBauen,
  ohneGueltigenNachweis,
} from './nachweisAmpelLage';
import { zaehltFuerNachweis } from './nachweisBedarf';
import { personZeilen } from './tabelle';

/**
 * Die Lage der Ampel (N3d): aus Einstellungen, Anmeldungen (`liste.testdaten`: AAAAAA Jonas 10 + Lena 11, BBBBBB Jonas 20 +
 * Lena 21 auf der Warteliste, CCCCCC 30 + 31; Foto „Ja“ haben 10 und 20) und der Ablage. „heute“ ist ein Parameter.
 */
const HEUTE = '2026-11-20';
const ENDE = '2026-11-22';
const ALLE = 61;
const NUR = 62;
const ohneAllergie = () => {
  const a = antworten();
  a.anmeldung.tel = '';
  a.personen = a.personen.map((p) => ({ ...p, allergy: '', foto: 'Nein' }));
  return a;
};
const personen = new Map([
  ...PERSONEN,
  ...[20, 30].map((id) => [id, PERSONEN.get(10)!] as const),
  ...[21, 31].map((id) => [id, PERSONEN.get(11)!] as const),
]);
const liste = (x: OeffentlicheEinstellungen): ListenAnmeldung[] =>
  anmeldungenAus(
    x,
    mitgliederstandAus(
      [
        ...mitglieder('AAAAAA', [true, true], 10),
        ...mitglieder('BBBBBB', [true, false], 20),
        ...mitglieder('CCCCCC', [true, true], 30, { antworten: ohneAllergie() }),
      ],
      [],
      FELDER,
      new Set([35]),
      personen,
    ),
    STICHTAG,
  );
const mitTermin = (nachweise: NachweisBedarf[]) => ({
  ...e(),
  termin: { beginn: '2026-11-20T10:00', ende: `${ENDE}T12:00`, ort: '', terminId: null },
  nachweise,
});
const ALLE_B: NachweisBedarf = { artGruppeId: ALLE, fuer: 'alle' };
const NUR_B: NachweisBedarf = {
  artGruppeId: NUR,
  fuer: 'nurWenn',
  feld: 'frage:foto',
  antworten: ['Ja'],
};
const ablage = (
  staende: Record<number, Record<number, string>>,
  namen: Record<number, string> = {},
): NachweisAblage => ({
  art: 'gelesen',
  staende: new Map(
    Object.entries(staende).map(([g, p]) => [
      Number(g),
      new Map(Object.entries(p).map(([k, v]) => [Number(k), v])),
    ]),
  ),
  namen: new Map(Object.entries(namen).map(([k, v]) => [Number(k), v])),
});
const wer = (l: ReturnType<typeof nachweisLageBauen>, art: number, id: number) =>
  l.arten.get(art)?.ampel.get(id)?.wert;

describe('nachweisLageBauen – eine Veranstaltung, alle Zustände', () => {
  const x = mitTermin([ALLE_B]);
  const l = liste(x);
  const lage = nachweisLageBauen(
    x,
    l,
    ablage(
      {
        [ALLE]: {
          10: plusTage(ENDE, 400), // gültig
          11: 'rot', // fehlt
          // 20 fehlt im Stand: noch nicht angefordert
          30: 'offen', // fehlt
          31: plusTage(ENDE, -1), // läuft vor Ende ab
        },
      },
      { [ALLE]: 'Führungszeugnis' },
    ),
    HEUTE,
  );
  it('jede Person bekommt ihren Wert; wer wartet, ist „nicht nötig“ (E21)', () => {
    expect(wer(lage, ALLE, 10)).toBe('gueltig');
    expect(wer(lage, ALLE, 11)).toBe('fehlt');
    expect(wer(lage, ALLE, 20)).toBe('nochNicht');
    expect(wer(lage, ALLE, 21)).toBe('nichtNoetig');
    expect(wer(lage, ALLE, 30)).toBe('fehlt');
    expect(wer(lage, ALLE, 31)).toBe('laeuftAb');
  });
  it('der Name kommt aus der Ablage (E35); fehlt er dort, ist er `null`', () => {
    expect(lage.arten.get(ALLE)?.name).toBe('Führungszeugnis');
    const ohne = nachweisLageBauen(x, l, ablage({ [ALLE]: {} }), HEUTE);
    expect(ohne.arten.get(ALLE)?.name).toBeNull();
  });
  it('„Wer zählt“ ist dieselbe Regel wie beim Eintragen (`zaehltFuerNachweis`)', () => {
    for (const z of personZeilen(l)) {
      const zaehlt = zaehltFuerNachweis(x, ALLE_B, z);
      expect(wer(lage, ALLE, z.p.personId) !== 'nichtNoetig').toBe(zaehlt);
    }
  });
  it('ohne Termin gilt heute als Stichtag: ein Tag in der Zukunft ist grün, nicht blau', () => {
    const ohneTermin = { ...x, termin: null };
    const r = nachweisLageBauen(
      ohneTermin,
      l,
      ablage({ [ALLE]: { 10: plusTage(HEUTE, 1) } }),
      HEUTE,
    );
    expect(wer(r, ALLE, 10)).toBe('gueltig');
  });
});

describe('nachweisLageBauen – „Nur wenn …“ und kaputte Bedingung', () => {
  it('nur die, auf die die Bedingung zutrifft, haben einen Wert; die übrigen sind „nicht nötig“', () => {
    const x = mitTermin([NUR_B]);
    const lage = nachweisLageBauen(x, liste(x), ablage({ [NUR]: { 10: 'rot' } }), HEUTE);
    expect(wer(lage, NUR, 10)).toBe('fehlt');
    expect(wer(lage, NUR, 20)).toBe('nochNicht');
    for (const id of [11, 21, 30, 31]) expect(wer(lage, NUR, id)).toBe('nichtNoetig');
  });
  it('Frage gelöscht: für alle „Bedingung prüfen“, nicht „nicht nötig“ (E29)', () => {
    const x = mitTermin([{ ...NUR_B, feld: 'frage:gibtesnicht' }]);
    const lage = nachweisLageBauen(x, liste(x), ablage({ [NUR]: {} }), HEUTE);
    for (const id of [10, 11, 20, 21, 30, 31]) expect(wer(lage, NUR, id)).toBe('bedingung');
    expect(lage.arten.get(NUR)?.bedingungKaputt).toBe(true);
  });
  it('eine entfernte Antwort ist keine kaputte Bedingung: sie gilt weiter (E29)', () => {
    const x = mitTermin([{ ...NUR_B, antworten: ['Ja', 'Vielleicht'] }]);
    const lage = nachweisLageBauen(x, liste(x), ablage({ [NUR]: { 10: 'rot' } }), HEUTE);
    expect(lage.arten.get(NUR)?.bedingungKaputt).toBe(false);
    expect(wer(lage, NUR, 10)).toBe('fehlt');
  });
});

describe('nachweisLageBauen – laden, nicht lesbar', () => {
  const x = mitTermin([ALLE_B, NUR_B]);
  const l = liste(x);
  it('„lädt“: keine Werte (die Zelle zeigt „…“), nichts als lesbar oder unlesbar behauptet', () => {
    const lage = nachweisLageBauen(x, l, 'laedt', HEUTE);
    for (const a of lage.arten.values()) {
      expect(a.ampel.size).toBe(0);
      expect(a.nichtLesbar).toBe(false);
    }
  });
  it.each([
    ['als Text (Lesefehler)', 'nichtLesbar' as const],
    ['als Antwort der Ablage (kein Recht)', { art: 'nichtLesbar' as const }],
  ])(
    'nicht lesbar %s: wer den Nachweis braucht, steht auf „Stand nicht lesbar“ – nie „fehlt“',
    (_n, a) => {
      const lage = nachweisLageBauen(x, l, a, HEUTE);
      expect(lage.arten.get(ALLE)?.nichtLesbar).toBe(true);
      for (const id of [10, 11, 20, 30, 31]) expect(wer(lage, ALLE, id)).toBe('nichtLesbar');
      expect(wer(lage, ALLE, 21)).toBe('nichtNoetig'); // wartet: braucht ihn nicht, auch ohne Stand
      expect(wer(lage, NUR, 10)).toBe('nichtLesbar');
      expect(wer(lage, NUR, 11)).toBe('nichtNoetig');
      const werte = [...lage.arten.values()].flatMap((r) =>
        [...r.ampel.values()].map((f) => f.wert),
      );
      expect(werte).not.toContain('fehlt');
      expect(werte).not.toContain('nochNicht');
    },
  );
  it('die Art ohne Wert in der Ablage ist leer, nicht „nicht lesbar“: alle, die ihn brauchen, „noch nicht angefordert“', () => {
    const lage = nachweisLageBauen(x, l, ablage({}), HEUTE);
    expect(lage.arten.get(ALLE)?.nichtLesbar).toBe(false);
    expect(wer(lage, ALLE, 10)).toBe('nochNicht');
  });
});

describe('ohneGueltigenNachweis – verschiedene Personen', () => {
  it('zählt rot, grau und blau, nicht grün und nicht „nicht nötig“', () => {
    const x = mitTermin([ALLE_B]);
    const lage = nachweisLageBauen(
      x,
      liste(x),
      ablage({
        [ALLE]: { 10: plusTage(ENDE, 9), 11: 'rot', 30: 'offen', 31: plusTage(ENDE, -1) },
      }),
      HEUTE,
    );
    // 10 gültig · 11 fehlt · 20 noch nicht · 21 wartet · 30 fehlt · 31 läuft ab
    expect(ohneGueltigenNachweis(lage)).toBe(4);
  });
  it('wem in zwei Arten etwas fehlt, der zählt einmal', () => {
    const x = mitTermin([ALLE_B, NUR_B]);
    const lage = nachweisLageBauen(
      x,
      liste(x),
      ablage({ [ALLE]: { 10: 'rot', 11: plusTage(ENDE, 9) }, [NUR]: { 10: 'rot' } }),
      HEUTE,
    );
    // ALLE: 10 fehlt, 20/30/31 noch nicht (11 gültig, 21 wartet) · NUR: 10 fehlt, 20 noch nicht → 10, 20, 30, 31
    expect(ohneGueltigenNachweis(lage)).toBe(4);
  });
  it('nicht lesbar und kaputte Bedingung zählen nicht – davon weiß niemand etwas', () => {
    const x = mitTermin([ALLE_B]);
    expect(ohneGueltigenNachweis(nachweisLageBauen(x, liste(x), 'nichtLesbar', HEUTE))).toBe(0);
    const k = mitTermin([{ ...NUR_B, feld: 'frage:weg' }]);
    expect(
      ohneGueltigenNachweis(nachweisLageBauen(k, liste(k), ablage({ [NUR]: {} }), HEUTE)),
    ).toBe(0);
  });
});

describe('imHinweisFenster – ab 6 Wochen vor Beginn', () => {
  const beginn = (heuteBis: number) => ({ beginn: `${plusTage(HEUTE, heuteBis)}T10:00` });
  it('42 Tage vorher ja, 43 nein; die Zahl kommt aus der einen Konstante', () => {
    expect(NACHWEIS_HINWEIS_TAGE).toBe(42);
    expect(imHinweisFenster(beginn(NACHWEIS_HINWEIS_TAGE), HEUTE)).toBe(true);
    expect(imHinweisFenster(beginn(NACHWEIS_HINWEIS_TAGE + 1), HEUTE)).toBe(false);
  });
  it('am Beginntag und danach (läuft schon) ja; ohne Termin nie', () => {
    expect(imHinweisFenster(beginn(0), HEUTE)).toBe(true);
    expect(imHinweisFenster(beginn(-3), HEUTE)).toBe(true);
    expect(imHinweisFenster(null, HEUTE)).toBe(false);
  });
});
