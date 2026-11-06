// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LEERER_PLAN } from '@shared/dienstplan/zeile.testutil';
import type { PlanBlatt } from '@shared/dienstplan/planBlatt';

/**
 * **Meine Dienste teilen** (E8-3): „Teilen“ neben „Meine | Alle“, nur bei „Meine“; das Fenster liest die eigenen
 * Einteilungen frisch (`tauschPort.einteilungen`) – das Blatt wird festgehalten statt gezeichnet.
 */
const port = vi.hoisted(() => ({ einteilungen: vi.fn<(ich: number) => Promise<unknown[]>>() }));
vi.mock('./tauschPort', () => ({ tauschPort: port }));
const blaetter = vi.hoisted(() => [] as unknown[]);
vi.mock('@ui/teilen/planBlattPdf', () => ({
  planBlattPdf: vi.fn(async (b: unknown) => {
    blaetter.push(b);
    const { jsPDF } = await import('jspdf');
    return new jsPDF();
  }),
}));
vi.mock('@ui/teilen/pdfSeiten', () => ({
  renderPdfToCanvases: vi.fn(() => Promise.resolve([])),
  renderPdfSeite: vi.fn(() => Promise.reject(new Error('jsdom'))),
}));

const { Termine } = await import('./Termine');

const zeige = () =>
  render(
    <Termine
      zustand={{ art: 'fertig', zeilen: [], plan: LEERER_PLAN, wochen: 8 }}
      planer={false}
      onNochmal={() => {}}
      onMehr={() => {}}
      zeitzone="Europe/Berlin"
      ich={{ id: 1, name: 'Alwin Friesen', gemeinde: 'ECG Donrath' }}
    />,
  );
const knopf = () => screen.queryByRole('button', { name: 'Meine Dienste als PDF teilen' });

beforeEach(() => {
  blaetter.length = 0;
  localStorage.clear();
  port.einteilungen.mockReset();
});
afterEach(cleanup);

describe('Meine Dienste teilen (E8-3)', () => {
  it('„Teilen“ nur bei „Meine“ – bei „Alle“ nicht', () => {
    zeige();
    expect(knopf()).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Alle' }));
    expect(knopf()).toBeNull();
  });

  it('öffnet „Meine Dienste teilen“ mit allen kommenden Diensten der eigenen Person', async () => {
    port.einteilungen.mockResolvedValue([
      {
        id: 1,
        serviceId: 3,
        serviceName: 'Leitung',
        isAccepted: true,
        event: { id: 10, name: 'Gottesdienst', startDate: '2026-11-08T09:00:00Z' },
      },
    ]);
    zeige();
    fireEvent.click(knopf()!);
    expect(await screen.findByRole('dialog', { name: 'Meine Dienste teilen' })).toBeTruthy();
    await waitFor(() => expect(blaetter.length).toBeGreaterThan(0));
    expect(port.einteilungen).toHaveBeenCalledWith(1);
    const b = blaetter.at(-1) as PlanBlatt;
    expect(b.untertitel).toBe('Alwin Friesen · 8. November 2026');
    expect(b.gemeinde).toBe('ECG Donrath');
    expect(
      await screen.findByText(/Fertig · 1 Seite · Meine Dienste Alwin Friesen\.pdf/),
    ).toBeTruthy();
  });

  it('nicht lesbar → Hinweis mit „Erneut versuchen“, der es noch einmal liest', async () => {
    port.einteilungen.mockRejectedValueOnce(new Error('503')).mockResolvedValueOnce([]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    zeige();
    fireEvent.click(knopf()!);
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    // Der Grund steht im Log – auf der Seite nur „ließen sich nicht laden“.
    expect(warn).toHaveBeenCalledWith('[meine dienste] nicht geladen:', expect.any(Error));
    await waitFor(() =>
      expect((blaetter.at(-1) as PlanBlatt | undefined)?.leer).toBe(
        'Du hast keine kommenden Dienste.',
      ),
    );
    expect(port.einteilungen).toHaveBeenCalledTimes(2);
  });
});
