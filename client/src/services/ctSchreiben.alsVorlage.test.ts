import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Die Erweiterungs-Seite der Weiche für „Als Vorlage …“ (E10-V5): Termin, Vorlage und `gesehen` gehen unverändert an den
 * gemeinsamen Browser-Zugriff – für genau diesen Termin.
 */
const zugriff = vi.hoisted(() => ({
  speichern: vi.fn(() => Promise.resolve(42)),
  ersetzen: vi.fn(() => Promise.resolve()),
}));
const fuer = vi.hoisted(() => vi.fn());
vi.mock('@ui/ablauf/browserAblaufZugriff', async (original) => ({
  ...(await original<typeof import('@ui/ablauf/browserAblaufZugriff')>()),
  browserAlsVorlageZugriff: fuer,
}));

const { vorlageAusTermin, vorlageMitTerminErsetzen } = await import('./ctSchreiben');

beforeEach(() => {
  vi.clearAllMocks();
  fuer.mockReturnValue(zugriff);
});

describe('ctSchreiben – Als Vorlage …', () => {
  it('neue Vorlage: der Zugriff gehört zum Termin, die Daten gehen durch', async () => {
    await expect(vorlageAusTermin(9, { name: 'Neu', kalenderId: 2 })).resolves.toBe(42);
    expect(fuer).toHaveBeenCalledWith(9);
    expect(zugriff.speichern).toHaveBeenCalledWith({ name: 'Neu', kalenderId: 2 });
  });

  it('ersetzen: Vorlage und `gesehen` gehen durch, der Zugriff gehört zum Termin', async () => {
    await vorlageMitTerminErsetzen(5, 9, 'stempel');
    expect(fuer).toHaveBeenCalledWith(9);
    expect(zugriff.ersetzen).toHaveBeenCalledWith(5, 'stempel');
  });
});
