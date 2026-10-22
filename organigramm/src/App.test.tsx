// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { baumAus, elternAus, type OrgGruppe } from '@shared/organigramm/gruppen';
import { App } from './App';
import { ladeStart, type Start } from './start';

vi.mock('./start', () => ({ ladeStart: vi.fn() }));
const laden = vi.mocked(ladeStart);

const g = (id: number, name: string, farbe: string | null = null): OrgGruppe => ({
  id,
  name,
  typId: 2,
  statusId: 1,
  farbe,
});
const GRUPPEN = [
  g(10, 'Gottesdienst'),
  g(7, 'Technik'),
  g(12, 'Stream', 'gray'),
  g(47, 'Café Team'),
];

function start(verwalten: boolean, gruppen = GRUPPEN): Start {
  return {
    ichId: 1,
    vorname: 'Alwin',
    gemeinde: 'Evangeliumschristen- Gemeinde e.V.',
    gruppen,
    baum: baumAus(
      gruppen,
      elternAus([
        { groupId: 10, children: [7] },
        { groupId: 7, children: [12] },
      ]),
    ),
    typFarben: new Map([[2, 'lime']]),
    rechte: { gruppenVerwalten: verwalten, anlegbareTypen: [], bearbeitbareGruppen: [] },
  };
}

const karte = (name: string) => within(screen.getByRole('region', { name }));

describe('App des Organigramms (O1)', () => {
  it('Gruß, Gemeinde und die Bereiche mit der Zahl der Gruppen darunter', async () => {
    laden.mockResolvedValue(start(true));
    render(<App />);
    expect(await screen.findByText('Hallo Alwin')).toBeTruthy();
    expect(screen.getByText(/Organigramm · Evangeliumschristen- Gemeinde e\.V\./)).toBeTruthy();
    expect(screen.getByText('4 Gruppen insgesamt')).toBeTruthy();
    expect(
      karte('Bereiche')
        .getAllByRole('listitem')
        .map((z) => z.textContent),
    ).toEqual(['CCafé Teamkeine Untergruppen', 'GGottesdienst2 Gruppen darunter']);
  });

  it('Kachel in der Farbe der Gruppe – eigene Farbe vor Typ (Stream grau, Rest lime)', async () => {
    const nurStream = [g(12, 'Stream', 'gray'), g(47, 'Café Team')];
    laden.mockResolvedValue({ ...start(true, nurStream), baum: baumAus(nurStream, new Map()) });
    render(<App />);
    await screen.findByText('Hallo Alwin');
    const kacheln = karte('Bereiche')
      .getAllByRole('listitem')
      .map((z) => (z.firstElementChild as HTMLElement).style.background);
    expect(kacheln).toEqual(['rgb(124, 207, 0)', 'rgb(106, 114, 130)']);
  });

  it('ohne Gruppen-Admin-Recht → sagt, dass nur Gruppen-Admins ändern', async () => {
    laden.mockResolvedValue(start(false));
    render(<App />);
    expect(await screen.findByText(/Ändern dürfen nur Gruppen-Admins/)).toBeTruthy();
  });

  it('keine sichtbare Gruppe → sagt es, statt eine leere Karte zu zeigen', async () => {
    laden.mockResolvedValue({ ...start(true, []), baum: [] });
    render(<App />);
    expect(await screen.findByText('Du siehst in ChurchTools keine Gruppe.')).toBeTruthy();
  });

  it('vorübergehender Fehler → „Erneut versuchen“ lädt neu', async () => {
    laden.mockRejectedValueOnce(new ApiError(502, 'x')).mockResolvedValueOnce(start(true));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByText('Hallo Alwin')).toBeTruthy();
    expect(laden).toHaveBeenCalledTimes(2);
  });

  it('abgemeldet (401) → Hinweis ohne „Erneut versuchen“', async () => {
    laden.mockRejectedValue(new ApiError(401, 'x'));
    render(<App />);
    expect(await screen.findByText(/nicht mehr angemeldet/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Erneut versuchen' })).toBeNull();
  });
});
