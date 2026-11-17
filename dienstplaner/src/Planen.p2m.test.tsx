// @vitest-environment jsdom
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { planAus } from '@shared/dienstplan/plan';
import type { Entwurf } from '@shared/dienstplan/entwuerfe';
import type { RohTermin } from '@shared/dienstplan/termine';
import {
  abwesenheitenAus,
  type GruppenStand,
  type PersonenDaten,
} from '@shared/dienstplan/personenDaten';
import { daten, entwurf, nachgebaut } from './entwurfAnschluss.testutil';
import type { EntwuerfeDaten } from './ladeEntwuerfe';
import { ladeWerKann } from './ladeWerKann';
import { Planen } from './Planen';
import { ganzSichtbar, planbar } from './start';
import { startFuer } from './start.testutil';

vi.mock('./ladeWerKann', () => ({ ladeWerKann: vi.fn(), vergissWerKann: vi.fn() }));

/**
 * **P2m:** Abwesenheit als Schraffur (D), der Klick-Zyklus in „Personen“ (Anfrage → direkt → weg) und die Vorgabe
 * „Anfrage | direkt“ je Dienst (G4). Echter Plan, echte Ansichten, ChurchTools nachgebaut; die Rechnungen prüfen
 * `shared/dienstplan/modusVorgabe.test.ts` und `personenEintragen.test.ts`.
 *
 * Heute 16.11. Termine: 13.11. (vorbei), 20.11., 22.11., 06.12. (abgesagt). Technik (Ton 6, Licht 7), Musik (Gesang 9 –
 * ohne Schublade, dort darf man nicht ändern).
 */
const START = startFuer();
const p = (serviceId: number, personId: number | null, name: string | null, index: number) => ({
  serviceId,
  personId,
  name,
  isAccepted: true,
  index,
});
const ROH = [
  {
    id: 19,
    name: 'Gottesdienst',
    startDate: '2026-11-13T18:00:00Z',
    endDate: '2026-11-13T19:30:00Z',
    eventServices: [p(6, null, null, 1)],
  },
  {
    id: 20,
    name: 'Gottesdienst',
    startDate: '2026-11-20T18:00:00Z',
    endDate: '2026-11-20T19:30:00Z',
    eventServices: [
      p(6, 5, 'Anna Test', 1),
      p(6, null, null, 2),
      p(7, null, null, 1),
      p(9, null, null, 1),
    ],
  },
  {
    id: 21,
    name: 'Gottesdienst',
    startDate: '2026-11-22T09:00:00Z',
    endDate: '2026-11-22T10:30:00Z',
    eventServices: [p(6, null, null, 1), p(6, null, null, 2), p(7, 8, 'Ben Test', 1)],
  },
  {
    id: 24,
    name: 'Gottesdienst',
    startDate: '2026-12-06T09:00:00Z',
    endDate: '2026-12-06T10:30:00Z',
    isCanceled: true,
    eventServices: [p(6, null, null, 1), p(7, null, null, 1)],
  },
] as RohTermin[];
const planVon = (roh: RohTermin[]) =>
  planAus(roh, {
    ichId: START.ichId,
    dienste: START.dienste,
    dienstgruppen: START.dienstgruppen,
    zeitzone: 'Europe/Berlin',
    planbar: (d) => planbar(START, d),
    ganzSichtbar: (d) => ganzSichtbar(START, d),
  });
const PLAN = planVon(ROH);

const person = (id: number, name: string) => ({
  id,
  name,
  bild: null,
  initialen: name.slice(0, 2),
});
const da = (
  mitglieder: ReturnType<typeof person>[],
  abwesenheiten: Extract<GruppenStand, { art: 'da' }>['abwesenheiten'] = [],
): GruppenStand => ({ art: 'da', mitglieder, abwesenheiten });
const STAND: PersonenDaten = new Map<number, GruppenStand>([
  [
    7,
    da(
      [person(5, 'Anna Test'), person(8, 'Ben Test'), person(12, 'Daniel Test')],
      // Ben ist am 22.11. krank – dort steht er in Licht (zugesagt): ein Warnfall; in Ton nur abwesend.
      abwesenheitenAus([
        {
          id: 1,
          person: { domainIdentifier: '8' },
          absenceReason: { nameTranslated: 'Krank' },
          startDate: '2026-11-22',
          endDate: '2026-11-22',
        },
      ]),
    ),
  ],
  [9, da([person(12, 'Daniel Test')])],
]);

/** Die Kandidaten von ChurchTools (`possiblepersons`) – Daniel, Eva, Frank. */
const KANDIDATEN = [
  { person: { domainIdentifier: '12', title: 'Daniel Test' }, score: 0 },
  { person: { domainIdentifier: '13', title: 'Eva Test' }, score: -5 },
  { person: { domainIdentifier: '14', title: 'Frank Test' }, score: -10 },
];

const speichern = () =>
  vi.fn(
    (
      _d: EntwuerfeDaten,
      _g: number,
      e: Omit<Entwurf, 'zeit' | 'version' | 'von'>,
      _erwartet: number | null,
    ) =>
      Promise.resolve({
        ok: true as const,
        entwurf: {
          ...e,
          von: { personId: 1, name: 'Alwin' },
          zeit: '2026-11-16T10:00:00.000Z',
          version: 1,
        },
      }),
  );

function zeige(
  extra: Partial<ComponentProps<typeof Planen>> = {},
  o: { ansicht?: 'raster' | 'matrix'; handy?: boolean; direkt?: number[] } = {},
) {
  localStorage.setItem(
    'dienstplaner.planen.ansicht',
    JSON.stringify({ unteransicht: o.ansicht ?? 'raster', direktDienste: o.direkt }),
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
      entwuerfe={nachgebaut({ speichern: speichern() })}
      {...extra}
    />,
  );
}

const zauber = (dienst: string) => `Zauberstab: ${dienst} für alle gezeigten Termine vorschlagen`;
const symbol = (dienst: string, modus: 'Anfrage' | 'direkt') =>
  `Neue Einteilungen für ${dienst}: ${modus} – ändern`;
const zelle = (name: string, dienst: string, tag: string, was?: string) =>
  was ? `${name} für ${dienst} am ${tag}: ${was}` : `${name} für ${dienst} am ${tag} eintragen`;
const warteAufRaster = async () => {
  const t = await screen.findByRole('table', { name: 'Personen und ihre Einsätze' });
  await waitFor(() =>
    expect(within(t).getAllByText('Daniel Test', { selector: 'span' }).length).toBeGreaterThan(0),
  );
  return t;
};
const gemerkt = () =>
  (
    JSON.parse(localStorage.getItem('dienstplaner.planen.ansicht') ?? '{}') as {
      direktDienste?: number[];
    }
  ).direktDienste;
/** Die Eingabe eines Aufrufs von `speichern` (daten, gruppe, eingabe, erwartet). */
const eingabe = (s: ReturnType<typeof speichern>, nr: number) => s.mock.calls[nr][2];

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.mocked(ladeWerKann).mockReset();
});

describe('Personen – Klick-Zyklus Anfrage → direkt → weg (P2m)', () => {
  it('1. Klick: Anfrage („?“) · 2. Klick auf den eigenen Entwurf: direkt (Haken), mit der Version als Schutz · 3. Klick: weg', async () => {
    const s = speichern();
    const f = vi.fn(() => Promise.resolve({ ok: true, entwurf: null } as const));
    zeige({ entwuerfe: nachgebaut({ speichern: s, entfernen: f }) });
    const t = await warteAufRaster();

    fireEvent.click(
      await screen.findByRole('button', { name: zelle('Daniel Test', 'Ton', 'So, 22.11.') }),
    );
    await within(t).findByRole('img', { name: 'Ton, Entwurf, Anfrage' });
    expect(eingabe(s, 0)).toMatchObject({ modus: 'anfrage' });

    // Zweiter Klick: derselbe Weg wie „Beim Senden“ im Entwurfs-Fach – ein Speichern mit der Version des Entwurfs.
    fireEvent.click(
      await screen.findByRole('button', {
        name: zelle('Daniel Test', 'Ton', 'So, 22.11.', 'auf direkt umstellen'),
      }),
    );
    await within(t).findByRole('img', { name: 'Ton, Entwurf, direkt' });
    expect(s).toHaveBeenCalledTimes(2);
    expect(eingabe(s, 1)).toMatchObject({
      modus: 'direkt',
      ziel: { art: 'person', personId: 12 },
      ort: { eventId: 21, serviceId: 6, index: 1 },
    });
    expect(s.mock.calls[1][3]).toBe(1);
    expect(screen.queryByRole('img', { name: 'Ton, Entwurf, Anfrage' })).toBeNull();
    // Kein Warnfenster beim Umstellen.
    expect(screen.queryByRole('alertdialog')).toBeNull();

    // Dritter Klick: weg.
    fireEvent.click(
      await screen.findByRole('button', {
        name: zelle('Daniel Test', 'Ton', 'So, 22.11.', 'Entwurf wegnehmen'),
      }),
    );
    await waitFor(() => expect(f).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(within(t).queryByRole('img', { name: /^Ton, Entwurf/ })).toBeNull());
    expect(s).toHaveBeenCalledTimes(2);
  });

  it('das Warnfenster kommt nur beim ersten Klick – Umstellen und Wegnehmen fragen nicht mehr', async () => {
    const s = speichern();
    zeige({
      entwuerfe: nachgebaut({
        speichern: s,
        entfernen: vi.fn(() => Promise.resolve({ ok: true, entwurf: null } as const)),
      }),
    });
    const t = await warteAufRaster();
    // Ben ist am 22.11. krank.
    fireEvent.click(
      await screen.findByRole('button', { name: zelle('Ben Test', 'Ton', 'So, 22.11.') }),
    );
    expect((await screen.findByRole('alertdialog')).textContent).toContain('abwesend');
    fireEvent.click(screen.getByRole('button', { name: 'Trotzdem eintragen' }));
    await within(t).findAllByRole('img', { name: 'Ton, Entwurf, Anfrage' });
    fireEvent.click(
      await screen.findByRole('button', {
        name: zelle('Ben Test', 'Ton', 'So, 22.11.', 'auf direkt umstellen'),
      }),
    );
    await within(t).findByRole('img', { name: 'Ton, Entwurf, direkt' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(eingabe(s, 1)).toMatchObject({ modus: 'direkt' });
  });

  it('der Dienst steht auf „direkt“: schon der erste Klick legt einen direkten Entwurf an, der nächste nimmt ihn weg', async () => {
    const s = speichern();
    zeige({ entwuerfe: nachgebaut({ speichern: s }) }, { direkt: [6] });
    const t = await warteAufRaster();
    fireEvent.click(
      await screen.findByRole('button', { name: zelle('Daniel Test', 'Ton', 'So, 22.11.') }),
    );
    await within(t).findByRole('img', { name: 'Ton, Entwurf, direkt' });
    expect(s).toHaveBeenCalledTimes(1);
    expect(eingabe(s, 0)).toMatchObject({ modus: 'direkt' });
    // Der nächste Klick ist gleich „wegnehmen“, kein Umstellen.
    expect(
      screen.getByRole('button', {
        name: zelle('Daniel Test', 'Ton', 'So, 22.11.', 'Entwurf wegnehmen'),
      }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /auf direkt umstellen/ })).toBeNull();
  });

  it('die Vorgabe gilt je Dienst: Licht bleibt Anfrage, wenn nur Ton direkt ist', async () => {
    const s = speichern();
    zeige({ entwuerfe: nachgebaut({ speichern: s }) }, { direkt: [6] });
    await warteAufRaster();
    // Licht am 20.11. hat einen freien Platz – Daniel (Mitglied von Technik) steht dort ohne Eintrag.
    fireEvent.click(
      await screen.findByRole('button', { name: zelle('Daniel Test', 'Licht', 'Fr, 20.11.') }),
    );
    await waitFor(() => expect(s).toHaveBeenCalledTimes(1));
    expect(eingabe(s, 0)).toMatchObject({ modus: 'anfrage', ort: { serviceId: 7 } });
  });

  it('ein Fehler beim Umstellen geht nicht verloren: Hinweis, der Entwurf bleibt eine Anfrage', async () => {
    const s = vi
      .fn()
      .mockImplementationOnce(speichern())
      .mockResolvedValueOnce({ ok: false, grund: 'voruebergehend' });
    zeige({ entwuerfe: nachgebaut({ speichern: s }) });
    const t = await warteAufRaster();
    fireEvent.click(
      await screen.findByRole('button', { name: zelle('Daniel Test', 'Ton', 'So, 22.11.') }),
    );
    await within(t).findByRole('img', { name: 'Ton, Entwurf, Anfrage' });
    fireEvent.click(
      await screen.findByRole('button', {
        name: zelle('Daniel Test', 'Ton', 'So, 22.11.', 'auf direkt umstellen'),
      }),
    );
    expect(await screen.findByText(/ChurchTools antwortet gerade nicht/)).toBeTruthy();
    expect(within(t).getByRole('img', { name: 'Ton, Entwurf, Anfrage' })).toBeTruthy();
  });

  it('„Platz übernehmen“ behält den Modus des Zurückziehen-Entwurfs wie bisher – die Vorgabe zählt nur für neue Entwürfe', async () => {
    // Anna steht im Ton am 20.11. auf Platz 1; ein „Zurückziehen“-Entwurf (Anfrage) liegt dort, der Platz 2 ist belegt.
    const weg = entwurf({
      ort: { eventId: 20, serviceId: 6, index: 1 },
      ziel: { art: 'frei' },
      gesehen: { art: 'zusage', personId: 5 },
      version: 3,
    });
    const roh = [{ ...ROH[1], eventServices: [p(6, 5, 'Anna Test', 1), p(6, 8, 'Ben Test', 2)] }];
    const s = speichern();
    zeige(
      {
        zustand: { art: 'fertig', zeilen: [], plan: planVon(roh), wochen: 8 },
        entwuerfe: nachgebaut({ speichern: s, laden: () => Promise.resolve(daten([weg])) }),
      },
      { direkt: [6] },
    );
    await warteAufRaster();
    fireEvent.click(
      await screen.findByRole('button', { name: zelle('Daniel Test', 'Ton', 'Fr, 20.11.') }),
    );
    await waitFor(() => expect(s).toHaveBeenCalledTimes(1));
    expect(eingabe(s, 0)).toMatchObject({ modus: 'anfrage' });
    expect(s.mock.calls[0][3]).toBe(3);
  });
});

describe('Matrix – Vorgabe „Anfrage | direkt“ am Dienstnamen (P2m, G4)', () => {
  it('ein rundes Symbol je planbarem Dienst: „?“ = Anfrage; ohne Recht (Gesang) keins', async () => {
    zeige({}, { ansicht: 'matrix' });
    const k = await screen.findByRole('button', { name: symbol('Ton', 'Anfrage') });
    expect(k.textContent).toBe('?');
    expect(k.getAttribute('title')).toBe(symbol('Ton', 'Anfrage'));
    expect(screen.getByRole('button', { name: symbol('Licht', 'Anfrage') })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Neue Einteilungen für Gesang/ })).toBeNull();
    // Der Name der Zeile bleibt der Dienst – das Symbol gehört nicht dazu.
    expect(screen.getAllByRole('rowheader', { name: 'Ton' })).toHaveLength(1);
    // … und in der Zelle steht sonst nichts: Dienstname und Symbol (ein Kommentar im JSX war einmal als Text sichtbar).
    expect(screen.getByRole('rowheader', { name: 'Ton' }).textContent).toBe('Ton?');
  });

  it('der Klick öffnet nur das Fenster – nichts wird umgeschaltet, nichts gemerkt', async () => {
    zeige({}, { ansicht: 'matrix' });
    fireEvent.click(await screen.findByRole('button', { name: symbol('Ton', 'Anfrage') }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText('Vorgabe · Ton')).toBeTruthy();
    expect(
      within(dlg).getByText(/direkt = ohne Rückfrage als zugesagt eintragen, z\. B\. für Prediger/),
    ).toBeTruthy();
    expect(within(dlg).getByRole('button', { name: 'Anfrage' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(within(dlg).getByText(/Gilt auf diesem Gerät/)).toBeTruthy();
    expect(within(dlg).getByRole('button', { name: /Für alle Dienste übernehmen/ })).toBeTruthy();
    // Das Symbol sagt weiter „Anfrage“, gemerkt ist nichts.
    expect(screen.getByRole('button', { name: symbol('Ton', 'Anfrage') })).toBeTruthy();
    expect(gemerkt()).toBeUndefined();
    expect(
      JSON.parse(localStorage.getItem('dienstplaner.planen.ansicht') ?? '{}').direktDienste,
    ).toEqual(undefined);
  });

  it('im Fenster „direkt“ wählen: das Symbol wird zum gefüllten Haken, gemerkt je Gerät – und bleibt nach dem Neuaufbau', async () => {
    const erste = zeige({}, { ansicht: 'matrix' });
    fireEvent.click(await screen.findByRole('button', { name: symbol('Ton', 'Anfrage') }));
    const dlg = await screen.findByRole('dialog');
    fireEvent.click(within(dlg).getByRole('button', { name: 'direkt' }));
    const haken = await screen.findByRole('button', { name: symbol('Ton', 'direkt') });
    expect(haken.textContent).toBe('');
    expect(haken.querySelector('svg')).toBeTruthy();
    expect(haken.className).toMatch(/vorgabeDirekt/);
    expect(gemerkt()).toEqual([6]);
    // Licht bleibt Anfrage.
    expect(screen.getByRole('button', { name: symbol('Licht', 'Anfrage') })).toBeTruthy();
    erste.unmount();
    // Neu aufgebaut, ohne dass die Ansicht neu gesetzt wird (zeige() würde sie überschreiben).
    render(
      <Planen
        zustand={{ art: 'fertig', zeilen: [], plan: PLAN, wochen: 8 }}
        handy={false}
        onNochmal={() => {}}
        onMehr={() => {}}
        mehrMoeglich={false}
        ladeZeitraum={() => new Promise<never>(() => {})}
        heute="2026-11-16"
        ladePersonen={vi.fn(() => Promise.resolve(STAND))}
        entwuerfe={nachgebaut({ speichern: speichern() })}
      />,
    );
    expect(await screen.findByRole('button', { name: symbol('Ton', 'direkt') })).toBeTruthy();
  });

  it('„Für alle Dienste übernehmen“ stellt jeden Dienst um – auch zurück auf Anfrage', async () => {
    zeige({}, { ansicht: 'matrix' });
    fireEvent.click(await screen.findByRole('button', { name: symbol('Ton', 'Anfrage') }));
    let dlg = await screen.findByRole('dialog');
    fireEvent.click(within(dlg).getByRole('button', { name: 'direkt' }));
    fireEvent.click(
      within(dlg).getByRole('button', { name: 'Für alle Dienste übernehmen (direkt)' }),
    );
    expect(await screen.findByRole('button', { name: symbol('Licht', 'direkt') })).toBeTruthy();
    expect(gemerkt()?.slice().sort()).toEqual([6, 7, 9]);
    fireEvent.click(within(dlg).getByRole('button', { name: 'Anfrage' }));
    dlg = screen.getByRole('dialog');
    fireEvent.click(
      within(dlg).getByRole('button', { name: 'Für alle Dienste übernehmen (Anfrage)' }),
    );
    expect(await screen.findByRole('button', { name: symbol('Licht', 'Anfrage') })).toBeTruthy();
    expect(screen.getByRole('button', { name: symbol('Ton', 'Anfrage') })).toBeTruthy();
    expect(gemerkt()).toEqual([]);
  });

  it('Handy: das Symbol steht auch beim Dienstnamen im Zettel', async () => {
    zeige({}, { ansicht: 'matrix', handy: true, direkt: [6] });
    expect(await screen.findByRole('button', { name: symbol('Ton', 'direkt') })).toBeTruthy();
  });

  it('ohne Anschluss für Entwürfe gibt es kein Symbol (es gäbe nichts zu entscheiden)', async () => {
    zeige({ entwuerfe: undefined }, { ansicht: 'matrix' });
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: /Neue Einteilungen für/ })).toBeNull();
  });
});

describe('Vorgabe wirkt auf neue Entwürfe – „Wer kann?“, Zauberstab – und auf nichts Bestehendes', () => {
  it('„Wer kann?“ (Matrix): Ton direkt → Entwurf direkt; Licht bleibt Anfrage', async () => {
    vi.mocked(ladeWerKann).mockResolvedValue(KANDIDATEN);
    const s = speichern();
    zeige({ entwuerfe: nachgebaut({ speichern: s }) }, { ansicht: 'matrix', direkt: [6] });
    const zeileVon = (dienst: string) =>
      screen.getAllByRole('rowheader', { name: dienst })[0].closest('tr')!;
    fireEvent.click(
      within(zeileVon('Ton')).getAllByRole('button', { name: /^frei – Wer kann\?/ })[0],
    );
    fireEvent.click(
      within(await screen.findByRole('list', { name: 'Wer kann?' })).getByRole('button', {
        name: /^Daniel Test/,
      }),
    );
    await waitFor(() => expect(s).toHaveBeenCalledTimes(1));
    expect(eingabe(s, 0)).toMatchObject({ modus: 'direkt', ort: { serviceId: 6 } });
    await screen.findByText(/eingetragen – noch nicht gesendet/);
    fireEvent.click(
      within(zeileVon('Licht')).getAllByRole('button', { name: /^frei – Wer kann\?/ })[0],
    );
    fireEvent.click(
      within(await screen.findByRole('list', { name: 'Wer kann?' })).getByRole('button', {
        name: /^Daniel Test/,
      }),
    );
    await waitFor(() => expect(s).toHaveBeenCalledTimes(2));
    expect(eingabe(s, 1)).toMatchObject({ modus: 'anfrage', ort: { serviceId: 7 } });
  });

  it('Zauberstab („Personen“): alle neuen Entwürfe an einem direkten Dienst beginnen direkt', async () => {
    vi.mocked(ladeWerKann).mockResolvedValue(KANDIDATEN);
    const s = speichern();
    zeige({ entwuerfe: nachgebaut({ speichern: s }) }, { direkt: [6] });
    await warteAufRaster();
    fireEvent.click(await screen.findByRole('button', { name: zauber('Ton') }));
    fireEvent.click(await screen.findByRole('button', { name: /als Entwurf übernehmen$/ }));
    await waitFor(() => expect(s).toHaveBeenCalledTimes(3));
    expect(s.mock.calls.map((c) => c[2].modus)).toEqual(['direkt', 'direkt', 'direkt']);
  });

  it('Zauberstab (Matrix, Gruppenzeile): Ton direkt, Licht Anfrage – je Dienst die eigene Vorgabe', async () => {
    vi.mocked(ladeWerKann).mockResolvedValue(KANDIDATEN);
    const s = speichern();
    zeige({ entwuerfe: nachgebaut({ speichern: s }) }, { ansicht: 'matrix', direkt: [6] });
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Automatische Planung Technik für alle gezeigten Termine',
      }),
    );
    fireEvent.click(await screen.findByRole('button', { name: /als Entwurf übernehmen$/ }));
    await waitFor(() => expect(s).toHaveBeenCalledTimes(3));
    const je = s.mock.calls.map((c) => [c[2].ort.serviceId, c[2].modus]);
    expect(je).toEqual(
      expect.arrayContaining([
        [6, 'direkt'],
        [6, 'direkt'],
        [7, 'anfrage'],
      ]),
    );
  });

  it('ohne Vorgabe beginnt alles als Anfrage – wie bisher', async () => {
    vi.mocked(ladeWerKann).mockResolvedValue(KANDIDATEN);
    const s = speichern();
    zeige({ entwuerfe: nachgebaut({ speichern: s }) });
    await warteAufRaster();
    fireEvent.click(await screen.findByRole('button', { name: zauber('Ton') }));
    fireEvent.click(await screen.findByRole('button', { name: /als Entwurf übernehmen$/ }));
    await waitFor(() => expect(s).toHaveBeenCalledTimes(3));
    expect(s.mock.calls.map((c) => c[2].modus)).toEqual(['anfrage', 'anfrage', 'anfrage']);
  });

  it('bestehende Entwürfe bleiben, wie sie sind: eine geänderte Vorgabe speichert nichts', async () => {
    const s = speichern();
    const e = entwurf({
      ort: { eventId: 21, serviceId: 6, index: 1 },
      ziel: { art: 'person', personId: 12, name: 'Daniel Test' },
    });
    zeige(
      { entwuerfe: nachgebaut({ speichern: s, laden: () => Promise.resolve(daten([e])) }) },
      { ansicht: 'matrix' },
    );
    fireEvent.click(await screen.findByRole('button', { name: symbol('Ton', 'Anfrage') }));
    const dlg = await screen.findByRole('dialog');
    fireEvent.click(within(dlg).getByRole('button', { name: 'direkt' }));
    fireEvent.click(within(dlg).getByRole('button', { name: /Für alle Dienste übernehmen/ }));
    await screen.findByRole('button', { name: symbol('Ton', 'direkt') });
    expect(s).not.toHaveBeenCalled();
    // Der Entwurf zeigt weiter „Anfrage“ (kein Schild „direkt“).
    expect(screen.queryByText('direkt', { selector: 'span' })).toBeNull();
  });
});

describe('Personen – Abwesenheit D: schraffierte Zelle, Grund als Text; Warnfall rot (P2m)', () => {
  it('abwesend: die Zelle trägt die Schraffur-Klasse, der Grund steht als Text mit Symbol – ohne Tag-Kasten', async () => {
    zeige();
    const t = await warteAufRaster();
    // Ton-Block, Ben, Spalte 22.11. (Termine: 13.11., 20.11., 22.11., 06.12.).
    const tonBlock = [...t.querySelectorAll('tr[data-person="8"]')];
    expect(tonBlock.length).toBeGreaterThanOrEqual(2);
    const zeileTon = tonBlock.find(
      (r) =>
        !within(r as HTMLElement).queryByRole('img', { name: /^Licht, / }) &&
        r.textContent.includes('Ben'),
    )!;
    const z = zeileTon.querySelectorAll('td')[1 + 2];
    expect(z.className).toMatch(/abwZelle/);
    expect(z.className).not.toMatch(/warnZelle/);
    const grund = within(z as HTMLElement).getByRole('img', { name: 'Abwesend: Krank' });
    expect(grund.textContent).toBe('Krank');
    // Kein Kasten: nicht mehr der `tag` mit Grund und Hintergrund.
    expect(grund.className).not.toMatch(/\btag\b|_tag_/);
    expect(grund.className).toMatch(/abwesend/);
    expect(grund.querySelector('svg')).toBeTruthy();
    // Andere Zellen derselben Zeile sind nicht schraffiert.
    expect(zeileTon.querySelectorAll('td')[1 + 1].className).not.toMatch(/abwZelle/);
  });

  it('abwesend UND eingeteilt (Ben, Licht, 22.11.): rote Schraffur und Rahmen – Klasse „warnZelle“, Hinweis im Namen', async () => {
    zeige();
    const t = await warteAufRaster();
    const warn = [...t.querySelectorAll('td')].filter((td) => /warnZelle/.test(td.className));
    expect(warn).toHaveLength(1);
    expect(warn[0].className).toMatch(/abwZelle/);
    expect(
      within(warn[0] as HTMLElement).getByRole('img', {
        name: 'Abwesend: Krank – trotzdem eingeteilt',
      }),
    ).toBeTruthy();
    expect(
      within(warn[0] as HTMLElement).getByRole('img', { name: 'Licht, zugesagt' }),
    ).toBeTruthy();
  });

  it('Klick und Hover der Zelle bleiben: eine abwesende, leere Zelle ist weiter ein Eintragen-Knopf (mit Warnfenster)', async () => {
    zeige();
    await warteAufRaster();
    const k = await screen.findByRole('button', { name: zelle('Ben Test', 'Ton', 'So, 22.11.') });
    expect(k.closest('td')!.className).toMatch(/abwZelle/);
    expect(k.closest('td')!.className).toMatch(/leerKlick/);
  });

  it('der Entwurf zeigt seine Art in der Zelle: „?“ im gestrichelten Kreis (Anfrage), Haken im gefüllten Kreis und kräftiger (direkt)', async () => {
    const e = entwurf({
      ort: { eventId: 21, serviceId: 6, index: 1 },
      ziel: { art: 'person', personId: 12, name: 'Daniel Test' },
      modus: 'direkt',
      von: { personId: 9, name: 'Planer' },
    });
    const a = entwurf({
      ort: { eventId: 21, serviceId: 6, index: 2 },
      ziel: { art: 'person', personId: 5, name: 'Anna Test' },
      von: { personId: 9, name: 'Planer' },
    });
    zeige({ entwuerfe: nachgebaut({ laden: () => Promise.resolve(daten([e, a])) }) });
    const t = await warteAufRaster();
    const direkt = await within(t).findByRole('img', { name: 'Ton, Entwurf, direkt' });
    expect(direkt.className).toMatch(/entwurfDirekt/);
    expect(direkt.querySelector('[class*="haken"]')).toBeTruthy();
    const anfrage = within(t).getByRole('img', { name: 'Ton, Entwurf, Anfrage' });
    expect(anfrage.className).toMatch(/entwurf/);
    expect(anfrage.className).not.toMatch(/entwurfDirekt/);
    expect(anfrage.querySelector('[class*="frage"]')?.textContent).toBe('?');
  });
});
