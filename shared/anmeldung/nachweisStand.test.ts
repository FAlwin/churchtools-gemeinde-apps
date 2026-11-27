import { describe, expect, it } from 'vitest';
import { plusTage } from '../ct/datum';
import {
  NACHWEIS_AUFGABE_ERNEUT,
  NACHWEIS_AUFGABE_ERSTE,
  type NachweisEinstellungen,
} from './nachweise';
import { tagPunkt } from '../ct/datum';
import { antragVorgabe } from './nachweisAntrag';
import {
  FEHLT_NACH_TAGEN,
  LAEUFT_AB_TAGE,
  aufgabeErledigtDurch,
  aufmerksamkeitEtiketten,
  aufmerksamkeitZaehlen,
  brauchenDichText,
  brauchtAufmerksamkeit,
  einsichtFehler,
  einsichtFolgeTexte,
  einsichtPlan,
  einsichtVorbelegung,
  nachStand,
  nachweisGueltigBis,
  personStand,
  plusJahre,
  standFuerLeitung,
  standRang,
  standText,
  standTon,
  tagAus,
  zaehlText,
  type NachweisStand,
  type PersonAngaben,
} from './nachweisStand';

/**
 * Der Stand je Person (N2a). Die Tage kommen aus den Grenzen im Quelltext (`FEHLT_NACH_TAGEN`, `LAEUFT_AB_TAGE`) und
 * werden mit `plusTage` gerechnet – nicht als abgeschriebene Datumsliterale –, die Grenzfälle (28/29, 56/57, heute, gestern)
 * stehen aber ausdrücklich da. „heute“ ist ein Parameter; keine Uhr im Test.
 */
const HEUTE = '2026-11-20';
const E: NachweisEinstellungen = {
  gueltigJahre: 3,
  ab: 'ausstellung',
  betreff: 'Betreff',
  text: 'Text [Vorname]',
};
const MIT_ANTRAG: NachweisEinstellungen = { ...E, antrag: antragVorgabe('ECG Donrath') };
const OHNE_ANTRAG: NachweisEinstellungen = { ...E, antrag: { ...antragVorgabe(null), an: false } };
const VOLL: NonNullable<PersonAngaben['profil']> = {
  geburtstag: '1990-01-01',
  strasse: 'Hauptstr. 4',
  plz: '53797',
  ort: 'Lohmar',
};

const person = (p: Partial<PersonAngaben> = {}): PersonAngaben => ({
  eingesehenAm: null,
  ausgestelltAm: null,
  ergebnis: null,
  aufgabe: null,
  profil: null,
  ...p,
});
/** Eine Person, die eingesehen hat; „Gültig bis“ liegt `tage` Tage nach heute (ab Ausstellung, 3 Jahre). */
const mitAblauf = (tage: number, p: Partial<PersonAngaben> = {}) => {
  const bis = plusTage(HEUTE, tage);
  return person({ eingesehenAm: '2026-01-01', ausgestelltAm: plusJahre(bis, -3), ...p });
};
const stand = (p: PersonAngaben, e: NachweisEinstellungen | null = E) =>
  personStand(p, e, HEUTE).stand;

describe('Stand je Person: jede Zeile der Tabelle', () => {
  it('angefordert: offene Aufgabe, höchstens 28 Tage alt (Grenze 28 = noch angefordert)', () => {
    const seit = plusTage(HEUTE, -FEHLT_NACH_TAGEN);
    expect(stand(person({ aufgabe: { seit } }))).toEqual({ art: 'angefordert', seit });
    expect(stand(person({ aufgabe: { seit: HEUTE } })).art).toBe('angefordert');
  });

  it('fehlt: offene Aufgabe, älter als 28 Tage (Grenze 29 = fehlt) – mit der Zahl der Wochen', () => {
    const s29 = plusTage(HEUTE, -(FEHLT_NACH_TAGEN + 1));
    expect(stand(person({ aufgabe: { seit: s29 } }))).toEqual({
      art: 'fehlt',
      seit: s29,
      wochen: 4,
    });
    const s35 = plusTage(HEUTE, -35);
    expect(stand(person({ aufgabe: { seit: s35 } }))).toMatchObject({ art: 'fehlt', wochen: 5 });
  });

  it('offene Aufgabe ohne bekannten Tag: angefordert ohne Datum (kein „fehlt“ aus dem Nichts)', () => {
    expect(stand(person({ aufgabe: { seit: null } }))).toEqual({ art: 'angefordert', seit: null });
  });

  it('noch keine Aufgabe: weder Einsicht noch offene Aufgabe', () => {
    expect(stand(person())).toEqual({ art: 'keineAufgabe' });
  });

  it('gültig: Ablauf mehr als 56 Tage nach heute (57 = gültig, 56 = läuft ab)', () => {
    expect(stand(mitAblauf(LAEUFT_AB_TAGE + 1)).art).toBe('gueltig');
    expect(stand(mitAblauf(LAEUFT_AB_TAGE)).art).toBe('laeuftAb');
  });

  it('läuft ab: Ablauf in 0–56 Tagen – auch HEUTE (der Tag selbst gilt noch)', () => {
    const bis = plusTage(HEUTE, 0);
    expect(stand(mitAblauf(0))).toEqual({ art: 'laeuftAb', bis });
    expect(stand(mitAblauf(1)).art).toBe('laeuftAb');
  });

  it('abgelaufen: Ablauf vor heute (gestern = abgelaufen)', () => {
    expect(stand(mitAblauf(-1))).toEqual({ art: 'abgelaufen', bis: plusTage(HEUTE, -1) });
  });

  it('Rücksprache schlägt jedes Datum – gültig, abgelaufen, und auch ohne Einsicht', () => {
    expect(stand(mitAblauf(400, { ergebnis: 'eintrag' })).art).toBe('ruecksprache');
    expect(stand(mitAblauf(-400, { ergebnis: 'eintrag' })).art).toBe('ruecksprache');
    expect(stand(person({ ergebnis: 'eintrag', aufgabe: { seit: HEUTE } })).art).toBe(
      'ruecksprache',
    );
    // „Keine Eintragung“ ändert nichts.
    expect(stand(mitAblauf(400, { ergebnis: 'ohne' })).art).toBe('gueltig');
  });

  it('eine offene Aufgabe („Erneut einsehen“) neben gültiger Einsicht: es zählt die Gültigkeit', () => {
    expect(stand(mitAblauf(400, { aufgabe: { seit: plusTage(HEUTE, -100) } })).art).toBe('gueltig');
  });

  it('eingesehen, aber das Datum für „Gültig bis“ fehlt: „Angaben unvollständig“ (kein Alarm)', () => {
    expect(stand(person({ eingesehenAm: '2026-01-01', ausgestelltAm: null }))).toEqual({
      art: 'unvollstaendig',
    });
    // Art nicht fertig eingerichtet: keine Gültigkeit bekannt.
    expect(stand(mitAblauf(400), null).art).toBe('unvollstaendig');
  });
});

describe('„Gültig bis“', () => {
  const d = { eingesehenAm: '2026-05-02', ausgestelltAm: '2026-04-14' };

  it('ab Ausstellung rechnet vom Zeugnis, ab Einsicht vom Tag der Einsicht', () => {
    expect(nachweisGueltigBis({ gueltigJahre: 3, ab: 'ausstellung' }, d)).toBe('2029-04-14');
    expect(nachweisGueltigBis({ gueltigJahre: 3, ab: 'einsicht' }, d)).toBe('2029-05-02');
  });

  it('fehlt das nötige Datum: null – das andere hilft nicht', () => {
    expect(
      nachweisGueltigBis({ gueltigJahre: 3, ab: 'ausstellung' }, { ...d, ausgestelltAm: null }),
    ).toBeNull();
    expect(
      nachweisGueltigBis({ gueltigJahre: 3, ab: 'einsicht' }, { ...d, eingesehenAm: null }),
    ).toBeNull();
  });

  it('der 29.02. wird in einem Jahr ohne Schalttag zum 28.02.; sonst bleibt er', () => {
    expect(plusJahre('2024-02-29', 3)).toBe('2027-02-28');
    expect(plusJahre('2024-02-29', 4)).toBe('2028-02-29');
    expect(plusJahre('2026-03-01', 1)).toBe('2027-03-01');
  });

  it('der Stand nutzt dieselbe Funktion: ab: einsicht gegen ab: ausstellung ergibt verschieden lange Gültigkeit', () => {
    // Zeugnis vor 3 Jahren plus 1 Monat ausgestellt, heute eingesehen: ab Ausstellung läuft es bald ab, ab Einsicht nicht.
    const p = person({ eingesehenAm: HEUTE, ausgestelltAm: plusJahre(plusTage(HEUTE, 10), -3) });
    expect(stand(p, { ...E, ab: 'ausstellung' }).art).toBe('laeuftAb');
    expect(stand(p, { ...E, ab: 'einsicht' }).art).toBe('gueltig');
  });

  it('Datum aus ChurchTools: nur ein Tag zählt (Uhrzeit abschneiden, Unsinn → null)', () => {
    expect(tagAus('2026-11-03')).toBe('2026-11-03');
    expect(tagAus('2026-11-03T10:00:00Z')).toBe('2026-11-03');
    expect(tagAus('')).toBeNull();
    expect(tagAus('03.11.2026')).toBeNull();
    expect(tagAus(null)).toBeNull();
  });
});

describe('Antrag unvollständig', () => {
  const luecke = (p: Partial<PersonAngaben>, e: NachweisEinstellungen | null = MIT_ANTRAG) =>
    personStand(person(p), e, HEUTE).luecke;
  const fehlendes = (ueber: Partial<typeof VOLL>) => ({ profil: { ...VOLL, ...ueber } });
  const ANGEFORDERT = { aufgabe: { seit: HEUTE } };

  it('Geburtsdatum und Adresse / nur Adresse / nur Geburtsdatum – die drei Texte', () => {
    expect(luecke({ ...ANGEFORDERT, ...fehlendes({ geburtstag: null, strasse: null }) })).toBe(
      'Antrag unvollständig: Geburtsdatum und Adresse fehlen',
    );
    expect(luecke({ ...ANGEFORDERT, ...fehlendes({ ort: null }) })).toBe(
      'Antrag unvollständig: Adresse fehlt',
    );
    expect(luecke({ ...ANGEFORDERT, ...fehlendes({ geburtstag: null }) })).toBe(
      'Antrag unvollständig: Geburtsdatum fehlt',
    );
  });

  it('die Adresse fehlt, wenn Straße, PLZ ODER Ort leer ist (auch nur Leerzeichen)', () => {
    for (const teil of ['strasse', 'plz', 'ort'] as const)
      expect(luecke({ ...ANGEFORDERT, ...fehlendes({ [teil]: '  ' }) })).toBe(
        'Antrag unvollständig: Adresse fehlt',
      );
  });

  it('alles da: kein Hinweis', () => {
    expect(luecke({ ...ANGEFORDERT, profil: VOLL })).toBeNull();
  });

  it('nur bei Arten mit Antrag (Antrag aus oder ganz fehlend: kein Hinweis)', () => {
    const leer = { ...ANGEFORDERT, ...fehlendes({ geburtstag: null }) };
    expect(luecke(leer, OHNE_ANTRAG)).toBeNull();
    expect(luecke(leer, E)).toBeNull();
    expect(luecke(leer, null)).toBeNull();
  });

  it('nicht gelesen (profil null, z. B. kein Recht): kein Hinweis statt falschem Alarm', () => {
    expect(luecke({ ...ANGEFORDERT, profil: null })).toBeNull();
  });

  it('nur solange die Person einen Antrag braucht: angefordert, fehlt, läuft ab, abgelaufen, noch keine Aufgabe', () => {
    const leer = fehlendes({ geburtstag: null });
    expect(luecke({ aufgabe: { seit: HEUTE }, ...leer })).not.toBeNull(); // angefordert
    expect(luecke({ aufgabe: { seit: plusTage(HEUTE, -40) }, ...leer })).not.toBeNull(); // fehlt
    expect(luecke({ ...mitAblauf(10), ...leer })).not.toBeNull(); // läuft ab
    expect(luecke({ ...mitAblauf(-10), ...leer })).not.toBeNull(); // abgelaufen
    expect(luecke({ ...leer })).not.toBeNull(); // noch keine Aufgabe
    // gültig, Rücksprache, Angaben unvollständig: kein Hinweis
    expect(luecke({ ...mitAblauf(400), ...leer })).toBeNull();
    expect(luecke({ ...mitAblauf(10, { ergebnis: 'eintrag' }), ...leer })).toBeNull();
    expect(luecke({ eingesehenAm: '2026-01-01', ...leer })).toBeNull();
  });
});

describe('Text und Farbe je Stand', () => {
  const alle: NachweisStand[] = [
    { art: 'angefordert', seit: '2026-11-19' },
    { art: 'fehlt', seit: '2026-10-16', wochen: 5 },
    { art: 'gueltig', bis: '2029-04-14' },
    { art: 'laeuftAb', bis: '2026-12-28' },
    { art: 'abgelaufen', bis: '2026-10-02' },
    { art: 'ruecksprache' },
    { art: 'keineAufgabe' },
    { art: 'unvollstaendig' },
  ];

  it('Text', () => {
    expect(alle.map(standText)).toEqual([
      'angefordert am 19.11.',
      'fehlt seit 5 Wochen',
      'gültig',
      'läuft ab am 28.12.',
      'abgelaufen seit 02.10.',
      'Rücksprache',
      'noch keine Aufgabe',
      'Angaben unvollständig',
    ]);
    expect(standText({ art: 'angefordert', seit: null })).toBe('angefordert');
  });

  it('Farbe: läuft ab ist BLAU, fehlt/abgelaufen/Rücksprache rot, gültig grün, der Rest grau', () => {
    expect(alle.map(standTon)).toEqual([
      'blau',
      'rot',
      'gruen',
      'blau',
      'rot',
      'rot',
      'neutral',
      'neutral',
    ]);
  });

  it('Aufmerksamkeit: fehlt, läuft ab, abgelaufen, Rücksprache – sonst nicht', () => {
    expect(alle.filter(brauchtAufmerksamkeit).map((s) => s.art)).toEqual([
      'fehlt',
      'laeuftAb',
      'abgelaufen',
      'ruecksprache',
    ]);
  });

  it('Reihenfolge: rot vor blau vor angefordert vor gültig, innerhalb nach Name', () => {
    const l = [
      { name: 'Zoe', stand: alle[2] },
      { name: 'Yvi', stand: alle[0] },
      { name: 'Xaver', stand: alle[3] },
      { name: 'Wiebke', stand: alle[4] },
      { name: 'Anna', stand: alle[1] },
      { name: 'Ben', stand: alle[6] },
    ];
    expect(nachStand(l).map((x) => x.name)).toEqual([
      'Anna',
      'Wiebke',
      'Xaver',
      'Ben',
      'Yvi',
      'Zoe',
    ]);
    expect(standRang(alle[5])).toBe(0);
  });
});

describe('Zählung und Texte für die Startseite', () => {
  const STAENDE: Record<NachweisStand['art'], NachweisStand> = {
    angefordert: { art: 'angefordert', seit: null },
    fehlt: { art: 'fehlt', seit: '2026-10-01', wochen: 7 },
    gueltig: { art: 'gueltig', bis: '2030-01-01' },
    laeuftAb: { art: 'laeuftAb', bis: '2026-12-01' },
    abgelaufen: { art: 'abgelaufen', bis: '2026-10-01' },
    ruecksprache: { art: 'ruecksprache' },
    keineAufgabe: { art: 'keineAufgabe' },
    unvollstaendig: { art: 'unvollstaendig' },
  };
  const s = (art: NachweisStand['art']) => STAENDE[art];

  it('„7 Personen: 2 gültig · 1 angefordert · 4 brauchen dich“', () => {
    const l = [
      s('gueltig'),
      s('gueltig'),
      s('angefordert'),
      s('fehlt'),
      s('laeuftAb'),
      s('abgelaufen'),
      s('ruecksprache'),
    ];
    expect(zaehlText(l)).toBe('7 Personen: 2 gültig · 1 angefordert · 4 brauchen dich');
  });

  it('angefordert zählt auch „noch keine Aufgabe“ und „Angaben unvollständig“', () => {
    expect(zaehlText([s('angefordert'), s('keineAufgabe'), s('unvollstaendig')])).toBe(
      '3 Personen: 3 angefordert',
    );
  });

  it('Teile mit 0 fehlen; Einzahl; alle gültig; niemand', () => {
    expect(zaehlText([s('gueltig'), s('abgelaufen')])).toBe(
      '2 Personen: 1 gültig · 1 braucht dich',
    );
    expect(zaehlText([s('gueltig'), s('gueltig')])).toBe('2 Personen: alle gültig');
    expect(zaehlText([s('gueltig')])).toBe('1 Person: alle gültig');
    expect(zaehlText([])).toBe('Noch niemand eingetragen');
  });

  it('Etiketten: Einzahl/Mehrzahl, nur Fälle mit Zahl, feste Reihenfolge und Farbe', () => {
    const z = aufmerksamkeitZaehlen([
      s('fehlt'),
      s('laeuftAb'),
      s('laeuftAb'),
      s('abgelaufen'),
      s('ruecksprache'),
      s('gueltig'),
    ]);
    expect(z).toEqual({ fehlt: 1, laeuftAb: 2, abgelaufen: 1, ruecksprache: 1, summe: 5 });
    expect(aufmerksamkeitEtiketten(z)).toEqual([
      { text: '1 fehlt seit über 4 Wochen', ton: 'rot' },
      { text: '2 laufen bald ab', ton: 'blau' },
      { text: '1 abgelaufen', ton: 'rot' },
      { text: '1 Rücksprache', ton: 'rot' },
    ]);
    expect(
      aufmerksamkeitEtiketten(aufmerksamkeitZaehlen([s('fehlt'), s('fehlt'), s('laeuftAb')])),
    ).toEqual([
      { text: '2 fehlen seit über 4 Wochen', ton: 'rot' },
      { text: '1 läuft bald ab', ton: 'blau' },
    ]);
    expect(aufmerksamkeitEtiketten(aufmerksamkeitZaehlen([s('gueltig')]))).toEqual([]);
  });

  it('„N Personen brauchen dich als Vertrauensperson.“ – Einzahl richtig', () => {
    expect(brauchenDichText(4)).toBe('4 Personen brauchen dich als Vertrauensperson.');
    expect(brauchenDichText(1)).toBe('1 Person braucht dich als Vertrauensperson.');
  });
});

// ── Einsicht festhalten (N2b) ────────────────────────────────────────────────────────────────────────────────────

describe('aufgabeErledigtDurch: neue Einsicht oder nur berichtigen', () => {
  const erste = (angelegt: string | null) => ({ titel: NACHWEIS_AUFGABE_ERSTE, angelegt });
  const erneut = (angelegt: string | null) => ({ titel: NACHWEIS_AUFGABE_ERNEUT, angelegt });
  it('„Einsicht nehmen“: jede Einsicht erledigt sie – auch eine vor der Anforderung oder ohne Anlagetag', () => {
    expect(aufgabeErledigtDurch(erste(HEUTE), HEUTE)).toBe(true);
    expect(aufgabeErledigtDurch(erste(plusTage(HEUTE, -3)), HEUTE)).toBe(true);
    expect(aufgabeErledigtDurch(erste(plusTage(HEUTE, 30)), HEUTE)).toBe(true);
    expect(aufgabeErledigtDurch(erste(null), HEUTE)).toBe(true);
  });
  it('„Erneut einsehen“: nur eine Einsicht NACH dem Anlagetag erledigt sie', () => {
    expect(aufgabeErledigtDurch(erneut(plusTage(HEUTE, -1)), HEUTE)).toBe(true);
  });
  it('„Erneut einsehen“ am selben Tag angelegt wie die Einsicht: nur berichtigen (Demo-Fund 20.11.2026, Rücksprache → keine Eintragung)', () => {
    expect(aufgabeErledigtDurch(erneut(HEUTE), HEUTE)).toBe(false);
    expect(aufgabeErledigtDurch(erneut(HEUTE), plusTage(HEUTE, -1))).toBe(false);
  });
  it('keine Aufgabe, keine Einsicht oder „Erneut einsehen“ ohne Anlagetag: nicht erledigt', () => {
    expect(aufgabeErledigtDurch(null, HEUTE)).toBe(false);
    expect(aufgabeErledigtDurch(erneut(null), HEUTE)).toBe(false);
    expect(aufgabeErledigtDurch(erste(HEUTE), null)).toBe(false);
  });
});

describe('einsichtPlan', () => {
  const eingabe = (a: Partial<Parameters<typeof einsichtPlan>[0]> = {}) => ({
    einstellungen: E,
    eingesehenAm: HEUTE,
    ausgestelltAm: plusTage(HEUTE, -5),
    aufgabe: { titel: NACHWEIS_AUFGABE_ERSTE, angelegt: plusTage(HEUTE, -10) },
    heute: HEUTE,
    ...a,
  });
  it('neue Einsicht bei „Einsicht nehmen“: Aufgabe erledigen, die nächste kommt gleich und wird verschoben', () => {
    const p = einsichtPlan(eingabe());
    expect(p).toEqual({
      neu: true,
      gueltigBis: nachweisGueltigBis(E, {
        eingesehenAm: HEUTE,
        ausgestelltAm: plusTage(HEUTE, -5),
      }),
      erledigt: NACHWEIS_AUFGABE_ERSTE,
      verschiebenAuf: plusJahre(plusTage(HEUTE, -5), 3),
      verschieben: 'naechste',
    });
  });
  it('Berichtigung bei „Erneut einsehen“: nichts erledigt, die vorhandene wird verschoben', () => {
    const p = einsichtPlan(
      eingabe({
        eingesehenAm: plusTage(HEUTE, -20),
        aufgabe: { titel: NACHWEIS_AUFGABE_ERNEUT, angelegt: plusTage(HEUTE, -10) },
      }),
    );
    expect(p).toMatchObject({ neu: false, erledigt: null, verschieben: 'vorhandene' });
  });
  it('Einsicht vor der Anforderung bei offener „Einsicht nehmen“: erledigt sie, die nächste wird verschoben', () => {
    const p = einsichtPlan(eingabe({ eingesehenAm: plusTage(HEUTE, -20) }));
    expect(p).toMatchObject({
      neu: true,
      erledigt: NACHWEIS_AUFGABE_ERSTE,
      verschieben: 'naechste',
    });
  });
  it('Gültig bis heute oder früher: nie verschieben (ChurchTools will ein Datum nach heute)', () => {
    // Ausgestellt vor 3 Jahren und einem Tag → Gültig bis gestern; vor genau 3 Jahren → heute.
    for (const tage of [1, 0]) {
      const p = einsichtPlan(eingabe({ ausgestelltAm: plusJahre(plusTage(HEUTE, -tage), -3) }));
      expect(p.gueltigBis).toBe(plusTage(HEUTE, -tage));
      expect(p.verschiebenAuf).toBeNull();
      expect(p.verschieben).toBeNull();
    }
    // Morgen ist erlaubt.
    expect(
      einsichtPlan(eingabe({ ausgestelltAm: plusJahre(plusTage(HEUTE, 1), -3) })).verschiebenAuf,
    ).toBe(plusTage(HEUTE, 1));
  });
});

describe('einsichtVorbelegung', () => {
  const alt = {
    eingesehenAm: '2024-01-05',
    ausgestelltAm: '2023-12-28',
    ergebnis: 'ohne' as const,
  };
  const stand = (art: NachweisStand['art']) => ({ art, bis: HEUTE }) as NachweisStand;
  it('keine Einsicht: heute, Ausgestellt und Ergebnis leer', () => {
    const leer = { eingesehenAm: null, ausgestelltAm: null, ergebnis: null };
    expect(einsichtVorbelegung(leer, { art: 'angefordert', seit: HEUTE }, HEUTE)).toEqual({
      eingesehenAm: HEUTE,
      ausgestelltAm: '',
      ergebnis: '',
    });
  });
  it('läuft ab / abgelaufen: neue Einsicht mit dem bisherigen Ergebnis', () => {
    for (const art of ['laeuftAb', 'abgelaufen'] as const)
      expect(einsichtVorbelegung(alt, stand(art), HEUTE)).toEqual({
        eingesehenAm: HEUTE,
        ausgestelltAm: '',
        ergebnis: 'ohne',
      });
  });
  it('gültig, Rücksprache, unvollständig: die gespeicherten Werte', () => {
    for (const art of ['gueltig', 'ruecksprache', 'unvollstaendig'] as const)
      expect(einsichtVorbelegung(alt, stand(art), HEUTE)).toEqual({
        eingesehenAm: '2024-01-05',
        ausgestelltAm: '2023-12-28',
        ergebnis: 'ohne',
      });
  });
});

describe('einsichtFehler', () => {
  const ok = { eingesehenAm: HEUTE, ausgestelltAm: plusTage(HEUTE, -2), ergebnis: 'ohne' as const };
  it('jeder Prüftext einzeln', () => {
    expect(einsichtFehler(ok, 'ausstellung', HEUTE)).toBeNull();
    expect(einsichtFehler({ ...ok, eingesehenAm: '' }, 'ausstellung', HEUTE)).toBe(
      'Bitte eintragen, wann du das Zeugnis gesehen hast.',
    );
    expect(einsichtFehler({ ...ok, eingesehenAm: plusTage(HEUTE, 1) }, 'ausstellung', HEUTE)).toBe(
      '„Eingesehen am“ liegt in der Zukunft.',
    );
    expect(einsichtFehler({ ...ok, ausgestelltAm: '' }, 'ausstellung', HEUTE)).toBe(
      'Bitte das Datum auf dem Zeugnis eintragen.',
    );
    expect(einsichtFehler({ ...ok, ausgestelltAm: plusTage(HEUTE, 1) }, 'ausstellung', HEUTE)).toBe(
      'Das Zeugnis kann nicht nach der Einsicht ausgestellt sein.',
    );
    expect(einsichtFehler({ ...ok, ergebnis: '' }, 'ausstellung', HEUTE)).toBe(
      'Bitte ein Ergebnis wählen.',
    );
  });
  it('ab Einsicht ist „Ausgestellt am“ freiwillig, aber nie nach der Einsicht', () => {
    expect(einsichtFehler({ ...ok, ausgestelltAm: '' }, 'einsicht', HEUTE)).toBeNull();
    expect(
      einsichtFehler({ ...ok, ausgestelltAm: plusTage(HEUTE, 1) }, 'einsicht', HEUTE),
    ).not.toBeNull();
  });
});

describe('einsichtFolgeTexte', () => {
  const plan = (a: Partial<Parameters<typeof einsichtPlan>[0]> = {}) =>
    einsichtPlan({
      einstellungen: E,
      eingesehenAm: HEUTE,
      ausgestelltAm: plusTage(HEUTE, -5),
      aufgabe: { titel: NACHWEIS_AUFGABE_ERSTE, angelegt: plusTage(HEUTE, -10) },
      heute: HEUTE,
      ...a,
    });
  const bis = (p: ReturnType<typeof plan>) => tagPunkt(p.gueltigBis!);
  it('neue Einsicht: erledigt die Aufgabe, die nächste bekommt das Datum', () => {
    const p = plan();
    expect(einsichtFolgeTexte(p, E, 'ohne', null)).toEqual([
      `Neue Einsicht · gültig bis ${bis(p)} (3 Jahre ab Ausstellung).`,
      `Die Aufgabe „Einsicht nehmen“ wird erledigt. Die nächste „Erneut einsehen“ bekommt den ${bis(p)}.`,
    ]);
  });
  it('Berichtigung bei „Erneut einsehen“: keine Aufgabe erledigt, die offene behält das neue Datum', () => {
    const p = plan({
      eingesehenAm: plusTage(HEUTE, -20),
      aufgabe: { titel: NACHWEIS_AUFGABE_ERNEUT, angelegt: plusTage(HEUTE, -10) },
    });
    expect(einsichtFolgeTexte(p, E, 'ohne', null)).toEqual([
      `Nur die Angaben werden berichtigt · gültig bis ${bis(p)} (3 Jahre ab Ausstellung).`,
      `Keine Aufgabe wird erledigt; „Erneut einsehen“ bleibt offen, Datum ${bis(p)}.`,
    ]);
  });
  it('Eintragung: Stand bleibt Rücksprache; von Eintragung zu ohne: wieder grün', () => {
    expect(einsichtFolgeTexte(plan(), E, 'eintrag', null).at(-1)).toBe(
      'Stand bleibt „Rücksprache“ (rot), bis jemand das Ergebnis nach dem Gespräch ändert.',
    );
    expect(einsichtFolgeTexte(plan(), E, 'ohne', 'eintrag').at(-1)).toBe(
      'Danach ist der Stand wieder grün, die Rücksprache ist erledigt.',
    );
    expect(einsichtFolgeTexte(plan(), E, 'ohne', 'ohne')).toHaveLength(2);
  });
  it('Gültig bis nicht nach heute: kein Satz über ein Datum für die nächste Aufgabe', () => {
    const p = plan({ ausgestelltAm: plusJahre(HEUTE, -3) });
    expect(einsichtFolgeTexte(p, E, 'ohne', null)[1]).toBe(
      'Die Aufgabe „Einsicht nehmen“ wird erledigt.',
    );
  });
});

describe('Stand für die Leitung (N3a, E26): nur „gültig bis“, offen oder rot – nie das Ergebnis', () => {
  /** Über die eine Regel: Person → `personStand` → `standFuerLeitung`. */
  const leitung = (p: PersonAngaben) => standFuerLeitung(stand(p));
  const ruecksprache = { ergebnis: 'eintrag' as const };

  it('gültig, läuft ab, abgelaufen: der Tag „gültig bis“ aus dem Stand', () => {
    for (const tage of [LAEUFT_AB_TAGE + 1, LAEUFT_AB_TAGE, -1]) {
      const p = mitAblauf(tage);
      expect(leitung(p)).toBe(personStand(p, E, HEUTE).gueltigBis);
      expect(leitung(p)).toBe(plusTage(HEUTE, tage));
    }
  });

  it('Rücksprache mit Datum: rot, NICHT „gültig bis“ (sonst sähe die Leitung grün)', () => {
    const p = mitAblauf(LAEUFT_AB_TAGE + 100, ruecksprache);
    expect(personStand(p, E, HEUTE).gueltigBis).not.toBeNull();
    expect(leitung(p)).toBe('rot');
  });

  it('Rücksprache ohne Einsicht ist ebenfalls rot', () => {
    expect(leitung(person(ruecksprache))).toBe('rot');
  });

  it('fehlt (Aufgabe älter als 4 Wochen): rot – derselbe Wert wie Rücksprache, rot verrät kein Ergebnis', () => {
    const p = person({ aufgabe: { seit: plusTage(HEUTE, -(FEHLT_NACH_TAGEN + 1)) } });
    expect(stand(p).art).toBe('fehlt');
    expect(leitung(p)).toBe(leitung(person(ruecksprache)));
  });

  it('angefordert, noch keine Aufgabe, Angaben unvollständig: offen', () => {
    expect(leitung(person({ aufgabe: { seit: HEUTE } }))).toBe('offen');
    expect(leitung(person())).toBe('offen');
    const unvollstaendig = person({ eingesehenAm: '2026-01-01' });
    expect(stand(unvollstaendig).art).toBe('unvollstaendig');
    expect(leitung(unvollstaendig)).toBe('offen');
  });
});
