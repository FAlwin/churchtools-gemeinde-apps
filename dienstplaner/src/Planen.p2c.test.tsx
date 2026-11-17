// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
 * **Plätze in „Personen“ einstellen** (Wunsch 5, P2c). Echter Plan (`planAus` + `start.ts`), echte Ansicht – nur
 * ChurchTools ist nachgebaut; nach dem Erhöhen „lädt“ die Hülle den Plan neu (`onAktualisieren`), wie die App.
 *
 * Ton (Technik, Gruppe 3 – mit Schublade) mit Anna, Ben, Daniel als Mitglieder:
 * - Fr 20.11.: Ton 3 Plätze, Anna zugesagt (1 von 3)
 * - So 22.11.: Ton 2 Plätze, beide frei (0 von 2)
 * - So 29.11.: Ton 3 Plätze, Anna + Ben zugesagt (2 von 3)
 * - Mi 02.12.: Ton 2 Plätze, Anna + Ben zugesagt – voll; Daniel ist abwesend? nein (nur Do)
 * - Do 03.12.: Ton 2 Plätze, Anna + Ben zugesagt – voll, aber Carla ersetzt Ben als Entwurf (Sperre); Daniel abwesend
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
const roh = (tonMi = 2): RohTermin[] =>
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
      eventServices: [frei(1), frei(2)],
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
const planFuer = (start: ReturnType<typeof startFuer>, tonMi = 2): Plan =>
  planAus(roh(tonMi), {
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
/** Ein Entwurf auf den freien Platz am So 29.11. – Daniel (der Platz zählt dann als belegt). */
const AUF_FREIEN = entwurf({
  ort: { eventId: 22, serviceId: 6, index: 3 },
  ziel: { art: 'person', personId: 12, name: 'Daniel Test' },
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
  aktualisiert,
}: {
  start: ReturnType<typeof startFuer>;
  entwuerfe: EntwurfAnschluss;
  neuLadenKlappt?: boolean;
  aktualisiert: () => void;
}) {
  const [plan, setPlan] = useState(() => planFuer(start));
  return (
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan, wochen: 8 }}
      handy={false}
      onNochmal={() => {}}
      onAktualisieren={() => {
        aktualisiert();
        if (neuLadenKlappt) setPlan(planFuer(start, 3));
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
const eintragenKnopf = (name: string, dienst: string, tag: string) =>
  screen.findByRole('button', { name: `${name} für ${dienst} am ${tag} eintragen` });

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});

describe('Zeile „Plätze“', () => {
  it('zeigt je Termin „belegt von Plätzen“ – Entwürfe zählen mit (wie „Noch offen“)', async () => {
    zeige({ entwuerfeDaten: [AUF_FREIEN] });
    const t = await warte();
    // Entwurf auf den freien Platz am 29.11. → „3 von 3“ (ohne Entwurf: „2 von 3“).
    await waitFor(() => expect(plaetzeKnopf('Ton', 'So, 29.11.', '3 von 3')).toBeTruthy());
    expect(plaetzeKnopf('Ton', 'Fr, 20.11.', '1 von 3')).toBeTruthy();
    expect(plaetzeKnopf('Ton', 'So, 22.11.', '0 von 2')).toBeTruthy();
    expect(plaetzeKnopf('Ton', 'Mi, 02.12.', '2 von 2')).toBeTruthy();
    // Das Zeilenkopf-Feld heißt „Plätze“, einmal je Block (Ton und Gesang).
    expect(within(t).getAllByRole('rowheader', { name: 'Plätze' })).toHaveLength(2);
  });

  it('freie Plätze rot, voll neutral, ohne Plätze „aus“ – und „Noch offen“ nennt dieselben Dienste', async () => {
    zeige();
    await warte();
    const rot = (text: string, tag: string) =>
      plaetzeKnopf('Ton', tag, text)!.querySelector('span')!.className;
    expect(rot('1 von 3', 'Fr, 20.11.')).toMatch(/offenTag/);
    expect(rot('0 von 2', 'So, 22.11.')).toMatch(/offenTag/);
    expect(rot('2 von 2', 'Mi, 02.12.')).not.toMatch(/offenTag/);
    // Sa 05.12.: Ton ist dort nicht vorgesehen – „aus“, anklickbar (dort schaltet „+“ ihn ein).
    expect(plaetzeKnopf('Ton', 'Sa, 05.12.', 'aus')).toBeTruthy();
  });

  it('ein Klick öffnet das Fenster dieses Dienstes an diesem Termin – „+“ speichert über denselben Port wie der Regler', async () => {
    const { anzahl, aktualisiert } = zeige();
    await warte();
    fireEvent.click(plaetzeKnopf('Ton', 'So, 22.11.', '0 von 2')!);
    const f = await fenster();
    expect(within(f).getByText('Plätze – Ton · So, 22.11.')).toBeTruthy();
    expect(f.textContent).toContain('belegt 0 · Plätze 2 · frei 2');
    fireEvent.click(within(f).getByRole('button', { name: 'Ton: ein Platz mehr' }));
    // (terminId, dienstId, gesehen, neu) – derselbe Aufruf wie im Regler der Matrix (`PlaetzeFach.aendern`).
    await waitFor(() => expect(anzahl).toHaveBeenCalledWith(21, 6, 2, 3));
    expect(await screen.findByText('Ton: jetzt 3 Plätze.')).toBeTruthy();
    expect(within(f).getByLabelText('Ton: 3 Plätze')).toBeTruthy();
    // Keine Obergrenze: weiter hoch.
    fireEvent.click(within(f).getByRole('button', { name: 'Ton: ein Platz mehr' }));
    await waitFor(() => expect(anzahl).toHaveBeenCalledWith(21, 6, 3, 4));
    // Schließen lädt neu – die Zeile zeigt dann, was in ChurchTools steht.
    expect(aktualisiert).not.toHaveBeenCalled();
    fireEvent.click(within(f).getByRole('button', { name: 'Fenster schließen' }));
    expect(aktualisiert).toHaveBeenCalledTimes(1);
  });

  it('der rote Tag in „Noch offen“ öffnet dasselbe Fenster', async () => {
    zeige();
    const t = await warte();
    // „Ton ×2“ steht am So 22.11. (beide Plätze frei).
    fireEvent.click(within(t).getByRole('button', { name: 'Plätze Ton am So, 22.11. ändern' }));
    const f = await fenster();
    expect(within(f).getByText('Plätze – Ton · So, 22.11.')).toBeTruthy();
  });

  it('„−“ geht nicht unter die Belegten (Knopf aus, Hinweis wie im Regler); darüber geht es', async () => {
    const { anzahl } = zeige();
    await warte();
    // Mi 02.12.: 2 von 2 belegt → − gesperrt.
    fireEvent.click(plaetzeKnopf('Ton', 'Mi, 02.12.', '2 von 2')!);
    let f = await fenster();
    expect(within(f).getByRole('button', { name: 'Ton: ein Platz weniger' }).disabled).toBe(true);
    expect(f.textContent).toContain('Erst jemanden herausnehmen');
    fireEvent.click(within(f).getByRole('button', { name: 'Fenster schließen' }));
    // So 29.11.: 2 von 3 → − geht auf 2.
    fireEvent.click(plaetzeKnopf('Ton', 'So, 29.11.', '2 von 3')!);
    f = await fenster();
    fireEvent.click(within(f).getByRole('button', { name: 'Ton: ein Platz weniger' }));
    await waitFor(() => expect(anzahl).toHaveBeenCalledWith(22, 6, 3, 2));
  });

  it('liegt an diesem Dienst und Termin ein Entwurf: − und + gesperrt, mit dem Satz des Reglers', async () => {
    const { anzahl } = zeige({ entwuerfeDaten: [AUF_FREIEN] });
    await warte();
    await waitFor(() => expect(plaetzeKnopf('Ton', 'So, 29.11.', '3 von 3')).toBeTruthy());
    fireEvent.click(plaetzeKnopf('Ton', 'So, 29.11.', '3 von 3')!);
    const f = await fenster();
    expect(f.textContent).toContain('Hier liegt ein Entwurf – erst senden oder entfernen.');
    for (const name of ['Ton: ein Platz weniger', 'Ton: ein Platz mehr'])
      expect(within(f).getByRole('button', { name }).disabled).toBe(true);
    expect(anzahl).not.toHaveBeenCalled();
  });

  it('ein Fehler beim Speichern erscheint im Fenster – mit der Meldung des Reglers', async () => {
    const anzahl = vi.fn(() =>
      Promise.resolve({ ok: false, grund: 'konflikt', jetzt: 4 } as AnzahlErgebnis),
    );
    zeige({ entwuerfe: { anzahl } });
    await warte();
    fireEvent.click(plaetzeKnopf('Ton', 'So, 22.11.', '0 von 2')!);
    const f = await fenster();
    fireEvent.click(within(f).getByRole('button', { name: 'Ton: ein Platz mehr' }));
    expect(
      await within(f).findByText(
        'Ton: Jemand hat die Zahl eben geändert – jetzt 4. Nichts geändert.',
      ),
    ).toBeTruthy();
    expect(within(f).getByLabelText('Ton: 4 Plätze')).toBeTruthy();
  });

  it('abgesagter Termin: kein Regler – weder in der Zeile noch am roten Tag', async () => {
    zeige();
    const t = await warte();
    expect(plaetzeKnopf('Ton', 'Fr, 04.12.', '0 von 2')).toBeNull();
    expect(within(t).queryByRole('button', { name: 'Plätze Ton am Fr, 04.12. ändern' })).toBeNull();
    // Die Zahl steht trotzdem da (neutral, nicht rot).
    const zelle = within(t)
      .getAllByText('0 von 2')
      .find((e) => e.closest('td')?.className.includes('abgesagt'));
    expect(zelle).toBeTruthy();
    expect(
      zelle!.closest('span.' + zelle!.parentElement!.className.split(' ')[0])!.className,
    ).not.toMatch(/offenTag/);
  });

  it('ohne Recht, den Dienst zu planen: nichts zum Anklicken, die Zahlen stehen trotzdem da', async () => {
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
    expect(within(t).getAllByText('0 von 2').length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('button', { name: /Plätze .* ändern/ })).toHaveLength(0);
  });
});

describe('Dienst voll – „Platz dazunehmen“', () => {
  const vollKlick = async () => {
    await warte();
    fireEvent.click(await eintragenKnopf('Daniel Test', 'Ton', 'Mi, 02.12.'));
    return screen.findByRole('alertdialog');
  };

  it('erhöht erst die Platzzahl in ChurchTools und legt nach dem Neuladen – auf dem neuen Platz – den Entwurf an', async () => {
    const { anzahl, speichern, aktualisiert } = zeige();
    const f = await vollKlick();
    expect(f.textContent).toContain('Ton am 02.12. ist voll (2 von 2).');
    expect(f.textContent).toContain(
      'Ton bekommt sofort einen dritten Platz (in ChurchTools gespeichert). Daniel Test wird als Entwurf eingetragen.',
    );
    fireEvent.click(within(f).getByRole('button', { name: 'Platz dazunehmen (3)' }));
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    // Erst die Plätze (2 → 3, derselbe Port wie der Regler), dann das Neuladen, dann der Entwurf.
    expect(anzahl).toHaveBeenCalledWith(MI, 6, 2, 3);
    expect(aktualisiert).toHaveBeenCalledTimes(1);
    expect(anzahl.mock.invocationCallOrder[0]).toBeLessThan(speichern.mock.invocationCallOrder[0]);
    expect(aktualisiert.mock.invocationCallOrder[0]).toBeLessThan(
      speichern.mock.invocationCallOrder[0],
    );
    // Auf den NEUEN Platz (Nummer 3), als Anfrage (Vorgabe), ohne Versions-Schutz.
    expect(speichern.mock.calls[0][1]).toBe(3);
    expect(speichern.mock.calls[0][2]).toMatchObject({
      ort: { eventId: MI, serviceId: 6, index: 3 },
      ziel: { art: 'person', personId: 12, name: 'Daniel Test' },
      modus: 'anfrage',
      gesehen: { art: 'frei' },
    });
    expect(speichern.mock.calls[0][3]).toBeNull();
    expect(await screen.findByText('Daniel Test eingetragen – noch nicht gesendet.')).toBeTruthy();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    // Die Zeile „Plätze“ zeigt jetzt den dritten Platz – belegt vom Entwurf.
    await waitFor(() => expect(plaetzeKnopf('Ton', 'Mi, 02.12.', '3 von 3')).toBeTruthy());
  });

  it('der Modus kommt aus der Vorgabe des Dienstes (direkt) – wie beim normalen Klick', async () => {
    const { speichern } = zeige({ direkt: [6] });
    const f = await vollKlick();
    fireEvent.click(within(f).getByRole('button', { name: 'Platz dazunehmen (3)' }));
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(speichern.mock.calls[0][2]).toMatchObject({ modus: 'direkt' });
  });

  it('mit Warnung (abwesend) steht sie im selben Fenster: „… und trotzdem eintragen?“', async () => {
    zeige();
    await warte();
    // Do 03.12.: Daniel ist krank. Voll – aber mit Entwurf (Sperre); darum Mi 02.12. mit Daniel ist ohne Warnung. Hier:
    // Fr 20.11. hat Platz. Die Warnung gibt es also nur am Do – dort greift die Sperre zuerst (eigener Test unten).
    fireEvent.click(await eintragenKnopf('Daniel Test', 'Ton', 'Mi, 02.12.'));
    const f = await screen.findByRole('alertdialog');
    expect(within(f).getByText('Ton ist voll')).toBeTruthy();
    expect(f.textContent).toContain('Platz dazunehmen und eintragen?');
  });

  it('Abbrechen: nichts wird erhöht, nichts eingetragen', async () => {
    const { anzahl, speichern } = zeige();
    const f = await vollKlick();
    fireEvent.click(within(f).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(anzahl).not.toHaveBeenCalled();
    expect(speichern).not.toHaveBeenCalled();
  });

  it('scheitert das Erhöhen: kein Entwurf, die Meldung des Reglers', async () => {
    const anzahl = vi.fn(() =>
      Promise.resolve({ ok: false, grund: 'konflikt', jetzt: 3 } as AnzahlErgebnis),
    );
    const { speichern, aktualisiert } = zeige({ entwuerfe: { anzahl } });
    const f = await vollKlick();
    fireEvent.click(within(f).getByRole('button', { name: 'Platz dazunehmen (3)' }));
    expect(
      await screen.findByText('Ton: Jemand hat die Zahl eben geändert – jetzt 3. Nichts geändert.'),
    ).toBeTruthy();
    expect(speichern).not.toHaveBeenCalled();
    // Jemand hat die Zahl geändert: der Plan wird neu geladen, damit er zeigt, was jetzt dasteht.
    expect(aktualisiert).toHaveBeenCalledTimes(1);
  });

  it('scheitert das Erhöhen mit einem Fehler ohne neuen Stand (ChurchTools antwortet nicht): kein Entwurf, kein Neuladen', async () => {
    const anzahl = vi.fn(() =>
      Promise.resolve({ ok: false, grund: 'voruebergehend' } as AnzahlErgebnis),
    );
    const { speichern, aktualisiert } = zeige({ entwuerfe: { anzahl } });
    const f = await vollKlick();
    fireEvent.click(within(f).getByRole('button', { name: 'Platz dazunehmen (3)' }));
    expect(await screen.findByText(/ChurchTools antwortet gerade nicht/)).toBeTruthy();
    expect(speichern).not.toHaveBeenCalled();
    expect(aktualisiert).not.toHaveBeenCalled();
  });

  it('scheitert erst der Entwurf: der Platz bleibt, es erscheint die Meldung des Entwurfs', async () => {
    const speichern = vi.fn(() =>
      Promise.resolve({ ok: false, grund: 'konflikt' } as EntwurfErgebnis),
    );
    const { anzahl } = zeige({ entwuerfe: { speichern } });
    const f = await vollKlick();
    fireEvent.click(within(f).getByRole('button', { name: 'Platz dazunehmen (3)' }));
    expect(await screen.findByText(/hat eben jemand den Platz geändert/)).toBeTruthy();
    expect(anzahl).toHaveBeenCalledTimes(1);
    expect(speichern).toHaveBeenCalledTimes(1);
    // Der Platz bleibt: die Zeile „Plätze“ zeigt 3 Plätze, keiner belegt vom Entwurf.
    await waitFor(() => expect(plaetzeKnopf('Ton', 'Mi, 02.12.', '2 von 3')).toBeTruthy());
  });

  it('Erfolg erst glauben, wenn der neue Platz da ist: kommt er nicht, entsteht kein Entwurf – nach der Wartezeit eine Meldung', async () => {
    const { anzahl, speichern } = zeige({ neuLadenKlappt: false });
    const f = await vollKlick();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(within(f).getByRole('button', { name: 'Platz dazunehmen (3)' }));
    await waitFor(() => expect(anzahl).toHaveBeenCalledTimes(1));
    // Der Aufruf meldet „ok“ – aber der Termin hat den neuen Platz nie gezeigt: kein Entwurf.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(19_000);
    });
    expect(speichern).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(speichern).not.toHaveBeenCalled();
    expect(screen.getByText(/der Termin ließ sich aber nicht neu laden/)).toBeTruthy();
  });

  it('Sperre: liegt an Dienst und Termin ein Entwurf, kein Dazunehmen – Hinweis und „Ansehen und senden“', async () => {
    const { anzahl, speichern } = zeige({ entwuerfeDaten: [ERSETZT] });
    await warte();
    await waitFor(() =>
      expect(screen.queryByRole('status', { name: 'Noch nicht gesendet' })).toBeTruthy(),
    );
    // Do 03.12.: voll, Carla ersetzt Ben (Entwurf) – Daniel ist dort krank, die Sperre kommt vor der Warnung.
    fireEvent.click(await eintragenKnopf('Daniel Test', 'Ton', 'Do, 03.12.'));
    const f = await screen.findByRole('alertdialog');
    expect(f.textContent).toContain(
      'Ton am 03.12. ist voll (2 von 2). Erst senden oder Entwürfe entfernen.',
    );
    expect(within(f).queryByRole('button', { name: /Platz dazunehmen/ })).toBeNull();
    expect(anzahl).not.toHaveBeenCalled();
    fireEvent.click(within(f).getByRole('button', { name: 'Ansehen und senden' }));
    // Dasselbe Fenster wie die Leiste unten.
    expect(await screen.findByText(/Anfrage an Carla Test statt Ben Test/)).toBeTruthy();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(speichern).not.toHaveBeenCalled();
  });

  it('abgesagter Termin: kein Eintragen, also auch kein Dazunehmen', async () => {
    const { anzahl } = zeige();
    await warte();
    expect(screen.queryByRole('button', { name: /für Ton am Fr, 04.12. eintragen/ })).toBeNull();
    expect(anzahl).not.toHaveBeenCalled();
  });
});
