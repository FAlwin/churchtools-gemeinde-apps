// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ArrangementFileEntry, SetlistSong } from '@shared/types/index';
import type { useArrangementDateien } from '../hooks/useArrangementDateien';
import type { NamenQuelle } from '../utils/annotationLevelLabel';
import type { ChartFenster } from '../hooks/useChartOverlay';
import { DateiFenster } from './DateiFenster';

/**
 * `DateiFenster` (#845, 4e) – was die Fenster rund um die Dateien eines Arrangements mit dem Blatt verbinden. Die
 * Fenster selbst prüfen `ArrangementFilesSheet.test.tsx` und `DateiUmbenennenFenster.test.tsx`, das Hochladen und
 * Löschen `useArrangementDateien.test.tsx`.
 */
const PDF: ArrangementFileEntry = {
  fileId: 3,
  name: 'Treu - E.pdf',
  label: 'Treu - E.pdf',
  size: 1024,
  kind: 'pdf',
};
const song = {
  id: 5,
  arrangementId: 1,
  title: 'Treu',
  arrangementName: 'Standard',
  ccli: '7001',
} as SetlistSong;
const ebenenNamen = {
  arrangementName: () => 'Standard',
  versionName: (k: string) => k,
} as unknown as NamenQuelle;

function zeigen(
  over: Partial<ReturnType<typeof useArrangementDateien>> = {},
  { overlay = 'files', canUseCcli = true }: { overlay?: ChartFenster; canUseCcli?: boolean } = {},
) {
  const datei = {
    dateien: { data: [PDF], isPending: false, fetchStatus: 'idle', error: null },
    laedtHoch: false,
    holtChordPro: false,
    loeschDatei: null,
    umbenennDatei: null,
    uploadWarnung: null,
    benennt: false,
    umbenennFehler: null,
    herunterladen: vi.fn(),
    dateiGewaehlt: vi.fn(),
    setLoeschDatei: vi.fn(),
    setUmbenennDatei: vi.fn(),
    setUploadWarnung: vi.fn(),
    chordProHolen: vi.fn(),
    loeschenBestaetigen: vi.fn(),
    warnungBestaetigen: vi.fn(),
    umbenennen: vi.fn(),
    ...over,
  } as unknown as ReturnType<typeof useArrangementDateien>;
  const setOverlay = vi.fn();
  render(
    <DateiFenster
      song={song}
      datei={datei}
      overlay={overlay}
      setOverlay={setOverlay}
      ebenenNamen={ebenenNamen}
      canUseCcli={canUseCcli}
    />,
  );
  return { datei, setOverlay };
}

describe('DateiFenster', () => {
  it('nur offen, wenn das Fenster „Dateien“ gewählt ist; „‹“ führt ins Menü, X schließt', () => {
    const zu = zeigen({}, { overlay: null });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(zu.setOverlay).not.toHaveBeenCalled();
    document.body.innerHTML = '';
    const { setOverlay } = zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(setOverlay).toHaveBeenLastCalledWith('menu');
    fireEvent.click(screen.getByRole('button', { name: 'Fenster schließen' }));
    expect(setOverlay).toHaveBeenLastCalledWith(null);
  });

  it('SongSelect nur mit dem Recht der Gemeinde; erst die Rückfrage, dann geholt mit der CCLI-Nummer', () => {
    zeigen({}, { canUseCcli: false });
    expect(screen.queryByText(/aus SongSelect holen/)).toBeNull();
    document.body.innerHTML = '';
    const { datei } = zeigen();
    fireEvent.click(screen.getByText('Notenblatt aus SongSelect holen …'));
    expect(datei.chordProHolen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Holen' }));
    expect(datei.chordProHolen).toHaveBeenCalledWith(7001);
  });

  it('Löschen erst nach der Rückfrage', () => {
    const { datei } = zeigen({ loeschDatei: PDF });
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(datei.loeschenBestaetigen).toHaveBeenCalled();
  });

  it('Umbenennen: X schließt alles – auch die Dateien darunter', () => {
    const { datei, setOverlay } = zeigen({ umbenennDatei: PDF });
    const fenster = screen.getAllByRole('dialog').at(-1)!;
    fireEvent.click(within(fenster).getByRole('button', { name: 'Fenster schließen' }));
    expect(datei.setUmbenennDatei).toHaveBeenCalledWith(null);
    expect(setOverlay).toHaveBeenCalledWith(null);
  });

  it('gleicher Dateiname: „Trotzdem hochladen“ lädt hoch', () => {
    const { datei } = zeigen({ uploadWarnung: { text: '„Treu - E.pdf“ gibt es schon.' } as never });
    fireEvent.click(screen.getByRole('button', { name: 'Trotzdem hochladen' }));
    expect(datei.warnungBestaetigen).toHaveBeenCalled();
  });
});
