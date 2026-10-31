// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { ArrangementFileEntry } from '@shared/types/index';
import { versionFileName } from '@shared/ct/arrangementFiles';
import { DateiUmbenennenFenster } from './DateiUmbenennenFenster';

/**
 * „Datei umbenennen“ (31.10.2026): Die Endung steht fest daneben, der Knopf ist nur bereit, wenn sich etwas geändert
 * hat und die Regel des Kerns nichts einzuwenden hat.
 */
const PDF: ArrangementFileEntry = {
  fileId: 2,
  name: 'Treu - E.pdf',
  label: 'Treu - E.pdf',
  size: 1024,
  kind: 'pdf',
};
const VERSION: ArrangementFileEntry = {
  fileId: 3,
  name: versionFileName('Treu', 'Akustik'),
  label: 'Version „Akustik"',
  size: 900,
  kind: 'chordpro-version',
};

function setup(
  datei: ArrangementFileEntry,
  over: { benennt?: boolean; fehler?: string | null } = {},
) {
  const onUmbenennen = vi.fn();
  const onClose = vi.fn();
  render(
    <DateiUmbenennenFenster
      datei={datei}
      benennt={over.benennt ?? false}
      fehler={over.fehler ?? null}
      onUmbenennen={onUmbenennen}
      onClose={onClose}
    />,
  );
  const feld = screen.getByLabelText<HTMLInputElement>('Name');
  const knopf = screen.getByRole<HTMLButtonElement>('button', {
    name: /^(Umbenennen|Wird umbenannt …)$/,
  });
  return { onUmbenennen, onClose, feld, knopf };
}

afterEach(cleanup);

describe('DateiUmbenennenFenster', () => {
  it('zeigt den Namen im Feld und die Endung fest daneben', () => {
    const { feld } = setup(PDF);
    expect(feld.value).toBe('Treu - E');
    expect(screen.getByText('.pdf')).toBeTruthy();
    expect(screen.getByText('Datei umbenennen')).toBeTruthy();
  });

  it('unverändert ist der Knopf grau – geändert schickt er die Eingabe', () => {
    const { feld, knopf, onUmbenennen } = setup(PDF);
    expect(knopf.disabled).toBe(true);
    fireEvent.change(feld, { target: { value: 'Lead E' } });
    expect(knopf.disabled).toBe(false);
    knopf.click();
    expect(onUmbenennen).toHaveBeenCalledWith('Lead E');
  });

  it('Eingabetaste schickt ab wie der Knopf', () => {
    const { feld, onUmbenennen } = setup(PDF);
    fireEvent.change(feld, { target: { value: 'Lead E' } });
    fireEvent.submit(feld.closest('form')!);
    expect(onUmbenennen).toHaveBeenCalledWith('Lead E');
  });

  it('ein leerer Name wird vor dem Absenden benannt', () => {
    const { feld, knopf } = setup(PDF);
    fireEvent.change(feld, { target: { value: '  ' } });
    expect(knopf.disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toBe('Bitte einen Namen angeben.');
  });

  it('eine Version: nur ihr Name, keine Endung, eigener Titel', () => {
    const { feld } = setup(VERSION);
    expect(feld.value).toBe('Akustik');
    expect(screen.queryByText('.chordpro')).toBeNull();
    expect(screen.getByText('Version umbenennen')).toBeTruthy();
  });

  it('was ChurchTools ablehnt, steht im Fenster', () => {
    setup(PDF, { fehler: 'Keine Berechtigung, Dateien in ChurchTools umzubenennen.' });
    expect(screen.getByRole('alert').textContent).toMatch(/Keine Berechtigung/);
  });

  it('während es läuft, ist alles gesperrt', () => {
    setup(PDF, { benennt: true });
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Wird umbenannt …' }).disabled,
    ).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>('Name').disabled).toBe(true);
  });
});
