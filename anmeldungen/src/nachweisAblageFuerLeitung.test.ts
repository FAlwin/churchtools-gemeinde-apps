import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { KeinSpeicherRecht } from '@ui/ct/verbindung';
import { modulId, modulPort } from '@ui/ct/modulPort';
import { nachweisAblageLesen } from '@shared/anmeldung/nachweisStandAblage';
import { nachweisAblageFuerLeitung } from './nachweisStandAblage';

vi.mock('@ui/ct/modulPort', async (original) => ({
  ...(await original<typeof import('@ui/ct/modulPort')>()),
  modulId: vi.fn(),
}));
vi.mock('@shared/anmeldung/nachweisStandAblage', async (original) => ({
  ...(await original<typeof import('@shared/anmeldung/nachweisStandAblage')>()),
  nachweisAblageLesen: vi.fn(),
}));
const id = vi.mocked(modulId);
const lesen = vi.mocked(nachweisAblageLesen);

/**
 * Die Ablage für die Leitung (N3d): ohne „Anmeldungen sehen“ findet man das Modul gar nicht (`modulSuchen` → 404, gemessen in
 * N3a) – das ist „nicht lesbar“, kein Fehler. Vorübergehendes wirft; sonst wird in EINER Lesung gelesen.
 */
beforeEach(() => {
  id.mockReset();
  lesen.mockReset();
});

describe('nachweisAblageFuerLeitung', () => {
  it('das Modul ist nicht zu finden (404, kein „Anmeldungen sehen“) → nicht lesbar, ohne weiter zu fragen', async () => {
    id.mockRejectedValue(
      new ApiError(404, 'Die Erweiterung „Anmeldungen“ ist in ChurchTools nicht zu finden.'),
    );
    expect(await nachweisAblageFuerLeitung([61])).toEqual({ art: 'nichtLesbar' });
    expect(lesen).not.toHaveBeenCalled();
  });

  it('kein Recht an den Daten (von ChurchTools als 401 gemeldet, hier als KeinSpeicherRecht) → nicht lesbar', async () => {
    id.mockRejectedValue(new KeinSpeicherRecht('kein Recht'));
    expect(await nachweisAblageFuerLeitung([61])).toEqual({ art: 'nichtLesbar' });
  });

  it('vorübergehend (503, Drosselung) wirft – nie „nicht lesbar“, sonst stünde „Stand nicht lesbar“ für einen Netz-Schluckauf', async () => {
    id.mockRejectedValue(new ApiError(503, 'weg'));
    await expect(nachweisAblageFuerLeitung([61])).rejects.toMatchObject({ status: 503 });
    id.mockRejectedValue(new ApiError(429, 'zu viele'));
    await expect(nachweisAblageFuerLeitung([61])).rejects.toMatchObject({ status: 429 });
  });

  it('sonst: eine Lesung mit allen Arten über den Anschluss der Erweiterung', async () => {
    id.mockResolvedValue(7);
    const antwort = { art: 'gelesen' as const, staende: new Map(), namen: new Map() };
    lesen.mockResolvedValue(antwort);
    expect(await nachweisAblageFuerLeitung([61, 62])).toBe(antwort);
    expect(lesen).toHaveBeenCalledTimes(1);
    expect(lesen).toHaveBeenCalledWith(modulPort, 7, [61, 62]);
  });
});
