import { describe, expect, it } from 'vitest';
import { ROUTINEN, ablaufMails, routinenSchritte } from './ablaeufe';
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
    expect(block).toContain(`Betrag: ${platz('Betrag')}<br>${platz('Aufschlüsselung')}`);
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
