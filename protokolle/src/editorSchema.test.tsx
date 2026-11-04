// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BlockNoteEditor, type PartialBlock } from '@blocknote/core';
import { ableiten, fremdeTypen, textAus, type Block } from '@shared/protokolle/dokument';
import { dokumentAusTeilen, teileBauen } from '@shared/protokolle/speicher';
import { STANDARD_VORLAGEN, startDokument } from '@shared/protokolle/vorlagen';
import { aufgabenIdsSetzen, EDITOR_TYPEN, schema, TABELLEN } from './editorSchema';
import { farbWert } from './farben';
import { festenPunktEinfuegen } from './festenPunktEinfuegen';
import { tabelleEinfuegen } from './tabelleEinfuegen';
import { ProtokollAnsicht } from './ProtokollAnsicht';
import { aushaengen, einhaengen } from './editorTest.testutil';

/**
 * **Tests gegen den Erzeuger** (Bauplan S1/S4-1): Was der Editor aus einem Protokoll macht, muss die Ableitung,
 * der Speicher und die Lese-Ansicht verstehen – geprüft mit dem echten BlockNote-Editor und unserem Schema, nicht
 * mit handgeschriebenen Literalen.
 */
type Teil = PartialBlock<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>;

const editorMit = (dok: readonly Block[]) =>
  BlockNoteEditor.create({ schema, tables: TABELLEN, initialContent: dok as Teil[] });

const PROTOKOLL: Block[] = [
  { id: 'p1', type: 'heading', props: { level: 1 }, content: 'Andacht' },
  { id: 'x1', type: 'paragraph', content: 'Römer 12' },
  { id: 'p2', type: 'heading', props: { level: 1 }, content: 'Gemeindeleben' },
  {
    id: 'l1',
    type: 'bulletListItem',
    content: 'Haupt',
    children: [
      {
        id: 'l2',
        type: 'numberedListItem',
        content: 'Unter',
        children: [{ id: 'l3', type: 'bulletListItem', content: 'ganz tief' }],
      },
    ],
  },
  { id: 'b1', type: 'beschluss', content: 'Ab November monatlich' },
  { id: 'a1', type: 'aufgabe', props: { aufgabe: 'todo-1' }, content: 'Termine eintragen' },
  { id: 't1', type: 'termin', props: { datum: '2026-12-24' }, content: 'Heiligabend' },
  { id: 'v1', type: 'verweis', props: { art: 'letztes-protokoll' } },
  { id: 'q1', type: 'quote', content: 'Zitat' },
  { id: 'd1', type: 'divider' },
  {
    id: 'tb1',
    type: 'table',
    content: {
      type: 'tableContent',
      headerRows: 1,
      rows: [{ cells: ['Was', 'Wer'] }, { cells: ['Grill', 'Männerkreis'] }],
    },
  },
];

describe('Editor-Schema gegen Ableitung, Speicher und Ansicht', () => {
  it('ausgehängt fasst ein später Zeitgeber des Editors `document` nicht mehr an (CI 26.10.2026)', () => {
    const e = einhaengen(editorMit([{ id: 'p', type: 'paragraph', content: 'Text' }]));
    // Was der Zeitgeber aufruft (`DOMObserver.flush`) – hier gleich, statt 20 ms auf ihn zu warten.
    const beobachter = (e.prosemirrorView as unknown as { domObserver: { flush: () => void } })
      .domObserver;
    aushaengen();
    vi.stubGlobal('document', undefined);
    try {
      expect(() => beobachter.flush()).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  // Das Aushängen nach jedem Test besorgt der Helfer selbst (`afterEach` in `editorTest.testutil.ts`) – die beiden
  // Tests hier gehören zusammen: der erste hängt ein, der zweite sieht nach, ob das Aushängen von allein kam.
  let ansichtVomVorigenTest: { isDestroyed: boolean } | undefined;
  it('ein eingehängter Editor lebt während des Tests …', () => {
    const e = einhaengen(editorMit([{ id: 'p', type: 'paragraph', content: 'Text' }]));
    ansichtVomVorigenTest = e.prosemirrorView;
    expect(ansichtVomVorigenTest.isDestroyed).toBe(false);
  });

  it('… und ist im nächsten von selbst ausgehängt, ohne eigenes afterEach', () => {
    expect(ansichtVomVorigenTest?.isDestroyed).toBe(true);
  });

  it('eigene Blöcke behalten ihre Daten – die Ableitung findet alles wieder', () => {
    const doc = editorMit(PROTOKOLL).document as Block[];
    expect(ableiten(doc)).toEqual(ableiten(PROTOKOLL));
    const a = ableiten(doc);
    expect(a.aufgaben[0].aufgabe).toBe('todo-1');
    expect(a.termine[0].datum).toBe('2026-12-24');
    expect(doc.find((b) => b.id === 'v1')?.props?.art).toBe('letztes-protokoll');
  });

  it('gespeichert, neu geladen und wieder im Editor: unverändert', () => {
    const doc = editorMit(PROTOKOLL).document as Block[];
    const { stand, werte } = teileBauen(doc, 's1');
    const zurueck = dokumentAusTeilen(
      { sitzung: 's1', stand },
      werte.map((w) => JSON.parse(w)),
    );
    // Gespeichert wird JSON: Aus einer leeren Spaltenbreite der Tabelle wird `null` – der Editor macht beim Laden wieder
    // dasselbe Dokument daraus.
    expect(zurueck).toEqual(JSON.parse(JSON.stringify(doc)));
    expect(editorMit(zurueck!).document).toEqual(doc);
  });

  it('der Editor kennt jede Blockart, die er selbst und die Vorlagen erzeugen', () => {
    const doc = editorMit(PROTOKOLL).document as Block[];
    expect(fremdeTypen(doc, EDITOR_TYPEN)).toEqual([]);
    let n = 0;
    for (const v of STANDARD_VORLAGEN)
      expect(
        fremdeTypen(
          startDokument(v, () => `v${n++}`),
          EDITOR_TYPEN,
        ),
      ).toEqual([]);
  });

  it('die Lese-Ansicht zeigt jede Blockart, die der Editor kennt (Trennlinie fehlte, gefunden 24.10.2026)', () => {
    const doc = editorMit(PROTOKOLL).document as Block[];
    const gezeigt = new Set<string>();
    for (const typ of EDITOR_TYPEN) {
      const block = doc.find((b) => b.type === typ) ?? { id: typ, type: typ, content: 'Inhalt' };
      const { container, unmount } = render(<ProtokollAnsicht dokument={[block]} />);
      if (container.querySelector('article')?.innerHTML) gezeigt.add(typ);
      unmount();
    }
    expect([...EDITOR_TYPEN].filter((t) => !gezeigt.has(t))).toEqual([]);
  });

  it('Markieren im Editor (Hintergrund + Schrift, wie die Leiste) erscheint in der Lese-Ansicht (K3a)', () => {
    const e = einhaengen(editorMit([{ id: 'm', type: 'paragraph', content: 'ganz wichtig' }]));
    // Den ganzen Text markieren, wie mit der Maus – dann färben wie „Markieren ▾“ (`farbeSetzen`).
    e._tiptapEditor.commands.selectAll();
    e.addStyles({ backgroundColor: 'yellow', textColor: 'red' });
    const stueck = (e.document[0].content as { styles: Record<string, unknown> }[])[0];
    expect(stueck.styles).toMatchObject({ backgroundColor: 'yellow', textColor: 'red' });
    render(<ProtokollAnsicht dokument={e.document as Block[]} />);
    const stil = screen.getByText('ganz wichtig').closest('span')?.getAttribute('style') ?? '';
    expect(stil).toContain(`background-color: ${farbWert('yellow', 'hintergrund', 'light')}`);
    expect(stil).toContain('color: rgb(224, 62, 62)'); // BlockNotes Rot, #e03e3e
  });

  it('Kopfzeile und -spalte lassen sich umschalten – BlockNote zeigt die Menüpunkte nur mit dieser Einstellung (K3a)', () => {
    expect(editorMit([{ id: 'p', type: 'paragraph' }]).settings.tables).toMatchObject({
      headers: true,
      splitCells: false,
    });
  });

  it('Tabelle aus der Leiste: Kopfzeile, Zellen, Suche und Speicher verstehen sie (K3a)', () => {
    const e = einhaengen(editorMit([{ id: 'p', type: 'paragraph', content: '' }]));
    e.setTextCursorPosition('p', 'start');
    tabelleEinfuegen(e);
    const t = e.document.find((b) => b.type === 'table');
    expect(t).toBeDefined();
    expect(t?.content).toMatchObject({ type: 'tableContent', headerRows: 1 });
    // Text in die Zellen, wie beim Tippen – Kopfzeile und erste Zeile.
    const inhalt = t!.content as { rows: { cells: unknown[] }[] };
    e.updateBlock(t!.id, {
      content: {
        ...inhalt,
        rows: inhalt.rows.map((r, z) => ({
          ...r,
          cells: r.cells.map((_, s) => (z < 2 ? `Z${z}S${s}` : '')),
        })),
      },
    } as Teil);
    const doc = e.document as Block[];
    const { container } = render(<ProtokollAnsicht dokument={doc} />);
    expect([...container.querySelectorAll('th')].map((x) => x.textContent)).toEqual([
      'Z0S0',
      'Z0S1',
      'Z0S2',
    ]);
    expect(container.querySelectorAll('td')).toHaveLength(6);
    expect(container.querySelector('td')?.textContent).toBe('Z1S0');
    expect(textAus(doc.find((b) => b.type === 'table')?.content)).toBe(
      'Z0S0 Z0S1 Z0S2 Z1S0 Z1S1 Z1S2',
    );
    const { stand, werte } = teileBauen(doc, 's1');
    const zurueck = dokumentAusTeilen(
      { sitzung: 's1', stand },
      werte.map((w) => JSON.parse(w)),
    );
    expect(editorMit(zurueck!).document).toEqual(doc);
  });

  it('Aufgaben-IDs: gesetzt für neue und doppelte, Rückgängig nimmt sie NICHT wieder weg (S4-2)', () => {
    const e = editorMit([
      { id: 'p', type: 'paragraph', content: 'Text' },
      { id: 'a1', type: 'aufgabe', props: { aufgabe: '' }, content: 'Beamer' },
    ]);
    einhaengen(e);
    // Eine Eingabe, die im Verlauf landet – danach die IDs, dann Rückgängig.
    e.updateBlock('p', { content: 'Text geändert' });
    let n = 0;
    expect(
      aufgabenIdsSetzen(
        e,
        () => false,
        () => `id${++n}`,
      ),
    ).toBe(true);
    expect(e.getBlock('a1')?.props).toMatchObject({ aufgabe: 'id1' });
    expect(
      aufgabenIdsSetzen(
        e,
        () => false,
        () => `id${++n}`,
      ),
    ).toBe(false);
    expect(e.undo()).toBe(true);
    expect(JSON.stringify(e.getBlock('p')?.content)).toContain('"Text"');
    expect(e.getBlock('a1')?.props).toMatchObject({ aufgabe: 'id1' });
  });

  it('fester Punkt: Tagesordnungspunkt + Punkt + leere Zeile – auf oberster Ebene, eine leere Zeile wird ersetzt (S4-3a)', () => {
    const e = editorMit([
      {
        id: 'l1',
        type: 'bulletListItem',
        content: 'Haupt',
        children: [{ id: 'l2', type: 'bulletListItem', content: 'Unter' }],
      },
      { id: 'x', type: 'paragraph' },
    ]);
    einhaengen(e);
    e.setTextCursorPosition('l2', 'end');
    festenPunktEinfuegen(e, 'offene-aufgaben');
    const art = () =>
      (e.document as Block[]).map((b) => [b.type, textAus(b.content), b.props?.art ?? null]);
    expect(art()).toEqual([
      ['bulletListItem', 'Haupt', null],
      ['heading', 'Offene To-Dos', null],
      ['verweis', '', 'offene-aufgaben'],
      ['paragraph', '', null],
      ['paragraph', '', null],
    ]);
    expect(ableiten(e.document as Block[]).punkte.map((p) => p.titel)).toEqual(['Offene To-Dos']);
    // Die Zeile darunter ist leer und hat den Cursor – dort der nächste: ersetzt sie.
    festenPunktEinfuegen(e, 'letztes-protokoll');
    expect(art()).toEqual([
      ['bulletListItem', 'Haupt', null],
      ['heading', 'Offene To-Dos', null],
      ['verweis', '', 'offene-aufgaben'],
      ['heading', 'Protokoll der letzten Sitzung', null],
      ['verweis', '', 'letztes-protokoll'],
      ['paragraph', '', null],
      ['paragraph', '', null],
    ]);
  });
});
