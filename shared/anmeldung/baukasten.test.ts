import { describe, expect, it } from 'vitest';
import {
  EMPFOHLEN,
  bausteinFeld,
  bereichVon,
  einordnen,
  naechsteId,
  neueFeldKennung,
  verschiebbar,
} from './baukasten';
import { standardFormular, type Formular } from './formular';

const ids = (f: Formular) => ({
  anmeldung: f.anmeldung.map((x) => x.id),
  person: f.person.map((x) => x.id),
});

describe('Baukasten: einordnen (A5)', () => {
  const grund = () => {
    const f = standardFormular();
    f.person.push(bausteinFeld('text', 'f1'), bausteinFeld('janein', 'f2'));
    return f;
  };

  it('vor ein Feld, ans Ende und in den anderen Bereich', () => {
    let f = einordnen(grund(), 'f2', 'person', 'f1');
    expect(ids(f).person).toEqual(['pname', 'birth', 'allergy', 'foto', 'f2', 'f1']);
    f = einordnen(f, 'f2', 'anmeldung', null);
    // Ende der Anmeldung = vor Bemerkungen, Preis und Datenschutz.
    expect(ids(f).anmeldung).toEqual(['name', 'mail', 'tel', 'f2', 'note', 'price', 'priv']);
    expect(ids(f).person).not.toContain('f2');
  });

  it('alles ist verschiebbar – auch Name und E-Mail (Alwin: „Ich möchte alles verschieben können“)', () => {
    expect(ids(einordnen(grund(), 'mail', 'anmeldung', 'name')).anmeldung).toEqual([
      'mail',
      'name',
      'tel',
      'note',
      'price',
      'priv',
    ]);
    expect(ids(einordnen(grund(), 'f1', 'person', 'pname')).person[0]).toBe('f1');
    // Name, E-Mail und der Name jeder Person bleiben in ihrem Bereich.
    expect(ids(einordnen(grund(), 'mail', 'person', null)).anmeldung).toContain('mail');
    expect(ids(einordnen(grund(), 'pname', 'anmeldung', null)).person).toContain('pname');
  });

  it('Preis und Datenschutz bleiben am Ende – auch wenn dahinter abgelegt wird', () => {
    expect(ids(einordnen(grund(), 'f1', 'anmeldung', 'priv')).anmeldung).toEqual([
      'name',
      'mail',
      'tel',
      'note',
      'f1',
      'price',
      'priv',
    ]);
  });

  it('„ans Ende“ = vor die Bemerkungen; die Bemerkungen selbst wirklich ans Ende', () => {
    expect(ids(einordnen(grund(), 'f1', 'anmeldung', null)).anmeldung).toEqual([
      'name',
      'mail',
      'tel',
      'f1',
      'note',
      'price',
      'priv',
    ]);
    const f = einordnen(grund(), 'note', 'anmeldung', 'name');
    expect(ids(f).anmeldung[0]).toBe('note');
    expect(ids(einordnen(f, 'note', 'anmeldung', null)).anmeldung).toEqual([
      'name',
      'mail',
      'tel',
      'note',
      'price',
      'priv',
    ]);
  });

  it('Preis und Datenschutz bewegen sich nicht', () => {
    const f = grund();
    for (const id of ['price', 'priv']) expect(einordnen(f, id, 'person', null)).toBe(f);
  });

  it('neues Feld wird eingefügt; ein unbekanntes ohne Feld ändert nichts', () => {
    const f = grund();
    const neu = bausteinFeld('date', 'f3');
    expect(ids(einordnen(f, 'f3', 'person', 'f1', neu)).person).toEqual([
      'pname',
      'birth',
      'allergy',
      'foto',
      'f3',
      'f1',
      'f2',
    ]);
    expect(einordnen(f, 'gibtsnicht', 'person', null)).toBe(f);
  });

  it('Geburtsdatum gehört zur Person, Bemerkungen zur Anmeldung – egal wohin gezogen', () => {
    const f = standardFormular();
    f.person = f.person.filter((x) => x.id !== 'birth');
    f.anmeldung = f.anmeldung.filter((x) => x.id !== 'note');
    const birth = EMPFOHLEN.find((x) => x.id === 'birth')!.feld;
    const note = EMPFOHLEN.find((x) => x.id === 'note')!.feld;
    const mitBirth = einordnen(f, 'birth', 'anmeldung', 'tel', birth);
    expect(bereichVon(mitBirth, 'birth')).toBe('person');
    const mitNote = einordnen(f, 'note', 'person', 'pname', note);
    expect(ids(mitNote).anmeldung).toEqual(['name', 'mail', 'tel', 'note', 'price', 'priv']);
  });

  it('verschiebbar, naechsteId, neue Kennung', () => {
    const f = grund();
    expect(f.anmeldung.filter(verschiebbar).map((x) => x.id)).toEqual([
      'name',
      'mail',
      'tel',
      'note',
    ]);
    expect(naechsteId(f, 'f1')).toBe('f2');
    expect(naechsteId(f, 'f2')).toBeNull();
    expect(neueFeldKennung(f)).toBe('f3');
  });
});

describe('Empfohlene Bausteine (A5)', () => {
  it('feste Kennungen, je einmal; aus dem Grundformular übernommen, eingeschaltet', () => {
    const kennungen = EMPFOHLEN.map((x) => x.id);
    expect(new Set(kennungen).size).toBe(kennungen.length);
    const grund = standardFormular();
    for (const x of EMPFOHLEN) {
      expect(x.feld.id).toBe(x.id);
      expect(x.feld.art).toBe('standard');
      // Pflicht beim Einfügen: Geburtsdatum (Preise nach Alter) und die Bausteine für Kinder-Events (A6-2b).
      expect(x.feld.zustand).toBe(
        ['birth', 'eltern', 'sign'].includes(x.id) ? 'pflicht' : 'freiwillig',
      );
      const imGrund = [...grund.anmeldung, ...grund.person].find((f) => f.id === x.id);
      if (imGrund) expect(x.feld.frage).toBe(imGrund.frage);
    }
  });
});

describe('Neue Bausteine (A5)', () => {
  it('Auswahl mit zwei Antworten, Trennlinie ohne Text, Hinweis mit Mustertext', () => {
    expect(bausteinFeld('radio', 'f1').antworten).toHaveLength(2);
    expect(bausteinFeld('trenner', 'f1').frage).toBe('');
    expect(bausteinFeld('info', 'f1').hilfe).not.toBe('');
    expect(bausteinFeld('text', 'f1')).toMatchObject({ art: 'eigen', zustand: 'freiwillig' });
  });
});
