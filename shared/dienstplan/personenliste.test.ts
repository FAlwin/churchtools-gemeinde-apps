import { describe, expect, it } from 'vitest';
import {
  hatReihenfolge,
  leereListe,
  neueTagId,
  pauseAm,
  pauseText,
  pausiertAnAllen,
  PERSONENLISTE_ART,
  personenlisteAus,
  pauseSetzen,
  rangVon,
  reiheNachZiehen,
  reiheSetzen,
  sortiereNachListe,
  tagKuerzel,
  tagListeSetzen,
  tagsFuer,
  tagsSchluessel,
  tagsSetzen,
  type ListeInhalt,
} from './personenliste';
import {
  BEGLEITUNG,
  EINWEISUNG,
  LEITUNG,
  liste,
  listeRoh,
  listeWert,
} from './personenliste.testutil';

describe('personenlisteAus – Lesen', () => {
  it('liest, was der Speicher hält', () => {
    const l = personenlisteAus(
      listeWert({
        version: 3,
        reihe: [4, 2],
        tags: [BEGLEITUNG],
        tagsVon: { '9|4': ['b'] },
        pause: { '2': { bis: '2027-01-31' }, '5': {} },
      }),
    );
    expect(l).toEqual(
      listeRoh({
        version: 3,
        reihe: [4, 2],
        tags: [BEGLEITUNG],
        tagsVon: { '9|4': ['b'] },
        pause: { '2': { bis: '2027-01-31' }, '5': {} },
      }),
    );
  });

  it('fremde Art, andere Fassung, kein JSON → null', () => {
    const w = listeWert();
    expect(
      personenlisteAus({
        ...w,
        value: JSON.stringify({ art: 'dienstplaner-entwurf', fassung: 1 }),
      }),
    ).toBeNull();
    expect(
      personenlisteAus({
        ...w,
        value: JSON.stringify({ ...JSON.parse(w.value), fassung: 2 }),
      }),
    ).toBeNull();
    expect(personenlisteAus({ ...w, value: 'kein json' })).toBeNull();
  });

  it('kaputte Felder → null (nicht halb gelesen)', () => {
    const roh = JSON.parse(listeWert().value) as Record<string, unknown>;
    const ohne = (x: Record<string, unknown>) =>
      personenlisteAus({ ...listeWert(), value: JSON.stringify({ ...roh, ...x }) });
    expect(ohne({ reihe: [1, 'zwei'] })).toBeNull();
    expect(ohne({ version: 'x' })).toBeNull();
    expect(ohne({ tags: [{ id: 'b', name: 'Begleitung' }] })).toBeNull(); // Kürzel fehlt
    expect(ohne({ tagsVon: { '9|4': 'b' } })).toBeNull();
    // Eine Pause mit kaputtem Datum würde „ohne Ende“ heißen – lieber keine Liste.
    expect(ohne({ pause: { '2': { bis: '31.01.2027' } } })).toBeNull();
    expect(ohne({ pause: { '2': { bis: 5 } } })).toBeNull();
  });

  it('der Erzeuger der Testwerte trägt die eine Art', () => {
    expect(JSON.parse(listeWert().value)).toMatchObject({ art: PERSONENLISTE_ART, fassung: 1 });
  });
});

describe('Reihenfolge', () => {
  const personen = [
    { personId: 3, name: 'Clara' },
    { personId: 1, name: 'Anna' },
    { personId: 2, name: 'Ben' },
    { personId: null, name: 'Gast Ärger' },
    { personId: 9, name: 'Ärmel' },
  ];

  it('hatReihenfolge: nur mit mindestens einer Person', () => {
    expect(hatReihenfolge(null)).toBe(false);
    expect(hatReihenfolge(liste())).toBe(false);
    expect(hatReihenfolge(liste({ reihe: [1] }))).toBe(true);
  });

  it('rangVon: Stelle in der Reihenfolge, sonst null', () => {
    const l = liste({ reihe: [7, 3] });
    expect(rangVon(l, 7)).toBe(0);
    expect(rangVon(l, 3)).toBe(1);
    expect(rangVon(l, 1)).toBeNull();
    expect(rangVon(null, 1)).toBeNull();
  });

  it('gespeicherte Reihenfolge zuerst, wer fehlt danach alphabetisch (deutsch), Gäste dazwischen nach Namen', () => {
    const r = sortiereNachListe(liste({ reihe: [2, 3] }), personen);
    expect(r.map((x) => x.name)).toEqual(['Ben', 'Clara', 'Anna', 'Ärmel', 'Gast Ärger']);
  });

  it('ohne Liste (oder ohne Reihenfolge) alphabetisch wie bisher, ohne die Eingabe zu verändern', () => {
    const roh = [...personen];
    expect(sortiereNachListe(null, personen).map((x) => x.name)).toEqual([
      'Anna',
      'Ärmel',
      'Ben',
      'Clara',
      'Gast Ärger',
    ]);
    expect(sortiereNachListe(liste(), personen).map((x) => x.name)).toEqual(
      sortiereNachListe(null, personen).map((x) => x.name),
    );
    expect(personen).toEqual(roh);
  });

  it('gleicher Name: die kleinere ID zuerst', () => {
    const r = sortiereNachListe(null, [
      { personId: 8, name: 'Anna' },
      { personId: 4, name: 'Anna' },
    ]);
    expect(r.map((x) => x.personId)).toEqual([4, 8]);
  });
});

describe('Tags', () => {
  const l = liste({
    tags: [BEGLEITUNG, LEITUNG, EINWEISUNG],
    tagsVon: { [tagsSchluessel(9, 4)]: ['l', 'b', 'x'], [tagsSchluessel(6, 4)]: ['e'] },
  });

  it('je Person UND Dienst, in der Reihenfolge der Tag-Liste; unbekannte IDs fallen weg', () => {
    expect(tagsFuer(l, 9, 4).map((t) => t.kuerzel)).toEqual(['B', 'L']);
    expect(tagsFuer(l, 6, 4).map((t) => t.kuerzel)).toEqual(['E']);
  });

  it('ein anderer Dienst oder eine andere Person hat sie nicht; ohne Liste keine', () => {
    expect(tagsFuer(l, 7, 4)).toEqual([]);
    expect(tagsFuer(l, 9, 5)).toEqual([]);
    expect(tagsFuer(null, 9, 4)).toEqual([]);
  });
});

describe('Pause', () => {
  const l = liste({ pause: { '1': { bis: '2026-12-09' }, '2': {} } });

  it('„bis“ gilt einschließlich, danach nicht mehr', () => {
    expect(pauseAm(l, 1, '2026-12-09')).toEqual({ bis: '2026-12-09' });
    expect(pauseAm(l, 1, '2026-12-08')).not.toBeNull();
    expect(pauseAm(l, 1, '2026-12-10')).toBeNull();
  });

  it('ohne „bis“ unbefristet – auch ohne Tag', () => {
    expect(pauseAm(l, 2, '2099-01-01')).toEqual({});
    expect(pauseAm(l, 2, undefined)).toEqual({});
    // Ein befristete Pause ohne Tag lässt sich nicht beurteilen: gilt nicht.
    expect(pauseAm(l, 1, undefined)).toBeNull();
  });

  it('wer keine Pause hat (oder keine Liste), ist nicht pausiert', () => {
    expect(pauseAm(l, 3, '2026-12-01')).toBeNull();
    expect(pauseAm(null, 1, '2026-12-01')).toBeNull();
  });

  it('pausiertAnAllen: jeder Tag muss gedeckt sein, ohne Tage nein', () => {
    expect(pausiertAnAllen(l, 1, ['2026-12-06', '2026-12-09'])).toBe(true);
    expect(pausiertAnAllen(l, 1, ['2026-12-06', '2026-12-13'])).toBe(false);
    expect(pausiertAnAllen(l, 2, ['2026-12-06', '2026-12-13'])).toBe(true);
    expect(pausiertAnAllen(l, 2, [])).toBe(false);
  });

  it('pauseText: „Pause bis 31.01.27“ bzw. „Pause“', () => {
    expect(pauseText({ bis: '2027-01-31' })).toBe('Pause bis 31.01.27');
    expect(pauseText({})).toBe('Pause');
  });
});

// ── Ändern (PL-2) ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Was die Änderungen liefern, MUSS der Leser wieder annehmen – sonst wäre die Liste beim nächsten Laden „keine Liste“. */
const gelesen = (x: ListeInhalt) => personenlisteAus(listeWert(x));

describe('reiheSetzen / reiheNachZiehen', () => {
  it('reiheSetzen: ersetzt die Reihenfolge, ohne Doppelte; ohne Liste geht es von leer aus', () => {
    expect(reiheSetzen(null, [3, 1, 3, 2]).reihe).toEqual([3, 1, 2]);
    const alt = listeRoh({ reihe: [9], tags: [BEGLEITUNG], pause: { '9': {} } });
    // Der Inhalt hat weder Version noch Zeit – die setzt erst das Speichern.
    expect(reiheSetzen(alt, [1, 2])).toEqual({
      reihe: [1, 2],
      tags: alt.tags,
      tagsVon: alt.tagsVon,
      pause: alt.pause,
    });
  });

  it('eine Person im Block nach oben ziehen: nur die Block-Mitglieder tauschen ihre Plätze, andere bleiben stehen', () => {
    // Die Gruppe: 7 und 8 gehören zu einem anderen Dienst und stehen mitten drin.
    const alt = listeRoh({ reihe: [1, 7, 2, 8, 3] });
    // Block (oben): 1, 2, 3 – 3 wird an den Anfang gezogen.
    const neu = reiheNachZiehen(alt, [1, 2, 3], 2, 0);
    expect(neu).toEqual([3, 7, 1, 8, 2]);
    // Für den Block heißt das genau: 3, 1, 2 – wie gezogen; die anderen stehen noch dort.
    const imBlock = (r: number[]) => r.filter((id) => [1, 2, 3].includes(id));
    expect(imBlock(neu)).toEqual([3, 1, 2]);
    expect(neu.filter((id) => [7, 8].includes(id))).toEqual([7, 8]);
  });

  it('wer noch nicht in der Reihenfolge stand (neu, alphabetisch danach), kommt hinten dazu – in der gezogenen Reihenfolge', () => {
    // Block: Anna (1, in der Liste), Ben (2), Carla (3) – die beiden stehen noch nicht in der Liste.
    const alt = listeRoh({ reihe: [1] });
    expect(reiheNachZiehen(alt, [1, 2, 3], 2, 0)).toEqual([3, 1, 2]); // Carla nach oben
    expect(reiheNachZiehen(alt, [1, 2, 3], 1, 2)).toEqual([1, 3, 2]); // Ben nach unten
    // Ohne jede Liste: der Block wird zur Reihenfolge.
    expect(reiheNachZiehen(null, [4, 5, 6], 0, 2)).toEqual([5, 6, 4]);
  });

  it('Stellen außerhalb des Blocks ändern nichts; die Reihenfolge ist jedes Mal frei von Doppelten', () => {
    const alt = listeRoh({ reihe: [1, 2, 2, 3] });
    expect(reiheNachZiehen(alt, [1, 2, 3], 0, 5)).toEqual([1, 2, 3]);
    expect(reiheNachZiehen(alt, [1, 2, 3], -1, 0)).toEqual([1, 2, 3]);
    const neu = reiheNachZiehen(alt, [1, 2, 3], 0, 2);
    expect(new Set(neu).size).toBe(neu.length);
  });

  it('Gegenprobe gegen den Leser: nach dem Ziehen sortiert `sortiereNachListe` den Block genau so', () => {
    const alt = liste({ reihe: [5, 1, 2] });
    const block = [5, 1, 2];
    const neu = reiheNachZiehen(alt, block, 2, 0); // 2 ganz nach oben
    const l = gelesen(reiheSetzen(alt, neu));
    const sortiert = sortiereNachListe(
      l,
      block.map((id) => ({ personId: id, name: `P${id}` })),
    );
    expect(sortiert.map((x) => x.personId)).toEqual([2, 5, 1]);
  });
});

describe('tagsSetzen', () => {
  const alt = listeRoh({ tags: [BEGLEITUNG, LEITUNG] });

  it('setzt die Tags je Person UND Dienst – in der Reihenfolge der Tag-Liste, die Liste liest man mit `tagsFuer` zurück', () => {
    const neu = tagsSetzen(alt, 9, 4, ['l', 'b']);
    expect(neu.tagsVon).toEqual({ '9|4': ['b', 'l'] });
    expect(tagsFuer(gelesen(neu), 9, 4).map((t) => t.id)).toEqual(['b', 'l']);
    // Eine andere Person und ein anderer Dienst bleiben ohne.
    expect(tagsFuer(gelesen(neu), 9, 5)).toEqual([]);
    expect(tagsFuer(gelesen(neu), 6, 4)).toEqual([]);
  });

  it('unbekannte Tags zählen nicht; keine Tags → der Eintrag verschwindet', () => {
    expect(tagsSetzen(alt, 9, 4, ['gibtsnicht']).tagsVon).toEqual({});
    const mit = tagsSetzen(alt, 9, 4, ['b']);
    expect(tagsSetzen(mit, 9, 4, []).tagsVon).toEqual({});
  });

  it('ändert nichts an der Vorlage: die alte Liste bleibt unverändert', () => {
    const vorher = JSON.stringify(alt);
    tagsSetzen(alt, 9, 4, ['b']);
    expect(JSON.stringify(alt)).toBe(vorher);
  });
});

describe('pauseSetzen', () => {
  it('bis Datum, ohne Ende, keine – und der Leser nimmt jede Form an', () => {
    expect(pauseSetzen(null, 5, { bis: '2027-01-31' }).pause).toEqual({
      '5': { bis: '2027-01-31' },
    });
    const offen = pauseSetzen(null, 5, {});
    expect(offen.pause).toEqual({ '5': {} });
    expect(gelesen(offen)?.pause['5']).toEqual({});
    expect(pauseSetzen(offen, 5, null).pause).toEqual({});
    // Andere Personen bleiben.
    expect(pauseSetzen(offen, 6, { bis: '2027-02-01' }).pause).toEqual({
      '5': {},
      '6': { bis: '2027-02-01' },
    });
  });

  it('ein kaputtes Datum wird nicht gespeichert (die ganze Liste wäre danach nicht mehr lesbar)', () => {
    expect(() => pauseSetzen(null, 5, { bis: '31.01.2027' })).toThrow(RangeError);
    expect(() => pauseSetzen(null, 5, { bis: '' })).toThrow(RangeError);
  });
});

describe('tagListeSetzen', () => {
  const alt = listeRoh({
    tags: [BEGLEITUNG, LEITUNG],
    tagsVon: { '9|4': ['b', 'l'], '9|5': ['l'], '6|4': ['b'] },
  });

  it('Kürzel 1–2 Zeichen, großgeschrieben; leer → Anfang des Namens (nie leer)', () => {
    expect(tagKuerzel('b', 'Begleitung')).toBe('B');
    expect(tagKuerzel('abc', 'Begleitung')).toBe('AB');
    expect(tagKuerzel('  ', 'einweisung')).toBe('EI');
    expect(tagKuerzel('', 'Ü')).toBe('Ü');
    const neu = tagListeSetzen(null, [{ name: 'Springer', kuerzel: '' }]);
    expect(neu.tags).toEqual([{ id: 't1', name: 'Springer', kuerzel: 'SP' }]);
    expect(gelesen(neu)?.tags[0].kuerzel).toBe('SP');
  });

  it('leere Namen werden nicht gespeichert (auch nicht mit Leerzeichen)', () => {
    const neu = tagListeSetzen(alt, [
      { id: 'b', name: 'Begleitung', kuerzel: 'B' },
      { name: '   ', kuerzel: 'X' },
      { name: '', kuerzel: 'Y' },
    ]);
    expect(neu.tags.map((t) => t.id)).toEqual(['b']);
  });

  it('umbenennen behält die ID – die Zuordnungen bleiben', () => {
    const neu = tagListeSetzen(alt, [
      { id: 'b', name: 'Begleitung Gesang', kuerzel: 'bg' },
      { id: 'l', name: 'Leitung', kuerzel: 'L' },
    ]);
    expect(neu.tags[0]).toEqual({ id: 'b', name: 'Begleitung Gesang', kuerzel: 'BG' });
    expect(neu.tagsVon).toEqual(alt.tagsVon);
  });

  it('löschen: der Tag verschwindet auch bei allen Personen und Diensten; leere Einträge fallen weg', () => {
    const neu = tagListeSetzen(alt, [{ id: 'b', name: 'Begleitung', kuerzel: 'B' }]);
    expect(neu.tags.map((t) => t.id)).toEqual(['b']);
    expect(neu.tagsVon).toEqual({ '9|4': ['b'], '6|4': ['b'] }); // '9|5' hatte nur „l“
    // Der Leser findet nirgends mehr den gelöschten Tag.
    expect(tagsFuer(gelesen(neu), 9, 5)).toEqual([]);
  });

  it('neuer Tag bekommt eine neue ID – auch nicht die eines eben gelöschten; IDs bleiben stabil', () => {
    const neu = tagListeSetzen(alt, [
      { id: 'b', name: 'Begleitung', kuerzel: 'B' },
      { name: 'Springer', kuerzel: 'S' },
    ]);
    expect(neu.tags.map((t) => t.id)).toEqual(['b', 't1']);
    const nochmal = tagListeSetzen(neu, [...neu.tags, { name: 'Noch einer', kuerzel: 'N' }]);
    expect(nochmal.tags.map((t) => t.id)).toEqual(['b', 't1', 't2']);
    expect(neueTagId([{ id: 'b' }, { id: 't7' }])).toBe('t8');
    expect(neueTagId([])).toBe('t1');
  });

  it('eine unbekannte oder doppelte ID in der Eingabe zählt als neuer Tag (keine zwei Tags mit derselben ID)', () => {
    const neu = tagListeSetzen(alt, [
      { id: 'b', name: 'Begleitung', kuerzel: 'B' },
      { id: 'b', name: 'Zweiter', kuerzel: 'Z' },
      { id: 'fremd', name: 'Fremd', kuerzel: 'F' },
    ]);
    expect(new Set(neu.tags.map((t) => t.id)).size).toBe(3);
    expect(gelesen(neu)).not.toBeNull();
  });

  it('Name wird gekürzt (30 Zeichen) und getrimmt', () => {
    const neu = tagListeSetzen(null, [{ name: `  ${'x'.repeat(50)}  `, kuerzel: 'x' }]);
    expect(neu.tags[0].name).toBe('x'.repeat(30));
  });

  it('aus der leeren Liste: leereListe() ist die Ausgangslage', () => {
    expect(tagListeSetzen(null, [])).toEqual(leereListe());
  });
});
