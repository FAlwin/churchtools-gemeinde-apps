// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { diensteAus } from '@shared/ct/dienste';
import { terminVorlagenAus } from '@shared/ct/terminVorlagen';
import { planAus } from '@shared/dienstplan/plan';
import type { RohTermin } from '@shared/dienstplan/termine';
import { nachgebaut } from './entwurfAnschluss.testutil';
import { katalogAus, type DiensteKatalog } from './planEntwuerfe';
import { Planen } from './Planen';
import { ganzSichtbar, planbar } from './start';
import { startFuer } from './start.testutil';

/**
 * Plätze-Fach in „Planen“: alle Dienste der Gruppe (auch ohne Matrixzeile) und „Vorlage übernehmen“ – mit dem echten
 * Plan (`planAus` + `start.ts`) und dem echten Katalog (`katalogAus`), nur ChurchTools ist nachgebaut.
 */
const START = startFuer({
  dienstgruppen: [
    { id: 3, name: 'Technik', fuerAlle: false },
    { id: 5, name: 'Moderation & Predigt', fuerAlle: false },
  ],
  dienste: diensteAus([
    { id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [7] },
    { id: 8, name: 'Kamera', serviceGroupId: 3, groupIds: [7] },
    { id: 24, name: 'Abendmahl', serviceGroupId: 5, groupIds: [9] },
  ]),
  rechte: {
    planbareDienstgruppen: [3, 5],
    sichtbareDienstgruppen: null,
    ablaufKalender: [],
    terminKalender: [],
    abwesenheitenAller: false,
  },
});

const roh = (kalender: string) =>
  [
    {
      id: 20,
      name: 'Gottesdienst',
      startDate: '2026-11-08T09:00:00Z',
      endDate: '2026-11-08T10:30:00Z',
      calendar: { title: 'Kalender', domainIdentifier: kalender },
      eventServices: [{ serviceId: 6, personId: null, name: null, index: null }],
    },
  ] as RohTermin[];

const plan = (kalender = '1') =>
  planAus(roh(kalender), {
    ichId: START.ichId,
    dienste: START.dienste,
    dienstgruppen: START.dienstgruppen,
    zeitzone: 'Europe/Berlin',
    planbar: (d) => planbar(START, d),
    ganzSichtbar: (d) => ganzSichtbar(START, d),
  });

const vorlage = (
  id: number,
  templateName: string,
  calendarId: number,
  ...d: [number, number][]
) => ({
  id,
  templateName,
  calendarId,
  services: d.map(([serviceId, count]) => ({ serviceId, count })),
});
const VORLAGEN = terminVorlagenAus([
  vorlage(3, 'Abendmahl', 1, [6, 1], [24, 1], [8, 1]),
  vorlage(5, 'Gebetsabend', 2, [6, 1]),
]);

function zeige(kalender = '1', katalog: DiensteKatalog | null = katalogAus(START)) {
  const anzahl = vi.fn((_e: number, _s: number, _g: number, neu: number) =>
    Promise.resolve({ ok: true as const, anzahl: neu }),
  );
  const laden = vi.fn(() => Promise.resolve(VORLAGEN));
  render(
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan: plan(kalender), wochen: 8 }}
      handy={false}
      onNochmal={() => {}}
      onMehr={() => {}}
      mehrMoeglich={false}
      ladeZeitraum={() => new Promise<never>(() => {})}
      heute="2026-11-01"
      entwuerfe={nachgebaut({ anzahl })}
      katalog={katalog ?? undefined}
      ladeVorlagen={laden}
    />,
  );
  return { anzahl, laden };
}
const oeffne = async () =>
  fireEvent.click(
    await screen.findByRole('button', { name: 'Plätze Technik am So, 08.11. ändern' }),
  );

describe('Planen – Plätze-Fach mit allen Diensten und Vorlage', () => {
  it('Kamera hat im Zeitraum keinen Platz, steht aber im Fach (0) – die Matrix bekommt keine Leerzeile', async () => {
    const { anzahl } = zeige();
    expect(screen.queryByText('Kamera')).toBeNull();
    await oeffne();
    expect(screen.getByLabelText('Kamera: 0 Plätze')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Kamera: ein Platz mehr' }));
    await waitFor(() => expect(anzahl).toHaveBeenCalledWith(20, 8, 0, 1));
  });

  it('ohne Katalog bleibt es beim Alten: nur Dienste mit Zeile', async () => {
    const { laden } = zeige('1', null);
    await oeffne();
    expect(screen.getByLabelText('Ton: 1 Plätze')).toBeTruthy();
    expect(screen.queryByLabelText('Kamera: 0 Plätze')).toBeNull();
    expect(laden).not.toHaveBeenCalled();
  });

  it('Vorlage: nur die des Termin-Kalenders; Vorschau über alle Gruppen; Übernehmen speichert je Dienst', async () => {
    const { anzahl, laden } = zeige('1');
    await oeffne();
    const feld = await screen.findByRole('combobox', { name: 'Vorlage' });
    expect(laden).toHaveBeenCalledTimes(1);
    expect([...feld.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      '— Vorlage wählen —',
      'Abendmahl',
    ]);
    fireEvent.change(feld, { target: { value: '3' } });
    // Ton hat schon 1; Abendmahl liegt in einer anderen Gruppe (Moderation) und wird trotzdem dazugenommen.
    expect(screen.getByText('Abendmahl: 0 → 1 · Kamera: 0 → 1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    await waitFor(() => expect(anzahl).toHaveBeenCalledTimes(2));
    expect(anzahl).toHaveBeenCalledWith(20, 8, 0, 1);
    expect(anzahl).toHaveBeenCalledWith(20, 24, 0, 1);
  });

  it('anderer Kalender → andere Vorlage', async () => {
    zeige('2');
    await oeffne();
    const feld = await screen.findByRole('combobox', { name: 'Vorlage' });
    expect([...feld.querySelectorAll('option')].map((o) => o.textContent)).toContain('Gebetsabend');
  });

  it('keine Vorlage zum Kalender des Termins → kein Bereich', async () => {
    const { laden } = zeige('77');
    await oeffne();
    await waitFor(() => expect(laden).toHaveBeenCalled());
    expect(screen.queryByRole('combobox', { name: 'Vorlage' })).toBeNull();
  });

  it('Dienste, die man nicht planen darf, stehen weder im Fach noch in der Vorlage', async () => {
    const s = startFuer({ ...START, rechte: { ...START.rechte, planbareDienstgruppen: [3] } });
    const katalog = katalogAus(s);
    const { anzahl } = zeige('1', katalog);
    await oeffne();
    const feld = await screen.findByRole('combobox', { name: 'Vorlage' });
    fireEvent.change(feld, { target: { value: '3' } });
    // Moderation darf man hier nicht planen: Abendmahl wird übersprungen, Kamera (Technik) dazugenommen.
    expect(screen.getByText(/Kamera: 0 → 1/)).toBeTruthy();
    expect(screen.getByText(/Abendmahl – darfst du nicht planen/)).toBeTruthy();
    expect(anzahl).not.toHaveBeenCalled();
  });
});
