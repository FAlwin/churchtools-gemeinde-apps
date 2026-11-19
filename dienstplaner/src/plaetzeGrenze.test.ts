import { describe, expect, it } from 'vitest';
import type { PlaetzeZeile } from './PlaetzeFach';
import { minusErlaubt, plaetzeGrenze, plusErlaubt } from './plaetzeGrenze';
import { mitnehmenText } from './plaetzeTexte';

const z = (x: Partial<PlaetzeZeile>): PlaetzeZeile => ({
  serviceId: 6,
  name: 'Ton',
  anzahl: 4,
  belegt: 0,
  entwuerfe: 0,
  entwuerfeAufFreien: 0,
  mitnehmbar: true,
  ...x,
});

describe('plaetzeGrenze – die EINE Rechnung für Regler und Hinweise (19.11.2026)', () => {
  it('ohne Belegte und Entwürfe geht „−“ bis 0 (Dienst aus), „+“ immer', () => {
    const g = plaetzeGrenze(z({}), 1);
    expect(minusErlaubt(g, 1)).toBe(true);
    expect(minusErlaubt(g, 0)).toBe(false);
    expect(plusErlaubt(g)).toBe(true);
    expect(g).toMatchObject({ art: 'frei', kleinste: 0, hinweis: null });
  });

  it('Untergrenze = belegte + Entwürfe auf freien Plätzen', () => {
    const e = z({ belegt: 1, entwuerfe: 2, entwuerfeAufFreien: 2 });
    expect(plaetzeGrenze(e, 4)).toMatchObject({ kleinste: 3, hinweis: null });
    expect(minusErlaubt(plaetzeGrenze(e, 4), 4)).toBe(true);
    const g = plaetzeGrenze(e, 3);
    expect(minusErlaubt(g, 3)).toBe(false);
    expect(g).toMatchObject({ grund: 'entwuerfe' });
    expect(g.hinweis).toContain('Auf den freien Plätzen liegen Entwürfe');
    expect(plusErlaubt(g)).toBe(true);
  });

  it('ein Entwurf auf einem belegten Platz zählt nicht extra', () => {
    const e = z({ belegt: 2, entwuerfe: 1, entwuerfeAufFreien: 0 });
    expect(plaetzeGrenze(e, 3)).toMatchObject({ kleinste: 2 });
    expect(minusErlaubt(plaetzeGrenze(e, 3), 3)).toBe(true);
  });

  it('bei den Belegten ist der Grund „belegt“, auch wenn Entwürfe dazukommen', () => {
    const g = plaetzeGrenze(z({ belegt: 2, entwuerfe: 1, entwuerfeAufFreien: 1 }), 2);
    expect(g).toMatchObject({ grund: 'belegt' });
    expect(g.hinweis).toContain('Erst jemanden herausnehmen');
  });

  it('gesperrt nur mit Entwürfen, die nicht umgetragen werden dürfen – dann „−“ und „+“ aus, alter Satz', () => {
    const g = plaetzeGrenze(z({ entwuerfe: 2, entwuerfeAufFreien: 1, mitnehmbar: false }), 4);
    expect(g).toEqual({
      art: 'gesperrt',
      hinweis: 'Hier liegen 2 Entwürfe – erst senden oder entfernen.',
    });
    expect(minusErlaubt(g, 4)).toBe(false);
    expect(plusErlaubt(g)).toBe(false);
    // Ohne Entwürfe ist „nicht mitnehmbar“ ohne Bedeutung.
    expect(plaetzeGrenze(z({ mitnehmbar: false }), 4).art).toBe('frei');
  });
});

describe('mitnehmenText', () => {
  const ok = (entwuerfe: Parameters<typeof mitnehmenText>[0]['entwuerfe']) =>
    ({ ok: true, anzahl: 2, entwuerfe }) as Parameters<typeof mitnehmenText>[0];

  it('nichts offen (oder nichts zu prüfen) → keine Meldung', () => {
    expect(mitnehmenText(ok(undefined))).toBeNull();
    expect(mitnehmenText(ok({ umgetragen: ['20|6|1'], offen: 0, unklar: false }))).toBeNull();
  });

  it('offen: Zahl der Entwürfe, Einzahl und Mehrzahl', () => {
    expect(mitnehmenText(ok({ umgetragen: [], offen: 1, unklar: false }))).toBe(
      '2 Plätze gespeichert – 1 Entwurf konnte nicht mitgehen und liegt noch am alten Platz. Bitte neu laden.',
    );
    expect(mitnehmenText(ok({ umgetragen: [], offen: 3, unklar: false }))).toContain(
      '3 Entwürfe konnten nicht mitgehen und liegen noch am alten Platz',
    );
  });

  it('nicht prüfbar → ehrlich „ließ sich nicht prüfen“', () => {
    expect(mitnehmenText(ok({ umgetragen: [], offen: 0, unklar: true }))).toContain(
      'ließ sich nicht prüfen',
    );
  });
});
