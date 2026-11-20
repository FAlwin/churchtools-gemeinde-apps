// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { WebsiteStand } from '@shared/website/speicher';
import { menue, seite } from '@shared/website/website.testdaten';
import * as D from './daten';
import { Seiten } from './Seiten';

/**
 * Nicht gespeicherte Änderungen an der Seite (`onOffen(true)` der Seitenarbeit) – die Seitenliste reicht dann **nichts** ein und
 * veröffentlicht **nichts**: Sonst ginge etwas anderes online als das, was man sieht. Die Seitenarbeit ist hier ersetzt; sie meldet
 * nur „offen“ und trägt die Leiste, die die Seitenliste ihr gibt.
 */
vi.mock('./Seitenarbeit', () => ({
  Seitenarbeit: (p: { freigabeLeiste?: React.ReactNode; onOffen: (o: boolean) => void }) => (
    <div>
      {p.freigabeLeiste}
      <button onClick={() => p.onOffen(true)}>OFFEN</button>
    </div>
  ),
}));
vi.mock('./daten', () => ({
  ladeWebsite: vi.fn(),
  ladeOnline: vi.fn(),
  setzeStatus: vi.fn(),
  gebeFrei: vi.fn(),
}));
const d = vi.mocked(D);
const S = seite({ id: 's', titel: 'Willkommen', pfad: 'start', startseite: true });
const stand = (): WebsiteStand => ({
  seiten: [S],
  menue: menue([]),
  einstellungen: null,
  probleme: [],
  verwaist: 0,
  sperren: {},
  einstellungenSperre: null,
  status: {},
  staende: [],
});
const ICH = { person: 5, name: 'Rita', fenster: 'f' };

beforeEach(() => {
  vi.clearAllMocks();
  d.ladeWebsite.mockResolvedValue(stand());
  d.ladeOnline.mockResolvedValue(stand());
});

describe('Ungespeichertes blockiert Einreichen und Veröffentlichen', () => {
  it('Redakteur: „Zur Prüfung einreichen“ ist aus, solange etwas nicht gespeichert ist', async () => {
    render(
      <Seiten
        ort={{ modul: 7, kategorie: 20 }}
        gemeinde="ECG"
        ich={ICH}
        rechte={{ html: false, menue: false }}
        freigabe={{ zugang: 'redakteur', veroeffentlicht: 21, onGeaendert: vi.fn() }}
      />,
    );
    const knopf = await screen.findByRole('button', {
      name: 'Zur Prüfung einreichen',
    });
    expect(knopf).toHaveProperty('disabled', false);
    fireEvent.click(screen.getByRole('button', { name: 'OFFEN' }));
    expect(screen.getByRole('button', { name: 'Zur Prüfung einreichen' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('Leitung: „Veröffentlichen“ ist dann nicht wählbar', async () => {
    render(
      <Seiten
        ort={{ modul: 7, kategorie: 20 }}
        gemeinde="ECG"
        ich={ICH}
        rechte={{ html: true, menue: true }}
        freigabe={{ zugang: 'leitung', veroeffentlicht: 21, onGeaendert: vi.fn() }}
      />,
    );
    await screen.findByRole('button', { name: 'Mehr' });
    fireEvent.click(screen.getByRole('button', { name: 'OFFEN' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mehr' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Veröffentlichen' }));
    expect(d.gebeFrei).not.toHaveBeenCalled();
  });
});
