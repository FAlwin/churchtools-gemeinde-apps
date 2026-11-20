import { describe, expect, it } from 'vitest';
import {
  FARBFELDER,
  farbeGilt,
  farbeSetzen,
  hauptTiefAbgeleitet,
  hexAusEingabe,
  kontrastHinweise,
  schriftSetzen,
  verhaeltnisText,
} from './aussehen';
import { einstellungenSchema } from './modell';
import { SCHRIFTEN, schriftDateien } from './schriften';
import { NEUTRALE_FARBEN, KONTRAST_MINDEST, kontrast, themeCss } from './theme';
import { einstellungen } from './website.testdaten';

const auswahl = (name: string) => ({ art: 'auswahl' as const, name });

describe('hexAusEingabe', () => {
  it.each([
    ['#1F4E79', '#1f4e79'],
    ['1f4e79', '#1f4e79'],
    ['  #abc ', '#abc'],
  ])('%s → %s', (roh, soll) => expect(hexAusEingabe(roh)).toBe(soll));

  it.each(['', '#', '#12', '#12345', '#1234567', '#ggg', 'rot', '#1f4e79; x', 'javascript:1'])(
    '„%s“ ist keine Farbe',
    (roh) => expect(hexAusEingabe(roh)).toBeNull(),
  );
});

describe('farbeSetzen', () => {
  it('beim ersten Mal füllt es die Pflichtfarben mit den geltenden Werten – das Ergebnis besteht das Schema', () => {
    const neu = farbeSetzen(einstellungen(), 'haupt', '#112233');
    expect(neu.farben).toEqual({ ...NEUTRALE_FARBEN, haupt: '#112233' });
    expect(einstellungenSchema.safeParse(neu).success).toBe(true);
  });

  it('jede der sechs Farben lässt sich setzen, und nur diese ändert sich', () => {
    for (const { schluessel } of FARBFELDER) {
      const neu = farbeSetzen(einstellungen(), schluessel, '#010203');
      expect(neu.farben?.[schluessel]).toBe('#010203');
      expect(einstellungenSchema.safeParse(neu).success).toBe(true);
      for (const andere of FARBFELDER)
        if (andere.schluessel !== schluessel && andere.schluessel !== 'hauptTief')
          expect(farbeGilt(neu, andere.schluessel)).toBe(NEUTRALE_FARBEN[andere.schluessel]);
    }
  });

  it('die dunkle Hauptfarbe lässt sich zurücknehmen (dann wird sie abgeleitet), die anderen nicht', () => {
    const mit = farbeSetzen(einstellungen(), 'hauptTief', '#001122');
    expect(farbeGilt(mit, 'hauptTief')).toBe('#001122');
    const ohne = farbeSetzen(mit, 'hauptTief', null);
    expect(ohne.farben?.hauptTief).toBeUndefined();
    expect(farbeGilt(ohne, 'hauptTief')).toBe(hauptTiefAbgeleitet(NEUTRALE_FARBEN.haupt));
    expect(farbeSetzen(mit, 'text', null)).toBe(mit);
  });

  it('die abgeleitete dunkle Farbe ist dieselbe wie im Theme (color-mix 70 % Hauptfarbe, 30 % Schwarz)', () => {
    expect(hauptTiefAbgeleitet('#ffffff')).toBe('#b3b3b3');
    expect(hauptTiefAbgeleitet('#fff')).toBe('#b3b3b3');
    expect(hauptTiefAbgeleitet('#000000')).toBe('#000000');
    // Gegenprobe am Erzeuger: das Theme schreibt genau diese Rechnung
    expect(themeCss(einstellungen(), { schriftAdresse: () => 'x' })).toContain(
      'color-mix(in srgb, var(--farbe-haupt) 70%, #000)',
    );
  });
});

describe('schriftSetzen', () => {
  it('die erste Wahl gilt für Text UND Überschriften (das Schema verlangt beide)', () => {
    const neu = schriftSetzen(einstellungen(), 'ueberschrift', auswahl('Lora'));
    expect(neu.schriften).toEqual({ text: auswahl('Lora'), ueberschrift: auswahl('Lora') });
    expect(einstellungenSchema.safeParse(neu).success).toBe(true);
  });

  it('danach wird nur die gewählte Rolle geändert', () => {
    const a = schriftSetzen(einstellungen(), 'text', auswahl('Lora'));
    const b = schriftSetzen(a, 'ueberschrift', auswahl('Inter'));
    const c = schriftSetzen(b, 'akzent', auswahl('Caveat'));
    expect(c.schriften).toEqual({
      text: auswahl('Lora'),
      ueberschrift: auswahl('Inter'),
      akzent: auswahl('Caveat'),
    });
    expect(einstellungenSchema.safeParse(c).success).toBe(true);
  });

  it('die Handschrift-Zeile lässt sich zurücknehmen, Text und Überschrift nicht', () => {
    const c = schriftSetzen(
      schriftSetzen(einstellungen(), 'text', auswahl('Lora')),
      'akzent',
      auswahl('Caveat'),
    );
    expect(schriftSetzen(c, 'akzent', null).schriften?.akzent).toBeUndefined();
    expect(schriftSetzen(c, 'text', null)).toBe(c);
    expect(schriftSetzen(einstellungen(), 'akzent', null).schriften).toBeUndefined();
  });

  it('jede Schrift der Auswahl besteht das Schema', () => {
    for (const s of SCHRIFTEN)
      expect(
        einstellungenSchema.safeParse(schriftSetzen(einstellungen(), 'text', auswahl(s.name)))
          .success,
      ).toBe(true);
  });
});

describe('kontrastHinweise (E-W18)', () => {
  it('die Vorgabe ist gut lesbar: kein Hinweis', () => {
    expect(kontrastHinweise(einstellungen())).toEqual([]);
  });

  it('helles Grau auf Weiß: Hinweis für den Hintergrund – das Verhältnis kommt von `kontrast`', () => {
    const e = farbeSetzen(einstellungen(), 'text', '#aaaaaa');
    const h = kontrastHinweise(e);
    expect(h.map((x) => x.auf)).toEqual(['grund', 'sanft']);
    expect(h[0].verhaeltnis).toBe(kontrast('#aaaaaa', NEUTRALE_FARBEN.grund));
    expect(h[0].verhaeltnis).toBeLessThan(KONTRAST_MINDEST);
  });

  it('beide Paare werden einzeln geprüft: nur „Sanft“ zu dunkel für den Text', () => {
    const e = farbeSetzen(einstellungen(), 'sanft', '#444444');
    expect(kontrastHinweise(e).map((x) => x.auf)).toEqual(['sanft']);
  });

  it('genau auf der Grenze (4,5 : 1) gibt es keinen Hinweis', () => {
    // #767676 auf Weiß liegt knapp über 4,5
    const e = farbeSetzen(farbeSetzen(einstellungen(), 'sanft', '#ffffff'), 'text', '#767676');
    expect(kontrastHinweise(e)).toEqual([]);
  });

  it('der Hinweis sperrt nicht: Das Ergebnis besteht das Schema und lässt sich speichern', () => {
    const e = farbeSetzen(einstellungen(), 'text', '#eeeeee');
    expect(kontrastHinweise(e).length).toBeGreaterThan(0);
    expect(einstellungenSchema.safeParse(e).success).toBe(true);
  });

  it('verhaeltnisText: deutsches Komma, abgerundet', () => {
    expect(verhaeltnisText(3.14)).toBe('3,1 : 1');
    expect(verhaeltnisText(4.49)).toBe('4,4 : 1');
    expect(verhaeltnisText(21)).toBe('21,0 : 1');
  });
});

describe('schriftDateien – dieselben Dateien, nach denen das Theme fragt', () => {
  const alle = (e: ReturnType<typeof einstellungen>) => {
    const gefragt: string[] = [];
    themeCss(e, {
      schriftAdresse: (d) => {
        gefragt.push(d);
        return `/x/${d}`;
      },
    });
    return gefragt;
  };

  it('Text, Überschrift und Handschrift: genau die Dateien, nach denen themeCss fragt', () => {
    for (const s of SCHRIFTEN) {
      const e = schriftSetzen(
        schriftSetzen(
          schriftSetzen(einstellungen(), 'text', auswahl(s.name)),
          'ueberschrift',
          auswahl('Lora'),
        ),
        'akzent',
        auswahl('Caveat Brush'),
      );
      expect([...schriftDateien(e.schriften)].sort()).toEqual([...new Set(alle(e))].sort());
    }
  });

  it('dieselbe Schrift mehrfach: eine Datei; eigene Schriften und nichts Gewähltes: keine', () => {
    const e = schriftSetzen(einstellungen(), 'text', auswahl('Lora'));
    expect(schriftDateien(e.schriften)).toEqual(['lora-var.woff2']);
    expect(schriftDateien(undefined)).toEqual([]);
    expect(
      schriftDateien({
        text: { art: 'eigene', name: 'Meine' },
        ueberschrift: auswahl('Inter'),
      }),
    ).toEqual(['inter-var.woff2']);
  });
});
