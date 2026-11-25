import { describe, expect, it } from 'vitest';
import {
  abfragenAus,
  erinnerungsTage,
  GRENZEN,
  STANDARD_PLAN,
  geltenderPlan,
  type Abfrage,
  type Erinnerungspunkt,
  type Erinnerungsplan,
} from './abfragen';
import { STANDARD_BETREFF, STANDARD_TEXT } from './abfrageMail';
import {
  artenZumHinzufuegen,
  belegteVorFristTage,
  entwurfAus,
  entwurfGeaendert,
  entwurfVon,
  mitGeaendertemPunkt,
  mitNeuemPunkt,
  ohnePunkt,
  ordne,
  planFuerSpeicher,
  vorschau,
  wirksamerPlan,
} from './abfragePlan';

const HEUTE = '2026-12-01';
const ABFRAGE: Abfrage = {
  id: 'x',
  von: '2027-02-01',
  bis: '2027-03-31',
  frist: '2027-01-05',
  oeffnen: '2026-12-01',
  termine: [1],
  gestartet: { personId: 1, name: 'A', zeit: 'z' },
  beendet: null,
};

describe('Liste aus dem geltenden Plan', () => {
  it('ohne eigenen Plan der Standard in fester Reihenfolge, Mail mit den Standardtexten', () => {
    const e = entwurfVon({ plan: null });
    expect(e.punkte).toEqual(STANDARD_PLAN.punkte);
    expect(e.betreff).toBe(STANDARD_BETREFF);
    expect(e.text).toBe(STANDARD_TEXT);
  });

  it('ein eigener Plan wird übernommen', () => {
    const plan: Erinnerungsplan = {
      punkte: [{ art: 'frist' }, { art: 'oeffnen' }],
      mail: { betreff: 'B', text: 'T' },
    };
    const e = entwurfVon({ plan });
    expect(e.punkte).toEqual([{ art: 'oeffnen' }, { art: 'frist' }]);
    expect(e.betreff).toBe('B');
  });

  it('ordne: öffnen, vor der Frist (größtes n zuerst), Frist, nach der Frist', () => {
    const punkte: Erinnerungspunkt[] = [
      { art: 'nachFrist', alleTage: 1, hoechstens: 3 },
      { art: 'vorFrist', tage: 2 },
      { art: 'frist' },
      { art: 'vorFrist', tage: 7 },
      { art: 'oeffnen' },
    ];
    expect(ordne(punkte).map((p) => (p.art === 'vorFrist' ? `v${p.tage}` : p.art))).toEqual([
      'oeffnen',
      'v7',
      'v2',
      'frist',
      'nachFrist',
    ]);
  });
});

describe('hinzufügen, entfernen, ändern', () => {
  it('Arten zum Hinzufügen: öffnen, Frist und nach der Frist je höchstens einmal, vor der Frist mehrfach', () => {
    expect(artenZumHinzufuegen(STANDARD_PLAN.punkte)).toEqual(['vorFrist']);
    expect(artenZumHinzufuegen([])).toEqual(['oeffnen', 'vorFrist', 'frist', 'nachFrist']);
    expect(artenZumHinzufuegen([{ art: 'vorFrist', tage: 2 }])).toEqual([
      'oeffnen',
      'vorFrist',
      'frist',
      'nachFrist',
    ]);
  });

  it('hinzufügen ergibt den erwarteten, geordneten Plan; „vor der Frist“ nimmt einen freien Wert', () => {
    const ohneFrist = ohnePunkt(STANDARD_PLAN.punkte, 2);
    expect(mitNeuemPunkt(ohneFrist, 'frist')).toEqual(ordne(STANDARD_PLAN.punkte));
    const mit = mitNeuemPunkt(STANDARD_PLAN.punkte, 'vorFrist');
    expect(mit.filter((p) => p.art === 'vorFrist')).toEqual([
      { art: 'vorFrist', tage: 3 },
      { art: 'vorFrist', tage: 2 },
    ]);
  });

  it('eine Art, die schon da ist, wird nicht ein zweites Mal hinzugefügt', () => {
    expect(mitNeuemPunkt(STANDARD_PLAN.punkte, 'frist')).toEqual(STANDARD_PLAN.punkte);
    expect(mitNeuemPunkt(STANDARD_PLAN.punkte, 'oeffnen')).toEqual(STANDARD_PLAN.punkte);
  });

  it('Grenze: bei GRENZEN.punkte Punkten geht nichts mehr dazu', () => {
    const voll: Erinnerungspunkt[] = Array.from({ length: GRENZEN.punkte }, (_, i) => ({
      art: 'vorFrist' as const,
      tage: i + 1,
    }));
    expect(artenZumHinzufuegen(voll)).toEqual([]);
    expect(mitNeuemPunkt(voll, 'vorFrist')).toEqual(voll);
  });

  it('entfernen nimmt genau den Punkt weg', () => {
    expect(ohnePunkt(STANDARD_PLAN.punkte, 1)).toEqual([
      { art: 'oeffnen' },
      { art: 'frist' },
      { art: 'nachFrist', alleTage: 1, hoechstens: 3 },
    ]);
  });

  it('ändern: neuer Wert, geordnet; doppeltes „n Tage vor der Frist“ und Werte außerhalb der Grenzen werden abgelehnt', () => {
    const p: Erinnerungspunkt[] = [
      { art: 'vorFrist', tage: 2 },
      { art: 'vorFrist', tage: 5 },
    ];
    expect(belegteVorFristTage(p, 0)).toEqual([5]);
    expect(mitGeaendertemPunkt(p, 0, { art: 'vorFrist', tage: 9 })).toEqual([
      { art: 'vorFrist', tage: 9 },
      { art: 'vorFrist', tage: 5 },
    ]);
    expect(mitGeaendertemPunkt(p, 0, { art: 'vorFrist', tage: 5 })).toEqual(p);
    expect(mitGeaendertemPunkt(p, 0, { art: 'vorFrist', tage: GRENZEN.tage.max + 1 })).toEqual(p);
    expect(mitGeaendertemPunkt(p, 0, { art: 'vorFrist', tage: 0 })).toEqual(p);
    const n: Erinnerungspunkt[] = [{ art: 'nachFrist', alleTage: 1, hoechstens: 3 }];
    expect(
      mitGeaendertemPunkt(n, 0, {
        art: 'nachFrist',
        alleTage: 2,
        hoechstens: GRENZEN.hoechstens.max,
      }),
    ).toEqual([{ art: 'nachFrist', alleTage: 2, hoechstens: GRENZEN.hoechstens.max }]);
    expect(
      mitGeaendertemPunkt(n, 0, {
        art: 'nachFrist',
        alleTage: 1,
        hoechstens: GRENZEN.hoechstens.max + 1,
      }),
    ).toEqual(n);
  });
});

describe('„geändert?“ und was gespeichert wird', () => {
  it('ohne Änderung: nicht geändert, Plan wie Standard wird als null gespeichert', () => {
    const e = entwurfVon({ plan: null });
    expect(entwurfGeaendert(e, { plan: null })).toBe(false);
    expect(planFuerSpeicher(e)).toBeNull();
  });

  it('entfernen und wieder hinzufügen ist gleich dem Standard (feste Reihenfolge)', () => {
    const e = entwurfVon({ plan: null });
    const wieder = { ...e, punkte: mitNeuemPunkt(ohnePunkt(e.punkte, 2), 'frist') };
    expect(entwurfGeaendert(wieder, { plan: null })).toBe(false);
    expect(planFuerSpeicher(wieder)).toBeNull();
  });

  it('geänderte Punkte: eigener Plan, Mail bleibt null (Standardtext)', () => {
    const e = entwurfVon({ plan: null });
    const neu = { ...e, punkte: ohnePunkt(e.punkte, 1) };
    expect(entwurfGeaendert(neu, { plan: null })).toBe(true);
    expect(planFuerSpeicher(neu)).toEqual({
      punkte: [
        { art: 'oeffnen' },
        { art: 'frist' },
        { art: 'nachFrist', alleTage: 1, hoechstens: 3 },
      ],
      mail: null,
    });
  });

  it('eigener Betreff: gespeichert mit Standardtext darunter; leer = Standard; getrimmt', () => {
    const e = entwurfVon({ plan: null });
    expect(planFuerSpeicher({ ...e, betreff: '  Hallo  ' })?.mail).toEqual({
      betreff: 'Hallo',
      text: STANDARD_TEXT,
    });
    expect(planFuerSpeicher({ ...e, betreff: '   ' })).toBeNull();
    expect(planFuerSpeicher({ ...e, text: '' })).toBeNull();
  });

  it('gespeicherter, aber dem Standard gleicher Plan gilt nicht als geändert', () => {
    const plan = { punkte: [...STANDARD_PLAN.punkte].reverse(), mail: null };
    expect(entwurfGeaendert(entwurfAus(plan), { plan })).toBe(false);
  });

  it('alles, was gespeichert würde, nimmt das Schema wieder an (sonst wäre es später „unlesbar“)', () => {
    const e = entwurfVon({ plan: null });
    for (const neu of [
      { ...e, punkte: [] },
      { ...e, betreff: 'B', text: 'T' },
      { ...e, punkte: mitNeuemPunkt(e.punkte, 'vorFrist') },
    ]) {
      const inhalt = { plan: planFuerSpeicher(neu), abfragen: [], einrichtung: null };
      expect(abfragenAus(inhalt)).not.toBeNull();
    }
  });

  it('wirksamerPlan schreibt die Mail aus (für Vorschau und Vergleich)', () => {
    expect(wirksamerPlan(entwurfVon({ plan: null })).mail).toEqual({
      betreff: STANDARD_BETREFF,
      text: STANDARD_TEXT,
    });
  });
});

describe('Vorschau', () => {
  it('Beispiel: Tage aus erinnerungsTage mit Frist in 14 Tagen, Beginn 28 Tage danach, Öffnen heute', () => {
    const plan = geltenderPlan({ plan: null });
    const v = vorschau(plan, null, HEUTE);
    expect(v.echt).toBe(false);
    expect(v.kopf).toBe('Beispiel: Frist Di, 15.12., Zeitraum ab Di, 12.01.');
    const erwartet = erinnerungsTage(
      plan,
      { ...ABFRAGE, frist: '2026-12-15', von: '2027-01-12', bis: '2027-02-11', oeffnen: HEUTE },
      HEUTE,
    );
    expect(v.tage).toEqual(erwartet);
    expect(v.tage).toEqual([
      '2026-12-01',
      '2026-12-13',
      '2026-12-15',
      '2026-12-16',
      '2026-12-17',
      '2026-12-18',
    ]);
  });

  it('läuft eine Abfrage, zählen deren echte Tage – mit dem bearbeiteten Plan', () => {
    const plan: Erinnerungsplan = { punkte: [{ art: 'frist' }], mail: null };
    const v = vorschau(plan, ABFRAGE, HEUTE);
    expect(v.echt).toBe(true);
    expect(v.kopf).toBe('Läuft gerade: Frist Di, 05.01., Zeitraum ab Mo, 01.02.');
    expect(v.tage).toEqual(['2027-01-05']);
  });

  it('ohne Punkte keine Tage', () => {
    expect(vorschau({ punkte: [], mail: null }, null, HEUTE).tage).toEqual([]);
  });
});
