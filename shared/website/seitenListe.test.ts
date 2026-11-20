import { describe, expect, it } from 'vitest';
import { seiteSchema, SLUG } from './modell';
import {
  freierPfad,
  hatStartseite,
  menueOhneSeite,
  neueLeereSeite,
  neueStartseite,
  pfadAusTitel,
  seitenAuswahlText,
  seitenFuerListe,
  vorlaeufigeEinstellungen,
} from './seitenListe';
import { idZaehler, menue, seite } from './website.testdaten';

describe('pfadAusTitel', () => {
  it.each([
    ['Unsere Gruppen', 'unsere-gruppen'],
    ['Über uns', 'ueber-uns'],
    ['Straße & Köln!', 'strasse-koeln'],
    ['  Jugend   2026 ', 'jugend-2026'],
    ['Café', 'cafe'],
  ])('%s → %s', (titel, pfad) => {
    expect(pfadAusTitel(titel)).toBe(pfad);
  });

  it('ohne verwertbare Zeichen wird es „seite“', () => {
    expect(pfadAusTitel('???')).toBe('seite');
    expect(pfadAusTitel('')).toBe('seite');
  });

  it('jedes Ergebnis passt zum Muster des Modells und ist höchstens 80 Zeichen lang', () => {
    for (const t of [
      'A'.repeat(200),
      'ä'.repeat(100),
      'x-'.repeat(60),
      '---',
      'Ein sehr langer Titel '.repeat(10),
    ]) {
      const p = pfadAusTitel(t);
      expect(SLUG.test(p)).toBe(true);
      expect(p.length).toBeLessThanOrEqual(80);
    }
  });
});

describe('freierPfad', () => {
  it('ein freier Pfad bleibt', () => {
    expect(freierPfad('jugend', ['start'])).toBe('jugend');
  });
  it('ein vergebener bekommt -2, -3 …', () => {
    expect(freierPfad('jugend', ['jugend'])).toBe('jugend-2');
    expect(freierPfad('jugend', ['jugend', 'jugend-2'])).toBe('jugend-3');
  });
  it('auch ein 80 Zeichen langer Pfad bleibt mit Endung im Rahmen und gültig', () => {
    const lang = 'a'.repeat(80);
    const p = freierPfad(lang, [lang]);
    expect(p.length).toBeLessThanOrEqual(80);
    expect(SLUG.test(p)).toBe(true);
    expect(p).not.toBe(lang);
  });
});

describe('neue Seiten', () => {
  it('eine neue leere Seite ist gültig, hat den Pfad aus dem Titel und ist keine Startseite', () => {
    const s = neueLeereSeite('  Unsere Gruppen ', [], idZaehler());
    expect(seiteSchema.safeParse(s).success).toBe(true);
    expect(s).toMatchObject({ titel: 'Unsere Gruppen', pfad: 'unsere-gruppen', abschnitte: [] });
    expect(s.startseite).toBeUndefined();
  });

  it('der Pfad einer neuen Seite weicht einer vorhandenen aus', () => {
    const vorhanden = [seite({ id: 'x', pfad: 'unsere-gruppen', startseite: false })];
    expect(neueLeereSeite('Unsere Gruppen', vorhanden, idZaehler()).pfad).toBe('unsere-gruppen-2');
  });

  it('ein zu langer Titel wird auf die 150 Zeichen des Modells beschnitten und bleibt gültig', () => {
    const s = neueLeereSeite('T'.repeat(300), [], idZaehler());
    expect(s.titel).toHaveLength(150);
    expect(seiteSchema.safeParse(s).success).toBe(true);
  });

  it('die Startseite kommt aus der Vorlage „start-schriftzug“, ist gültig und hat Pfad „start“', () => {
    const s = neueStartseite([], idZaehler());
    expect(seiteSchema.safeParse(s).success).toBe(true);
    expect(s).toMatchObject({ titel: 'Startseite', pfad: 'start', startseite: true });
    expect(s.abschnitte).toHaveLength(1);
    expect(s.abschnitte[0].vorlage).toBe('start-schriftzug');
  });

  it('liegt „start“ schon als Pfad einer anderen Seite vor, weicht die Startseite aus', () => {
    const s = neueStartseite([seite({ id: 'x', pfad: 'start', startseite: false })], idZaehler());
    expect(s.pfad).toBe('start-2');
  });

  it('alle IDs der neuen Startseite sind verschieden (Seite, Abschnitt, Spalten, Bausteine)', () => {
    const s = neueStartseite([], idZaehler());
    const ids = [
      s.id,
      ...s.abschnitte.flatMap((a) => [
        a.id,
        ...a.spalten.flatMap((sp) => [sp.id, ...sp.bausteine.map((b) => b.id)]),
      ]),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('hatStartseite', () => {
    expect(hatStartseite([])).toBe(false);
    expect(hatStartseite([seite({ startseite: false })])).toBe(false);
    expect(hatStartseite([seite({ startseite: true })])).toBe(true);
  });
});

describe('seitenFuerListe', () => {
  const a = seite({ id: 'a', titel: 'Zebra', pfad: 'a', startseite: false });
  const b = seite({ id: 'b', titel: 'Apfel', pfad: 'b', startseite: false });
  const c = seite({ id: 'c', titel: 'Start', pfad: 'c', startseite: true });

  it('erst die im Menü – in der Reihenfolge des Menüs –, dann die weiteren (Startseite zuerst, sonst nach Titel)', () => {
    const m = menue([
      { titel: 'Z', ziel: { art: 'seite', seiteId: 'a' } },
      { titel: 'B', ziel: { art: 'seite', seiteId: 'b' } },
    ]);
    expect(seitenFuerListe([c, b, a], m)).toEqual({ imMenue: [a, b], weitere: [c] });
    expect(seitenFuerListe([a, b, c], null)).toEqual({ imMenue: [], weitere: [c, b, a] });
  });

  it('Unterpunkte zählen mit; eine Seite steht höchstens einmal da; Links ins Leere und nach außen werden übergangen', () => {
    const m = menue([
      {
        titel: 'Oben',
        ziel: { art: 'seite', seiteId: 'a' },
        unter: [
          { titel: 'Unter', ziel: { art: 'seite', seiteId: 'b' } },
          { titel: 'Nochmal', ziel: { art: 'seite', seiteId: 'a' } },
        ],
      },
      { titel: 'Weg', ziel: { art: 'seite', seiteId: 'gibt-es-nicht' } },
      { titel: 'Außen', ziel: { art: 'extern', url: 'https://beispiel.de' } },
    ]);
    expect(seitenFuerListe([a, b, c], m).imMenue).toEqual([a, b]);
  });
});

describe('menueOhneSeite', () => {
  const m = menue([
    {
      titel: 'A',
      ziel: { art: 'seite', seiteId: 'a' },
      unter: [{ titel: 'AB', ziel: { art: 'seite', seiteId: 'b' } }],
    },
    {
      titel: 'C',
      ziel: { art: 'seite', seiteId: 'c' },
      unter: [{ titel: 'CB', ziel: { art: 'seite', seiteId: 'b' } }],
    },
  ]);

  it('ein Eintrag, der auf die Seite zeigt, fällt mit seinen Unterpunkten weg', () => {
    expect(menueOhneSeite(m, 'a')?.eintraege.map((e) => e.titel)).toEqual(['C']);
  });

  it('ein Unterpunkt fällt allein weg, der Eintrag bleibt', () => {
    const r = menueOhneSeite(m, 'b')!;
    expect(r.eintraege.map((e) => e.titel)).toEqual(['A', 'C']);
    expect(r.eintraege.every((e) => e.unter?.length === 0)).toBe(true);
  });

  it('zeigt nichts auf die Seite (oder gibt es kein Menü): null – dann muss nichts gespeichert werden', () => {
    expect(menueOhneSeite(m, 'x')).toBeNull();
    expect(menueOhneSeite(null, 'a')).toBeNull();
  });
});

describe('vorlaeufigeEinstellungen', () => {
  it('trägt den Gemeindenamen; ohne Namen ein neutraler; noindex, weil es keine Adresse gibt', () => {
    expect(vorlaeufigeEinstellungen('  Meine Gemeinde ')).toMatchObject({
      name: 'Meine Gemeinde',
      noindex: true,
    });
    expect(vorlaeufigeEinstellungen(null).name).toBe('Deine Gemeinde');
    expect(vorlaeufigeEinstellungen('   ').name).toBe('Deine Gemeinde');
  });
});

describe('seitenAuswahlText', () => {
  it('die Startseite bekommt den Zusatz, eine andere Seite nicht', () => {
    expect(seitenAuswahlText({ titel: 'Willkommen', startseite: true })).toBe(
      'Willkommen (Startseite)',
    );
    expect(seitenAuswahlText({ titel: 'Impressum' })).toBe('Impressum');
    expect(seitenAuswahlText({ titel: 'Impressum', startseite: false })).toBe('Impressum');
  });

  it('heißt die Startseite schon so, steht es nicht doppelt da', () => {
    expect(seitenAuswahlText({ titel: 'Startseite', startseite: true })).toBe('Startseite');
    expect(seitenAuswahlText({ titel: 'Unsere startseite', startseite: true })).toBe(
      'Unsere startseite',
    );
  });
});
