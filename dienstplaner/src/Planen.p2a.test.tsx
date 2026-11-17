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
 * **Eintragen per Klick in „Personen“** (Wunsch 5, P2a). Echter Plan (`planAus` + `start.ts`), echte Ansicht – nur
 * ChurchTools ist nachgebaut. Die Rechnung selbst prüft `shared/dienstplan/personenEintragen.test.ts`; hier geht es um
 * Klick, Fenster und darum, dass derselbe Weg wie in „Wer kann?“ genommen wird.
 *
 * Ton (Technik, Gruppe 3 – dort gibt es die Schublade) mit Anna, Ben, Carla, Daniel als Mitglieder; Gesang (Musik,
 * Gruppe 4, **ohne** Schublade) mit Carla und Daniel.
 * - Fr 20.11.: Ton Anna zugesagt + 1 frei; Gesang Daniel zugesagt (also steht Daniel im Ton „+ Gesang“)
 * - So 22.11.: Ton 2 frei; Ben ist krank (abwesend)
 * - So 29.11.: Ton 2 frei; Gesang Carla angefragt; Carla ist im Urlaub (28.–30.11.)
 * - Mi 02.12.: Ton Anna + Ben – voll
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

function zeige(extra: Partial<ComponentProps<typeof Planen>> = {}) {
  localStorage.setItem('dienstplaner.planen.ansicht', JSON.stringify({ unteransicht: 'raster' }));
  return render(
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan: PLAN, wochen: 8 }}
      handy={false}
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
/** Das Warn-/Hinweisfenster. */
const fenster = () => screen.findByRole('alertdialog');

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Personen – Klick in eine leere Zelle', () => {
  it('legt sofort einen Entwurf an – derselbe Aufruf wie die Wahl in „Wer kann?“, auf den ersten freien Platz', async () => {
    const s = speichern();
    zeige({ entwuerfe: nachgebaut({ speichern: s }) });
    await warte();
    fireEvent.click(await knopf('Daniel Test', 'Ton', 'So, 22.11.'));
    await waitFor(() => expect(s).toHaveBeenCalledTimes(1));
    // (daten, gruppeId, eingabe, erwartet)
    expect(s.mock.calls[0][1]).toBe(3);
    expect(s.mock.calls[0][2]).toMatchObject({
      ort: { eventId: 21, serviceId: 6, index: 1 },
      ziel: { art: 'person', personId: 12, name: 'Daniel Test' },
      gesehen: { art: 'frei' },
    });
    expect(s.mock.calls[0][3]).toBeNull();
    expect(await screen.findByText('Daniel Test eingetragen – noch nicht gesendet.')).toBeTruthy();
    // Kein Fenster bei einem sauberen Eintrag.
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('danach zeigt die Zelle den Entwurf (blau, „?“ = Anfrage) und unten steht die Leiste „Ansehen und senden“', async () => {
    zeige();
    const t = await warte();
    expect(screen.queryByRole('status', { name: 'Noch nicht gesendet' })).toBeNull();
    expect(within(t).queryByRole('img', { name: 'Ton, Entwurf, Anfrage' })).toBeNull();
    fireEvent.click(await knopf('Daniel Test', 'Ton', 'So, 22.11.'));
    const tag = await within(t).findByRole('img', { name: 'Ton, Entwurf, Anfrage' });
    expect(tag.closest('tr')!.textContent).toContain('Daniel Test');
    const leiste = await screen.findByRole('status', { name: 'Noch nicht gesendet' });
    expect(leiste.textContent).toContain('1 Entwurf');
    expect(within(leiste).getByRole('button', { name: 'Ansehen und senden' })).toBeTruthy();
    // Die Zelle ist jetzt „Entwurf wegnehmen“ – ein zweiter Klick legt keinen zweiten an.
    expect(keiner('Daniel Test', 'Ton', 'So, 22.11.')).toBeNull();
  });

  it('ein Klick irgendwo in der Zelle zählt – auch einer neben dem Knopf (z. B. auf „+ Gesang“)', async () => {
    const s = speichern();
    zeige({ entwuerfe: nachgebaut({ speichern: s }) });
    const t = await warte();
    await knopf('Daniel Test', 'Ton', 'Fr, 20.11.');
    // Die Zelle von Daniel im Ton am 20.11. trägt „+ Gesang“; ein Klick darauf (steigt zur Zelle auf) fragt nach.
    const dazu = within(t)
      .getAllByText('+ Gesang')
      .find((e) => e.closest('tr')?.textContent?.includes('Daniel'))!;
    fireEvent.click(dazu);
    expect(await fenster()).toBeTruthy();
    expect(s).not.toHaveBeenCalled();
  });

  it('der zweite Klick während des Speicherns zählt nicht – es entsteht nur ein Entwurf', async () => {
    let fertig: (r: EntwurfErgebnis) => void = () => {};
    const s = vi.fn(() => new Promise<EntwurfErgebnis>((ok) => (fertig = ok)));
    zeige({ entwuerfe: nachgebaut({ speichern: s }) });
    await warte();
    const k = await knopf('Daniel Test', 'Ton', 'So, 22.11.');
    fireEvent.click(k);
    fireEvent.click(k);
    expect(s).toHaveBeenCalledTimes(1);
    fertig({ ok: false, grund: 'voruebergehend' });
    await waitFor(() => expect(k).toBeTruthy());
  });

  it('ein Fehler geht nicht verloren: Hinweis, kein Entwurf, die Zelle bleibt anklickbar', async () => {
    const s = vi.fn(() => Promise.resolve({ ok: false, grund: 'konflikt' } as EntwurfErgebnis));
    zeige({ entwuerfe: nachgebaut({ speichern: s }) });
    await warte();
    fireEvent.click(await knopf('Daniel Test', 'Ton', 'So, 22.11.'));
    expect(await screen.findByText(/hat eben jemand den Platz geändert/)).toBeTruthy();
    expect(keiner('Daniel Test', 'Ton', 'So, 22.11.')).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Ton, Entwurf, Anfrage' })).toBeNull();
  });

  it('der Klick auf den Namen setzt weiter den Fokus – der Klick in die Zelle nicht', async () => {
    zeige();
    await warte();
    fireEvent.click(await knopf('Daniel Test', 'Ton', 'So, 22.11.'));
    await screen.findByRole('img', { name: 'Ton, Entwurf, Anfrage' });
    expect(screen.queryByRole('status', { name: 'Fokus' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { pressed: false, name: /Daniel Test/ })[0]);
    expect(await screen.findByRole('status', { name: 'Fokus' })).toBeTruthy();
  });
});

describe('Personen – Klick auf den eigenen Entwurf', () => {
  // „direkt“: Ab P2m stellt der Klick eine Anfrage erst auf direkt um (Zyklus: Planen.p2m.test.tsx) – weg geht es dann.
  const e = entwurf({
    ort: { eventId: 21, serviceId: 6, index: 1 },
    ziel: { art: 'person', personId: 12, name: 'Daniel Test' },
    modus: 'direkt',
    version: 4,
  });

  it('nimmt ihn weg – derselbe Aufruf wie „Entfernen“ im Entwurfs-Fach, mit der gesehenen Version', async () => {
    const f = entfernt();
    zeige({
      entwuerfe: nachgebaut({ entfernen: f, laden: () => Promise.resolve(daten([e])) }),
    });
    const t = await screen.findByRole('table', { name: 'Personen und ihre Einsätze' });
    await within(t).findByRole('img', { name: 'Ton, Entwurf, direkt' });
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Daniel Test für Ton am So, 22.11.: Entwurf wegnehmen',
      }),
    );
    await waitFor(() => expect(f).toHaveBeenCalledTimes(1));
    expect(f).toHaveBeenCalledWith(expect.anything(), 3, e.ort, 4);
    expect(await screen.findByText('Entwurf entfernt.')).toBeTruthy();
    await waitFor(() =>
      expect(within(t).queryByRole('img', { name: 'Ton, Entwurf, direkt' })).toBeNull(),
    );
    // Die Zelle ist wieder leer und lädt zum Eintragen ein.
    expect(await knopf('Daniel Test', 'Ton', 'So, 22.11.')).toBeTruthy();
  });

  it('scheitert das Wegnehmen, sagt es der Hinweis – der Entwurf bleibt stehen', async () => {
    const f = vi.fn(() =>
      Promise.resolve({ ok: false, grund: 'voruebergehend' } as EntwurfErgebnis),
    );
    zeige({ entwuerfe: nachgebaut({ entfernen: f, laden: () => Promise.resolve(daten([e])) }) });
    const t = await screen.findByRole('table', { name: 'Personen und ihre Einsätze' });
    await within(t).findByRole('img', { name: 'Ton, Entwurf, direkt' });
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Daniel Test für Ton am So, 22.11.: Entwurf wegnehmen',
      }),
    );
    expect(await screen.findByText(/ChurchTools antwortet gerade nicht/)).toBeTruthy();
    expect(within(t).getByRole('img', { name: 'Ton, Entwurf, direkt' })).toBeTruthy();
  });

  it('der Entwurf eines anderen Planers ist kein Knopf – den nimmt man nicht mit einem Klick weg', async () => {
    const f = entfernt();
    const fremd = entwurf({ ...e, von: { personId: 99, name: 'Ben Planer' } });
    zeige({
      entwuerfe: nachgebaut({ entfernen: f, laden: () => Promise.resolve(daten([fremd])) }),
    });
    const t = await screen.findByRole('table', { name: 'Personen und ihre Einsätze' });
    await within(t).findByRole('img', { name: 'Ton, Entwurf, direkt' });
    expect(
      screen.queryByRole('button', { name: /Entwurf wegnehmen|auf direkt umstellen/ }),
    ).toBeNull();
    fireEvent.click(within(t).getByRole('img', { name: 'Ton, Entwurf, direkt' }).closest('td')!);
    expect(f).not.toHaveBeenCalled();
  });
});

describe('Personen – Warnfenster', () => {
  it('am selben Tag schon in einem anderen Dienst: Fenster mit dem Satz, „Abbrechen“ legt nichts an', async () => {
    const s = speichern();
    zeige({ entwuerfe: nachgebaut({ speichern: s }) });
    await warte();
    fireEvent.click(await knopf('Daniel Test', 'Ton', 'Fr, 20.11.'));
    const f = await fenster();
    expect(f.textContent).toContain(
      'Daniel Test ist am Fr, 20.11. schon bei Gesang eingeteilt. Trotzdem für Ton eintragen?',
    );
    expect(s).not.toHaveBeenCalled();
    fireEvent.click(within(f).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(s).not.toHaveBeenCalled();
  });

  it('„Trotzdem eintragen“ legt den Entwurf an – auf den freien Platz 2 dieses Termins', async () => {
    const s = speichern();
    zeige({ entwuerfe: nachgebaut({ speichern: s }) });
    await warte();
    fireEvent.click(await knopf('Daniel Test', 'Ton', 'Fr, 20.11.'));
    fireEvent.click(within(await fenster()).getByRole('button', { name: 'Trotzdem eintragen' }));
    await waitFor(() => expect(s).toHaveBeenCalledTimes(1));
    expect(s.mock.calls[0][2]).toMatchObject({
      ort: { eventId: 20, serviceId: 6, index: 2 },
      ziel: { art: 'person', personId: 12 },
    });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('abwesend: Grund und Zeitraum stehen im Fenster', async () => {
    const s = speichern();
    zeige({ entwuerfe: nachgebaut({ speichern: s }) });
    await warte();
    fireEvent.click(await knopf('Ben Test', 'Ton', 'So, 22.11.'));
    expect((await fenster()).textContent).toContain(
      'Ben Test ist am So, 22.11. abwesend: Krank (22.11.). Trotzdem für Ton eintragen?',
    );
    expect(s).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Trotzdem eintragen' }));
    await waitFor(() => expect(s).toHaveBeenCalledTimes(1));
  });

  it('beides zugleich: ein Fenster mit beiden Sätzen', async () => {
    zeige();
    await warte();
    fireEvent.click(await knopf('Carla Test', 'Ton', 'So, 29.11.'));
    const text = (await fenster()).textContent ?? '';
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
    expect(text).toContain('Carla Test ist am So, 29.11. schon bei Gesang eingeteilt.');
    expect(text).toContain('Carla Test ist am So, 29.11. abwesend: Urlaub (28.11.–30.11.).');
    expect(text).toContain('Trotzdem für Ton eintragen?');
  });
});

describe('Personen – Dienst voll', () => {
  it('ein schlichtes Fenster, das auf den Regler verweist – es wird nichts eingetragen', async () => {
    const s = speichern();
    zeige({ entwuerfe: nachgebaut({ speichern: s }) });
    await warte();
    fireEvent.click(await knopf('Daniel Test', 'Ton', 'Mi, 02.12.'));
    const f = await fenster();
    expect(within(f).getByText('Ton ist voll')).toBeTruthy();
    expect(f.textContent).toContain(
      'Ton am 02.12. ist voll (2 von 2). Platz dazunehmen geht im Moment über den Regler in der Matrix.',
    );
    expect(within(f).queryByRole('button', { name: 'Trotzdem eintragen' })).toBeNull();
    fireEvent.click(within(f).getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(s).not.toHaveBeenCalled();
  });
});

describe('Personen – wo nicht eingetragen werden darf, bleibt die Zelle wie bisher', () => {
  it('Dienst ohne Schublade (Gesang) und bestehende Einteilungen: kein Eintragen-Knopf, ein Klick legt keinen Entwurf an', async () => {
    const s = speichern();
    zeige({ entwuerfe: nachgebaut({ speichern: s }) });
    await warte();
    await knopf('Daniel Test', 'Ton', 'So, 22.11.');
    // Gesang: keine Schublade für Musik → nirgends ein Eintragen-Knopf.
    expect(screen.queryAllByRole('button', { name: /für Gesang am .* eintragen/ })).toHaveLength(0);
    // Bestehende Einteilung (Anna, Ton, Fr 20.11. zugesagt): kein EINTRAGEN-Knopf – der Klick öffnet seit P2b das Fenster
    // am belegten Platz (Planen.p2b.test.tsx), legt aber nie einen Entwurf an.
    expect(keiner('Anna Test', 'Ton', 'Fr, 20.11.')).toBeNull();
    const t = screen.getByRole('table', { name: 'Personen und ihre Einsätze' });
    for (const tag of within(t).getAllByRole('img', { name: 'Ton, zugesagt' }))
      fireEvent.click(tag.closest('td')!);
    fireEvent.click(within(t).getByRole('img', { name: 'Gesang, zugesagt' }).closest('td')!);
    expect(s).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('Dienst, den man nur ansehen darf (auch wenn die Schublade bereit ist): kein Knopf', async () => {
    const nurAnsehen = planAus(ROH, {
      ichId: START.ichId,
      dienste: START.dienste,
      dienstgruppen: START.dienstgruppen,
      zeitzone: 'Europe/Berlin',
      planbar: () => false,
      ganzSichtbar: () => true,
    });
    zeige({ zustand: { art: 'fertig', zeilen: [], plan: nurAnsehen, wochen: 8 } });
    await warte();
    expect(screen.queryAllByRole('button', { name: / eintragen$/ })).toHaveLength(0);
  });

  it('ohne Anschluss für Entwürfe: nirgends ein Knopf, kein Fenster', async () => {
    zeige({ entwuerfe: undefined });
    await warte();
    expect(screen.queryAllByRole('button', { name: / eintragen$/ })).toHaveLength(0);
    const t = screen.getByRole('table', { name: 'Personen und ihre Einsätze' });
    for (const z of within(t).getAllByRole('cell')) fireEvent.click(z);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('Entwürfe noch nicht geladen: kein Knopf', async () => {
    zeige({ entwuerfe: nachgebaut({ laden: () => new Promise<never>(() => {}) }) });
    await warte();
    expect(screen.queryAllByRole('button', { name: / eintragen$/ })).toHaveLength(0);
  });

  it('Entwürfe nur zum Ansehen (Schublade „nur-lesen“): kein Knopf', async () => {
    zeige({
      entwuerfe: nachgebaut({ laden: () => Promise.resolve(daten([], { stand: 'nur-lesen' })) }),
    });
    await warte();
    expect(screen.queryAllByRole('button', { name: / eintragen$/ })).toHaveLength(0);
  });
});
