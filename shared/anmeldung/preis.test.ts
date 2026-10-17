import { describe, expect, it } from 'vitest';
import {
  berechnePreis,
  euroText,
  kannEtwasKosten,
  preisKurz,
  pruefeRegeln,
  wozuGeburtsdatum,
  type Buchung,
  type PreisRegeln,
} from './preis';

/**
 * Preis-Baukasten (#474). Die erwarteten Beträge sind **von Hand nachgerechnet** (siehe Kommentar an
 * jedem Fall) und stammen aus dem klickbaren Entwurf vom 09.10.2026 – nicht aus der Funktion selbst.
 * Sonst bliebe ein Test bei genau dem Fehler grün, für den er geschrieben wurde.
 */

/** Silvesterfreizeit wie im Entwurf: Zimmertyp, unter 3 frei, 3–11 die Hälfte, Frühbucher, Bettwäsche. */
function silvester(): PreisRegeln {
  return {
    grundpreis: {
      art: 'auswahl',
      betragCent: 0,
      gilt: 'person',
      auswahlName: 'Zimmertyp',
      optionen: [
        { name: '2-Bett-Zimmer', preisCent: 8352, kontingent: 6, belegt: 6, personenJe: 0 },
        { name: '3-Bett-Zimmer', preisCent: 8152, kontingent: 4, belegt: 3, personenJe: 0 },
        { name: '4-Bett-Zimmer', preisCent: 6552, kontingent: 5, belegt: 3, personenJe: 0 },
        { name: '5-Bett-Zimmer', preisCent: 7086, kontingent: 3, belegt: 1, personenJe: 0 },
      ],
    },
    alter: [
      { von: 0, bis: 2, art: 'frei', wert: 0 },
      { von: 3, bis: 11, art: 'prozent', wert: 50 },
    ],
    anpassungen: [
      {
        art: 'rabatt',
        bezeichnung: 'Frühbucher',
        bedingung: 'fruehbucher',
        bis: '2026-10-31',
        abKind: 3,
        einheit: 'euro',
        wert: 500,
        gilt: 'person',
      },
    ],
    extras: [{ bezeichnung: 'Bettwäsche leihen', preisCent: 800, gilt: 'person' }],
  };
}

const familie: Buchung = {
  alter: [41, 38, 7, 2],
  option: 2,
  angemeldetAm: '2026-10-15',
  extras: [true],
};

describe('berechnePreis – Silvesterfreizeit', () => {
  it('rechnet Zimmer, Alter, Frühbucher und Extras zusammen', () => {
    // 2 × 65,52 + 32,76 (7 J., 50 %) + 0 (2 J.) − 3 × 5,00 (Frühbucher, nur wer zahlt) + 4 × 8,00 = 180,80
    const r = berechnePreis(silvester(), familie);
    expect(r.gesamtCent).toBe(18080);
    expect(r.ausgebucht).toBe(false);
    expect(r.posten.map((p) => p.betragCent)).toEqual([6552, 6552, 3276, 0, -1500, 3200]);
  });

  it('die Summe der Zeilen ist immer der Gesamtbetrag', () => {
    const r = berechnePreis(silvester(), familie);
    expect(r.posten.reduce((s, p) => s + (p.betragCent ?? 0), 0)).toBe(r.gesamtCent);
  });

  it('nach der Frühbucher-Frist entfällt der Rabatt und steht als „gilt hier nicht“ da', () => {
    // 180,80 + 15,00 = 195,80
    const r = berechnePreis(silvester(), { ...familie, angemeldetAm: '2026-11-05' });
    expect(r.gesamtCent).toBe(19580);
    const frueh = r.posten.find((p) => p.text === 'Frühbucher');
    expect(frueh?.betragCent).toBeNull();
    expect(frueh?.hinweis).toContain('31.10.2026');
  });

  it('der letzte Frühbucher-Tag zählt noch', () => {
    expect(berechnePreis(silvester(), { ...familie, angemeldetAm: '2026-10-31' }).gesamtCent).toBe(
      18080,
    );
  });

  it('ein ausgebuchtes Zimmer wird gemeldet', () => {
    // 2-Bett: 2 × 83,52 + 41,76 + 0 + 4 × 8,00 = 240,80 (nach der Frist)
    const r = berechnePreis(silvester(), { ...familie, option: 0, angemeldetAm: '2026-11-05' });
    expect(r.gesamtCent).toBe(24080);
    expect(r.ausgebucht).toBe(true);
  });

  it('nicht angekreuzte Extras zählen nicht', () => {
    // 240,80 − 32,00 = 208,80
    const r = berechnePreis(silvester(), {
      ...familie,
      option: 0,
      angemeldetAm: '2026-11-05',
      extras: [false],
    });
    expect(r.gesamtCent).toBe(20880);
  });

  it('Geschwisterrabatt zählt die Kinder vom ältesten an', () => {
    // Personen 41, 38, 7, 2, 5 im 2-Bett, nach der Frist, ohne Extras:
    // 83,52 + 83,52 + 41,76 (7) + 0 (2) + 41,76 (5) = 250,56
    // Kinder nach Alter: 7 = 1., 5 = 2., 2 = 3. → 50 % ab dem 2. Kind: 5 J. −20,88, 2 J. −0 → 229,68
    const r = silvester();
    r.anpassungen.push({
      art: 'rabatt',
      bezeichnung: 'Geschwister',
      bedingung: 'abKind',
      bis: '',
      abKind: 2,
      einheit: 'prozent',
      wert: 50,
      gilt: 'person',
    });
    const e = berechnePreis(r, {
      alter: [41, 38, 7, 2, 5],
      option: 0,
      angemeldetAm: '2026-11-05',
      extras: [false],
    });
    expect(e.gesamtCent).toBe(22968);
  });

  it('fester Grundpreis je Person mit Altersregeln', () => {
    // 50 € je Person, Personen 41, 38, 7, 2, 10: 50 + 50 + 25 + 0 + 25 = 150
    // Frühbucher 4 × −5 (wer zahlt) = −20, Bettwäsche 5 × 8 = 40 → 170,00
    const r = silvester();
    r.grundpreis = { ...r.grundpreis, art: 'fest', betragCent: 5000 };
    expect(
      berechnePreis(r, {
        alter: [41, 38, 7, 2, 10],
        option: 0,
        angemeldetAm: '2026-10-15',
        extras: [true],
      }).gesamtCent,
    ).toBe(17000);
  });
});

describe('berechnePreis – weitere Fälle', () => {
  const kinderfreizeit: PreisRegeln = {
    grundpreis: { art: 'fest', betragCent: 4500, gilt: 'person', auswahlName: '', optionen: [] },
    alter: [],
    anpassungen: [
      {
        art: 'rabatt',
        bezeichnung: 'Geschwisterrabatt',
        bedingung: 'abKind',
        bis: '',
        abKind: 2,
        einheit: 'euro',
        wert: 1000,
        gilt: 'person',
      },
    ],
    extras: [],
  };

  it('Kinderfreizeit: 45 € je Kind, ab dem 2. Kind 10 € weniger', () => {
    // 45 + 45 − 10 = 80
    expect(
      berechnePreis(kinderfreizeit, {
        alter: [9, 6],
        option: 0,
        angemeldetAm: '2026-10-15',
        extras: [],
      }).gesamtCent,
    ).toBe(8000);
  });

  it('ein einzelnes Kind bekommt keinen Geschwisterrabatt', () => {
    const r = berechnePreis(kinderfreizeit, {
      alter: [9],
      option: 0,
      angemeldetAm: '2026-10-15',
      extras: [],
    });
    expect(r.gesamtCent).toBe(4500);
    expect(r.posten.find((p) => p.text === 'Geschwisterrabatt')?.betragCent).toBeNull();
  });

  it('eine Person ohne Geburtsdatum zählt nicht als Kind', () => {
    // 1 Kind (9 J.) + 1 Person ohne Alter: 45 + 45 = 90, kein Geschwisterrabatt
    // (zählte die Person ohne Alter als Kind, käme fälschlich −10 dazu)
    expect(
      berechnePreis(kinderfreizeit, {
        alter: [null, 9],
        option: 0,
        angemeldetAm: '2026-10-15',
        extras: [],
      }).gesamtCent,
    ).toBe(9000);
  });

  it('Grundpreis je Anmeldung zählt einmal, egal wie viele kommen', () => {
    // 20 € pauschal, −10 % je Anmeldung = 18,00
    const r = berechnePreis(
      {
        grundpreis: {
          art: 'fest',
          betragCent: 2000,
          gilt: 'anmeldung',
          auswahlName: '',
          optionen: [],
        },
        alter: [],
        anpassungen: [
          {
            art: 'rabatt',
            bezeichnung: 'Mitglieder',
            bedingung: 'immer',
            bis: '',
            abKind: 2,
            einheit: 'prozent',
            wert: 10,
            gilt: 'anmeldung',
          },
        ],
        extras: [],
      },
      { alter: [40, 38, 5], option: 0, angemeldetAm: '2026-10-15', extras: [] },
    );
    expect(r.gesamtCent).toBe(1800);
  });

  it('ein Rabatt macht den Betrag nie negativ', () => {
    const r = berechnePreis(
      {
        grundpreis: { art: 'fest', betragCent: 500, gilt: 'person', auswahlName: '', optionen: [] },
        alter: [],
        anpassungen: [
          {
            art: 'rabatt',
            bezeichnung: 'Gutschein',
            bedingung: 'immer',
            bis: '',
            abKind: 2,
            einheit: 'euro',
            wert: 2000,
            gilt: 'anmeldung',
          },
        ],
        extras: [],
      },
      { alter: [30], option: 0, angemeldetAm: '2026-10-15', extras: [] },
    );
    expect(r.gesamtCent).toBe(0);
    expect(r.posten.reduce((s, p) => s + (p.betragCent ?? 0), 0)).toBe(0);
  });

  it('unbekanntes Alter zahlt den Grundpreis und zählt nicht als Kind', () => {
    // Geburtsdatum nicht abgefragt: 2 × 65,52, kein Altersrabatt, Frühbucher 2 × −5, Bettwäsche 2 × 8 = 137,04
    expect(
      berechnePreis(silvester(), {
        alter: [null, null],
        option: 2,
        angemeldetAm: '2026-10-15',
        extras: [true],
      }).gesamtCent,
    ).toBe(13704);
  });

  it('Zuschlag in Prozent je Person', () => {
    // 40 € + 10 % Einzelzimmer-Zuschlag = 44,00
    const r = berechnePreis(
      {
        grundpreis: {
          art: 'fest',
          betragCent: 4000,
          gilt: 'person',
          auswahlName: '',
          optionen: [],
        },
        alter: [],
        anpassungen: [
          {
            art: 'zuschlag',
            bezeichnung: 'Einzelzimmer',
            bedingung: 'immer',
            bis: '',
            abKind: 2,
            einheit: 'prozent',
            wert: 10,
            gilt: 'person',
          },
        ],
        extras: [],
      },
      { alter: [50], option: 0, angemeldetAm: '2026-10-15', extras: [] },
    );
    expect(r.gesamtCent).toBe(4400);
  });

  it('kostenlos bleibt 0 €', () => {
    const r = berechnePreis(
      {
        grundpreis: { art: 'fest', betragCent: 0, gilt: 'person', auswahlName: '', optionen: [] },
        alter: [],
        anpassungen: [],
        extras: [],
      },
      { alter: [40, 8], option: 0, angemeldetAm: '2026-10-15', extras: [] },
    );
    expect(r.gesamtCent).toBe(0);
  });
});

describe('euroText', () => {
  it('schreibt Beträge so, wie sie in ChurchTools und in der Mail stehen', () => {
    expect(euroText(18080)).toBe('180,80 €');
    expect(euroText(170962)).toBe('1.709,62 €');
    expect(euroText(0)).toBe('0,00 €');
  });
});

describe('pruefeRegeln', () => {
  it('die Silvester-Regeln sind in Ordnung', () => {
    expect(pruefeRegeln(silvester())).toEqual([]);
  });

  it('ein Rabatt in Prozent ist höchstens 100 % (A4), ein Zuschlag darf mehr', () => {
    const r = silvester();
    const basis = r.anpassungen[0];
    r.anpassungen = [{ ...basis, bezeichnung: 'Zu viel', einheit: 'prozent', wert: 101 }];
    expect(pruefeRegeln(r)).toEqual(['„Zu viel“: Ein Rabatt kann höchstens 100 % sein.']);
    r.anpassungen = [{ ...basis, bezeichnung: 'Zu viel', einheit: 'prozent', wert: 100 }];
    expect(pruefeRegeln(r)).toEqual([]);
    r.anpassungen = [
      { ...basis, art: 'zuschlag', bezeichnung: 'Doppelt', einheit: 'prozent', wert: 150 },
    ];
    expect(pruefeRegeln(r)).toEqual([]);
  });

  it('überschneidende Altersgruppen werden gemeldet', () => {
    const r = silvester();
    r.alter = [
      { von: 0, bis: 5, art: 'frei', wert: 0 },
      { von: 3, bis: 11, art: 'prozent', wert: 50 },
    ];
    expect(pruefeRegeln(r)).toContain(
      'Die Altersgruppen überschneiden sich. Bitte Grenzen prüfen.',
    );
  });

  it('eine offene Altersgruppe („und älter“) vor einer weiteren überschneidet sich', () => {
    const r = silvester();
    r.alter = [
      { von: 0, bis: null, art: 'frei', wert: 0 },
      { von: 12, bis: 17, art: 'prozent', wert: 50 },
    ];
    expect(pruefeRegeln(r)).toContain(
      'Die Altersgruppen überschneiden sich. Bitte Grenzen prüfen.',
    );
  });

  it('fehlende Namen und Bezeichnungen werden gemeldet', () => {
    const r = silvester();
    r.grundpreis.auswahlName = ' ';
    r.grundpreis.optionen[0].name = '';
    r.anpassungen[0].bezeichnung = '';
    r.extras[0].bezeichnung = '';
    const f = pruefeRegeln(r);
    expect(f).toHaveLength(4);
  });
});

describe('preisKurz (Listen-Zeile, A2)', () => {
  const regeln = (g: Partial<PreisRegeln['grundpreis']>): PreisRegeln => ({
    grundpreis: { art: 'fest', betragCent: 0, gilt: 'person', auswahlName: '', optionen: [], ...g },
    alter: [],
    anpassungen: [],
    extras: [],
  });
  const opt = (preisCent: number) => ({
    name: 'x',
    preisCent,
    kontingent: 0,
    belegt: 0,
    personenJe: 0,
  });

  it('fest: kostenlos, je Person, je Anmeldung', () => {
    expect(preisKurz(regeln({}))).toBe('kostenlos');
    expect(preisKurz(regeln({ betragCent: 1200 }))).toBe('12,00 € p. P.');
    expect(preisKurz(regeln({ betragCent: 3000, gilt: 'anmeldung' }))).toBe(
      '30,00 € pro Anmeldung',
    );
  });

  it('Auswahl: der günstigste Eintrag mit „ab“, gleiche Preise ohne', () => {
    expect(preisKurz(regeln({ art: 'auswahl', optionen: [opt(9000), opt(6552)] }))).toBe(
      'ab 65,52 € p. P.',
    );
    expect(preisKurz(regeln({ art: 'auswahl', optionen: [opt(500), opt(500)] }))).toBe(
      '5,00 € p. P.',
    );
    expect(preisKurz(regeln({ art: 'auswahl', optionen: [opt(0), opt(0)] }))).toBe('kostenlos');
    expect(preisKurz(regeln({ art: 'auswahl', optionen: [] }))).toBe('Preis folgt');
  });
  it('„kostenlos“ nur, wenn wirklich nichts kostet (A4)', () => {
    const mitExtra: PreisRegeln = {
      ...regeln({}),
      extras: [{ bezeichnung: 'T-Shirt', preisCent: 1200, gilt: 'person' }],
    };
    expect(preisKurz(mitExtra)).toBe('Preis je nach Angaben');
    const auswahlNullMitExtra: PreisRegeln = {
      ...regeln({ art: 'auswahl', auswahlName: 'Zimmer', optionen: [opt(0)] }),
      extras: mitExtra.extras,
    };
    expect(preisKurz(auswahlNullMitExtra)).toBe('Preis je nach Angaben');
    // Eine Auswahl gilt immer pro Person – auch wenn `gilt` aus einem früheren festen Preis noch „anmeldung“ sagt.
    expect(
      preisKurz(regeln({ art: 'auswahl', gilt: 'anmeldung', optionen: [opt(500), opt(900)] })),
    ).toBe('ab 5,00 € p. P.');
  });
});

describe('kannEtwasKosten (A4: braucht es eine Bankverbindung?)', () => {
  const leer: PreisRegeln = {
    grundpreis: { art: 'fest', betragCent: 0, gilt: 'person', auswahlName: '', optionen: [] },
    alter: [],
    anpassungen: [],
    extras: [],
  };
  const rabatt = {
    bezeichnung: 'X',
    bedingung: 'immer' as const,
    bis: '',
    abKind: 2,
    einheit: 'euro' as const,
    wert: 500,
    gilt: 'person' as const,
  };
  it('wozuGeburtsdatum: Preise nach Alter, Geschwister-Rabatt (ab dem x-ten Kind) oder gar nicht', () => {
    expect(wozuGeburtsdatum(leer)).toBeNull();
    expect(wozuGeburtsdatum({ ...leer, anpassungen: [{ ...rabatt, art: 'rabatt' }] })).toBeNull();
    expect(
      wozuGeburtsdatum({
        ...leer,
        anpassungen: [{ ...rabatt, art: 'rabatt', bedingung: 'abKind' }],
      }),
    ).toBe('geschwister');
    expect(
      wozuGeburtsdatum({
        ...leer,
        alter: [{ von: 0, bis: 2, art: 'frei', wert: 0 }],
        anpassungen: [{ ...rabatt, art: 'rabatt', bedingung: 'abKind' }],
      }),
    ).toBe('alter');
  });
  it('kostenlos und nur Rabatte → nein', () => {
    expect(kannEtwasKosten(leer)).toBe(false);
    expect(kannEtwasKosten({ ...leer, anpassungen: [{ ...rabatt, art: 'rabatt' }] })).toBe(false);
    expect(
      kannEtwasKosten({ ...leer, alter: [{ von: 0, bis: 2, art: 'prozent', wert: 50 }] }),
    ).toBe(false);
  });
  it('jeder Baustein mit Betrag einzeln → ja', () => {
    expect(kannEtwasKosten({ ...leer, grundpreis: { ...leer.grundpreis, betragCent: 1 } })).toBe(
      true,
    );
    expect(
      kannEtwasKosten({
        ...leer,
        grundpreis: {
          ...leer.grundpreis,
          art: 'auswahl',
          auswahlName: 'Zimmer',
          optionen: [
            { name: 'A', preisCent: 0, kontingent: 0, belegt: 0, personenJe: 0 },
            { name: 'B', preisCent: 100, kontingent: 0, belegt: 0, personenJe: 0 },
          ],
        },
      }),
    ).toBe(true);
    expect(
      kannEtwasKosten({ ...leer, alter: [{ von: 18, bis: null, art: 'fest', wert: 1000 }] }),
    ).toBe(true);
    expect(kannEtwasKosten({ ...leer, anpassungen: [{ ...rabatt, art: 'zuschlag' }] })).toBe(true);
    expect(
      kannEtwasKosten({
        ...leer,
        extras: [{ bezeichnung: 'Kanu', preisCent: 500, gilt: 'anmeldung' }],
      }),
    ).toBe(true);
  });
});
