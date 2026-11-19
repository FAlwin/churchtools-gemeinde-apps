// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  modusSetzen,
  neueAufgabe,
  statusSetzen,
  teilSetzen,
  type Aufgabe,
} from '@shared/protokolle/aufgaben';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import * as L from './lesen';
import * as M from './mitglieder';
import * as S from './aufgabenSchreiben';
import { HALTEN_MS, ToDos } from './ToDos';

/**
 * Der Haken in der To-Do-Übersicht (W8a): abhaken, „Rückgängig“ an der Karte (5 s, Fake-Timer – mit echten Zeiten erledigte
 * der Timer die Arbeit, die der Test dem Haken zuschreibt), „Jeder für sich“ (mein Teil, nur Anzeige für Nicht-Zuständige).
 */
vi.mock('./lesen', async (orig) => ({
  ...(await orig<typeof import('./lesen')>()),
  ladeUebersicht: vi.fn(),
}));
vi.mock('./mitglieder', () => ({ ladeGruppenMitglieder: vi.fn() }));
vi.mock('./useToDoEinstellungen', async (orig) =>
  (await import('./ohneAbgleich.testutil')).ohneAbgleich(orig),
);
vi.mock('./aufgabenSchreiben', async (orig) => ({
  ...(await orig<typeof import('./aufgabenSchreiben')>()),
  aufgabeAendern: vi.fn(),
}));

const LT: ProtokollGruppe = {
  id: 11,
  name: 'Leitungsteam',
  lage: 'eingerichtet',
  protokolle: 60,
  mitarbeit: 61,
};
const AM = '2026-11-19T08:00:00Z';
const aufgabe = (id: string, t: Partial<Aufgabe> = {}): Aufgabe => ({
  ...neueAufgabe({ id, gruppe: 11, sitzung: null, text: id, wer: [1], von: 1, am: AM }),
  ...t,
});
const EINZEL = aufgabe('Raum prüfen');
const JEDER = modusSetzen(aufgabe('Abwesenheiten eintragen', { wer: [1, 23, 19] }), true, 1, AM);
const FREMD_JEDER = modusSetzen(aufgabe('Plakate drucken', { wer: [23, 19] }), true, 1, AM);

const aufgaben = (...l: Aufgabe[]) =>
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
      aufgaben: l,
    },
  ]);
const zeige = () =>
  render(
    <ToDos
      modul={24}
      ich={{ person: 1, name: 'Alwin' }}
      gruppen={[LT]}
      schreibbar={[60]}
      onSitzung={vi.fn()}
    />,
  );
const gruppe = (n: string) => screen.getByRole('group', { name: n });
const zeile = (t: string) => screen.getByText(t).closest('li')!;
/** Zeit vorrücken, ohne dass etwas anderes (Promises) hängen bleibt. */
const vor = (ms: number) =>
  act(async () => {
    await Promise.resolve();
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.mocked(M.ladeGruppenMitglieder).mockResolvedValue([
    { id: 1, name: 'Alwin Friesen', bild: null, initialen: 'AF' },
    { id: 23, name: 'Johann Becker', bild: null, initialen: 'JB' },
    { id: 19, name: 'Spike Müller', bild: null, initialen: 'SM' },
  ]);
  // Wie ChurchTools: die Änderung wird auf den „frisch gelesenen“ Stand (hier: den, den die Seite zeigt) angewendet.
  const stand = new Map<string, Aufgabe>();
  vi.mocked(S.aufgabeAendern).mockImplementation((_o, id, aendern) => {
    const neu = aendern(stand.get(id) ?? [EINZEL, JEDER, FREMD_JEDER].find((a) => a.id === id)!);
    stand.set(id, neu);
    return Promise.resolve(neu);
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Haken in der To-Do-Übersicht (W8a)', () => {
  it('abhaken: die Karte bleibt 5 s an ihrem Platz (durchgestrichen, „Rückgängig“ an der Karte), dann rutscht sie zu „Erledigt“', async () => {
    aufgaben(EINZEL);
    zeige();
    await screen.findByText('Raum prüfen');
    expect(HALTEN_MS).toBe(5000); // „5 Sekunden“ ist die abgenommene Vorgabe (Entwurf v1/v2)
    fireEvent.click(within(zeile('Raum prüfen')).getByRole('button', { name: /Status: offen/ }));
    await waitFor(() =>
      expect(within(zeile('Raum prüfen')).getByRole('button', { name: 'Rückgängig' })).toBeTruthy(),
    );
    expect(within(gruppe('Offen')).getByText('Raum prüfen')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Erledigt' })).toBeNull();
    // Kurz vor Ablauf: noch da.
    await vor(HALTEN_MS - 100);
    expect(within(gruppe('Offen')).getByText('Raum prüfen')).toBeTruthy();
    await vor(200);
    await waitFor(() => expect(within(gruppe('Erledigt')).getByText('Raum prüfen')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeNull();
  });

  it('„Rückgängig“ schreibt den alten Status zurück; die Karte bleibt, wo sie war, und der Timer wirkt nicht mehr nach', async () => {
    const inArbeit = statusSetzen(EINZEL, 'arbeit', 1, AM);
    aufgaben(inArbeit);
    zeige();
    await screen.findByText('Raum prüfen');
    fireEvent.click(
      within(zeile('Raum prüfen')).getByRole('button', { name: /Status: in Arbeit/ }),
    );
    await screen.findByRole('button', { name: 'Rückgängig' });
    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig' }));
    await waitFor(() => expect(S.aufgabeAendern).toHaveBeenCalledTimes(2));
    // Der zweite Schreibaufruf stellt „in Arbeit“ wieder her (nicht „offen“) – auf den frisch gelesenen Stand angewendet.
    const [, , aendern] = vi.mocked(S.aufgabeAendern).mock.calls[1];
    expect(aendern(statusSetzen(inArbeit, 'erledigt', 1, AM)).status).toBe('arbeit');
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeNull();
    await vor(HALTEN_MS * 2);
    expect(within(gruppe('In Arbeit')).getByText('Raum prüfen')).toBeTruthy();
  });

  it('erledigt → Haken weg: wieder offen, ohne „Rückgängig“', async () => {
    aufgaben(statusSetzen(EINZEL, 'erledigt', 1, AM));
    zeige();
    await screen.findByText('Raum prüfen');
    fireEvent.click(within(zeile('Raum prüfen')).getByRole('button', { name: /Status: erledigt/ }));
    await waitFor(() => expect(S.aufgabeAendern).toHaveBeenCalled());
    const [, , aendern] = vi.mocked(S.aufgabeAendern).mock.calls[0];
    expect(aendern(statusSetzen(EINZEL, 'erledigt', 1, AM)).status).toBe('offen');
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeNull();
  });

  it('scheitert das Schreiben: kein „Rückgängig“ (es ist nichts erledigt)', async () => {
    aufgaben(EINZEL);
    vi.mocked(S.aufgabeAendern).mockRejectedValue(new Error('weg'));
    zeige();
    await screen.findByText('Raum prüfen');
    fireEvent.click(within(zeile('Raum prüfen')).getByRole('button', { name: /Status: offen/ }));
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeNull();
    expect(within(gruppe('Offen')).getByText('Raum prüfen')).toBeTruthy();
  });

  it('„Jeder für sich“, ich bin zuständig: der Haken ist mein Teil (2/3 sichtbar), die Karte bleibt in ihrem Bereich', async () => {
    const zwei = teilSetzen(JEDER, 23, true, 23, AM);
    aufgaben(zwei);
    zeige();
    await screen.findByText('Abwesenheiten eintragen');
    const knopf = within(zeile('Abwesenheiten eintragen')).getByRole('button', {
      name: /mein Teil/,
    });
    expect(knopf.getAttribute('aria-label')).toMatch(/1 von 3 fertig/);
    fireEvent.click(knopf);
    await waitFor(() => expect(S.aufgabeAendern).toHaveBeenCalled());
    const [, , aendern] = vi.mocked(S.aufgabeAendern).mock.calls[0];
    const nachher = aendern(zwei);
    expect(nachher.fertig).toHaveProperty('1');
    expect(nachher.fertig).toHaveProperty('23');
    expect(nachher.status).toBe('arbeit');
    await screen.findByRole('button', { name: 'Rückgängig' });
    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig' }));
    await waitFor(() => expect(S.aufgabeAendern).toHaveBeenCalledTimes(2));
    const [, , zurueck] = vi.mocked(S.aufgabeAendern).mock.calls[1];
    expect(zurueck(nachher).fertig).not.toHaveProperty('1');
    expect(zurueck(nachher).fertig).toHaveProperty('23'); // der Teil des anderen bleibt
  });

  it('„Jeder für sich“, ich bin nicht zuständig: kein Haken, nur der Fortschritt', async () => {
    aufgaben(FREMD_JEDER);
    zeige();
    await screen.findByText('Plakate drucken');
    const z = zeile('Plakate drucken');
    expect(within(z).queryByRole('button', { name: /Status|mein Teil/ })).toBeNull();
    expect(within(z).getByRole('img', { name: /0 von 2 fertig/ })).toBeTruthy();
    expect(z.textContent).toMatch(/0\/2/);
  });
});
