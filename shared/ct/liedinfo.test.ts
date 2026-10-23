import { describe, expect, it } from 'vitest';
import { metaValue, metaWerte } from './chordproMeta';
import {
  LIEDINFO_ZEILE,
  LIEDINFO_FELDER,
  liedinfoAusDatei,
  liedinfoVergleich,
  liedinfoZeilenEntfernen,
} from './liedinfo';

/** Lied-Editor L4 (23.10.2026): Liedinfo aus der Datei nach ChurchTools umräumen, ohne etwas zu verlieren. */

// So kommt ein SongSelect-Notenblatt an (Alwins iPad-Foto, „Allein deine Gnade genügt“).
const SONGSELECT = `{title: Allein deine Gnade genügt}
{artist: Martin Nystrom}
{artist: Deutsch: Martin Pepper, Ken Janz}
{key: G}
{tempo: 80}
{time: 4/4}
{ccli_license: 2395145}
{ccli: 5282557}
{copyright: 1991 Integrity's Hosanna! Music}
{footer: For use solely with the SongSelect® Terms of Use.}

{comment: Chorus}
Al - [G]lein Deine [Am7]Gnade ge - [G2/B]nügt`;

describe('metaWerte', () => {
  it('alle nicht-leeren Werte in Dateireihenfolge; metaValue bleibt der erste', () => {
    expect(metaWerte(SONGSELECT, 'artist')).toEqual([
      'Martin Nystrom',
      'Deutsch: Martin Pepper, Ken Janz',
    ]);
    expect(metaValue(SONGSELECT, 'artist')).toBe('Martin Nystrom');
    expect(metaWerte('{title: }\n{title: Treu}', 'title')).toEqual(['Treu']);
  });
  it('{ccli} ist nicht {ccli_license}', () => {
    expect(metaWerte(SONGSELECT, 'ccli')).toEqual(['5282557']);
  });
});

describe('liedinfoAusDatei', () => {
  it('liest jedes Feld; zwei Autor-Zeilen gehen beide mit', () => {
    expect(liedinfoAusDatei(SONGSELECT)).toEqual({
      name: 'Allein deine Gnade genügt',
      author: 'Martin Nystrom / Deutsch: Martin Pepper, Ken Janz',
      ccli: '5282557',
      copyright: "1991 Integrity's Hosanna! Music",
      tempo: '80',
      beat: '4/4',
    });
  });
  it('{key} gehört nicht dazu – notierte Tonart (#398)', () => {
    expect(LIEDINFO_FELDER.map((f) => f.zeile)).not.toContain('key');
  });
});

describe('liedinfoVergleich', () => {
  it('leer / gleich / vorbelegen / abweichung', () => {
    const v = liedinfoVergleich(
      { name: 'Treu (Akustik)', author: 'Gerster', tempo: '72', beat: '4/4' },
      { name: 'Treu', author: ' Gerster ', tempo: '72', beat: '', ccli: '123' },
    );
    const art = Object.fromEntries(v.map((x) => [x.feld, x.art]));
    expect(art).toEqual({
      name: 'abweichung',
      author: 'gleich',
      ccli: 'leer',
      copyright: 'leer',
      tempo: 'gleich',
      beat: 'vorbelegen',
    });
    expect(v.find((x) => x.feld === 'name')).toMatchObject({ datei: 'Treu (Akustik)', ct: 'Treu' });
  });
  it('Tempo als Zahl', () => {
    expect(liedinfoVergleich({ tempo: '72' }, { tempo: '72.0' })[4].art).toBe('gleich');
  });
});

describe('liedinfoZeilenEntfernen', () => {
  it('entfernt nur Felder, die ChurchTools hat – {key} und SongSelect-Zeilen bleiben, Rest Zeichen für Zeichen', () => {
    const neu = liedinfoZeilenEntfernen(SONGSELECT, {
      name: 'Allein deine Gnade genügt',
      author: 'Martin Nystrom',
      ccli: '5282557',
      copyright: '',
      tempo: '80',
      beat: '4/4',
    });
    expect(neu).toBe(`{key: G}
{ccli_license: 2395145}
{copyright: 1991 Integrity's Hosanna! Music}
{footer: For use solely with the SongSelect® Terms of Use.}

{comment: Chorus}
Al - [G]lein Deine [Am7]Gnade ge - [G2/B]nügt`);
  });
  it('ohne ChurchTools-Wert (leer, keine Rechte, Speichern gescheitert) bleibt alles', () => {
    expect(liedinfoZeilenEntfernen(SONGSELECT, {})).toBe(SONGSELECT);
    expect(liedinfoZeilenEntfernen(SONGSELECT, { author: '  ' })).toBe(SONGSELECT);
  });
  it('Windows-Zeilenenden und die letzte Zeile ohne Umbruch', () => {
    expect(
      liedinfoZeilenEntfernen('{title: A}\r\nText\r\n{tempo: 70}', { name: 'A', tempo: '70' }),
    ).toBe('Text\r\n');
  });
  it('eine Angabe mitten im Text (kein ChordPro-Kopf) bleibt stehen', () => {
    const t = 'Vers {title: kein Kopf} weiter';
    expect(liedinfoZeilenEntfernen(t, { name: 'X' })).toBe(t);
  });
});

describe('LIEDINFO_ZEILE – dieselbe Grammatik wie das Entfernen', () => {
  it('erkennt genau die Zeilen, die beim Speichern gehen können', () => {
    const zeilen = SONGSELECT.split('\n');
    const erkannt = zeilen.filter((z) => LIEDINFO_ZEILE.test(z));
    const allesWeg = liedinfoZeilenEntfernen(SONGSELECT, {
      name: 'x',
      author: 'x',
      ccli: 'x',
      copyright: 'x',
      tempo: '1',
      beat: 'x',
    }).split('\n');
    expect(erkannt).toEqual(zeilen.filter((z) => !allesWeg.includes(z)));
    expect(erkannt).toHaveLength(7);
  });
});
