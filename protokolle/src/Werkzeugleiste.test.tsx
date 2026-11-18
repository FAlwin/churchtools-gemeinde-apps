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
      'Anwesenheit',
      'Früheres Protokoll',
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

  it('Absatz → Einrücken macht aus dem Punkt einen Unterpunkt; am ersten Punkt ist Einrücken aus (K3b)', () => {
    const titel = (id: string) =>
      ({ id, type: 'heading', props: { level: 1 }, content: id }) as Block;
    // Mit einer Zeile davor könnte BlockNote „A“ einrücken (als Kind) – die Regel sagt: der erste Punkt bleibt Punkt.
    const e = editorMit([
      { id: 'vor', type: 'paragraph', content: 'Vorspann' },
      titel('A'),
      titel('B'),
    ]);
    e.setTextCursorPosition('A', 'end');
    const { rerender } = render(<Werkzeugleiste editor={e} />);
    const einruecken = within(menue('Absatz')).getByRole<HTMLButtonElement>('menuitem', {
      name: 'Einrücken (Tab)',
    });
    expect(einruecken.disabled).toBe(true);
    act(() => e.setTextCursorPosition('B', 'end'));
    rerender(<Werkzeugleiste editor={e} />);
    const m = screen.getByRole('menu', { name: 'Absatz' });
    fireEvent.click(within(m).getByRole('menuitem', { name: 'Einrücken (Tab)' }));
    const stufe = (b: (typeof e.document)[number]) => ('level' in b.props ? b.props.level : null);
    expect(e.document.map((b) => [b.id, stufe(b), b.children.length])).toEqual([
      ['vor', null, 0],
      ['A', 1, 0],
      ['B', 2, 0],
    ]);
  });

  it('ein Unterpunkt jeder Ebene heißt in der Auswahl „Unterpunkt“ (K3b)', () => {
    const e = editorMit([
      { id: 'A', type: 'heading', props: { level: 1 }, content: 'A' },
      { id: 'A1', type: 'heading', props: { level: 2 }, content: 'A1' },
      { id: 'A1a', type: 'heading', props: { level: 4 }, content: 'A1a' },
    ] as Block[]);
    e.setTextCursorPosition('A1a', 'end');
    render(<Werkzeugleiste editor={e} />);
    const wahl = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Textart' });
    expect(wahl.selectedOptions[0].textContent).toBe('Unterpunkt');
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

describe('Punkte ordnen (W7): der Knopf rechts in der Leiste und der Weg bis in den Editor', () => {
  const h = (id: string, text: string, level = 1): Block => ({
    id,
    type: 'heading',
    props: { level },
    content: text,
  });
  const DOK: Block[] = [
    h('A', 'Andacht'),
    { id: 'a1', type: 'bulletListItem', content: 'Impuls' },
    h('B', 'Technik'),
    { id: 'todo', type: 'aufgabe', props: { aufgabe: 'aufgabe-4' }, content: 'Batterien' },
    h('C', 'Ausblick'),
  ];
  const ids = (e: ProtokollEditor) => e.document.map((b) => b.id);

  it('ist ausgegraut, solange es nichts zu ordnen gibt – und frei, sobald zwei Punkte da sind', () => {
    const e = editorMit([
      h('A', 'Einziger Punkt'),
      { id: 'x', type: 'paragraph', content: 'Text' },
    ]);
    e.setTextCursorPosition('x', 'start');
    render(<Werkzeugleiste editor={e} />);
    const knopf = screen.getByRole<HTMLButtonElement>('button', { name: 'Punkte ordnen' });
    expect(knopf.disabled).toBe(true);
    expect(knopf.title).toMatch(/mindestens zwei Punkte/);
    act(() => {
      e.insertBlocks([h('B', 'Zweiter Punkt')] as Teil[], 'x', 'after');
    });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Punkte ordnen' }).disabled).toBe(
      false,
    );
  });

  it('Fenster auf, umstellen, Übernehmen: der Editor hat die neue Reihenfolge, ein Strg+Z holt alles zurück', () => {
    const e = editorMit(DOK);
    e.setTextCursorPosition('a1', 'start');
    render(<Werkzeugleiste editor={e} />);
    fireEvent.click(screen.getByRole('button', { name: 'Punkte ordnen' }));
    expect(screen.getByRole('dialog', { name: 'Punkte ordnen' })).toBeTruthy();
    // Zwei Züge im Fenster …
    fireEvent.click(screen.getByRole('button', { name: 'Ausblick nach oben' }));
    fireEvent.click(screen.getByRole('button', { name: 'Andacht nach unten' }));
    // … das Dokument ist bis „Übernehmen“ unberührt.
    expect(ids(e)).toEqual(DOK.map((b) => b.id));
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(ids(e)).toEqual(['C', 'A', 'a1', 'B', 'todo']);
    expect(e.getBlock('todo')?.props).toMatchObject({ aufgabe: 'aufgabe-4' });
    e.undo();
    expect(ids(e)).toEqual(DOK.map((b) => b.id));
  });

  it('Abbrechen lässt das Dokument, wie es ist', () => {
    const e = editorMit(DOK);
    e.setTextCursorPosition('a1', 'start');
    render(<Werkzeugleiste editor={e} />);
    fireEvent.click(screen.getByRole('button', { name: 'Punkte ordnen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ausblick nach oben' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(ids(e)).toEqual(DOK.map((b) => b.id));
  });

  it('PC: der Knopf steht rechts außen, am Handy als Erstes in der Leiste', () => {
    const e = editorMit(DOK);
    e.setTextCursorPosition('a1', 'start');
    const pc = render(<Werkzeugleiste editor={e} />);
    const alle = (r: ReturnType<typeof render>) =>
      [...r.container.querySelectorAll('[role="toolbar"] button')].map((b) =>
        b.getAttribute('aria-label'),
      );
    expect(alle(pc).at(-1)).toBe('Punkte ordnen');
    pc.unmount();
    handy();
    const mobil = render(<Werkzeugleiste editor={e} />);
    expect(alle(mobil)[0]).toBe('Punkte ordnen');
  });
});
