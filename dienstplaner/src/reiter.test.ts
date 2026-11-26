import { describe, expect, it } from 'vitest';
import {
  abwesenheitenAbfrageAusAdresse,
  adresseFuerAbwesenheitenAbfrage,
  ADRESSE_VORLAGEN,
  adresseFuer,
  adresseFuerPlanenGruppe,
  adresseFuerTermin,
  adresseFuerVorlage,
  planenGruppeAusAdresse,
  reiterAusAdresse,
  sichtbareReiter,
  terminAusAdresse,
  adresseFuerLive,
  liveAusAdresse,
  vorlagenAusAdresse,
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

  it('#/termin/<id>/live: derselbe Termin, mit gleich geöffneter Live-Ansicht (Knopf „Live“ auf der Startseite)', () => {
    expect(terminAusAdresse(adresseFuerLive(148))).toBe(148);
    expect(liveAusAdresse(adresseFuerLive(148))).toBe(true);
    expect(liveAusAdresse(adresseFuerTermin(148))).toBe(false);
    for (const h of ['', '#/termin/148/lives', '#/termin//live', '#/termine/148/live']) {
      expect(liveAusAdresse(h)).toBe(false);
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

describe('Adressen der Ablaufvorlagen (E10-V3a)', () => {
  it('#/vorlagen ist die Liste, #/vorlage/<id> eine Vorlage, alles andere keine Vorlagen-Adresse', () => {
    expect(vorlagenAusAdresse('#/vorlagen')).toEqual({ id: null });
    expect(vorlagenAusAdresse('#/vorlage/5')).toEqual({ id: 5 });
    for (const x of ['', '#/planen', '#/vorlage/', '#/vorlage/x', '#/vorlagen/5', '#/termin/5']) {
      expect(vorlagenAusAdresse(x)).toBeNull();
    }
  });

  it('hin und zurück gleich', () => {
    expect(vorlagenAusAdresse(ADRESSE_VORLAGEN)).toEqual({ id: null });
    expect(vorlagenAusAdresse(adresseFuerVorlage(42))).toEqual({ id: 42 });
  });

  it('der Reiter „Planen“ bleibt markiert – nur für den, der „Planen“ sieht', () => {
    expect(reiterAusAdresse('#/vorlagen', sichtbareReiter(true))).toBe('planen');
    expect(reiterAusAdresse('#/vorlage/5', sichtbareReiter(true))).toBe('planen');
    expect(reiterAusAdresse('#/vorlagen', sichtbareReiter(false))).toBe('start');
  });
});

describe('Adresse „Verfügbarkeit“ mit einer Abfrage (R-3)', () => {
  it('#/abwesenheiten?abfrage=<id> → Dienstgruppe und Reiter „Verfügbarkeit“; hin und zurück gleich', () => {
    expect(abwesenheitenAbfrageAusAdresse(adresseFuerAbwesenheitenAbfrage(4))).toBe(4);
    expect(adresseFuerAbwesenheitenAbfrage(4)).toBe('#/abwesenheiten?abfrage=4');
    expect(reiterAusAdresse('#/abwesenheiten?abfrage=4', sichtbareReiter(false))).toBe(
      'abwesenheiten',
    );
    expect(reiterAusAdresse('#/abwesenheiten?abfrage=4', sichtbareReiter(true))).toBe(
      'abwesenheiten',
    );
  });

  it('ohne oder mit kaputtem Anhang ist es die Seite wie immer', () => {
    for (const h of [
      '',
      '#/abwesenheiten',
      '#/abwesenheiten?abfrage=',
      '#/abwesenheiten?abfrage=x',
      '#/abwesenheiten?abfrage=4&x=1',
      '#/termine?abfrage=4',
    ]) {
      expect(abwesenheitenAbfrageAusAdresse(h)).toBeNull();
    }
    expect(reiterAusAdresse('#/abwesenheiten', sichtbareReiter(true))).toBe('abwesenheiten');
    // Eine fremde Adresse mit Anhang ist keine Abwesenheiten-Adresse.
    expect(reiterAusAdresse('#/termine?abfrage=4', sichtbareReiter(true))).toBe('start');
  });
});
