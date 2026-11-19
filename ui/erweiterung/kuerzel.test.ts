import { describe, expect, it } from 'vitest';
import { erweiterungsLink, kuerzelAusBasis } from './kuerzel';

describe('kuerzelAusBasis', () => {
  it('liest das Kürzel aus /ccm/<Kürzel>/ – sonst null', () => {
    expect(kuerzelAusBasis('/ccm/dienstplaner/')).toBe('dienstplaner');
    expect(kuerzelAusBasis('/ccm/musik%20app/')).toBe('musik app');
    expect(kuerzelAusBasis('/')).toBeNull();
    expect(kuerzelAusBasis('/ccm/dienstplaner')).toBeNull();
    expect(kuerzelAusBasis('/ccm/a/b/')).toBeNull();
  });
});

describe('erweiterungsLink', () => {
  it('Instanz + /ccm/<Kürzel>/ + Adresse – Schrägstrich am Ende der Instanz und Sonderzeichen im Kürzel stören nicht', () => {
    expect(erweiterungsLink('https://ct.test', 'dienstplaner', '#/abwesenheiten')).toBe(
      'https://ct.test/ccm/dienstplaner/#/abwesenheiten',
    );
    expect(erweiterungsLink('https://ct.test///', 'musik app')).toBe(
      'https://ct.test/ccm/musik%20app/',
    );
  });

  it('das Kürzel aus der Bau-Adresse und der Link ergeben zusammen wieder die Bau-Adresse', () => {
    expect(erweiterungsLink('', kuerzelAusBasis('/ccm/protokolle/') ?? '')).toBe(
      '/ccm/protokolle/',
    );
  });
});
