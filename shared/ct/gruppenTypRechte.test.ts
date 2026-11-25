import { describe, expect, it } from 'vitest';
import { gruppenTypenAnlegen } from './gruppenTypRechte';

/** Recht „Gruppen anlegen“ (W15-5): `churchdb` → `create groups of grouptype` = Gruppentyp-IDs, gemessen 25.11.2026. */
describe('gruppenTypenAnlegen', () => {
  it('liest die Gruppentyp-IDs – Zahlen und Zahlentexte', () => {
    expect([
      ...gruppenTypenAnlegen({ churchdb: { 'create groups of grouptype': [1, '5'] } }),
    ]).toEqual([1, 5]);
  });

  it('gilt je Typ: ein Typ in der Liste, der andere nicht', () => {
    const t = gruppenTypenAnlegen({ churchdb: { 'create groups of grouptype': [1] } });
    expect(t.has(1)).toBe(true);
    expect(t.has(5)).toBe(false);
  });

  it('fehlt der Eintrag, ist er leer oder hat er eine andere Form: keine Typen (kein Reiter)', () => {
    for (const roh of [
      null,
      undefined,
      {},
      { churchdb: {} },
      { churchdb: { 'create groups of grouptype': [] } },
      { churchdb: { 'create groups of grouptype': true } },
      { churchdb: { 'create groups of grouptype': false } },
      { churchdb: { 'create groups of grouptype': [null] } },
      { churchservice: { 'create groups of grouptype': [1] } },
    ])
      expect(gruppenTypenAnlegen(roh).size).toBe(0);
  });
});
