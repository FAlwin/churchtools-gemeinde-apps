import { describe, expect, it } from 'vitest';
import {
  adresseFuer,
  adresseFuerPlanenGruppe,
  adresseFuerTermin,
  planenGruppeAusAdresse,
  reiterAusAdresse,
  sichtbareReiter,
  terminAusAdresse,
} from './reiter';

describe('Reiter des Dienstplaners', () => {
  it('„Planen“ nur mit Planer-Recht, die übrigen immer – in der Reihenfolge des Entwurfs', () => {
    expect(sichtbareReiter(true).map((r) => r.id)).toEqual([
      'start',
      'termine',
      'planen',
      'abwesenheiten',
    ]);
    expect(sichtbareReiter(false).map((r) => r.id)).toEqual(['start', 'termine', 'abwesenheiten']);
  });

  it('Adresse → Reiter; unbekannt oder ohne Recht → Start', () => {
    expect(reiterAusAdresse('#/termine', sichtbareReiter(false))).toBe('termine');
    expect(reiterAusAdresse('#/planen', sichtbareReiter(true))).toBe('planen');
    expect(reiterAusAdresse('#/planen', sichtbareReiter(false))).toBe('start');
    expect(reiterAusAdresse('#/quatsch', sichtbareReiter(true))).toBe('start');
    expect(reiterAusAdresse('', sichtbareReiter(true))).toBe('start');
  });

  it('Start hat keine eigene Adresse, die anderen #/<id> – hin und zurück gleich', () => {
    expect(adresseFuer('start')).toBe('');
    for (const r of sichtbareReiter(true)) {
      expect(reiterAusAdresse(adresseFuer(r.id) || '#/', sichtbareReiter(true))).toBe(r.id);
    }
  });
});

describe('Adresse der Termin-Ansicht (E6-1b)', () => {
  it('#/termin/<id> → Termin, alles andere → keiner; hin und zurück gleich', () => {
    expect(terminAusAdresse('#/termin/148')).toBe(148);
    expect(terminAusAdresse(adresseFuerTermin(7))).toBe(7);
    for (const h of ['', '#/termine', '#/termin/', '#/termin/abc', '#/termin/148/x']) {
      expect(terminAusAdresse(h)).toBeNull();
    }
  });
});

describe('Adresse „Planen mit einer Gruppe“ (Wunsch 7)', () => {
  it('#/planen/gruppe/<id> → Gruppe und Reiter Planen; hin und zurück gleich', () => {
    expect(planenGruppeAusAdresse(adresseFuerPlanenGruppe(3))).toBe(3);
    expect(reiterAusAdresse('#/planen/gruppe/3', sichtbareReiter(true))).toBe('planen');
    for (const h of [
      '',
      '#/planen',
      '#/planen/gruppe/',
      '#/planen/gruppe/x',
      '#/planen/gruppe/3/x',
    ]) {
      expect(planenGruppeAusAdresse(h)).toBeNull();
    }
  });

  it('ohne Planen-Recht führt die Adresse zum Start – wie jede unbekannte', () => {
    expect(reiterAusAdresse('#/planen/gruppe/3', sichtbareReiter(false))).toBe('start');
  });
});
