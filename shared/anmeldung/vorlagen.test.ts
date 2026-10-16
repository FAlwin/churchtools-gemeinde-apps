import { describe, expect, it } from 'vitest';
import { einstellungenAlsText, einstellungenLesen, geburtsdatumAn } from './formular';
import { neueEinstellungen, VORLAGEN } from './vorlagen';
import { STANDARD_BEZAHLUNG } from './bezahlung';

describe('Vorlagen (A3, #486)', () => {
  it('jede Vorlage ergibt gültige Einstellungen, die die Beschreibung hin und zurück überstehen', () => {
    for (const v of VORLAGEN) {
      const e = neueEinstellungen(v.id);
      expect(einstellungenLesen(einstellungenAlsText(e))).toEqual(e);
    }
  });
  it('Kinder: Kinder melden sich an, Geburtsdatum Pflicht; einfach: Familien, ohne Geburtsdatum', () => {
    expect(neueEinstellungen('kinder').wer).toBe('kinder');
    expect(geburtsdatumAn(neueEinstellungen('kinder').formular)).toBe(true);
    expect(geburtsdatumAn(neueEinstellungen('freizeit').formular)).toBe(true);
    expect(neueEinstellungen('einfach').wer).toBe('familie');
    expect(geburtsdatumAn(neueEinstellungen('einfach').formular)).toBe(false);
  });
  it('Kinder (A6-2b): Erziehungsberechtigte und Unterschrift als Pflicht, je Anmeldung, eingeordnet wie im Baukasten', () => {
    const ids = neueEinstellungen('kinder').formular.anmeldung.map((f) => f.id);
    // Dieselbe Regel wie beim Antippen einer Kachel: vor die Bemerkungen, die den Bereich abschließen.
    expect(ids.slice(-5)).toEqual(['eltern', 'sign', 'note', 'price', 'priv']);
    for (const f of neueEinstellungen('kinder').formular.anmeldung.filter((x) =>
      ['eltern', 'sign'].includes(x.id),
    ))
      expect(f.zustand).toBe('pflicht');
    for (const v of ['einfach', 'freizeit'] as const)
      expect(neueEinstellungen(v).formular.anmeldung.some((f) => f.id === 'eltern')).toBe(false);
  });
  it('Start: ohne Termin, kostenlos, Löschfrist 3 Monate', () => {
    const e = neueEinstellungen('einfach');
    expect(e.termin).toBeNull();
    expect(e.preis.grundpreis.betragCent).toBe(0);
    expect(e.loeschfristMonate).toBe(3);
    expect(e.bezahlung).toEqual(STANDARD_BEZAHLUNG);
  });
  it('jede neue Veranstaltung hat ihre eigene Bezahlung (kein geteiltes Objekt)', () => {
    const a = neueEinstellungen('einfach');
    a.bezahlung.iban = 'DE89370400440532013000';
    expect(neueEinstellungen('einfach').bezahlung.iban).toBe('');
    expect(STANDARD_BEZAHLUNG.iban).toBe('');
  });
});
