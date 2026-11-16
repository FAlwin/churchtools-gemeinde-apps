// @vitest-environment jsdom
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { diensteAus } from '@shared/ct/dienste';
import { planAus } from '@shared/dienstplan/plan';
import type { RohTermin } from '@shared/dienstplan/termine';
import { leseAnsicht } from './planenAnsicht';
import { Planen } from './Planen';

/**
 * Einzelne Dienste ausblenden (Wunsch 10, Alwin 16.11.2026): Filter-Menü, Matrix, „Personen“, „Wer wie oft?“, Handy,
 * Besuch von der Startseite. Der Plan kommt aus `planAus` mit rohen Terminen; die Rechnung selbst prüfen
 * `shared/dienstplan/planFilter.test.ts` und `personenRaster.test.ts`.
 *
 * Technik: Ton (6), Bild (7), Licht (8) – Musik: Gitarre (10). Anna steht beim Gottesdienst in Ton UND Bild.
 */
const DIENSTE = diensteAus([
  { id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [7], sortKey: 1 },
  { id: 7, name: 'Bild', serviceGroupId: 3, groupIds: [7], sortKey: 2 },
  { id: 8, name: 'Licht', serviceGroupId: 3, groupIds: [7], sortKey: 3 },
  { id: 10, name: 'Gitarre', serviceGroupId: 4, groupIds: [100], sortKey: 4 },
]);
const GRUPPEN = [
  { id: 3, name: 'Technik', fuerAlle: false },
  { id: 4, name: 'Musik', fuerAlle: false },
];
const ROH = [
  {
    id: 10,
    name: 'Gottesdienst',
    startDate: '2026-10-18T08:00:00Z',
    endDate: '2026-10-18T09:30:00Z',
    eventServices: [
      { serviceId: 6, personId: 5, name: 'Anna Test', isAccepted: true, index: null },
      { serviceId: 7, personId: 5, name: 'Anna Test', isAccepted: true, index: 1 },
      { serviceId: 7, personId: null, name: null, index: 2 },
      { serviceId: 8, personId: null, name: null, index: null },
      { serviceId: 10, personId: 12, name: 'Daniel Test', isAccepted: true, index: null },
    ],
  },
] as RohTermin[];
const PLAN = planAus(ROH, {
  ichId: 1,
  dienste: DIENSTE,
  dienstgruppen: GRUPPEN,
  zeitzone: 'Europe/Berlin',
  planbar: () => true,
  ganzSichtbar: () => true,
});
const ANSICHT = 'dienstplaner.planen.ansicht';
const ZUSATZ = {
  mehrMoeglich: false,
  ladeZeitraum: () => Promise.resolve({ zeilen: [] as [], plan: PLAN }),
  heute: '2026-10-14',
};

function zeige(
  ansicht: object = {},
  extra: Partial<ComponentProps<typeof Planen>> = {},
  handy = false,
) {
  localStorage.setItem(ANSICHT, JSON.stringify(ansicht));
  return render(
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan: PLAN, wochen: 8 }}
      handy={handy}
      onNochmal={() => {}}
      onMehr={() => {}}
      {...ZUSATZ}
      {...extra}
    />,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const filter = () => fireEvent.click(screen.getByRole('button', { name: /^Filter/ }));
const haken = (name: string) => screen.getByRole<HTMLInputElement>('checkbox', { name });
const gemerkt = () => JSON.parse(localStorage.getItem(ANSICHT) ?? '{}');
const hatZeile = (dienst: string) => screen.queryByRole('rowheader', { name: dienst }) !== null;

describe('Filter-Menü: Dienste unter der Gruppe', () => {
  it('unter jeder Gruppe mit mehreren Diensten stehen ihre Dienste, mit eigenem Haken', () => {
    zeige();
    filter();
    for (const d of ['Ton', 'Bild', 'Licht']) expect(haken(`Technik: ${d}`).checked).toBe(true);
    // Musik hat nur einen Dienst – dort wäre die Unterliste doppelt.
    expect(screen.queryByRole('checkbox', { name: 'Musik: Gitarre' })).toBeNull();
    expect(haken('Technik').indeterminate).toBe(false);
  });

  it('einen Dienst abhaken: Gruppenhaken zeigt „teilweise“, die Zahl am Knopf zählt ihn, gemerkt wird die ID', () => {
    zeige();
    filter();
    fireEvent.click(haken('Technik: Bild'));
    expect(haken('Technik: Bild').checked).toBe(false);
    expect(haken('Technik').checked).toBe(true);
    expect(haken('Technik').indeterminate).toBe(true);
    expect(screen.getByRole('button', { name: 'Filter, 1 ausgeblendet' })).toBeTruthy();
    expect(gemerkt().ausgeblendeteDienste).toEqual([7]);
    expect(gemerkt().ausgeblendeteGruppen).toEqual([]);
  });

  it('Gruppe abhaken: alle ihre Dienste aus; Gruppe mit Strich antippen: alle wieder an', () => {
    zeige({ ausgeblendeteDienste: [7] });
    filter();
    expect(haken('Technik').indeterminate).toBe(true);
    fireEvent.click(haken('Technik'));
    expect(haken('Technik').indeterminate).toBe(false);
    expect(haken('Technik: Bild').checked).toBe(true);
    expect(gemerkt().ausgeblendeteDienste).toEqual([]);
    fireEvent.click(haken('Technik'));
    expect(haken('Technik').checked).toBe(false);
    for (const d of ['Ton', 'Bild', 'Licht']) expect(haken(`Technik: ${d}`).checked).toBe(false);
    expect(gemerkt().ausgeblendeteGruppen).toEqual(['3']);
  });

  it('alle Dienste einer Gruppe einzeln abgehakt = Gruppe aus', () => {
    zeige();
    filter();
    for (const d of ['Ton', 'Bild', 'Licht']) fireEvent.click(haken(`Technik: ${d}`));
    expect(haken('Technik').checked).toBe(false);
    expect(haken('Technik').indeterminate).toBe(false);
    expect(gemerkt().ausgeblendeteGruppen).toEqual(['3']);
    expect(screen.queryByRole('button', { name: /Technik/, expanded: true })).toBeNull();
  });
});

describe('Matrix', () => {
  it('ein ausgeblendeter Dienst hat keine Zeile; die anderen Dienste der Gruppe bleiben', () => {
    zeige({ ausgeblendeteDienste: [7] });
    expect(hatZeile('Bild')).toBe(false);
    expect(hatZeile('Ton')).toBe(true);
    expect(hatZeile('Licht')).toBe(true);
  });

  it('Termin-Kopf, Füllbalken und Gruppenzeile zählen nur gezeigte Dienste (dieselbe Quelle)', () => {
    // Alle: Bild 1 + Licht 1 frei = 2 von 5 Plätzen → „2 frei“, 60 % gefüllt.
    zeige();
    const kopf = () => screen.getAllByRole('columnheader')[1];
    const balken = () =>
      (kopf().querySelector('[aria-hidden="true"] > i') as HTMLElement).style.width;
    expect(kopf().textContent).toMatch(/2 frei$/);
    expect(balken()).toBe('60%');
    cleanup();
    // Ohne Bild: Ton, Licht, Gitarre = 3 Plätze, 1 frei → „1 frei“, 67 %.
    zeige({ ausgeblendeteDienste: [7] });
    expect(kopf().textContent).toMatch(/1 frei$/);
    expect(balken()).toBe('67%');
    const technik = screen.getByRole('button', { name: /Technik/ }).closest('tr')!;
    expect(within(technik).getAllByRole('cell')[0].textContent).toBe('1 frei');
  });

  it('Handy: der Zettel zählt ebenfalls ohne den Dienst', () => {
    zeige({ ausgeblendeteDienste: [7] }, {}, true);
    const chip = within(screen.getByRole('group', { name: 'Termine' })).getAllByRole('button')[0];
    expect(chip.textContent).toMatch(/1 frei$/);
    expect(screen.queryByText('Bild')).toBeNull();
    expect(screen.getByText('Licht')).toBeTruthy();
  });

  it('Lese-Toleranz: ein früher gemerkter Wert ohne das Feld blendet nichts aus; Unsinn fällt weg', () => {
    localStorage.setItem(ANSICHT, JSON.stringify({ ausgeblendeteGruppen: ['4'] }));
    expect(leseAnsicht().ausgeblendeteDienste).toEqual([]);
    localStorage.setItem(ANSICHT, JSON.stringify({ ausgeblendeteDienste: ['x', 7, null, 8] }));
    expect(leseAnsicht().ausgeblendeteDienste).toEqual([7, 8]);
    localStorage.setItem(ANSICHT, JSON.stringify({ ausgeblendeteDienste: 'Bild' }));
    expect(leseAnsicht().ausgeblendeteDienste).toEqual([]);
  });
});

describe('Ansicht „Personen“', () => {
  const raster = () => screen.findByRole('table', { name: 'Personen und ihre Einsätze' });

  it('kein Block für den ausgeblendeten Dienst; am selben Tag blass „+ Bild“ (ohne Gruppenzusatz)', async () => {
    zeige({ unteransicht: 'raster', ausgeblendeteDienste: [7] });
    const t = await raster();
    expect(within(t).queryByRole('button', { name: /^Bild/ })).toBeNull();
    expect(within(t).getByRole('button', { name: /^Ton/ })).toBeTruthy();
    const dazu = within(t).getByText('+ Bild');
    expect(dazu.title).toBe('Bild (ausgeblendet)');
    expect(dazu.closest('tr')!.textContent).toContain('Anna Test');
  });

  it('ist die ganze Gruppe aus, steht wie bisher „+ Ton (Technik)“', async () => {
    zeige({ unteransicht: 'raster', ausgeblendeteGruppen: ['4'] });
    const t = await raster();
    // Daniel (Gitarre, Musik) ist ausgeblendet; Anna in Ton und Bild unverändert „+ Bild“ bzw. „+ Ton“.
    expect(within(t).queryByText('Daniel Test')).toBeNull();
    cleanup();
    zeige({ unteransicht: 'raster', ausgeblendeteGruppen: ['3'] });
    const t2 = await raster();
    expect(within(t2).queryByText(/^\+ (Ton|Bild)/)).toBeNull();
  });

  it('„Noch offen“ zählt nur gezeigte Dienste', async () => {
    zeige({ unteransicht: 'raster' });
    let t = await raster();
    const fuss = (x: HTMLElement) => x.querySelector('tbody tr:last-child')!.textContent;
    expect(fuss(t)).toContain('Bild');
    cleanup();
    zeige({ unteransicht: 'raster', ausgeblendeteDienste: [7] });
    t = await raster();
    expect(fuss(t)).not.toContain('Bild');
    expect(fuss(t)).toContain('Licht');
  });

  it('Block zuklappen: nur der Kopf bleibt, „Noch offen“ zählt den Dienst weiter; ein zweiter Tipp klappt auf', async () => {
    zeige({ unteransicht: 'raster' });
    const t = await raster();
    const kopf = within(t).getByRole('button', { name: /^Bild/ });
    expect(kopf.getAttribute('aria-expanded')).toBe('true');
    expect(within(t).getAllByText('Anna Test')).toHaveLength(2); // Ton und Bild
    fireEvent.click(kopf);
    expect(kopf.getAttribute('aria-expanded')).toBe('false');
    expect(within(t).getAllByText('Anna Test')).toHaveLength(1);
    expect(t.querySelector('tbody tr:last-child')!.textContent).toContain('Bild');
    // Kein Ausblenden: Der Filter ist unberührt.
    expect(gemerkt().ausgeblendeteDienste ?? []).toEqual([]);
    fireEvent.click(kopf);
    expect(within(t).getAllByText('Anna Test')).toHaveLength(2);
  });
});

describe('„Wer wie oft?“', () => {
  it('zählt wie die Matrix: ohne den ausgeblendeten Dienst', async () => {
    zeige({ unteransicht: 'werWieOft' });
    expect((await screen.findAllByText('Anna Test'))[0].closest('tr')!.textContent).toMatch(
      /Ton.*Bild/,
    );
    cleanup();
    zeige({ unteransicht: 'werWieOft', ausgeblendeteDienste: [7] });
    const zeile = (await screen.findAllByText('Anna Test'))[0].closest('tr')!;
    expect(zeile.textContent).not.toContain('Bild');
    expect(zeile.textContent).toContain('Ton');
  });
});

describe('Besuch von der Startseite (Gruppe Technik)', () => {
  const hinweis = () => screen.findByRole('status', { name: 'Von der Startseite' });

  it('zeigt alle Dienste der Gruppe – der gemerkte Dienstfilter bleibt unverändert', async () => {
    zeige({ ausgeblendeteDienste: [7] }, { fokusGruppe: 3, onFokusEnde: () => {} });
    expect((await hinweis()).textContent).toMatch(/^Nur Technik/);
    expect(hatZeile('Bild')).toBe(true);
    // Eine andere Einstellung wird gemerkt, der Dienstfilter bleibt, wie er war.
    fireEvent.click(screen.getByRole('button', { name: 'Breite Spalten' }));
    expect(gemerkt().breite).toBe('breit');
    expect(gemerkt().ausgeblendeteDienste).toEqual([7]);
    expect(hatZeile('Bild')).toBe(true);
    expect((await hinweis()).textContent).toMatch(/^Nur Technik/);
  });

  it('einen Dienst im Filter abhaken: gilt nur für den Besuch („Eigene Auswahl“), gemerkt wird nichts', async () => {
    zeige({}, { fokusGruppe: 3, onFokusEnde: () => {} });
    await hinweis();
    filter();
    fireEvent.click(haken('Technik: Licht'));
    expect((await hinweis()).textContent).toMatch(/^Eigene Auswahl/);
    expect(hatZeile('Licht')).toBe(false);
    expect(gemerkt().ausgeblendeteDienste ?? []).toEqual([]);
  });
});
