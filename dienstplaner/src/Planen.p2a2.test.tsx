// @vitest-environment jsdom
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { planAus } from '@shared/dienstplan/plan';
import type { Entwurf, EntwurfErgebnis } from '@shared/dienstplan/entwuerfe';
import type { RohTermin } from '@shared/dienstplan/termine';
import type { GruppenStand, PersonenDaten } from '@shared/dienstplan/personenDaten';
import { abwesenheitenAus } from '@shared/dienstplan/personenDaten';
import { ALWIN, daten, entwurf, nachgebaut } from './entwurfAnschluss.testutil';
import type { EntwuerfeDaten } from './ladeEntwuerfe';
import { Planen } from './Planen';
import { ganzSichtbar, planbar } from './start';
import { startFuer } from './start.testutil';

/**
 * **P2a-2:** Entwürfe zählen mit (Matrix und „Personen“) und abgesagte Termine nehmen keine Einträge an. Echter Plan,
 * echte Ansichten – nur ChurchTools ist nachgebaut. Die Rechnung prüft `shared/dienstplan/platzNachEntwurf.test.ts`.
 *
 * Wie `Planen.p2a.test.tsx`, dazu So 06.12. (abgesagt): Ton 2 frei.
 */
const START = startFuer();
const p = (
  serviceId: number,
  personId: number | null,
  name: string | null,
  zu: boolean,
  index: number,
) => ({
  serviceId,
  personId,
  name,
  isAccepted: zu,
  index,
});
const ROH = [
  {
    id: 20,
    name: 'Gottesdienst',
    startDate: '2026-11-20T18:00:00Z',
    endDate: '2026-11-20T19:30:00Z',
    eventServices: [
      p(6, 5, 'Anna Test', true, 1),
      p(6, null, null, true, 2),
      p(9, 12, 'Daniel Test', true, 1),
    ],
  },
  {
    id: 21,
    name: 'Gottesdienst',
    startDate: '2026-11-22T09:00:00Z',
    endDate: '2026-11-22T10:30:00Z',
    eventServices: [p(6, null, null, true, 1), p(6, null, null, true, 2)],
  },
  {
    id: 22,
    name: 'Gottesdienst',
    startDate: '2026-11-29T09:00:00Z',
    endDate: '2026-11-29T10:30:00Z',
    eventServices: [
      p(6, null, null, true, 1),
      p(6, null, null, true, 2),
      p(9, 11, 'Carla Test', false, 1),
    ],
  },
  {
    id: 23,
    name: 'Gottesdienst',
    startDate: '2026-12-02T17:00:00Z',
    endDate: '2026-12-02T18:30:00Z',
    eventServices: [p(6, 5, 'Anna Test', true, 1), p(6, 8, 'Ben Test', true, 2)],
  },
  {
    id: 24,
    name: 'Gottesdienst',
    startDate: '2026-12-06T09:00:00Z',
    endDate: '2026-12-06T10:30:00Z',
    isCanceled: true,
    eventServices: [p(6, null, null, true, 1), p(6, null, null, true, 2)],
  },
] as RohTermin[];
const PLAN = planAus(ROH, {
  ichId: START.ichId,
  dienste: START.dienste,
  dienstgruppen: START.dienstgruppen,
  zeitzone: 'Europe/Berlin',
  planbar: (d) => planbar(START, d),
  ganzSichtbar: (d) => ganzSichtbar(START, d),
});

const person = (id: number, name: string) => ({
  id,
  name,
  bild: null,
  initialen: name.slice(0, 2),
});
const ANNA = person(5, 'Anna Test');
const BEN = person(8, 'Ben Test');
const CARLA = person(11, 'Carla Test');
const DANIEL = person(12, 'Daniel Test');
const da = (
  mitglieder: ReturnType<typeof person>[],
  abwesenheiten: Extract<GruppenStand, { art: 'da' }>['abwesenheiten'] = [],
): GruppenStand => ({ art: 'da', mitglieder, abwesenheiten });
const STAND: PersonenDaten = new Map<number, GruppenStand>([
  [
    7,
    da(
      [ANNA, BEN, CARLA, DANIEL],
      abwesenheitenAus([
        {
          id: 1,
          person: { domainIdentifier: '8' },
          absenceReason: { nameTranslated: 'Krank' },
          startDate: '2026-11-22',
          endDate: '2026-11-22',
        },
        {
          id: 2,
          person: { domainIdentifier: '11' },
          absenceReason: { nameTranslated: 'Urlaub' },
          startDate: '2026-11-28',
          endDate: '2026-11-30',
        },
      ]),
    ),
  ],
  [9, da([CARLA, DANIEL])],
]);

/** Speichern, das klappt – der Entwurf kommt mit `von` zurück wie von ChurchTools. */
const speichern = () =>
  vi.fn(
    (
      _d: EntwuerfeDaten,
      _g: number,
      eingabe: Omit<Entwurf, 'zeit' | 'version' | 'von'>,
      _erwartet: number | null,
    ) =>
      Promise.resolve({
        ok: true as const,
        entwurf: { ...eingabe, von: ALWIN, zeit: '2026-11-16T10:00:00.000Z', version: 1 },
      }),
  );
const entfernt = () =>
  vi.fn(() => Promise.resolve({ ok: true, entwurf: null } satisfies EntwurfErgebnis));

function zeige(
  extra: Partial<ComponentProps<typeof Planen>> = {},
  o: { ansicht?: 'raster' | 'matrix'; handy?: boolean } = {},
) {
  localStorage.setItem(
    'dienstplaner.planen.ansicht',
    JSON.stringify({ unteransicht: o.ansicht ?? 'raster' }),
  );
  return render(
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan: PLAN, wochen: 8 }}
      handy={o.handy ?? false}
      onNochmal={() => {}}
      onMehr={() => {}}
      mehrMoeglich={false}
      ladeZeitraum={() => new Promise<never>(() => {})}
      heute="2026-11-16"
      ladePersonen={vi.fn(() => Promise.resolve(STAND))}
      entwuerfe={nachgebaut({ speichern: speichern(), entfernen: entfernt() })}
      {...extra}
    />,
  );
}

const zelle = (name: string, dienst: string, tag: string, was = 'eintragen') =>
  `${name} für ${dienst} am ${tag} ${was}`;
/** Der Knopf einer Zelle – erst, wenn Mitglieder und Abwesenheiten da sind. */
const knopf = (name: string, dienst: string, tag: string) =>
  screen.findByRole('button', { name: zelle(name, dienst, tag) });
const keiner = (name: string, dienst: string, tag: string) =>
  screen.queryByRole('button', { name: zelle(name, dienst, tag) });
/** Wartet, bis Mitglieder und Abwesenheiten da sind (die Zeilen stehen). */
const warte = async () => {
  const t = await screen.findByRole('table', { name: 'Personen und ihre Einsätze' });
  await waitFor(() =>
    expect(within(t).getAllByText('Daniel Test', { selector: 'span' }).length).toBeGreaterThan(0),
  );
  return t;
};

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const E_ORT = (eventId: number, index: number, serviceId = 6) => ({ eventId, serviceId, index });
/** Ein Entwurf von Alwin: Eva (Daniel) auf einen freien Platz. */
const eintrag = (eventId: number, index: number, personId = 12, name = 'Daniel Test') =>
  entwurf({
    ort: E_ORT(eventId, index),
    ziel: { art: 'person', personId, name },
    gesehen: { art: 'frei' },
  });
/** „Zurückziehen“ von Anna (Ton, Fr 20.11., Platz 1). */
const zurueck = () =>
  entwurf({
    ort: E_ORT(20, 1),
    ziel: { art: 'frei' },
    gesehen: { art: 'zusage', personId: 5 },
  });
const mitEntwuerfen = (...e: Entwurf[]) => nachgebaut({ laden: () => Promise.resolve(daten(e)) });

const kopfVon = (tag: string) =>
  screen.getAllByRole('columnheader').find((k) => k.textContent?.startsWith(tag))!;
const stand = (tag: string) => kopfVon(tag).textContent.replace(/^.*Gottesdienst/, '');
const balken = (tag: string) =>
  (kopfVon(tag).querySelector('[aria-hidden="true"] > i') as HTMLElement).style.width;
const technikZeile = () => screen.getByRole('button', { name: 'Technik' }).closest('tr')!;
const gruppenZellen = () =>
  within(technikZeile())
    .getAllByRole('cell')
    .map((c) => c.textContent || c.querySelector('[aria-label]')?.getAttribute('aria-label'));

describe('Matrix – Entwürfe zählen mit (Kopf, Füllbalken, Gruppenzeile)', () => {
  it('ohne Entwurf zählt ChurchTools: Fr 20.11. hat 1 frei (Ton Platz 2)', async () => {
    zeige({}, { ansicht: 'matrix' });
    await waitFor(() => expect(stand('20NOV')).toBe('1 frei'));
    expect(balken('20NOV')).toBe('67%');
  });

  it('Entwurf auf den freien Platz: Kopf „alles besetzt“, Balken voll, Gruppenzeile mit Haken', async () => {
    zeige({ entwuerfe: mitEntwuerfen(eintrag(20, 2)) }, { ansicht: 'matrix' });
    await waitFor(() => expect(stand('20NOV')).toBe('alles besetzt'));
    expect(balken('20NOV')).toBe('100%');
    expect(gruppenZellen()[0]).toBe('alles besetzt');
    // Die anderen Termine bleiben, wie sie sind.
    expect(stand('22NOV')).toBe('2 frei');
  });

  it('„Zurückziehen“ auf einem belegten Platz: ein Platz mehr frei', async () => {
    zeige({ entwuerfe: mitEntwuerfen(zurueck()) }, { ansicht: 'matrix' });
    await waitFor(() => expect(stand('20NOV')).toBe('2 frei'));
    expect(balken('20NOV')).toBe('33%');
    expect(gruppenZellen()[0]).toBe('2 frei');
  });

  it('Ersetzen: gleich viele frei', async () => {
    const ersetzen = entwurf({
      ort: E_ORT(20, 1),
      ziel: { art: 'person', personId: 12, name: 'Daniel Test' },
      gesehen: { art: 'zusage', personId: 5 },
    });
    zeige({ entwuerfe: mitEntwuerfen(ersetzen) }, { ansicht: 'matrix' });
    await screen.findAllByText('Entwurf', { exact: false });
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /Entwurf/ }).length).toBeGreaterThan(0),
    );
    expect(stand('20NOV')).toBe('1 frei');
  });

  it('ein veralteter Entwurf zählt nicht', async () => {
    // „Zurückziehen“ mit gesehen: Ben – am Platz steht aber Anna.
    const veraltet = entwurf({
      ort: E_ORT(20, 1),
      ziel: { art: 'frei' },
      gesehen: { art: 'zusage', personId: 8 },
    });
    zeige({ entwuerfe: mitEntwuerfen(veraltet) }, { ansicht: 'matrix' });
    await screen.findByText('Entwurf veraltet');
    expect(stand('20NOV')).toBe('1 frei');
  });

  it('Handy: Datumsleiste und Gruppenzeile zählen den Entwurf mit', async () => {
    zeige({ entwuerfe: mitEntwuerfen(eintrag(20, 2)) }, { ansicht: 'matrix', handy: true });
    const chip = (await screen.findAllByRole('button', { name: /Fr, 20\.11\./ })).find((b) =>
      b.hasAttribute('aria-pressed'),
    )!;
    await waitFor(() => expect(chip.textContent).toContain('alles besetzt'));
    expect(
      within(screen.getByRole('region')).getAllByLabelText('alles besetzt').length,
    ).toBeGreaterThan(0);
    // Auch die Zeile unter dem Titel der Karte („Fr, 20.11. · 19:00 Uhr · alles besetzt“).
    expect(screen.getByRole('region').querySelector('small')!.textContent).toContain(
      'alles besetzt',
    );
  });
});

describe('Matrix – abgesagte Termine nehmen keine Einträge an', () => {
  it('der freie Platz ist dort kein Knopf (an den anderen Terminen schon)', async () => {
    zeige({}, { ansicht: 'matrix' });
    const ton = () => screen.getByRole('rowheader', { name: 'Ton' }).closest('tr')!;
    await waitFor(() =>
      expect(within(ton()).getAllByRole('button', { name: /Wer kann/ }).length).toBe(5),
    );
    // Termine: 20.11. (1 Knopf), 22.11. (2), 29.11. (2), 02.12. (voll), 06.12. abgesagt (2 freie, ohne Knopf).
    const zellen = within(ton()).getAllByRole('cell');
    expect(zellen).toHaveLength(5);
    expect(within(zellen[4]).queryByRole('button')).toBeNull();
    expect(within(zellen[4]).getAllByText('frei')).toHaveLength(2);
    expect(within(zellen[1]).getAllByRole('button', { name: /Wer kann/ })).toHaveLength(2);
  });
});

describe('Personen – Einsätze und „Noch offen“ zählen Entwürfe mit', () => {
  const einsaetze = (name: string, dienst: string, tag: string) =>
    keinerOderKnopf(name, dienst, tag).closest('tr')!.querySelector('td')!.textContent;
  const keinerOderKnopf = (name: string, dienst: string, tag: string) =>
    screen.getByRole('button', { name: zelle(name, dienst, tag) });
  const offen = (pos: number) =>
    screen.getByText('Noch offen').closest('tr')!.querySelectorAll('td')[1 + pos].textContent;

  it('Eintragen und wieder Wegnehmen ändern beides – und zurück', async () => {
    const e = eintrag(21, 1);
    // Ein Anschluss, dessen Speichern/Entfernen wie ChurchTools antwortet.
    zeige({
      entwuerfe: nachgebaut({
        speichern: speichern(),
        entfernen: entfernt(),
      }),
    });
    await warte();
    const k = await knopf('Daniel Test', 'Ton', 'So, 22.11.');
    expect(einsaetze('Daniel Test', 'Ton', 'So, 22.11.')).toBe('0');
    expect(offen(1)).toBe('Ton ×2');
    fireEvent.click(k);
    await screen.findByRole('img', { name: 'Ton, Entwurf' });
    const weg = await screen.findByRole('button', {
      name: 'Daniel Test für Ton am So, 22.11.: Entwurf wegnehmen',
    });
    expect(weg.closest('tr')!.querySelector('td')!.textContent).toBe('1');
    expect(offen(1)).toBe('Ton');
    fireEvent.click(weg);
    await screen.findByText('Entwurf entfernt.');
    expect(einsaetze('Daniel Test', 'Ton', 'So, 22.11.')).toBe('0');
    expect(offen(1)).toBe('Ton ×2');
    expect(e).toBeTruthy();
  });

  it('ein geladener „Zurückziehen“-Entwurf: Annas Einsätze −1, „Noch offen“ +1', async () => {
    zeige({ entwuerfe: mitEntwuerfen(zurueck()) });
    const t = await warte();
    const annaTon = within(t)
      .getAllByText('Anna Test', { selector: 'span' })
      .map((x) => x.closest('tr')!)
      .find((r) => within(r).queryAllByRole('img', { name: 'Ton, zugesagt' }).length > 0)!;
    // Anna steht im Ton am 20.11. und 02.12. – zählt jetzt nur noch den 02.12.
    expect(annaTon.querySelector('td')!.textContent).toBe('1');
    expect(offen(0)).toBe('Ton ×2');
  });
});

describe('Personen – abgesagte Termine nehmen keine Einträge an', () => {
  it('kein Zellen-Knopf in der abgesagten Spalte, an den anderen Terminen schon', async () => {
    const s = speichern();
    zeige({ entwuerfe: nachgebaut({ speichern: s }) });
    const t = await warte();
    await knopf('Daniel Test', 'Ton', 'So, 22.11.');
    expect(keiner('Daniel Test', 'Ton', 'So, 06.12.')).toBeNull();
    // Auch ein Klick in die Zelle selbst tut nichts (kein Hover-„+“, kein Eintragen).
    const zeileDaniel = screen
      .getByRole('button', { name: zelle('Daniel Test', 'Ton', 'So, 22.11.') })
      .closest('tr')!;
    const zellen = within(zeileDaniel).getAllByRole('cell');
    fireEvent.click(zellen[zellen.length - 1]);
    expect(s).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(within(t).getByText('abgesagt', { selector: 'i' })).toBeTruthy();
  });

  it('auch ein vorhandener eigener Entwurf in der abgesagten Spalte ist dort kein Knopf', async () => {
    zeige({ entwuerfe: mitEntwuerfen(eintrag(24, 1)) });
    const t = await screen.findByRole('table', { name: 'Personen und ihre Einsätze' });
    await within(t).findByRole('img', { name: 'Ton, Entwurf' });
    expect(screen.queryByRole('button', { name: /Entwurf wegnehmen/ })).toBeNull();
  });
});

describe('Vergangene Termine bleiben eintragbar (Nachtragen)', () => {
  it('Personen: die Zelle eines vergangenen, nicht abgesagten Termins hat ihren Knopf', async () => {
    zeige({ heute: '2026-11-25' });
    await warte();
    expect(await knopf('Daniel Test', 'Ton', 'So, 22.11.')).toBeTruthy();
  });
});
