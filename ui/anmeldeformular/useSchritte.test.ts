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
