import { describe, expect, it } from 'vitest';
import {
  einrichtungAus,
  einrichtungsStand,
  kategorienFuer,
  kuerzelEntwuerfe,
  kuerzelLesen,
  kuerzelVeroeffentlicht,
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
