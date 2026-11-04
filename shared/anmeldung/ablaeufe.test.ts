import { describe, expect, it } from 'vitest';
import {
  BESCHREIBUNG_MAX,
  OHNE_EIGENEN_TEXT,
  QR_CODE,
  ROUTINEN,
  ablaufMails,
  anmeldeschlussAm,
  anmeldeschlussVorLoeschen,
  eigenerTextAlsBeschreibung,
  eigenerTextAus,
  eigenerTextFehler,
  erinnerungen,
  erinnerungsTextAus,
  loeschDatum,
  routinenSchritte,
  schrittFolge,
  standardBetreff,
} from './ablaeufe';
import { bankZeilen } from './bezahlung';
import { SYSTEMFELDER } from './formular';
import { einstellungen } from './senden.testdaten';
import { neueEinstellungen } from './vorlagen';

/**
 * Bestätigungsmails (A9-1). Die Platzhalter so, wie ChurchTools sie für eine Gruppe nennt (`/placeholders/group/{id}`,
 * gemessen 24.10.2026: Feldname → `{{{groupMemberField.<kürzel>}}}`, dazu „Wartelistenplatz“). Die Feldnamen kommen
 * aus `SYSTEMFELDER` – so heißen die Felder, die die Erweiterung anlegt.
 */
const kuerzel = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, '-')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue');
const CT = new Map<string, string>([
  ...SYSTEMFELDER.map((f): [string, string] => [
    f.name,
    `{{{groupMemberField.${kuerzel(f.name)}}}}`,
  ]),
  ['Wartelistenplatz', '{{{groupMember.waitinglistPosition}}}'],
  // Gemessen 28.10.2026: so heißt der Check-in-Code in `/placeholders/group/{id}`.
  ['Check-in-Code (QR-Code)', '{{{groupMember.checkInCodeQr}}}'],
]);
const platz = (name: string) => CT.get(name)!;
const bedingung = (name: string) => platz(name).replace(/^\{+|\}+$/g, '');

function mitKonto() {
  const e = einstellungen();
  e.bezahlung = {
    ...e.bezahlung,
    kontoinhaber: 'Gemeinde e.V.',
    iban: 'DE89370400440532013000',
    bic: '',
    fristTage: 14,
    zweck: 'Kinderfreizeit [Nachname]',
  };
  return e;
}

describe('ablaufMails – Bestätigung (Platz)', () => {
  it('alle Platzhalter bekannt; nichts Lesbares in eckigen Klammern bleibt stehen', () => {
    const m = ablaufMails(mitKonto(), 'Kinderfreizeit', CT);
    expect(m.unbekannt).toEqual([]);
    expect(m.platz.html).not.toMatch(/\[[^\]]+\]/);
    expect(m.warte.html).not.toMatch(/\[[^\]]+\]/);
    expect(m.platz.betreff).toBe('Kinderfreizeit: Anmeldung bestätigt');
    expect(m.warte.betreff).toBe('Kinderfreizeit: Warteliste');
  });

  it('Anrede an den Kontakt, nur wenn das Feld gefüllt ist (es steht nur bei der ersten Person)', () => {
    const { html } = ablaufMails(mitKonto(), 'Kinderfreizeit', CT).platz;
    expect(html).toContain(
      `{{#if ${bedingung('Angemeldet von')}}}<p>Hallo ${platz('Angemeldet von')},</p>{{else}}<p>Hallo,</p>{{/if}}`,
    );
    expect(html).toContain('die Anmeldung von {{person.firstName}} zu „Kinderfreizeit“');
  });

  it('Betrag und Bankdaten nur, wenn „Betrag“ gefüllt ist – Bankzeilen aus bankZeilen, Nachname je Person', () => {
    const e = mitKonto();
    const { html } = ablaufMails(e, 'Kinderfreizeit', CT).platz;
    const block = html.slice(html.indexOf(`{{#if ${bedingung('Betrag')}}}`));
    // Nur der Betrag (Alwin, 26.10.2026): Die Aufschlüsselung käme einzeilig an.
    expect(block).toContain(`<p>Betrag: ${platz('Betrag')}</p>`);
    expect(html).not.toContain(platz('Aufschlüsselung'));
    expect(block).toContain('Bitte überweise ihn innerhalb von 14 Tagen an:');
    // Gegen den Erzeuger: dieselben Zeilen wie in den übrigen Mails, `[Nachname]` = Nachname der Person.
    for (const z of bankZeilen(e.bezahlung, '{{person.lastName}}')) expect(block).toContain(z);
  });

  it('ohne Konto: Hinweis statt Bankdaten; ohne Frist kein „innerhalb von“', () => {
    const e = einstellungen();
    expect(ablaufMails(e, 'X', CT).platz.html).toContain('Wie ihr bezahlt, sagen wir euch noch.');
    const ohneFrist = mitKonto();
    ohneFrist.bezahlung.fristTage = 0;
    expect(ablaufMails(ohneFrist, 'X', CT).platz.html).toContain('Bitte überweise ihn an:');
  });

  it('kostenlos: weder Betrag noch Bankdaten', () => {
    const e = neueEinstellungen('einfach');
    const { platz: p, warte } = ablaufMails(e, 'Gemeindeessen', CT);
    expect(p.html).not.toContain('Betrag');
    expect(warte.html).toContain('Wird ein Platz frei, bekommt ihr eine Mail.</p>');
  });

  it('Link zu „Deine Anmeldung“ nur, wenn das Feld gefüllt ist (Anmeldungen durchs Team haben keinen)', () => {
    const { platz: p, warte } = ablaufMails(mitKonto(), 'X', CT);
    const link = platz('Link zur Anmeldung');
    expect(p.html).toContain(
      `{{#if ${bedingung('Link zur Anmeldung')}}}<p>Deine Anmeldung ansehen oder absagen:<br><a href="${link}">${link}</a></p>{{/if}}`,
    );
    expect(warte.html).toContain('Deine Anmeldung ansehen oder zurückziehen:');
  });

  it('Warteliste: Platz auf der Warteliste, bezahlt wird erst beim Nachrücken', () => {
    const { html } = ablaufMails(mitKonto(), 'X', CT).warte;
    expect(html).toContain(`steht auf Platz ${platz('Wartelistenplatz')} der Warteliste`);
    expect(html).toContain('erst dann ist etwas zu bezahlen');
    expect(html).not.toContain(platz('Betrag'));
  });

  it('Name, Termin, Kontakt bleiben Text – auch mit [Klammern], {{…}} oder <Zeichen>', () => {
    const e = mitKonto();
    e.kontakt = 'Anna <anna@x.de>';
    e.bezahlung.zweck = 'Freizeit {{x}} [Nachname]';
    const m = ablaufMails(e, 'Freizeit [Jugend] {{böse}}', CT);
    expect(m.unbekannt).toEqual([]);
    expect(m.platz.html).toContain('„Freizeit [Jugend] &#123;&#123;böse}}“');
    expect(m.platz.html).toContain('Bei Fragen: Anna &lt;anna@x.de&gt;');
    expect(m.platz.html).toContain(
      'Verwendungszweck: Freizeit &#123;&#123;x}} {{person.lastName}}',
    );
    expect(m.platz.html).not.toContain('{{böse');
  });

  it('fehlt ChurchTools ein Feld, steht es in „unbekannt“ – dann wird nichts geschrieben', () => {
    const ohne = new Map(CT);
    ohne.delete('Link zur Anmeldung');
    ohne.delete('Betrag');
    expect(ablaufMails(mitKonto(), 'X', ohne).unbekannt.sort()).toEqual(
      ['Betrag', 'Link zur Anmeldung'].sort(),
    );
  });

  it('langer Name: Betreff höchstens 200 Zeichen (Grenze der Schnittstelle)', () => {
    const m = ablaufMails(mitKonto(), 'x'.repeat(300), CT);
    expect(m.platz.betreff).toHaveLength(200);
  });
});

describe('routinenSchritte', () => {
  const mail = { betreff: 'B', html: '<p>H</p>' };
  it('eine Mail, ohne Abmeldelink von ChurchTools, mit Absender', () => {
    expect(routinenSchritte(mail, 7)).toEqual([
      {
        actionKey: 'send-member-email',
        isEnabled: true,
        actionData: { subject: 'B', body: '<p>H</p>', addSignOutUrl: false, senderId: 7 },
      },
    ]);
  });
  it('vorhandene Schritte behalten ihre Nummer – nach ihrer Stellung (laufende Abläufe bleiben an ihrer Stelle)', () => {
    const s = routinenSchritte(
      mail,
      7,
      [
        { id: 30, actionKey: 'send-member-email' },
        { id: 33, actionKey: 'special:wait' },
        { id: 36, actionKey: 'remove-member' },
      ],
      '2027-02-20',
    );
    expect(s.map((x) => x.id)).toEqual([30, 33, 36]);
  });
  it('zwei Routinen: Platz (aktiv) und Warteliste (wartend), eindeutige Namen', () => {
    expect(ROUTINEN.map((r) => r.status)).toEqual(['active', 'waiting']);
    expect(new Set(ROUTINEN.map((r) => r.name)).size).toBe(2);
  });
});

describe('Eigener Text (A9-2a)', () => {
  const eigen = {
    betreff: 'Freizeit: Du bist dabei!',
    absatz: 'Bitte mitbringen:\nSchlafsack, Bibel\n\nAbfahrt 16 Uhr.',
    gruss: 'Liebe Grüße\nAnna',
  };

  it('Beschreibung: hin und zurück gleich; leer → keine Beschreibung', () => {
    const b = eigenerTextAlsBeschreibung(eigen)!;
    expect(eigenerTextAus(b)).toEqual(eigen);
    expect(eigenerTextAlsBeschreibung({ betreff: ' ', absatz: '', gruss: '\n' })).toBeNull();
    // ChurchTools schneidet Leerzeichen am Ende ab (gemessen) – das JSON endet auf „}“, nichts geht verloren.
    expect(b.endsWith('}')).toBe(true);
  });

  it('fremde oder kaputte Beschreibung (z. B. von Hand in ChurchTools) zählt als kein eigener Text', () => {
    expect(eigenerTextAus('Bitte nicht ändern')).toEqual(OHNE_EIGENEN_TEXT);
    expect(eigenerTextAus('{"v":2,"absatz":"x"}')).toEqual(OHNE_EIGENEN_TEXT);
    expect(eigenerTextAus(null)).toEqual(OHNE_EIGENEN_TEXT);
  });

  it('Grenze: was ChurchTools speichern muss, höchstens 1.000 Zeichen – gezählt nach dem Verpacken', () => {
    expect(eigenerTextFehler(eigen)).toBeNull();
    // Zeilenumbrüche und Anführungszeichen zählen verpackt doppelt.
    const lang = { ...eigen, absatz: '"\n'.repeat(330) };
    expect(eigenerTextAlsBeschreibung(lang)!.length).toBeGreaterThan(BESCHREIBUNG_MAX);
    expect(eigenerTextFehler(lang)).toMatch(/zu lang \(\d+ Zeichen zu viel\)/);
    expect(eigenerTextFehler({ ...eigen, betreff: 'x'.repeat(201) })).toMatch(/Betreff/);
  });

  it('in der Mail: eigener Betreff, Absätze nach dem festen Teil und vor dem Link, eigener Gruß nach „Bei Fragen“', () => {
    const e = mitKonto();
    e.kontakt = 'anna@x.de';
    const m = ablaufMails(e, 'Freizeit', CT, { platz: eigen, warte: OHNE_EIGENEN_TEXT });
    expect(m.platz.betreff).toBe('Freizeit: Du bist dabei!');
    expect(m.platz.html).toContain(
      '<p>Bitte mitbringen:<br>Schlafsack, Bibel</p><p>Abfahrt 16 Uhr.</p>',
    );
    const i = (s: string) => m.platz.html.indexOf(s);
    expect(i('Bitte überweise')).toBeLessThan(i('Bitte mitbringen'));
    expect(i('Bitte mitbringen')).toBeLessThan(i('Deine Anmeldung ansehen'));
    expect(m.platz.html).toContain('<p>Bei Fragen: anna@x.de<br>Liebe Grüße<br>Anna</p>');
    // Die Warteliste bleibt beim Standard.
    expect(m.warte.betreff).toBe(standardBetreff('warte', 'Freizeit'));
    expect(m.warte.html).toContain('Viele Grüße</p>');
    expect(m.warte.html).not.toContain('Bitte mitbringen');
  });

  it('eigener Text bleibt Text: <Zeichen>, [Klammern] und {{…}} werden nicht zu HTML oder Platzhaltern', () => {
    const m = ablaufMails(mitKonto(), 'X', CT, {
      platz: { betreff: 'Hallo {{person.firstName}}', absatz: '<b>[Betrag]</b> {{x}}', gruss: '' },
      warte: OHNE_EIGENEN_TEXT,
    });
    expect(m.unbekannt).toEqual([]);
    expect(m.platz.betreff).toBe('Hallo { {person.firstName}}');
    expect(m.platz.html).toContain('<p>&lt;b&gt;[Betrag]&lt;/b&gt; &#123;&#123;x}}</p>');
  });
});

describe('Check-in-Code (A9-2b)', () => {
  const ohneText = { platz: OHNE_EIGENEN_TEXT, warte: OHNE_EIGENEN_TEXT };

  it('an: Code in der Bestätigung, nur wenn die Person einen hat; nach dem Betrag, vor dem Link', () => {
    const m = ablaufMails(mitKonto(), 'Kinderfreizeit', CT, ohneText, true);
    expect(m.unbekannt).toEqual([]);
    expect(m.platz.html).toContain(
      '{{#if groupMember.checkInCodeQr}}<p>Check-in-Code für {{person.firstName}} – bitte beim Ankommen zeigen:<br>{{{groupMember.checkInCodeQr}}}</p>{{/if}}',
    );
    const h = m.platz.html;
    expect(h.indexOf('checkInCodeQr')).toBeGreaterThan(h.indexOf(bedingung('Betrag')));
    expect(h.indexOf('checkInCodeQr')).toBeLessThan(h.indexOf(bedingung('Link zur Anmeldung')));
    // Auf der Warteliste gibt es noch keinen Platz – also auch keinen Code.
    expect(m.warte.html).not.toContain('checkInCodeQr');
  });

  it('aus (Standard): kein Code – die Mail wie bisher', () => {
    const ohne = ablaufMails(mitKonto(), 'Kinderfreizeit', CT);
    expect(ohne.platz.html).not.toContain('checkInCodeQr');
    expect(ablaufMails(mitKonto(), 'Kinderfreizeit', CT, ohneText, false)).toEqual(ohne);
  });

  it('kennt ChurchTools den Platzhalter nicht: „unbekannt“ – nur, wenn der Code an ist', () => {
    const ohne = new Map(CT);
    ohne.delete(QR_CODE);
    expect(ablaufMails(mitKonto(), 'K', ohne, ohneText, true).unbekannt).toEqual([QR_CODE]);
    expect(ablaufMails(mitKonto(), 'K', ohne, ohneText, false).unbekannt).toEqual([]);
  });
});

describe('Löschen (A9-3a)', () => {
  const termin = (beginn: string, ende: string | null) => ({ beginn, ende, ort: '', terminId: 1 });

  it('Löschdatum = Ende des Termins + Frist in Monaten; ohne Ende der Beginn; ohne Termin keins', () => {
    expect(
      loeschDatum({ termin: termin('2026-11-13T18:00', '2026-11-15T13:00'), loeschfristMonate: 3 }),
    ).toBe('2027-02-15');
    expect(loeschDatum({ termin: termin('2026-11-14T09:30', null), loeschfristMonate: 1 })).toBe(
      '2026-12-14',
    );
    expect(loeschDatum({ termin: null, loeschfristMonate: 3 })).toBeNull();
  });

  it('gibt es den Tag im Zielmonat nicht, gilt der letzte (Schaltjahr inklusive)', () => {
    expect(loeschDatum({ termin: termin('2027-01-31T10:00', null), loeschfristMonate: 1 })).toBe(
      '2027-02-28',
    );
    expect(loeschDatum({ termin: termin('2027-11-30T10:00', null), loeschfristMonate: 3 })).toBe(
      '2028-02-29',
    );
    expect(loeschDatum({ termin: termin('2026-08-31T10:00', null), loeschfristMonate: 36 })).toBe(
      '2029-08-31',
    );
  });

  it('Schritte: Mail, warten bis zum Datum, entfernen als letzter; vorhandene Nummern bleiben', () => {
    const mail = { betreff: 'B', html: '<p>x</p>' };
    const s = routinenSchritte(mail, 7, [], '2027-02-15');
    expect(s.map((x) => x.actionKey)).toEqual([
      'send-member-email',
      'special:wait',
      'remove-member',
    ]);
    expect(s[1].actionData).toEqual({ untilDate: '2027-02-15' });
    const vorher = [
      { id: 51, actionKey: 'send-member-email' },
      { id: 57, actionKey: 'special:wait' },
      { id: 60, actionKey: 'remove-member' },
    ];
    expect(routinenSchritte(mail, 7, vorher, '2027-03-01').map((x) => x.id)).toEqual([51, 57, 60]);
  });

  it('ohne Datum nur die Mail; „Mail aus“ schaltet nur die Mail aus', () => {
    const mail = { betreff: 'B', html: '<p>x</p>' };
    expect(routinenSchritte(mail, 7, [], null).map((x) => x.actionKey)).toEqual([
      'send-member-email',
    ]);
    const aus = routinenSchritte(mail, 7, [], '2027-02-15', false);
    expect(aus.map((x) => x.isEnabled)).toEqual([false, true, true]);
  });

  it('Anmeldeschluss an einem Tag: 23:59 Ortszeit, auch über die Zeitumstellung', () => {
    expect(anmeldeschlussAm('2027-02-14', 'Europe/Berlin')).toBe('2027-02-14T22:59:00Z');
    expect(anmeldeschlussAm('2026-08-19', 'Europe/Berlin')).toBe('2026-08-19T21:59:00Z');
  });

  it('Anmeldeschluss vor dem Löschen: keiner oder später → Vortag 23:59; früher oder genau dann → nichts zu tun', () => {
    const z = 'Europe/Berlin';
    expect(anmeldeschlussVorLoeschen(null, '2027-02-15', z)).toBe('2027-02-14T22:59:00Z');
    expect(anmeldeschlussVorLoeschen(undefined, '2027-02-15', z)).toBe('2027-02-14T22:59:00Z');
    expect(anmeldeschlussVorLoeschen('2027-02-15T22:59:00Z', '2027-02-15', z)).toBe(
      '2027-02-14T22:59:00Z',
    );
    expect(anmeldeschlussVorLoeschen('2027-02-14T22:59:00Z', '2027-02-15', z)).toBeNull();
    // ChurchTools liefert den Zeitpunkt auch in anderer Schreibweise – verglichen wird der Zeitpunkt, nicht der Text.
    expect(anmeldeschlussVorLoeschen('2027-02-14T23:59:00+01:00', '2027-02-15', z)).toBeNull();
    expect(anmeldeschlussVorLoeschen('2026-11-10T22:59:00Z', '2027-02-15', z)).toBeNull();
  });
});

describe('Erinnerungen (A9-3b)', () => {
  /** Kinder-Event am Fr, 20.11.2026 (senden.testdaten). */
  const mitTagen = (tage: number[]) => ({ ...einstellungen(), erinnerungTage: tage });

  it('Tag = Beginn minus Tage, früheste zuerst; doppelte, ungültige und mehr als drei fallen weg', () => {
    expect(erinnerungen(mitTagen([3, 14, 1]), '2026-11-04')).toEqual([
      { tage: 14, datum: '2026-11-06', an: true },
      { tage: 3, datum: '2026-11-17', an: true },
      { tage: 1, datum: '2026-11-19', an: true },
    ]);
    expect(
      erinnerungen(mitTagen([3, 3, 0, 31, 7, 14, 1]), '2026-11-04').map((x) => x.tage),
    ).toEqual([14, 7, 3]);
  });

  it('ohne Termin oder ohne Tage: keine', () => {
    expect(erinnerungen({ ...mitTagen([3]), termin: null }, '2026-11-04')).toEqual([]);
    expect(erinnerungen(einstellungen(), '2026-11-04')).toEqual([]);
  });

  it('R7: von den vorbeien (Tag heute oder früher) bleibt nur die zuletzt fällige an', () => {
    expect(erinnerungen(mitTagen([14, 3, 1]), '2026-11-18').map((x) => [x.tage, x.an])).toEqual([
      [14, false],
      [3, true],
      [1, true],
    ]);
    // Am Tag selbst gilt sie als fällig – ChurchTools ließe die Wartenden sofort durch.
    expect(erinnerungen(mitTagen([14, 3]), '2026-11-17').map((x) => [x.tage, x.an])).toEqual([
      [14, false],
      [3, true],
    ]);
    // Alle vorbei: die letzte bleibt an.
    expect(erinnerungen(mitTagen([14, 3]), '2026-11-25').map((x) => x.an)).toEqual([false, true]);
  });

  it('Mail: Termin mit Datum statt „in X Tagen“ (Spätangemeldete bekommen sie sofort), Link, eigener Text', () => {
    const m = ablaufMails(mitKonto(), 'Kinderfreizeit', CT, {
      platz: OHNE_EIGENEN_TEXT,
      warte: OHNE_EIGENEN_TEXT,
      erinnerung: { betreff: '', absatz: 'Bitte Schlafsack mitbringen.', gruss: 'Bis bald!' },
    }).erinnerung;
    expect(m.betreff).toBe('Bald ist es so weit: Kinderfreizeit');
    expect(m.html).toContain(
      '{{person.firstName}} ist bei „Kinderfreizeit“ dabei – Fr, 20.11.2026',
    );
    expect(m.html).not.toMatch(/in \d+ Tagen|morgen/);
    expect(m.html).toContain('<p>Bitte Schlafsack mitbringen.</p>');
    expect(m.html).toContain(platz('Link zur Anmeldung'));
    expect(m.html).toContain('Bis bald!');
    // Keine Bankdaten (R5): Die Mail weiß nicht, ob schon bezahlt ist.
    expect(m.html).not.toContain('DE89');
    expect(m.html).not.toMatch(/\[[^\]]+\]/);
  });

  it('eigener Text der Erinnerung steht mit in der Beschreibung von „Platz“ – zusammen höchstens 1.000 Zeichen', () => {
    const er = { betreff: 'Bald!', absatz: 'Schlafsack', gruss: '' };
    const b = eigenerTextAlsBeschreibung(OHNE_EIGENEN_TEXT, er);
    expect(erinnerungsTextAus(b)).toEqual(er);
    expect(eigenerTextAus(b)).toEqual(OHNE_EIGENEN_TEXT);
    // Ohne Erinnerungstext bleibt die Beschreibung, wie sie vor A9-3b war.
    const t = { betreff: 'B', absatz: 'A', gruss: 'G' };
    expect(eigenerTextAlsBeschreibung(t)).toBe(JSON.stringify({ v: 1, ...t }));
    expect(erinnerungsTextAus(eigenerTextAlsBeschreibung(t))).toEqual(OHNE_EIGENEN_TEXT);
    const halb = { betreff: '', absatz: 'x'.repeat(480), gruss: '' };
    expect(eigenerTextFehler(halb)).toBeNull();
    expect(eigenerTextFehler(halb, halb)).toMatch(/zu lang/);
  });

  it('schrittFolge: nach der Stellung – Bestätigung, Paare je Erinnerung, Löschen', () => {
    const f = schrittFolge([
      { id: 1, actionKey: 'send-member-email' },
      { id: 2, actionKey: 'special:wait' },
      { id: 3, actionKey: 'send-member-email' },
      { id: 4, actionKey: 'special:wait' },
      { id: 5, actionKey: 'send-member-email' },
      { id: 6, actionKey: 'special:wait' },
      { id: 7, actionKey: 'remove-member' },
    ]);
    expect(f).toEqual({
      bestaetigung: 1,
      erinnerungen: [
        { warte: 2, mail: 3 },
        { warte: 4, mail: 5 },
      ],
      loeschWarte: 6,
      entfernen: 7,
    });
    // Ohne Erinnerungen wie bisher.
    expect(
      schrittFolge([
        { id: 1, actionKey: 'send-member-email' },
        { id: 6, actionKey: 'special:wait' },
        { id: 7, actionKey: 'remove-member' },
      ]),
    ).toEqual({ bestaetigung: 1, erinnerungen: [], loeschWarte: 6, entfernen: 7 });
  });

  it('routinenSchritte: Erinnerungen vor dem Löschen, Nummern der Reihe nach, aus = Mail aus, nie eine emailId', () => {
    const best = { betreff: 'B', html: '<p>B</p>' };
    const er = { betreff: 'E', html: '<p>E</p>' };
    const vorher = [
      { id: 1, actionKey: 'send-member-email' },
      { id: 2, actionKey: 'special:wait' },
      { id: 3, actionKey: 'send-member-email' },
      { id: 6, actionKey: 'special:wait' },
      { id: 7, actionKey: 'remove-member' },
    ];
    const s = routinenSchritte(best, 9, vorher, '2027-02-20', true, {
      mail: er,
      liste: [
        { tage: 14, datum: '2026-11-06', an: false },
        { tage: 3, datum: '2026-11-17', an: true },
      ],
    });
    expect(s.map((x) => [x.id, x.actionKey, x.isEnabled])).toEqual([
      [1, 'send-member-email', true],
      [2, 'special:wait', true],
      [3, 'send-member-email', false],
      [undefined, 'special:wait', true],
      [undefined, 'send-member-email', true],
      [6, 'special:wait', true],
      [7, 'remove-member', true],
    ]);
    expect(s.map((x) => ('untilDate' in x.actionData ? x.actionData.untilDate : null))).toEqual([
      null,
      '2026-11-06',
      null,
      '2026-11-17',
      null,
      '2027-02-20',
      null,
    ]);
    expect(JSON.stringify(s)).not.toContain('emailId');
    expect(s.filter((x) => x.actionKey === 'send-member-email').map((x) => x.actionData)).toEqual([
      { subject: 'B', body: '<p>B</p>', addSignOutUrl: false, senderId: 9 },
      { subject: 'E', body: '<p>E</p>', addSignOutUrl: false, senderId: 9 },
      { subject: 'E', body: '<p>E</p>', addSignOutUrl: false, senderId: 9 },
    ]);
  });

  it('routinenSchritte: ohne Löschdatum keine Erinnerungen (beide brauchen den Termin)', () => {
    const s = routinenSchritte({ betreff: 'B', html: '' }, 9, [], null, true, {
      mail: { betreff: 'E', html: '' },
      liste: [{ tage: 3, datum: '2026-11-17', an: true }],
    });
    expect(s.map((x) => x.actionKey)).toEqual(['send-member-email']);
  });

  it('standardBetreff je Mail', () => {
    expect(standardBetreff('erinnerung', 'Camp')).toBe('Bald ist es so weit: Camp');
    expect(standardBetreff('platz', 'Camp')).toBe('Camp: Anmeldung bestätigt');
  });
});
