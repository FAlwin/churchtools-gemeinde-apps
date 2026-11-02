// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { InfosFenster } from './InfosFenster';

/** Das Fenster selbst: direkt ins Textfeld nur, wenn noch nichts da ist UND man schreiben darf. */
afterEach(cleanup);

function zeige(o: { text: string; darf: boolean }) {
  render(
    <InfosFenster
      fuer="Gottesdienst · So, 08.11.2026"
      terminId={7}
      text={o.text}
      darf={o.darf}
      onGespeichert={() => {}}
      onClose={() => {}}
      speichern={vi.fn()}
    />,
  );
}

describe('InfosFenster – wann es gleich im Bearbeiten aufgeht', () => {
  it('leer, ohne Recht: nur „Noch keine Infos“, kein Textfeld', () => {
    zeige({ text: '', darf: false });
    expect(screen.getByText('Noch keine Infos zu diesem Termin.')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('leer, mit Recht: gleich das Textfeld', () => {
    zeige({ text: '', darf: true });
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('mit Text, mit Recht: erst lesen, dann „Bearbeiten“', () => {
    zeige({ text: 'Abendmahl', darf: true });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeTruthy();
  });
});
