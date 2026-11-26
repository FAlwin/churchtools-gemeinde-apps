// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Absence, AbsenceEvent } from '@shared/types/index';
import { datumText, tagKurz } from '@shared/ct/datum';
import { diensteAus } from '@shared/ct/dienste';
import type { Dienstgruppe } from '@shared/ct/dienstgruppen';
import type { CtAbsence } from '@shared/ct/typen';
import type { Abfrage } from '@shared/dienstplan/abfragen';
import { standardInhalt, type AbfragenStand } from '@shared/dienstplan/abfragenSpeicher';
import { offeneTermine } from '@shared/dienstplan/erinnern';
import { LEERER_PLAN, mein, zeile } from '@shared/dienstplan/zeile.testutil';
import type { TerminZeile } from '@shared/dienstplan/termine';
import type { Antworten } from '@shared/dienstplan/verfuegbarkeit';
import type { AbwesenheitenDienst } from '@ui/abwesenheiten/ctDienst';
import { Abwesenheiten } from './Abwesenheiten';
import type { AutomatikAnschluss } from './abfrageAutomatikLauf';
import { EINR, hilfsgruppe, R_TEILNEHMER } from './abfrageAutomatik.testutil';
import { ladeAbfragen } from './ladeAbfragen';
import { ladeAbwesenheiten, ladeMeineDienste } from './ladeBeiwerk';
import { ladeZeitraum } from './ladeTermine';
import {
  ladeVerfuegbarkeit,
  speichereVerfuegbarkeit,
  type Verfuegbarkeit,
} from './ladeVerfuegbarkeit';
import type { Start } from './start';
import { startFuer } from './start.testutil';

/**
 * **R-3: „Verfügbarkeit“ mit der Abfrage** – das Band über der Liste, die Liste im Zeitraum der Abfrage, „X offen“ aus
 * derselben Rechnung wie die Karte (`meinStand` → `offeneTermine`), Aktualisierung nach dem Speichern. Heute = Di 10.11.2026,
 * Musik (4) fragt Feb–Mär 2027. Termine 101–106 wie in `Startseite.abfrage.test.tsx`: offen sind 101 und 105 (von 6).
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
// Die Hilfsgruppe in ChurchTools (R-5b): Der echte Anschluss ginge ins Netz – die Tests geben eine nachgebaute.
const anschluss = vi.hoisted(() => ({ aktuell: null as AutomatikAnschluss | null }));
vi.mock('./einrichtenAbfragen', async (orig) => ({
  // Die Pfade zur Hilfsgruppe (`mitgliederPfad`, `routinenPfad`) bleiben die echten – sie stehen nur dort.
  ...(await orig<typeof import('./einrichtenAbfragen')>()),
  ctAutomatikAnschluss: () => ({
    port: {
      holen: (p: string) => anschluss.aktuell!.port.holen(p),
      liste: (p: string) => anschluss.aktuell!.port.liste(p),
      schicken: () => Promise.reject(new Error('nein')),
    },
    mitgliedAnlegen: () => Promise.reject(new Error('nein')),
    mitgliedEntfernen: (g: number, p: number) => anschluss.aktuell!.mitgliedEntfernen(g, p),
    mitgliedOderNichts: (g: number, p: number) => anschluss.aktuell!.mitgliedOderNichts(g, p),
  }),
}));
vi.mock('./ladeAbfragen', () => ({ ladeAbfragen: vi.fn(), speichereAbfragen: vi.fn() }));
vi.mock('./ladeBeiwerk', () => ({ ladeMeineDienste: vi.fn(), ladeAbwesenheiten: vi.fn() }));
vi.mock('./ladeTermine', () => ({ ladeZeitraum: vi.fn() }));
vi.mock('./ladeVerfuegbarkeit', async (orig) => ({
  ...(await orig<typeof import('./ladeVerfuegbarkeit')>()),
  ladeVerfuegbarkeit: vi.fn(),
  speichereVerfuegbarkeit: vi.fn(),
}));
const abfragen = vi.mocked(ladeAbfragen);
const abwesenheiten = vi.mocked(ladeAbwesenheiten);
const zeitraum = vi.mocked(ladeZeitraum);
const laden = vi.mocked(ladeVerfuegbarkeit);
const speichern = vi.mocked(speichereVerfuegbarkeit);

const HEUTE = '2026-11-10';
const MUSIK: Dienstgruppe = { id: 4, name: 'Musik', fuerAlle: false };
const ABFRAGE: Abfrage = {
  id: 'a1',
  von: '2027-02-01',
  bis: '2027-03-31',
  frist: '2026-11-17',
  oeffnen: '2026-11-09',
  termine: [101, 102, 103, 104, 105, 106],
  gestartet: { personId: 1, name: 'Alwin', zeit: '2026-11-09T07:00:00Z' },
  beendet: null,
};
const ev = (id: number, name: string, tag: string): AbsenceEvent => ({
  id,
  name,
  date: tag,
  startDate: `${tag}T08:00:00Z`,
  endDate: `${tag}T09:30:00Z`,
});
const TAGE: Record<number, string> = {
  101: '2027-02-07',
  102: '2027-02-14',
  103: '2027-02-21',
  104: '2027-03-07',
  105: '2027-03-14',
  106: '2027-03-21',
};
const TERMINE: AbsenceEvent[] = [
  ev(200, 'Vorabend', '2026-11-15'),
  ...Object.entries(TAGE).map(([id, tag]) => ev(Number(id), 'Gottesdienst', tag)),
  ev(201, 'Nach der Abfrage', '2027-04-04'),
];
const ZEILEN: TerminZeile[] = [
  zeile(101, 'Gottesdienst', TAGE[101]),
  zeile(102, 'Gottesdienst', TAGE[102]),
  zeile(103, 'Gottesdienst', TAGE[103], { abgesagt: true }),
  zeile(104, 'Gottesdienst', TAGE[104], {
    meine: [mein('Gesang', true, { ort: { serviceId: 9, index: null } })],
  }),
  zeile(105, 'Gottesdienst', TAGE[105], {
    meine: [mein('Ton', true, { ort: { serviceId: 6, index: null } })],
  }),
  zeile(106, 'Gottesdienst', TAGE[106]),
];
const ABW_CT: CtAbsence = { id: 1, startDate: TAGE[106], endDate: TAGE[106] };
const ABW: Absence = {
  id: 1,
  startDate: TAGE[106],
  endDate: TAGE[106],
  startTime: null,
  endTime: null,
  reason: 'Abwesend',
  reasonId: 1,
  comment: '',
  vonApp: false,
};
const START: Start = startFuer({
  gruppen: [{ id: 9, name: 'Musikteam', leitung: false }],
  dienste: diensteAus([
    { id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [7] },
    { id: 9, name: 'Gesang', serviceGroupId: 4, groupIds: [9] },
  ]),
});

let stand: Verfuegbarkeit;
const bereit = (antworten: Antworten = {}): Verfuegbarkeit => ({
  modul: 16,
  gruppen: [{ gruppe: MUSIK, kategorie: 30, stand: 'bereit' }],
  bereit: [30],
  antworten,
  vertretungen: {},
  lesefehler: null,
});
const abfrageStand = (a: Abfrage | null): AbfragenStand => ({
  inhalt: { ...standardInhalt(), abfragen: a ? [a] : [] },
  gespeichert: null,
  unlesbar: false,
  fehler: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.location.hash = '#/abwesenheiten?abfrage=4';
  stand = bereit({ '102': { a: 'ja', tag: TAGE[102] } });
  dienst.meine.mockResolvedValue([ABW]);
  dienst.termine.mockResolvedValue(TERMINE);
  dienst.gruende.mockResolvedValue([{ id: 1, name: 'Abwesend', standard: true }]);
  vi.mocked(ladeMeineDienste).mockResolvedValue(new Map());
  abwesenheiten.mockResolvedValue([ABW_CT]);
  abfragen.mockImplementation((id) => Promise.resolve(abfrageStand(id === 4 ? ABFRAGE : null)));
  zeitraum.mockResolvedValue({ zeilen: ZEILEN, plan: LEERER_PLAN });
  laden.mockImplementation(() => Promise.resolve(stand));
  speichern.mockImplementation((_v, _p, antworten) => {
    stand = { ...stand, antworten };
    return Promise.resolve({ ok: true });
  });
});

const zeige = (extra: { abfrageGruppe?: number | null; start?: Start | undefined } = {}) =>
  render(
    <Abwesenheiten
      ichId={1}
      zeitzone="Europe/Berlin"
      heute={HEUTE}
      dienstgruppen={[MUSIK]}
      start={START}
      abfrageGruppe={4}
      {...extra}
    />,
  );
const band = () => screen.queryByRole('note', { name: 'Abfrage' });
/** Die Zahl, die die Karte nennen würde – aus dem Erzeuger `offeneTermine`. */
const erwartetOffen = (antworten: Antworten) =>
  offeneTermine({
    termine: ZEILEN,
    heute: HEUTE,
    beantwortet: (t) => antworten[String(t.id)] !== undefined || t.id === 106,
    eingeteilt: (t) => t.id === 104,
    pausiert: () => false,
  }).offen.length;
const klick = async (el: HTMLElement) => {
  await act(async () => {
    fireEvent.click(el);
    await Promise.resolve();
  });
};

describe('Band', () => {
  it('Etikett, Text mit Zeitraum und „noch X von N offen“ (derselbe Wert wie die Karte), rechts „Alle Termine zeigen“', async () => {
    zeige();
    const b = within(await screen.findByRole('note', { name: 'Abfrage' }));
    expect(await b.findByText(/noch \d+ von 6 offen/)).toBeTruthy();
    const offen = erwartetOffen(stand.antworten);
    expect(offen).toBe(2);
    expect(b.getByText(`Abfrage Musik · 01.02.–31.03. · noch ${offen} von 6 offen`)).toBeTruthy();
    expect(b.getByText(`bis ${tagKurz('2026-11-17')}`)).toBeTruthy();
    expect(b.getByRole('button', { name: 'Alle Termine zeigen' })).toBeTruthy();
  });

  it('die Liste zeigt genau den Zeitraum der Abfrage – kein Termin davor oder danach', async () => {
    zeige();
    await screen.findByText(/noch \d+ von 6 offen/);
    expect(screen.getAllByText('Gottesdienst')).toHaveLength(6);
    expect(screen.queryByText('Vorabend')).toBeNull();
    expect(screen.queryByText('Nach der Abfrage')).toBeNull();
  });

  it('nach dem Speichern einer Antwort aktualisiert sich das Band (2 → 1 offen), die Zahl bleibt die des Erzeugers', async () => {
    zeige();
    await screen.findByText(/noch 2 von 6 offen/);
    await klick(screen.getByRole('button', { name: `Ja – Gottesdienst, ${datumText(TAGE[101])}` }));
    // Vorgemerkt zählt noch nicht – erst das Gespeicherte.
    expect(screen.getByText(/noch 2 von 6 offen/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
      await new Promise((r) => setTimeout(r, 0));
    });
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    const jetzt = erwartetOffen({ ...stand.antworten });
    expect(jetzt).toBe(1);
    expect(
      await screen.findByText(`Abfrage Musik · 01.02.–31.03. · noch ${jetzt} von 6 offen`),
    ).toBeTruthy();
  });

  it('wartet auf die Abfrage, statt kurz „ab heute“ zu zeigen und dann zu springen (Fund im Browser, 25.11.2026)', async () => {
    let freigeben: (s: AbfragenStand) => void = () => undefined;
    abfragen.mockImplementation(
      () =>
        new Promise<AbfragenStand>((r) => {
          freigeben = r;
        }),
    );
    zeige();
    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Wird geladen …');
    // Solange die Abfrage lädt, baut sich die Seite nicht auf – sie lädt also auch keine Termine „ab heute“.
    expect(screen.queryByText('Vorabend')).toBeNull();
    expect(dienst.termine).not.toHaveBeenCalled();
    await act(async () => {
      freigeben(abfrageStand(ABFRAGE));
      await Promise.resolve();
    });
    await screen.findByText(/noch \d+ von 6 offen/);
    expect(screen.getAllByText('Gottesdienst')).toHaveLength(6);
  });

  it('„Alle Termine zeigen“ führt zur Adresse ohne Abfrage', async () => {
    zeige();
    await klick(await screen.findByRole('button', { name: 'Alle Termine zeigen' }));
    expect(window.location.hash).toBe('#/abwesenheiten');
  });

  it('ohne Termine des Zeitraums steht das Band ohne Zahl da (keine falsche Zahl)', async () => {
    zeitraum.mockRejectedValue(new Error('weg'));
    zeige();
    const b = await screen.findByRole('note', { name: 'Abfrage' });
    await new Promise((r) => setTimeout(r, 20));
    expect(b.textContent).toContain('Abfrage Musik · 01.02.–31.03.');
    expect(b.textContent).not.toMatch(/offen/);
  });
});

describe('Ohne gültige Abfrage ist die Seite wie heute', () => {
  const wieHeute = async () => {
    await screen.findByText('Vorabend');
    await new Promise((r) => setTimeout(r, 20));
    expect(band()).toBeNull();
    // „ab heute“: auch der Termin vor und nach dem Zeitraum der Abfrage ist da.
    expect(screen.getByText('Vorabend')).toBeTruthy();
  };
  it('ohne Abfrage in der Adresse', async () => {
    zeige({ abfrageGruppe: null });
    await wieHeute();
    expect(abfragen).not.toHaveBeenCalled();
  });
  it('ohne `start` (wie vor R-3)', async () => {
    zeige({ start: undefined });
    await wieHeute();
  });
  it('Dienstgruppe, in der ich nicht bin', async () => {
    zeige({ abfrageGruppe: 3 });
    await wieHeute();
  });
  it('Dienstgruppe ohne Abfrage', async () => {
    abfragen.mockResolvedValue(abfrageStand(null));
    zeige();
    await wieHeute();
  });
  it('beendete Abfrage', async () => {
    abfragen.mockResolvedValue(abfrageStand({ ...ABFRAGE, beendet: HEUTE }));
    zeige();
    await wieHeute();
  });
  it('Abfrage nicht lesbar', async () => {
    abfragen.mockRejectedValue(new Error('weg'));
    zeige();
    await wieHeute();
  });
});

describe('Austritt beim Antworten (R-5b)', () => {
  const mitEinrichtung = () =>
    abfragen.mockImplementation((id) =>
      Promise.resolve({
        ...abfrageStand(id === 4 ? ABFRAGE : null),
        inhalt: { ...standardInhalt(), abfragen: id === 4 ? [ABFRAGE] : [], einrichtung: EINR },
      }),
    );
  const ALLES: Antworten = {
    '101': { a: 'ja', tag: TAGE[101] },
    '102': { a: 'ja', tag: TAGE[102] },
    '105': { a: 'ja', tag: TAGE[105] },
  };
  const speichereEine = async () => {
    await klick(screen.getByRole('button', { name: `Ja – Gottesdienst, ${datumText(TAGE[104])}` }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
      await new Promise((r) => setTimeout(r, 0));
    });
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
  };

  it('nach dem Speichern: ist nichts mehr offen und ich stehe in der Hilfsgruppe, trage ich mich selbst aus (nachgelesen)', async () => {
    const { w, a } = hilfsgruppe({
      mitglieder: [
        { person: START.ichId, rolle: R_TEILNEHMER },
        { person: 99, rolle: R_TEILNEHMER },
      ],
    });
    anschluss.aktuell = a;
    mitEinrichtung();
    stand = bereit(ALLES);
    zeige();
    await screen.findByText(/alles eingetragen/);
    await speichereEine();
    await waitFor(() => expect(w.log).toContain(`DELETE /groups/50/members/${START.ichId}`));
    expect(w.mitglieder.map((m) => m.person)).toEqual([99]);
  });

  it('ein zweites Speichern WÄHREND der Prüfung wird nicht verworfen: die Prüfung läuft danach noch einmal', async () => {
    const { a } = hilfsgruppe({
      mitglieder: [{ person: START.ichId, rolle: R_TEILNEHMER }],
    });
    // Die erste Prüfung hängt, bis wir sie freigeben.
    let frei: () => void = () => {};
    const gesperrt = new Promise<void>((r) => {
      frei = r;
    });
    const echt = a.mitgliedOderNichts;
    let erste = true;
    a.mitgliedOderNichts = (g, p) => {
      if (erste) {
        erste = false;
        return gesperrt.then(() => echt(g, p));
      }
      return echt(g, p);
    };
    anschluss.aktuell = a;
    mitEinrichtung();
    stand = bereit(ALLES);
    zeige();
    await screen.findByText(/alles eingetragen/);
    await speichereEine();
    // Zweites Speichern (Vielleicht statt Ja), solange die erste Prüfung noch hängt.
    await klick(
      screen.getByRole('button', { name: `Vielleicht – Gottesdienst, ${datumText(TAGE[104])}` }),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
      await new Promise((r) => setTimeout(r, 0));
    });
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(2));
    frei();
    await waitFor(() => expect(vi.mocked(echt).mock.calls.length).toBeGreaterThanOrEqual(3));
  });

  it('ist noch etwas offen, bleibe ich in der Gruppe (kein DELETE)', async () => {
    const { w, a } = hilfsgruppe({ mitglieder: [{ person: START.ichId, rolle: R_TEILNEHMER }] });
    anschluss.aktuell = a;
    mitEinrichtung();
    zeige();
    await screen.findByText(/noch 2 von 6 offen/);
    await speichereEine();
    await new Promise((r) => setTimeout(r, 30));
    expect(w.log.filter((z) => z.startsWith('DELETE'))).toEqual([]);
    expect(w.mitglieder).toHaveLength(1);
  });

  it('kann die Mitgliedschaft nicht gelesen werden, passiert nichts – und es bleibt leise (nichts im Log)', async () => {
    const { w, a } = hilfsgruppe({ mitglieder: [{ person: START.ichId, rolle: R_TEILNEHMER }] });
    w.stoerung.wirft = {
      [`GET /groups/50/members/${START.ichId}`]: new TypeError('Failed to fetch'),
    };
    anschluss.aktuell = a;
    mitEinrichtung();
    stand = bereit(ALLES);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    zeige();
    await screen.findByText(/alles eingetragen/);
    await speichereEine();
    await new Promise((r) => setTimeout(r, 30));
    expect(w.mitglieder).toHaveLength(1);
    expect(warn.mock.calls.flat().join(' ')).not.toContain('Failed');
  });
});
