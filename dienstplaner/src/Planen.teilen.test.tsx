// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { diensteAus } from '@shared/ct/dienste';
import { planAus } from '@shared/dienstplan/plan';
import type { PlanBlatt } from '@shared/dienstplan/planBlatt';
import type { RohTermin } from '@shared/dienstplan/termine';

/**
 * **Plan teilen** (E8-2): „Teilen“ in der Werkzeugleiste von „Planen“ öffnet „Plan teilen“ – ganzer Plan, eine Gruppe
 * oder „Wir suchen noch …“, für die gezeigten Termine und eingeblendeten Gruppen. Das Blatt wird festgehalten statt
 * gezeichnet – geprüft wird, was aus dem echten Plan (`planAus`) entsteht.
 */
vi.mock('./ladeWerKann', () => ({ ladeWerKann: vi.fn(), vergissWerKann: vi.fn() }));
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

const { Planen } = await import('./Planen');
const { PlanTeilenFenster } = await import('./PlanTeilenFenster');

const DIENSTE = diensteAus([
  { id: 1, name: 'Predigt', serviceGroupId: 1 },
  { id: 6, name: 'Ton', serviceGroupId: 3 },
  { id: 7, name: 'Licht', serviceGroupId: 3 },
]);
const GRUPPEN = [
  { id: 1, name: 'Programm', fuerAlle: false },
  { id: 3, name: 'Technik', fuerAlle: false },
];
const ROH = [
  {
    id: 10,
    name: 'Gottesdienst',
    startDate: '2026-10-18T08:00:00Z',
    endDate: '2026-10-18T09:30:00Z',
    eventServices: [
      { serviceId: 6, personId: 5, name: 'Anna Test', isAccepted: true },
      { serviceId: 7, personId: null, name: null },
      { serviceId: 1, personId: null, name: 'Gastprediger', isAccepted: true },
    ],
  },
  {
    id: 11,
    name: 'Gebetsabend',
    startDate: '2026-10-21T17:00:00Z',
    endDate: '2026-10-21T18:30:00Z',
    eventServices: [{ serviceId: 6, personId: -2, name: 'Echter Name', isAccepted: true }],
  },
] as RohTermin[];
const PLAN = planAus(ROH, {
  ichId: 1,
  dienste: DIENSTE,
  dienstgruppen: GRUPPEN,
  zeitzone: 'Europe/Berlin',
  planbar: (d) => d.dienstgruppeId === 3,
  ganzSichtbar: () => true,
});

function zeige() {
  render(
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan: PLAN, wochen: 8 }}
      handy={false}
      onNochmal={() => {}}
      onMehr={() => {}}
      mehrMoeglich={false}
      ladeZeitraum={() => new Promise<never>(() => {})}
      heute="2026-10-14"
    />,
  );
}
const letztesBlatt = () => blaetter.at(-1) as PlanBlatt;
const oeffnen = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Plan als PDF teilen' }));
  return screen.findByRole('dialog', { name: 'Plan teilen' });
};

beforeEach(() => {
  blaetter.length = 0;
  localStorage.clear();
});
afterEach(cleanup);

describe('Plan teilen (E8-2)', () => {
  it('„Teilen“ in der Werkzeugleiste öffnet „Plan teilen“ – ganzer Plan, je Gruppe, „Wir suchen noch …“', async () => {
    zeige();
    await oeffnen();
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual([
      'Ganzer Planalle eingeblendeten Gruppen',
      'Nur Programmz. B. für den Gruppenchat',
      'Nur Technik',
      'Wir suchen noch …nur offene Dienste – zum Rumschicken',
    ]);
    expect(screen.getByRole('radio', { name: /Ganzer Plan/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
    await waitFor(() => expect(letztesBlatt()?.titel).toBe('Dienstplan'));
    expect(letztesBlatt().abschnitte.map((a) => a.titel)).toEqual(['Programm', 'Technik']);
    expect(screen.getByText(/18\. Oktober – 21\. Oktober 2026 · 2 Termine/)).toBeTruthy();
  });

  it('„Nur Technik“ – das Blatt nur mit Technik, das Gerät merkt sich die Wahl', async () => {
    zeige();
    await oeffnen();
    fireEvent.click(screen.getByRole('radio', { name: /Nur Technik/ }));
    await waitFor(() => expect(letztesBlatt().titel).toBe('Dienstplan Technik'));
    cleanup();
    zeige();
    await oeffnen();
    expect(screen.getByRole('radio', { name: /Nur Technik/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('„Wir suchen noch …“ – nur offene Dienste, keine Namen; verborgene Namen nie', async () => {
    zeige();
    await oeffnen();
    fireEvent.click(screen.getByRole('radio', { name: /Wir suchen noch/ }));
    await waitFor(() => expect(letztesBlatt().titel).toBe('Wir suchen noch …'));
    expect(JSON.stringify(letztesBlatt())).not.toContain('Anna Test');
    fireEvent.click(screen.getByRole('radio', { name: /Ganzer Plan/ }));
    await waitFor(() => expect(letztesBlatt().titel).toBe('Dienstplan'));
    expect(JSON.stringify(letztesBlatt())).not.toContain('Echter Name');
  });

  it('eine gemerkte Gruppe, die gerade ausgeblendet ist, wird zum ganzen Plan', async () => {
    localStorage.setItem('teilen.planBlatt', JSON.stringify({ art: 'gruppe', gruppe: 3 }));
    render(
      <PlanTeilenFenster
        quelle={{
          plan: PLAN,
          spalten: [0, 1],
          gruppen: PLAN.gruppen.filter((g) => g.gruppe?.id === 1),
          gemeinde: null,
          app: 'Dienstplaner',
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('radio', { name: /Ganzer Plan/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
    await waitFor(() => expect(letztesBlatt()?.titel).toBe('Dienstplan'));
  });
});
