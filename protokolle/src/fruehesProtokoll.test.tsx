// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { BlockNoteEditor, type PartialBlock } from '@blocknote/core';
import { textAus, type Block } from '@shared/protokolle/dokument';
import { festesProtokollAus } from '@shared/protokolle/festePunkte';
import { teileBauen, type ProtokollKopf, type ProtokollTeil } from '@shared/protokolle/speicher';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { schema, TABELLEN, type ProtokollEditor } from './editorSchema';
import { einhaengen } from './editorTest.testutil';
import { FestePunkteRahmen } from './FestePunkteRahmen';
import { VerweisBlock } from './EditorBloecke';
import { ProtokollAnsicht } from './ProtokollAnsicht';
import { Werkzeugleiste } from './Werkzeugleiste';

/**
 * **Früheres Protokoll** (K3b-2, Entwurf `k3b-v1`): Einfügen fragt, welches; „Ändern“ am Kasten wählt ein anderes;
 * „Öffnen“ im Fenster springt zur Sitzung – mit dem echten Editor im echten Rahmen.
 */

afterEach(cleanup);

type Teil = PartialBlock<
  typeof schema.blockSchema,
  typeof schema.inlineContentSchema,
  typeof schema.styleSchema
>;

const t = (text: string) => [{ type: 'text', text, styles: {} }];
const kopf = (sitzung: string, beginn: string, status: ProtokollKopf['status']): ProtokollKopf => ({
  art: 'protokoll',
  fassung: 1,
  sitzung,
  titel: 'Leitungssitzung',
  status,
  beginn,
  termin: null,
  treffen: null,
  freigabe: status === 'frei' ? { von: 1, am: '2026-10-15T08:00:00Z' } : null,
  sperre: null,
  stand: 'x',
});
const sitzungAus = (k: ProtokollKopf): Sitzung => ({
  schluessel: `p:${k.sitzung}`,
  beginn: k.beginn,
  titel: k.titel,
  termin: null,
  treffen: null,
  kopf: k,
  anfragen: [],
});

const ALT_DOK: Block[] = [
  { id: 'a1', type: 'heading', props: { level: 1 }, content: t('Finanzen'), children: [] },
];
const altTeile = teileBauen(ALT_DOK, 'okt');
const OKT = sitzungAus({ ...kopf('okt', '2026-10-14T17:00:00Z', 'frei'), stand: altTeile.stand });
const SEPT = sitzungAus(kopf('sept', '2026-09-09T17:00:00Z', 'frei'));
const HEUTE = sitzungAus(kopf('heute', '2026-10-28T17:00:00Z', 'entwurf'));
const TEILE = altTeile.werte.map((w) => JSON.parse(w) as ProtokollTeil);

function editorMit(dok: readonly Block[]): ProtokollEditor {
  return einhaengen(
    BlockNoteEditor.create({ schema, tables: TABELLEN, initialContent: dok as Teil[] }),
  );
}

const rahmen = (
  inhalt: React.ReactNode,
  q: { protokolle?: Sitzung[]; onZuSitzung?: (s: Sitzung) => void } = {},
) =>
  render(
    <FestePunkteRahmen
      sitzung={HEUTE}
      gruppe={194}
      protokolle={q.protokolle ?? [SEPT, OKT]}
      teile={TEILE}
      aufgaben={[]}
      zeitzone="Europe/Berlin"
      onZuSitzung={q.onZuSitzung}
    >
      {inhalt}
    </FestePunkteRahmen>,
  );

/** Überschrift-Text und `fest` der oberen Blöcke. */
const bild = (e: ProtokollEditor) =>
  e.document.map((b) =>
    b.type === 'verweis'
      ? ['verweis', festesProtokollAus(b.props.fest)?.sitzung ?? 'live']
      : [b.type, textAus((b as Block).content)],
  );

const einfuegen = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Einfügen' }));
  fireEvent.click(
    within(screen.getByRole('menu', { name: 'Einfügen' })).getByRole('menuitem', {
      name: 'Früheres Protokoll',
    }),
  );
};

describe('Früheres Protokoll einfügen (K3b-2)', () => {
  it('das Fenster zeigt die freigegebenen Protokolle, neueste zuerst, das letzte vorgewählt', () => {
    const e = editorMit([{ id: 'p', type: 'paragraph', content: t('') }]);
    e.setTextCursorPosition('p', 'start');
    rahmen(<Werkzeugleiste editor={e} />);
    einfuegen();
    const fenster = screen.getByRole('dialog', { name: 'Früheres Protokoll einfügen' });
    const zeilen = within(within(fenster).getByRole('group')).getAllByRole('button');
    expect(zeilen.map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Leitungssitzung · 14.10.2026 · letzte Sitzungfreigegeben am 15.10.2026', 'true'],
      ['Leitungssitzung · 09.09.2026freigegeben am 15.10.2026', 'false'],
    ]);
    // Noch nichts eingefügt, solange das Fenster offen ist.
    expect(e.document.map((b) => b.type)).toEqual(['paragraph']);
  });

  it('ein älteres gewählt: „Protokoll vom …“, gleich festgehalten', () => {
    const e = editorMit([{ id: 'p', type: 'paragraph', content: t('') }]);
    e.setTextCursorPosition('p', 'start');
    rahmen(<Werkzeugleiste editor={e} />);
    einfuegen();
    const fenster = screen.getByRole('dialog', { name: 'Früheres Protokoll einfügen' });
    fireEvent.click(within(fenster).getByRole('button', { name: /09\.09\.2026/ }));
    fireEvent.click(within(fenster).getByRole('button', { name: 'Einfügen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(bild(e).slice(0, 2)).toEqual([
      ['heading', 'Protokoll vom 09.09.2026'],
      ['verweis', 'sept'],
    ]);
  });

  it('das letzte gewählt: „Protokoll der letzten Sitzung“, ebenfalls festgehalten', () => {
    const e = editorMit([{ id: 'p', type: 'paragraph', content: t('') }]);
    e.setTextCursorPosition('p', 'start');
    rahmen(<Werkzeugleiste editor={e} />);
    einfuegen();
    const fenster = screen.getByRole('dialog', { name: 'Früheres Protokoll einfügen' });
    fireEvent.click(within(fenster).getByRole('button', { name: 'Einfügen' }));
    expect(bild(e).slice(0, 2)).toEqual([
      ['heading', 'Protokoll der letzten Sitzung'],
      ['verweis', 'okt'],
    ]);
  });

  it('Abbrechen fügt nichts ein', () => {
    const e = editorMit([{ id: 'p', type: 'paragraph', content: t('') }]);
    e.setTextCursorPosition('p', 'start');
    rahmen(<Werkzeugleiste editor={e} />);
    einfuegen();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(e.document.map((b) => b.type)).toEqual(['paragraph']);
  });

  it('ohne freigegebenes Protokoll kein Fenster: der Kasten kommt wie bisher (live)', () => {
    const e = editorMit([{ id: 'p', type: 'paragraph', content: t('') }]);
    e.setTextCursorPosition('p', 'start');
    rahmen(<Werkzeugleiste editor={e} />, { protokolle: [] });
    einfuegen();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(bild(e).slice(0, 2)).toEqual([
      ['heading', 'Protokoll der letzten Sitzung'],
      ['verweis', 'live'],
    ]);
  });
});

describe('Kasten: Ändern und Ansehen (K3b-2)', () => {
  const dok = (titel: string): Block[] => [
    { id: 'h', type: 'heading', props: { level: 1 }, content: t(titel), children: [] },
    { id: 'v', type: 'verweis', props: { art: 'letztes-protokoll', fest: '' }, children: [] },
  ];
  const kasten = (e: ProtokollEditor) => {
    const b = e.getBlock('v')!;
    return (
      <VerweisBlock
        block={{ id: 'v', props: b.props as { art: string; fest: string } }}
        editor={e}
      />
    );
  };

  it('ohne Wahl: „immer die letzte Sitzung“; Ändern wählt ein anderes, der Titel zieht mit', () => {
    const e = editorMit(dok('Protokoll der letzten Sitzung'));
    rahmen(kasten(e));
    expect(screen.getByText(/immer die letzte Sitzung/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ändern' }));
    const fenster = screen.getByRole('dialog', { name: 'Anderes Protokoll wählen' });
    fireEvent.click(within(fenster).getByRole('button', { name: /09\.09\.2026/ }));
    fireEvent.click(within(fenster).getByRole('button', { name: 'Übernehmen' }));
    expect(bild(e)).toEqual([
      ['heading', 'Protokoll vom 09.09.2026'],
      ['verweis', 'sept'],
    ]);
  });

  it('ein eigener Titel bleibt stehen', () => {
    const e = editorMit(dok('Rückblick Sommer'));
    rahmen(kasten(e));
    fireEvent.click(screen.getByRole('button', { name: 'Ändern' }));
    const fenster = screen.getByRole('dialog', { name: 'Anderes Protokoll wählen' });
    fireEvent.click(within(fenster).getByRole('button', { name: /09\.09\.2026/ }));
    fireEvent.click(within(fenster).getByRole('button', { name: 'Übernehmen' }));
    expect(bild(e)).toEqual([
      ['heading', 'Rückblick Sommer'],
      ['verweis', 'sept'],
    ]);
  });

  it('kein Ändern, wo man nicht schreibt (gesperrter Editor, Lese-Ansicht)', () => {
    const e = editorMit(dok('Protokoll der letzten Sitzung'));
    e.isEditable = false;
    const { unmount } = rahmen(kasten(e));
    expect(screen.queryByRole('button', { name: 'Ändern' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ansehen' })).toBeTruthy();
    unmount();
    rahmen(<ProtokollAnsicht dokument={dok('Protokoll der letzten Sitzung')} />);
    expect(screen.queryByRole('button', { name: 'Ändern' })).toBeNull();
    expect(screen.queryByText(/immer die letzte Sitzung/)).toBeNull();
  });

  it('Ansehen zeigt es im Fenster, „Öffnen“ springt zur Sitzung', () => {
    const zu = vi.fn();
    rahmen(<ProtokollAnsicht dokument={dok('Protokoll der letzten Sitzung')} />, {
      onZuSitzung: zu,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ansehen' }));
    const fenster = screen.getByRole('dialog', { name: 'Leitungssitzung · 14.10.2026' });
    expect(within(fenster).getByText('Finanzen')).toBeTruthy();
    fireEvent.click(within(fenster).getByRole('button', { name: 'Öffnen' }));
    expect(zu).toHaveBeenCalledWith(OKT);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ohne Sprungziel kein „Öffnen“ im Fenster', () => {
    rahmen(<ProtokollAnsicht dokument={dok('Protokoll der letzten Sitzung')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ansehen' }));
    expect(screen.queryByRole('button', { name: 'Öffnen' })).toBeNull();
  });
});

describe('„/“-Menü (K3b-2)', () => {
  it('„Früheres Protokoll“ fragt wie die Leiste, welches', async () => {
    const { festeImMenue } = await import('./festeImMenue');
    const e = editorMit([{ id: 'p', type: 'paragraph', content: t('') }]);
    e.setTextCursorPosition('p', 'start');
    const waehlen = vi.fn();
    const w = {
      sitzung: 'heute',
      gruppe: 194,
      heute: '2026-10-28',
      zeitzone: 'Europe/Berlin',
      aufgaben: [],
      protokolle: [OKT, SEPT],
      letztes: OKT,
      fruehere: [OKT, SEPT],
      waehlen,
      treffen: null,
      anfragen: [],
    };
    const items = festeImMenue(e, w);
    expect(items.map((i) => i.title)).toEqual([
      'Offene To-Dos',
      'Anwesenheit',
      'Früheres Protokoll',
    ]);
    items[2].onItemClick();
    expect(waehlen).toHaveBeenCalledWith(
      expect.objectContaining({ titel: 'Früheres Protokoll einfügen', vorgewaehlt: 'okt' }),
      expect.any(Function),
    );
    expect(e.document.map((b) => b.type)).toEqual(['paragraph']);
  });
});
