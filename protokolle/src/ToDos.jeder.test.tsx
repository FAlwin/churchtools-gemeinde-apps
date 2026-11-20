// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { modusSetzen, neueAufgabe, teilSetzen, type Aufgabe } from '@shared/protokolle/aufgaben';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import * as L from './lesen';
import * as M from './mitglieder';
import { ToDos } from './ToDos';

/**
 * „Jeder für sich“ in der To-Do-Übersicht (W10, 20.11.2026): Ein Mitarbeiter sieht nur seinen Teil – Stand, Zähler und
 * Zuständige –, die Leitung das ganze To-Do. Die To-Dos kommen aus den echten Erzeugern (`modusSetzen`, `teilSetzen`).
 */
vi.mock('./lesen', async (orig) => ({
  ...(await orig<typeof import('./lesen')>()),
  ladeUebersicht: vi.fn(),
}));
vi.mock('./mitglieder', () => ({ ladeGruppenMitglieder: vi.fn() }));
vi.mock('./useToDoEinstellungen', async (orig) =>
  (await import('./ohneAbgleich.testutil')).ohneAbgleich(orig),
);

const LT: ProtokollGruppe = {
  id: 11,
  name: 'Leitungsteam',
  lage: 'eingerichtet',
  protokolle: 60,
  mitarbeit: 61,
};
const AM = '2026-11-20T08:00:00Z';
const BASIS = neueAufgabe({
  id: 'abw',
  gruppe: 11,
  sitzung: null,
  text: 'Abwesenheiten eintragen',
  wer: [1, 23, 24],
  von: 23,
  am: AM,
});
// Mein Teil (Person 1) ist fertig, die anderen nicht → Gesamtstand „in Arbeit“.
const MEIN_TEIL_FERTIG = teilSetzen(modusSetzen(BASIS, true, 23, AM), 1, true, 1, AM);
const ANDERE_FERTIG = teilSetzen(modusSetzen(BASIS, true, 23, AM), 23, true, 23, AM);

const zeige = (a: Aufgabe, schreibbar: number[]) => {
  vi.mocked(L.ladeUebersicht).mockResolvedValue([
    {
      gruppe: LT,
      sitzungen: {
        kommend: [],
        protokolle: [],
        teile: [],
        kalender: 4,
        treffenNichtFreigegeben: false,
        punkte: 'vorschlagen',
      },
      todoVorschlaege: [],
      aufgaben: [a],
    },
  ]);
  return render(
    <ToDos
      modul={24}
      ich={{ person: 1, name: 'Alwin' }}
      gruppen={[LT]}
      schreibbar={schreibbar}
      onSitzung={vi.fn()}
    />,
  );
};
const karte = () => screen.getByText('Abwesenheiten eintragen').closest('li, div[class]')!;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(M.ladeGruppenMitglieder).mockResolvedValue([
    { id: 1, name: 'Alwin Friesen', bild: null, initialen: 'AF' },
    { id: 23, name: 'Johann Becker', bild: null, initialen: 'JB' },
    { id: 24, name: 'Maria Klein', bild: null, initialen: 'MK' },
  ]);
});
afterEach(cleanup);

describe('To-Do-Übersicht: „Jeder für sich“ (W10)', () => {
  it('Voraussetzung: der Gesamtstand ist „in Arbeit“', () => {
    expect(MEIN_TEIL_FERTIG.status).toBe('arbeit');
    expect(ANDERE_FERTIG.status).toBe('arbeit');
  });

  it('Mitarbeiter, mein Teil fertig: steht unter „Erledigt“ – ohne Zähler, ohne andere Zuständige, „Von dir erledigt“', async () => {
    zeige(MEIN_TEIL_FERTIG, []);
    await screen.findByText('Abwesenheiten eintragen');
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/Von dir erledigt am/);
    expect(text).not.toMatch(/\d+\/\d+|von \d+ fertig|Alle fertig/);
    expect(text).not.toMatch(/Johann|Maria|in Arbeit/);
    expect(screen.queryByRole('img', { name: /Zuständig/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Wer ist fertig/ })).toBeNull();
    expect(karte().textContent).toMatch(/Abwesenheiten eintragen/);
  });

  it('Mitarbeiter, mein Teil offen (andere fertig): „Offen“ – nicht „In Arbeit“, kein Zähler', async () => {
    zeige(ANDERE_FERTIG, []);
    await screen.findByText('Abwesenheiten eintragen');
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/in Arbeit|\d+\/\d+|von \d+ fertig|Von dir erledigt/);
    expect(screen.queryByRole('img', { name: /Zuständig/ })).toBeNull();
  });

  it('Leitung: derselbe Stand ist „In Arbeit“, mit Zähler und Zuständigen', async () => {
    zeige(MEIN_TEIL_FERTIG, [60]);
    await screen.findByText('Abwesenheiten eintragen');
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/1\/3|1 von 3 fertig/);
    expect(screen.getAllByRole('img', { name: /Zuständig/ }).length).toBeGreaterThan(0);
  });

  it('der Haken nennt dem Mitarbeiter nur seinen Teil (kein „von 3 fertig“)', async () => {
    zeige(ANDERE_FERTIG, []);
    await screen.findByText('Abwesenheiten eintragen');
    const haken = screen.getAllByRole('button', { name: /Mein Teil/ });
    expect(haken.length).toBeGreaterThan(0);
    for (const h of haken) expect(h.getAttribute('aria-label')).not.toMatch(/von \d+ fertig/);
  });
});
