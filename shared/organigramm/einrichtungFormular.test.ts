import { describe, expect, it } from 'vitest';
import { GRUNDWERTE, einstellungFehler } from './gruppenwechsel';
import { einrichtungAus, einrichtungFehler, type Einrichtung } from './gruppenwechselEinrichtung';
import {
  einrichtungAusFormular,
  formularAus,
  stichtagAus,
  stichtagText,
  wochenText,
  wochenZuTage,
  type Formular,
} from './einrichtungFormular';

const E: Einrichtung = einrichtungAus({
  einstellung: {
    ...GRUNDWERTE,
    stufen: [
      { gruppeId: 1, name: 'Schäfchen', abAlter: 4 },
      { gruppeId: 2, name: 'Fische', abAlter: 7 },
    ],
  },
  bereichGruppeId: 9,
  wechselGruppen: [{ vonGruppeId: 1, nachGruppeId: 2, gruppeId: 11 }],
})!;

describe('Wochen ↔ Tage', () => {
  it('GRUNDWERTE: 56 Tage sind 8 Wochen, und zurück', () => {
    expect(wochenText(GRUNDWERTE.ankuendigungTage)).toBe('8');
    expect(wochenZuTage('8', null)).toBe(GRUNDWERTE.ankuendigungTage);
  });

  it('nur ganze Wochen ab 1; alles andere ist NaN (dann meldet es einstellungFehler)', () => {
    expect(wochenZuTage('1', null)).toBe(7);
    for (const t of ['0', '-2', '1.5', '', 'acht', ' ']) expect(wochenZuTage(t, null)).toBeNaN();
  });

  it('eine gespeicherte Zahl, die keine ganze Woche ist, bleibt, solange das Feld unberührt ist', () => {
    expect(wochenText(60)).toBe('8.6');
    expect(wochenZuTage('8.6', 60)).toBe(60);
    expect(wochenZuTage('9', 60)).toBe(63);
  });
});

describe('Stichtag', () => {
  it('„30.09.“ ↔ `09-30`, mit und ohne Punkt am Ende und ohne führende Null', () => {
    expect(stichtagAus('30.09.')).toBe('09-30');
    expect(stichtagAus(' 30.9 ')).toBe('09-30');
    expect(stichtagAus('1.10.')).toBe('10-01');
    expect(stichtagText('09-30')).toBe('30.09.');
  });

  it('was kein Tag ist, bleibt – und wird als Fehler gemeldet', () => {
    expect(stichtagAus('Herbst')).toBe('Herbst');
    const f = formularAus(E);
    expect(einrichtungAusFormular({ ...f, stichtag: 'Herbst' }).fehler.map((x) => x.feld)).toEqual([
      'stichtag',
    ]);
    expect(einrichtungAusFormular({ ...f, stichtag: '29.02.' }).fehler.map((x) => x.feld)).toEqual([
      'stichtag',
    ]);
  });
});

describe('formularAus', () => {
  it('Ändern: die gespeicherte Einrichtung, unverändert zurückgerechnet', () => {
    const f = formularAus(E);
    expect(f.bereichGruppeId).toBe(9);
    expect(f.ankuendigungWochen).toBe('8');
    const { einrichtung, fehler } = einrichtungAusFormular(f);
    expect(fehler).toEqual([]);
    expect(einrichtung).toEqual({ einstellung: E.einstellung, bereichGruppeId: E.bereichGruppeId });
  });

  it('Einrichten: GRUNDWERTE und zwei leere Zeilen – noch nicht gültig', () => {
    const f = formularAus(null);
    expect(f.stufen).toHaveLength(2);
    expect(f.bereichGruppeId).toBeNull();
    expect(f.ferienkalender).toBe(GRUNDWERTE.ferienkalender);
    const { fehler } = einrichtungAusFormular(f);
    expect(fehler.map((x) => x.feld)).toContain('bereich');
    expect(fehler.filter((x) => x.feld === 'stufen').length).toBeGreaterThanOrEqual(2);
    // nur die Gruppen und das Alter fehlen – die Grundwerte selbst taugen
    expect(fehler.map((x) => x.feld).filter((x) => x !== 'stufen' && x !== 'bereich')).toEqual([]);
  });

  it('dieselbe Prüfung wie beim Lesen: Ergebnis = einrichtungFehler / einstellungFehler der gebauten Einrichtung', () => {
    const f: Formular = {
      ...formularAus(E),
      bereichGruppeId: 2, // eine Stufe
      aufraeumenTage: '60',
    };
    const { einrichtung, fehler } = einrichtungAusFormular(f);
    expect(fehler.map((x) => x.text)).toEqual(einrichtungFehler(einrichtung));
    expect(fehler.map((x) => x.text)).toEqual(
      expect.arrayContaining(einstellungFehler(einrichtung.einstellung)),
    );
    expect(fehler.map((x) => x.feld).sort()).toEqual(['aufraeumen', 'bereich']);
  });

  it('Stufen, die nicht steigen, und doppelte Gruppen stehen bei „stufen“', () => {
    const f = formularAus(E);
    const doppelt: Formular = {
      ...f,
      stufen: [f.stufen[0], { ...f.stufen[1], gruppeId: 1, abAlter: '4' }],
    };
    expect(einrichtungAusFormular(doppelt).fehler.every((x) => x.feld === 'stufen')).toBe(true);
    expect(einrichtungAusFormular(doppelt).fehler.length).toBeGreaterThanOrEqual(2);
  });
});
