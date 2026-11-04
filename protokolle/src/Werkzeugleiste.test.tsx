// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { BlockNoteEditor, type PartialBlock } from '@blocknote/core';
import type { Block } from '@shared/protokolle/dokument';
import { schema, TABELLEN, type ProtokollEditor } from './editorSchema';
import { einhaengen } from './editorTest.testutil';
import { Werkzeugleiste } from './Werkzeugleiste';

/**
 * **Die Leiste in Gruppen, Variante B** (K3a, Entwurf `k3-leiste-v1`): mit dem echten Editor – was ein Menü tut, muss im
 * Dokument ankommen, und die Markierung im Text darf beim Tippen in die Leiste nicht verloren gehen.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type Teil = PartialBlock<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>;

function editorMit(dok: readonly Block[]): ProtokollEditor {
  return einhaengen(
    BlockNoteEditor.create({ schema, tables: TABELLEN, initialContent: dok as Teil[] }),
  );
}

/** Handy-Breite vortäuschen (`useMedienAbfrage(HANDY_BREITE)`). */
function handy(): void {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('max-width'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

/** Den ersten Text markieren, wie mit der Maus (eine Textauswahl – „Alles markieren“ meldet keine aktiven Stile). */
function textMarkieren(e: ProtokollEditor): void {
  let von = -1;
  let laenge = 0;
  e._tiptapEditor.state.doc.descendants((n, pos) => {
    if (von < 0 && n.isText) {
      von = pos;
      laenge = n.nodeSize;
    }
  });
  e._tiptapEditor.commands.setTextSelection({ from: von, to: von + laenge });
}

const menue = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name }));
  return screen.getByRole('menu', { name });
};

describe('Werkzeugleiste (K3a)', () => {
  it('PC: Textart mit den neuen Namen, ohne Checkliste; Markieren · Absatz · Einfügen als Menüs', () => {
    const e = editorMit([{ id: 'p', type: 'paragraph', content: 'Text' }]);
    e.setTextCursorPosition('p', 'start');
    render(<Werkzeugleiste editor={e} />);
    const wahl = screen.getByRole('combobox', { name: 'Textart' });
    expect([...wahl.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'Text',
      'Tagesordnungspunkt',
      'Unterpunkt',
      'Überschrift',
    ]);
    for (const m of ['Markieren', 'Absatz', 'Einfügen'])
      expect(screen.getByRole('button', { name: m }).getAttribute('aria-haspopup')).toBe('menu');
    expect(screen.queryByText('Checkliste')).toBeNull();
  });

  it('„Unterpunkt“ macht eine Überschrift der Stufe 2', () => {
    const e = editorMit([{ id: 'p', type: 'paragraph', content: 'Aufbau' }]);
    e.setTextCursorPosition('p', 'start');
    render(<Werkzeugleiste editor={e} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Textart' }), {
      target: { value: 'heading-2' },
    });
    expect(e.document[0]).toMatchObject({ type: 'heading', props: { level: 2 } });
  });

  it('Markieren: Hintergrund und Schrift landen am markierten Text; „keine“ nimmt sie wieder weg', () => {
    const e = editorMit([{ id: 'p', type: 'paragraph', content: 'ganz wichtig' }]);
    textMarkieren(e);
    render(<Werkzeugleiste editor={e} />);
    fireEvent.click(within(menue('Markieren')).getAllByRole('button', { name: 'Gelb' })[0]);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(
      within(within(menue('Markieren')).getByRole('group', { name: 'Schrift' })).getByRole(
        'button',
        { name: 'Rot' },
      ),
    );
    const stile = () => (e.document[0].content as { styles: Record<string, unknown> }[])[0].styles;
    expect(stile()).toMatchObject({ backgroundColor: 'yellow', textColor: 'red' });
    // Das Menü zeigt, was gesetzt ist.
    const m = menue('Markieren');
    expect(
      within(within(m).getByRole('group', { name: 'Hintergrund' }))
        .getByRole('button', { name: 'Gelb' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(within(m).getByTitle('Kein Hintergrund'));
    expect(stile().backgroundColor).toBeUndefined();
    expect(stile().textColor).toBe('red');
  });

  it('alle neun Farben, je für Hintergrund und Schrift', () => {
    const e = editorMit([{ id: 'p', type: 'paragraph', content: 'x' }]);
    textMarkieren(e);
    render(<Werkzeugleiste editor={e} />);
    const m = menue('Markieren');
    for (const g of ['Hintergrund', 'Schrift'])
      expect(within(within(m).getByRole('group', { name: g })).getAllByRole('button')).toHaveLength(
        10,
      );
  });

  it('Einfügen: To-Do, Beschluss, Termin, Tabelle, feste Punkte, Trennlinie – keine Checkliste', () => {
    const e = editorMit([{ id: 'p', type: 'paragraph', content: '' }]);
    e.setTextCursorPosition('p', 'start');
    render(<Werkzeugleiste editor={e} />);
    expect(
      within(menue('Einfügen'))
        .getAllByRole('menuitem')
        .map((b) => b.textContent),
    ).toEqual([
      'To-Do',
      'Beschluss',
      'Termin',
      'Tabelle',
      'Offene To-Dos',
      'Protokoll der letzten Sitzung',
      'Trennlinie',
    ]);
  });

  it('Einfügen → Tabelle: drei Spalten mit Kopfzeile, an der leeren Zeile', () => {
    const e = editorMit([{ id: 'p', type: 'paragraph', content: '' }]);
    e.setTextCursorPosition('p', 'start');
    render(<Werkzeugleiste editor={e} />);
    fireEvent.click(within(menue('Einfügen')).getByRole('menuitem', { name: 'Tabelle' }));
    const t = e.document.find((b) => b.type === 'table');
    expect(t?.content).toMatchObject({ type: 'tableContent', headerRows: 1 });
    expect(
      (t?.content as { rows: { cells: unknown[] }[] }).rows.map((r) => r.cells.length),
    ).toEqual([3, 3, 3]);
  });

  it('Einfügen → To-Do macht die Zeile zum To-Do, der Text bleibt', () => {
    const e = editorMit([{ id: 'p', type: 'paragraph', content: 'Beamer besorgen' }]);
    e.setTextCursorPosition('p', 'end');
    render(<Werkzeugleiste editor={e} />);
    fireEvent.click(within(menue('Einfügen')).getByRole('menuitem', { name: 'To-Do' }));
    expect(e.document[0]).toMatchObject({ type: 'aufgabe' });
  });

  it('Absatz: Aufzählung, Nummerierung, Aus-/Einrücken, Zitat – Aufzählung schaltet um', () => {
    const e = editorMit([{ id: 'p', type: 'paragraph', content: 'Punkt' }]);
    e.setTextCursorPosition('p', 'start');
    render(<Werkzeugleiste editor={e} />);
    const m = menue('Absatz');
    expect(
      within(m)
        .getAllByRole('menuitem')
        .map((b) => b.textContent),
    ).toEqual([
      'Aufzählung',
      'Nummerierung',
      'Ausrücken (Umschalt+Tab)',
      'Einrücken (Tab)',
      'Zitat',
    ]);
    fireEvent.click(within(m).getByRole('menuitem', { name: 'Aufzählung' }));
    expect(e.document[0].type).toBe('bulletListItem');
  });

  it('eine alte Checkliste bleibt lesbar: die Auswahl zeigt sie und macht Text daraus', () => {
    const e = editorMit([{ id: 'c', type: 'checkListItem', content: 'erledigt?' }]);
    e.setTextCursorPosition('c', 'start');
    render(<Werkzeugleiste editor={e} />);
    const wahl = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Textart' });
    expect(wahl.value).toBe('checkListItem');
    fireEvent.change(wahl, { target: { value: 'paragraph' } });
    expect(e.document[0].type).toBe('paragraph');
  });

  it('Handy: Fett direkt, Textart und Kursiv unter „Text“, die Menüs nur als Zeichen', () => {
    handy();
    const e = editorMit([{ id: 'p', type: 'paragraph', content: 'Text' }]);
    e.setTextCursorPosition('p', 'start');
    render(<Werkzeugleiste editor={e} />);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Fett (Strg+B)' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Kursiv/ })).toBeNull();
    // Menüs ohne Wort im Knopf – der Name steht im Titel.
    expect(screen.getByRole('button', { name: 'Absatz' }).textContent).toBe('');
    const m = menue('Text');
    expect(
      within(m)
        .getAllByRole('menuitem')
        .map((b) => b.textContent),
    ).toEqual([
      'Text',
      'Tagesordnungspunkt',
      'Unterpunkt',
      'Überschrift',
      'IKursiv',
      'UUnterstrichen',
      'SDurchgestrichen',
      'Formatierung entfernen',
    ]);
    act(() => {
      fireEvent.click(within(m).getByRole('menuitem', { name: 'Tagesordnungspunkt' }));
    });
    expect(e.document[0]).toMatchObject({ type: 'heading', props: { level: 1 } });
  });
});
