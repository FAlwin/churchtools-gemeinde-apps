import { describe, expect, it } from 'vitest';
import { einstellungenAlsText } from './formular';
import { neueEinstellungen } from './vorlagen';
import { anmeldeLink } from './termin';
import {
  LADE_FEHLER_TEXT,
  apiBasis,
  formularAdresseAus,
  abmeldeDatenAus,
  abmeldeOrtAusLink,
  abmeldeVorlage,
  freiePlaetzeAus,
  platzPlan,
  platzStandAus,
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
      'http://localhost.beispiel.de',
      'javascript:alert(1)',
    ])
      expect(formularAdresseAus(x), x).toBeNull();
  });
  it('zum Testen: http://localhost mit Port (nur mit ausdrücklichem http://)', () => {
    expect(formularAdresseAus('http://localhost:5177')).toBe('http://localhost:5177/');
    expect(formularAdresseAus('http://127.0.0.1:5177/')).toBe('http://127.0.0.1:5177/');
    expect(herkunftVon('http://localhost:5177/')).toBe('http://localhost:5177');
  });
});

describe('„Deine Anmeldung“ (A6-4) – Link aus der Mail', () => {
  it('liest, was abmeldeVorlage baut, nachdem ChurchTools $groupId und $token ersetzt hat (gegen den Erzeuger)', () => {
    const vorlage = abmeldeVorlage(
      'https://anmeldung.beispiel.de/',
      'test-ecg-donrath.church.tools',
    );
    expect(vorlage).toBe(
      'https://anmeldung.beispiel.de/#test-ecg-donrath.church.tools/$groupId/abmelden/$token',
    );
    const link = vorlage.replace('$groupId', '165').replace('$token', 'ltmB5wFTNw2N8Izw1bJ3');
    expect(abmeldeOrtAusLink(new URL(link).hash)).toEqual({
      instanz: 'test-ecg-donrath.church.tools',
      gruppeId: 165,
      token: 'ltmB5wFTNw2N8Izw1bJ3',
    });
    // Ein alter `#…` an der Basis fliegt raus; der Anmeldelink ist KEIN Abmeldelink und umgekehrt.
    expect(abmeldeVorlage('https://a.de/#x/1', 'i.de')).toBe(
      'https://a.de/#i.de/$groupId/abmelden/$token',
    );
    expect(abmeldeOrtAusLink('#test.church.tools/165')).toBeNull();
    expect(ortAusLink('#test.church.tools/165/abmelden/ltmB5wFTNw2N8Izw1bJ3')).toBeNull();
  });

  it('kaputte Links → null (falscher Token, kein Rechnername, Gruppe 0)', () => {
    for (const h of [
      '#test.church.tools/165/abmelden/kurz',
      '#test.church.tools/165/abmelden/mit leer zeichen',
      '#localhost/165/abmelden/ltmB5wFTNw2N8Izw1bJ3',
      '#test.church.tools/0/abmelden/ltmB5wFTNw2N8Izw1bJ3',
    ])
      expect(abmeldeOrtAusLink(h), h).toBeNull();
  });

  it('liest signoutdata so, wie ChurchTools es am 16.10.2026 geliefert hat', () => {
    const d = abmeldeDatenAus({
      data: {
        token: 'ltmB5wFTNw2N8Izw1bJ3',
        requester: {
          title: 'Kalle Testkind A6g',
          domainIdentifier: '84',
          domainAttributes: { firstName: 'Kalle', lastName: 'Testkind A6g' },
        },
        requesterEmail: 'friesen.alwin+a6g@ecg-donrath.de',
        group: { title: 'TEST A5 Baukasten', domainIdentifier: '165' },
        selfSignOutPersons: [{ title: 'Kalle Testkind A6g', domainIdentifier: '84' }, { foo: 1 }],
        leaderSignOutPersons: [],
        groupHasAutoAccept: true,
      },
    });
    expect(d).toEqual({
      veranstaltung: 'TEST A5 Baukasten',
      anmelder: 'Kalle Testkind A6g',
      nachname: 'Testkind A6g',
      mail: 'friesen.alwin+a6g@ecg-donrath.de',
      personen: [{ id: 84, name: 'Kalle Testkind A6g' }],
    });
    expect(abmeldeDatenAus({})).toBeNull();
    expect(abmeldeDatenAus({ data: { requester: null } })).toEqual({
      veranstaltung: '',
      anmelder: '',
      nachname: '',
      mail: '',
      personen: [],
    });
  });
});

describe('platzPlan (#602) – wer bekommt einen Platz, wer die Warteliste', () => {
  it('in Formular-Reihenfolge: erst die freien Plätze, dann Warteliste oder nichts', () => {
    expect(platzPlan({ freiePlaetze: 1, warteliste: true }, 3)).toEqual([
      'platz',
      'warteliste',
      'warteliste',
    ]);
    expect(platzPlan({ freiePlaetze: 1, warteliste: false }, 2)).toEqual(['platz', 'kein']);
    expect(platzPlan({ freiePlaetze: 0, warteliste: true }, 1)).toEqual(['warteliste']);
  });
  it('ohne Platzgrenze bekommt jeder einen Platz', () => {
    expect(platzPlan({ freiePlaetze: null, warteliste: false }, 4)).toEqual([
      'platz',
      'platz',
      'platz',
      'platz',
    ]);
  });
});

describe('platzStandAus (#619) – wer wartet, kommt zuerst', () => {
  it('wartet jemand, gibt es für Gäste keinen freien Platz – auch wenn die Grenze höher liegt', () => {
    expect(
      platzStandAus({
        maxMemberCount: 12,
        currentMemberCount: 10,
        allowWaitinglist: true,
        requestedWaitinglistSeatsCount: 1,
      }),
    ).toEqual({ freiePlaetze: 0, warteliste: true });
  });
  it('niemand wartet → freie Plätze wie gehabt; ohne Grenze bleibt es unbegrenzt', () => {
    expect(
      platzStandAus({
        maxMemberCount: 12,
        currentMemberCount: 10,
        requestedWaitinglistSeatsCount: 0,
      }).freiePlaetze,
    ).toBe(2);
    expect(
      platzStandAus({
        maxMemberCount: null,
        currentMemberCount: 10,
        requestedWaitinglistSeatsCount: 3,
      }).freiePlaetze,
    ).toBeNull();
  });
});
