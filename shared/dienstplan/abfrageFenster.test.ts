import { describe, expect, it } from 'vitest';
import { plusTage, tagKurz } from '../ct/datum';
import {
  abfragenAus,
  erinnerungsTage,
  GRENZEN,
  STANDARD_PLAN,
  type Abfrage,
  type Erinnerungsplan,
} from './abfragen';
import {
  abfrageEtikett,
  formularFehler,
  formularStart,
  heuteZeilenText,
  lageAus,
  mitBeendeterAbfrage,
  mitNeuerAbfrage,
  neueAbfrage,
  oeffnenTagAus,
  standAbschnitte,
  zeitleiste,
  type AbfrageFormular,
} from './abfrageFenster';
import type { GruppenErgebnis } from './erinnern';
import { leereListe, pauseSetzen } from './personenliste';
import { liste } from './personenliste.testutil';

const HEUTE = '2026-10-14';
const ICH = { personId: 1, name: 'Alwin Friesen' };
const form = (x: Partial<AbfrageFormular> = {}): AbfrageFormular => ({
  von: '2026-11-10',
  bis: '2026-12-10',
  frist: '2026-11-01',
  oeffnen: 'sofort',
  oeffnenTag: '',
  ...x,
});
const abfrageVon = (f: AbfrageFormular, termine = [1]): Abfrage =>
  neueAbfrage({
    id: 'a',
    formular: f,
    heute: HEUTE,
    termine,
    ich: ICH,
    zeit: '2026-10-14T10:00:00Z',
  });

describe('formularFehler', () => {
  it('ein gutes Formular hat keinen Fehler', () => {
    expect(formularFehler(form(), HEUTE)).toBeNull();
    expect(formularFehler(form({ oeffnen: 'tag', oeffnenTag: '2026-10-20' }), HEUTE)).toBeNull();
  });

  it.each([
    ['leere Felder', form({ von: '' }), /ausfüllen/],
    ['„an einem Tag“ ohne Tag', form({ oeffnen: 'tag', oeffnenTag: '' }), /ausfüllen/],
    ['Ende vor Beginn', form({ bis: '2026-11-09' }), /endet vor seinem Beginn/],
    ['Beginn heute oder früher', form({ von: HEUTE, frist: HEUTE }), /nach heute beginnen/],
    ['Öffnungstag vor heute', form({ oeffnen: 'tag', oeffnenTag: '2026-10-13' }), /Vergangenheit/],
    ['Frist am Beginn', form({ frist: '2026-11-10' }), /Frist muss vor dem Beginn/],
    ['Frist vor heute (sofort)', form({ frist: '2026-10-13' }), /vor heute/],
    [
      'Frist vor dem Öffnungstag',
      form({ oeffnen: 'tag', oeffnenTag: '2026-10-20', frist: '2026-10-19' }),
      /vor dem Öffnungstag/,
    ],
  ])('%s', (_name, f, text) => {
    expect(formularFehler(f, HEUTE)).toMatch(text);
  });

  it('gegen den Erzeuger: was hier durchgeht, liest abfragenAus wieder – und umgekehrt kein Fehler übersehen', () => {
    // Alle Kombinationen aus einem Raster von Tagen rund um heute.
    const tage = [-1, 0, 1, 5, 10, 20].map((n) => plusTage(HEUTE, n));
    let gut = 0;
    for (const von of tage)
      for (const bis of tage)
        for (const frist of tage)
          for (const art of ['sofort', 'tag'] as const)
            for (const tag of tage) {
              const f = form({ von, bis, frist, oeffnen: art, oeffnenTag: tag });
              const geht = abfragenAus({ plan: null, abfragen: [abfrageVon(f)] }) !== null;
              if (formularFehler(f, HEUTE) === null) {
                gut++;
                expect(geht, JSON.stringify(f)).toBe(true);
              }
            }
    expect(gut).toBeGreaterThan(10);
  });
});

describe('formularStart (Vorbelegung aus dem gezeigten Zeitraum)', () => {
  it('weit voraus: Beginn und Ende wie gezeigt, Frist vier Wochen davor', () => {
    const f = formularStart({ von: '2026-12-10', bis: '2027-01-20' }, HEUTE);
    expect(f).toEqual({
      von: '2026-12-10',
      bis: '2027-01-20',
      frist: '2026-11-12',
      oeffnen: 'sofort',
      oeffnenTag: '',
    });
    expect(formularFehler(f, HEUTE)).toBeNull();
  });

  it('beginnt der gezeigte Zeitraum heute: frühestens morgen, Frist heute – das Formular ist startbar', () => {
    const f = formularStart({ von: HEUTE, bis: '2026-11-30' }, HEUTE);
    expect(f.von).toBe('2026-10-15');
    expect(f.frist).toBe(HEUTE);
    expect(formularFehler(f, HEUTE)).toBeNull();
  });

  it('ohne gezeigte Termine: ein Zeitraum ab morgen, 60 Tage', () => {
    const f = formularStart(null, HEUTE);
    expect(f.von).toBe('2026-10-15');
    expect(f.bis).toBe(plusTage(HEUTE, 60));
    expect(formularFehler(f, HEUTE)).toBeNull();
  });

  it('endet der gezeigte Zeitraum vor dem Beginn: Ende = Beginn', () => {
    const f = formularStart({ von: '2026-10-01', bis: '2026-10-05' }, HEUTE);
    expect(f.bis).toBe(f.von);
  });
});

describe('Inhalt: neue und beendete Abfrage', () => {
  const beendet = (i: number): Abfrage => ({
    ...abfrageVon(form()),
    id: `b${i}`,
    beendet: '2026-09-01',
  });
  const laufend: Abfrage = { ...abfrageVon(form()), id: 'laufend' };

  it('der eigene Plan bleibt, die Abfragen werden ergänzt', () => {
    const plan: Erinnerungsplan = { punkte: [{ art: 'frist' }], mail: null };
    const neu = abfrageVon(form());
    const r = mitNeuerAbfrage({ plan, abfragen: [beendet(1)] }, neu, HEUTE);
    expect(r.plan).toBe(plan);
    expect(r.abfragen.map((a) => a.id)).toEqual(['b1', 'a']);
    expect(abfragenAus(r)).not.toBeNull();
  });

  it(`bei ${GRENZEN.abfragen} Abfragen gehen die ältesten beendeten zuerst – laufende nie`, () => {
    const alle = [laufend, ...Array.from({ length: GRENZEN.abfragen - 1 }, (_, i) => beendet(i))];
    const r = mitNeuerAbfrage({ plan: null, abfragen: alle }, abfrageVon(form()), HEUTE);
    expect(r.abfragen).toHaveLength(GRENZEN.abfragen);
    expect(r.abfragen.map((a) => a.id)).toContain('laufend');
    expect(r.abfragen.map((a) => a.id)).not.toContain('b0');
    expect(r.abfragen[r.abfragen.length - 1].id).toBe('a');
    expect(abfragenAus(r)).not.toBeNull();
  });

  it('beenden setzt nur diese Abfrage auf den Tag von heute – Plan und andere bleiben', () => {
    const plan: Erinnerungsplan = { punkte: [], mail: null };
    const r = mitBeendeterAbfrage({ plan, abfragen: [beendet(1), laufend] }, 'laufend', HEUTE);
    expect(r.plan).toBe(plan);
    expect(r.abfragen[0]).toEqual(beendet(1));
    expect(r.abfragen[1]).toEqual({ ...laufend, beendet: HEUTE });
  });
});

describe('Zahlen und Stand', () => {
  const ok = (x: Partial<Extract<GruppenErgebnis, { art: 'ok' }>> = {}): GruppenErgebnis => ({
    art: 'ok',
    personen: [],
    pausiert: [],
    mitglieder: [],
    ...x,
  });
  const p = (personId: number, name: string) => ({ personId, name });
  const offen = (personId: number, name: string, n: number) => ({
    ...p(personId, name),
    termine: Array.from({ length: n }, (_, i) => ({
      terminId: i,
      tag: HEUTE,
      name: 'x',
      uhrzeit: '10:00',
    })),
  });
  const E = ok({
    mitglieder: [p(1, 'Anna'), p(2, 'Ben'), p(3, 'Carla'), p(4, 'David')],
    personen: [offen(1, 'Anna', 2)],
    pausiert: [3],
  });

  it('lageAus: fertig ist der Rest; gesperrt gibt keine Zahlen', () => {
    expect(lageAus(E)).toEqual({ mitglieder: 4, offen: 1, pausiert: 1, fertig: 2 });
    expect(lageAus({ art: 'gesperrt', grund: 'x', nochmal: false })).toBeNull();
  });

  it('standAbschnitte: offen mit „x von y“, fertig, pausiert mit „Pause bis“', () => {
    const l = liste(pauseSetzen(leereListe(), 3, { bis: '2026-12-31' }));
    const r = standAbschnitte(E, { termine: [1, 2, 3] }, l)!;
    expect(r.offen).toEqual([{ personId: 1, name: 'Anna', offen: 2, von: 3 }]);
    expect(r.fertig.map((x) => x.name)).toEqual(['Ben', 'David']);
    expect(r.pausiert).toEqual([{ personId: 3, name: 'Carla', bis: '2026-12-31' }]);
    expect(standAbschnitte(E, { termine: [] })!.pausiert[0].bis).toBeNull();
    expect(
      standAbschnitte({ art: 'gesperrt', grund: 'x', nochmal: true }, { termine: [] }),
    ).toBeNull();
  });

  it('heuteZeilenText: sofort oder nicht; Pausierte und Fertige nur, wenn es sie gibt', () => {
    const l = lageAus(E);
    expect(heuteZeilenText({ lage: l, grund: null, sofort: true })).toBe(
      'Erscheint bei 4 Personen. 1 Person fehlt noch Antworten (1 pausiert – keine Mail, 2 schon fertig).',
    );
    expect(
      heuteZeilenText({
        lage: { mitglieder: 3, offen: 3, pausiert: 0, fertig: 0 },
        grund: null,
        sofort: false,
      }),
    ).toBe('Heute: 3 Personen im Team. 3 fehlen noch Antworten.');
    expect(
      heuteZeilenText({ lage: null, grund: 'Antworten nicht sichtbar', sofort: true }),
    ).toContain('Antworten nicht sichtbar');
  });
});

describe('zeitleiste', () => {
  const PLAN: Erinnerungsplan = {
    punkte: [
      { art: 'oeffnen' },
      { art: 'vorFrist', tage: 3 },
      { art: 'nachFrist', alleTage: 1, hoechstens: 3 },
    ],
    mail: null,
  };
  const a = (x: Partial<Abfrage> = {}): Abfrage => ({
    ...abfrageVon(form({ von: '2026-11-20', frist: '2026-11-01' })),
    ...x,
  });
  const wann = (z: { wann: string }[]) => z.map((x) => x.wann);

  it('jeder Tag aus erinnerungsTage steht da – und kein anderer Erinnerungstag', () => {
    const ab = a();
    const zeilen = zeitleiste({ plan: PLAN, abfrage: ab, heute: HEUTE, ab: HEUTE });
    const tage = erinnerungsTage(PLAN, ab, HEUTE);
    // öffnen (heute), 29.10., danach 02.–04.11. in einer Zeile
    expect(tage).toEqual(['2026-10-14', '2026-10-29', '2026-11-02', '2026-11-03', '2026-11-04']);
    const w = wann(zeilen);
    expect(w).toContain('heute');
    expect(w).toContain(tagKurz('2026-10-29'));
    expect(w).toContain('02.11.–04.11.');
    // Die Frist ist kein Erinnerungstag dieses Plans – sie steht trotzdem als Marke da.
    expect(w).toContain(tagKurz('2026-11-01'));
    expect(w[w.length - 1]).toBe(tagKurz('2026-11-20'));
    expect(zeilen[zeilen.length - 1].text).toBe('Zeitraum beginnt: Abfrage endet.');
  });

  it('der Plan entscheidet: der Standard-Plan ergibt andere Zeilen', () => {
    const ab = a();
    const eigen = wann(zeitleiste({ plan: PLAN, abfrage: ab, heute: HEUTE, ab: HEUTE }));
    const standard = wann(
      zeitleiste({ plan: STANDARD_PLAN, abfrage: ab, heute: HEUTE, ab: HEUTE }),
    );
    expect(standard).not.toEqual(eigen);
    // Standard: 2 Tage vor der Frist = 30.10.
    expect(standard).toContain(tagKurz('2026-10-30'));
    expect(eigen).not.toContain(tagKurz('2026-10-30'));
  });

  it('öffnet die Abfrage heute: eine Zeile „sofort“ mit den Zahlen; sonst steht „heute“ davor', () => {
    const sofort = zeitleiste({
      plan: PLAN,
      abfrage: a(),
      heute: HEUTE,
      ab: HEUTE,
      heuteText: 'ZAHLEN',
    });
    expect(sofort[0].wann).toBe('heute');
    expect(sofort[0].klein).toBe('sofort');
    expect(sofort[0].text).toContain('Abfrage erscheint sofort auf der Startseite');
    expect(sofort[0].text).toContain('ZAHLEN');
    expect(sofort.filter((z) => z.text.includes('ZAHLEN'))).toHaveLength(1);

    const spaeter = zeitleiste({
      plan: PLAN,
      abfrage: a({ oeffnen: '2026-10-20' }),
      heute: HEUTE,
      ab: HEUTE,
      heuteText: 'ZAHLEN',
    });
    expect(spaeter[0]).toMatchObject({ wann: 'heute', text: 'ZAHLEN' });
    expect(spaeter[1].text).toContain('Abfrage erscheint auf der Startseite');
    // Tage in der Zukunft: „gegen 0:15“
    expect(spaeter[1].klein).toContain('gegen 0:15');
  });

  it('ab dem Öffnen gerechnet: vergangene Tage sind `vorbei`, nichts behauptet „verschickt“', () => {
    const ab = a({ oeffnen: '2026-10-10' });
    const zeilen = zeitleiste({ plan: PLAN, abfrage: ab, heute: HEUTE, ab: ab.oeffnen });
    const tage = erinnerungsTage(PLAN, ab, ab.oeffnen);
    expect(tage[0]).toBe('2026-10-10');
    expect(zeilen[0]).toMatchObject({ wann: tagKurz('2026-10-10'), vorbei: true });
    expect(zeilen.filter((z) => z.vorbei).map((z) => z.tag)).toEqual(
      zeilen.map((z) => z.tag).filter((t) => t < HEUTE),
    );
    for (const z of zeilen) expect(z.text).not.toMatch(/verschickt|✓/);
  });

  it('ein leerer Plan: nur Öffnen, Frist-Marke und Ende', () => {
    const zeilen = zeitleiste({
      plan: { punkte: [], mail: null },
      abfrage: a(),
      heute: HEUTE,
      ab: HEUTE,
    });
    expect(zeilen.map((z) => z.schluessel.split('-')[0])).toEqual(['oeffnen', 'frist', 'ende']);
  });

  it('oeffnenTagAus', () => {
    expect(oeffnenTagAus(form(), HEUTE)).toBe(HEUTE);
    expect(oeffnenTagAus(form({ oeffnen: 'tag', oeffnenTag: '2026-10-20' }), HEUTE)).toBe(
      '2026-10-20',
    );
  });
});

describe('abfrageEtikett', () => {
  const ab: Abfrage = {
    ...abfrageVon(form()),
    oeffnen: '2026-10-20',
    frist: '2026-10-25',
    von: '2026-11-10',
  };
  it('geplant neutral, offen blau, nach der Frist rot, beendet keins', () => {
    expect(abfrageEtikett(ab, '2026-10-14')?.ton).toBe('neutral');
    expect(abfrageEtikett(ab, '2026-10-25')).toEqual({
      ton: 'blau',
      text: `bis ${tagKurz('2026-10-25')}`,
    });
    expect(abfrageEtikett(ab, '2026-10-26')?.ton).toBe('rot');
    expect(abfrageEtikett(ab, '2026-11-10')).toBeNull();
    expect(abfrageEtikett({ ...ab, beendet: '2026-10-21' }, '2026-10-22')).toBeNull();
  });
});
