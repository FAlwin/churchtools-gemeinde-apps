import { describe, expect, it } from 'vitest';
import type { AbsenceEvent, TerminArt } from '@shared/types/index';
import {
  SONSTIGE_ID,
  artVon,
  ausgeblendetAusAlterWahl,
  filtereTermine,
  knoepfeAus,
} from './terminFilter';

/**
 * Der Termin-Filter (#400) als reine Regeln – Termin-Arten mit Suchwörtern, „Sonstige" für den Rest.
 *
 * Seit 28.10.2026 mit Häkchen wie im Dienstplaner: gemerkt wird, was AUSGEBLENDET ist; eine gemerkte Wahl der alten
 * Art („genau eine Art oder alles") wird einmal umgerechnet.
 */
const ev = (id: number, name: string): AbsenceEvent => ({
  id,
  name,
  date: '2026-10-04',
  startDate: '2026-10-04T10:00:00Z',
  endDate: '2026-10-04T11:30:00Z',
});
const GD: TerminArt = { id: 'gd', name: 'Gottesdienst', suchwort: 'Gottesdienst' };
const GA: TerminArt = { id: 'ga', name: 'Gebetsabend', suchwort: 'gebetsabend' };
const ARTEN = [GD, GA];

describe('artVon', () => {
  it('findet das Suchwort im Namen – Groß-/Kleinschreibung egal', () => {
    expect(artVon(ev(1, 'Gottesdienst mit Abendmahl'), ARTEN)).toBe('gd');
    expect(artVon(ev(2, 'GEBETSABEND'), ARTEN)).toBe('ga');
  });

  it('die ERSTE passende Art gewinnt – die Reihenfolge des Admins zählt', () => {
    const jugend: TerminArt = { id: 'j', name: 'Jugend', suchwort: 'Jugend' };
    expect(artVon(ev(1, 'Jugendgottesdienst'), [GD, jugend])).toBe('gd');
    expect(artVon(ev(1, 'Jugendgottesdienst'), [jugend, GD])).toBe('j');
  });

  it('ohne Treffer: Sonstige', () => {
    expect(artVon(ev(1, 'Probe'), ARTEN)).toBe(SONSTIGE_ID);
  });

  it('ein leeres Suchwort trifft nichts – sonst gehörte JEDER Termin dazu', () => {
    expect(artVon(ev(1, 'Probe'), [{ id: 'x', name: 'X', suchwort: '  ' }])).toBe(SONSTIGE_ID);
  });
});

describe('knoepfeAus', () => {
  it('zeigt nur Arten, zu denen es Termine gibt – in der Reihenfolge des Admins', () => {
    const k = knoepfeAus(ARTEN, [ev(1, 'Gebetsabend'), ev(2, 'Gottesdienst')]);
    expect(k.map((x) => x.name)).toEqual(['Gottesdienst', 'Gebetsabend']);
  });

  it('hängt „Sonstige" an, wenn ein Termin nirgends hineinpasst', () => {
    const k = knoepfeAus(ARTEN, [ev(1, 'Gottesdienst'), ev(2, 'Probe')]);
    expect(k.map((x) => x.id)).toEqual(['gd', SONSTIGE_ID]);
  });

  it('ohne Arten gibt es höchstens „Sonstige" – also nichts zu filtern', () => {
    expect(knoepfeAus([], [ev(1, 'Gottesdienst')]).map((x) => x.id)).toEqual([SONSTIGE_ID]);
  });
});

describe('filtereTermine – ausgeblendete Arten fallen weg', () => {
  const alle = [ev(1, 'Gottesdienst'), ev(2, 'Gebetsabend'), ev(3, 'Probe')];

  it('nichts ausgeblendet: alle', () => {
    expect(filtereTermine(alle, [], ARTEN)).toHaveLength(3);
  });

  it('eine Art ausgeblendet – „Sonstige" ist eine eigene Art', () => {
    expect(filtereTermine(alle, ['ga'], ARTEN).map((e) => e.id)).toEqual([1, 3]);
    expect(filtereTermine(alle, [SONSTIGE_ID], ARTEN).map((e) => e.id)).toEqual([1, 2]);
  });

  it('mehrere ausgeblendet (Häkchen) – nur der Rest bleibt', () => {
    expect(filtereTermine(alle, ['gd', SONSTIGE_ID], ARTEN).map((e) => e.id)).toEqual([2]);
  });

  it('eine ausgeblendete Art, die es nicht mehr gibt, blendet nichts aus', () => {
    expect(filtereTermine(alle, ['geloescht'], ARTEN)).toHaveLength(3);
  });
});

describe('ausgeblendetAusAlterWahl – die gemerkte Wahl der alten Art umrechnen', () => {
  const knoepfe = [
    { id: 'gd', name: 'Gottesdienst' },
    { id: 'ga', name: 'Gebetsabend' },
    { id: SONSTIGE_ID, name: 'Sonstige' },
  ];

  it('„nur Gottesdienst" → alle anderen ausgeblendet (dieselbe Liste wie vorher)', () => {
    expect(ausgeblendetAusAlterWahl(['gd'], knoepfe)).toEqual(['ga', SONSTIGE_ID]);
  });

  it('nichts gewählt („alle") → nichts ausgeblendet', () => {
    expect(ausgeblendetAusAlterWahl([], knoepfe)).toEqual([]);
  });

  it('eine Wahl ohne Knopf (vom Admin gelöscht) → nichts ausgeblendet, statt einer leeren Liste', () => {
    expect(ausgeblendetAusAlterWahl(['weg'], knoepfe)).toEqual([]);
  });

  it('eine Mehrfachauswahl aus der Zwischenfassung → ihr erster gültiger Eintrag zählt', () => {
    expect(ausgeblendetAusAlterWahl(['weg', 'ga', 'gd'], knoepfe)).toEqual(['gd', SONSTIGE_ID]);
  });
});
