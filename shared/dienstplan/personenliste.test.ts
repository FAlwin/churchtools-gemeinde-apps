import { describe, expect, it } from 'vitest';
import {
  hatReihenfolge,
  pauseAm,
  pauseText,
  pausiertAnAllen,
  PERSONENLISTE_ART,
  personenlisteAus,
  rangVon,
  sortiereNachListe,
  tagsFuer,
  tagsSchluessel,
} from './personenliste';
import {
  BEGLEITUNG,
  EINWEISUNG,
  LEITUNG,
  liste,
  listeRoh,
  listeWert,
} from './personenliste.testutil';

describe('personenlisteAus – Lesen', () => {
  it('liest, was der Speicher hält', () => {
    const l = personenlisteAus(
      listeWert({
        version: 3,
        reihe: [4, 2],
        tags: [BEGLEITUNG],
        tagsVon: { '9|4': ['b'] },
        pause: { '2': { bis: '2027-01-31' }, '5': {} },
      }),
    );
    expect(l).toEqual(
      listeRoh({
        version: 3,
        reihe: [4, 2],
        tags: [BEGLEITUNG],
        tagsVon: { '9|4': ['b'] },
        pause: { '2': { bis: '2027-01-31' }, '5': {} },
      }),
    );
  });

  it('fremde Art, andere Fassung, kein JSON → null', () => {
    const w = listeWert();
    expect(
      personenlisteAus({
        ...w,
        value: JSON.stringify({ art: 'dienstplaner-entwurf', fassung: 1 }),
      }),
    ).toBeNull();
    expect(
      personenlisteAus({
        ...w,
        value: JSON.stringify({ ...JSON.parse(w.value), fassung: 2 }),
      }),
    ).toBeNull();
    expect(personenlisteAus({ ...w, value: 'kein json' })).toBeNull();
  });

  it('kaputte Felder → null (nicht halb gelesen)', () => {
    const roh = JSON.parse(listeWert().value) as Record<string, unknown>;
    const ohne = (x: Record<string, unknown>) =>
      personenlisteAus({ ...listeWert(), value: JSON.stringify({ ...roh, ...x }) });
    expect(ohne({ reihe: [1, 'zwei'] })).toBeNull();
    expect(ohne({ version: 'x' })).toBeNull();
    expect(ohne({ tags: [{ id: 'b', name: 'Begleitung' }] })).toBeNull(); // Kürzel fehlt
    expect(ohne({ tagsVon: { '9|4': 'b' } })).toBeNull();
    // Eine Pause mit kaputtem Datum würde „ohne Ende“ heißen – lieber keine Liste.
    expect(ohne({ pause: { '2': { bis: '31.01.2027' } } })).toBeNull();
    expect(ohne({ pause: { '2': { bis: 5 } } })).toBeNull();
  });

  it('der Erzeuger der Testwerte trägt die eine Art', () => {
    expect(JSON.parse(listeWert().value)).toMatchObject({ art: PERSONENLISTE_ART, fassung: 1 });
  });
});

describe('Reihenfolge', () => {
  const personen = [
    { personId: 3, name: 'Clara' },
    { personId: 1, name: 'Anna' },
    { personId: 2, name: 'Ben' },
    { personId: null, name: 'Gast Ärger' },
    { personId: 9, name: 'Ärmel' },
  ];

  it('hatReihenfolge: nur mit mindestens einer Person', () => {
    expect(hatReihenfolge(null)).toBe(false);
    expect(hatReihenfolge(liste())).toBe(false);
    expect(hatReihenfolge(liste({ reihe: [1] }))).toBe(true);
  });

  it('rangVon: Stelle in der Reihenfolge, sonst null', () => {
    const l = liste({ reihe: [7, 3] });
    expect(rangVon(l, 7)).toBe(0);
    expect(rangVon(l, 3)).toBe(1);
    expect(rangVon(l, 1)).toBeNull();
    expect(rangVon(null, 1)).toBeNull();
  });

  it('gespeicherte Reihenfolge zuerst, wer fehlt danach alphabetisch (deutsch), Gäste dazwischen nach Namen', () => {
    const r = sortiereNachListe(liste({ reihe: [2, 3] }), personen);
    expect(r.map((x) => x.name)).toEqual(['Ben', 'Clara', 'Anna', 'Ärmel', 'Gast Ärger']);
  });

  it('ohne Liste (oder ohne Reihenfolge) alphabetisch wie bisher, ohne die Eingabe zu verändern', () => {
    const roh = [...personen];
    expect(sortiereNachListe(null, personen).map((x) => x.name)).toEqual([
      'Anna',
      'Ärmel',
      'Ben',
      'Clara',
      'Gast Ärger',
    ]);
    expect(sortiereNachListe(liste(), personen).map((x) => x.name)).toEqual(
      sortiereNachListe(null, personen).map((x) => x.name),
    );
    expect(personen).toEqual(roh);
  });

  it('gleicher Name: die kleinere ID zuerst', () => {
    const r = sortiereNachListe(null, [
      { personId: 8, name: 'Anna' },
      { personId: 4, name: 'Anna' },
    ]);
    expect(r.map((x) => x.personId)).toEqual([4, 8]);
  });
});

describe('Tags', () => {
  const l = liste({
    tags: [BEGLEITUNG, LEITUNG, EINWEISUNG],
    tagsVon: { [tagsSchluessel(9, 4)]: ['l', 'b', 'x'], [tagsSchluessel(6, 4)]: ['e'] },
  });

  it('je Person UND Dienst, in der Reihenfolge der Tag-Liste; unbekannte IDs fallen weg', () => {
    expect(tagsFuer(l, 9, 4).map((t) => t.kuerzel)).toEqual(['B', 'L']);
    expect(tagsFuer(l, 6, 4).map((t) => t.kuerzel)).toEqual(['E']);
  });

  it('ein anderer Dienst oder eine andere Person hat sie nicht; ohne Liste keine', () => {
    expect(tagsFuer(l, 7, 4)).toEqual([]);
    expect(tagsFuer(l, 9, 5)).toEqual([]);
    expect(tagsFuer(null, 9, 4)).toEqual([]);
  });
});

describe('Pause', () => {
  const l = liste({ pause: { '1': { bis: '2026-12-09' }, '2': {} } });

  it('„bis“ gilt einschließlich, danach nicht mehr', () => {
    expect(pauseAm(l, 1, '2026-12-09')).toEqual({ bis: '2026-12-09' });
    expect(pauseAm(l, 1, '2026-12-08')).not.toBeNull();
    expect(pauseAm(l, 1, '2026-12-10')).toBeNull();
  });

  it('ohne „bis“ unbefristet – auch ohne Tag', () => {
    expect(pauseAm(l, 2, '2099-01-01')).toEqual({});
    expect(pauseAm(l, 2, undefined)).toEqual({});
    // Ein befristete Pause ohne Tag lässt sich nicht beurteilen: gilt nicht.
    expect(pauseAm(l, 1, undefined)).toBeNull();
  });

  it('wer keine Pause hat (oder keine Liste), ist nicht pausiert', () => {
    expect(pauseAm(l, 3, '2026-12-01')).toBeNull();
    expect(pauseAm(null, 1, '2026-12-01')).toBeNull();
  });

  it('pausiertAnAllen: jeder Tag muss gedeckt sein, ohne Tage nein', () => {
    expect(pausiertAnAllen(l, 1, ['2026-12-06', '2026-12-09'])).toBe(true);
    expect(pausiertAnAllen(l, 1, ['2026-12-06', '2026-12-13'])).toBe(false);
    expect(pausiertAnAllen(l, 2, ['2026-12-06', '2026-12-13'])).toBe(true);
    expect(pausiertAnAllen(l, 2, [])).toBe(false);
  });

  it('pauseText: „Pause bis 31.01.27“ bzw. „Pause“', () => {
    expect(pauseText({ bis: '2027-01-31' })).toBe('Pause bis 31.01.27');
    expect(pauseText({})).toBe('Pause');
  });
});
