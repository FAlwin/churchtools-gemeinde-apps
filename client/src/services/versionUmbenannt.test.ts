import { describe, it, expect, vi } from 'vitest';

/**
 * Eine Regel, zwei Aufrufer (Editor, „Dateien verwalten“): Beim Umbenennen einer Version gehen BEIDE Hälften mit –
 * Aussehen und Anmerkungen. Fehlt eine, merkt es niemand, bis die Striche weg sind (#814).
 */
const einstellungenMitnehmen = vi.fn();
const anmerkungenMitnehmen = vi.fn();
vi.mock('../utils/songVersions', () => ({
  einstellungenMitnehmen: (...a: unknown[]) => einstellungenMitnehmen(...a),
}));
vi.mock('./annotations', () => ({
  anmerkungenMitnehmen: (...a: unknown[]) => anmerkungenMitnehmen(...a),
}));

const { umbenannteVersionMitnehmen } = await import('./versionUmbenannt');

describe('umbenannteVersionMitnehmen', () => {
  it('nimmt Aussehen (als Umbenennung, mit Tonart) und Anmerkungen mit', () => {
    umbenannteVersionMitnehmen(12, 'akustik', 'live');
    expect(einstellungenMitnehmen).toHaveBeenCalledWith(12, 'akustik', 'live', 'umbenannt');
    expect(anmerkungenMitnehmen).toHaveBeenCalledWith(12, 'akustik', 'live');
  });
});
