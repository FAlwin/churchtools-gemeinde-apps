// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import {
  listeDaten,
  listeGelesen,
  summeText,
  type ListeEinstellung,
} from '@shared/anmeldung/zeilenListe';
import { Antworten, ListeTabelle } from './AnmeldungAnsehen';

/** F6c: Die Liste mit Zeilen im Fenster einer Anmeldung als kleine Tabelle (Entwurf `f6-liste-v1`). */
const INV: ListeEinstellung = {
  spalten: [
    { id: 'a', name: 'Was', art: 'text' },
    { id: 'b', name: 'Anzahl', art: 'zahl' },
    { id: 'c', name: 'Wert', art: 'zahl', einheit: '€', summe: true },
  ],
  max: 10,
};
const g = (l: ListeEinstellung) =>
  listeGelesen(
    l,
    listeDaten(INV, {
      zeilen: [
        { a: 'Zelt', b: '1', c: '150' },
        { a: 'Kocher', b: '2', c: '1.234,5' },
      ],
    }),
  )!;

describe('ListeTabelle', () => {
  it('Spaltennamen, je Eintrag eine Zeile, Zahlen mit Einheit, darunter die Summe', () => {
    render(<ListeTabelle g={g(INV)} />);
    const kopf = screen.getAllByRole('columnheader').map((x) => x.textContent);
    expect(kopf).toEqual(['Was', 'Anzahl', 'Wert']);
    const zeilen = screen.getAllByRole('row').map((r) =>
      within(r)
        .queryAllByRole('cell')
        .map((c) => c.textContent),
    );
    expect(zeilen).toEqual([
      [],
      ['Zelt', '1', '150 €'],
      ['Kocher', '2', '1.234,5 €'],
      ['Summe', '', summeText(INV, 1384.5)],
    ]);
  });

  it('ohne „Summe zeigen“ keine Summenzeile', () => {
    const ohne: ListeEinstellung = {
      ...INV,
      spalten: INV.spalten.map((s) => ({ ...s, summe: false })),
    };
    render(<ListeTabelle g={g(ohne)} />);
    expect(screen.queryByText('Summe')).toBeNull();
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('im Fenster: eine Antwort mit Liste zeigt die Tabelle statt Text', () => {
    render(<Antworten zeilen={[{ frage: 'Was bringst du mit?', text: '', liste: g(INV) }]} />);
    expect(screen.getByText('Was bringst du mit?')).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText('Kocher')).toBeTruthy();
  });
});
