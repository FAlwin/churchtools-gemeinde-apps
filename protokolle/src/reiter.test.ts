import { describe, expect, it } from 'vitest';
import { adresseFuerSitzung, sitzungAusAdresse, sitzungsLink } from './reiter';

describe('Direkt zu einer Sitzung (S6-2)', () => {
  it('hin und zurück – auch mit Zeichen, die in einer Adresse kodiert werden', () => {
    for (const sitzung of ['0b7c1e2a-9f3d-4c55-8a10-2f6e1d9c3b44', 's 1/ä']) {
      expect(sitzungAusAdresse(adresseFuerSitzung(194, sitzung))).toEqual({ gruppe: 194, sitzung });
    }
  });

  it('andere Adressen sind kein Direktlink', () => {
    for (const hash of [
      '',
      '#/sitzungen',
      '#/sitzungen/194',
      '#/sitzungen/x/s1',
      '#/todos/1/s1',
      '#/sitzungen/1/%E0%A4%A',
    ])
      expect(sitzungAusAdresse(hash)).toBeNull();
  });

  it('volle Adresse: Instanz + Seite der Erweiterung + Sitzung', () => {
    expect(sitzungsLink('https://ct.test/', 'protokolle', 194, 's1')).toBe(
      'https://ct.test/ccm/protokolle/#/sitzungen/194/s1',
    );
  });
});
