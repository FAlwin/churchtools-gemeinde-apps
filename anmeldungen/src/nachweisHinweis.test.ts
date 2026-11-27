import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { FELDER, e as basis, mitglieder } from '@shared/anmeldung/liste.testdaten';
import type { NachweisAblage } from '@shared/anmeldung/nachweisStandAblage';
import type { NachweisBedarf } from '@shared/anmeldung/nachweisBedarf';
import { nachweisHinweiseLesen, type HinweisKandidat } from './nachweisHinweis';
import { gruppenfelderLaden } from './mitglieder';
import { nachweisAblageFuerLeitung } from './nachweisStandAblage';

vi.mock('./nachweisStandAblage', () => ({ nachweisAblageFuerLeitung: vi.fn() }));
vi.mock('./mitglieder', () => ({ gruppenfelderLaden: vi.fn() }));

/**
 * Der Hinweis „n ohne gültigen Nachweis“ (N3d, E25). Gezählt wird aus derselben Lage wie in der Tabelle; die Mitglieder
 * kommen aus `liste.testdaten` (AAAAAA Jonas 10 + Lena 11, BBBBBB Jonas 20 + Lena 21 auf der Warteliste; Foto „Ja“ haben 10
 * und 20), Ablage und Gruppenfelder sind nachgestellt.
 */
const HEUTE = '2026-11-20';
const ENDE = '2026-11-22';
const LEITUNG = new Set([35]);
const ALLE = 61;
const NUR = 62;
const NUR_FOTO: NachweisBedarf = {
  artGruppeId: NUR,
  fuer: 'nurWenn',
  feld: 'frage:foto',
  antworten: ['Ja'],
};

const roh = () => [
  ...mitglieder('AAAAAA', [true, true], 10),
  ...mitglieder('BBBBBB', [true, false], 20),
];
const einst = (nachweise: OeffentlicheEinstellungen['nachweise']): OeffentlicheEinstellungen => ({
  ...basis(),
  termin: { beginn: '2026-11-20T10:00', ende: `${ENDE}T12:00`, ort: '', terminId: null },
  nachweise,
});
const kandidat = (
  id: number,
  nachweise: OeffentlicheEinstellungen['nachweise'],
): HinweisKandidat => ({
  id,
  e: einst(nachweise),
  mitglieder: roh(),
});
const ablage = (staende: Record<number, Record<number, string>>): NachweisAblage => ({
  art: 'gelesen',
  staende: new Map(
    Object.entries(staende).map(([g, p]) => [
      Number(g),
      new Map(Object.entries(p).map(([k, v]) => [Number(k), v])),
    ]),
  ),
  namen: new Map(),
});

const lesen = vi.mocked(nachweisAblageFuerLeitung);
const felder = vi.mocked(gruppenfelderLaden);
let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  lesen.mockReset();
  felder.mockReset();
  felder.mockResolvedValue(FELDER);
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => warn.mockRestore());

describe('nachweisHinweiseLesen', () => {
  it('ohne Kandidaten wird nichts gelesen', async () => {
    expect(await nachweisHinweiseLesen([], LEITUNG, HEUTE)).toEqual(new Map());
    expect(lesen).not.toHaveBeenCalled();
    expect(felder).not.toHaveBeenCalled();
  });

  it('„alle“: wer ohne gültigen Nachweis ist (fehlt, noch nicht angefordert, läuft vor Ende ab), nicht Wartende', async () => {
    lesen.mockResolvedValue(ablage({ [ALLE]: { 10: '2030-01-01', 11: 'rot', 20: '2026-11-21' } }));
    const r = await nachweisHinweiseLesen(
      [kandidat(5, [{ artGruppeId: ALLE, fuer: 'alle' }])],
      LEITUNG,
      HEUTE,
    );
    // 10 gültig · 11 fehlt · 20 läuft vor Ende ab · 21 wartet
    expect(r).toEqual(new Map([[5, 2]]));
    expect(felder).not.toHaveBeenCalled(); // ohne „Nur wenn“ keine Gruppenfelder
  });

  it('„Nur wenn“: die Gruppenfelder werden gelesen, sonst stünde eine Auswahl als Nummer da – gezählt werden nur die Betroffenen', async () => {
    lesen.mockResolvedValue(ablage({ [NUR]: { 10: 'rot' } }));
    const r = await nachweisHinweiseLesen([kandidat(5, [NUR_FOTO])], LEITUNG, HEUTE);
    // Foto „Ja“: 10 (fehlt) und 20 (noch nicht angefordert); 11 und 21 brauchen ihn nicht
    expect(r).toEqual(new Map([[5, 2]]));
    expect(felder).toHaveBeenCalledTimes(1);
    expect(felder).toHaveBeenCalledWith(5);
  });

  it('die Ablage wird einmal für alle Arten aller Veranstaltungen gelesen; wem in zwei Arten etwas fehlt, zählt einmal', async () => {
    lesen.mockResolvedValue(
      ablage({ [ALLE]: { 10: 'rot', 11: '2030-01-01', 20: '2030-01-01' }, [NUR]: { 10: 'rot' } }),
    );
    const r = await nachweisHinweiseLesen(
      [
        kandidat(5, [{ artGruppeId: ALLE, fuer: 'alle' }, NUR_FOTO]),
        kandidat(6, [{ artGruppeId: ALLE, fuer: 'alle' }]),
      ],
      LEITUNG,
      HEUTE,
    );
    expect(lesen).toHaveBeenCalledTimes(1);
    expect([...lesen.mock.calls[0][0]].sort()).toEqual([ALLE, NUR]);
    // 5: ALLE → 10 fehlt; NUR → 10 fehlt (dieselbe Person), 20 noch nicht (NUR) → 10 und 20 = 2 · 6: nur 10
    expect(r).toEqual(
      new Map([
        [5, 2],
        [6, 1],
      ]),
    );
  });

  it('keine Person ohne Nachweis: kein Eintrag (nicht „0“)', async () => {
    lesen.mockResolvedValue(
      ablage({ [ALLE]: { 10: '2030-01-01', 11: '2030-01-01', 20: '2030-01-01' } }),
    );
    const r = await nachweisHinweiseLesen(
      [kandidat(5, [{ artGruppeId: ALLE, fuer: 'alle' }])],
      LEITUNG,
      HEUTE,
    );
    expect(r.size).toBe(0);
  });

  it('Ablage nicht lesbar (kein Recht): kein Hinweis – weder „fehlt“ für alle noch ein Fehler', async () => {
    lesen.mockResolvedValue({ art: 'nichtLesbar' });
    const r = await nachweisHinweiseLesen(
      [kandidat(5, [{ artGruppeId: ALLE, fuer: 'alle' }])],
      LEITUNG,
      HEUTE,
    );
    expect(r.size).toBe(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it('Ablage wirft (vorübergehend): nichts kaputt, Konsole, kein Hinweis', async () => {
    lesen.mockRejectedValue(new ApiError(503, 'weg'));
    const r = await nachweisHinweiseLesen(
      [kandidat(5, [{ artGruppeId: ALLE, fuer: 'alle' }])],
      LEITUNG,
      HEUTE,
    );
    expect(r.size).toBe(0);
    expect(warn).toHaveBeenCalled();
  });

  it('Gruppenfelder ohne Recht (403): diese Veranstaltung ohne Hinweis, still; die anderen zählen weiter', async () => {
    lesen.mockResolvedValue(ablage({ [ALLE]: { 10: 'rot' }, [NUR]: { 10: 'rot' } }));
    felder.mockRejectedValueOnce(new ApiError(403, 'kein Recht'));
    const r = await nachweisHinweiseLesen(
      [kandidat(5, [NUR_FOTO]), kandidat(6, [{ artGruppeId: ALLE, fuer: 'alle' }])],
      LEITUNG,
      HEUTE,
    );
    expect([...r.keys()]).toEqual([6]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('Gruppenfelder scheitern vorübergehend (503): Konsole, diese Veranstaltung ohne Hinweis, die anderen zählen', async () => {
    lesen.mockResolvedValue(ablage({ [ALLE]: { 10: 'rot' }, [NUR]: { 10: 'rot' } }));
    felder.mockRejectedValueOnce(new ApiError(503, 'weg'));
    const r = await nachweisHinweiseLesen(
      [kandidat(5, [NUR_FOTO]), kandidat(6, [{ artGruppeId: ALLE, fuer: 'alle' }])],
      LEITUNG,
      HEUTE,
    );
    expect([...r.keys()]).toEqual([6]);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
