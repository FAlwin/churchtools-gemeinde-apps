// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

/**
 * Der Speichern-Knopf des Editors – gegen die **echte** Komponente, nicht gegen eine Attrappe.
 *
 * Gefunden am 04.09.2026 im Browser: Mit `mitVersionsname={false}` (Original-Notenblatt) blieb
 * „Speichern" dauerhaft grau, weil `canSave` den Versionsnamen verlangte, den es gar nicht abfragt.
 * 1034 Tests waren grün – `NewSongSheet.test` und `EditSongSheet.test` mocken den Editor. Deshalb hier
 * die Regel selbst: Der Name sperrt nur, wenn er auch gefragt wird; leerer Text sperrt immer.
 */
// Die Eingabe ist eine Attrappe; ihre Befehle (Einfügen …) landen hier, damit die Bausteine prüfbar sind.
const eingabe = vi.hoisted(() => ({
  insert: vi.fn(),
  einfuegenAn: vi.fn(),
  springeZu: vi.fn(),
  appendChord: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
}));
vi.mock('./ChordProInput', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  return {
    ChordProInput: forwardRef(function Attrappe(_p, ref) {
      useImperativeHandle(ref, () => eingabe);
      return <div data-testid="eingabe" />;
    }),
  };
});
const vorschau = vi.hoisted(() => ({ props: [] as { rolle?: boolean }[] }));
vi.mock('./PdfPreview', () => ({
  PdfPreview: (p: { rolle?: boolean }) => {
    vorschau.props.push(p);
    return null;
  },
}));
vi.mock('@ui/fenster/useOverlayKeyboardInset', () => ({
  useOverlayKeyboardInset: () => undefined,
}));

const { ChordEditor } = await import('./ChordEditor');

function zeige(props: Partial<Parameters<typeof ChordEditor>[0]> = {}) {
  const onSave = vi.fn();
  render(
    <ChordEditor
      songTitle="Treu"
      initialText={'{title: Treu}\n[D]Zeile'}
      initialName=""
      isNew
      saving={false}
      error={null}
      onSave={onSave}
      onClose={vi.fn()}
      {...props}
    />,
  );
  return {
    onSave,
    speichern: () => screen.getByRole<HTMLButtonElement>('button', { name: 'Speichern' }),
  };
}

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

describe('ChordEditor – Speichern ohne Versionsname-Feld (04.09.2026)', () => {
  it('ohne das Feld sperrt der fehlende Name nicht – Speichern liefert Text und leeren Namen', () => {
    const { onSave, speichern } = zeige({ mitVersionsname: false });
    expect(screen.queryByLabelText('Versionsname')).toBeNull();
    expect(speichern().disabled).toBe(false);
    fireEvent.click(speichern());
    expect(onSave).toHaveBeenCalledWith('{title: Treu}\n[D]Zeile', '');
  });

  it('mit dem Feld bleibt die Regel: ohne Namen kein Speichern', () => {
    const { speichern } = zeige();
    expect(screen.getByLabelText('Versionsname')).not.toBeNull();
    expect(speichern().disabled).toBe(true);
  });

  it('leerer Text sperrt immer – auch ohne das Feld', () => {
    const { speichern } = zeige({ mitVersionsname: false, initialText: '   ' });
    expect(speichern().disabled).toBe(true);
  });
});

/**
 * #398: Der Editor sagt an, in welcher Tonart der Text steht – und mit Kapo auch, wie gegriffen
 * wird. Ohne die Zeile rätselt man, warum das Blatt andere Akkorde zeigt als der Editor.
 */
describe('ChordEditor – Tonart-Zeile (#398)', () => {
  it('nennt die Tonart des Texts', () => {
    zeige({ tonart: 'D' });
    expect(screen.getByText('D', { selector: 'strong' })).toBeTruthy();
    expect(screen.queryByText(/gegriffen als/)).toBeNull();
  });

  it('nennt mit Kapo auch die gegriffene Tonart', () => {
    zeige({ tonart: 'D', kapo: 2 });
    expect(screen.getByText(/mit Kapo 2 gegriffen als/)).toBeTruthy();
    expect(screen.getByText('C', { selector: 'strong' })).toBeTruthy();
  });

  it('zeigt ohne Tonart keine Zeile – beim Original-Notenblatt gibt es sie nicht', () => {
    zeige();
    expect(screen.queryByText(/^Tonart/)).toBeNull();
  });
});

/** Flow-Zeile und Weiterschalt-Punkt (#606). */
describe('ChordEditor – Ablauf und Weiterschalt-Punkt', () => {
  beforeEach(() => vi.clearAllMocks());

  function format(name: string) {
    fireEvent.click(screen.getByRole('button', { name: /Format/ }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }));
  }

  it('„Ablauf" setzt die vorbefüllte Flow-Zeile vor den ersten Teil, Cursor vor die Klammer', () => {
    const text = '{title: Treu}\n{comment: Vers}\nA\n{comment: Chorus}\nB';
    zeige({ initialText: text, mitVersionsname: false });
    format('Ablauf');
    const zeile = '{flow: Vers, Chorus}';
    expect(eingabe.einfuegenAn).toHaveBeenCalledWith(14, `${zeile}\n`, zeile.length - 1);
  });

  it('gibt es schon eine Flow-Zeile, springt „Ablauf" dorthin statt eine zweite einzufügen', () => {
    zeige({ initialText: '{title: T}\n{flow: Vers}\n{comment: Vers}\nA', mitVersionsname: false });
    format('Ablauf');
    expect(eingabe.springeZu).toHaveBeenCalledWith(11);
    expect(eingabe.einfuegenAn).not.toHaveBeenCalled();
  });

  it('„Weiterschalt-Punkt" fügt ---- in einer eigenen Zeile ein', () => {
    zeige({ mitVersionsname: false });
    format('Weiterschalt-Punkt');
    expect(eingabe.insert).toHaveBeenCalledWith('----', { block: true });
  });

  it('nennt Namen im Flow, zu denen es keinen Teil gibt', () => {
    zeige({
      initialText: '{flow: Vers, Refrain}\n{comment: Vers}\nA',
      mitVersionsname: false,
    });
    expect(screen.getByRole('status').textContent).toContain('Refrain');
  });

  it('ohne unbekannte Namen kein Hinweis', () => {
    zeige({ initialText: '{flow: Vers}\n{comment: Vers}\nA', mitVersionsname: false });
    expect(screen.queryByRole('status')).toBeNull();
  });
});

/** Die Vorschau folgt der Liedansicht dieses Geräts (#607, Rückmeldung b). */
describe('ChordEditor – Vorschau im Scroll-Modus', () => {
  beforeEach(() => {
    vorschau.props.length = 0;
    localStorage.removeItem('worship:liedansicht');
  });

  it('beim Blättern: A4', () => {
    zeige({ mitVersionsname: false });
    expect(vorschau.props.at(-1)?.rolle).toBe(false);
  });

  it('beim Scrollen: die lange Seite', () => {
    localStorage.setItem('worship:liedansicht', 'scrollen');
    zeige({ mitVersionsname: false });
    expect(vorschau.props.at(-1)?.rolle).toBe(true);
  });
});

/** Aufbau seit L1 (neuer Lied-Editor, 22.10.2026): breit Text und Vorschau nebeneinander, schmal umschaltbar. */
describe('ChordEditor – Aufbau (L1)', () => {
  function breite(breit: boolean) {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: breit,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  }

  it('breit: Text- und Vorschau-Karte nebeneinander, kein Umschalter', () => {
    breite(true);
    zeige();
    expect(screen.getByRole('region', { name: 'Text' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Vorschau' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Ansicht' })).toBeNull();
  });

  it('schmal: „Text | Vorschau“ – die Text-Karte bleibt beim Wechsel erhalten (Verlauf, Cursor)', () => {
    breite(false);
    zeige();
    const umschalter = screen.getByRole('group', { name: 'Ansicht' });
    expect(screen.queryByRole('region', { name: 'Vorschau' })).toBeNull();
    fireEvent.click(within(umschalter).getByRole('button', { name: 'Vorschau' }));
    expect(screen.getByRole('region', { name: 'Vorschau' })).toBeTruthy();
    // Ausgeblendet, aber noch da – sonst wären Rückgängig-Verlauf und Cursor weg.
    expect(screen.getByTestId('eingabe')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Text', hidden: true }).className).toMatch(
      /paneHidden/,
    );
    fireEvent.click(within(umschalter).getByRole('button', { name: 'Text' }));
    expect(screen.queryByRole('region', { name: 'Vorschau' })).toBeNull();
  });

  it('Rückgängig und Wiederholen stehen in der Text-Karte, nicht im Kopf', () => {
    breite(true);
    zeige();
    const text = screen.getByRole('region', { name: 'Text' });
    expect(within(text).getByRole('button', { name: 'Rückgängig' })).toBeTruthy();
    expect(within(text).getByRole('button', { name: 'Wiederholen' })).toBeTruthy();
    expect(
      within(screen.getByRole('banner')).queryByRole('button', { name: 'Rückgängig' }),
    ).toBeNull();
  });
});
