// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { RohKandidat } from '@shared/dienstplan/werKann';
import type { PersonenAntworten } from '@shared/dienstplan/personenAntworten';
import { antwortBereinigt } from '@shared/dienstplan/verfuegbarkeit';
import { BEGLEITUNG, liste } from '@shared/dienstplan/personenliste.testutil';
import { WerKann, type FreierPlatz } from './WerKann';
import { ladeWerKann } from './ladeWerKann';

vi.mock('./ladeWerKann', () => ({ ladeWerKann: vi.fn(), vergissWerKann: vi.fn() }));
const laden = vi.mocked(ladeWerKann);
afterEach(() => {
  cleanup();
  laden.mockReset();
});

/** „Wer kann?“ mit der Personenliste der Dienstgruppe (PL-1): Reihenfolge, Überschrift, Kürzel, Pause. */
const PLATZ: FreierPlatz = {
  eventId: 166,
  serviceId: 6,
  dienst: 'Ton',
  termin: 'Gottesdienst',
  tag: 'So 08.11.',
  datum: '2026-11-08',
  uhrzeit: '10:00',
  monat: '2026-11',
  monatName: 'November',
  nr: 1,
  von: 2,
  schonDa: [],
  index: 1,
  gruppeId: 3,
};
const k = (id: number, name: string, o: Partial<RohKandidat> = {}): RohKandidat => ({
  person: { domainIdentifier: String(id), title: name },
  score: 0,
  ...o,
});
// Punkte bestimmen die bisherige Reihenfolge: Anna, Ben, Clara, Daniel.
const KANDIDATEN = [
  k(1, 'Anna', { score: 0 }),
  k(2, 'Ben', { score: -1 }),
  k(3, 'Clara', { score: -2 }),
  k(4, 'Daniel', { score: -3 }),
];
const zeige = (l?: Parameters<typeof liste>[0]) => {
  laden.mockResolvedValue(KANDIDATEN);
  return render(<WerKann platz={PLATZ} onClose={() => {}} personenliste={l ? liste(l) : null} />);
};
const einzeln = async () =>
  within(await screen.findByRole('list', { name: 'Wer kann?' }))
    .getAllByRole('listitem')
    .map((li) => li.querySelector('b')?.textContent);

describe('„Wer kann?“ mit Personenliste – eine Liste', () => {
  it('Reihenfolge der Liste, Überschrift sagt es', async () => {
    zeige({ reihe: [4, 2] });
    expect(await einzeln()).toEqual(['Daniel', 'Ben', 'Anna', 'Clara']);
    expect(
      screen.getByRole('heading', { name: 'Wer kann? In der Reihenfolge der Personenliste' }),
    ).toBeTruthy();
  });

  it('ohne Reihenfolge: wie bisher, auch mit Tags', async () => {
    zeige({ tags: [BEGLEITUNG] });
    expect(await einzeln()).toEqual(['Anna', 'Ben', 'Clara', 'Daniel']);
    expect(
      screen.getByRole('heading', { name: 'Wer kann? Oben: frei und selten dran' }),
    ).toBeTruthy();
  });

  it('Kürzel hinter dem Namen, der volle Name im Titel; nur im Dienst des Platzes', async () => {
    zeige({ tags: [BEGLEITUNG], tagsVon: { '6|2': ['b'], '7|1': ['b'] } });
    await einzeln();
    const kuerzel = screen.getByTitle('Begleitung');
    expect(kuerzel.textContent).toBe('B');
    expect(kuerzel.closest('li')?.querySelector('b')?.textContent).toBe('Ben');
    expect(screen.getAllByTitle('Begleitung')).toHaveLength(1); // Annas Tag gilt für Dienst 7, nicht für Ton
  });

  it('Pause: ans Ende, blass, „Pause bis …“ statt „frei“', async () => {
    zeige({ pause: { '1': { bis: '2026-11-08' }, '2': { bis: '2026-11-07' } } });
    expect(await einzeln()).toEqual(['Ben', 'Clara', 'Daniel', 'Anna']);
    const anna = screen.getByText('Anna').closest('li')!;
    expect(anna.textContent).toContain('Pause bis 08.11.26');
    expect(anna.innerHTML).toMatch(/blass/);
    // Bens Pause war am 07.11. zu Ende: ein ganz normaler Eintrag.
    expect(screen.getByText('Ben').closest('li')?.textContent).toContain('frei');
  });
});

describe('„Wer kann?“ mit Personenliste – Abschnitte', () => {
  const TERMIN = 166;
  const DATEN: PersonenAntworten = {
    jePerson: new Map([[1, { [TERMIN]: antwortBereinigt({ a: 'ja', tag: '2026-11-08' }) }]]),
    sichtbar: new Set([3]),
  };
  const namen = (titel: string) =>
    within(screen.getByRole('region', { name: titel }))
      .queryAllByRole('listitem')
      .map((li) => li.querySelector('b')?.textContent);

  it('sortiert jeden Abschnitt nach der Liste; wer pausiert, steht unter „Kann nicht“ – auch mit Ja', async () => {
    laden.mockResolvedValue(KANDIDATEN);
    render(
      <WerKann
        platz={PLATZ}
        onClose={() => {}}
        antworten={{ lader: () => Promise.resolve(DATEN), dienstName: () => undefined }}
        personenliste={liste({ reihe: [4, 3, 1], pause: { '1': {} } })}
      />,
    );
    await screen.findByRole('region', { name: 'Hat Ja gesagt' });
    expect(namen('Hat Ja gesagt')).toEqual([]);
    expect(namen('Keine Antwort')).toEqual(['Daniel', 'Clara', 'Ben']);
    fireEvent.click(screen.getByRole('button', { name: /Kann nicht \/ abwesend 1/ }));
    expect(namen('Kann nicht / abwesend')).toEqual(['Anna']);
    expect(
      screen.getByText(
        /In jedem Abschnitt stehen die Personen in der Reihenfolge der Personenliste/,
      ),
    ).toBeTruthy();
  });
});
