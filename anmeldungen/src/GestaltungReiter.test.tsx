// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';
import * as E from './einrichten';
import { GestaltungReiter } from './GestaltungReiter';

vi.mock('./einrichten', async (original) => {
  const echt = await original<typeof import('./einrichten')>();
  return { ...echt, aendereEinstellungen: vi.fn(), bildHochladen: vi.fn(), bildEntfernen: vi.fn() };
});
const m = vi.mocked(E);

function zeigen(bildUrl: string | null = null) {
  const gespeichert = vi.fn();
  const { container } = render(
    <GestaltungReiter
      id={91}
      name="Gemeindeessen"
      gemeinde="ECG Donrath"
      einstellungen={neueEinstellungen('einfach')}
      bildUrl={bildUrl}
      darf
      heute="2026-10-13"
      onGespeichert={gespeichert}
    />,
  );
  return { gespeichert, container };
}

describe('Reiter „Gestaltung“ (A5)', () => {
  it('Vorlage wählen ändert die Vorschau sofort; gespeichert wird erst mit „Speichern“', async () => {
    m.aendereEinstellungen.mockResolvedValue(neueEinstellungen('einfach'));
    const { gespeichert, container } = zeigen();
    expect(screen.getByRole('button', { name: 'Gespeichert' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: /Bunt/ }));
    expect(container.querySelector('[class*="t-bunt"]')).toBeTruthy();
    expect(m.aendereEinstellungen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Gestaltung speichern' }));
    await waitFor(() => expect(m.aendereEinstellungen).toHaveBeenCalled());
    const neu = m.aendereEinstellungen.mock.calls[0][1](neueEinstellungen('einfach'));
    expect(neu.gestaltung).toMatchObject({ vorlage: 'bunt', farbe: '#0369a1', knoepfe: 'rund' });
    expect(gespeichert).toHaveBeenCalledWith('Gestaltung gespeichert.', true);
  });

  it('„Änderungen verwerfen“ stellt den gespeicherten Stand her', () => {
    zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Gold' }));
    fireEvent.click(screen.getByRole('button', { name: 'Änderungen verwerfen' }));
    expect(screen.getByRole('button', { name: 'Gespeichert' })).toBeTruthy();
  });

  it('Titelbild hochladen – ohne „Rückgängig“ (ChurchTools hebt das alte Bild nicht auf)', async () => {
    m.bildHochladen.mockResolvedValue('https://ct.test/bild.png');
    const { gespeichert } = zeigen();
    const datei = new File(['x'], 'bild.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Titelbild wählen'), { target: { files: [datei] } });
    await waitFor(() => expect(m.bildHochladen).toHaveBeenCalledWith(91, datei));
    await waitFor(() => expect(gespeichert).toHaveBeenCalledWith('Titelbild hochgeladen.', false));
  });

  it('mit eigenem Bild: „Bild der Vorlage nehmen“ entfernt es', async () => {
    m.bildEntfernen.mockResolvedValue();
    zeigen('https://ct.test/bild.png');
    fireEvent.click(screen.getByRole('button', { name: 'Bild der Vorlage nehmen' }));
    await waitFor(() => expect(m.bildEntfernen).toHaveBeenCalledWith(91));
  });
});
