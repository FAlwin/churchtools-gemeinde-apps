// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { planAus, type Plan } from '@shared/dienstplan/plan';
import type { Entwurf, EntwurfErgebnis } from '@shared/dienstplan/entwuerfe';
import type { AnzahlErgebnis } from '@shared/dienstplan/anzahl';
import type { RohTermin } from '@shared/dienstplan/termine';
import type { GruppenStand, PersonenDaten } from '@shared/dienstplan/personenDaten';
import { abwesenheitenAus } from '@shared/dienstplan/personenDaten';
import { ALWIN, daten, entwurf, nachgebaut } from './entwurfAnschluss.testutil';
import type { EntwurfAnschluss } from './ladeEntwuerfe';
import { Planen } from './Planen';
import { ganzSichtbar, planbar } from './start';
import { startFuer } from './start.testutil';

/**
 * **Gäste von Hand eintragen** (Wunsch 5, P2d). Echter Plan (`planAus` + `start.ts`), echte Ansicht – nur ChurchTools ist
 * nachgebaut; nach „Platz dazunehmen“ „lädt“ die Hülle den Plan neu, wie die App.
 *
 * Ton (Technik, Gruppe 3 – mit Schublade) mit Anna, Ben, Daniel als Mitglieder:
 * - Fr 20.11.: Ton 3 Plätze, Anna zugesagt, zwei frei – keine Gäste (leere Gäste-Zelle)
 * - So 22.11.: Ton 2 Plätze, Gast „Marie Gast“ + ein freier Platz
 * - So 29.11.: Ton 3 Plätze, Anna + Ben zugesagt, einer frei
 * - Mi 02.12.: Ton 2 Plätze, Anna + Ben zugesagt – voll
 * - Do 03.12.: Ton 2 Plätze, voll, Carla ersetzt Ben als Entwurf
 * - Fr 04.12.: abgesagt, Ton 2 frei
 * - Sa 05.12.: nur Gesang – Ton ist dort „aus“
 */
const MI = 23;
const DO = 24;
const START = startFuer();
const p = (
  serviceId: number,
  personId: number | null,
  name: string | null,
  zu: boolean,
  index: number,
) => ({ serviceId, personId, name, isAccepted: zu, index });
const frei = (index: number) => p(6, null, null, true, index);
const anna = (i: number) => p(6, 5, 'Anna Test', true, i);
const ben = (i: number) => p(6, 8, 'Ben Test', true, i);

/** Die Termine – `tonMi`: so viele Plätze hat Ton am Mi 02.12. (nach „Platz dazunehmen“: 3). */
const roh = (tonMi = 2, gast = true): RohTermin[] =>
  [
    {
      id: 20,
      name: 'Gottesdienst',
      startDate: '2026-11-20T18:00:00Z',
      endDate: '2026-11-20T19:30:00Z',
      eventServices: [anna(1), frei(2), frei(3)],
    },
    {
      id: 21,
      name: 'Gottesdienst',
      startDate: '2026-11-22T09:00:00Z',
      endDate: '2026-11-22T10:30:00Z',
      eventServices: [gast ? p(6, null, 'Marie Gast', true, 1) : frei(1), frei(2)],
    },
    {
      id: 22,
      name: 'Gottesdienst',
      startDate: '2026-11-29T09:00:00Z',
      endDate: '2026-11-29T10:30:00Z',
      eventServices: [anna(1), ben(2), frei(3)],
    },
    {
      id: MI,
      name: 'Gottesdienst',
      startDate: '2026-12-02T17:00:00Z',
      endDate: '2026-12-02T18:30:00Z',
      eventServices: [anna(1), ben(2), ...(tonMi > 2 ? [frei(3)] : [])],
    },
    {
      id: DO,
      name: 'Gottesdienst',
      startDate: '2026-12-03T17:00:00Z',
      endDate: '2026-12-03T18:30:00Z',
      eventServices: [anna(1), ben(2)],
    },
    {
      id: 25,
      name: 'Gottesdienst',
      startDate: '2026-12-04T17:00:00Z',
      endDate: '2026-12-04T18:30:00Z',
      isCanceled: true,
      eventServices: [frei(1), frei(2)],
    },
    {
      id: 26,
      name: 'Gottesdienst',
      startDate: '2026-12-05T17:00:00Z',
      endDate: '2026-12-05T18:30:00Z',
      eventServices: [p(9, 12, 'Daniel Test', true, 1)],
    },
  ] as RohTermin[];
const planFuer = (start: ReturnType<typeof startFuer>, tonMi = 2, gast = true): Plan =>
  planAus(roh(tonMi, gast), {
    ichId: start.ichId,
    dienste: start.dienste,
    dienstgruppen: start.dienstgruppen,
    zeitzone: 'Europe/Berlin',
    planbar: (d) => planbar(start, d),
    ganzSichtbar: (d) => ganzSichtbar(start, d),
  });

const person = (id: number, name: string) => ({
  id,
  name,
  bild: null,
  initialen: name.slice(0, 2),
});
const ANNA = person(5, 'Anna Test');
const BEN = person(8, 'Ben Test');
const DANIEL = person(12, 'Daniel Test');
const da = (
  mitglieder: ReturnType<typeof person>[],
  abwesenheiten: Extract<GruppenStand, { art: 'da' }>['abwesenheiten'] = [],
): GruppenStand => ({ art: 'da', mitglieder, abwesenheiten });
const STAND: PersonenDaten = new Map<number, GruppenStand>([
  [
    7,
    da(
      [ANNA, BEN, DANIEL],
      abwesenheitenAus([
        {
          id: 1,
          person: { domainIdentifier: '12' },
          absenceReason: { nameTranslated: 'Krank' },
          startDate: '2026-12-03',
          endDate: '2026-12-03',
        },
      ]),
    ),
  ],
  [9, da([DANIEL])],
]);

/** Ein Entwurf an Ton: Carla ersetzt Ben am Do 03.12. (Platz 2) – der Dienst bleibt voll, aber es liegt ein Entwurf dort. */
const ERSETZT = entwurf({
  ort: { eventId: DO, serviceId: 6, index: 2 },
  ziel: { art: 'person', personId: 11, name: 'Carla Test' },
  gesehen: { art: 'zusage', personId: 8 },
});
/** Ein Gast-Entwurf auf den freien Platz am So 29.11. (Platz 3). */
const GAST_ENTWURF = entwurf({
  ort: { eventId: 22, serviceId: 6, index: 3 },
  ziel: { art: 'gast', name: 'Max Gast' },
  gesehen: { art: 'frei' },
});

const speichernOk = () =>
  vi.fn(
    (
      _d: unknown,
      _g: number,
      eingabe: Omit<Entwurf, 'zeit' | 'version' | 'von'>,
      _erwartet: number | null,
    ) =>
      Promise.resolve({
        ok: true as const,
        entwurf: { ...eingabe, von: ALWIN, zeit: '2026-11-16T10:00:00.000Z', version: 1 },
      }),
  );
/** Plätze ändern, das klappt – so viele, wie gewünscht. */
const anzahlOk = () =>
  vi.fn((_e: number, _s: number, _g: number, neu: number) =>
    Promise.resolve({ ok: true as const, anzahl: neu } satisfies AnzahlErgebnis),
  );

/**
 * Planen in einer Hülle, die wie die App den Plan neu lädt: `onAktualisieren` ersetzt den Plan durch den nach
 * „Platz dazunehmen“ (Ton am Mi mit 3 Plätzen) – oder tut nichts (`neuLadenKlappt: false`: das Neuladen scheitert).
 */
function Huelle({
  start,
  entwuerfe,
  neuLadenKlappt = true,
  ohneGast = false,
  aktualisiert,
}: {
  start: ReturnType<typeof startFuer>;
  entwuerfe: EntwurfAnschluss;
  neuLadenKlappt?: boolean;
  /** Kein Gast in ChurchTools – dann gibt es nur die Gäste-Zeile, die „immer da“ ist. */
  ohneGast?: boolean;
  aktualisiert: () => void;
}) {
  const [plan, setPlan] = useState(() => planFuer(start, 2, !ohneGast));
  return (
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan, wochen: 8 }}
      handy={false}
      onNochmal={() => {}}
      onAktualisieren={() => {
        aktualisiert();
        if (neuLadenKlappt) setPlan(planFuer(start, 3, !ohneGast));
      }}
      onMehr={() => {}}
      mehrMoeglich={false}
      ladeZeitraum={() => new Promise<never>(() => {})}
      heute="2026-11-16"
      ladePersonen={vi.fn(() => Promise.resolve(STAND))}
      entwuerfe={entwuerfe}
    />
  );
}

function zeige(
  o: {
    start?: ReturnType<typeof startFuer>;
    entwuerfe?: Partial<EntwurfAnschluss>;
    entwuerfeDaten?: Entwurf[];
    neuLadenKlappt?: boolean;
    ohneGast?: boolean;
    direkt?: number[];
  } = {},
) {
  localStorage.setItem(
    'dienstplaner.planen.ansicht',
    JSON.stringify({ unteransicht: 'raster', direktDienste: o.direkt ?? [] }),
  );
  const aktualisiert = vi.fn();
  const anzahl = anzahlOk();
  const speichern = speichernOk();
  const anschluss = nachgebaut({
    anzahl,
    speichern,
    laden: vi.fn(() => Promise.resolve(daten(o.entwuerfeDaten ?? []))),
    ...o.entwuerfe,
  });
  render(
    <Huelle
      start={o.start ?? START}
      entwuerfe={anschluss}
      neuLadenKlappt={o.neuLadenKlappt}
      ohneGast={o.ohneGast}
      aktualisiert={aktualisiert}
    />,
  );
  return {
    aktualisiert,
    anzahl: anschluss.anzahl as typeof anzahl,
    speichern: anschluss.speichern as typeof speichern,
  };
}

/** Wartet, bis Mitglieder und Abwesenheiten da sind (die Zeilen stehen). */
const warte = async () => {
  const t = await screen.findByRole('table', { name: 'Personen und ihre Einsätze' });
  await waitFor(() =>
    expect(within(t).getAllByText('Daniel Test', { selector: 'span' }).length).toBeGreaterThan(0),
  );
  return t;
};
/** Die Plätze-Zelle eines Dienstes an einem Termin: ihr Knopf (mit Recht) oder der Tag. */
const plaetzeKnopf = (dienst: string, tag: string, text: string) =>
  screen.queryByRole('button', { name: `Plätze ${dienst} am ${tag}: ${text} – ändern` });
const fenster = () => screen.findByRole('dialog');

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});

const gastKnopf = (dienst: string, tag: string) =>
  screen.findByRole('button', { name: `Gast für ${dienst} am ${tag} eintragen` });
const nameFeld = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Name eines Gastes' });
const tippe = (name: string) => fireEvent.change(nameFeld(), { target: { value: name } });
const eintragenButton = (f: HTMLElement, name = 'Als Entwurf eintragen') =>
  within(f).getByRole<HTMLButtonElement>('button', { name });

describe('Gäste-Zeile', () => {
  it('steht in jedem Dienst-Block, den man planen darf – auch ohne Gast – mit einem Knopf je Termin', async () => {
    zeige();
    const t = await warte();
    // Ton (planbar): die Zeile „Gäste“ steht, obwohl nur ein Termin einen Gast hat. Gesang (nicht planbar, keine Gäste): keine.
    expect(within(t).getAllByRole('rowheader', { name: 'Gäste' })).toHaveLength(1);
    expect(await gastKnopf('Ton', 'Fr, 20.11.')).toBeTruthy();
    expect(await gastKnopf('Ton', 'Mi, 02.12.')).toBeTruthy();
    expect(screen.queryAllByRole('button', { name: /Gast für Gesang/ })).toHaveLength(0);
    // Ton ist am Sa 05.12. „aus“ (kein Platz) – dort nichts.
    expect(
      screen.queryByRole('button', { name: 'Gast für Ton am Sa, 05.12. eintragen' }),
    ).toBeNull();
  });

  it('auch wenn im ganzen Block kein Gast steht: Zeile und Knöpfe sind da', async () => {
    zeige({ ohneGast: true });
    const t = await warte();
    expect(within(t).getAllByRole('rowheader', { name: 'Gäste' })).toHaveLength(1);
    expect(await gastKnopf('Ton', 'So, 22.11.')).toBeTruthy();
    expect(screen.queryAllByRole('button', { name: /\(Gast\)/ })).toHaveLength(0);
  });

  it('Klick in die leere Zelle öffnet „Gast eintragen – Ton · Fr, 20.11.“ mit Feld, Hinweis und Knöpfen', async () => {
    zeige();
    await warte();
    fireEvent.click(await gastKnopf('Ton', 'Fr, 20.11.'));
    const f = await fenster();
    expect(within(f).getByText('Gast eintragen – Ton · Fr, 20.11.')).toBeTruthy();
    expect(f.textContent).toContain('Gottesdienst · 19:00 Uhr');
    expect(f.textContent).toContain(
      'Zum Beispiel ein Gastprediger. Er bekommt keine Anfrage, sein Name steht im Plan.',
    );
    expect(nameFeld().placeholder).toBe('z. B. Andreas Reimer');
    expect(within(f).getByRole('button', { name: 'Abbrechen' })).toBeTruthy();
    expect(eintragenButton(f).disabled).toBe(true);
  });

  it('weniger als 2 Zeichen: Knopf aus (auch nur Leerzeichen); ab 2 an; Enter trägt ein', async () => {
    const { speichern } = zeige();
    await warte();
    fireEvent.click(await gastKnopf('Ton', 'Fr, 20.11.'));
    const f = await fenster();
    tippe('M');
    expect(eintragenButton(f).disabled).toBe(true);
    tippe('   M  ');
    expect(eintragenButton(f).disabled).toBe(true);
    // Enter bei zu kurzem Namen: nichts.
    fireEvent.submit(nameFeld().closest('form')!);
    expect(speichern).not.toHaveBeenCalled();
    tippe('Max Gast');
    expect(eintragenButton(f).disabled).toBe(false);
    fireEvent.submit(nameFeld().closest('form')!);
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
  });

  it('Eintragen legt einen Gast-Entwurf auf den ersten freien Platz an – ohne Rückfrage, Name ohne Leerzeichen am Rand', async () => {
    const { speichern } = zeige();
    await warte();
    fireEvent.click(await gastKnopf('Ton', 'Fr, 20.11.'));
    const f = await fenster();
    tippe('  Andreas Reimer ');
    fireEvent.click(eintragenButton(f));
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    // Schublade Technik (3); Platz 2 (Anna hat Platz 1), Ziel „Gast“, ohne Versions-Schutz.
    expect(speichern.mock.calls[0][1]).toBe(3);
    expect(speichern.mock.calls[0][2]).toMatchObject({
      ort: { eventId: 20, serviceId: 6, index: 2 },
      ziel: { art: 'gast', name: 'Andreas Reimer' },
      gesehen: { art: 'frei' },
    });
    expect(speichern.mock.calls[0][3]).toBeNull();
    expect(
      await screen.findByText('Andreas Reimer eingetragen – noch nicht gesendet.'),
    ).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('der Gast-Entwurf steht danach als Tag in der Zelle und zählt bei „Plätze“ mit', async () => {
    zeige();
    const t = await warte();
    expect(plaetzeKnopf('Ton', 'Fr, 20.11.', '1 von 3')).toBeTruthy();
    fireEvent.click(await gastKnopf('Ton', 'Fr, 20.11.'));
    await fenster();
    tippe('Andreas Reimer');
    fireEvent.click(screen.getByRole('button', { name: 'Als Entwurf eintragen' }));
    await within(t).findByRole('button', { name: 'Andreas Reimer (Gast) – Entwurf, öffnen' });
    await waitFor(() => expect(plaetzeKnopf('Ton', 'Fr, 20.11.', '2 von 3')).toBeTruthy());
  });

  it('Abbrechen und X tragen nichts ein', async () => {
    const { speichern } = zeige();
    await warte();
    fireEvent.click(await gastKnopf('Ton', 'Fr, 20.11.'));
    const f = await fenster();
    tippe('Max Gast');
    fireEvent.click(within(f).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(speichern).not.toHaveBeenCalled();
  });

  it('weiterer Gast: eine Zelle mit Gast hat ein „+“ – der zweite Gast kommt auf den nächsten freien Platz', async () => {
    const { speichern } = zeige();
    const t = await warte();
    // So 22.11.: Marie Gast steht auf Platz 1; die Zelle ist nicht mehr „leer“, hat aber das „+“.
    expect(within(t).getByRole('button', { name: 'Marie Gast (Gast), öffnen' })).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Gast für Ton am So, 22.11. eintragen' }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Weiteren Gast für Ton am So, 22.11. eintragen' }),
    );
    const f = await fenster();
    tippe('Zweiter Gast');
    fireEvent.click(eintragenButton(f));
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(speichern.mock.calls[0][2]).toMatchObject({
      ort: { eventId: 21, serviceId: 6, index: 2 },
      ziel: { art: 'gast', name: 'Zweiter Gast' },
    });
  });

  it('Gast-Tags verhalten sich wie in P2b: bestehender Gast → Zurückziehen-Fenster, Gast-Entwurf → Entwurfs-Fenster', async () => {
    zeige({ entwuerfeDaten: [GAST_ENTWURF] });
    const t = await warte();
    fireEvent.click(within(t).getByRole('button', { name: 'Marie Gast (Gast), öffnen' }));
    expect(await screen.findByRole('button', { name: 'Zurückziehen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Andere Person wählen' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fenster schließen' }));
    fireEvent.click(
      await within(t).findByRole('button', { name: 'Max Gast (Gast) – Entwurf, öffnen' }),
    );
    // Das Entwurfs-Fenster der Matrix (mit „Entfernen“).
    expect(await screen.findByRole('button', { name: 'Entfernen' })).toBeTruthy();
    // Und das „+“ steht auch neben dem Gast-Entwurf.
    expect(
      screen.getByRole('button', { name: 'Weiteren Gast für Ton am So, 29.11. eintragen' }),
    ).toBeTruthy();
  });

  it('der Zugriff geht über den Port der Wahl in „Wer kann?“ – Gast mit Ziel „gast“, keine Anfrage', async () => {
    const speichern = vi.fn(() =>
      Promise.resolve({ ok: false, grund: 'konflikt' } as EntwurfErgebnis),
    );
    zeige({ entwuerfe: { speichern } });
    await warte();
    fireEvent.click(await gastKnopf('Ton', 'Fr, 20.11.'));
    await fenster();
    tippe('Max Gast');
    fireEvent.click(screen.getByRole('button', { name: 'Als Entwurf eintragen' }));
    expect(await screen.findByText(/hat eben jemand den Platz geändert/)).toBeTruthy();
  });
});

describe('Gast bei vollem Dienst', () => {
  const vollOeffnen = async () => {
    await warte();
    fireEvent.click(await gastKnopf('Ton', 'Mi, 02.12.'));
    return fenster();
  };

  it('dasselbe Voll-Satz wie bei Personen, Hauptknopf „Platz dazunehmen (3)“ erst mit Namen', async () => {
    zeige();
    const f = await vollOeffnen();
    expect(f.textContent).toContain(
      'Ton am 02.12. ist voll (2 von 2). Platz dazunehmen und eintragen?',
    );
    expect(f.textContent).toContain(
      'Ton bekommt sofort einen dritten Platz (in ChurchTools gespeichert). Der Gast wird als Entwurf eingetragen.',
    );
    expect(within(f).queryByRole('button', { name: 'Als Entwurf eintragen' })).toBeNull();
    expect(eintragenButton(f, 'Platz dazunehmen (3)').disabled).toBe(true);
    tippe('Max Gast');
    expect(eintragenButton(f, 'Platz dazunehmen (3)').disabled).toBe(false);
  });

  it('erhöht erst die Platzzahl, legt nach dem Neuladen den Gast-Entwurf auf den NEUEN Platz an', async () => {
    const { anzahl, speichern, aktualisiert } = zeige();
    const f = await vollOeffnen();
    tippe('Max Gast');
    fireEvent.click(eintragenButton(f, 'Platz dazunehmen (3)'));
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(anzahl).toHaveBeenCalledWith(MI, 6, 2, 3);
    expect(aktualisiert).toHaveBeenCalledTimes(1);
    expect(anzahl.mock.invocationCallOrder[0]).toBeLessThan(speichern.mock.invocationCallOrder[0]);
    expect(aktualisiert.mock.invocationCallOrder[0]).toBeLessThan(
      speichern.mock.invocationCallOrder[0],
    );
    expect(speichern.mock.calls[0][2]).toMatchObject({
      ort: { eventId: MI, serviceId: 6, index: 3 },
      ziel: { art: 'gast', name: 'Max Gast' },
      gesehen: { art: 'frei' },
    });
    expect(await screen.findByText('Max Gast eingetragen – noch nicht gesendet.')).toBeTruthy();
    await waitFor(() => expect(plaetzeKnopf('Ton', 'Mi, 02.12.', '3 von 3')).toBeTruthy());
  });

  it('scheitert das Erhöhen: kein Entwurf, die Meldung des Reglers', async () => {
    const anzahl = vi.fn(() =>
      Promise.resolve({ ok: false, grund: 'konflikt', jetzt: 3 } as AnzahlErgebnis),
    );
    const { speichern } = zeige({ entwuerfe: { anzahl } });
    const f = await vollOeffnen();
    tippe('Max Gast');
    fireEvent.click(eintragenButton(f, 'Platz dazunehmen (3)'));
    expect(
      await screen.findByText('Ton: Jemand hat die Zahl eben geändert – jetzt 3. Nichts geändert.'),
    ).toBeTruthy();
    expect(speichern).not.toHaveBeenCalled();
  });

  it('Abbrechen: nichts wird erhöht', async () => {
    const { anzahl, speichern } = zeige();
    const f = await vollOeffnen();
    tippe('Max Gast');
    fireEvent.click(within(f).getByRole('button', { name: 'Abbrechen' }));
    expect(anzahl).not.toHaveBeenCalled();
    expect(speichern).not.toHaveBeenCalled();
  });

  it('liegt am Dienst ein Entwurf (Carla ersetzt Ben), geht „Platz dazunehmen“ trotzdem – die Entwürfe gehen mit (19.11.2026)', async () => {
    const { anzahl, speichern } = zeige({ entwuerfeDaten: [ERSETZT] });
    await warte();
    await waitFor(() =>
      expect(screen.queryByRole('status', { name: 'Noch nicht gesendet' })).toBeTruthy(),
    );
    fireEvent.click(await gastKnopf('Ton', 'Do, 03.12.'));
    const f = await fenster();
    expect(f.textContent).toContain(
      'Ton am 03.12. ist voll (2 von 2). Platz dazunehmen und eintragen?',
    );
    expect(f.textContent).not.toContain('Erst senden oder Entwürfe entfernen');
    expect(within(f).queryByRole('button', { name: 'Ansehen und senden' })).toBeNull();
    tippe('Max Gast');
    fireEvent.click(eintragenButton(f, 'Platz dazunehmen (3)'));
    await waitFor(() => expect(anzahl).toHaveBeenCalledWith(DO, 6, 2, 3));
    expect(speichern).not.toHaveBeenCalled(); // der neue Platz ist erst nach dem Neuladen da
  });
});

describe('Rechte und Sonderfälle', () => {
  it('ohne Recht, den Dienst zu planen: keine Gäste-Zeile ohne Gäste, keine Knöpfe – vorhandene Gäste stehen da', async () => {
    const start = startFuer({
      rechte: {
        planbareDienstgruppen: [],
        sichtbareDienstgruppen: [3, 4],
        ablaufKalender: [],
        terminKalender: [],
        abwesenheitenAller: false,
      },
    });
    zeige({ start });
    const t = await warte();
    expect(screen.queryAllByRole('button', { name: /Gast für .* eintragen/ })).toHaveLength(0);
    expect(screen.queryAllByRole('button', { name: /Weiteren Gast/ })).toHaveLength(0);
    // Marie Gast steht als Tag (kein Knopf) – nur dieser eine Block hat eine Gäste-Zeile.
    expect(within(t).getAllByRole('rowheader', { name: 'Gäste' })).toHaveLength(1);
    expect(within(t).queryByRole('button', { name: /\(Gast\), öffnen/ })).toBeNull();
    expect(within(t).getByTitle('Marie Gast (Gast)')).toBeTruthy();
  });

  it('abgesagter Termin: keine Gast-Knöpfe, auch kein „+“', async () => {
    zeige();
    await warte();
    await gastKnopf('Ton', 'Fr, 20.11.');
    expect(
      screen.queryByRole('button', { name: /Gast für Ton am Fr, 04.12. eintragen/ }),
    ).toBeNull();
  });

  it('Entwürfe nicht bereit (keine Schublade): keine Gast-Knöpfe', async () => {
    zeige({ entwuerfe: { laden: vi.fn(() => new Promise<never>(() => {})) } });
    await warte();
    expect(screen.queryAllByRole('button', { name: /Gast für .* eintragen/ })).toHaveLength(0);
  });
});
