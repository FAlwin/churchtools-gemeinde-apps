import { describe, expect, it } from 'vitest';
import {
  aenderungVerboten,
  anlegenVerboten,
  hakenSchritt,
  istAufgabe,
  istToDoVorschlag,
  meineOffenen,
  neueAufgabe,
  offene,
  toDoRechte,
  trenneToDoVorschlaege,
  VORSCHLAG_KEIN_TODO,
  type Aufgabe,
} from './aufgaben';
import {
  neuerToDoVorschlag,
  vorschlagAblehnen,
  vorschlagAendern,
  vorschlaegeSichtbar,
  vorschlagNoch,
  vorschlagUebernehmen,
  vorschlagVerboten,
  vorschlagZurueckziehen,
  warumVon,
} from './todoVorschlag';
import { istFuerMichOffen } from './aufgaben';

/**
 * **To-Do-Vorschläge** (W9b, 20.11.2026): Regeln. Die Datensätze kommen aus den echten Erzeugern (`neuerToDoVorschlag`,
 * `neueAufgabe`), nicht als Literale. Ich bin Person 1 (Mitarbeiter oder Leitung), die anderen 19 und 23.
 */
const AM = '2026-11-18T10:00:00.000Z';
const SPAETER = '2026-11-20T09:00:00.000Z';
const ICH = { person: 1, name: 'Alwin Friesen' };
const PETER = { person: 19, name: 'Peter Wiens' };
const LEITUNG = { person: 7, name: 'Johann Becker' };
const ZONE = 'Europe/Berlin';

const vorschlag = (
  von = PETER,
  q: Partial<Parameters<typeof neuerToDoVorschlag>[0]> = {},
): Aufgabe =>
  neuerToDoVorschlag({
    id: 'v1',
    gruppe: 19,
    text: 'Kabel neu ordnen',
    bis: '2026-12-01',
    warum: 'Wir suchen jedes Mal.',
    von,
    am: AM,
    ...q,
  });
const todo = (id = 't1', wer: number[] = []): Aufgabe =>
  neueAufgabe({ id, gruppe: 19, sitzung: null, text: 'Beamer', wer, von: 7, am: AM });

const mitarbeiter = (ich: number) => ({ ich, leitung: false });
const leitung = { ich: 7, leitung: true };

describe('neuerToDoVorschlag', () => {
  it('derselbe Datensatz wie ein To-Do: ohne Zuständige, mit Kennzeichen; das „Warum?“ ist die erste Notiz', () => {
    const v = vorschlag();
    expect(v).toMatchObject({
      art: 'aufgabe',
      gruppe: 19,
      sitzung: null,
      text: 'Kabel neu ordnen',
      wer: [],
      extern: '',
      bis: '2026-12-01',
      status: 'offen',
      geloescht: false,
      vorschlag: { stand: 'offen', von: 19, name: 'Peter', am: AM },
    });
    expect(v.verlauf.map((e) => e.art)).toEqual(['vorgeschlagen', 'notiz']);
    expect(warumVon(v)).toBe('Wir suchen jedes Mal.');
    expect(istToDoVorschlag(v)).toBe(true);
    expect(istAufgabe(v)).toBe(true);
  });

  it('ohne „Warum?“: keine Notiz', () => {
    const v = vorschlag(PETER, { warum: '  ' });
    expect(v.verlauf.map((e) => e.art)).toEqual(['vorgeschlagen']);
    expect(warumVon(v)).toBe('');
  });
});

describe('Kennzeichen lesen (alte Datensätze)', () => {
  it('ein To-Do ohne Feld bleibt ein To-Do – kein Vorschlag', () => {
    const t = todo();
    expect('vorschlag' in t).toBe(false);
    expect(istAufgabe(JSON.parse(JSON.stringify(t)))).toBe(true);
    expect(istToDoVorschlag(t)).toBe(false);
  });

  it('ein kaputtes Kennzeichen ist keine Aufgabe von uns – nie versehentlich ein To-Do', () => {
    const kaputt = { ...vorschlag(), vorschlag: { stand: 'huch', von: 'x' } };
    expect(istAufgabe(kaputt)).toBe(false);
    expect(istAufgabe({ ...vorschlag(), vorschlag: 'ja' })).toBe(false);
  });

  it('trenneToDoVorschlaege: Reihenfolge bleibt, Vorschläge getrennt', () => {
    const liste = [
      todo('a'),
      vorschlag(PETER, { id: 'v1' }),
      todo('b'),
      vorschlag(ICH, { id: 'v2' }),
    ];
    const g = trenneToDoVorschlaege(liste);
    expect(g.aufgaben.map((a) => a.id)).toEqual(['a', 'b']);
    expect(g.vorschlaege.map((a) => a.id)).toEqual(['v1', 'v2']);
  });
});

describe('toDoRechte: Fall „vorschlag“', () => {
  it('die Leitung übernimmt und lehnt ab – sonst nichts; Haken, Status, „Das mache ich“ gibt es nicht', () => {
    const r = toDoRechte(vorschlag(), leitung);
    expect(r).toMatchObject({
      fall: 'vorschlag',
      sehen: true,
      uebernehmen: true,
      ablehnen: true,
      vorschlagAendern: false,
      zurueckziehen: false,
      haken: false,
      status: false,
      mache: false,
      text: false,
      loeschen: false,
      zustaendig: false,
    });
  });

  it('wer vorschlug (Mitarbeiter): ändern und zurückziehen – nicht übernehmen', () => {
    const r = toDoRechte(vorschlag(PETER), mitarbeiter(19));
    expect(r).toMatchObject({
      fall: 'vorschlag',
      sehen: true,
      vorschlagAendern: true,
      zurueckziehen: true,
      uebernehmen: false,
      ablehnen: false,
      haken: false,
      mache: false,
    });
  });

  it('ein anderer Mitarbeiter: nichts, nicht einmal sehen – auch kein „Das mache ich“ trotz leerer Zuständigkeit', () => {
    const r = toDoRechte(vorschlag(PETER), mitarbeiter(1));
    expect(r.fall).toBe('vorschlag');
    expect(Object.entries(r).filter(([k, v]) => v === true && k !== 'fall')).toEqual([]);
  });

  it('abgelehnt: niemand ändert oder entscheidet noch', () => {
    const abgelehnt = vorschlagAblehnen(vorschlag(PETER), 'Nein.', LEITUNG, SPAETER);
    for (const q of [leitung, mitarbeiter(19)])
      expect(toDoRechte(abgelehnt, q)).toMatchObject({
        uebernehmen: false,
        ablehnen: false,
        vorschlagAendern: false,
        zurueckziehen: false,
      });
  });
});

describe('die normalen To-Do-Wege lehnen einen Vorschlag ab', () => {
  const x = [
    { status: 'erledigt' as const },
    { wer: [1] },
    { notiz: 'Hallo' },
    { text: 'Anders' },
    { teile: [{ person: 1, fertig: true }] },
  ];
  it('für Leitung UND Mitarbeiter, jedes Feld – mit dem einen Satz', () => {
    for (const q of [leitung, mitarbeiter(19), mitarbeiter(1)])
      for (const a of x) expect(aenderungVerboten(vorschlag(), a, q)).toBe(VORSCHLAG_KEIN_TODO);
  });

  it('anlegenVerboten: ein Mitarbeiter darf einen Vorschlag anlegen – nur ohne Zuständige', () => {
    const w = { ich: 1, leitung: false };
    expect(anlegenVerboten({ wer: [], extern: '', vorschlag: true }, w)).toBeNull();
    expect(anlegenVerboten({ wer: [19], extern: '', vorschlag: true }, w)).toMatch(
      /keine Zuständigen/,
    );
    expect(anlegenVerboten({ wer: [], extern: 'Herr Meier', vorschlag: true }, w)).toMatch(
      /keine Zuständigen/,
    );
  });

  it('ohne „vorschlag“ bleibt es bei der W9a-Regel: nur für sich selbst', () => {
    const w = { ich: 1, leitung: false };
    expect(anlegenVerboten({ wer: [], extern: '' }, w)).toMatch(/nur für dich selbst/);
    expect(anlegenVerboten({ wer: [1], extern: '' }, w)).toBeNull();
  });
});

describe('Rechenregeln', () => {
  it('ändern: Text, Bis und das „Warum?“ (die erste Notiz) – mit Eintrag im Verlauf', () => {
    const n = vorschlagAendern(
      vorschlag(),
      { text: ' Kabel sortieren ', bis: null, warum: 'Neu.' },
      PETER,
      SPAETER,
    );
    expect(n).toMatchObject({ text: 'Kabel sortieren', bis: null });
    expect(warumVon(n)).toBe('Neu.');
    expect(n.verlauf.at(-1)).toMatchObject({ art: 'vorschlagGeaendert', von: 19, name: 'Peter' });
    expect(n.vorschlag?.stand).toBe('offen');
  });

  it('ändern: „Warum?“ leeren entfernt die Notiz, nachträglich ergänzen legt sie an; nichts geändert = unverändert', () => {
    const a = vorschlag();
    expect(
      warumVon(vorschlagAendern(a, { text: a.text, bis: a.bis, warum: '' }, PETER, SPAETER)),
    ).toBe('');
    const ohne = vorschlag(PETER, { warum: '' });
    expect(
      warumVon(
        vorschlagAendern(ohne, { text: ohne.text, bis: ohne.bis, warum: 'Doch.' }, PETER, SPAETER),
      ),
    ).toBe('Doch.');
    expect(
      vorschlagAendern(a, { text: a.text, bis: a.bis, warum: warumVon(a) }, PETER, SPAETER),
    ).toBe(a);
  });

  it('übernehmen: aus DEMSELBEN Datensatz wird ein To-Do – Kennzeichen weg, Zuständige gesetzt, Notiz und Verlauf bleiben', () => {
    const v = vorschlag();
    const t = vorschlagUebernehmen(v, { wer: [19, 23] }, LEITUNG, SPAETER);
    expect(t.id).toBe(v.id);
    expect('vorschlag' in t).toBe(false);
    expect(istToDoVorschlag(t)).toBe(false);
    expect(t.wer).toEqual([19, 23]);
    expect(warumVon(t)).toBe('Wir suchen jedes Mal.');
    expect(t.verlauf.map((e) => e.art)).toEqual([
      'vorgeschlagen',
      'notiz',
      'zustaendig',
      'uebernommen',
    ]);
    expect(t.verlauf.at(-1)).toMatchObject({ art: 'uebernommen', von: 7, name: 'Johann' });
    // Jetzt ist es ein ganz normales To-Do: Haken gibt es wieder.
    expect(hakenSchritt(t, 19)).not.toBeNull();
    expect(toDoRechte(t, mitarbeiter(19)).fall).toBe('geteilt');
  });

  it('übernehmen ohne Zuständige: ein To-Do der Gruppe, noch ohne Zuständigen', () => {
    const t = vorschlagUebernehmen(vorschlag(), {}, LEITUNG, SPAETER);
    expect(t.wer).toEqual([]);
    expect(toDoRechte(t, mitarbeiter(1)).fall).toBe('ohne');
  });

  it('ablehnen: Stand, Begründung, Zeitpunkt; ohne Begründung fehlt das Feld', () => {
    const n = vorschlagAblehnen(vorschlag(), ' Haben wir. ', LEITUNG, SPAETER);
    expect(n.vorschlag).toMatchObject({
      stand: 'abgelehnt',
      grund: 'Haben wir.',
      abgelehntAm: SPAETER,
    });
    expect(n.verlauf.at(-1)).toMatchObject({ art: 'abgelehnt', text: 'Haben wir.', von: 7 });
    const o = vorschlagAblehnen(vorschlag(), '', LEITUNG, SPAETER);
    expect(o.vorschlag).not.toHaveProperty('grund');
    expect(istToDoVorschlag(n)).toBe(true);
  });

  it('zurückziehen: nie hart gelöscht – als gelöscht vermerkt, der Verlauf sagt es', () => {
    const n = vorschlagZurueckziehen(vorschlag(), PETER, SPAETER);
    expect(n.geloescht).toBe(true);
    expect(n.verlauf.at(-1)).toMatchObject({ art: 'zurueckgezogen', von: 19, name: 'Peter' });
  });

  it('nur ein offener Vorschlag lässt sich entscheiden – sonst unverändert', () => {
    const abgelehnt = vorschlagAblehnen(vorschlag(), '', LEITUNG, SPAETER);
    expect(vorschlagUebernehmen(abgelehnt, {}, LEITUNG, SPAETER)).toBe(abgelehnt);
    expect(vorschlagZurueckziehen(abgelehnt, PETER, SPAETER)).toBe(abgelehnt);
    expect(vorschlagAblehnen(abgelehnt, 'x', LEITUNG, SPAETER)).toBe(abgelehnt);
    const t = todo();
    expect(vorschlagUebernehmen(t, {}, LEITUNG, SPAETER)).toBe(t);
  });
});

describe('vorschlagVerboten: wer darf was', () => {
  const v = vorschlag(PETER);
  it('Leitung übernimmt und lehnt ab, ändert und zieht nicht zurück (fremder Vorschlag)', () => {
    expect(vorschlagVerboten(v, 'uebernehmen', leitung)).toBeNull();
    expect(vorschlagVerboten(v, 'ablehnen', leitung)).toBeNull();
    expect(vorschlagVerboten(v, 'aendern', leitung)).toMatch(/gemacht hat/);
    expect(vorschlagVerboten(v, 'zurueckziehen', leitung)).toMatch(/gemacht hat/);
  });

  it('wer vorschlug ändert und zieht zurück – entscheiden nicht', () => {
    expect(vorschlagVerboten(v, 'aendern', mitarbeiter(19))).toBeNull();
    expect(vorschlagVerboten(v, 'zurueckziehen', mitarbeiter(19))).toBeNull();
    expect(vorschlagVerboten(v, 'uebernehmen', mitarbeiter(19))).toMatch(/nur die Leitung/);
    expect(vorschlagVerboten(v, 'ablehnen', mitarbeiter(19))).toMatch(/nur die Leitung/);
  });

  it('ein fremder Mitarbeiter darf gar nichts', () => {
    for (const tun of ['uebernehmen', 'ablehnen', 'aendern', 'zurueckziehen'] as const)
      expect(vorschlagVerboten(v, tun, mitarbeiter(1))).not.toBeNull();
  });

  it('nicht mehr offen (abgelehnt, zurückgezogen, schon ein To-Do): der Satz sagt es', () => {
    const weg = vorschlagZurueckziehen(v, PETER, SPAETER);
    const abgelehnt = vorschlagAblehnen(v, '', LEITUNG, SPAETER);
    const todoGeworden = vorschlagUebernehmen(v, {}, LEITUNG, SPAETER);
    for (const a of [weg, abgelehnt, todoGeworden])
      expect(vorschlagVerboten(a, 'uebernehmen', leitung)).toMatch(/nicht mehr offen/);
  });
});

describe('vorschlaegeSichtbar: was der Bereich zeigt', () => {
  const heute = '2026-11-20';
  const q = (ich: number, leitungsGruppen: number[], ausgeblendet: string[] = []) => ({
    ich,
    leitungIn: (g: number) => leitungsGruppen.includes(g),
    heute,
    zeitzone: ZONE,
    ausgeblendet,
  });
  const V1 = vorschlag(PETER, { id: 'v1' });
  const V2 = vorschlag(ICH, { id: 'v2', gruppe: 11, am: '2026-11-17T10:00:00.000Z' });
  const ABG = vorschlagAblehnen(
    vorschlag(PETER, { id: 'v3' }),
    'Nein.',
    LEITUNG,
    '2026-11-17T10:00:00.000Z',
  );
  const ALT = vorschlagAblehnen(
    vorschlag(PETER, { id: 'v4' }),
    'Nein.',
    LEITUNG,
    '2026-11-01T10:00:00.000Z',
  );
  const WEG = vorschlagZurueckziehen(vorschlag(PETER, { id: 'v5' }), PETER, SPAETER);
  const alle = [V1, V2, ABG, ALT, WEG];

  it('die Leitung sieht alle offenen ihrer Gruppen und die abgelehnten (7 Tage) – nicht zurückgezogene, nicht alte', () => {
    const s = vorschlaegeSichtbar(alle, q(7, [19, 11]));
    expect(s.offen.map((a) => a.id)).toEqual(['v2', 'v1']); // der älteste zuerst
    expect(s.abgelehnt.map((a) => a.id)).toEqual(['v3']);
  });

  it('Leitung nur in Gruppe 19: Gruppe 11 sieht sie nur, wenn der Vorschlag von ihr selbst ist', () => {
    expect(vorschlaegeSichtbar(alle, q(7, [19])).offen.map((a) => a.id)).toEqual(['v1']);
    expect(vorschlaegeSichtbar(alle, q(1, [19])).offen.map((a) => a.id)).toEqual(['v2', 'v1']);
  });

  it('ein Mitarbeiter sieht nur seine eigenen – offene und abgelehnte', () => {
    const peter = vorschlaegeSichtbar(alle, q(19, []));
    expect(peter.offen.map((a) => a.id)).toEqual(['v1']);
    expect(peter.abgelehnt.map((a) => a.id)).toEqual(['v3']);
    const ich = vorschlaegeSichtbar(alle, q(1, []));
    expect(ich.offen.map((a) => a.id)).toEqual(['v2']);
    expect(ich.abgelehnt).toEqual([]);
  });

  it('ausgeblendet (auf diesem Gerät) fällt aus der Gruppe „Abgelehnt“ – offene nie', () => {
    const s = vorschlaegeSichtbar(alle, q(19, [], ['v3', 'v1']));
    expect(s.abgelehnt).toEqual([]);
    expect(s.offen.map((a) => a.id)).toEqual(['v1']);
  });

  it('nichts zu zeigen: beide Listen leer', () => {
    expect(vorschlaegeSichtbar([todo()], q(7, [19]))).toEqual({ offen: [], abgelehnt: [] });
  });

  it('vorschlagNoch: 7 am Tag des Ablehnens, 4 nach drei Tagen, 0 nach einer Woche', () => {
    expect(vorschlagNoch(ABG, heute, ZONE)).toBe(4);
    expect(vorschlagNoch(ALT, heute, ZONE)).toBe(0);
    expect(vorschlagNoch(V1, heute, ZONE)).toBe(0);
  });
});

describe('Vorsicht: der Vorschlag ist kein To-Do – die Rechner kennen ihn nur, wenn man ihn ihnen gibt', () => {
  it('nach der Trennung zählt er nirgends', () => {
    const { aufgaben } = trenneToDoVorschlaege([todo('t1', [1]), vorschlag()]);
    expect(offene(aufgaben, '2026-11-20').map((a) => a.id)).toEqual(['t1']);
    expect(meineOffenen(aufgaben, 1, '2026-11-20').map((a) => a.id)).toEqual(['t1']);
    expect(aufgaben.some((a) => istFuerMichOffen(a, 19))).toBe(false);
  });
});
