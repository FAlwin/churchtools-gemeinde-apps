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
  aendern: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  markieren: vi.fn(),
  stelle: vi.fn(() => null),
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
const { flowSetzen } = await import('../utils/chordpro');

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

  // Seit L2 (22.10.2026) setzt die Ablauf-Karte die Flow-Zeile – erwartet wird genau die Änderung, die
  // `flowSetzen` dafür liefert (der Erzeuger, nicht ein abgeschriebenes Literal).
  function aenderungFuer(text: string, eintraege: string[]) {
    const a = flowSetzen(text, eintraege)!;
    return [a.from, a.to, a.insert];
  }

  /** Breit ist die Karte eingeklappt (Alwin, 22.10.2026) – zum Bearbeiten aufklappen. */
  function ablaufOeffnen() {
    const ablauf = screen.getByRole('region', { name: 'Ablauf' });
    fireEvent.click(within(ablauf).getByRole('button', { name: 'Bearbeiten' }));
    return ablauf;
  }

  it('breit eingeklappt: „Wie im Text“ ohne eigene Reihenfolge, keine Kärtchen', () => {
    zeige({ initialText: '{comment: Vers}\nA\n{comment: Chorus}\nB', mitVersionsname: false });
    const ablauf = screen.getByRole('region', { name: 'Ablauf' });
    expect(within(ablauf).getByText('Wie im Text')).toBeTruthy();
    expect(within(ablauf).queryByText('Eigener Ablauf')).toBeNull();
    expect(within(ablauf).queryAllByRole('listitem')).toHaveLength(0);
  });

  it('breit eingeklappt: eigener Ablauf ist markiert, mit Kurzform und fehlenden Teilen', () => {
    zeige({
      initialText: '{flow: Chorus, Vers, Refrain}\n{comment: Vers}\nA\n{comment: Chorus}\nB',
      mitVersionsname: false,
    });
    const ablauf = screen.getByRole('region', { name: 'Ablauf' });
    expect(within(ablauf).getByText('Eigener Ablauf')).toBeTruthy();
    expect(within(ablauf).getByText('Chorus · Vers · Refrain')).toBeTruthy();
    expect(within(ablauf).getByText('1 Teil fehlt im Text')).toBeTruthy();
  });

  it('„Fertig“ klappt wieder ein', () => {
    zeige({ initialText: '{comment: Vers}\nA', mitVersionsname: false });
    const ablauf = ablaufOeffnen();
    expect(within(ablauf).getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(within(ablauf).getByRole('button', { name: 'Fertig' }));
    expect(within(ablauf).queryAllByRole('listitem')).toHaveLength(0);
    expect(within(ablauf).getByRole('button', { name: 'Bearbeiten' })).toBeTruthy();
  });

  it('„+ Chorus“ ohne Flow-Zeile: legt sie an – mit den Teilen wie im Text und Chorus dahinter', () => {
    const text = '{title: Treu}\n{comment: Vers}\nA\n{comment: Chorus}\nB';
    zeige({ initialText: text, mitVersionsname: false });
    const ablauf = ablaufOeffnen();
    fireEvent.click(within(ablauf).getByRole('button', { name: 'Chorus' }));
    expect(eingabe.aendern).toHaveBeenCalledWith(
      ...aenderungFuer(text, ['Vers', 'Chorus', 'Chorus']),
    );
  });

  it('× nimmt einen Eintrag heraus, „Wie im Text“ die ganze Zeile', () => {
    const text = '{flow: Chorus, Vers}\n{comment: Vers}\nA\n{comment: Chorus}\nB';
    zeige({ initialText: text, mitVersionsname: false });
    const ablauf = ablaufOeffnen();
    fireEvent.click(within(ablauf).getByRole('button', { name: 'Chorus aus dem Ablauf nehmen' }));
    expect(eingabe.aendern).toHaveBeenLastCalledWith(...aenderungFuer(text, ['Vers']));
    fireEvent.click(within(ablauf).getByRole('button', { name: 'Wie im Text' }));
    expect(eingabe.aendern).toHaveBeenLastCalledWith(...aenderungFuer(text, []));
  });

  it('ohne Flow-Zeile kein „Wie im Text“ – es ist ja schon so', () => {
    zeige({ initialText: '{comment: Vers}\nA', mitVersionsname: false });
    const ablauf = ablaufOeffnen();
    expect(within(ablauf).queryByRole('button', { name: 'Wie im Text' })).toBeNull();
  });

  it('das Format-Menü bietet keinen Ablauf mehr an – dafür ist die Karte da', () => {
    zeige({ mitVersionsname: false });
    fireEvent.click(screen.getByRole('button', { name: /Format/ }));
    expect(screen.queryByRole('button', { name: /Reihenfolge der Teile/ })).toBeNull();
  });

  it('„Weiterschalt-Punkt" fügt ---- in einer eigenen Zeile ein', () => {
    zeige({ mitVersionsname: false });
    format('Weiterschalt-Punkt');
    expect(eingabe.insert).toHaveBeenCalledWith('----', { block: true });
  });

  it('nennt Namen im Ablauf, zu denen es keinen Teil gibt – am Kärtchen', () => {
    zeige({
      initialText: '{flow: Vers, Refrain}\n{comment: Vers}\nA',
      mitVersionsname: false,
    });
    const ablauf = ablaufOeffnen();
    expect(within(ablauf).getAllByText('fehlt im Text')).toHaveLength(1);
    expect(within(ablauf).getByText('Refrain').closest('li')?.textContent).toContain(
      'fehlt im Text',
    );
  });
});

/** Akkorde einfügen (Lied-Editor L5, 22.10.2026): Leiste und „Anderer Akkord“ setzen `[…]` an den Cursor. */
describe('ChordEditor – Akkorde einfügen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Akkord der Tonart antippen fügt ihn ein – Tonart aus der Angabe des Aufrufers', () => {
    zeige({ tonart: 'G', mitVersionsname: false });
    fireEvent.click(screen.getByRole('button', { name: 'Em' }));
    expect(eingabe.insert).toHaveBeenCalledWith('[Em]');
  });

  it('ohne Angabe gilt die Tonart aus {key}', () => {
    zeige({ initialText: '{key: F}\n[F]Zeile', mitVersionsname: false });
    expect(screen.getByText('Tonart F')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Bb' }));
    expect(eingabe.insert).toHaveBeenCalledWith('[Bb]');
  });

  it('„Anderer Akkord“: eintippen, einfügen – das Fenster schließt, der Akkord steht in „Im Lied“', () => {
    zeige({ tonart: 'E', mitVersionsname: false });
    fireEvent.click(screen.getByRole('button', { name: 'Anderer Akkord' }));
    fireEvent.change(screen.getByPlaceholderText(/Em7/), { target: { value: 'gsus4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einfügen' }));
    expect(eingabe.insert).toHaveBeenCalledWith('[Gsus4]');
    expect(screen.queryByPlaceholderText(/Em7/)).toBeNull();
    expect(screen.getByText('Im Lied').parentElement!.textContent).toContain('Gsus4');
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

/** Speichern mit Liedinfo (L4-3): scheitert ChurchTools, wird GAR NICHTS gespeichert. */
describe('ChordEditor – Speichern mit Liedinfo', () => {
  const quelle = {
    lied: { songId: 1, name: 'Treu', author: null, ccli: null, copyright: null, categoryId: 1 },
    arrangement: {
      id: 1,
      name: 'Standard',
      isDefault: true,
      key: 'E',
      tempo: null,
      beat: null,
      duration: null,
      description: null,
      source: null,
      sourceReference: null,
      dateien: 1,
    },
    darf: true,
  };
  const TEXT = '{title: Treu}\n{artist: Gerster}\n[D]Zeile';

  it('ChurchTools antwortet nicht: kein onSave, Meldung, Text unverändert im Editor', async () => {
    const speichern = vi.fn(() => Promise.reject(new Error('Zeitüberschreitung')));
    const { onSave, speichern: knopf } = zeige({
      initialText: TEXT,
      mitVersionsname: false,
      liedinfo: { ...quelle, speichern },
    });
    fireEvent.click(knopf());
    expect(
      await screen.findByText(/Die Liedinfo wurde nicht gespeichert.*Zeitüberschreitung/),
    ).toBeTruthy();
    expect(speichern).toHaveBeenCalledWith({ lied: { author: 'Gerster' }, arrangement: null });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('ChurchTools übernimmt: onSave bekommt den Text ohne die Zeilen, die ChurchTools jetzt hat', async () => {
    const speichern = vi.fn(() =>
      Promise.resolve({
        lied: { ...quelle.lied, author: 'Gerster' },
        arrangement: quelle.arrangement,
      }),
    );
    const { onSave, speichern: knopf } = zeige({
      initialText: TEXT,
      mitVersionsname: false,
      liedinfo: { ...quelle, speichern },
    });
    fireEvent.click(knopf());
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledWith('[D]Zeile', ''));
  });
});
