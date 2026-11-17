// @vitest-environment jsdom
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { planAus } from '@shared/dienstplan/plan';
import type { Entwurf, EntwurfErgebnis } from '@shared/dienstplan/entwuerfe';
import type { RohTermin } from '@shared/dienstplan/termine';
import type { GruppenStand, PersonenDaten } from '@shared/dienstplan/personenDaten';
import { ALWIN, daten, entwurf, nachgebaut } from './entwurfAnschluss.testutil';
import type { EntwuerfeDaten } from './ladeEntwuerfe';
import { ladeWerKann } from './ladeWerKann';
import { Planen } from './Planen';
import { ganzSichtbar, planbar } from './start';
import { startFuer } from './start.testutil';

vi.mock('./ladeWerKann', () => ({ ladeWerKann: vi.fn(), vergissWerKann: vi.fn() }));

/**
 * **Bestehende Einteilungen in „Personen“ bearbeiten** (Wunsch 5, P2b). Echter Plan (`planAus` + `start.ts`), echte
 * Ansicht – nur ChurchTools ist nachgebaut. Geprüft wird, dass ein Klick **dieselben Fenster wie die Matrix** öffnet
 * (`BelegtFach`, `EntwurfFach`), dass ein zurückgezogener Platz wie dort rot durchgestrichen dasteht und dass Rechte und
 * Fokus-Klick unverändert sind. Die Rechnung prüfen `personenEintragen.test.ts` und `personenRaster.test.ts`.
 *
 * Ton (Technik, Gruppe 3 – mit Schublade) mit Anna, Ben, Daniel als Mitglieder:
 * - Fr 20.11.: Ton Anna zugesagt + Gast Onkel Otto; Gesang Daniel zugesagt
 * - So 22.11.: Ton Ben angefragt + 1 frei
 */
const START = startFuer();
const p = (
  serviceId: number,
  personId: number | null,
  name: string | null,
  zu: boolean,
  index: number,
) => ({ serviceId, personId, name, isAccepted: zu, index });
const ROH = [
  {
    id: 20,
    name: 'Gottesdienst',
    startDate: '2026-11-20T18:00:00Z',
    endDate: '2026-11-20T19:30:00Z',
    eventServices: [
      p(6, 5, 'Anna Test', true, 1),
      p(6, null, 'Onkel Otto', true, 2),
      p(9, 12, 'Daniel Test', true, 1),
    ],
  },
  {
    id: 21,
    name: 'Gottesdienst',
    startDate: '2026-11-22T09:00:00Z',
    endDate: '2026-11-22T10:30:00Z',
    eventServices: [p(6, 8, 'Ben Test', false, 1), p(6, null, null, true, 2)],
  },
] as RohTermin[];
const planFuer = (start: ReturnType<typeof startFuer>) =>
  planAus(ROH, {
    ichId: start.ichId,
    dienste: start.dienste,
    dienstgruppen: start.dienstgruppen,
    zeitzone: 'Europe/Berlin',
    planbar: (d) => planbar(start, d),
    ganzSichtbar: (d) => ganzSichtbar(start, d),
  });
const PLAN = planFuer(START);
// Ohne das Recht, Dienste zu planen.
const PLAN_OHNE = planFuer(
  startFuer({
    rechte: {
      planbareDienstgruppen: [],
      sichtbareDienstgruppen: [3, 4],
      ablaufKalender: [],
      terminKalender: [],
      abwesenheitenAller: false,
    },
  }),
);

const person = (id: number, name: string) => ({
  id,
  name,
  bild: null,
  initialen: name.slice(0, 2),
});
const da = (mitglieder: ReturnType<typeof person>[]): GruppenStand => ({
  art: 'da',
  mitglieder,
  abwesenheiten: [],
});
const STAND: PersonenDaten = new Map<number, GruppenStand>([
  [7, da([person(5, 'Anna Test'), person(8, 'Ben Test'), person(12, 'Daniel Test')])],
  [9, da([person(12, 'Daniel Test')])],
]);

const gespeichert = () =>
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

function zeige(extra: Partial<ComponentProps<typeof Planen>> = {}, plan = PLAN) {
  localStorage.setItem('dienstplaner.planen.ansicht', JSON.stringify({ unteransicht: 'raster' }));
  return render(
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan, wochen: 8 }}
      handy={false}
      onNochmal={() => {}}
      onMehr={() => {}}
      mehrMoeglich={false}
      ladeZeitraum={() => new Promise<never>(() => {})}
      heute="2026-11-16"
      ladePersonen={vi.fn(() => Promise.resolve(STAND))}
      entwuerfe={nachgebaut({ speichern: gespeichert(), entfernen: entfernt() })}
      {...extra}
    />,
  );
}

const ANNA = 'Anna Test für Ton am Fr, 20.11.';
const ANNA_OFFEN = `${ANNA}: Einteilung öffnen`;
const ANNA_ENTWURF = `${ANNA}: Entwurf öffnen`;
const BEN_OFFEN = 'Ben Test für Ton am So, 22.11.: Einteilung öffnen';
const warte = async () => {
  const t = await screen.findByRole('table', { name: 'Personen und ihre Einsätze' });
  await waitFor(() =>
    expect(within(t).getAllByText('Daniel Test', { selector: 'span' }).length).toBeGreaterThan(0),
  );
  return t;
};
/** Anna zurückziehen (Version 7), wie es in der Matrix aussieht. */
const WEG = entwurf({
  ort: { eventId: 20, serviceId: 6, index: 1 },
  ziel: { art: 'frei' },
  gesehen: { art: 'zusage', personId: 5 },
  version: 7,
});
/** Onkel Otto zurückziehen. */
const GAST_WEG = entwurf({
  ort: { eventId: 20, serviceId: 6, index: 2 },
  ziel: { art: 'frei' },
  gesehen: { art: 'gast', name: 'Onkel Otto' } as Entwurf['gesehen'],
  version: 3,
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.mocked(ladeWerKann).mockReset();
});

describe('Personen – Klick auf eine bestehende Einteilung (P2b)', () => {
  it('zugesagt: öffnet das Fenster der Matrix; „Zurückziehen“ speichert „frei“ – danach steht die Zelle rot durchgestrichen da', async () => {
    const s = gespeichert();
    zeige({ entwuerfe: nachgebaut({ speichern: s }) });
    const t = await warte();
    expect(within(t).queryByRole('img', { name: 'Ton, wird zurückgezogen' })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: ANNA_OFFEN }));
    // Dasselbe Fenster wie in der Matrix (BelegtFach).
    expect(screen.getByText(/– hat zugesagt\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Andere Person wählen' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zurückziehen' }));
    await waitFor(() => expect(s).toHaveBeenCalledTimes(1));
    expect(s.mock.calls[0][1]).toBe(3);
    expect(s.mock.calls[0][2]).toMatchObject({
      ort: { eventId: 20, serviceId: 6, index: 1 },
      ziel: { art: 'frei' },
      gesehen: { art: 'zusage', personId: 5 },
    });
    const tag = await within(t).findByRole('img', { name: 'Ton, wird zurückgezogen' });
    expect(tag.className).toMatch(/zurueck/);
    // Die Zelle ist jetzt „Entwurf öffnen“, nicht mehr „Einteilung öffnen“.
    expect(await screen.findByRole('button', { name: ANNA_ENTWURF })).toBeTruthy();
    expect(screen.queryByRole('button', { name: ANNA_OFFEN })).toBeNull();
  });

  it('angefragt: dasselbe Fenster', async () => {
    zeige();
    await warte();
    fireEvent.click(await screen.findByRole('button', { name: BEN_OFFEN }));
    expect(screen.getByText(/angefragt, noch keine Antwort\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zurückziehen' })).toBeTruthy();
  });

  it('ein Klick irgendwo in der Zelle zählt (auch auf dem Tag) – und das Fenster lässt sich schließen', async () => {
    zeige();
    const t = await warte();
    await screen.findByRole('button', { name: ANNA_OFFEN });
    const tag = within(t)
      .getAllByRole('img', { name: 'Ton, zugesagt' })
      .find((e) => e.closest('tr')?.textContent?.includes('Anna'))!;
    fireEvent.click(tag);
    expect(await screen.findByRole('button', { name: 'Zurückziehen' })).toBeTruthy();
  });

  it('Gast in der Gäste-Zeile: dasselbe Fenster am belegten Platz', async () => {
    zeige();
    await warte();
    fireEvent.click(await screen.findByRole('button', { name: 'Onkel Otto (Gast), öffnen' }));
    expect(screen.getByRole('button', { name: 'Zurückziehen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Andere Person wählen' })).toBeTruthy();
  });

  it('der Klick auf den Namen setzt weiter den Fokus – und öffnet kein Fenster', async () => {
    zeige();
    await warte();
    await screen.findByRole('button', { name: ANNA_OFFEN });
    fireEvent.click(screen.getAllByRole('button', { pressed: false, name: /Anna Test/ })[0]);
    expect(await screen.findByRole('status', { name: 'Fokus' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Zurückziehen' })).toBeNull();
  });

  it('ohne Recht, den Dienst zu planen: kein Knopf, der Klick tut nichts', async () => {
    zeige({}, PLAN_OHNE);
    const t = await warte();
    expect(
      screen.queryAllByRole('button', { name: /Einteilung öffnen|Entwurf öffnen/ }),
    ).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /\(Gast\), öffnen/ })).toBeNull();
    const tag = within(t)
      .getAllByRole('img', { name: 'Ton, zugesagt' })
      .find((e) => e.closest('tr')?.textContent?.includes('Anna'))!;
    fireEvent.click(tag);
    expect(screen.queryByRole('button', { name: 'Zurückziehen' })).toBeNull();
  });
});

describe('Personen – Rechte wie in der Matrix (nur planen ≠ Entwürfe ändern)', () => {
  // Gesang (Musik, Gruppe 4) hat keine Schublade: planen ja, Entwürfe ändern nein – wie in der Matrix.
  const DANIEL_GESANG = 'Daniel Test für Gesang am Fr, 20.11.';

  it('ein belegter Platz öffnet das Fenster auch ohne Schublade (die Matrix verlangt dort nur „planen“, das Fenster erklärt den Rest)', async () => {
    zeige();
    await warte();
    fireEvent.click(
      await screen.findByRole('button', { name: `${DANIEL_GESANG}: Einteilung öffnen` }),
    );
    // Das Fenster steht da (Name und Stand), aber ohne Schublade bietet es – wie in der Matrix – keine Wege an.
    expect(screen.getByText(/– hat zugesagt\./)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Zurückziehen' })).toBeNull();
  });

  it('die durchgestrichene Zelle ohne Schublade ist kein Knopf – das Entwurfs-Fenster verlangt „Entwürfe ändern“', async () => {
    const weg = entwurf({
      ort: { eventId: 20, serviceId: 9, index: 1 },
      ziel: { art: 'frei' },
      gesehen: { art: 'zusage', personId: 12 },
    });
    zeige({ entwuerfe: nachgebaut({ laden: () => Promise.resolve(daten([weg])) }) });
    const t = await screen.findByRole('table', { name: 'Personen und ihre Einsätze' });
    await within(t).findByRole('img', { name: 'Gesang, wird zurückgezogen' });
    expect(screen.queryByRole('button', { name: `${DANIEL_GESANG}: Entwurf öffnen` })).toBeNull();
    // Anna im Ton (mit Schublade) hat ihren Knopf weiter.
    expect(screen.getByRole('button', { name: ANNA_OFFEN })).toBeTruthy();
  });
});

describe('Personen – zurückgezogene Einteilung (Entwurf „frei“ am Platz)', () => {
  it('die Zelle steht wie in der Matrix rot durchgestrichen da – Klick öffnet das Entwurfs-Fenster, „Entfernen“ nimmt es zurück', async () => {
    const f = entfernt();
    zeige({ entwuerfe: nachgebaut({ entfernen: f, laden: () => Promise.resolve(daten([WEG])) }) });
    const t = await screen.findByRole('table', { name: 'Personen und ihre Einsätze' });
    const tag = await within(t).findByRole('img', { name: 'Ton, wird zurückgezogen' });
    expect(tag.className).toMatch(/zurueck/);
    // Anna zählt nicht mehr: in ChurchTools noch zugesagt, hier aber „weg“ – kein Haken-Tag mehr in ihrer Zelle.
    expect(within(tag.closest('td')!).queryByRole('img', { name: 'Ton, zugesagt' })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: ANNA_ENTWURF }));
    // Das Entwurfs-Fenster der Matrix (EntwurfFach).
    fireEvent.click(await screen.findByRole('button', { name: 'Entfernen' }));
    await waitFor(() => expect(f).toHaveBeenCalledTimes(1));
    expect(f).toHaveBeenCalledWith(expect.anything(), 3, WEG.ort, 7);
    // Wieder ein normaler, anklickbarer Platz.
    expect(await within(t).findByRole('img', { name: 'Ton, zugesagt' })).toBeTruthy();
    expect(within(t).queryByRole('img', { name: 'Ton, wird zurückgezogen' })).toBeNull();
    expect(await screen.findByRole('button', { name: ANNA_OFFEN })).toBeTruthy();
  });

  it('Gast: rot durchgestrichen, Klick → Entwurfs-Fenster', async () => {
    zeige({ entwuerfe: nachgebaut({ laden: () => Promise.resolve(daten([GAST_WEG])) }) });
    await screen.findByRole('table', { name: 'Personen und ihre Einsätze' });
    const k = await screen.findByRole('button', {
      name: 'Onkel Otto (Gast) – wird zurückgezogen, öffnen',
    });
    expect(k.className).toMatch(/zurueck/);
    fireEvent.click(k);
    expect(await screen.findByRole('button', { name: 'Entfernen' })).toBeTruthy();
  });

  it('der Entwurf eines anderen Planers: gleiches Fenster wie in der Matrix (nicht „eigener“)', async () => {
    const fremd = entwurf({ ...WEG, von: { personId: 99, name: 'Ben Planer' } });
    zeige({ entwuerfe: nachgebaut({ laden: () => Promise.resolve(daten([fremd])) }) });
    await screen.findByRole('table', { name: 'Personen und ihre Einsätze' });
    fireEvent.click(await screen.findByRole('button', { name: ANNA_ENTWURF }));
    expect(await screen.findByRole('button', { name: 'Entfernen' })).toBeTruthy();
  });

  it('ohne Recht: kein Knopf an der durchgestrichenen Zelle', async () => {
    zeige({ entwuerfe: nachgebaut({ laden: () => Promise.resolve(daten([WEG])) }) }, PLAN_OHNE);
    const t = await screen.findByRole('table', { name: 'Personen und ihre Einsätze' });
    await within(t).findByRole('img', { name: 'Ton, wird zurückgezogen' });
    expect(screen.queryByRole('button', { name: /öffnen/ })).toBeNull();
  });
});

describe('Personen – „Andere Person wählen“ aus dem Fenster', () => {
  it('„Wer kann?“ für diesen Platz; die Wahl ist ein Ersetzen-Entwurf – Anna steht durchgestrichen, die neue Person als Entwurf in ihrer Zeile', async () => {
    vi.mocked(ladeWerKann).mockResolvedValue([
      { person: { domainIdentifier: '8', title: 'Ben Test' }, score: 0 },
    ]);
    const s = gespeichert();
    zeige({ entwuerfe: nachgebaut({ speichern: s }) });
    const t = await warte();
    fireEvent.click(await screen.findByRole('button', { name: ANNA_OFFEN }));
    fireEvent.click(screen.getByRole('button', { name: 'Andere Person wählen' }));
    // „Wer kann?“ für den Platz von Anna – die Kandidaten sind Knöpfe ohne `aria-pressed` (anders als der Name im Raster).
    expect(await screen.findByText(/· statt Anna Test/)).toBeTruthy();
    await waitFor(() =>
      expect(
        screen
          .getAllByRole('button', { name: /^Ben Test(?! für)/ })
          .some((k) => !k.hasAttribute('aria-pressed')),
      ).toBe(true),
    );
    fireEvent.click(
      screen
        .getAllByRole('button', { name: /^Ben Test(?! für)/ })
        .find((k) => !k.hasAttribute('aria-pressed'))!,
    );
    await waitFor(() => expect(s).toHaveBeenCalledTimes(1));
    expect(s.mock.calls[0][2]).toMatchObject({
      ort: { eventId: 20, serviceId: 6, index: 1 },
      ziel: { art: 'person', personId: 8, name: 'Ben Test' },
      gesehen: { art: 'zusage', personId: 5 },
    });
    // Anna: weggenommen (durchgestrichen), Ben: Entwurf in seiner Zeile.
    await within(t).findByRole('img', { name: 'Ton, wird zurückgezogen' });
    const zeileBen = within(t)
      .getAllByText('Ben Test', { selector: 'span' })
      .map((e) => e.closest('tr')!)[0];
    expect(within(zeileBen).getByRole('img', { name: 'Ton, Entwurf, Anfrage' })).toBeTruthy();
  });
});
