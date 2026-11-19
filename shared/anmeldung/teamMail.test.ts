import { describe, expect, it } from 'vitest';
import { EMPFOHLEN } from './baukasten';
import type { Feld, OeffentlicheEinstellungen } from './formular';
import { FREI_STANDARD } from './freieAntwort';
import { antworten, einstellungen } from './senden.testdaten';
import {
  antwortAlsText,
  teamBausteinNamen,
  teamMailText,
  teamMailVon,
  teamPersonen,
  type TeamPerson,
} from './teamMail';

/**
 * F7c – die Team-Mail (Entwurf `f7-mails-v1`, Klick-Runden 11/12, Messung M2). Geprüft mit den Testdaten des
 * Absendens (`senden.testdaten`): Kinder-Event, Kontakt Maria, zwei Kinder (Jonas, Lena).
 */
const BEIDE: TeamPerson[] = [
  { index: 0, name: 'Jonas Beispiel', ergebnis: 'angemeldet' },
  { index: 1, name: 'Lena Beispiel', ergebnis: 'warteliste' },
];
const mit = (t: Partial<NonNullable<OeffentlicheEinstellungen['teamMail']>>) => ({
  ...einstellungen(),
  teamMail: { an: true, text: '', ohne: [], ...t },
});
const feld = (e: OeffentlicheEinstellungen, id: string) =>
  [...e.formular.anmeldung, ...e.formular.person].find((f) => f.id === id)!;

describe('teamMailVon', () => {
  it('ohne Einstellung: an, ohne Text, alle Antworten (Standard an)', () => {
    expect(teamMailVon(einstellungen())).toEqual({ an: true, text: '', ohne: [] });
  });
});

describe('teamMailText', () => {
  it('ein Absatz: Nr., Antworten zur Anmeldung, je Person Name, Stand und ihre Antworten', () => {
    const text = teamMailText(einstellungen(), antworten(), BEIDE, '7K2P9X');
    expect(text).not.toMatch(/\n/);
    expect(text.split(' | ')).toEqual([
      'Anmelde-Nr. 7K2P9X',
      'Telefon: 0151 111; Erziehungsberechtigte: Maria Beispiel, 0151 111, Tom Beispiel, ✓ erziehungsberechtigt und einverstanden; Unterschrift: unterschrieben',
      'Jonas Beispiel (Platz): Allergien oder Unverträglichkeiten: Nüsse; Dürfen Fotos veröffentlicht werden?: Ja',
      'Lena Beispiel (Warteliste): Dürfen Fotos veröffentlicht werden?: Nein',
    ]);
  });

  it('abgewählte Fragen fehlen; eigener Text mit [Frage] – je Person die verschiedenen Antworten', () => {
    const e = mit({
      text: 'Neu: [Anmelde-Nr.]\nFotos: [Dürfen Fotos veröffentlicht werden?], Tel. [Telefon], [Gibt es nicht]',
      ohne: ['allergy', 'eltern', 'sign'],
    });
    expect(teamMailText(e, antworten(), BEIDE, '7K2P9X').split(' | ')).toEqual([
      'Neu: 7K2P9X Fotos: Ja, Nein, Tel. 0151 111, [Gibt es nicht]',
      'Anmelde-Nr. 7K2P9X',
      'Telefon: 0151 111',
      'Jonas Beispiel (Platz): Dürfen Fotos veröffentlicht werden?: Ja',
      'Lena Beispiel (Warteliste): Dürfen Fotos veröffentlicht werden?: Nein',
    ]);
  });

  it('noch zu bestätigen: Stand und Vermerk; offen Gebliebene gehören nicht hinein', () => {
    const text = teamMailText(
      mit({ ohne: ['tel', 'eltern', 'sign', 'allergy', 'foto'] }),
      antworten(),
      [
        { index: 0, name: 'Jonas Beispiel', ergebnis: 'bestaetigen' },
        { index: 1, name: 'Lena Beispiel', ergebnis: 'offen' },
      ],
    );
    expect(text).toBe(
      'Jonas Beispiel (muss die Anmeldung noch per Mail bestätigen) | Die Person muss ihre Anmeldung noch per Mail bestätigen – erst dann ist sie angemeldet.',
    );
    expect(teamPersonen(BEIDE.concat({ index: 2, name: 'X', ergebnis: 'ausgebucht' }))).toEqual(
      BEIDE,
    );
  });

  it('ausgeblendete Fragen zählen nicht (wie beim Absenden)', () => {
    const e = einstellungen();
    // „Fotos?“ nur zeigen, wenn „Allergien“ leer ist – bei Jonas (Nüsse) ausgeblendet, seine Antwort fällt weg.
    feld(e, 'foto').bed = { modus: 'alle', regeln: [{ feld: 'allergy', op: 'leer' }] };
    const text = teamMailText(e, antworten(), BEIDE);
    expect(text).toContain('Jonas Beispiel (Platz): Allergien oder Unverträglichkeiten: Nüsse |');
    expect(text).toContain('Lena Beispiel (Warteliste): Dürfen Fotos veröffentlicht werden?: Nein');
    expect(text).not.toContain(': Ja');
  });

  it('Vorschau: eigene Werte statt Antworten', () => {
    const text = teamMailText(
      mit({ ohne: ['eltern', 'sign', 'allergy', 'foto', 'note'], text: 'Tel. [Telefon]' }),
      { anmeldung: {}, personen: [{}] },
      [{ index: 0, name: 'Vorname Nachname', ergebnis: 'angemeldet' }],
      'ABC234',
      () => '…',
    );
    expect(text).toBe('Tel. … | Anmelde-Nr. ABC234 | Telefon: … | Vorname Nachname (Platz)');
  });
});

describe('antwortAlsText', () => {
  it('Ankreuzen, Mehrfachauswahl mit freier Antwort, Adresse, leer', () => {
    const check = { id: 'ok', typ: 'check' } as Feld;
    expect(antwortAlsText(check, { ok: true })).toBe('ja');
    expect(antwortAlsText(check, { ok: false })).toBeNull();
    const multi = {
      id: 'b',
      typ: 'multi',
      antworten: ['Küche', 'Technik'],
      frei: { name: FREI_STANDARD, textfeld: 'immer' },
    } as Feld;
    expect(antwortAlsText(multi, { b: ['Küche', FREI_STANDARD], 'b.frei': 'Fotos' })).toBe(
      'Küche · Fotos',
    );
    const adresse = EMPFOHLEN.find((x) => x.id === 'adresse')!.feld;
    expect(
      antwortAlsText(adresse, {
        [adresse.id]: { strasse: 'Hauptstr. 4', plz: '53797', ort: 'Lohmar' },
      }),
    ).toBe('Hauptstr. 4, 53797 Lohmar');
    expect(antwortAlsText({ id: 't', typ: 'text' } as Feld, { t: '  ' })).toBeNull();
  });
});

describe('teamBausteinNamen', () => {
  it('jede Frage der Tabelle (Kurzname) und die Anmelde-Nr.', () => {
    expect(teamBausteinNamen(einstellungen())).toEqual([
      'Allergien oder Unverträglichkeiten',
      'Dürfen Fotos veröffentlicht werden?',
      'Telefon',
      'Erziehungsberechtigte',
      'Unterschrift',
      'Bemerkungen',
      'Anmelde-Nr.',
    ]);
  });
});
