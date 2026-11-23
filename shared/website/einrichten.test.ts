import { describe, expect, it } from 'vitest';
import {
  einrichtungAus,
  einrichtungsStand,
  kategorienFuer,
  kuerzelEntwuerfe,
  kuerzelLesen,
  kuerzelVeroeffentlicht,
  untergruppenAus,
  untergruppenKategorie,
  untergruppenKategorienAus,
} from './einrichten';

const kategorien = (gruppe: number, name = 'Website', ab = 10) =>
  kategorienFuer(gruppe, name).map((k, i) => ({ id: ab + i, shorty: k.kuerzel, name: k.name }));

describe('Kürzel', () => {
  it('Kürzel tragen die Gruppe und lassen sich wieder lesen', () => {
    expect(kuerzelEntwuerfe(7)).toBe('entwuerfe-g7');
    expect(kuerzelVeroeffentlicht(7)).toBe('veroeffentlicht-g7');
    expect(kuerzelLesen('entwuerfe-g7')).toEqual({ art: 'entwuerfe', gruppe: 7 });
    expect(kuerzelLesen('veroeffentlicht-g12')).toEqual({ art: 'veroeffentlicht', gruppe: 12 });
  });

  it('fremde Kürzel (Protokolle, Gebetsabend, kaputte Gruppen) sind keine Website', () => {
    for (const k of [
      'protokolle-g7',
      'zugang',
      'entwuerfe',
      'entwuerfe-g0',
      'entwuerfe-gx',
      'entwuerfe-g07',
    ])
      expect(kuerzelLesen(k)).toBeNull();
  });

  it('die Kategorien, die „Einrichten“ anlegt, tragen genau diese Kürzel und den Gruppennamen', () => {
    const [e, v] = kategorienFuer(7, 'Website – Team');
    expect(e.kuerzel).toBe(kuerzelEntwuerfe(7));
    expect(v.kuerzel).toBe(kuerzelVeroeffentlicht(7));
    expect(e.name).toContain('Website – Team');
    expect(e.kuerzel.length).toBeLessThanOrEqual(50); // Grenze von ChurchTools
  });
});

describe('einrichtungAus', () => {
  it('liest Gruppe, Namen und beide Kategorien aus der Liste', () => {
    expect(einrichtungAus(kategorien(7, 'Website Team'))).toEqual({
      gruppe: 7,
      name: 'Website Team',
      entwuerfe: 10,
      veroeffentlicht: 11,
    });
  });

  it('nichts Sichtbares oder nur Fremdes: null', () => {
    expect(einrichtungAus([])).toBeNull();
    expect(einrichtungAus([{ id: 1, shorty: 'protokolle-g7' }])).toBeNull();
  });

  it('nur eine der beiden Kategorien: die andere ist null', () => {
    const nur = kategorien(7).slice(0, 1);
    expect(einrichtungAus(nur)).toMatchObject({ gruppe: 7, entwuerfe: 10, veroeffentlicht: null });
  });

  it('mehrere Websites: die mit der kleinsten Kategorie-ID gilt – bei jeder Reihenfolge der Liste', () => {
    const liste = [...kategorien(9, 'Neu', 50), ...kategorien(7, 'Alt', 10)];
    expect(einrichtungAus(liste)?.gruppe).toBe(7);
    expect(einrichtungAus([...liste].reverse())?.gruppe).toBe(7);
  });

  it('dasselbe Kürzel zweimal: die kleinste Kategorie-ID gilt (wie bei allen Kategorien)', () => {
    const liste = [
      ...kategorien(7, 'A', 30),
      { id: 5, shorty: kuerzelEntwuerfe(7), name: 'Website: Entwürfe · A' },
    ];
    expect(einrichtungAus(liste)?.entwuerfe).toBe(5);
  });
});

describe('einrichtungsStand', () => {
  const fertig = einrichtungAus(kategorien(7))!;
  const halb = einrichtungAus(kategorien(7).slice(0, 1))!;

  it('beide da → fertig, egal wer', () => {
    expect(einrichtungsStand(fertig, false)).toBe('fertig');
    expect(einrichtungsStand(fertig, true)).toBe('fertig');
  });

  it('nichts da → Admin richtet ein, alle anderen bekommen den Hinweis', () => {
    expect(einrichtungsStand(null, true)).toBe('einrichten');
    expect(einrichtungsStand(null, false)).toBe('fehlt');
  });

  it('eine fehlt → Admin repariert, die anderen sehen „unvollständig“', () => {
    expect(einrichtungsStand(halb, true)).toBe('einrichten');
    expect(einrichtungsStand(halb, false)).toBe('unvollstaendig');
  });
});

describe('Untergruppen (W3b-4a)', () => {
  /** Hierarchie wie auf der Test-Instanz: Website 344 → Jugend 347 (nur von unten bekannt) und 350 (nur von oben), Enkel 360. */
  const HIER = [
    { groupId: 344, parents: [], children: [350] },
    { groupId: 347, parents: [344], children: [360] },
    { groupId: 360, parents: [347] },
  ];

  it('untergruppenAus: direkte Kinder aus parents UND children, Enkel nicht', () => {
    expect(untergruppenAus(HIER, 344)).toEqual([347, 350]);
  });

  it('untergruppenAus: eine Website ohne Kinder (oder keine Hierarchie) hat keine', () => {
    expect(untergruppenAus([{ groupId: 344, parents: [1] }], 344)).toEqual([]);
    expect(untergruppenAus(null, 344)).toEqual([]);
  });

  it('untergruppenKategorie: Kürzel und Name wie die Veröffentlicht-Kategorie (so findet sich die aus der Messung wieder)', () => {
    const k = untergruppenKategorie(347, 'Website – Jugend');
    expect(k.kuerzel).toBe('veroeffentlicht-g347');
    expect(k.name).toBe('Website: Veröffentlicht · Website – Jugend');
    expect(k.name).toBe(kategorienFuer(347, 'Website – Jugend')[1].name);
  });

  it('untergruppenKategorienAus: nur Kinder der Website, bei gleichem Kürzel die kleinste ID, ohne Kategorie = nicht eingerichtet', () => {
    const liste = [
      ...kategorien(344, 'Website', 104),
      { id: 117, shorty: kuerzelVeroeffentlicht(347) },
      { id: 90, shorty: kuerzelVeroeffentlicht(347) },
      { id: 120, shorty: kuerzelVeroeffentlicht(999) }, // keine Untergruppe der Website
    ];
    expect(untergruppenKategorienAus(liste, [347, 350])).toEqual([{ gruppe: 347, kategorie: 90 }]);
  });
});

describe('einrichtungAus erkennt die Website NUR über entwuerfe-g (W3b-4a)', () => {
  const jugend = (id: number) => ({
    id,
    shorty: kuerzelVeroeffentlicht(347),
    name: 'Website: Veröffentlicht · Website – Jugend',
  });

  it('eine Untergruppen-Kategorie mit KLEINERER ID wird nicht als Website gewählt', () => {
    const liste = [jugend(5), ...kategorien(344, 'Website', 104)];
    expect(einrichtungAus(liste)).toEqual({
      gruppe: 344,
      name: 'Website',
      entwuerfe: 104,
      veroeffentlicht: 105,
    });
    expect(einrichtungAus([...liste].reverse())?.gruppe).toBe(344);
  });

  it('wer NUR die Untergruppen-Kategorie sieht, sieht keine Website (null) – nie die Untergruppe als Website', () => {
    expect(einrichtungAus([jugend(117)])).toBeNull();
    expect(einrichtungsStand(einrichtungAus([jugend(117)]), false)).toBe('fehlt');
  });

  it('Redakteur einer Untergruppe (sieht Entwürfe der Website und die eigene Kategorie): Website = die Gruppe aus entwuerfe-g', () => {
    const liste = [kategorien(344, 'Website', 104)[0], jugend(117)];
    expect(einrichtungAus(liste)).toEqual({
      gruppe: 344,
      name: 'Website',
      entwuerfe: 104,
      veroeffentlicht: null,
    });
  });
});
