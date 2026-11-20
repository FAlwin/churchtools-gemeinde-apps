// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import type { ProtokollKopf } from '@shared/protokolle/speicher';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import {
  alsGeloescht,
  modusSetzen,
  neueAufgabe,
  statusSetzen,
  teilSetzen,
  type Aufgabe,
} from '@shared/protokolle/aufgaben';
import { faellige, type Vorlauf } from '@shared/protokolle/hinweis';
import * as L from './lesen';
import { Startseite } from './Startseite';
import { uhrzeit } from './anzeige';

vi.mock('./lesen', async (orig) => ({
  ...(await orig<typeof import('./lesen')>()),
  ladeUebersicht: vi.fn(),
}));
const m = vi.mocked(L);

const GRUPPEN: ProtokollGruppe[] = [
  { id: 11, name: 'Leitungsteam', lage: 'eingerichtet', protokolle: 60, mitarbeit: 61 },
  { id: 7, name: 'Jugendleitung', lage: 'unvollstaendig', protokolle: 70, mitarbeit: null },
];
const ICH = 1;

// Heute ist Freitag, 23.10.2026, 10:00 Uhr in Berlin. Die Uhrzeiten zeigt die Seite in der Zeitzone des Geräts –
// deshalb rechnet der Test sie mit demselben Baustein (die CI läuft in UTC, Alwins Rechner in Berlin).
const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const um = (s: Sitzung) => uhrzeit(s.beginn, ZONE);
const JETZT = new Date('2026-10-23T08:00:00Z');

function sitzung(s: Partial<Sitzung> & Pick<Sitzung, 'schluessel' | 'beginn' | 'titel'>): Sitzung {
  return { termin: null, treffen: null, kopf: null, anfragen: [], ...s };
}
const kopf = (sitzung: string, status: ProtokollKopf['status']): ProtokollKopf => ({
  art: 'protokoll',
  fassung: 1,
  sitzung,
  titel: 'x',
  status,
  beginn: '2026-10-14T17:00:00Z',
  termin: null,
  treffen: null,
  freigabe: null,
  sperre: null,
  stand: 'a',
});

const HEUTE = sitzung({
  schluessel: 't:4:120',
  beginn: '2026-10-23T17:00:00Z',
  titel: 'Gebetsabend',
  anfragen: [
    { person: 1, antwort: 'zugesagt' },
    { person: 19, antwort: 'zugesagt' },
    { person: 23, antwort: 'offen' },
  ],
});
const GESTERN = sitzung({
  schluessel: 'p:gestern',
  beginn: '2026-10-22T17:00:00Z',
  titel: 'Leitungssitzung Oktober',
  kopf: kopf('gestern', 'entwurf'),
});
const MAERZ = sitzung({
  schluessel: 't:4:114',
  beginn: '2027-03-17T17:00:00Z',
  titel: 'Klausur',
  anfragen: [{ person: 1, antwort: 'abgesagt' }],
});
const NOVEMBER = sitzung({
  schluessel: 'g:15',
  beginn: '2026-11-05T18:30:00Z',
  titel: 'Jugendleitung',
  anfragen: [{ person: 1, antwort: 'offen' }],
});
const DEZEMBER = sitzung({
  schluessel: 't:4:130',
  beginn: '2026-12-01T18:00:00Z',
  titel: 'Weihnachtsplanung',
  anfragen: [{ person: 19, antwort: 'zugesagt' }],
});
const FREI = sitzung({
  schluessel: 'p:sept',
  beginn: '2026-09-10T17:00:00Z',
  titel: 'Leitungssitzung September',
  kopf: kopf('sept', 'frei'),
});

function aufgabe(a: {
  id: string;
  text: string;
  wer: number[];
  bis?: string;
  sitzung?: string;
}): Aufgabe {
  return neueAufgabe({
    gruppe: 11,
    sitzung: 'sept',
    bis: null,
    von: 1,
    am: '2026-09-10T18:00:00Z',
    ...a,
  });
}
const UEBERFAELLIG = aufgabe({ id: 'a1', text: 'Beamer-Angebote', wer: [1], bis: '2026-10-20' });
const IN_ARBEIT = statusSetzen(
  aufgabe({
    id: 'a2',
    text: 'Farbe besorgen',
    wer: [1, 19],
    bis: '2026-11-01',
    sitzung: 'gestern',
  }),
  'arbeit',
  1,
  '2026-10-22T08:00:00Z',
);
const FREMD = aufgabe({ id: 'a3', text: 'Schlüssel abgeben', wer: [19] });
const ERLEDIGT = statusSetzen(
  aufgabe({ id: 'a4', text: 'Raum buchen', wer: [1] }),
  'erledigt',
  1,
  '2026-10-01T08:00:00Z',
);
const GELOESCHT = alsGeloescht(
  aufgabe({ id: 'a5', text: 'Weg damit', wer: [1] }),
  1,
  '2026-10-02T08:00:00Z',
);
const OHNE_HERKUNFT = aufgabe({ id: 'b1', text: 'Andacht vorbereiten', wer: [1], sitzung: 'alt' });

const leer = {
  teile: [],
  kalender: 4,
  punkte: 'vorschlagen' as const,
  treffenNichtFreigegeben: false,
};
const UEBERSICHT: L.GruppenUebersicht[] = [
  {
    gruppe: GRUPPEN[0],
    sitzungen: { kommend: [GESTERN, HEUTE, MAERZ, DEZEMBER], protokolle: [FREI], ...leer },
    todoVorschlaege: [],
    aufgaben: [UEBERFAELLIG, IN_ARBEIT, FREMD, ERLEDIGT, GELOESCHT],
  },
  {
    gruppe: GRUPPEN[1],
    sitzungen: { kommend: [NOVEMBER], protokolle: [], ...leer },
    todoVorschlaege: [],
    aufgaben: [{ ...OHNE_HERKUNFT, gruppe: 7 }],
  },
];

const onSitzung = vi.fn();
const onGruppe = vi.fn();
const zeigen = (gruppen = GRUPPEN, schreibbar: number[] = []) =>
  render(
    <Startseite
      modul={24}
      ich={{ person: ICH, name: 'Alwin' }}
      gruppen={gruppen}
      schreibbar={schreibbar}
      onSitzung={onSitzung}
      onGruppe={onGruppe}
    />,
  );
const zeilen = (name: string) =>
  within(screen.getByRole('region', { name }))
    .getAllByRole('listitem')
    .map((z) => z.textContent);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(JETZT);
  vi.clearAllMocks();
  m.ladeUebersicht.mockResolvedValue(UEBERSICHT);
});
afterEach(() => vi.useRealTimers());

describe('Startseite (S3-3)', () => {
  it('„Heute“: die Sitzung von heute mit Zusagen – der Knopf öffnet sie', async () => {
    zeigen();
    const heute = await screen.findByRole('region', { name: 'Heute' });
    expect(within(heute).getByRole('heading').textContent).toBe('Gebetsabend · Leitungsteam');
    expect(within(heute).getByText(/2 von 3 zugesagt/)).toBeTruthy();
    fireEvent.click(within(heute).getByRole('button', { name: 'Sitzung öffnen' }));
    expect(onSitzung).toHaveBeenCalledWith(11, 't:4:120');
  });

  it('ohne Sitzung heute: keine „Heute“-Karte', async () => {
    m.ladeUebersicht.mockResolvedValue([
      { ...UEBERSICHT[0], sitzungen: { ...UEBERSICHT[0].sitzungen, kommend: [MAERZ] } },
    ]);
    zeigen();
    await screen.findByText('Klausur', { exact: false });
    expect(screen.queryByRole('region', { name: 'Heute' })).toBeNull();
  });

  it('Meine offenen To-Dos: nur meine, nicht erledigt/gelöscht, überfällig zuerst – über alle Gruppen', async () => {
    zeigen();
    await screen.findByText('Beamer-Angebote');
    expect(zeilen('Meine offenen To-Dos')).toEqual([
      'Beamer-AngeboteLeitungsteam · aus „Leitungssitzung September“seit 20.10.',
      'Farbe besorgenLeitungsteam · in Arbeit · aus „Leitungssitzung Oktober“01.11.',
      'Andacht vorbereitenJugendleitung',
    ]);
    expect(screen.getByText('seit 20.10.').className).toMatch(/ueberfaellig/);
  });

  it('Meine offenen To-Dos (W8b): derselbe Haken und dasselbe Frist-Kästchen wie in der Übersicht – der Haken nur als Anzeige, die Zeile bleibt EIN Knopf', async () => {
    zeigen();
    await screen.findByText('Beamer-Angebote');
    const li = screen.getByText('Beamer-Angebote').closest('li')!;
    expect(within(li).getAllByRole('button')).toHaveLength(1);
    expect(within(li).getByRole('img', { name: 'Status: offen' })).toBeTruthy();
    expect(within(li).getByTitle(/^überfällig seit /)).toBeTruthy();
  });

  it('„Jeder für sich“ (W8a): solange MEIN Teil fehlt steht es da – mit „2 von 3 fertig“ statt „in Arbeit“; ist mein Teil erledigt, nicht mehr', async () => {
    const jeder = modusSetzen(
      aufgabe({ id: 'j1', text: 'Abwesenheiten eintragen', wer: [ICH, 19, 23] }),
      true,
      1,
      '2026-10-22T08:00:00Z',
    );
    const einer = teilSetzen(jeder, 19, true, 19, '2026-10-22T09:00:00Z');
    m.ladeUebersicht.mockResolvedValue([{ ...UEBERSICHT[0], aufgaben: [einer] }]);
    // Als Leitung (Protokolle der Gruppe schreibbar) sehe ich den Fortschritt.
    zeigen(GRUPPEN, [60]);
    await screen.findByText('Abwesenheiten eintragen');
    expect(zeilen('Meine offenen To-Dos')[0]).toMatch(/Leitungsteam · 1 von 3 fertig/);
    expect(screen.queryByText(/in Arbeit/)).toBeNull();
    cleanup();
    // Als Mitarbeiter (W10): für mich ist es nur meine Aufgabe – kein Zähler, keine anderen Zuständigen.
    zeigen();
    await screen.findByText('Abwesenheiten eintragen');
    const zeile = zeilen('Meine offenen To-Dos')[0] ?? '';
    expect(zeile).toMatch(/Leitungsteam/);
    expect(zeile).not.toMatch(/fertig|in Arbeit/);
    cleanup();
    m.ladeUebersicht.mockResolvedValue([
      {
        ...UEBERSICHT[0],
        aufgaben: [UEBERFAELLIG, teilSetzen(einer, ICH, true, ICH, '2026-10-22T11:00:00Z')],
      },
    ]);
    zeigen();
    // Erst warten, bis geladen ist (ein anderes To-Do steht da) – sonst wäre „nicht da“ schon vor dem Laden wahr.
    await screen.findByText('Beamer-Angebote');
    // Der Gesamtstand ist „in Arbeit“ (2 von 3), mein Teil aber erledigt – für mich ist es nicht mehr offen.
    expect(screen.queryByText('Abwesenheiten eintragen')).toBeNull();
  });

  it('ein To-Do öffnet seine Sitzung; ohne bekannte Sitzung ist es kein Knopf', async () => {
    zeigen();
    fireEvent.click(await screen.findByRole('button', { name: /Farbe besorgen/ }));
    expect(onSitzung).toHaveBeenCalledWith(11, 'p:gestern');
    expect(screen.queryByRole('button', { name: /Andacht vorbereiten/ })).toBeNull();
  });

  it('Nächste Sitzungen: ab heute, ohne die von „Heute“, früheste zuerst – mit meiner Antwort', async () => {
    zeigen();
    await screen.findByText('Beamer-Angebote');
    expect(zeilen('Nächste Sitzungen')).toEqual([
      `5NOVJugendleitungJugendleitung · Do, 05.11.2026 · ${um(NOVEMBER)} · noch nicht beantwortet`,
      `1DEZLeitungsteamWeihnachtsplanung · Di, 01.12.2026 · ${um(DEZEMBER)}`,
      `17MÄRLeitungsteamKlausur · Mi, 17.03.2027 · ${um(MAERZ)} · du hast abgesagt`,
    ]);
    fireEvent.click(screen.getByRole('button', { name: /Weihnachtsplanung/ }));
    expect(onSitzung).toHaveBeenCalledWith(11, 't:4:130');
  });

  it('Deine Gruppen: Stand und offene To-Dos der ganzen Gruppe; ein Tipp öffnet die Gruppe', async () => {
    zeigen();
    await screen.findByText('Beamer-Angebote');
    expect(zeilen('Deine Gruppen')).toEqual([
      'Leitungsteam3 offene To-Doseingerichtet',
      'Jugendleitung1 offenes To-Dounvollständig eingerichtet',
    ]);
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Deine Gruppen' })).getByRole('button', {
        name: /^Jugendleitung/,
      }),
    );
    expect(onGruppe).toHaveBeenCalledWith(7);
    expect(screen.getByText(/Fehlt eine Gruppe\?/)).toBeTruthy();
  });

  it('vorübergehender Fehler: „Erneut versuchen“ – nicht „Nichts offen“', async () => {
    m.ladeUebersicht.mockRejectedValueOnce(new ApiError(503, 'weg'));
    zeigen();
    const knoepfe = await screen.findAllByRole('button', { name: 'Erneut versuchen' });
    expect(screen.queryByText('Nichts offen. Schön!')).toBeNull();
    expect(screen.queryByText('Keine geplant.')).toBeNull();
    // Die Gruppen kommen aus dem Start – sie bleiben sichtbar, nur ohne Zähler.
    expect(zeilen('Deine Gruppen')[0]).toBe('Leitungsteameingerichtet');
    fireEvent.click(knoepfe[0]);
    expect(await screen.findByText('Beamer-Angebote')).toBeTruthy();
    expect(m.ladeUebersicht).toHaveBeenCalledTimes(2);
  });

  it('nichts offen, nichts geplant: je ein Satz', async () => {
    m.ladeUebersicht.mockResolvedValue([
      {
        gruppe: GRUPPEN[0],
        sitzungen: { kommend: [], protokolle: [], ...leer },
        todoVorschlaege: [],
        aufgaben: [FREMD],
      },
    ]);
    zeigen([GRUPPEN[0]]);
    expect(await screen.findByText('Nichts offen. Schön!')).toBeTruthy();
    expect(screen.getByText('Keine geplant.')).toBeTruthy();
  });

  it('keine Gruppe: ein Satz, kein Laden', () => {
    zeigen([]);
    expect(screen.getByText(/keiner Gruppe/)).toBeTruthy();
    expect(m.ladeUebersicht).not.toHaveBeenCalled();
  });
});

/** Handy-Breite vortäuschen (`useMedienAbfrage(HANDY_BREITE)`). */
const geraet = (handy: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: handy && q.includes('max-width'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

describe('Startseite: „Neues Protokoll“ (R3)', () => {
  const zeigenMitRecht = (gruppen = GRUPPEN, schreibbar: number[] = [60]) =>
    render(
      <Startseite
        modul={24}
        ich={{ person: ICH, name: 'Alwin' }}
        gruppen={gruppen}
        schreibbar={schreibbar}
        onSitzung={onSitzung}
        onGruppe={onGruppe}
      />,
    );
  afterEach(() => vi.unstubAllGlobals());

  it('Rechner/iPad: grüner Knopf in der Karte „Nächste Sitzungen“, kein schwebendes Plus', async () => {
    geraet(false);
    zeigenMitRecht();
    const karte = await screen.findByRole('region', { name: 'Nächste Sitzungen' });
    const knopf = within(karte).getByRole('button', { name: /Neues Protokoll/ });
    expect(knopf.className).toMatch(/(^|[\s_])neu([\s_]|$)/);
    expect(document.querySelector('button[class*="plus"]')).toBeNull();
  });

  it('Handy: das schwebende Plus statt des grünen Quadrats in der Karte', async () => {
    geraet(true);
    zeigenMitRecht();
    const karte = await screen.findByRole('region', { name: 'Nächste Sitzungen' });
    expect(within(karte).queryByRole('button', { name: /Neues Protokoll/ })).toBeNull();
    const plus = screen.getByRole('button', { name: 'Neues Protokoll' });
    expect(plus.className).toMatch(/plus/);
    fireEvent.click(plus);
    expect(screen.getByRole('dialog', { name: /Neues Protokoll/ })).toBeTruthy();
  });

  it('ohne Schreibrecht in einer Gruppe: weder Knopf noch Plus', async () => {
    for (const handy of [false, true]) {
      geraet(handy);
      const { unmount } = zeigenMitRecht([GRUPPEN[1]], []);
      await screen.findByRole('region', { name: 'Nächste Sitzungen' });
      expect(screen.queryByRole('button', { name: /Neues Protokoll/ })).toBeNull();
      unmount();
    }
  });
});

describe('Startseite: Hinweisband auf fällige To-Dos', () => {
  // Heute: Fr, 23.10.2026. Meine To-Dos aus UEBERSICHT: `UEBERFAELLIG` (bis 20.10.), `IN_ARBEIT` (bis 01.11., 9 Tage).
  const bandFuer = (vorlauf: Vorlauf) =>
    faellige(
      UEBERSICHT.flatMap((u) => u.aufgaben),
      ICH,
      '2026-10-23',
      vorlauf,
    );
  const zeigenMitBand = (vorlauf: Vorlauf | null, onAlle = vi.fn(), onAufgaben = vi.fn()) => {
    render(
      <Startseite
        modul={24}
        ich={{ person: ICH, name: 'Alwin' }}
        gruppen={GRUPPEN}
        onSitzung={onSitzung}
        onGruppe={onGruppe}
        onAlleToDos={onAlle}
        faellige={vorlauf === null ? null : bandFuer(vorlauf)}
        vorlauf={vorlauf}
        onAufgaben={onAufgaben}
      />,
    );
    return { onAlle, onAufgaben };
  };

  it('überfällig → rotes Band mit Text und Weg „Zu meinen To-Dos“', async () => {
    const { onAlle } = zeigenMitBand(14);
    const band = await screen.findByRole('region', { name: 'Fällige To-Dos' });
    expect(band.getAttribute('data-art')).toBe('rot');
    expect(band.textContent).toContain('1 To-Do überfällig, 1 bis So, 01.11. fällig');
    fireEvent.click(within(band).getByRole('button', { name: /Zu meinen To-Dos/ }));
    expect(onAlle).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Aus', 'aus' as const],
    ['noch nicht gelesen', null],
  ])('kein Band bei: %s', async (_name, v) => {
    zeigenMitBand(v);
    await screen.findByText('Beamer-Angebote');
    expect(screen.queryByRole('region', { name: 'Fällige To-Dos' })).toBeNull();
  });

  it('nichts fällig: kein Band', async () => {
    m.ladeUebersicht.mockResolvedValue([
      { ...UEBERSICHT[0], aufgaben: [FREMD, ERLEDIGT] },
      UEBERSICHT[1],
    ]);
    render(
      <Startseite
        modul={24}
        ich={{ person: ICH, name: 'Alwin' }}
        gruppen={GRUPPEN}
        onSitzung={onSitzung}
        onGruppe={onGruppe}
        faellige={{ ueberfaellig: [], bald: [] }}
        vorlauf={3}
      />,
    );
    await screen.findByText('Andacht vorbereiten');
    expect(screen.queryByRole('region', { name: 'Fällige To-Dos' })).toBeNull();
  });

  it('gibt die gelesenen To-Dos je Gruppe nach oben (speist den Zähler am Reiter)', async () => {
    const { onAufgaben } = zeigenMitBand(3);
    await screen.findByText('Beamer-Angebote');
    expect(onAufgaben).toHaveBeenLastCalledWith([
      { gruppe: 11, aufgaben: UEBERSICHT[0].aufgaben },
      { gruppe: 7, aufgaben: UEBERSICHT[1].aufgaben },
    ]);
  });
});
