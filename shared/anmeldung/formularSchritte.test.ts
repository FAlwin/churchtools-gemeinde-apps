import { describe, expect, it } from 'vitest';
import {
  ERSTER_SCHRITT,
  ctAblage,
  nurText,
  einstellungenAlsText,
  einstellungenLesen,
  feldFehler,
  pruefeAntworten,
  pruefeFormular,
  standardFormular,
  type Antworten,
  type Feld,
  type Formular,
} from './formular';
import {
  amEnde,
  bedingungFehler,
  feldSichtbar,
  leeren,
  schrittVon,
  type Bedingung,
} from './bedingungen';
import { amEnde as amEndeBaukasten } from './baukasten';
import {
  gezeigteSeiten,
  mitSchritten,
  schrittName,
  seiteFehlt,
  seiteSichtbar,
  seiten,
} from './formularSchritte';
import { neueEinstellungen } from './vorlagen';
import { fragen } from './druckliste';

/** F2a – das Formular in Schritten (Entwurf f2-schritte-v1, Klick-Runden 7 und 8 am 16.11.2026). */

function frage(id: string, typ: Feld['typ'], extra: Partial<Feld> = {}): Feld {
  return {
    id,
    art: 'eigen',
    typ,
    frage: typ === 'schritt' ? `Schritt ${id}` : `Frage ${id}`,
    hilfe: '',
    zustand: 'freiwillig',
    antworten: [],
    ...extra,
  };
}
const wenn = (feld: string, op: Bedingung['regeln'][number]['op'], wert?: string): Bedingung => ({
  modus: 'eine',
  regeln: [{ feld, op, ...(wert === undefined ? {} : { wert }) }],
});
const feld = (f: Formular, id: string) => [...f.anmeldung, ...f.person].find((x) => x.id === id)!;
const ids = (xs: Feld[]) => xs.map((x) => x.id);

/**
 * Wie im Entwurf: Schritt 1 (Kontakt), „Wer kommt mit“ (Mitarbeit? + Personen), „Mitarbeit“ (nur wenn Ja, je Person
 * „Bereich“), „Abschluss“ (je Person „Allergien“). Preis und Datenschutz am Ende des Kontakt-Teils.
 */
function freizeit(): Formular {
  const s = standardFormular({ geburtsdatum: true });
  const [name, mail, tel, note, price, priv] = s.anmeldung;
  const [pname, birth, allergy] = s.person;
  return {
    anmeldung: [
      name,
      mail,
      tel,
      note,
      frage('s2', 'schritt', { frage: 'Wer kommt mit' }),
      frage('mit', 'janein', { zustand: 'pflicht' }),
      price,
      priv,
    ],
    person: [
      pname,
      birth,
      frage('s3', 'schritt', { frage: 'Mitarbeit', bed: wenn('mit', 'ist', 'Ja') }),
      frage('bereich', 'radio', { antworten: ['Küche', 'Technik'], zustand: 'pflicht' }),
      frage('s4', 'schritt', { frage: 'Abschluss' }),
      allergy,
    ],
  };
}
const kontakt = { name: { vor: 'Maria', nach: 'Beispiel' }, mail: 'maria@beispiel.test' };
const antworten = (
  anmeldung: Antworten['anmeldung'] = {},
  personen: Antworten['personen'] = [
    { pname: { vor: 'Maria', nach: 'Beispiel' }, birth: '1988-04-12' },
  ],
): Antworten => ({ anmeldung: { ...kontakt, ...anmeldung }, personen });

describe('seiten – welche Felder auf welcher Seite stehen', () => {
  it('ohne Schritte genau eine Seite – alles außer Preis und Datenschutz', () => {
    const f = standardFormular();
    expect(mitSchritten(f)).toBe(false);
    const s = seiten(f);
    expect(s).toHaveLength(1);
    expect(s[0].schritt).toBeNull();
    expect(ids(s[0].anmeldung)).toEqual(['name', 'mail', 'tel', 'note']);
    expect(ids(s[0].person)).toEqual(ids(f.person));
  });

  it('Schritte im Kontakt- und im Personen-Teil teilen die Felder auf; die Bausteine selbst stehen auf keiner Seite', () => {
    const f = freizeit();
    expect(mitSchritten(f)).toBe(true);
    expect(seiten(f).map((s) => [s.schritt?.id ?? null, ids(s.anmeldung), ids(s.person)])).toEqual([
      [null, ['name', 'mail', 'tel', 'note'], []],
      ['s2', ['mit'], ['pname', 'birth']],
      ['s3', [], ['bereich']],
      ['s4', [], ['allergy']],
    ]);
  });

  it('ein ausgeschalteter Schritt zählt nicht – seine Felder gehören zum Schritt davor', () => {
    const f = freizeit();
    feld(f, 's3').zustand = 'aus';
    expect(seiten(f).map((s) => s.schritt?.id ?? null)).toEqual([null, 's2', 's4']);
    expect(ids(seiten(f)[1].person)).toEqual(['pname', 'birth', 'bereich']);
    expect(schrittVon(f, feld(f, 'bereich'))?.id).toBe('s2');
  });

  it('schrittVon: der Baustein davor; je Person zuerst im Personen-Teil, sonst im Kontakt-Teil', () => {
    const f = freizeit();
    expect(schrittVon(f, feld(f, 'tel'))).toBeNull();
    expect(schrittVon(f, feld(f, 'mit'))?.id).toBe('s2');
    expect(schrittVon(f, feld(f, 'birth'))?.id).toBe('s2');
    expect(schrittVon(f, feld(f, 'bereich'))?.id).toBe('s3');
    expect(schrittVon(f, feld(f, 'allergy'))?.id).toBe('s4');
    // Preis, Datenschutz und die Schritte selbst gehören zu keinem Schritt.
    expect(schrittVon(f, feld(f, 'priv'))).toBeNull();
    expect(schrittVon(f, feld(f, 'price'))).toBeNull();
    expect(schrittVon(f, feld(f, 's3'))).toBeNull();
  });

  it('amEnde ist dieselbe Regel im Regel-Baustein und im Baukasten', () => {
    expect(amEndeBaukasten).toBe(amEnde);
  });
});

describe('Schritt mit Bedingung – übersprungen', () => {
  it('ohne „Ja“ wird „Mitarbeit“ übersprungen: Seite weg, Felder nicht zu sehen, Pflicht entfällt', () => {
    const f = freizeit();
    const a = antworten({ mit: 'Nein' });
    expect(seiteSichtbar(f, seiten(f)[2], a)).toBe(false);
    expect(gezeigteSeiten(f, a).map((s) => s.schritt?.id ?? null)).toEqual([null, 's2', 's4']);
    expect(feldSichtbar(f, feld(f, 'bereich'), a, 0)).toBe(false);
    expect(pruefeAntworten(f, a)).not.toContain('personen.0.bereich');
    // Mit „Ja“ ist sie da – und Pflicht.
    const ja = antworten({ mit: 'Ja' });
    expect(gezeigteSeiten(f, ja)).toHaveLength(4);
    expect(feldSichtbar(f, feld(f, 'bereich'), ja, 0)).toBe(true);
    expect(pruefeAntworten(f, ja)).toContain('personen.0.bereich');
  });

  it('beim Absenden wird geleert, was in einem übersprungenen Schritt steht', () => {
    const f = freizeit();
    const a = antworten({ mit: 'Nein' }, [
      { pname: { vor: 'Maria', nach: 'Beispiel' }, bereich: 'Technik', allergy: 'Nüsse' },
    ]);
    const l = leeren(f, a);
    expect(l.personen[0].bereich).toBeUndefined();
    expect(l.personen[0].allergy).toBe('Nüsse');
  });

  it('Datenschutz bleibt Pflicht, auch wenn der letzte Schritt übersprungen wird', () => {
    const f = freizeit();
    // Der letzte Schritt im Kontakt-Teil („Wer kommt mit“) bekommt eine Bedingung, die nicht erfüllt ist.
    feld(f, 's2').bed = wenn('tel', 'ausgefuellt');
    const a = antworten();
    expect(feldSichtbar(f, feld(f, 'mit'), a)).toBe(false);
    expect(feldSichtbar(f, feld(f, 'priv'), a)).toBe(true);
    expect(pruefeAntworten(f, a)).toContain('anmeldung.priv');
  });

  it('ein Schritt bei den Fragen je Person: gezeigt, wenn er für eine Person gilt; die Felder je Person', () => {
    const f = freizeit();
    feld(f, 's4').bed = wenn('birth', 'ausgefuellt');
    // Erst Jonas (ohne Geburtsdatum), dann Maria – es genügt, wenn er für irgendeine Person gilt, nicht nur die erste.
    const a = antworten({ mit: 'Nein' }, [
      { pname: { vor: 'Jonas', nach: 'Beispiel' } },
      { pname: { vor: 'Maria', nach: 'Beispiel' }, birth: '1988-04-12' },
    ]);
    expect(seiteSichtbar(f, seiten(f)[3], a)).toBe(true);
    expect(feldSichtbar(f, feld(f, 'allergy'), a, 0)).toBe(false);
    expect(feldSichtbar(f, feld(f, 'allergy'), a, 1)).toBe(true);
    // Keine Person erfüllt sie → die Seite fällt weg.
    const keiner = antworten({ mit: 'Nein' }, [{ pname: { vor: 'Jonas', nach: 'Beispiel' } }]);
    expect(seiteSichtbar(f, seiten(f)[3], keiner)).toBe(false);
  });

  it('die Bedingung eines Schritts darf nur auf Fragen davor schauen – sonst kaputt', () => {
    const f = freizeit();
    feld(f, 's2').bed = wenn('allergy', 'ausgefuellt');
    expect(bedingungFehler(f).join(' ')).toMatch(/muss davor stehen/);
  });

  it('eine Frage in einem übersprungenen Schritt taugt nicht als Bedingung (gilt als nicht beantwortet)', () => {
    const f = freizeit();
    feld(f, 'allergy').bed = wenn('bereich', 'ist', 'Technik');
    const a = antworten({ mit: 'Nein' }, [
      { pname: { vor: 'Maria', nach: 'B' }, bereich: 'Technik' },
    ]);
    expect(feldSichtbar(f, feld(f, 'allergy'), a, 0)).toBe(false);
  });
});

describe('seiteFehlt – Pflicht je Seite', () => {
  it('nur die Felder dieser Seite; Datenschutz erst auf der letzten', () => {
    const f = freizeit();
    const leer: Antworten = { anmeldung: {}, personen: [{}] };
    const s = seiten(f);
    expect(seiteFehlt(f, leer, s[0], false)).toEqual([
      'anmeldung.name.vor',
      'anmeldung.name.nach',
      'anmeldung.mail',
    ]);
    expect(seiteFehlt(f, leer, s[1], false)).toEqual([
      'anmeldung.mit',
      'personen.0.pname.vor',
      'personen.0.pname.nach',
      'personen.0.birth',
    ]);
    expect(seiteFehlt(f, leer, s[3], false)).toEqual([]);
    expect(seiteFehlt(f, leer, s[3], true)).toEqual(['anmeldung.priv']);
  });

  it('keine Person angelegt: fehlt auf der Seite mit Fragen je Person', () => {
    const f = freizeit();
    const a: Antworten = { anmeldung: { ...kontakt, mit: 'Nein' }, personen: [] };
    expect(seiteFehlt(f, a, seiten(f)[0], false)).toEqual([]);
    expect(seiteFehlt(f, a, seiten(f)[1], false)).toEqual(['personen']);
  });

  it('alle Seiten zusammen fehlen genau das, was beim Absenden fehlt', () => {
    const f = freizeit();
    const a: Antworten = { anmeldung: { mit: 'Ja' }, personen: [{}, {}] };
    const gezeigt = gezeigteSeiten(f, a);
    const jeSeite = gezeigt.flatMap((s, i) => seiteFehlt(f, a, s, i === gezeigt.length - 1));
    expect([...jeSeite].sort()).toEqual([...pruefeAntworten(f, a)].sort());
  });
});

describe('Ein Schritt ist ein Text-Baustein', () => {
  it('keine Spalte in ChurchTools, keine Spalte in Druckliste und Tabelle', () => {
    const e = neueEinstellungen('freizeit');
    e.formular = freizeit();
    expect(ctAblage(feld(e.formular, 's2'))).toEqual({ ort: 'keins' });
    expect(nurText('schritt')).toBe(true);
    const spalten = ids(fragen(e));
    expect(spalten).toContain('mit');
    expect(spalten.some((x) => x.startsWith('s') && /^s\d$/.test(x))).toBe(false);
  });
});

describe('Name und Speichern', () => {
  it('Schritt 1 heißt „Deine Angaben“, bis ein Name eingetragen ist; die übrigen heißen wie ihr Baustein', () => {
    const f = freizeit();
    const [eins, zwei] = seiten(f);
    expect(schrittName({}, eins)).toBe(ERSTER_SCHRITT);
    expect(schrittName({ ersterSchritt: '  ' }, eins)).toBe(ERSTER_SCHRITT);
    expect(schrittName({ ersterSchritt: 'Kontakt' }, eins)).toBe('Kontakt');
    expect(schrittName({ ersterSchritt: 'Kontakt' }, zwei)).toBe('Wer kommt mit');
  });

  it('ohne Namen wird ein Schritt nicht gespeichert', () => {
    const f = freizeit();
    feld(f, 's4').frage = ' ';
    expect(feldFehler(feld(f, 's4'))).toBe('Bitte einen Namen für den Schritt eintragen.');
    expect(pruefeFormular(f)).toContain('Bitte einen Namen für den Schritt eintragen.');
  });

  it('Schritte und der Name von Schritt 1 überstehen das Speichern in der Beschreibung', () => {
    const e = neueEinstellungen('freizeit');
    e.formular = freizeit();
    e.ersterSchritt = 'Kontakt';
    const zurueck = einstellungenLesen(einstellungenAlsText(e))!;
    expect(zurueck.ersterSchritt).toBe('Kontakt');
    expect(seiten(zurueck.formular).map((s) => s.schritt?.frage ?? null)).toEqual([
      null,
      'Wer kommt mit',
      'Mitarbeit',
      'Abschluss',
    ]);
    expect(feld(zurueck.formular, 's3').bed).toEqual(wenn('mit', 'ist', 'Ja'));
  });
});
