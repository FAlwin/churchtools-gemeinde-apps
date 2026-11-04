/**
 * Der Sollbetrag liest, was die Anmeldung geschrieben hat – Auswahl und Extras kommen hier aus `anmeldungAufbauen`
 * (dem Erzeuger), nicht aus handgeschriebenem Text.
 */
import { describe, expect, it } from 'vitest';
import { CT, antworten, einstellungen } from './senden.testdaten';
import { centAusEuroText } from './preis';
import { anmeldungAufbauen } from './senden';
import { sollBetrag } from './sollbetrag';

const HEUTE = '2026-10-14';

function mitExtras() {
  const e = einstellungen();
  e.preis.extras = [
    { bezeichnung: 'Bettwäsche, Handtuch', preisCent: 500, gilt: 'person' },
    { bezeichnung: 'Bus', preisCent: 300, gilt: 'anmeldung' },
    { bezeichnung: 'Frühstück', preisCent: 200, gilt: 'person' },
  ];
  return e;
}

/** Was die Anmeldung in ChurchTools hinterlässt: Text im Feld „Extras“ und der berechnete Betrag. */
function geschrieben(e: ReturnType<typeof einstellungen>, extras: boolean[]) {
  const [erste] = anmeldungAufbauen(e, antworten(), { option: 0, extras }, HEUTE, CT).forms;
  const wert = (id: number | undefined) => erste.form.find((x) => x.id === String(id))?.value;
  return { extras: wert(e.ctFelder.extras), cent: centAusEuroText(wert(e.ctFelder.betrag)) };
}

const zweiKinder = antworten().personen.map((p) => ({
  geburtstag: (p.birth as string) ?? null,
  mitPlatz: true,
}));

describe('sollBetrag – Extras', () => {
  it('ein Extra mit Komma im Namen zählt – derselbe Betrag wie beim Anmelden', () => {
    const e = mitExtras();
    const a = geschrieben(e, [true, false, true]);
    expect(a.extras).toBe('Bettwäsche, Handtuch, Frühstück');
    const s = sollBetrag(e, {
      personen: zweiKinder,
      auswahl: null,
      extras: a.extras,
      angemeldetAm: HEUTE,
    });
    // 2 Kinder × (6 € + 5 € + 2 €)
    expect(s.cent).toBe(2600);
    expect(s.cent).toBe(a.cent);
  });

  it('jede Wahl ergibt beim Nachrechnen den Betrag der Anmeldung', () => {
    const e = mitExtras();
    for (const wahl of [
      [false, false, false],
      [true, false, false],
      [false, true, false],
      [true, true, true],
    ]) {
      const a = geschrieben(e, wahl);
      const s = sollBetrag(e, {
        personen: zweiKinder,
        auswahl: null,
        extras: a.extras,
        angemeldetAm: HEUTE,
      });
      expect(s.cent, wahl.join()).toBe(a.cent);
    }
  });
});
