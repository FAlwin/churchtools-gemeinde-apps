// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { plusTage } from '@shared/ct/datum';
import { heuteImKalender } from '@shared/ct/zeit';
import {
  GRUNDWERTE,
  LEITER_RECHTE,
  sommerferienAus,
  wechseljahre,
} from '@shared/organigramm/gruppenwechsel';
import type { KjDaten, KjMitglied } from '@shared/organigramm/gruppenwechselSicht';
import type { Gelesen, RegelRoh } from '@shared/organigramm/einrichtungStand';
import { EinrichtenFenster } from './EinrichtenFenster';
import { EinrichtungSeite } from './EinrichtungSeite';
import { NachtragenFenster } from './NachtragenFenster';
import { RechteFenster } from './RechteFenster';
import { Wechseltage } from './Wechseltage';
import { einrichtenAusfuehren } from './ladeSchreibLage';
import { ladeFerien, ladeKjDaten } from './ladeKinderJugend';
import { ladeEinrichtungStand } from './ladeEinrichtungStand';
import { ladeKalenderNamen, ladeRegelnDerStufen, ladeTypVorhanden } from './ladeEinrichten';
import { schreibeEinrichtung, type Eingabe } from './einrichtenSchreiben';
import { anschluss, FakeCt, FakeSpeicher, S2 as FAKE_S2 } from './einrichtenSchreiben.testutil';
import { waehleSpitze } from './spitzenAuswahl.testutil';
import {
  EINRICHTUNG,
  FISCHE,
  gutesStand,
  JUNGSCHAR,
  SCHAEFCHEN,
  START,
} from './einrichten.testutil';

vi.mock('./ladeSchreibLage', () => ({ einrichtenAusfuehren: vi.fn() }));
vi.mock('./ladeKinderJugend', () => ({ ladeFerien: vi.fn(), ladeKjDaten: vi.fn() }));
// Nur die Leser der Vorschau werden ersetzt; `regelnLesen` und `statusAus` braucht das Schreiben echt.
vi.mock('./ladeEinrichtungStand', async (orig) => ({
  ...(await orig<typeof import('./ladeEinrichtungStand')>()),
  ladeEinrichtungStand: vi.fn(),
}));
vi.mock('./ladeEinrichten', async (orig) => ({
  ...(await orig<typeof import('./ladeEinrichten')>()),
  ladeKalenderNamen: vi.fn(),
  ladeTypVorhanden: vi.fn(),
  ladeRegelnDerStufen: vi.fn(),
}));
const schreibe = vi.mocked(einrichtenAusfuehren);
const ferienLaden = vi.mocked(ladeFerien);
const kjLaden = vi.mocked(ladeKjDaten);
const standLaden = vi.mocked(ladeEinrichtungStand);
const kalenderLaden = vi.mocked(ladeKalenderNamen);
const typLaden = vi.mocked(ladeTypVorhanden);
const regelnLaden = vi.mocked(ladeRegelnDerStufen);

const HEUTE = heuteImKalender();
const JAHR = Number(HEUTE.slice(0, 4)) + 1;
const ferienVon = (jahre: number[]) =>
  sommerferienAus(
    jahre.map((j) => ({
      titel: `Sommerferien NRW ${j}`,
      beginn: `${j}-07-19`,
      ende: `${j}-08-31`,
    })),
    GRUNDWERTE.ferienStichwort,
  );
const FERIEN = ferienVon([JAHR, JAHR + 1, JAHR + 2]);
const JAHRE = wechseljahre(FERIEN, GRUNDWERTE);

const kind = (personId: number, name: string): KjMitglied => ({
  personId,
  name,
  leitung: false,
  status: 'active',
  statusGeaendert: null,
});
const geb = (alter: number, jahr = JAHR) => `${jahr - alter}-03-15`;
const kjDaten = (jahr = JAHR): KjDaten => ({
  gruppen: new Map([
    [SCHAEFCHEN, { art: 'sichtbar', mitglieder: [kind(10, 'Anna'), kind(11, 'Ben')] }],
    [FISCHE, { art: 'sichtbar', mitglieder: [kind(20, 'Cleo')] }],
    [JUNGSCHAR, { art: 'sichtbar', mitglieder: [] }],
  ]),
  geburtstage: new Map<number, string | null>([
    [10, geb(7, jahr)],
    [11, geb(7, jahr)],
    [20, geb(10, jahr)],
  ]),
});
const ok = <T,>(wert: T): Gelesen<T> => ({ ok: true, wert });
const KEINE_REGELN = new Map<number, Gelesen<readonly RegelRoh[]>>([
  [SCHAEFCHEN, ok([])],
  [FISCHE, ok([])],
  [JUNGSCHAR, ok([])],
]);

const onSchliessen = vi.fn();
const onGeschrieben = vi.fn();

beforeEach(() => {
  onSchliessen.mockReset();
  onGeschrieben.mockReset();
  schreibe.mockReset();
  ferienLaden.mockReset().mockResolvedValue({ art: 'da', jahre: JAHRE, ferien: FERIEN });
  kjLaden.mockReset().mockResolvedValue({ art: 'da', daten: kjDaten(), rechte: new Map() });
  standLaden.mockReset().mockResolvedValue(gutesStand());
  kalenderLaden.mockReset().mockResolvedValue(ok([GRUNDWERTE.ferienkalender]));
  typLaden.mockReset().mockResolvedValue(ok(true));
  regelnLaden.mockReset().mockResolvedValue(KEINE_REGELN);
});
afterEach(cleanup);

/** Die echten Leser (nicht die ersetzten) – für ein gefälschtes ChurchTools. */
const echteLeser = async () => ({
  ...(await vi.importActual<typeof import('./ladeEinrichten')>('./ladeEinrichten')),
  ...(await vi.importActual<typeof import('./ladeEinrichtungStand')>('./ladeEinrichtungStand')),
});

/** Das Schreiben läuft gegen ein gefälschtes ChurchTools – nie gegen eine Instanz. */
function mitFake(f = new FakeCt(), s = new FakeSpeicher()) {
  schreibe.mockImplementation(async (e: Eingabe, fortschritt) => {
    // Die Leser dieser Datei sind ersetzt (`vi.mock`): Das Schreiben liest mit den echten aus dem gefälschten ChurchTools.
    return schreibeEinrichtung(e, anschluss(f, s, e, { fortschritt, leser: await echteLeser() }));
  });
  return { f, s };
}

const dialog = (name: string) => screen.getByRole('dialog', { name });
const klick = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

function einrichtenFenster(art: 'einrichten' | 'aendern' = 'einrichten') {
  return render(
    <EinrichtenFenster
      art={art}
      start={START}
      einrichtung={art === 'aendern' ? EINRICHTUNG : null}
      onSchliessen={onSchliessen}
      onGeschrieben={onGeschrieben}
    />,
  );
}

/** Erstes Einrichten: Bereich, drei Stufen – so, wie ein Admin es ausfüllt (die Gruppen-IDs stimmen mit dem gefälschten ChurchTools überein). */
function ausfuellen() {
  waehleSpitze('Wechsel-Gruppen anlegen unter', 'Kinder & Jugend');
  waehleSpitze('Gruppe der Stufe 1', 'Schäfchen');
  waehleSpitze('Gruppe der Stufe 2', 'Fische');
  fireEvent.change(screen.getByLabelText('ab Alter, Stufe 1'), { target: { value: '4' } });
  fireEvent.change(screen.getByLabelText('ab Alter, Stufe 2'), { target: { value: '7' } });
}

async function bisZumKnopf() {
  klick('Weiter zur Vorschau');
  await screen.findByRole('list', { name: 'Das legt die Erweiterung an' });
}

async function einrichtenBisZurVorschau() {
  einrichtenFenster();
  ausfuellen();
  await bisZumKnopf();
  const haken = await screen.findByRole<HTMLInputElement>('checkbox');
  await waitFor(() => expect(haken.disabled).toBe(false));
  fireEvent.click(haken);
}

describe('Einrichten – der Hauptknopf schreibt und zeigt „Fertig“', () => {
  it('Einrichten: Schreiben mit dem Soll aus dem Formular, ohne bisherige Einrichtung; während es läuft kein Schließen', async () => {
    let fertig!: () => void;
    schreibe.mockImplementation(
      () =>
        new Promise((r) => {
          fertig = () =>
            r({
              art: 'gelaufen',
              ok: true,
              ergebnisse: [],
              gespeichert: null,
              nichtMehrGebraucht: [],
            });
        }),
    );
    await einrichtenBisZurVorschau();
    klick('Jetzt einrichten');
    await screen.findByText(/Es wird geschrieben und nachgelesen/);
    expect(schreibe).toHaveBeenCalledTimes(1);
    const e = schreibe.mock.calls[0][0];
    expect(e).toMatchObject({
      art: 'einrichten',
      ausgang: null,
      von: { personId: START.ichId, name: START.vorname },
      soll: { bereichGruppeId: 9 },
    });
    expect(e.soll?.einstellung.stufen.map((s) => [s.gruppeId, s.name, s.abAlter])).toEqual([
      [SCHAEFCHEN, 'Schäfchen', 4],
      [FISCHE, 'Fische', 7],
    ]);
    // Es läuft: das Fenster hält still (X gesperrt), der Knopf zeigt, was passiert.
    expect(screen.getByRole('button', { name: 'Es wird geschrieben …' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', { name: 'Fenster schließen' })).toHaveProperty(
      'disabled',
      true,
    );
    fertig();
    await screen.findByText('Fertig.');
  });

  it('gegen ein gefälschtes ChurchTools: Liste mit ✓ je Baustein, „Fertig.“, der Kasten für die Leserechte – und Schließen lädt die Seite neu', async () => {
    const { f } = mitFake();
    await einrichtenBisZurVorschau();
    klick('Jetzt einrichten');
    await screen.findByText('Fertig.');
    const liste = within(screen.getByRole('list', { name: 'Was geschrieben wurde' }));
    expect(liste.getAllByRole('listitem').map((li) => li.querySelector('b')?.textContent)).toEqual([
      'Gruppentyp „Gruppenwechsel“ angelegt',
      'Rechte der Leitung gesetzt',
      '1 Wechsel-Gruppe angelegt',
      '1 Routine eingerichtet',
      'Regeln in 1 Wechsel-Gruppe geschrieben',
      '1 Wechsel-Gruppe eingeschaltet',
      'Regeln in 2 Kindergruppen geschrieben',
      '2 Kindergruppen eingeschaltet',
      'Neu berechnet',
      'Einrichtung gespeichert',
    ]);
    expect(screen.getAllByRole('img', { name: 'erledigt' })).toHaveLength(10);
    expect(f.status.get(FAKE_S2)).toBe('active');
    // O9-F12: nur Text – nichts wird gesetzt.
    const kasten = within(
      screen.getByRole('region', { name: 'Damit die Leitungen den Reiter sehen' }),
    );
    expect(kasten.getByText(/Das setzt „Einrichten“ nicht selbst/)).toBeTruthy();
    expect(kasten.getByText(/„Organigramm“ sehen/)).toBeTruthy();
    expect(kasten.getByText('„Gruppenwechsel“')).toBeTruthy();
    expect(kasten.getByText('„Was das Organigramm zeigt“')).toBeTruthy();
    expect(kasten.getByText(`„${GRUNDWERTE.ferienkalender}“`)).toBeTruthy();
    expect(kasten.getByText(/Schäfchen, Fische/)).toBeTruthy();
    expect(kasten.getByText(/Leitung der Gruppe „Kinder & Jugend“/)).toBeTruthy();
    expect(f.aufrufe.some((a) => a.pfad.startsWith('/permissions/') && a.json === undefined)).toBe(
      false,
    );
    // Erst beim Schließen wird neu geladen – vorher würde die Seite unter dem Fenster verschwinden.
    expect(onGeschrieben).not.toHaveBeenCalled();
    klick('Fertig');
    expect(onSchliessen).toHaveBeenCalledTimes(1);
    expect(onGeschrieben).toHaveBeenCalledTimes(1);
  });

  it('Fehlerfall: „Nicht ganz fertig“, ✗ mit Namen und Grund, „offen“ – und „Später“ lädt trotzdem neu (es wurde etwas geschrieben)', async () => {
    const f = new FakeCt();
    mitFake(f);
    // Eine Zeitüberschreitung (504) ist vorübergehend.
    f.ausfall = (a) =>
      a.pfad === `/dynamicgroups/${FAKE_S2}/ruleset` ? new ApiError(504, 'x') : undefined;
    await einrichtenBisZurVorschau();
    klick('Jetzt einrichten');
    await screen.findByText('Nicht ganz fertig.');
    expect(screen.getByRole('img', { name: 'nicht geklappt' })).toBeTruthy();
    expect(screen.getAllByRole('img', { name: 'noch offen' }).length).toBeGreaterThan(0);
    expect(screen.getByText('Regeln in „Fische“')).toBeTruthy();
    expect(screen.getByText(/Nichts ist kaputt/)).toBeTruthy();
    expect(screen.getAllByText('noch nicht geschrieben').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Fertig' })).toBeNull();
    // Der Kasten zu den Leserechten gehört zum fertigen Ergebnis, nicht zur Fehlermeldung.
    expect(
      screen.queryByRole('region', { name: 'Damit die Leitungen den Reiter sehen' }),
    ).toBeNull();
    klick('Später');
    expect(onSchliessen).toHaveBeenCalledTimes(1);
    expect(onGeschrieben).toHaveBeenCalledTimes(1);
  });

  it('„Nochmal versuchen“: zweiter Lauf mit der Einrichtung, die der erste gespeichert hat; danach „Fertig“ – keine zweite Wechsel-Gruppe', async () => {
    const f = new FakeCt();
    let aus = true;
    f.ausfall = (a) =>
      aus && a.pfad === `/dynamicgroups/${FAKE_S2}/ruleset` ? new ApiError(504, 'x') : undefined;
    const { s } = mitFake(f);
    await einrichtenBisZurVorschau();
    klick('Jetzt einrichten');
    await screen.findByText('Nicht ganz fertig.');
    aus = false;
    klick('Nochmal versuchen');
    await screen.findByText('Fertig.');
    expect(schreibe).toHaveBeenCalledTimes(2);
    // Der erste Lauf erwartete „noch keine Einrichtung“, der zweite genau die, die der erste gespeichert hat.
    expect(schreibe.mock.calls[0][0].ausgang).toBeNull();
    expect(schreibe.mock.calls[1][0].ausgang).toEqual(s.inhalt);
    expect([...f.gruppen.values()].filter((g) => g.typId === 9)).toHaveLength(1);
    expect(f.anzahl('POST', '/groups')).toBe(1);
    klick('Fertig');
    expect(onGeschrieben).toHaveBeenCalledTimes(1);
  });

  it('Voraussetzung nicht erfüllt (zwischen Vorschau und Schreiben kamen fremde Regeln dazu): rot „Es wurde nichts geschrieben“, ‹ geht zur Vorschau zurück, Schließen lädt NICHT neu', async () => {
    const f = new FakeCt();
    f.regeln.set(FAKE_S2, [{ shorty: 'jugendliste' }]);
    mitFake(f);
    await einrichtenBisZurVorschau();
    klick('Jetzt einrichten');
    await screen.findByText('Es wurde nichts geschrieben.');
    expect(screen.getByText(/„Fische“ hat schon eigene Regeln/)).toBeTruthy();
    expect(f.aufrufe).toHaveLength(0);
    klick('Zurück');
    await screen.findByRole('list', { name: 'Das legt die Erweiterung an' });
    klick('Jetzt einrichten');
    await screen.findByText('Es wurde nichts geschrieben.');
    klick('Später');
    expect(onSchliessen).toHaveBeenCalledTimes(1);
    expect(onGeschrieben).not.toHaveBeenCalled();
  });

  it('Stufen ändern: erwartet die gespeicherte Einrichtung, aus der das Fenster geöffnet wurde', async () => {
    mitFake();
    einrichtenFenster('aendern');
    await bisZumKnopf();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Änderungen schreiben' })).toHaveProperty(
        'disabled',
        false,
      ),
    );
    klick('Änderungen schreiben');
    await screen.findByText(/Es wurde nichts geschrieben|Fertig\.|Nicht ganz fertig\./);
    expect(schreibe.mock.calls[0][0]).toMatchObject({ art: 'aendern', ausgang: EINRICHTUNG });
  });
});

describe('Vorschau – läuft heute schon einer der Wechsel?', () => {
  it('liegt heute im Fenster eines Wechsels: gelb ganz oben, mit Jahr und Zahl aus der Vorschau – kein Stopp', async () => {
    // Die Sommerferien endeten vor drei Tagen: Ankündigung und Wechseltag sind schon da, die Aufnahme läuft noch.
    const ende = plusTage(HEUTE, -3);
    const jahrF = Number(ende.slice(0, 4));
    const ferien = sommerferienAus(
      [{ titel: `Sommerferien NRW ${jahrF}`, beginn: plusTage(ende, -40), ende }],
      GRUNDWERTE.ferienStichwort,
    );
    ferienLaden.mockResolvedValue({
      art: 'da',
      jahre: wechseljahre(ferien, GRUNDWERTE),
      ferien,
    });
    // Anna und Ben sind am Stichtag dieses Jahres 7: zwei Kinder wechseln Schäfchen → Fische (Cleo ist in der letzten Stufe).
    kjLaden.mockResolvedValue({ art: 'da', daten: kjDaten(jahrF), rechte: new Map() });
    await einrichtenBisZurVorschau();
    const warnung = await screen.findByText(
      `Der Wechsel ${jahrF} läuft gerade – nach dem Schreiben kommen 2 Kinder sofort in die Wechsel-Gruppe bzw. werden verschoben.`,
    );
    expect(warnung).toBeTruthy();
    // Kein Stopp: Der Knopf ist an.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Jetzt einrichten' })).toHaveProperty(
        'disabled',
        false,
      ),
    );
  });

  it('Gegenprobe: liegt der Wechsel in der Zukunft, steht keine Warnung da', async () => {
    await einrichtenBisZurVorschau();
    await screen.findByText('Wer wechselt wann wohin');
    expect(screen.queryByText(/läuft gerade/)).toBeNull();
  });
});

describe('Wechseltage nachtragen', () => {
  const nachtragen = (regelBis?: number) =>
    render(
      <NachtragenFenster
        start={START}
        einrichtung={EINRICHTUNG}
        regelBis={regelBis}
        onSchliessen={onSchliessen}
        onGeschrieben={onGeschrieben}
      />,
    );

  it('Vorschau zeigt nur die neuen Jahre, die Beschriftung nennt sie; Schreiben mit art „nachtragen“ und ohne Soll – nur Regeln', async () => {
    const { f } = mitFake();
    // Die Regeln reichen bis JAHR; der Kalender kennt drei Jahre.
    nachtragen(JAHR);
    const d = dialog('Wechseltage nachtragen');
    expect(within(d).getByRole('list', { name: 'Schritte' }).textContent).toBe('1Vorschau2Fertig');
    await waitFor(() => expect(within(d).getByRole('table')).toBeTruthy());
    const jahreInTabelle = within(d)
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.querySelector('b')?.textContent);
    expect(jahreInTabelle).toEqual([String(JAHR + 1), String(JAHR + 2)]);
    expect(within(d).getByText(`Regeln in 5 Gruppen um ${JAHR + 1} und ${JAHR + 2}`)).toBeTruthy();
    expect(
      within(d).getByText('Vorhandene Jahre und Ausnahmen bleiben, wie sie sind.'),
    ).toBeTruthy();
    const knopf = within(d).getByRole('button', { name: `${JAHR + 1}–${JAHR + 2} nachtragen` });
    await waitFor(() => expect((knopf as HTMLButtonElement).disabled).toBe(false));
    // Das gefälschte ChurchTools hat noch keine Einrichtung → der Lauf meldet, dass nichts geschrieben wurde.
    fireEvent.click(knopf);
    await within(d).findByText('Es wurde nichts geschrieben.');
    expect(schreibe.mock.calls[0][0]).toMatchObject({
      art: 'nachtragen',
      soll: null,
      ausgang: null,
    });
    expect(f.aufrufe).toHaveLength(0);
  });

  it('gegen ein eingerichtetes gefälschtes ChurchTools: nur Regeln geschrieben, „Fertig.“, Schließen lädt neu', async () => {
    const f = new FakeCt();
    const s = new FakeSpeicher();
    const erst: Eingabe = {
      art: 'einrichten',
      soll: { einstellung: EINRICHTUNG.einstellung, bereichGruppeId: 9 },
      ausgang: null,
      von: { personId: 1, name: 'Alex' },
    };
    await schreibeEinrichtung(erst, anschluss(f, s, erst, { leser: await echteLeser() }));
    mitFake(f, s);
    const davor = f.aufrufe.length;
    nachtragen(JAHR);
    const d = dialog('Wechseltage nachtragen');
    const knopf = await within(d).findByRole('button', { name: /nachtragen$/ });
    await waitFor(() => expect((knopf as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(knopf);
    await within(d).findByText('Fertig.');
    const neu = f.aufrufe.slice(davor);
    expect(neu.length).toBeGreaterThan(0);
    expect(neu.every((a) => a.methode === 'PUT' && a.pfad.endsWith('/ruleset'))).toBe(true);
    // Beim Nachtragen kein Kasten mit Leserechten.
    expect(
      within(d).queryByRole('region', { name: 'Damit die Leitungen den Reiter sehen' }),
    ).toBeNull();
    fireEvent.click(within(d).getByRole('button', { name: 'Fertig' }));
    expect(onGeschrieben).toHaveBeenCalledTimes(1);
  });

  it('fremde Regeln in einer Stufe: roter Stopp, der Knopf bleibt aus', async () => {
    regelnLaden.mockResolvedValue(
      new Map([...KEINE_REGELN, [FISCHE, ok([{ shorty: 'jugendliste' }])]]),
    );
    nachtragen(JAHR);
    const d = dialog('Wechseltage nachtragen');
    await within(d).findByText(/„Fische“ hat schon eigene Regeln/);
    expect(within(d).getByText(/Das Schreiben würde sie ersetzen/)).toBeTruthy();
    expect(
      within(d).getByRole<HTMLButtonElement>('button', {
        name: `${JAHR + 1}–${JAHR + 2} nachtragen`,
      }).disabled,
    ).toBe(true);
  });

  it('keine neuen Jahre im Kalender: nichts nachzutragen, Knopf aus', async () => {
    nachtragen(JAHR + 2);
    const d = dialog('Wechseltage nachtragen');
    await within(d).findByText(/Im Ferienkalender stehen keine neuen Sommerferien/);
    expect(within(d).getByRole<HTMLButtonElement>('button', { name: 'Nachtragen' }).disabled).toBe(
      true,
    );
  });

  it('läuft heute ein Wechsel, steht die gelbe Warnung auch hier', async () => {
    const ende = plusTage(HEUTE, -3);
    const jahrF = Number(ende.slice(0, 4));
    const ferien = sommerferienAus(
      [{ titel: `Sommerferien NRW ${jahrF}`, beginn: plusTage(ende, -40), ende }],
      GRUNDWERTE.ferienStichwort,
    );
    ferienLaden.mockResolvedValue({ art: 'da', jahre: wechseljahre(ferien, GRUNDWERTE), ferien });
    kjLaden.mockResolvedValue({ art: 'da', daten: kjDaten(jahrF), rechte: new Map() });
    nachtragen(jahrF - 1);
    await screen.findByText(/Der Wechsel \d{4} läuft gerade/);
  });
});

describe('Rechte setzen', () => {
  const fehlend = LEITER_RECHTE.filter((r) => r.authId === 10102);
  const rechteFenster = (f = fehlend) =>
    render(
      <RechteFenster
        start={START}
        fehlend={f}
        onSchliessen={onSchliessen}
        onGeschrieben={onGeschrieben}
      />,
    );

  it('zeigt die drei Rechte (das fehlende als „ergänzen“), der Knopf geht erst mit dem Haken „geprüft“ an', () => {
    rechteFenster();
    const d = dialog('Rechte der Leitung setzen');
    const zeilen = within(
      within(d).getByRole('list', { name: 'Rechte der Rolle Leiter' }),
    ).getAllByRole('listitem');
    expect(zeilen.map((z) => z.textContent)).toEqual([
      'vorhandenGruppenmitglieder sehen',
      'ergänzenGruppeninfos sehen',
      'vorhandenGruppenmitgliedschaften bearbeiten',
    ]);
    expect(within(d).getByText(/Andere Rechte, die jemand von Hand/)).toBeTruthy();
    const knopf = within(d).getByRole<HTMLButtonElement>('button', { name: 'Recht setzen' });
    expect(knopf.disabled).toBe(true);
    fireEvent.click(within(d).getByRole('checkbox'));
    expect(knopf.disabled).toBe(false);
  });

  it('Schreiben: art „rechte“, danach „Fertig.“; Schließen lädt neu', async () => {
    const f = new FakeCt().mitTyp();
    const s = new FakeSpeicher();
    // Eine fertige Einrichtung, bei der jemand „Gruppeninfos sehen“ entzogen hat.
    const erst: Eingabe = {
      art: 'einrichten',
      soll: { einstellung: EINRICHTUNG.einstellung, bereichGruppeId: 9 },
      ausgang: null,
      von: { personId: 1, name: 'Alex' },
    };
    await schreibeEinrichtung(erst, anschluss(f, s, erst, { leser: await echteLeser() }));
    f.rechte.set(
      48,
      f.rechte.get(48)!.filter((r) => r.authId !== 10102),
    );
    mitFake(f, s);
    rechteFenster();
    const d = dialog('Rechte der Leitung setzen');
    fireEvent.click(within(d).getByRole('checkbox'));
    fireEvent.click(within(d).getByRole('button', { name: 'Recht setzen' }));
    await within(d).findByText('Fertig.');
    expect(schreibe.mock.calls[0][0]).toMatchObject({ art: 'rechte', soll: null });
    expect(within(d).getByText('Rechte der Leitung gesetzt')).toBeTruthy();
    expect(f.rechte.get(48)!.some((r) => r.authId === 10102)).toBe(true);
    fireEvent.click(within(d).getByRole('button', { name: 'Fertig' }));
    expect(onGeschrieben).toHaveBeenCalledTimes(1);
  });
});

describe('Seite „Einrichtung“ – die Knöpfe stehen nur dort, wo etwas fehlt', () => {
  const seite = (regelBis: number) =>
    render(
      <EinrichtungSeite
        start={START}
        einrichtung={EINRICHTUNG}
        regel={{ art: 'da', staende: [], bis: regelBis }}
        jahr={JAHR}
        onGeschrieben={onGeschrieben}
      />,
    );
  const ohneRecht = (authId: number) => {
    const s = gutesStand();
    s.rechte = {
      ...s.rechte,
      leiter: ok(
        LEITER_RECHTE.filter((r) => r.authId !== authId).map((r) => ({ ...r, isInherited: false })),
      ),
    };
    return s;
  };

  it('alles in Ordnung: weder „Rechte setzen …“ noch „Nachtragen …“', async () => {
    seite(JAHR + 2);
    await screen.findByText('Gruppentyp „Gruppenwechsel“');
    expect(screen.queryByRole('button', { name: 'Rechte setzen …' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Wechseltage nachtragen' })).toBeNull();
  });

  it('⚠ „Rechte der Leitung“ (ein Recht fehlt): „Rechte setzen …“ öffnet das Fenster mit genau diesem Recht', async () => {
    standLaden.mockResolvedValue(ohneRecht(10102));
    seite(JAHR + 2);
    fireEvent.click(await screen.findByRole('button', { name: 'Rechte setzen …' }));
    const d = dialog('Rechte der Leitung setzen');
    expect(within(d).getAllByText('ergänzen')).toHaveLength(1);
    expect(within(d).getByText('Gruppeninfos sehen')).toBeTruthy();
  });

  it('⚠ nur wegen eines ZUSÄTZLICHEN Rechts (nichts fehlt): kein „Rechte setzen …“ – entzogen wird nie etwas', async () => {
    const s = gutesStand();
    s.rechte = {
      ...s.rechte,
      leiter: ok([
        ...LEITER_RECHTE.map((r) => ({ ...r, isInherited: false })),
        { authId: 99999, dataId: null, isInherited: false },
      ]),
    };
    standLaden.mockResolvedValue(s);
    seite(JAHR + 2);
    await screen.findByText(/zusätzlich bei der Leitung/);
    expect(screen.queryByRole('button', { name: 'Rechte setzen …' })).toBeNull();
  });

  it('Rechte nicht lesbar: „nicht prüfbar“, nie ein Knopf zum „Reparieren“', async () => {
    const s = gutesStand();
    s.rechte = { leiter: { ok: false }, teilnehmer: { ok: false } };
    standLaden.mockResolvedValue(s);
    seite(JAHR + 2);
    await screen.findByText('Gruppentyp „Gruppenwechsel“');
    expect(screen.queryByRole('button', { name: 'Rechte setzen …' })).toBeNull();
  });

  it('⚠ „Wechseltage“: „Nachtragen …“ öffnet das Fenster mit dem Stand der Regeln', async () => {
    seite(JAHR);
    fireEvent.click(await screen.findByRole('button', { name: 'Wechseltage nachtragen' }));
    const d = dialog('Wechseltage nachtragen');
    await waitFor(() => expect(within(d).getByRole('table')).toBeTruthy());
    expect(
      within(d)
        .getAllByRole('row')
        .slice(1)
        .map((r) => r.querySelector('b')?.textContent),
    ).toEqual([String(JAHR + 1), String(JAHR + 2)]);
  });
});

describe('Seite „Wechseltage“ – der Knopf beim gelben Hinweis', () => {
  const e = EINRICHTUNG;
  const seite = (bis: number | null) =>
    render(
      <Wechseltage
        einrichtung={e}
        jahr={JAHRE[0]}
        jahre={JAHRE}
        ferien={FERIEN}
        phase="ruhig"
        sichten={[]}
        regel={bis === null ? null : { art: 'da', staende: [], bis }}
        tage={
          bis === null
            ? { art: 'unbekannt' }
            : bis === JAHR
              ? { art: 'baldAus', bis }
              : { art: 'ok', bis }
        }
        start={START}
        onGeschrieben={onGeschrieben}
      />,
    );

  it('„Wechseltage fehlen bald“: „Wechseltage nachtragen …“ steht im Hinweis und öffnet das Fenster', async () => {
    seite(JAHR);
    fireEvent.click(screen.getByRole('button', { name: 'Wechseltage nachtragen …' }));
    expect(dialog('Wechseltage nachtragen')).toBeTruthy();
  });

  it('reichen die Regeln weit genug oder darf man sie nicht lesen: kein Knopf', () => {
    seite(JAHR + 2);
    expect(screen.queryByRole('button', { name: 'Wechseltage nachtragen …' })).toBeNull();
    cleanup();
    seite(null);
    expect(screen.queryByRole('button', { name: 'Wechseltage nachtragen …' })).toBeNull();
  });
});
