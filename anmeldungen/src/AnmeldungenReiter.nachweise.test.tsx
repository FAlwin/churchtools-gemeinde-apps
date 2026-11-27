// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AnmeldungenReiter } from './AnmeldungenReiter';
import { FELDER, PERSONEN, STICHTAG, dazu, e, mitglieder } from '@shared/anmeldung/liste.testdaten';
import { mitgliederstandAus } from '@shared/anmeldung/liste';
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import type { NachweisAblage } from '@shared/anmeldung/nachweisStandAblage';
import { ApiError } from '@ui/ct/fehler';
import * as A from './nachweisStandAblage';

vi.mock('./nachweisStandAblage', () => ({ nachweisAblageFuerLeitung: vi.fn() }));
vi.mock('./mitglieder', () => ({ gruppenfelderLaden: vi.fn() }));
vi.mock('./einrichten', async (original) => ({
  ...(await original<typeof import('./einrichten')>()),
  aendereEinstellungen: vi.fn().mockResolvedValue(undefined),
}));
const lesen = vi.mocked(A.nachweisAblageFuerLeitung);

/**
 * Die Nachweis-Spalte im Reiter „Anmeldungen“ (N3d, E24): alle Zustände in einer Veranstaltung, „lädt“, „nicht lesbar“,
 * vorübergehender Fehler mit „Nochmal“, Filter und Sortierung. AAAAAA Jonas 10 + Lena 11, BBBBBB Jonas 20 + Lena 21 (wartet),
 * CCCCCC 30 + 31; heute = Beginn der Veranstaltung (20.11.2026), letzter Tag der 22.11.
 */
const HEUTE = '2026-11-20';
const ART = 61;
const NAME = 'Führungszeugnis';
const einst: OeffentlicheEinstellungen = {
  ...e(),
  termin: { beginn: '2026-11-20T10:00', ende: '2026-11-22T12:00', ort: '', terminId: null },
  nachweise: [{ artGruppeId: ART, fuer: 'alle' }],
};
const ablage = (): NachweisAblage => ({
  art: 'gelesen',
  staende: new Map([
    [
      ART,
      new Map([
        [10, '2030-01-01'], // gültig
        [11, 'rot'], // fehlt
        // 20 fehlt im Stand: noch nicht angefordert · 21 wartet: nicht nötig
        [30, '2026-11-21'], // läuft vor Ende ab
        [31, '2026-11-21'],
      ]),
    ],
  ]),
  namen: new Map([[ART, NAME]]),
});
const mitAdresse = new Map([
  ...PERSONEN,
  ...[20, 21, 30, 31].map(
    (id) => [id, { ...PERSONEN.get(10)!, email: `p${id}@beispiel.test` }] as const,
  ),
]);
const drei = () =>
  ({
    art: 'fertig',
    stand: {
      ...mitgliederstandAus(
        [
          ...mitglieder('AAAAAA', [true, true], 10),
          ...mitglieder('BBBBBB', [true, false], 20),
          ...mitglieder('CCCCCC', [true, true], 30),
        ],
        [dazu(10, '2026-10-17'), dazu(20, '2026-10-18'), dazu(30, '2026-10-19')],
        FELDER,
        new Set([35]),
        mitAdresse,
      ),
      verlaufGekuerzt: false,
    },
  }) as const;

function zeigen(x: OeffentlicheEinstellungen = einst) {
  render(
    <AnmeldungenReiter
      id={165}
      veranstaltung="Mitarbeiterfreizeit"
      e={x}
      maxPlaetze={20}
      warteliste
      anmeldeschluss={null}
      entwurf={false}
      zustand={drei()}
      stichtag={STICHTAG}
      heute={HEUTE}
      darf
      zahlarten={['Bar']}
      onNeuLaden={vi.fn()}
      onGespeichert={vi.fn()}
    />,
  );
}
const jePerson = () => fireEvent.click(screen.getByRole('button', { name: 'Je Person' }));
const personenZeilen = () =>
  within(screen.getByRole('table', { name: 'Personen' }))
    .getAllByRole('row')
    .slice(1, -1);
/** Die Zelle der Nachweis-Spalte einer Zeile (die letzte vor der Summenzeile). */
const zelleVon = (zeile: HTMLElement) => within(zeile).getAllByRole('cell').at(-1)!;
const nummern = () =>
  within(screen.getByRole('table', { name: 'Anmeldungen' }))
    .getAllByRole('row')
    .map((r) => /[A-Z]{6}/.exec(r.textContent ?? '')?.[0])
    .filter(Boolean);

beforeEach(() => {
  lesen.mockReset();
});
afterEach(cleanup);

describe('Spalte „Führungszeugnis“ je Person', () => {
  it('alle Zustände in einer Veranstaltung – mit dem Namen der Art als Kopf und den Farben der Etiketten', async () => {
    lesen.mockResolvedValue(ablage());
    zeigen();
    jePerson();
    await waitFor(() =>
      expect(screen.getByRole('columnheader', { name: new RegExp(NAME) })).toBeTruthy(),
    );
    await screen.findByText('fehlt');
    const zellen = personenZeilen().map(zelleVon);
    expect(zellen.map((z) => z.textContent)).toEqual([
      'gültig bis 01/2030', // Jonas 10
      'fehlt', // Lena 11
      'noch nicht angefordert', // 20
      'nicht nötig', // 21 wartet
      'läuft vor Ende ab', // 30
      'läuft vor Ende ab', // 31
    ]);
    const ton = (z: HTMLElement) => z.querySelector('span')?.className ?? '';
    expect(ton(zellen[0])).toMatch(/gruen/);
    expect(ton(zellen[1])).toMatch(/rot/);
    expect(ton(zellen[2])).not.toMatch(/rot|blau|gruen/);
    expect(zellen[3].querySelector('span')).toBeNull(); // „nicht nötig“: leise, kein Etikett
    expect(ton(zellen[4])).toMatch(/blau/); // R9: „läuft ab“ ist blau
    expect(zellen[4].querySelector('span')?.getAttribute('title')).toBe('gültig bis 21.11.2026');
    // Nie das Ergebnis oder ein Datum der Einsicht.
    expect(document.body.textContent).not.toMatch(/Eintragung|Rücksprache|eingesehen/);
  });

  it('solange der Stand lädt: „…“, nicht „fehlt“', async () => {
    let fertig!: (a: NachweisAblage) => void;
    lesen.mockReturnValue(new Promise((r) => (fertig = r)));
    zeigen();
    jePerson();
    expect(personenZeilen().map((z) => zelleVon(z).textContent)).toEqual([
      '…',
      '…',
      '…',
      '…',
      '…',
      '…',
    ]);
    fertig(ablage());
    await screen.findByText('fehlt');
  });

  it('der Stand wird einmal für die eingeschalteten Arten gelesen (nicht je Zeile)', async () => {
    lesen.mockResolvedValue(ablage());
    zeigen();
    await screen.findByText('fehlt');
    expect(lesen).toHaveBeenCalledTimes(1);
    expect(lesen).toHaveBeenCalledWith([ART]);
  });

  it('ohne eingeschaltete Art: keine Spalte, kein Lesen', () => {
    zeigen({ ...einst, nachweise: undefined });
    jePerson();
    expect(screen.queryByRole('columnheader', { name: /Nachweis/ })).toBeNull();
    expect(lesen).not.toHaveBeenCalled();
  });
});

describe('nicht lesbar ist nicht leer', () => {
  it('ohne Recht (Ablage nicht lesbar): „Stand nicht lesbar“ für alle, die den Nachweis brauchen – nie „fehlt“', async () => {
    lesen.mockResolvedValue({ art: 'nichtLesbar' });
    zeigen();
    jePerson();
    await screen.findAllByText('Stand nicht lesbar');
    expect(personenZeilen().map((z) => zelleVon(z).textContent)).toEqual([
      'Stand nicht lesbar',
      'Stand nicht lesbar',
      'Stand nicht lesbar',
      'nicht nötig', // wartet
      'Stand nicht lesbar',
      'Stand nicht lesbar',
    ]);
    expect(screen.queryByText('fehlt')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('vorübergehender Fehler: dasselbe in den Zellen, dazu „Nochmal“ – und danach stimmen die Werte', async () => {
    lesen.mockRejectedValueOnce(new ApiError(503, 'weg')).mockResolvedValue(ablage());
    zeigen();
    jePerson();
    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toMatch(/konnte nicht gelesen werden/);
    expect(screen.queryByText('fehlt')).toBeNull();
    expect(zelleVon(personenZeilen()[1]).textContent).toBe('Stand nicht lesbar');
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Nochmal' }));
    await screen.findByText('fehlt');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(lesen).toHaveBeenCalledTimes(2);
  });
});

describe('je Anmeldung, Filter, Sortierung, Spaltenwahl', () => {
  it('je Anmeldung der schlechteste Wert ihrer Personen', async () => {
    lesen.mockResolvedValue(ablage());
    zeigen();
    await screen.findByText('fehlt');
    const zeilen = within(screen.getByRole('table', { name: 'Anmeldungen' }))
      .getAllByRole('row')
      .slice(1, -1);
    expect(zeilen.map((z) => zelleVon(z).textContent)).toEqual([
      'fehlt',
      'noch nicht angefordert',
      'läuft vor Ende ab',
    ]);
    // Als Etikett in der Farbe des Werts, nicht als bloßer Text.
    expect(zelleVon(zeilen[0]).querySelector('span')?.className).toMatch(/rot/);
    expect(zelleVon(zeilen[2]).querySelector('span')?.className).toMatch(/blau/);
  });

  it('der Trichter bietet die Werte mit Anzahl an; „fehlt“ lässt nur AAAAAA übrig, „n von m“ stimmt', async () => {
    lesen.mockResolvedValue(ablage());
    zeigen();
    await screen.findByText('fehlt');
    fireEvent.click(screen.getByRole('button', { name: `Nach „${NAME}“ filtern` }));
    const f = screen.getByRole('dialog', { name: new RegExp(`^${NAME}`) });
    for (const a of [
      'fehlt',
      'noch nicht angefordert',
      'läuft vor Ende ab',
      'gültig',
      'nicht nötig',
    ])
      expect(within(f).getByRole('checkbox', { name: `${a} (1)` })).toBeTruthy();
    expect(within(f).getByRole('checkbox', { name: 'abgelaufen (0)' })).toBeTruthy();
    fireEvent.click(within(f).getByRole('checkbox', { name: 'fehlt (1)' }));
    fireEvent.click(within(f).getByRole('button', { name: 'Anwenden' }));
    expect(nummern()).toEqual(['AAAAAA']);
    expect(screen.getByText('1 von 3')).toBeTruthy();
  });

  it('Sortieren nach der Spalte: erst was Aufmerksamkeit braucht, absteigend umgekehrt', async () => {
    lesen.mockResolvedValue(ablage());
    zeigen();
    await screen.findByText('fehlt');
    const kopf = () => screen.getByRole('columnheader', { name: new RegExp(NAME) });
    fireEvent.click(within(kopf()).getByRole('button', { name: NAME }));
    expect(nummern()).toEqual(['AAAAAA', 'BBBBBB', 'CCCCCC']);
    fireEvent.click(within(kopf()).getByRole('button', { name: NAME }));
    expect(nummern()).toEqual(['CCCCCC', 'BBBBBB', 'AAAAAA']);
  });

  it('die Spaltenwahl führt die Spalte unter dem Namen der Art – ein- und ausblendbar wie jede andere', async () => {
    lesen.mockResolvedValue(ablage());
    zeigen();
    await screen.findByText('fehlt');
    fireEvent.click(screen.getByRole('button', { name: 'Mehr zur Liste' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Spalten' }));
    const fenster = screen.getByRole('dialog', { name: /Spalten/ });
    expect(within(fenster).getAllByText(NAME).length).toBeGreaterThan(0);
  });
});
