import { describe, expect, it } from 'vitest';
import {
  OHNE_EIGENEN_TEXT,
  ablaufMails,
  eigenerTextAlsBeschreibung,
  eigenerTextAus,
  type EigenerText,
} from './ablaeufe';
import { EMPFOHLEN } from './baukasten';
import { SYSTEMFELDER, type OeffentlicheEinstellungen } from './formular';
import { FREI_STANDARD } from './freieAntwort';
import { mailBausteinNamen, mailText } from './mailAntworten';
import { e as listenEinstellungen, FELDER } from './liste.testdaten';

/**
 * F7a – Antworten in der Bestätigung (Entwurf `f7-mails-v1`, Messung M2). Geprüft über den Erzeuger `ablaufMails`: so,
 * wie die Mail in die Routine geschrieben wird. Platzhalter wie in ChurchTools (`{{{groupMemberField.<kürzel>}}}`, Name
 * = Name der Spalte), die Spalten aus den Testdaten der Liste (Nummer → Name, wie `/groups/{id}/memberfields`).
 */
const kuerzel = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const SPALTEN = new Map([...FELDER].map(([nr, f]): [number, string] => [nr, f.name]));
const BEREICH = 640;
const BEREICH_TEXT = 641;
const FOTO_TEXT = 630;
SPALTEN.set(BEREICH, 'Bereiche');
SPALTEN.set(BEREICH_TEXT, 'Bereiche (Sonstiges)');
SPALTEN.set(FOTO_TEXT, 'Dürfen Fotos veröffentlicht werden? (Weiß nicht)');
const CT = new Map<string, string>([
  ...[...SPALTEN.values(), ...SYSTEMFELDER.map((f) => f.name)].map((n): [string, string] => [
    n,
    `{{{groupMemberField.${kuerzel(n)}}}}`,
  ]),
  ['Wartelistenplatz', '{{{groupMember.waitinglistPosition}}}'],
]);
const ph = (spalte: string) => CT.get(spalte)!;
const wenn = (spalte: string) => ph(spalte).replace(/^\{+|\}+$/g, '');

/** Kinder-Event der Liste: Allergien, Fotos (Ja/Nein), Telefon, Erziehungsberechtigte, Unterschrift, Bemerkungen. */
function einst(): OeffentlicheEinstellungen {
  return listenEinstellungen();
}
/** Dazu „Fotos?“ mit freier Antwort „Weiß nicht“ und „Bereiche“ (Mehrfachauswahl) mit „Sonstiges“, beide mit Text. */
function mitFrei(): OeffentlicheEinstellungen {
  const x = einst();
  x.formular.person.find((f) => f.id === 'foto')!.frei = { name: 'Weiß nicht', textfeld: 'auf' };
  x.formular.person.push({
    id: 'bereich',
    art: 'eigen',
    typ: 'multi',
    frage: 'Bereiche',
    hilfe: '',
    zustand: 'freiwillig',
    antworten: ['Küche', 'Technik'],
    frei: { name: FREI_STANDARD, textfeld: 'immer' },
  });
  x.ctFelder = {
    ...x.ctFelder,
    'foto.frei': FOTO_TEXT,
    bereich: BEREICH,
    'bereich.frei': BEREICH_TEXT,
  };
  return x;
}
const bestaetigung = (
  x: OeffentlicheEinstellungen,
  platz: Partial<EigenerText>,
  spalten: ReadonlyMap<number, string> = SPALTEN,
  ct: ReadonlyMap<string, string> = CT,
) =>
  ablaufMails(
    x,
    'Kinderfreizeit',
    ct,
    { platz: { ...OHNE_EIGENEN_TEXT, ...platz }, warte: OHNE_EIGENEN_TEXT },
    false,
    spalten,
  );

describe('mailBausteinNamen – die Knöpfe „Antwort einfügen“', () => {
  it('jede Frage der Tabelle mit ihrem Kurznamen, dann Vorname und Anmelde-Nr.', () => {
    expect(mailBausteinNamen(einst())).toEqual([
      'Allergien oder Unverträglichkeiten',
      'Dürfen Fotos veröffentlicht werden?',
      'Telefon',
      'Erziehungsberechtigte',
      'Unterschrift',
      'Bemerkungen',
      'Vorname',
      'Anmelde-Nr.',
    ]);
  });

  it('Kurzname statt Frage; ein Häkchen fehlt (nicht gemessen); die Adresse ist dabei', () => {
    const x = einst();
    x.formular.person.find((f) => f.id === 'allergy')!.kurz = 'Allergien';
    x.formular.person.push(
      {
        id: 'ok',
        art: 'eigen',
        typ: 'check',
        frage: 'Ich bin einverstanden',
        hilfe: '',
        zustand: 'freiwillig',
        antworten: [],
      },
      { ...EMPFOHLEN.find((y) => y.id === 'adresse')!.feld },
    );
    const namen = mailBausteinNamen(x);
    expect(namen).toContain('Allergien');
    expect(namen).not.toContain('Ich bin einverstanden');
    expect(namen).toContain('Adresse');
  });
});

describe('ablaufMails – [Frage] im eigenen Absatz der Bestätigung', () => {
  it('wird zum Platzhalter der Spalte; Text drumherum bleibt geschützt', () => {
    const m = bestaetigung(einst(), { absatz: 'Telefon <b>[Telefon]</b> {x}' });
    expect(m.unbekannt).toEqual([]);
    expect(m.platz.html).toContain(`<p>Telefon &lt;b&gt;${ph('Telefon')}&lt;/b&gt; &#123;x}</p>`);
  });

  it('der Name der Spalte zählt, nicht der Text der Frage („Telefon (2)“)', () => {
    const spalten = new Map(SPALTEN).set(603, 'Telefon (2)');
    const ct = new Map(CT).set('Telefon (2)', '{{{groupMemberField.telefon-2}}}');
    const m = bestaetigung(einst(), { absatz: '[Telefon]' }, spalten, ct);
    expect(m.platz.html).toContain('<p>{{{groupMemberField.telefon-2}}}</p>');
  });

  it('Vorname und Anmelde-Nr. wie in der Rundmail', () => {
    const m = bestaetigung(einst(), { absatz: '[Vorname], Nr. [Anmelde-Nr.]' });
    expect(m.platz.html).toContain(`<p>{{person.firstName}}, Nr. ${ph('Anmelde-Nr.')}</p>`);
  });

  it('eckige Klammern ohne Frage bleiben Text – ohne die Mail zu sperren', () => {
    const m = bestaetigung(einst(), { absatz: 'Mitbringen: [Schlafsack]' });
    expect(m.unbekannt).toEqual([]);
    expect(m.platz.html).toContain('<p>Mitbringen: [Schlafsack]</p>');
  });

  it('fehlt die Spalte in ChurchTools: Name in `unbekannt` (dann wird nichts geschrieben)', () => {
    const spalten = new Map(SPALTEN);
    spalten.delete(603);
    expect(bestaetigung(einst(), { absatz: '[Telefon]' }, spalten).unbekannt).toEqual(['Telefon']);
  });

  it('freie Antwort mit Text: ihr Text statt der Beschriftung; Mehrfachauswahl: Text in Klammern dahinter', () => {
    const m = bestaetigung(mitFrei(), {
      absatz: '[Dürfen Fotos veröffentlicht werden?] / [Bereiche]',
    });
    const foto = 'Dürfen Fotos veröffentlicht werden?';
    const fotoText = 'Dürfen Fotos veröffentlicht werden? (Weiß nicht)';
    expect(m.platz.html).toContain(
      `<p>{{#if ${wenn(fotoText)}}}${ph(fotoText)}{{else}}${ph(foto)}{{/if}} / ` +
        `${ph('Bereiche')}{{#if ${wenn('Bereiche (Sonstiges)')}}} (${ph('Bereiche (Sonstiges)')}){{/if}}</p>`,
    );
  });

  it('Adresse aus der Person (F4) – nur mit Straße', () => {
    const x = einst();
    x.formular.person.push({ ...EMPFOHLEN.find((y) => y.id === 'adresse')!.feld });
    expect(bestaetigung(x, { absatz: '[Adresse]' }).platz.html).toContain(
      '<p>{{{person.street}}}, {{{person.zip}}} {{{person.city}}}</p>',
    );
  });

  it('Warteliste und Erinnerung bleiben, wie sie sind: [Telefon] ist dort Text', () => {
    const t = { ...OHNE_EIGENEN_TEXT, absatz: '[Telefon]' };
    const m = ablaufMails(einst(), 'K', CT, { platz: t, warte: t, erinnerung: t }, false, SPALTEN);
    expect(m.warte.html).toContain('<p>[Telefon]</p>');
    expect(m.erinnerung.html).toContain('<p>[Telefon]</p>');
    expect(m.platz.html).toContain(`<p>${ph('Telefon')}</p>`);
  });
});

describe('ablaufMails – „Alle Angaben mitschicken“', () => {
  it('aus: keine Liste', () => {
    expect(bestaetigung(einst(), {}).platz.html).not.toContain('Deine Angaben');
  });

  it('an: je Frage eine Zeile, die nur mit Antwort erscheint – nach dem eigenen Absatz, vor dem Link', () => {
    const { platz, unbekannt } = bestaetigung(einst(), { absatz: 'Hallo!', alle: true });
    expect(unbekannt).toEqual([]);
    expect(platz.html).toContain(
      `{{#if ${wenn('Telefon')}}}<tr><td style="padding:2px 16px 2px 0;vertical-align:top">Telefon</td>` +
        `<td style="padding:2px 0">${ph('Telefon')}</td></tr>{{/if}}`,
    );
    const zeilen = platz.html.match(/<tr>/g) ?? [];
    expect(zeilen).toHaveLength(6);
    const i = platz.html.indexOf.bind(platz.html);
    expect(i('<p>Hallo!</p>')).toBeLessThan(i('Deine Angaben'));
    expect(i('Deine Angaben')).toBeLessThan(i('Deine Anmeldung ansehen'));
  });

  it('an, aber eine Spalte fehlt: Name in `unbekannt`', () => {
    const spalten = new Map(SPALTEN);
    spalten.delete(606);
    expect(bestaetigung(einst(), { alle: true }, spalten).unbekannt).toEqual(['Bemerkungen']);
  });
});

describe('„Alle Angaben“ in der Beschreibung der Routine', () => {
  it('wird gespeichert und gelesen; allein reicht es für eine Beschreibung', () => {
    const t = { ...OHNE_EIGENEN_TEXT, alle: true };
    const b = eigenerTextAlsBeschreibung(t);
    expect(b).not.toBeNull();
    expect(eigenerTextAus(b)).toEqual(t);
  });

  it('ältere Beschreibung ohne das Feld: aus – und es wird nicht hineingeschrieben', () => {
    const alt = JSON.stringify({ v: 1, betreff: '', absatz: 'Hallo', gruss: '' });
    expect(eigenerTextAus(alt)).toEqual({ betreff: '', absatz: 'Hallo', gruss: '' });
    expect(eigenerTextAlsBeschreibung({ ...OHNE_EIGENEN_TEXT, absatz: 'Hallo' })).toBe(alt);
    expect(eigenerTextAlsBeschreibung({ ...OHNE_EIGENEN_TEXT, alle: false })).toBeNull();
  });
});

describe('mailText', () => {
  it('schützt HTML und {, behält Zeilenumbrüche', () => {
    expect(mailText('a<b>\n{{x}}')).toBe('a&lt;b&gt;<br>&#123;&#123;x}}');
  });
});
