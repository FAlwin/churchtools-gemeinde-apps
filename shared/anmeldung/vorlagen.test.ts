import { describe, expect, it } from 'vitest';
import { einstellungenAlsText, einstellungenLesen, geburtsdatumAn } from './formular';
import { neueEinstellungen, VORLAGEN } from './vorlagen';

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
  it('Start: ohne Termin, kostenlos, Löschfrist 3 Monate', () => {
    const e = neueEinstellungen('einfach');
    expect(e.termin).toBeNull();
    expect(e.preis.grundpreis.betragCent).toBe(0);
    expect(e.loeschfristMonate).toBe(3);
  });
});
