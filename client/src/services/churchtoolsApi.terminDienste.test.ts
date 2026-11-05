import { describe, expect, it, vi } from 'vitest';
import { getTerminDienste } from './churchtoolsApi';

/** Die Dienste eines Termins (E8-1b) gibt es nur in ChurchTools – auf dem eigenen Server `null`, ohne Abfrage. */
describe('getTerminDienste auf dem eigenen Server', () => {
  it('liefert null und fragt nichts ab', async () => {
    const abruf = vi.spyOn(globalThis, 'fetch');
    await expect(getTerminDienste(3)).resolves.toBeNull();
    expect(abruf).not.toHaveBeenCalled();
  });
});
