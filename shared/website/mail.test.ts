import { describe, expect, it } from 'vitest';
import type { GruppenRolle } from '../ct/rollenRechte';
import {
  freigabeMails,
  leitungEmpfaenger,
  leitungsRollen,
  mailText,
  zurueckEmpfaenger,
  type GruppenMitglied,
} from './mail';
import { vorschlag } from './rechte';

/**
 * Die Mails im Freigabe-Weg (W3b-3): wer bekommt was, was steht drin. Reine Regeln – kein ChurchTools. Die Vorbelegung der
 * Leitung wird mit `vorschlag` (`rechte.ts`) verglichen, nicht gegen handgeschriebene Rollen-Listen.
 */
const ROLLEN: GruppenRolle[] = [
  { id: 3290, name: 'Leiter', leitung: true },
  { id: 3291, name: 'Co-Leiter', leitung: true },
  { id: 3287, name: 'Mitarbeiter', leitung: false },
];
const m = (personId: number, rolleId: number | null, email?: string): GruppenMitglied => ({
  personId,
  rolleId,
  ...(email ? { email } : {}),
});
const LINK = 'https://ecg.church.tools/ccm/website/';

describe('Wer ist „Leitung“?', () => {
  it('der gespeicherte Wert (vom Admin gesetzt) gilt – auch wenn er von der Vorbelegung abweicht', () => {
    expect(leitungsRollen([3287], ROLLEN)).toEqual([3287]);
  });

  it('fehlt der Wert (bestehende Installationen): dieselbe Vorbelegung wie in „Wer darf was“ – berechnet mit `vorschlag`', () => {
    const erwartet = vorschlag(ROLLEN)
      .filter((r) => r.stufe === 'leitung')
      .map((r) => r.rolle);
    expect(erwartet).toEqual([3290, 3291]);
    expect(leitungsRollen(null, ROLLEN)).toEqual(erwartet);
  });

  it('ein leerer Wert heißt „niemand“ – er wird nicht still durch die Vorbelegung ersetzt', () => {
    expect(leitungsRollen([], ROLLEN)).toEqual([]);
  });
});

describe('Empfänger: die Leitung (Einreichen, Löschen anfragen)', () => {
  const mitglieder = [
    m(1, 3290, 'helene@example.org'),
    m(2, 3291),
    m(3, 3287),
    m(4, null),
    m(5, 3287),
  ];

  it('nur Mitglieder mit einer Leitungs-Rolle', () => {
    expect(leitungEmpfaenger(mitglieder, [3290, 3291], 5).map((p) => p.personId)).toEqual([1, 2]);
  });

  it('die Adresse reist mit, wenn bekannt – sonst fehlt das Feld ganz (kein leerer Text)', () => {
    const an = leitungEmpfaenger(mitglieder, [3290, 3291], 5);
    expect(an[0]).toEqual({ personId: 1, email: 'helene@example.org' });
    expect(an[1]).toEqual({ personId: 2 });
    expect('email' in an[1]).toBe(false);
  });

  it('nie an sich selbst: die handelnde Leitung wird herausgenommen', () => {
    expect(leitungEmpfaenger(mitglieder, [3290, 3291], 1).map((p) => p.personId)).toEqual([2]);
  });

  it('niemand übrig (die einzige Leitung reicht selbst ein): leere Liste – kein Fehler', () => {
    expect(leitungEmpfaenger([m(1, 3290)], [3290], 1)).toEqual([]);
  });

  it('niemand hat die Rolle: leere Liste', () => {
    expect(leitungEmpfaenger(mitglieder, [9999], 5)).toEqual([]);
  });

  it('eine Person mit zwei Mitgliedschaften (zwei Rollen) bekommt nur eine Mail', () => {
    const doppelt = [m(1, 3290), m(1, 3291), m(2, 3290)];
    expect(leitungEmpfaenger(doppelt, [3290, 3291], 9).map((p) => p.personId)).toEqual([1, 2]);
  });

  it('nur über eine Untergruppe dabei (Rolle null) zählt nicht als Leitung', () => {
    expect(leitungEmpfaenger([m(4, null)], [3290], 9)).toEqual([]);
  });
});

describe('Empfänger: die Einreichenden', () => {
  it('Zurückgeben: die Person, die eingereicht hatte – nicht der Handelnde, nicht „unbekannt“', () => {
    expect(zurueckEmpfaenger(5, 1)).toBe(5);
    expect(zurueckEmpfaenger(1, 1)).toBeNull();
    expect(zurueckEmpfaenger(null, 1)).toBeNull();
  });

  it('Freigeben: EINE Mail je Person mit allen ihren Seiten (Alles freigeben) – nicht eine je Seite', () => {
    const mails = freigabeMails(
      [
        { titel: 'A', einreicher: 5 },
        { titel: 'B', einreicher: 6 },
        { titel: 'C', einreicher: 5 },
      ],
      1,
    );
    expect(mails).toEqual([
      { personId: 5, seiten: ['A', 'C'] },
      { personId: 6, seiten: ['B'] },
    ]);
  });

  it('Seiten, die der Handelnde selbst eingereicht hat, und Seiten ohne bekannten Einreichenden entfallen', () => {
    expect(
      freigabeMails(
        [
          { titel: 'A', einreicher: 1 },
          { titel: 'B', einreicher: null },
          { titel: 'C', einreicher: 5 },
        ],
        1,
      ),
    ).toEqual([{ personId: 5, seiten: ['C'] }]);
  });

  it('niemand übrig: keine Mail', () => {
    expect(freigabeMails([{ titel: 'A', einreicher: 1 }], 1)).toEqual([]);
    expect(freigabeMails([], 1)).toEqual([]);
  });
});

describe('Mailtexte: kurz, mit Link', () => {
  it('Einreichen: Betreff, wer, welche Seite, Link auf die Erweiterung', () => {
    const t = mailText({ art: 'eingereicht', wer: 'Rita Redakteurin', seite: 'Jugendabend' }, LINK);
    expect(t.betreff).toBe('Website: „Jugendabend“ wartet auf Freigabe');
    expect(t.html).toContain('Rita Redakteurin');
    expect(t.html).toContain('„Jugendabend“');
    expect(t.html).toContain(`href="${LINK}"`);
    expect(t.html).toContain('Freigaben');
  });

  it('Löschen anfragen', () => {
    const t = mailText({ art: 'loeschenAngefragt', wer: 'Rita', seite: 'Alte Seite' }, LINK);
    expect(t.betreff).toBe('Website: „Alte Seite“ – Löschen angefragt');
    expect(t.html).toContain('zu löschen');
  });

  it('Zurückgeben: mit der Anmerkung; Zeilenumbrüche bleiben Zeilenumbrüche', () => {
    const t = mailText(
      {
        art: 'zurueck',
        wer: 'Helene',
        seite: 'Jugendabend',
        anmerkung: 'Foto tauschen.\nUnd der Titel.',
      },
      LINK,
    );
    expect(t.betreff).toBe('Website: „Jugendabend“ zurückgegeben');
    expect(t.html).toContain('Foto tauschen.<br>Und der Titel.');
    expect(t.html).toContain(`href="${LINK}"`);
  });

  it('Freigeben: eine Seite → ihr Name im Betreff; mehrere → Anzahl im Betreff, Liste im Text', () => {
    const eine = mailText({ art: 'freigegeben', wer: 'Helene', seiten: ['Jugendabend'] }, LINK);
    expect(eine.betreff).toBe('Website: „Jugendabend“ ist freigegeben');
    const mehr = mailText({ art: 'freigegeben', wer: 'Helene', seiten: ['A', 'B', 'C'] }, LINK);
    expect(mehr.betreff).toBe('Website: 3 Seiten sind freigegeben');
    expect(mehr.html).toContain('<li>„A“</li><li>„B“</li><li>„C“</li>');
    expect(mehr.html).toContain(`href="${LINK}"`);
  });

  it('HTML-Schutz: Titel, Namen und Anmerkung bleiben Text – nichts davon wird als Tag gelesen', () => {
    const boese = '<script>alert(1)</script>';
    for (const t of [
      mailText({ art: 'eingereicht', wer: boese, seite: boese }, LINK),
      mailText({ art: 'loeschenAngefragt', wer: boese, seite: boese }, LINK),
      mailText({ art: 'zurueck', wer: boese, seite: boese, anmerkung: boese }, LINK),
      mailText({ art: 'freigegeben', wer: boese, seiten: [boese] }, LINK),
      mailText({ art: 'freigegeben', wer: boese, seiten: [boese, boese] }, LINK),
    ]) {
      expect(t.html).not.toContain('<script>');
      expect(t.html).toContain('&lt;script&gt;');
    }
  });

  it('der Betreff ist reiner Text: einzeilig, nicht HTML-geschützt (sonst stünde „&lt;“ im Betreff)', () => {
    const t = mailText({ art: 'eingereicht', wer: 'Rita', seite: 'A & B\nzwei <Zeilen>' }, LINK);
    expect(t.betreff).toBe('Website: „A & B zwei <Zeilen>“ wartet auf Freigabe');
    expect(t.betreff).not.toMatch(/[\r\n]/);
  });

  it('der Link steht im href geschützt (ein Anführungszeichen bricht nicht aus dem Attribut aus)', () => {
    const t = mailText({ art: 'eingereicht', wer: 'Rita', seite: 'A' }, 'https://x/"onclick="a');
    expect(t.html).not.toContain('"onclick="');
    expect(t.html).toContain('&quot;onclick=');
  });

  it('ohne Namen: „Jemand“ statt eines leeren Satzanfangs', () => {
    const t = mailText({ art: 'eingereicht', wer: '  ', seite: 'A' }, LINK);
    expect(t.html).toMatch(/^<p>Jemand hat/);
  });
});
