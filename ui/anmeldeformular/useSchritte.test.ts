// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';
import type { Antworten, Feld, OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { useSchritte } from './useSchritte';

/** F2b: die offene Seite merkt sich ihren Baustein – fällt sie weg, gilt die gezeigte davor. */
function einstellungen(): OeffentlicheEinstellungen {
  const e = neueEinstellungen('einfach');
  const feld = (id: string, typ: Feld['typ'], frage: string, extra: Partial<Feld> = {}): Feld => ({
    id,
    art: 'eigen',
    typ,
    frage,
    hilfe: '',
    zustand: 'freiwillig',
    antworten: [],
    ...extra,
  });
  const ende = e.formular.anmeldung.findIndex((f) => f.typ === 'price' || f.typ === 'privacy');
  e.formular.anmeldung.splice(
    ende,
    0,
    feld('s2', 'schritt', 'Mitarbeit'),
    feld('mit', 'janein', 'Mitarbeit?'),
    feld('s3', 'schritt', 'Team', {
      bed: { modus: 'eine', regeln: [{ feld: 'mit', op: 'ist', wert: 'Ja' }] },
    }),
    feld('erfahrung', 'text', 'Erfahrung'),
    feld('s4', 'schritt', 'Abschluss'),
  );
  return e;
}
const antworten = (mit: string): Antworten => ({
  anmeldung: { name: { vor: 'Maria', nach: 'B' }, mail: 'maria@beispiel.test', mit },
  personen: [{ pname: { vor: 'Maria', nach: 'B' } }],
});

describe('useSchritte (F2b)', () => {
  it('fällt die offene Seite weg, gilt die gezeigte davor – nicht die danach', () => {
    const e = einstellungen();
    const { result, rerender } = renderHook(
      ({ a }) => useSchritte({ e, antworten: a, aktiv: true }),
      {
        initialProps: { a: antworten('Ja') },
      },
    );
    act(() => void result.current.weiter());
    act(() => void result.current.weiter());
    expect(result.current.name).toBe('Team');
    rerender({ a: antworten('Nein') });
    expect(result.current.name).toBe('Mitarbeit');
    expect(result.current.gezeigt).toHaveLength(3);
  });

  it('nicht aktiv (Baukasten): keine Seiten, alles steht da', () => {
    const e = einstellungen();
    const { result } = renderHook(() =>
      useSchritte({ e, antworten: antworten('Ja'), aktiv: false }),
    );
    expect(result.current.mit).toBe(false);
    expect(result.current.letzte).toBe(true);
    expect(result.current.zeigtKontakt(e.formular.anmeldung[0])).toBe(true);
    expect(result.current.personenAnlegen).toBe(true);
  });
});

describe('useSchritte – „Person dazu“ von Hand (F2d, `nurPerson`)', () => {
  const pflicht = (id: string, frage: string): Feld => ({
    id,
    art: 'eigen',
    typ: 'text',
    frage,
    hilfe: '',
    zustand: 'pflicht',
    antworten: [],
  });
  /** Wie oben, dazu nach „Abschluss“ eine Kontakt-Pflichtfrage und am Ende ein Schritt „Kind“ mit einer Frage je Person. */
  function mitKind(): OeffentlicheEinstellungen {
    const e = einstellungen();
    const s4 = e.formular.anmeldung.findIndex((f) => f.id === 's4');
    e.formular.anmeldung.splice(s4 + 1, 0, pflicht('abschluss', 'Wie habt ihr davon erfahren?'));
    e.formular.person.push(
      { ...pflicht('s5', 'Kind'), typ: 'schritt', zustand: 'freiwillig' },
      pflicht('schule', 'Schule'),
    );
    return e;
  }

  it('nur die Seiten mit Fragen je Person – „Weiter“ verlangt nur deren Pflichtfragen', () => {
    const e = mitKind();
    const a: Antworten = { ...antworten('Ja'), personen: [{}] };
    const { result, rerender } = renderHook(
      ({ x }) => useSchritte({ e, antworten: x, aktiv: true, nurPerson: true }),
      { initialProps: { x: a } },
    );
    expect(result.current.gezeigt.map((s) => s.schritt?.id)).toEqual(['s4', 's5']);
    let fehlt: string[] = [];
    act(() => void (fehlt = result.current.weiter()));
    // Die Kontakt-Pflichtfrage „abschluss“ steht auf derselben Seite – sie zählt hier nicht.
    expect(fehlt).toEqual(['personen.0.pname.vor', 'personen.0.pname.nach']);
    expect(result.current.name).toBe('Abschluss');
    rerender({ x: { ...a, personen: [{ pname: { vor: 'Paul', nach: 'B' } }] } });
    act(() => void (fehlt = result.current.weiter()));
    expect(fehlt).toEqual([]);
    expect(result.current.name).toBe('Kind');
  });

  it('ohne `nurPerson` zählt die Kontakt-Pflichtfrage mit', () => {
    const e = mitKind();
    const { result } = renderHook(() =>
      useSchritte({ e, antworten: { ...antworten('Ja'), personen: [{}] }, aktiv: true }),
    );
    act(() => void result.current.weiter());
    act(() => void result.current.weiter());
    act(() => void result.current.weiter());
    expect(result.current.name).toBe('Abschluss');
    let fehlt: string[] = [];
    act(() => void (fehlt = result.current.weiter()));
    expect(fehlt).toContain('anmeldung.abschluss');
  });

  it('hat keine gezeigte Seite Fragen je Person, bleiben die gezeigten (nie eine leere Liste)', () => {
    const e = einstellungen();
    const s4 = e.formular.anmeldung.find((f) => f.id === 's4')!;
    s4.bed = { modus: 'eine', regeln: [{ feld: 'mit', op: 'ist', wert: 'Ja' }] };
    const { result } = renderHook(() =>
      useSchritte({ e, antworten: antworten('Nein'), aktiv: true, nurPerson: true }),
    );
    expect(result.current.gezeigt.map((s) => s.schritt?.id ?? null)).toEqual([null, 's2']);
    expect(result.current.name).toBe('Deine Angaben');
  });
});
