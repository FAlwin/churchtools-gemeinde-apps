import { describe, expect, it } from 'vitest';
import {
  BESCHREIBUNG_MAX,
  OHNE_EIGENEN_TEXT,
  QR_CODE,
  ROUTINEN,
  ablaufMails,
  eigenerTextAlsBeschreibung,
  eigenerTextAus,
  eigenerTextFehler,
  loeschDatum,
  routinenSchritte,
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
  it('vorhandener Mail-Schritt behält seine Nummer (laufende Abläufe bleiben an ihrer Stelle)', () => {
    const s = routinenSchritte(mail, 7, [
      { id: 33, actionKey: 'special:wait' },
      { id: 30, actionKey: 'send-member-email' },
    ]);
    expect(s[0].id).toBe(30);
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
});
