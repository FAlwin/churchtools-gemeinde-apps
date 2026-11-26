// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Absence, AbsenceEvent } from '@shared/types/index';
import type { AbwesenheitenDienst } from '@ui/abwesenheiten/ctDienst';
import { Abwesenheiten } from './Abwesenheiten';
import { ladeMeineDienste } from './ladeBeiwerk';
import { HANDY_BREITE } from '@ui/bedienung/useMedienAbfrage';

/**
 * **Die Werkzeugzeile von „Verfügbarkeit“** (R5/R12, E24, „Ruhige Bedienung“ B4): wer wo steht, am Rechner und am Handy –
 * links „Termine | Einträge“ mit Merker, in der Mitte der Zeitraum mit ‹ ›, rechts „Filter“ und der grüne Knopf „Zeitraum
 * eintragen“ (am Handy statt seiner das schwebende Plus). Die Wirkung der Dinge selbst (Haken, Speichern, Fenster) prüfen
 * die übrigen `Abwesenheiten.*.test.tsx`.
 */
const dienst = {
  meine: vi.fn<AbwesenheitenDienst['meine']>(),
  termine: vi.fn<AbwesenheitenDienst['termine']>(),
  gruende: vi.fn<AbwesenheitenDienst['gruende']>(),
  anlegen: vi.fn<AbwesenheitenDienst['anlegen']>(),
  aendern: vi.fn<AbwesenheitenDienst['aendern']>(),
  loeschen: vi.fn<AbwesenheitenDienst['loeschen']>(),
};
vi.mock('@ui/abwesenheiten/ctDienst', () => ({ abwesenheitenDienst: () => dienst }));
vi.mock('./ladeBeiwerk', () => ({ ladeMeineDienste: vi.fn() }));
const meineDienste = vi.mocked(ladeMeineDienste);

const HEUTE = '2026-11-04';
const ev = (id: number, name: string, tag: string): AbsenceEvent => ({
  id,
  name,
  date: tag,
  startDate: `${tag}T09:00:00Z`,
  endDate: `${tag}T10:30:00Z`,
});
const TERMINE = [
  ev(1, 'Gottesdienst', '2026-11-08'),
  ev(2, 'Gebetsabend', '2026-11-11'),
  ev(3, 'Gottesdienst', '2026-11-15'),
];
const EINTRAG: Absence = {
  id: 7,
  startDate: '2026-11-20',
  endDate: '2026-11-22',
  startTime: null,
  endTime: null,
  comment: '',
  reason: 'Urlaub',
  reasonId: 2,
  vonApp: false,
};

/** Handy: `matchMedia` antwortet für die Handy-Abfrage mit ja, sonst mit nein. */
function setzeHandy(an: boolean) {
  window.matchMedia = ((abfrage: string) => ({
    matches: an && abfrage === HANDY_BREITE,
    media: abfrage,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setzeHandy(false);
  dienst.meine.mockResolvedValue([EINTRAG]);
  dienst.termine.mockResolvedValue(TERMINE);
  dienst.gruende.mockResolvedValue([{ id: 1, name: 'Abwesend', standard: true }]);
  meineDienste.mockResolvedValue(new Map());
});
afterEach(() => {
  cleanup();
  // @ts-expect-error – zurück auf „kein matchMedia“, wie jsdom es kennt
  delete window.matchMedia;
});

const zeige = () =>
  render(<Abwesenheiten ichId={19} zeitzone="Europe/Berlin" heute={HEUTE} dienstgruppen={[]} />);
const zeile = async () => {
  await screen.findByText('Gebetsabend');
  return screen.getByRole('toolbar', { name: 'Werkzeuge' });
};
const zeitraumText = (z: HTMLElement) =>
  within(z)
    .getByRole('button', { name: /^Zeitraum: / })
    .getAttribute('aria-label');

describe('Verfügbarkeit – Werkzeugzeile am Rechner (B4)', () => {
  it('eine Zeile über der Karte: Ansicht · Zeitraum mit Pfeilen · Filter · grüner Knopf – in dieser Reihenfolge', async () => {
    zeige();
    const z = await zeile();
    const karte = screen.getByRole('region', { name: 'Verfügbarkeit' });
    expect(karte.contains(z)).toBe(false);
    expect(
      within(z)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label') ?? b.textContent),
    ).toEqual([
      'Termine',
      'Einträge, 1',
      'Zeitraum davor',
      expect.stringMatching(/^Zeitraum: /),
      'Zeitraum danach',
      'Filter',
      'Zeitraum eintragen',
    ]);
  });

  it('der Merker an „Einträge“ steht IN der Zeile des Wortes und zählt die anstehenden Einträge', async () => {
    zeige();
    const z = await zeile();
    const eintraege = within(z).getByRole('button', { name: 'Einträge, 1' });
    const merker = eintraege.querySelector('[data-zaehler]');
    expect(merker?.textContent).toBe('1');
    // Blau gefüllt – nicht das Rot der Alarm-Zähler.
    expect(merker?.className).toMatch(/blau/);
  });

  it('ohne Eintrag kein Merker – und das Wort bleibt „Einträge“', async () => {
    dienst.meine.mockResolvedValue([]);
    zeige();
    const z = await zeile();
    const eintraege = within(z).getByRole('button', { name: 'Einträge' });
    expect(eintraege.querySelector('[data-zaehler]')).toBeNull();
  });

  it('„Zeitraum eintragen“ ist der einzige gefüllte Knopf und öffnet das Fenster', async () => {
    zeige();
    const z = await zeile();
    const knopf = within(z).getByRole('button', { name: 'Zeitraum eintragen' });
    expect(knopf.className).toMatch(/neu/);
    for (const anderer of within(z).getAllByRole('button')) {
      if (anderer !== knopf) expect(anderer.className).not.toMatch(/neu|haupt/);
    }
    fireEvent.click(knopf);
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('‹ geht ab heute nicht (nichts Vergangenes), › zeigt die nächsten vier Wochen, danach geht ‹ zurück', async () => {
    zeige();
    const z = await zeile();
    expect(zeitraumText(z)).toMatch(/04\.11\. – 01\.12\.2026/);
    expect(within(z).getByRole('button', { name: 'Zeitraum davor' })).toHaveProperty(
      'disabled',
      true,
    );
    fireEvent.click(within(z).getByRole('button', { name: 'Zeitraum danach' }));
    expect(zeitraumText(z)).toMatch(/02\.12\. – 29\.12\.2026/);
    fireEvent.click(within(z).getByRole('button', { name: 'Zeitraum davor' }));
    expect(zeitraumText(z)).toMatch(/04\.11\. – 01\.12\.2026/);
  });

  it('in „Einträge“ gibt es weder Zeitraum noch Filter – der grüne Knopf bleibt', async () => {
    zeige();
    const z = await zeile();
    fireEvent.click(within(z).getByRole('button', { name: 'Einträge, 1' }));
    expect(within(z).queryByRole('group', { name: 'Zeitraum' })).toBeNull();
    expect(within(z).queryByRole('button', { name: /^Filter/ })).toBeNull();
    expect(within(z).getByRole('button', { name: 'Zeitraum eintragen' })).toBeTruthy();
    // Zurück: Zeitraum und Filter sind wieder da.
    fireEvent.click(within(z).getByRole('button', { name: 'Termine' }));
    expect(within(z).getByRole('group', { name: 'Zeitraum' })).toBeTruthy();
    expect(within(z).getByRole('button', { name: /^Filter/ })).toBeTruthy();
  });

  it('der Filter hat das Wort „Filter“ und bietet die Veranstaltungen (Gottesdienst kommt zweimal vor)', async () => {
    zeige();
    const z = await zeile();
    const filter = within(z).getByRole('button', { name: 'Filter' });
    expect(filter.textContent).toMatch(/Filter/);
    fireEvent.click(filter);
    const fenster = screen.getByRole('dialog', { name: 'Filter' });
    expect(within(fenster).getByRole('checkbox', { name: 'Gottesdienst' })).toBeTruthy();
  });
});

describe('Verfügbarkeit – Werkzeugzeile am Handy (B4, R12)', () => {
  beforeEach(() => setzeHandy(true));

  it('die Ansicht ist ein Knopf mit Blatt; „Einträge“ trägt dort die Zahl in Klammern', async () => {
    zeige();
    const z = await zeile();
    expect(within(z).queryByRole('group', { name: 'Ansicht' })).toBeNull();
    fireEvent.click(within(z).getByRole('button', { name: 'Ansicht: Termine' }));
    const blatt = screen.getByRole('dialog', { name: 'Ansicht' });
    fireEvent.click(within(blatt).getByRole('button', { name: 'Einträge (1)' }));
    expect(screen.queryByRole('dialog', { name: 'Ansicht' })).toBeNull();
    expect(within(z).getByRole('button', { name: 'Ansicht: Einträge' })).toBeTruthy();
  });

  it('statt des grünen Knopfs das schwebende Plus – es steht nicht in der Zeile; Pfeile erst bei gewähltem Zeitraum', async () => {
    zeige();
    const z = await zeile();
    expect(within(z).queryByRole('button', { name: 'Zeitraum eintragen' })).toBeNull();
    const plus = screen.getByRole('button', { name: 'Zeitraum eintragen' });
    fireEvent.click(plus);
    expect(await screen.findByRole('dialog')).toBeTruthy();
    // „Ab heute“: kein ‹ › am Handy (wie in „Planen“) – dort blättert man mit den Terminen selbst.
    expect(within(z).queryByRole('button', { name: 'Zeitraum davor' })).toBeNull();
  });

  /**
   * **B8a, 20.11.2026:** Die Karte hat `overflow: hidden`; was darin klebt (`position: sticky`), klebt am Kartenende statt am
   * unteren Rand des Bildschirms – das Plus stand bei 844 px Höhe auf y≈1000. Weder das Plus noch die Speichern-Leiste
   * dürfen deshalb in der Karte hängen.
   */
  it('Plus und Speichern-Leiste hängen nicht in der Karte mit `overflow: hidden`', async () => {
    setzeHandy(true);
    zeige();
    await zeile();
    const karte = screen.getByRole('region', { name: 'Verfügbarkeit' });
    expect(karte.contains(screen.getByRole('button', { name: 'Zeitraum eintragen' }))).toBe(false);
    // Etwas vormerken → die Speichern-Leiste erscheint, und auch sie steht außerhalb der Karte.
    fireEvent.click(screen.getByRole('button', { name: /Nein – Gottesdienst, So, 08\.11\./ }));
    const speichern = await screen.findByRole('button', { name: 'Speichern' });
    expect(karte.contains(speichern)).toBe(false);
  });

  it('der Filter bleibt erreichbar', async () => {
    zeige();
    const z = await zeile();
    fireEvent.click(within(z).getByRole('button', { name: 'Filter' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Filter' })).toBeTruthy());
  });
});
