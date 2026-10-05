// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { AgendaItem, SongLibraryEntry, SongSelectTreffer } from '@shared/types/index';

/**
 * „Eintrag bearbeiten" – geprüft wird der **Anlege-Weg aus „Lied verknüpfen"** (#391, 18.09.2026):
 *
 *  - „Neues Lied" und SongSelect gibt es dort nur **mit dem Recht, Lieder zu bearbeiten** – dieselbe
 *    Regel beim Bearbeiten wie beim Anlegen; ein Treffer, aus dem nichts werden kann, wäre eine Sackgasse.
 *  - Das Blatt öffnet **ohne `eventId`**: Das Lied gehört in den vorhandenen Punkt, nicht als neuer in
 *    den Ablauf.
 *  - Nach dem Anlegen ist das Lied nur **vorgemerkt** („Wird beim Speichern verknüpft.") – geschrieben
 *    wird erst mit „Speichern", und zwar als `arrangementId` des neuen Liedes (Entscheidung Alwin:
 *    ein Fenster, ein Speicherweg).
 *  - Ein Abbruch im Blatt merkt **nichts** vor.
 *
 * `SongPicker` und `NewSongSheet` sind Attrappen: Ihre eigenen Regeln stehen in `SongPicker.test.tsx`
 * und `NewSongSheet.test.tsx`; hier zählt die **Verdrahtung** zwischen den dreien.
 */
const caps = vi.fn();
vi.mock('../hooks/useServices', () => ({
  useCapabilities: () => caps(),
}));
vi.mock('../hooks/useOverlayKeyboardInset', () => ({ useOverlayKeyboardInset: () => undefined }));

const TREFFER: SongSelectTreffer = {
  songNumber: 5841527,
  title: 'Treu',
  authors: ['Autor A'],
  defaultKey: 'E',
  isPublicDomain: false,
  hasLyrics: true,
  hasChordPro: true,
  hasChordSheet: true,
};

vi.mock('./SongPicker', () => ({
  SongPicker: (p: {
    onPick?: (arrangementId: number, songName: string) => void;
    neuesLied?: { label: string; onClick: (name: string) => void };
    onSongSelectTreffer?: (treffer: SongSelectTreffer) => void;
  }) => (
    <div data-testid="songpicker">
      <button onClick={() => p.onPick?.(30, 'Treu')}>Treffer wählen</button>
      {p.neuesLied && (
        <button onClick={() => p.neuesLied?.onClick('Wo ich auch stehe')}>
          {p.neuesLied.label}
        </button>
      )}
      {p.onSongSelectTreffer && (
        <button onClick={() => p.onSongSelectTreffer?.(TREFFER)}>SongSelect-Treffer</button>
      )}
    </div>
  ),
}));

const SCHON_DA: SongLibraryEntry = {
  songId: 88,
  name: 'Schon da',
  author: null,
  ccli: '5841527',
  key: 'D',
  arrangementId: 880,
};

vi.mock('./NewSongSheet', () => ({
  NewSongSheet: (p: {
    eventId?: number;
    startName?: string;
    startTreffer?: SongSelectTreffer;
    onVerknuepfen?: (arrangementId: number, name: string) => void;
    onVorhandenes?: (song: SongLibraryEntry) => void;
    onClose: () => void;
  }) => (
    <div data-testid="newsong">
      <div data-testid="newsong-eventId">{String(p.eventId)}</div>
      <div data-testid="newsong-startName">{p.startName ?? ''}</div>
      <div data-testid="newsong-treffer">{p.startTreffer?.title ?? ''}</div>
      <button onClick={() => p.onVerknuepfen?.(770, 'Neu angelegt')}>Blatt: verknüpfen</button>
      <button onClick={() => p.onVorhandenes?.(SCHON_DA)}>Blatt: vorhandenes</button>
      <button onClick={p.onClose}>Blatt: abbrechen</button>
    </div>
  ),
}));

const { ItemActionSheet } = await import('./ItemActionSheet');

const ITEM: AgendaItem = {
  id: 5,
  title: 'Lied',
  type: 'normal',
  isHeader: false,
  responsible: [],
  responsibleText: '',
  song: null,
  time: '10:05',
  vorBeginn: false,
  durationMin: 5,
  note: '',
};

/** Die Angaben im Bearbeiten-Modus (der Dialog kennt seit 05.10.2026 auch „neu"). */
type BearbeitenProps = Extract<Parameters<typeof ItemActionSheet>[0], { item: AgendaItem }>;

function zeige(overrides: Partial<BearbeitenProps> = {}) {
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  render(
    <ItemActionSheet
      item={ITEM}
      onClose={vi.fn()}
      onUpdate={onUpdate}
      vorBeginn={false}
      onSetVorBeginn={vi.fn().mockResolvedValue(undefined)}
      services={[]}
      onRequestDelete={vi.fn()}
      {...overrides}
    />,
  );
  return { onUpdate };
}

const verknuepfenOeffnen = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Lied verknüpfen' }));

beforeEach(() => {
  vi.clearAllMocks();
  caps.mockReturnValue({ data: { canEditSongs: true } });
});

describe('ItemActionSheet – „Neues Lied" beim Verknüpfen (#391)', () => {
  it('mit dem Recht stehen „Neues Lied" und der SongSelect-Weg in der Suche', () => {
    zeige();
    verknuepfenOeffnen();
    expect(screen.getByRole('button', { name: 'Neues Lied' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'SongSelect-Treffer' })).toBeTruthy();
  });

  it('ohne das Recht fehlen beide – die Suche selbst bleibt', () => {
    caps.mockReturnValue({ data: { canEditSongs: false } });
    zeige();
    verknuepfenOeffnen();
    expect(screen.getByTestId('songpicker')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Neues Lied' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'SongSelect-Treffer' })).toBeNull();
  });

  it('„Neues Lied" öffnet das Blatt mit dem Suchbegriff als Titel – und OHNE eventId', () => {
    zeige();
    verknuepfenOeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Neues Lied' }));
    expect(screen.getByTestId('newsong-startName').textContent).toBe('Wo ich auch stehe');
    // Kein neuer Ablaufpunkt: Das Lied gehört in DIESEN Punkt.
    expect(screen.getByTestId('newsong-eventId').textContent).toBe('undefined');
  });

  it('ein SongSelect-Treffer öffnet das Blatt vorbelegt', () => {
    zeige();
    verknuepfenOeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'SongSelect-Treffer' }));
    expect(screen.getByTestId('newsong-treffer').textContent).toBe('Treu');
    expect(screen.getByTestId('newsong-eventId').textContent).toBe('undefined');
  });

  it('nach dem Anlegen ist das Lied nur vorgemerkt – geschrieben wird erst mit „Speichern"', async () => {
    const { onUpdate } = zeige();
    verknuepfenOeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Neues Lied' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blatt: verknüpfen' }));

    // Zurück in „Eintrag bearbeiten": Name sichtbar, Hinweis da, noch nichts geschrieben.
    expect(screen.queryByTestId('newsong')).toBeNull();
    expect(screen.queryByTestId('songpicker')).toBeNull();
    expect(screen.getByText('Neu angelegt')).toBeTruthy();
    expect(screen.getByText('Wird beim Speichern verknüpft.')).toBeTruthy();
    expect(onUpdate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(onUpdate.mock.calls[0][0]).toMatchObject({ arrangementId: 770 });
  });

  it('ein Abbruch im Blatt merkt nichts vor und führt zurück in die Suche', () => {
    zeige();
    verknuepfenOeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Neues Lied' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blatt: abbrechen' }));
    expect(screen.getByTestId('songpicker')).toBeTruthy();
    // Zurück zum Dialog: keine Vormerkung, Speichern bleibt gesperrt (nichts geändert).
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByText('Wird beim Speichern verknüpft.')).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Speichern' }).disabled).toBe(
      true,
    );
  });

  it('die gewohnte Auswahl aus der Suche merkt genauso vor – ein Weg für beide', () => {
    zeige();
    verknuepfenOeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Treffer wählen' }));
    expect(screen.getByText('Treu')).toBeTruthy();
    expect(screen.getByText('Wird beim Speichern verknüpft.')).toBeTruthy();
  });
});

/**
 * Gibt es das Lied schon (gleiche CCLI-Nummer), fragt `NewSongSheet` (#395) – hier zählt nur, dass der
 * Dialog „verwenden" **genauso** landet wie eine Auswahl aus der Suche: vorgemerkt, nicht geschrieben.
 */
describe('ItemActionSheet – ein vorhandenes Lied statt eines zweiten (#395)', () => {
  it('merkt das vorhandene Lied vor – geschrieben wird erst mit „Speichern"', async () => {
    const { onUpdate } = zeige();
    verknuepfenOeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Neues Lied' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blatt: vorhandenes' }));

    expect(screen.queryByTestId('newsong')).toBeNull();
    expect(screen.getByText('Schon da')).toBeTruthy();
    expect(screen.getByText('Wird beim Speichern verknüpft.')).toBeTruthy();
    expect(onUpdate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(onUpdate.mock.calls[0][0]).toMatchObject({ arrangementId: 880 });
  });
});

/**
 * #423: Der Schalter „Uhrzeit ausblenden" war falsch beschriftet (das CT-Auge nimmt den Punkt aus der
 * Zeitrechnung) und ist weg. An seiner Stelle legt „Vor Gottesdienstbeginn" den Vorlauf fest.
 */
describe('ItemActionSheet – Vor Gottesdienstbeginn (#423)', () => {
  const schalter = () => screen.getByRole('button', { name: /Vor Gottesdienstbeginn/ });

  it('der alte Schalter „Uhrzeit ausblenden" ist weg', () => {
    zeige();
    expect(screen.queryByText('Uhrzeit ausblenden')).toBeNull();
  });

  it('einschalten + Speichern schreibt den Vorlauf – und sonst nichts', async () => {
    const onSetVorBeginn = vi.fn().mockResolvedValue(undefined);
    const { onUpdate } = zeige({ onSetVorBeginn });
    fireEvent.click(schalter());
    expect(schalter().getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(onSetVorBeginn).toHaveBeenCalledWith(true));
    expect(onUpdate).not.toHaveBeenCalled(); // kein Feld geändert → kein Feld-PUT
  });

  it('ausschalten bei einem Vorlauf-Punkt schreibt false', async () => {
    const onSetVorBeginn = vi.fn().mockResolvedValue(undefined);
    zeige({ vorBeginn: true, onSetVorBeginn });
    expect(schalter().getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(schalter());
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(onSetVorBeginn).toHaveBeenCalledWith(false));
  });

  it('nur umgeschaltet und zurück: nichts vorgemerkt, Speichern bleibt aus', () => {
    zeige();
    fireEvent.click(schalter());
    fireEvent.click(schalter());
    expect(screen.getByRole('button', { name: 'Speichern' }).hasAttribute('disabled')).toBe(true);
  });

  it('auch Überschriften haben den Schalter', () => {
    zeige({ item: { ...ITEM, isHeader: true, title: 'Vorbereitung' } });
    expect(schalter()).toBeTruthy();
  });
});

/**
 * „Neuer Eintrag" ist derselbe Dialog wie Bearbeiten (Alwin, 05.10.2026: das Hinzufügen war „nicht
 * konsistent mit allen anderen Einstellungen nachher"). Vorher: eigenes Blatt mit Typ-Auswahl und
 * drei Formularen, nach einem Lied zusätzlich der Bearbeiten-Dialog.
 */
describe('ItemActionSheet – Neuer Eintrag', () => {
  function zeigeNeu() {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<ItemActionSheet modus="neu" services={[]} onAdd={onAdd} onClose={onClose} />);
    return { onAdd, onClose };
  }
  const hinzufuegen = () => screen.getByRole('button', { name: 'Hinzufügen' });

  it('öffnet mit „Lied" und gleich der Liedsuche – so schnell wie vorher', () => {
    zeigeNeu();
    expect(screen.getByText('Lied auswählen')).toBeTruthy();
    expect(screen.getByTestId('songpicker')).toBeTruthy();
  });

  it('Lied wählen, Dauer setzen, Hinzufügen: EIN Punkt mit allem – Titel = Liedname', async () => {
    const { onAdd, onClose } = zeigeNeu();
    fireEvent.click(screen.getByRole('button', { name: 'Treffer wählen' }));
    expect(screen.getByText('Neuer Eintrag')).toBeTruthy();
    // Sichtbar: Der Titel ist mit dem Liednamen gefüllt – man sieht, wie der Punkt heißen wird.
    expect(screen.getByPlaceholderText('z. B. Lied')).toHaveProperty('value', 'Treu');
    fireEvent.change(screen.getByPlaceholderText('z. B. 5'), { target: { value: '4' } });
    fireEvent.click(hinzufuegen());
    await waitFor(() =>
      expect(onAdd).toHaveBeenCalledWith({
        type: 'song',
        title: 'Treu',
        arrangementId: 30,
        durationMin: 4,
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('ein neu angelegtes Lied wird nur vorgemerkt – angelegt wird der Punkt erst mit „Hinzufügen"', async () => {
    const { onAdd } = zeigeNeu();
    fireEvent.click(screen.getByRole('button', { name: 'Neues Lied' }));
    // OHNE eventId: Sonst trüge der Server das Lied schon selbst in den Ablauf ein – doppelt.
    expect(screen.getByTestId('newsong-eventId').textContent).toBe('undefined');
    fireEvent.click(screen.getByRole('button', { name: 'Blatt: verknüpfen' }));
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.click(hinzufuegen());
    await waitFor(() =>
      expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ arrangementId: 770 })),
    );
  });

  it('ohne Lied lässt sich ein Lied-Eintrag nicht anlegen', () => {
    zeigeNeu();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' })); // Suche zu, zurück zum Formular
    expect(hinzufuegen().hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Lied auswählen' })).toBeTruthy();
  });

  it('Überschrift: nur der Titel – keine Dauer, kein Lied, kein Vorlauf, kein Löschen', async () => {
    const { onAdd } = zeigeNeu();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Überschrift' }));
    expect(screen.queryByPlaceholderText('z. B. 5')).toBeNull();
    expect(screen.queryByRole('button', { name: /Vor Gottesdienstbeginn/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Eintrag löschen/ })).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('Titel der Überschrift'), {
      target: { value: 'Lobpreis' },
    });
    fireEvent.click(hinzufuegen());
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith({ type: 'header', title: 'Lobpreis' }));
  });

  it('Text: kein Liedfeld; ein Fehler bleibt im Dialog stehen, statt ihn zu schließen', async () => {
    const { onAdd, onClose } = zeigeNeu();
    onAdd.mockRejectedValueOnce(new Error('ChurchTools antwortet nicht.'));
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Text' }));
    expect(screen.queryByRole('button', { name: /Lied/ })).toBeTruthy(); // nur der Umschalter
    expect(screen.queryByRole('button', { name: 'Lied auswählen' })).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('Titel'), { target: { value: 'Begrüßung' } });
    fireEvent.click(hinzufuegen());
    expect(await screen.findByText('ChurchTools antwortet nicht.')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});
