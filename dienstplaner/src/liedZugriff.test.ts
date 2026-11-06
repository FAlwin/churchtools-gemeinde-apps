import { describe, it, expect } from 'vitest';
import * as ct from '@ui/ct/lieder';
import { dienstplanerLiedZugriff } from './liedZugriff';

/** Der Liedzugriff des Dienstplaners (LW2b, 06.11.2026): gemeinsame Wege, eigene Rechte, kein Logo, seitenweise. */
describe('dienstplanerLiedZugriff', () => {
  const rechte = { statistik: false, ccli: true, liederAendern: true };

  it('reicht die Lied-Rechte aus dem Start weiter – und nichts, solange es keine gibt', () => {
    expect(dienstplanerLiedZugriff(rechte).useRechte()).toBe(rechte);
    expect(dienstplanerLiedZugriff(undefined).useRechte()).toBeUndefined();
  });

  it('seitenweise, ohne Logo, ohne eigenes Nachladen', () => {
    const z = dienstplanerLiedZugriff(rechte);
    expect(z.liedansicht()).toBe('blaettern');
    expect(z.useBlattLogo()).toBeNull();
    expect(() => z.nachAenderung({} as never, { art: 'lied', songId: 1 })).not.toThrow();
  });

  it('spricht ChurchTools über die gemeinsamen Lied-Wege an', () => {
    const z = dienstplanerLiedZugriff(rechte);
    expect(z.liederliste).toBe(ct.lieder);
    expect(z.liedAnlegen).toBe(ct.liedNeu);
    expect(z.liedtextSuche).toBeUndefined();
  });
});
