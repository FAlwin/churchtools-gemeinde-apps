import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as V from '@ui/ct/verbindung';
import * as E from './einrichten';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';
import { betragAendern, betragWiederherstellen, zahlungSpeichern } from './zahlung';

/**
 * Zahlung schreiben (A7-2) gegen ein nachgestelltes Mitglied: PATCH ändert nur die geschickten Felder (gemessen
 * 19.10.2026), danach wird nachgelesen – was nicht dasteht, ist ein Fehler, kein „gespeichert“.
 */
vi.mock('@ui/ct/verbindung', () => ({ ctAnfrage: vi.fn(), ctDaten: vi.fn() }));
vi.mock('./einrichten', async (original) => ({
  ...(await original<typeof import('./einrichten')>()),
  einstellungenVon: vi.fn(),
  systemfelderNachziehen: vi.fn(),
}));
const ct = vi.mocked(V);
const ei = vi.mocked(E);

const FELDER = { betrag: 504, aufschluesselung: 507, bezahlt: 516, bezahltAm: 519 };
function einstellungen(mitZahlart = true) {
  const e = neueEinstellungen('kinder');
  e.ctFelder = { ...FELDER, ...(mitZahlart ? { zahlart: 520 } : {}) };
  return e;
}

/** Das Mitglied in ChurchTools; `schlucken`: ChurchTools antwortet 200, übernimmt aber nichts. */
let felder: Map<number, unknown>;
let schlucken = false;
beforeEach(() => {
  felder = new Map([
    [504, '12,00 €'],
    [507, 'Gesamt: 12,00 €'],
    [516, '0'],
    [519, null],
    [520, null],
  ]);
  schlucken = false;
  ct.ctAnfrage.mockImplementation(async (_pfad: string, init?: RequestInit) => {
    if (schlucken) return null;
    const { fields } = JSON.parse(String(init?.body)) as { fields: Record<string, unknown> };
    for (const [id, w] of Object.entries(fields))
      felder.set(Number(id), typeof w === 'boolean' ? (w ? '1' : '0') : w);
    return null;
  });
  ct.ctDaten.mockImplementation(async () => ({
    fields: [...felder].map(([id, value]) => ({ id, value })),
  }));
  ei.einstellungenVon.mockResolvedValue(einstellungen());
});

describe('zahlungSpeichern', () => {
  it('bezahlt: Häkchen, Tag und Zahlart in einem PATCH bei der ersten Person', async () => {
    await zahlungSpeichern(165, 129, { bezahlt: true, am: '2026-10-19', zahlart: 'Bar' });
    expect(ct.ctAnfrage).toHaveBeenCalledWith('/groups/165/members/129', {
      method: 'PATCH',
      body: JSON.stringify({ fields: { 516: true, 519: '2026-10-19', 520: 'Bar' } }),
    });
    expect([felder.get(516), felder.get(519), felder.get(520)]).toEqual(['1', '2026-10-19', 'Bar']);
  });

  it('zurücksetzen leert Tag und Zahlart', async () => {
    await zahlungSpeichern(165, 129, { bezahlt: true, am: '2026-10-19', zahlart: 'Bar' });
    await zahlungSpeichern(165, 129, { bezahlt: false, am: null, zahlart: null });
    expect([felder.get(516), felder.get(519), felder.get(520)]).toEqual(['0', null, null]);
  });

  it('ChurchTools übernimmt nichts → Fehler statt „gespeichert“', async () => {
    schlucken = true;
    await expect(
      zahlungSpeichern(165, 129, { bezahlt: true, am: '2026-10-19', zahlart: 'Bar' }),
    ).rejects.toThrow(/nicht übernommen/);
  });

  it('ältere Veranstaltung ohne Feld „Zahlart“ → erst nachziehen, dann schreiben', async () => {
    ei.einstellungenVon.mockResolvedValue(einstellungen(false));
    ei.systemfelderNachziehen.mockResolvedValue(einstellungen(true));
    await zahlungSpeichern(165, 129, { bezahlt: true, am: '2026-10-19', zahlart: 'PayPal' });
    expect(ei.systemfelderNachziehen).toHaveBeenCalledWith(165);
    expect(felder.get(520)).toBe('PayPal');
  });
});

describe('Betrag von Hand', () => {
  it('neuer Betrag und eine Zeile in der Aufschlüsselung; Rückgängig schreibt beides zurück', async () => {
    await betragAendern(165, 129, 1000, 'Gesamt: 12,00 €', '2026-10-19');
    expect(felder.get(504)).toBe('10,00 €');
    expect(felder.get(507)).toBe('Gesamt: 12,00 €\nVon Hand geändert am 19.10.2026: 10,00 €');
    await betragWiederherstellen(165, 129, {
      betrag: '12,00 €',
      aufschluesselung: 'Gesamt: 12,00 €',
    });
    expect([felder.get(504), felder.get(507)]).toEqual(['12,00 €', 'Gesamt: 12,00 €']);
  });

  it('übernimmt ChurchTools den Betrag nicht → Fehler', async () => {
    schlucken = true;
    await expect(betragAendern(165, 129, 1000, null, '2026-10-19')).rejects.toThrow(
      /nicht übernommen/,
    );
  });
});
