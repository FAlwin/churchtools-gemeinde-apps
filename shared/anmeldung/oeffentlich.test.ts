import { describe, expect, it } from 'vitest';
import { einstellungenAlsText } from './formular';
import { neueEinstellungen } from './vorlagen';
import { anmeldeLink } from './termin';
import {
  LADE_FEHLER_TEXT,
  apiBasis,
  formularAdresseAus,
  freiePlaetzeAus,
  herkunftVon,
  ladeFehlerAus,
  ortAusLink,
  veranstaltungAus,
} from './oeffentlich';

describe('ortAusLink – das Gegenstück zu anmeldeLink', () => {
  it('liest, was anmeldeLink baut (gegen den Erzeuger, nicht gegen ein Literal)', () => {
    const link = anmeldeLink(
      'https://anmeldung.beispiel.de/',
      'https://test-ecg-donrath.church.tools/',
      165,
    );
    expect(ortAusLink(new URL(link).hash)).toEqual({
      instanz: 'test-ecg-donrath.church.tools',
      gruppeId: 165,
    });
    expect(apiBasis(ortAusLink(new URL(link).hash)!)).toBe(
      'https://test-ecg-donrath.church.tools/api',
    );
  });

  it('nur Rechnername und Nummer – kein Pfad, Port, keine Zugangsdaten, kein Unsinn', () => {
    for (const falsch of [
      '',
      '#',
      '#test.church.tools',
      '#test.church.tools/',
      '#test.church.tools/0',
      '#test.church.tools/abc',
      '#test.church.tools:8080/5',
      '#user@test.church.tools/5',
      '#test.church.tools/x/5',
      '#localhost/5',
      '#javascript:alert(1)/5',
      '#evil.com%2F@test.church.tools/5',
    ])
      expect(ortAusLink(falsch), falsch).toBeNull();
    expect(ortAusLink('#Test.Church.Tools/7/')).toEqual({
      instanz: 'test.church.tools',
      gruppeId: 7,
    });
  });
});

describe('veranstaltungAus – was /publicgroups ohne Login liefert', () => {
  const note = einstellungenAlsText(neueEinstellungen('kinder'));
  it('Einstellungen aus der Beschreibung, Plätze, Warteliste, offen', () => {
    const v = veranstaltungAus({
      name: ' Kindertag ',
      information: { note, imageUrl: 'https://x.test/images/1/a' },
      maxMemberCount: 20,
      currentMemberCount: 4,
      allowWaitinglist: true,
      canSignUp: true,
    })!;
    expect(v.name).toBe('Kindertag');
    expect(v.einstellungen.wer).toBe('kinder');
    expect(v).toMatchObject({
      bildUrl: 'https://x.test/images/1/a',
      freiePlaetze: 16,
      warteliste: true,
      offen: true,
    });
  });
  it('ohne unsere Einstellungen → null; offen nur bei ausdrücklichem canSignUp', () => {
    expect(veranstaltungAus({ name: 'X', information: { note: 'Probe donnerstags' } })).toBeNull();
    expect(veranstaltungAus({ information: { note } })!.offen).toBe(false);
  });
  it('freie Plätze: ohne Grenze null, nie unter 0', () => {
    expect(freiePlaetzeAus(null, 3)).toBeNull();
    expect(freiePlaetzeAus(0, 3)).toBeNull();
    expect(freiePlaetzeAus(10, 12)).toBe(0);
    expect(freiePlaetzeAus(10, undefined)).toBe(10);
  });
});

describe('ladeFehlerAus – jeder Zweig einzeln', () => {
  it('endgültig: 401/403 nicht freigegeben, 404 nicht gefunden – ohne „Nochmal“', () => {
    expect(ladeFehlerAus(403)).toBe('nicht-freigegeben');
    expect(ladeFehlerAus(401)).toBe('nicht-freigegeben');
    expect(ladeFehlerAus(404)).toBe('nicht-gefunden');
    expect(LADE_FEHLER_TEXT['nicht-freigegeben'].nochmal).toBe(false);
  });
  it('vorübergehend: 429, 5xx, Zeitüberschreitung – mit „Nochmal“', () => {
    for (const g of [429, 500, 502, 503, 504, 'zeit'] as const)
      expect(ladeFehlerAus(g), String(g)).toBe('voruebergehend');
    expect(LADE_FEHLER_TEXT.voruebergehend.nochmal).toBe(true);
  });
  it('keine Antwort (Netz weg oder Herkunft nicht erlaubt) – mit „Nochmal“ und Hinweis an die Gemeinde', () => {
    expect(ladeFehlerAus('netz')).toBe('keine-verbindung');
    expect(LADE_FEHLER_TEXT['keine-verbindung'].text).toMatch(/Gemeinde Bescheid/);
  });
});

describe('formularAdresseAus – die Adresse der Formular-Seite der Gemeinde', () => {
  it('ergänzt https:// und den Schrägstrich; mit Pfad erlaubt', () => {
    expect(formularAdresseAus('anmeldung.ecg-donrath.de')).toBe(
      'https://anmeldung.ecg-donrath.de/',
    );
    expect(formularAdresseAus(' https://www.beispiel.de/anmeldung ')).toBe(
      'https://www.beispiel.de/anmeldung/',
    );
    expect(herkunftVon('https://www.beispiel.de/anmeldung/')).toBe('https://www.beispiel.de');
  });
  it('kein https, Zugangsdaten, ?, #, kein Punkt, leer → null', () => {
    for (const x of [
      '',
      'http://anmeldung.beispiel.de',
      'https://user:pw@anmeldung.beispiel.de',
      'https://anmeldung.beispiel.de/?x=1',
      'https://anmeldung.beispiel.de/#a',
      'localhost',
      'javascript:alert(1)',
    ])
      expect(formularAdresseAus(x), x).toBeNull();
  });
});
