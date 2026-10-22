// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { baumAus, elternAus, type OrgGruppe } from '@shared/organigramm/gruppen';
import { rollenAus } from '@shared/organigramm/mitglieder';
import { diensteAus } from '@shared/ct/dienste';
import { App } from './App';
import { ladeStart, type Start } from './start';
import { fehlendeNachladen, ladeMitglieder, type MitgliederDaten } from './ladeMitglieder';

vi.mock('./start', () => ({ ladeStart: vi.fn() }));
vi.mock('./ladeMitglieder', () => ({ ladeMitglieder: vi.fn(), fehlendeNachladen: vi.fn() }));
const laden = vi.mocked(ladeStart);
const mitgliederLaden = vi.mocked(ladeMitglieder);
const nachladen = vi.mocked(fehlendeNachladen);

const g = (id: number, name: string, typId = 2, farbe: string | null = null): OrgGruppe => ({
  id,
  name,
  typId,
  statusId: 1,
  farbe,
});
// Gottesdienst (10) → Technik (7) → Stream (12); Café (47); Verteiler „Infos“ (34, Typ 9)
const GRUPPEN = [
  g(10, 'Gottesdienst'),
  g(7, 'Technik'),
  g(12, 'Stream', 2, 'gray'),
  g(47, 'Café'),
  g(34, 'Infos', 9),
];
const ELTERN = elternAus([
  { groupId: 10, children: [7] },
  { groupId: 7, children: [12] },
]);

function start(): Start {
  return {
    ichId: 1,
    vorname: 'Alwin',
    gemeinde: 'ECG',
    gruppen: GRUPPEN,
    baum: baumAus(GRUPPEN, ELTERN),
    eltern: ELTERN,
    typFarben: new Map([
      [2, 'lime'],
      [9, 'teal'],
    ]),
    typNamen: new Map([
      [2, 'Dienst'],
      [9, 'Verteiler'],
    ]),
    rollen: rollenAus([
      { id: 15, name: 'Mitarbeiter', isLeader: false, sortKey: 0 },
      { id: 16, name: 'Leiter', isLeader: true, sortKey: 1 },
      { id: 17, name: 'Co-Leiter', isLeader: true, sortKey: 2 },
    ]),
    dienste: diensteAus([{ id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [7] }]),
    rechte: { gruppenVerwalten: true, anlegbareTypen: [], bearbeitbareGruppen: [] },
  };
}

const p = (id: number, name: string) => [id, { id, name, bild: null, initialen: name[0] }] as const;
const MITGLIEDER: MitgliederDaten = {
  je: new Map([
    [
      10,
      {
        art: 'sichtbar',
        mitglieder: [
          { personId: 2, rolleId: 15 },
          { personId: 1, rolleId: 16 },
        ],
      },
    ],
    [
      7,
      {
        art: 'sichtbar',
        mitglieder: [
          { personId: 3, rolleId: 15 },
          { personId: 4, rolleId: 17 },
          { personId: 1, rolleId: 16 },
        ],
      },
    ],
    [12, { art: 'verborgen' }],
    [47, { art: 'fehler' }],
    [34, { art: 'sichtbar', mitglieder: [] }],
  ]),
  personen: new Map([
    p(1, 'Alwin Friesen'),
    p(2, 'Bea Berg'),
    p(3, 'Carl Clau'),
    p(4, 'Dora Dorn'),
  ]),
};

const zeile = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

beforeEach(() => {
  localStorage.clear();
  laden.mockResolvedValue(start());
  mitgliederLaden.mockResolvedValue(MITGLIEDER);
});

describe('App des Organigramms (O2)', () => {
  it('Bereiche als Karten, Untergruppen als Zeilen – mit Personen, Leitung und Diensten', async () => {
    render(<App />);
    const gd = within(await screen.findByRole('region', { name: 'Gottesdienst' }));
    // Große Bereiche zuerst (die meisten Gruppen darunter), dann nach Name – nicht einfach alphabetisch
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Gottesdienst',
      'Café',
      'Infos',
    ]);
    // Kopf: Gruppen darunter, Personen im ganzen Bereich (jede einmal), Leitung der Gruppe selbst
    expect(await gd.findByText('1 Gruppe · 4 Personen · Leitung: Alwin Friesen')).toBeTruthy();
    // Technik: Leiter vor Co-Leiter (Reihenfolge aus ChurchTools), Dienst als Schildchen
    expect(gd.getByText('3 Personen · Leitung: Alwin Friesen, Dora Dorn')).toBeTruthy();
    expect(gd.getByText('Ton')).toBeTruthy();
    // Stream: kein Leserecht → bleibt im Baum, ohne Namen
    expect(gd.getByText('Mitglieder nicht sichtbar')).toBeTruthy();
  });

  it('vorübergehender Fehler bei einer Gruppe → dort gesagt und „Erneut versuchen“ lädt nur nach', async () => {
    nachladen.mockResolvedValue(MITGLIEDER);
    render(<App />);
    // Café ist ein Bereich: sein Kopf sagt es selbst (nicht nur der Hinweis oben)
    const cafe = within(await screen.findByRole('region', { name: 'Café' }));
    expect(cafe.getByText('Mitglieder gerade nicht ladbar')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(nachladen).toHaveBeenCalledWith(MITGLIEDER);
    expect(laden).toHaveBeenCalledTimes(1);
  });

  it('Bereich MIT Untergruppen, selbst nicht lesbar → sein Kopf sagt es (nicht nur Zahlen der Untergruppen)', async () => {
    mitgliederLaden.mockResolvedValue({
      ...MITGLIEDER,
      je: new Map([...MITGLIEDER.je, [10, { art: 'verborgen' }]]),
    });
    render(<App />);
    const kopf = within(await screen.findByRole('region', { name: 'Gottesdienst' })).getAllByRole(
      'button',
    )[0];
    expect(kopf.textContent).toContain('1 Gruppe');
    expect(kopf.textContent).toContain('Mitglieder nicht sichtbar');
  });

  it('Gruppentyp ausblenden – samt Merken im Gerät', async () => {
    render(<App />);
    expect(await screen.findByRole('region', { name: 'Infos' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Verteiler/ }));
    expect(screen.queryByRole('region', { name: 'Infos' })).toBeNull();
    expect(localStorage.getItem('organigramm-ausgeblendete-typen')).toBe('[9]');
  });

  it('Gruppenfenster: Rollen in ChurchTools-Reihenfolge, Ober-/Untergruppen zum Weiterklicken, Link nach ChurchTools', async () => {
    render(<App />);
    await screen.findByText('3 Personen · Leitung: Alwin Friesen, Dora Dorn');
    fireEvent.click(zeile('Technik'));
    expect(screen.getByRole('region', { name: 'Leiter' }).textContent).toContain('Alwin Friesen');
    expect(screen.getByRole('region', { name: 'Co-Leiter' }).textContent).toContain('Dora Dorn');
    const titel = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titel.slice(0, 3)).toEqual(['Leiter · 1', 'Co-Leiter · 1', 'Mitarbeiter · 1']);
    // Dienste der Gruppe im Fenster (die Zeile im Baum zeigt „Ton“ ebenfalls)
    expect(screen.getByText('Dienste aus dieser Gruppe').parentElement?.textContent).toContain(
      'Ton',
    );
    expect(
      screen.getByRole('link', { name: 'In ChurchTools öffnen' }).getAttribute('href'),
    ).toMatch(/\/groups\/7\/dashboard$/);
    // weiter zur Untergruppe
    fireEvent.click(screen.getByRole('button', { name: 'Stream' }));
    expect(
      screen.getByText('Die Mitglieder dieser Gruppe darfst du in ChurchTools nicht sehen.'),
    ).toBeTruthy();
  });

  it('solange Mitglieder laden, steht der Baum schon', async () => {
    mitgliederLaden.mockReturnValue(new Promise(() => {}));
    render(<App />);
    expect((await screen.findAllByText('Mitglieder werden geladen …')).length).toBeGreaterThan(0);
  });

  it('abgemeldet beim Laden der Mitglieder → Hinweis statt halbem Baum', async () => {
    mitgliederLaden.mockRejectedValue(new ApiError(401, 'x'));
    render(<App />);
    expect(await screen.findByText(/nicht mehr angemeldet/)).toBeTruthy();
  });

  it('Start scheitert vorübergehend → „Erneut versuchen“ lädt neu', async () => {
    laden.mockRejectedValueOnce(new ApiError(502, 'x')).mockResolvedValueOnce(start());
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByText('Hallo Alwin')).toBeTruthy();
    expect(laden).toHaveBeenCalledTimes(2);
  });
});
