// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { BlattQuelle } from '@shared/ct/terminBlatt';

vi.mock('./sharePdf', () => ({
  sharePdf: vi.fn(() => Promise.resolve()),
  downloadPdf: vi.fn(),
}));
// pdf.js zeichnet in jsdom nicht – die Vorschau bekommt je Seite eine Leinwand-Attrappe.
vi.mock('./pdfSeiten', () => {
  const blatt = { toDataURL: () => 'data:image/jpeg;seite' };
  return {
    renderPdfToCanvases: vi.fn(() => Promise.resolve([blatt])),
    renderPdfSeite: vi.fn(() => Promise.resolve(blatt)),
  };
});
const { downloadPdf, sharePdf } = await import('./sharePdf');
const { TerminTeilenFenster } = await import('./TerminTeilenFenster');
const { wahlAus } = await import('./terminBlattWahl');
const { BLATT_VORGABE } = await import('@shared/ct/terminBlatt');

const QUELLE: Omit<BlattQuelle, 'stand'> = {
  titel: 'Gottesdienst',
  tag: '2026-11-01',
  beginn: '10:00',
  gemeinde: 'ECG Donrath',
  app: 'Dienstplaner',
  zeilen: [
    {
      id: 1,
      title: 'Begrüßung',
      type: 'normal',
      isHeader: false,
      responsible: [],
      responsibleText: '',
      song: null,
      time: '10:00',
      vorBeginn: false,
      durationMin: 5,
      note: '',
      infos: [{ gruppeId: 2, text: 'Mikro 1' }],
    },
  ],
  dienste: [
    { id: 1, name: 'Programm', dienste: [{ name: 'Moderation', personen: [], frei: 1 }] },
    { id: 2, name: 'Technik', dienste: [{ name: 'Ton', personen: [], frei: 1 }] },
  ],
  infoGruppen: [
    { id: 2, name: 'Technik' },
    { id: 3, name: 'Musik' },
  ],
  ansichtInfos: [2],
};

const zeige = (quelle = QUELLE) => {
  const onClose = vi.fn();
  render(<TerminTeilenFenster quelle={quelle} onClose={onClose} />);
  return { onClose };
};
const zeile = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('Termin teilen – Hauptseite (E8-1)', () => {
  it('drei Zeilen mit dem, was eingestellt ist; das PDF ist fertig, mit Dateiname', async () => {
    zeige();
    expect(zeile('Dienste').textContent).toContain('Programm, Technik · über dem Ablauf');
    expect(zeile('Ablauf').textContent).toContain('Uhrzeit, Dauer, Zuständig · Lieder mit Tonart');
    expect(zeile('Infos').textContent).toContain('Technik als Spalten – wie in der Ansicht');
    expect(
      await screen.findByText(/Fertig · 1 Seite · Gottesdienst 01\.11\.2026\.pdf/),
    ).toBeTruthy();
  });

  it('„Teilen“ teilt das PDF unter dem Dateinamen und schließt; „Herunterladen“ lädt und bleibt offen', async () => {
    const { onClose } = zeige();
    await screen.findByText(/Fertig/);
    fireEvent.click(screen.getByRole('button', { name: /Herunterladen/ }));
    expect(downloadPdf).toHaveBeenCalledWith(expect.anything(), 'Gottesdienst 01.11.2026');
    expect(screen.getByText(/Heruntergeladen/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Teilen/ }));
    expect(sharePdf).toHaveBeenCalledWith(expect.anything(), 'Gottesdienst 01.11.2026');
    expect(onClose).toHaveBeenCalled();
  });

  it('ohne Ablauf: die Zeile „Ablauf“ sagt es und führt nirgends hin', () => {
    zeige({ ...QUELLE, zeilen: null });
    const z = zeile('Ablauf') as HTMLButtonElement;
    expect(z.textContent).toContain('Dieser Termin hat keinen Ablauf.');
    expect(z.disabled).toBe(true);
  });

  it('ohne Dienste am Termin – oder mit Hinweis des Aufrufers – führt die Zeile „Dienste“ nirgends hin', () => {
    zeige({ ...QUELLE, dienste: [] });
    const z = zeile('Dienste') as HTMLButtonElement;
    expect(z.textContent).toContain('An diesem Termin sind keine Dienste vorgesehen.');
    expect(z.disabled).toBe(true);
    cleanup();
    render(
      <TerminTeilenFenster
        quelle={QUELLE}
        onClose={vi.fn()}
        diensteHinweis="Dienste werden geladen …"
      />,
    );
    expect(zeile('Dienste').textContent).toContain('Dienste werden geladen …');
  });

  it('ohne sichtbare Infos-Gruppen gibt es keine Zeile „Infos“', () => {
    zeige({ ...QUELLE, infoGruppen: [] });
    expect(screen.queryByRole('button', { name: /^Infos/ })).toBeNull();
  });
});

describe('Termin teilen – Unterseiten', () => {
  it('Dienste: oben der Schalter; aus → auf der Hauptseite „nicht auf dem Blatt“, das Gerät merkt es', async () => {
    zeige();
    fireEvent.click(zeile('Dienste'));
    expect(screen.getByText('Dienste aufs Blatt')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Dienste aufs Blatt/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(zeile('Dienste').textContent).toContain('nicht auf dem Blatt');
    cleanup();
    zeige();
    expect(zeile('Dienste').textContent).toContain('nicht auf dem Blatt');
    await screen.findByText(/Fertig/);
  });

  it('Dienste: eine Gruppe abwählen und „Unter dem Ablauf“', () => {
    zeige();
    fireEvent.click(zeile('Dienste'));
    fireEvent.click(screen.getByLabelText('Programm'));
    fireEvent.click(screen.getByRole('button', { name: 'Unter dem Ablauf' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(zeile('Dienste').textContent).toContain('Technik · unter dem Ablauf');
  });

  it('Ablauf: Zuständig unter dem Eintrag, Tempo dazu', () => {
    zeige();
    fireEvent.click(zeile('Ablauf'));
    fireEvent.click(screen.getByRole('button', { name: 'Unter dem Eintrag' }));
    fireEvent.click(screen.getByLabelText('Tempo'));
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(zeile('Ablauf').textContent).toContain(
      'Uhrzeit, Dauer, Zuständig unter dem Eintrag · Lieder mit Tonart und Tempo',
    );
  });

  it('Infos: abweichend von der Ansicht wählen – und wieder zurück zur Ansicht', () => {
    zeige();
    fireEvent.click(zeile('Infos'));
    expect(screen.getByLabelText<HTMLInputElement>('Technik').checked).toBe(true);
    fireEvent.click(screen.getByLabelText('Musik'));
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(zeile('Infos').textContent).toContain('Technik, Musik als Spalten');
    expect(zeile('Infos').textContent).not.toContain('wie in der Ansicht');
    fireEvent.click(zeile('Infos'));
    fireEvent.click(screen.getByRole('button', { name: 'Wieder wie in der Ansicht' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(zeile('Infos').textContent).toContain('Technik als Spalten – wie in der Ansicht');
  });

  it('Querformat wird gemerkt und neu gebaut', async () => {
    zeige();
    await screen.findByText(/Fertig/);
    fireEvent.click(screen.getByRole('button', { name: 'Querformat' }));
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('teilen.terminBlatt')!)).toMatchObject({ quer: true }),
    );
  });
});

describe('Gemerkte Wahl', () => {
  it('Unlesbares → Vorgabe; Teile werden übernommen, falsche Typen nicht', () => {
    expect(wahlAus('quatsch')).toEqual(BLATT_VORGABE);
    const w = wahlAus({
      quer: true,
      dienste: { an: false, ohne: [1, 'x'], frei: 'ja' },
      infos: { gruppen: [3] },
      ablauf: { tempo: true, unbekannt: true },
    });
    expect(w.quer).toBe(true);
    expect(w.dienste).toMatchObject({ an: false, ohne: [1], frei: true });
    expect(w.infos.gruppen).toEqual([3]);
    expect(w.ablauf.tempo).toBe(true);
    expect('unbekannt' in w.ablauf).toBe(false);
  });
});
