import { describe, expect, it, vi } from 'vitest';
import * as A from '@shared/gebetsabend/ablage';
import { STANDARD_EINSTELLUNGEN } from '@shared/gebetsabend/einstellungen';
import { neuerZugang } from '@shared/gebetsabend/zugang';
import { ApiError } from '@ui/ct/fehler';
import { ladeEinstellungen, ladeZugang } from './lesen';

vi.mock('@shared/gebetsabend/ablage', async (orig) => ({
  ...(await orig<typeof import('@shared/gebetsabend/ablage')>()),
  zugangLesen: vi.fn(),
  einstellungenLesen: vi.fn(),
}));
const zugang = vi.mocked(A.zugangLesen);
const einstellungen = vi.mocked(A.einstellungenLesen);

describe('lesen (Zuhörer-Seite)', () => {
  it('liefert den gespeicherten Zugang bzw. die Einstellungen', async () => {
    const z = neuerZugang(true, '2026-11-12T18:30:00.000Z');
    zugang.mockResolvedValue({ ok: true, stand: { version: 2, inhalt: z } });
    einstellungen.mockResolvedValue({
      ok: true,
      stand: { version: null, inhalt: STANDARD_EINSTELLUNGEN },
    });
    expect(await ladeZugang(29, 77)).toEqual(z);
    expect(await ladeEinstellungen(29, 80)).toEqual(STANDARD_EINSTELLUNGEN);
  });

  it('ein Lesefehler WIRFT – vorübergehend ist nicht „keine Übertragung“ (sonst schlösse sich der Player)', async () => {
    zugang.mockResolvedValue({ ok: false, grund: 'voruebergehend' });
    await expect(ladeZugang(29, 77)).rejects.toMatchObject({ status: 503 });
    zugang.mockResolvedValue({ ok: false, grund: 'abgemeldet' });
    await expect(ladeZugang(29, 77)).rejects.toBeInstanceOf(ApiError);
    await expect(ladeZugang(29, 77)).rejects.toMatchObject({ status: 401 });
    einstellungen.mockResolvedValue({ ok: false, grund: 'kein-recht' });
    await expect(ladeEinstellungen(29, 80)).rejects.toMatchObject({ status: 403 });
  });
});
