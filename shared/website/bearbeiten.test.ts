import { describe, expect, it } from 'vitest';
import {
  abschnittDa,
  abschnittEinfuegen,
  abschnittKopieren,
  abschnittLoeschen,
  abschnittVerschieben,
  aufteilungAendern,
  bausteinDa,
  bausteinEntfernen,
  bausteinErsetzen,
  bausteinHinzufuegen,
  einfuegeStelleDa,
  imMenueZeigen,
  menueFuerSeite,
  menueTitelNachziehen,
  menueVerschieben,
  seiteGleich,
  seitePruefen,
  spalteDa,
} from './bearbeiten';
import { AUFTEILUNGEN, bausteinSchema, seiteSchema, type Abschnitt, type Seite } from './modell';
import { findeVorlage, VORLAGEN } from './vorlagen';
import {
  abschnitt,
  baustein,
  gestaltung,
  idZaehler,
  menue,
  seite,
  spalte,
} from './website.testdaten';

const mit = (...a: Abschnitt[]): Seite => seite({ abschnitte: a });
const A = (id: string, anker?: string) =>
  abschnitt([baustein('text', { id: `${id}-t` })], {
    id,
    gestaltung: gestaltung(anker ? { anker } : {}),
  });
const ids = (s: Seite) => s.abschnitte.map((a) => a.id);

describe('Stellen prüfen: außerhalb des Bereichs gibt es nichts', () => {
  const s = mit(A('a1'), A('a2'));
  it('Abschnitt, Spalte, Baustein, Einfügestelle', () => {
    expect(abschnittDa(s, 0) && abschnittDa(s, 1)).toBe(true);
    for (const falsch of [-1, 2, 1.5, NaN, '0', null, undefined])
      expect(abschnittDa(s, falsch)).toBe(false);
    expect(spalteDa(s, 0, 0)).toBe(true);
    expect(spalteDa(s, 0, 1)).toBe(false);
    expect(spalteDa(s, 5, 0)).toBe(false);
    expect(bausteinDa(s, 0, 0, 0)).toBe(true);
    expect(bausteinDa(s, 0, 0, 1)).toBe(false);
    expect(einfuegeStelleDa(s, 0)).toBe(true);
    expect(einfuegeStelleDa(s, 2)).toBe(true); // ganz unten
    expect(einfuegeStelleDa(s, 3)).toBe(false);
    expect(einfuegeStelleDa(s, -1)).toBe(false);
  });

  it('jede Rechenfunktion mit einer falschen Stelle liefert die Seite UNVERÄNDERT (dasselbe Objekt)', () => {
    const neu = abschnitt([baustein('text')]);
    expect(abschnittEinfuegen(s, 9, neu)).toBe(s);
    expect(abschnittVerschieben(s, 9, 'hoch')).toBe(s);
    expect(abschnittKopieren(s, 9, idZaehler())).toBe(s);
    expect(abschnittLoeschen(s, 9)).toBe(s);
    expect(bausteinHinzufuegen(s, 0, 9, baustein('text'))).toBe(s);
    expect(bausteinErsetzen(s, 0, 0, 9, baustein('text'))).toBe(s);
    expect(bausteinEntfernen(s, 0, 0, 9)).toBe(s);
  });
});

describe('Abschnitte: einfügen, verschieben, kopieren, löschen', () => {
  it('einfügen an jeder Stelle, auch in eine leere Seite; die alte Seite bleibt unberührt', () => {
    const leer = mit();
    const mitEinem = abschnittEinfuegen(leer, 0, A('x'));
    expect(ids(mitEinem)).toEqual(['x']);
    expect(leer.abschnitte).toEqual([]);
    const s = mit(A('a1'), A('a2'));
    expect(ids(abschnittEinfuegen(s, 0, A('x')))).toEqual(['x', 'a1', 'a2']);
    expect(ids(abschnittEinfuegen(s, 1, A('x')))).toEqual(['a1', 'x', 'a2']);
    expect(ids(abschnittEinfuegen(s, 2, A('x')))).toEqual(['a1', 'a2', 'x']);
  });

  it('jede Vorlage lässt sich einfügen, und die Seite bleibt gültig', () => {
    for (const v of VORLAGEN) {
      const neu = abschnittEinfuegen(mit(), 0, v.erzeugen(idZaehler()));
      expect(seiteSchema.safeParse(neu).success, v.name).toBe(true);
    }
  });

  it('nach oben / unten; am Rand passiert nichts', () => {
    const s = mit(A('a1'), A('a2'), A('a3'));
    expect(ids(abschnittVerschieben(s, 1, 'hoch'))).toEqual(['a2', 'a1', 'a3']);
    expect(ids(abschnittVerschieben(s, 1, 'runter'))).toEqual(['a1', 'a3', 'a2']);
    expect(abschnittVerschieben(s, 0, 'hoch')).toBe(s);
    expect(abschnittVerschieben(s, 2, 'runter')).toBe(s);
  });

  it('kopieren: die Kopie steht darunter, ALLE Kennungen (Abschnitt, Spalten, Bausteine) sind neu', () => {
    const s = mit(
      abschnitt([baustein('text', { id: 'b1' }), baustein('bild', { id: 'b2' })], { id: 'a1' }),
    );
    const neu = abschnittKopieren(s, 0, idZaehler());
    expect(neu.abschnitte).toHaveLength(2);
    const [alt, kopie] = neu.abschnitte;
    expect(alt).toEqual(s.abschnitte[0]); // das Original bleibt, wie es war
    const kennungen = (a: Abschnitt) => [
      a.id,
      ...a.spalten.flatMap((sp) => [sp.id, ...sp.bausteine.map((b) => b.id)]),
    ];
    const alle = [...kennungen(alt), ...kennungen(kopie)];
    expect(new Set(alle).size).toBe(alle.length);
  });

  it('kopieren: Bild-Kennungen und Seiten-Links bleiben (sie sind keine Namen des Abschnitts) – nur die Sprungmarke fällt weg', () => {
    const knoepfe = baustein('knoepfe', {
      knoepfe: [{ text: 'Hin', ziel: { art: 'seite', seiteId: 'andere-seite' }, art: 'haupt' }],
    });
    const s = mit(
      abschnitt([baustein('bild', { bild: { id: 'foto-7' } }), knoepfe], {
        id: 'a1',
        gestaltung: gestaltung({ anker: 'gottesdienst' }),
      }),
    );
    const kopie = abschnittKopieren(s, 0, idZaehler()).abschnitte[1];
    const [b, k] = kopie.spalten[0].bausteine;
    expect(b.typ === 'bild' && b.bild.id).toBe('foto-7');
    expect(k.typ === 'knoepfe' && k.knoepfe[0].ziel).toEqual({
      art: 'seite',
      seiteId: 'andere-seite',
    });
    expect(kopie.gestaltung.anker).toBeUndefined();
    expect(s.abschnitte[0].gestaltung.anker).toBe('gottesdienst'); // das Original behält sie
    // Und die Seite besteht die Prüfung auf doppelte Kennungen und Sprungmarken:
    expect(seitePruefen(abschnittKopieren(s, 0, idZaehler()), [], null, null)).toEqual([]);
  });

  it('löschen entfernt genau diesen Abschnitt', () => {
    expect(ids(abschnittLoeschen(mit(A('a1'), A('a2'), A('a3')), 1))).toEqual(['a1', 'a3']);
  });
});

describe('Spalten ändern (Fenster „Abschnitt gestalten“)', () => {
  const dreiSpalten = (): Abschnitt =>
    abschnitt([], {
      id: 'a',
      aufteilung: '1-1-1',
      spalten: [
        spalte([baustein('text', { id: 'x1' })], { id: 's1' }),
        spalte([baustein('text', { id: 'x2' }), baustein('bild', { id: 'x3' })], { id: 's2' }),
        spalte([baustein('trenner', { id: 'x4' })], { id: 's3' }),
      ],
    });
  const bausteinIds = (a: Abschnitt) => a.spalten.flatMap((s) => s.bausteine.map((b) => b.id));

  it('WENIGER Spalten: nichts geht verloren – die Inhalte der wegfallenden Spalten landen hinten in der letzten, die bleibt', () => {
    const vorher = dreiSpalten();
    const nachher = aufteilungAendern(vorher, '1-1', idZaehler());
    expect(nachher.spalten).toHaveLength(2);
    expect(nachher.aufteilung).toBe('1-1');
    expect(nachher.spalten[0].bausteine.map((b) => b.id)).toEqual(['x1']);
    expect(nachher.spalten[1].bausteine.map((b) => b.id)).toEqual(['x2', 'x3', 'x4']);
    expect([...bausteinIds(nachher)].sort()).toEqual([...bausteinIds(vorher)].sort());
  });

  it('auf EINE Spalte: alles steht in der Reihenfolge der Spalten in der einen', () => {
    const nachher = aufteilungAendern(dreiSpalten(), '1', idZaehler());
    expect(nachher.spalten).toHaveLength(1);
    expect(nachher.spalten[0].bausteine.map((b) => b.id)).toEqual(['x1', 'x2', 'x3', 'x4']);
  });

  it('MEHR Spalten: leere kommen dazu, die vorhandenen bleiben', () => {
    const eine = abschnitt([baustein('text', { id: 'x1' })], { id: 'a' });
    const nachher = aufteilungAendern(eine, '1-1-1-1', idZaehler());
    expect(nachher.spalten).toHaveLength(4);
    expect(nachher.spalten[0].bausteine.map((b) => b.id)).toEqual(['x1']);
    expect(nachher.spalten.slice(1).every((s) => s.bausteine.length === 0)).toBe(true);
    expect(new Set(nachher.spalten.map((s) => s.id)).size).toBe(4);
  });

  it('JEDE Aufteilung aus JEDER anderen: nie ein Baustein weniger, die Seite bleibt gültig', () => {
    for (const von of AUFTEILUNGEN)
      for (const nach of AUFTEILUNGEN) {
        const a = aufteilungAendern(dreiSpalten(), von, idZaehler());
        const b = aufteilungAendern(a, nach, idZaehler());
        expect([...bausteinIds(b)].sort(), `${von} → ${nach}`).toEqual(
          [...bausteinIds(dreiSpalten())].sort(),
        );
        expect(seiteSchema.safeParse(mit(b)).success, `${von} → ${nach}`).toBe(true);
      }
  });
});

describe('Bausteine: hinzufügen, ersetzen, entfernen', () => {
  const s = mit(
    abschnitt([], {
      id: 'a',
      aufteilung: '1-1',
      spalten: [spalte([baustein('text', { id: 'x1' })], { id: 's1' }), spalte([], { id: 's2' })],
    }),
  );
  it('hinzufügen hängt ans Ende der gewählten Spalte', () => {
    const neu = bausteinHinzufuegen(s, 0, 0, baustein('trenner', { id: 'n' }));
    expect(neu.abschnitte[0].spalten[0].bausteine.map((b) => b.id)).toEqual(['x1', 'n']);
    expect(neu.abschnitte[0].spalten[1].bausteine).toEqual([]);
    expect(s.abschnitte[0].spalten[0].bausteine).toHaveLength(1); // die alte Seite bleibt
  });
  it('ersetzen und entfernen treffen genau den einen', () => {
    const ersetzt = bausteinErsetzen(s, 0, 0, 0, baustein('text', { id: 'x1', markdown: 'neu' }));
    expect(bausteinSchema.safeParse(ersetzt.abschnitte[0].spalten[0].bausteine[0]).success).toBe(
      true,
    );
    expect(ersetzt.abschnitte[0].spalten[0].bausteine[0]).toMatchObject({ markdown: 'neu' });
    expect(bausteinEntfernen(s, 0, 0, 0).abschnitte[0].spalten[0].bausteine).toEqual([]);
  });
});

describe('seitePruefen: vor jedem Speichern', () => {
  it('eine gute Seite: keine Meldung', () => {
    expect(seitePruefen(seite(), [], null, null)).toEqual([]);
    const v = findeVorlage('start-schriftzug')!;
    expect(seitePruefen(mit(v.erzeugen(idZaehler())), [], null, null)).toEqual([]);
  });

  it('gegen das Schema: Meldung mit Ort in Worten (kein „abschnitte.0.gestaltung“)', () => {
    const s = mit(A('a1', 'GROSS geschrieben'));
    const m = seitePruefen(s, [], null, null);
    expect(m.length).toBeGreaterThan(0);
    expect(m[0]).toMatch(/Abschnitt 1 › Gestaltung › Sprungmarke: /);
    const leer = mit(abschnitt([baustein('ueberschrift', { text: '' })]));
    expect(seitePruefen(leer, [], null, null)[0]).toMatch(/Baustein 1 › Text/);
  });

  it('doppelte Sprungmarke auf der Seite, doppelter Pfad und doppelte Kennung mit anderen Seiten', () => {
    expect(seitePruefen(mit(A('a1', 'x'), A('a2', 'x')), [], null, null).join(' ')).toMatch(
      /Anker „x“ mehrfach/,
    );
    const andere = seite({ id: 'andere', pfad: 'start', startseite: false });
    expect(
      seitePruefen(seite({ id: 'diese', pfad: 'start' }), [andere], null, null).join(' '),
    ).toMatch(/Pfad „start“/);
  });

  it('ein Link auf eine Seite, die es nicht gibt, blockiert NICHT (das zeigt später die Freigabe)', () => {
    const s = mit(
      abschnitt([
        baustein('knoepfe', {
          knoepfe: [{ text: 'Hin', ziel: { art: 'seite', seiteId: 'weg' }, art: 'haupt' }],
        }),
      ]),
    );
    expect(seitePruefen(s, [], null, null)).toEqual([]);
  });

  it('die gespeicherte Fassung der Seite selbst zählt nicht als „andere Seite“ (kein doppelter Pfad mit sich selbst)', () => {
    const s = seite({ id: 'x', pfad: 'p' });
    expect(seitePruefen(s, [s], null, null)).toEqual([]);
  });
});

describe('seiteGleich', () => {
  it('Feldreihenfolge zählt nicht, Inhalt schon', () => {
    const a = seite({ titel: 'A' });
    const umgestellt = JSON.parse(
      JSON.stringify({ abschnitte: [], pfad: a.pfad, titel: 'A', startseite: true, id: a.id }),
    ) as Seite;
    expect(seiteGleich(a, umgestellt)).toBe(true);
    expect(seiteGleich(a, { ...a, titel: 'B' })).toBe(false);
    expect(seiteGleich(a, mit(A('a1')))).toBe(false);
  });
});

describe('Menü', () => {
  const eintrag = (id: string, titel = id) => ({
    titel,
    ziel: { art: 'seite' as const, seiteId: id },
  });
  it('verschieben: hoch/runter, am Rand nichts', () => {
    const m = menue([eintrag('a'), eintrag('b'), eintrag('c')]);
    expect(menueVerschieben(m, 1, 'hoch').eintraege.map((e) => e.titel)).toEqual(['b', 'a', 'c']);
    expect(menueVerschieben(m, 1, 'runter').eintraege.map((e) => e.titel)).toEqual(['a', 'c', 'b']);
    expect(menueVerschieben(m, 0, 'hoch')).toBe(m);
    expect(menueVerschieben(m, 2, 'runter')).toBe(m);
    expect(menueVerschieben(m, 7, 'hoch')).toBe(m);
  });

  it('„Im Menü zeigen“: einschalten hängt hinten an, ausschalten entfernt, ohne Änderung null', () => {
    const s = seite({ id: 'x', titel: 'Neu' });
    expect(imMenueZeigen(null, 'x')).toBe(false);
    expect(menueFuerSeite(null, s, false)).toBeNull();
    const an = menueFuerSeite(menue([eintrag('a')]), s, true)!;
    expect(an.eintraege.map((e) => e.titel)).toEqual(['a', 'Neu']);
    expect(imMenueZeigen(an, 'x')).toBe(true);
    expect(menueFuerSeite(an, s, true)).toBeNull();
    expect(menueFuerSeite(an, s, false)!.eintraege.map((e) => e.titel)).toEqual(['a']);
  });

  it('ein umbenannter Seitentitel zieht nur Menüpunkte mit, die noch den alten Titel tragen', () => {
    const m = menue([
      eintrag('x', 'Alt'),
      { ...eintrag('x', 'Von Hand'), unter: [eintrag('x', 'Alt')] },
    ]);
    const neu = menueTitelNachziehen(m, 'x', 'Alt', 'Neu')!;
    expect(neu.eintraege[0].titel).toBe('Neu');
    expect(neu.eintraege[1].titel).toBe('Von Hand');
    expect(neu.eintraege[1].unter?.[0].titel).toBe('Neu');
    expect(menueTitelNachziehen(m, 'x', 'Gleich', 'Gleich')).toBeNull();
    expect(menueTitelNachziehen(m, 'y', 'Alt', 'Neu')).toBeNull();
    expect(menueTitelNachziehen(null, 'x', 'Alt', 'Neu')).toBeNull();
  });
});
