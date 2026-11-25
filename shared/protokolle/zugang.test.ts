import { describe, expect, it } from 'vitest';
import type { RollenStufe } from './einrichten';
import { darfSchreibenIn, istLeitungIn } from './zugang';

/** Schreiben und Leitung sind seit W16 zwei Fragen (Stufe „Schreibt mit“). */
const SCHREIBBAR = [60];
const STUFEN: RollenStufe[] = [
  { rolle: 1101, stufe: 'leitung', typ: 9 },
  { rolle: 1102, stufe: 'schreibtMit', typ: 8 },
  { rolle: 1103, stufe: 'mitglied', typ: 7 },
];

describe('darfSchreibenIn', () => {
  it('wer in „Protokolle“ schreiben darf (anlegen, ändern, löschen) – sonst nicht', () => {
    expect(darfSchreibenIn({ protokolle: 60 }, SCHREIBBAR)).toBe(true);
    expect(darfSchreibenIn({ protokolle: 61 }, SCHREIBBAR)).toBe(false);
    expect(darfSchreibenIn({ protokolle: null }, SCHREIBBAR)).toBe(false);
  });
});

describe('istLeitungIn', () => {
  it('Rolle auf „Schreibt mit“: schreibt, ist aber nicht Leitung', () => {
    expect(istLeitungIn({ protokolle: 60, rolle: 8 }, SCHREIBBAR, STUFEN)).toBe(false);
  });
  it('Rolle auf „Leitung“: Leitung', () => {
    expect(istLeitungIn({ protokolle: 60, rolle: 9 }, SCHREIBBAR, STUFEN)).toBe(true);
  });
  it('wer nicht schreiben darf, ist nie Leitung – auch nicht mit Leitungsrolle', () => {
    expect(istLeitungIn({ protokolle: 61, rolle: 9 }, SCHREIBBAR, STUFEN)).toBe(false);
  });
  it('keine Stufen (keine Einstellung, von vor W16) oder keine Rolle auf „Schreibt mit“: wie vorher – wer schreibt, ist Leitung', () => {
    expect(istLeitungIn({ protokolle: 60, rolle: 8 }, SCHREIBBAR, null)).toBe(true);
    expect(istLeitungIn({ protokolle: 60, rolle: 8 }, SCHREIBBAR, undefined)).toBe(true);
    // Einstellung von vor W16: Stufen ohne `typ` – es gab noch kein „Schreibt mit“.
    expect(
      istLeitungIn({ protokolle: 60, rolle: 9 }, SCHREIBBAR, [{ rolle: 1101, stufe: 'leitung' }]),
    ).toBe(true);
    // Rolle unbekannt, aber niemand „schreibt mit“: auch ohne Signal aus ChurchTools Leitung.
    const ohneMitschreiben = STUFEN.filter((s) => s.stufe !== 'schreibtMit');
    expect(istLeitungIn({ protokolle: 60 }, SCHREIBBAR, ohneMitschreiben)).toBe(true);
    expect(
      istLeitungIn(
        { protokolle: 60, rolle: null, treffenPflegen: null },
        SCHREIBBAR,
        ohneMitschreiben,
      ),
    ).toBe(true);
  });

  /**
   * **Handtest TF-PROT-33, 25.11.2026:** Der Gruppentyp verbarg die Gruppe vor ihren Teilnehmern – die Rolle war unbekannt
   * und v1.6.0 machte „Schreibt mit“ zur Leitung. Jetzt entscheidet „Gruppentreffen pflegen“ (oder Admin).
   */
  it('Rolle unbekannt + „Schreibt mit“ eingestellt: Leitung nur, wenn ChurchTools „Gruppentreffen pflegen“ meldet', () => {
    expect(istLeitungIn({ protokolle: 60 }, SCHREIBBAR, STUFEN)).toBe(false);
    expect(istLeitungIn({ protokolle: 60, rolle: null }, SCHREIBBAR, STUFEN)).toBe(false);
    expect(istLeitungIn({ protokolle: 60, treffenPflegen: false }, SCHREIBBAR, STUFEN)).toBe(false);
    // nicht lesbar: keine Leitungsknöpfe (Freigeben/Löschen schützt nur die Oberfläche)
    expect(istLeitungIn({ protokolle: 60, treffenPflegen: null }, SCHREIBBAR, STUFEN)).toBe(false);
    expect(istLeitungIn({ protokolle: 60, treffenPflegen: true }, SCHREIBBAR, STUFEN)).toBe(true);
    // ohne Schreibrecht nie – auch mit dem Signal
    expect(istLeitungIn({ protokolle: 61, treffenPflegen: true }, SCHREIBBAR, STUFEN)).toBe(false);
  });

  it('Rolle bekannt: das Signal ändert nichts – die Stufe der Rolle entscheidet', () => {
    expect(
      istLeitungIn({ protokolle: 60, rolle: 8, treffenPflegen: true }, SCHREIBBAR, STUFEN),
    ).toBe(false);
    expect(
      istLeitungIn({ protokolle: 60, rolle: 9, treffenPflegen: false }, SCHREIBBAR, STUFEN),
    ).toBe(true);
  });
});
