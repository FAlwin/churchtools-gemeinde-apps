// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Absence, AbsenceEvent } from '@shared/types/index';
import type { Dienstgruppe } from '@shared/ct/dienstgruppen';
import { standardInhalt, type AbfragenStand } from '@shared/dienstplan/abfragenSpeicher';
import type { AbfragenInhalt } from '@shared/dienstplan/abfragen';
import type { RohTermin } from '@shared/dienstplan/termine';
import { zusagenTermine } from '@shared/dienstplan/verfuegbarkeitAnsicht';
import type { AbwesenheitenDienst } from '@ui/abwesenheiten/ctDienst';
import { HANDY_BREITE } from '@ui/bedienung/useMedienAbfrage';
import { Abwesenheiten } from './Abwesenheiten';
import { ladeAbfragen } from './ladeAbfragen';
import { ladeMeineDienste } from './ladeBeiwerk';
import { ladeRohTermine } from './ladeTermine';
import { KEINE_VERFUEGBARKEIT, ladeVerfuegbarkeit } from './ladeVerfuegbarkeit';
import type { Start } from './start';
import { startFuer } from './start.testutil';

/**
 * **„Verfügbarkeit“ mit „Abwesenheiten | Zusagen“ (V-3)** – der Umschalter nur mit Zusagen-Gruppe, die zwei Ansichten, die
 * Karte „Deine Zeiträume“, „Alle Einträge …“ im „⋯“ und die gefilterte Zusagen-Liste. Der Einstieg über eine Abfrage steht in
 * `Abwesenheiten.abfrage.test.tsx`, die Rechnungen selbst in `verfuegbarkeitAnsicht.test.ts`.
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
vi.mock('./ladeAbfragen', () => ({ ladeAbfragen: vi.fn(), speichereAbfragen: vi.fn() }));
vi.mock('./ladeBeiwerk', () => ({ ladeMeineDienste: vi.fn(), ladeAbwesenheiten: vi.fn() }));
vi.mock('./ladeTermine', () => ({ ladeZeitraum: vi.fn(), ladeRohTermine: vi.fn() }));
vi.mock('./ladeVerfuegbarkeit', async (orig) => ({
  ...(await orig<typeof import('./ladeVerfuegbarkeit')>()),
  ladeVerfuegbarkeit: vi.fn(),
  speichereVerfuegbarkeit: vi.fn(),
}));
const abfragen = vi.mocked(ladeAbfragen);
const rohe = vi.mocked(ladeRohTermine);
const verfuegbarkeit = vi.mocked(ladeVerfuegbarkeit);

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
/** Musik (Gruppe 4, Dienst 9 Gesang) hat nur am 1. Dienste, Technik (3, Dienst 6 Ton) nur am 2. – am 3. hat niemand welche. */
const ROH: Pick<RohTermin, 'id' | 'eventServices'>[] = [
  { id: 1, eventServices: [{ serviceId: 9 }, { serviceId: 6 }] },
  { id: 2, eventServices: [{ serviceId: 6 }] },
  { id: 3, eventServices: [] },
];
const MUSIK: Dienstgruppe = { id: 4, name: 'Musik', fuerAlle: false };
const TECHNIK: Dienstgruppe = { id: 3, name: 'Technik', fuerAlle: false };
const START: Start = startFuer();

const URLAUB: Absence = {
  id: 7,
  startDate: '2026-11-20',
  endDate: '2026-11-22',
  startTime: null,
  endTime: null,
  comment: 'Ferien',
  reason: 'Urlaub',
  reasonId: 2,
  vonApp: false,
};
const GANZER_TAG: Absence = {
  id: 8,
  startDate: '2026-11-25',
  endDate: '2026-11-25',
  startTime: null,
  endTime: null,
  comment: '',
  reason: 'Abwesend',
  reasonId: 1,
  vonApp: false,
};
const HAKEN: Absence = {
  id: 9,
  startDate: '2026-11-08',
  endDate: '2026-11-08',
  startTime: '2026-11-08T09:00:00Z',
  endTime: '2026-11-08T10:29:00Z',
  comment: '',
  reason: 'Abwesend',
  reasonId: 1,
  vonApp: false,
};
const FRUEHER: Absence = {
  id: 10,
  startDate: '2026-10-01',
  endDate: '2026-10-03',
  startTime: null,
  endTime: null,
  comment: '',
  reason: 'Urlaub',
  reasonId: 2,
  vonApp: false,
};

/** Das Gruppen-Dokument je Gruppen-ID – was `ladeAbfragen` liefert. */
const dokumente = (art: Record<number, AbfragenInhalt['verfuegbarkeit']>) =>
  abfragen.mockImplementation((id) =>
    Promise.resolve({
      inhalt: { ...standardInhalt(), verfuegbarkeit: art[id] ?? 'zusagen' },
      gespeichert: null,
      unlesbar: false,
      fehler: null,
    } satisfies AbfragenStand),
  );

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
  window.location.hash = '#/abwesenheiten';
  dienst.meine.mockResolvedValue([]);
  dienst.termine.mockResolvedValue(TERMINE);
  dienst.gruende.mockResolvedValue([
    { id: 1, name: 'Abwesend', standard: true },
    { id: 2, name: 'Urlaub', standard: false },
  ]);
  dienst.anlegen.mockResolvedValue({} as Absence);
  vi.mocked(ladeMeineDienste).mockResolvedValue(new Map());
  rohe.mockResolvedValue(ROH as RohTermin[]);
  verfuegbarkeit.mockResolvedValue(KEINE_VERFUEGBARKEIT);
  dokumente({});
});
afterEach(() => {
  cleanup();
  // @ts-expect-error – zurück auf „kein matchMedia“, wie jsdom es kennt
  delete window.matchMedia;
});

const zeige = (gruppen: Dienstgruppe[] = [MUSIK], start: Start | null = START) =>
  render(
    <Abwesenheiten
      ichId={1}
      zeitzone="Europe/Berlin"
      heute={HEUTE}
      dienstgruppen={gruppen}
      start={start ?? undefined}
    />,
  );
const zeile = async () => {
  await screen.findByText('Gebetsabend');
  return screen.getByRole('toolbar', { name: 'Werkzeuge' });
};
const umschalter = (z: HTMLElement, wort: 'Abwesenheiten' | 'Zusagen') =>
  within(z).queryByRole('button', { name: wort });
const zurZusagenAnsicht = async () => {
  const z = await zeile();
  fireEvent.click(umschalter(z, 'Zusagen')!);
  return z;
};
const oeffneAlleEintraege = async (z: HTMLElement) => {
  fireEvent.click(within(z).getByRole('button', { name: 'Mehr' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: /Alle Einträge/ }));
};

describe('Der Umschalter „Abwesenheiten | Zusagen“', () => {
  it('mit einer Zusagen-Gruppe: links der Umschalter, beim Öffnen „Abwesenheiten“ (Haken statt Ja · Vielleicht · Nein)', async () => {
    zeige();
    const z = await zeile();
    const knoepfe = within(z)
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(knoepfe.slice(0, 2)).toEqual(['Abwesenheiten', 'Zusagen']);
    expect(umschalter(z, 'Abwesenheiten')?.getAttribute('aria-pressed')).toBe('true');
    expect(
      screen.getByRole('button', { name: /^Abwesend – Gottesdienst, So, 08\.11\./ }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Ja – / })).toBeNull();
  });

  it('„Zusagen“: Ja · Vielleicht · Nein, kein „+ Zeitraum“ und kein „⋯“ (R3) – zurück sind sie wieder da', async () => {
    zeige();
    const z = await zurZusagenAnsicht();
    expect(
      await screen.findByRole('button', { name: /^Ja – Gottesdienst, So, 08\.11\./ }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Abwesend – / })).toBeNull();
    expect(within(z).queryByRole('button', { name: 'Zeitraum eintragen' })).toBeNull();
    expect(within(z).queryByRole('button', { name: 'Mehr' })).toBeNull();
    // Der Zeitraum und der Filter bleiben in beiden Ansichten.
    expect(within(z).getByRole('group', { name: 'Zeitraum' })).toBeTruthy();
    fireEvent.click(umschalter(z, 'Abwesenheiten')!);
    expect(within(z).getByRole('button', { name: 'Zeitraum eintragen' })).toBeTruthy();
    expect(within(z).getByRole('button', { name: 'Mehr' })).toBeTruthy();
  });

  it('fragt keine eigene Gruppe nach Zusagen („Nur abwesend“ überall): kein Umschalter, nur Abwesenheiten', async () => {
    dokumente({ 4: 'abwesend' });
    zeige();
    const z = await zeile();
    expect(umschalter(z, 'Zusagen')).toBeNull();
    expect(umschalter(z, 'Abwesenheiten')).toBeNull();
    expect(
      screen.getByRole('button', { name: /^Abwesend – Gottesdienst, So, 08\.11\./ }),
    ).toBeTruthy();
  });

  it('eine Zusagen-Gruppe neben einer „Nur abwesend“-Gruppe genügt für den Umschalter', async () => {
    dokumente({ 3: 'abwesend', 4: 'zusagen' });
    zeige([TECHNIK, MUSIK]);
    const z = await zeile();
    expect(umschalter(z, 'Zusagen')).toBeTruthy();
  });

  it('Lesefehler einer Gruppe gilt als „Zusagen“: der Umschalter ist da, nichts geht verloren', async () => {
    abfragen.mockRejectedValue(new Error('504'));
    zeige();
    const z = await zeile();
    expect(umschalter(z, 'Zusagen')).toBeTruthy();
  });

  it('ein nicht lesbares oder fehlerhaft gelesenes Dokument gilt als „Zusagen“', async () => {
    abfragen.mockResolvedValue({
      inhalt: { ...standardInhalt(), verfuegbarkeit: 'abwesend' },
      gespeichert: null,
      unlesbar: true,
      fehler: null,
    });
    zeige();
    expect(umschalter(await zeile(), 'Zusagen')).toBeTruthy();
  });

  it('ohne eigene Dienstgruppe: kein Umschalter und kein Lesen der Dokumente', async () => {
    zeige([]);
    const z = await zeile();
    expect(umschalter(z, 'Zusagen')).toBeNull();
    expect(abfragen).not.toHaveBeenCalled();
  });

  it('am Handy ist die Ansicht ein Knopf mit Blatt; „Zusagen“ wählen zeigt Ja · Vielleicht · Nein ausgeschrieben', async () => {
    setzeHandy(true);
    zeige();
    const z = await zeile();
    fireEvent.click(within(z).getByRole('button', { name: 'Ansicht: Abwesenheiten' }));
    const blatt = screen.getByRole('dialog', { name: 'Ansicht' });
    fireEvent.click(within(blatt).getByRole('button', { name: 'Zusagen' }));
    expect(within(z).getByRole('button', { name: 'Ansicht: Zusagen' })).toBeTruthy();
    const gruppe = await screen.findByRole('group', {
      name: /^Antwort – Gottesdienst, So, 08\.11\./,
    });
    // Keine Abkürzung „Vl.“ – die drei Wörter stehen voll da.
    expect(
      within(gruppe)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Ja', 'Vielleicht', 'Nein']);
  });
});

describe('Zusagen: nur Termine mit Diensten einer Zusagen-Gruppe, mit Schild', () => {
  it('Termin 1 hat Dienste von Musik: da, mit dem Schild „Musik“; Termin 2 (nur Technik) und 3 (keine Dienste) fehlen', async () => {
    zeige();
    await zurZusagenAnsicht();
    await screen.findByRole('button', { name: /^Ja – Gottesdienst, So, 08\.11\./ });
    expect(screen.getByText('Musik')).toBeTruthy();
    expect(screen.queryByText('Gebetsabend')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Ja – Gottesdienst, So, 15\.11\./ })).toBeNull();
    // Der Aufruf geht über den einen Lader und fragt nur den gezeigten Zeitraum.
    expect(rohe).toHaveBeenCalledWith('2026-11-04', '2026-12-02');
    // Die Erwartung kommt aus der Regel selbst, nicht aus Literalen.
    const erwartet = zusagenTermine(ROH, (sid) => START.dienste.get(sid)?.dienstgruppeId, [MUSIK]);
    expect([...erwartet.keys()]).toEqual([1]);
  });

  it('in „Abwesenheiten“ stehen weiter alle Termine – die Filterung gilt nur unter „Zusagen“', async () => {
    zeige();
    const z = await zeile();
    expect(screen.getAllByText('Gottesdienst')).toHaveLength(2);
    fireEvent.click(umschalter(z, 'Zusagen')!);
    await screen.findByRole('button', { name: /^Ja – Gottesdienst, So, 08\.11\./ });
    fireEvent.click(umschalter(z, 'Abwesenheiten')!);
    expect(await screen.findByText('Gebetsabend')).toBeTruthy();
    expect(screen.getAllByText('Gottesdienst')).toHaveLength(2);
  });

  it('die Termine werden erst mit der Ansicht „Zusagen“ geladen – in „Abwesenheiten“ kostet es nichts', async () => {
    zeige();
    const z = await zeile();
    expect(rohe).not.toHaveBeenCalled();
    fireEvent.click(umschalter(z, 'Zusagen')!);
    await waitFor(() => expect(rohe).toHaveBeenCalledTimes(1));
  });

  it('zwei Zusagen-Gruppen am selben Termin: beide Schilder, in der Reihenfolge der Gruppen', async () => {
    dokumente({ 3: 'zusagen', 4: 'zusagen' });
    zeige([TECHNIK, MUSIK]);
    await zurZusagenAnsicht();
    await screen.findByRole('button', { name: /^Ja – Gottesdienst, So, 08\.11\./ });
    // Termin 1: Technik und Musik (Reihenfolge der Gruppen); Termin 2: nur Technik.
    const schilder = [...document.querySelectorAll('[class*="schild"]')].map((e) => e.textContent);
    expect(schilder).toEqual(['Technik', 'Musik', 'Technik']);
    // Der Termin 2 (Technik) steht jetzt auch da.
    expect(screen.getByText('Gebetsabend')).toBeTruthy();
  });

  it('lassen sich die Termine nicht laden, stehen alle da (ohne Schild) – nichts geht verloren', async () => {
    rohe.mockRejectedValue(new Error('502'));
    zeige();
    await zurZusagenAnsicht();
    expect(
      await screen.findByRole('button', { name: /^Ja – Gottesdienst, So, 15\.11\./ }),
    ).toBeTruthy();
    expect(screen.getByText('Gebetsabend')).toBeTruthy();
    expect(screen.queryByText('Musik')).toBeNull();
  });

  it('ohne `start` (wie vor R-3) stehen unter „Zusagen“ alle Termine', async () => {
    zeige([MUSIK], null);
    await zurZusagenAnsicht();
    expect(
      await screen.findByRole('button', { name: /^Ja – Gottesdienst, So, 15\.11\./ }),
    ).toBeTruthy();
    expect(rohe).not.toHaveBeenCalled();
  });

  it('solange die Zuordnung lädt, steht keine Liste da (sie spränge sonst von „alle“ auf „gefiltert“)', async () => {
    let fertig: (r: RohTermin[]) => void = () => undefined;
    rohe.mockImplementation(
      () =>
        new Promise<RohTermin[]>((r) => {
          fertig = r;
        }),
    );
    zeige();
    await zurZusagenAnsicht();
    expect(await screen.findByText('Termine mit Diensten werden geladen …')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Ja – / })).toBeNull();
    await act(async () => {
      fertig(ROH as RohTermin[]);
      await Promise.resolve();
    });
    expect(
      await screen.findByRole('button', { name: /^Ja – Gottesdienst, So, 08\.11\./ }),
    ).toBeTruthy();
  });

  it('„Nein“ in „Zusagen“ ist dieselbe Abwesenheit: in „Abwesenheiten“ steht der Haken schon, eine Leiste für beides', async () => {
    zeige();
    const z = await zurZusagenAnsicht();
    fireEvent.click(
      await screen.findByRole('button', { name: /^Nein – Gottesdienst, So, 08\.11\./ }),
    );
    expect(screen.getByRole('status', { name: '' }).textContent).toMatch(/1 Änderung vorgemerkt/);
    fireEvent.click(umschalter(z, 'Abwesenheiten')!);
    const haken = await screen.findByRole('button', {
      name: /^Abwesend – Gottesdienst, So, 08\.11\./,
    });
    expect(haken.getAttribute('aria-pressed')).toBe('true');
    // Dieselbe Leiste, keine zweite.
    expect(screen.getAllByRole('button', { name: 'Speichern' })).toHaveLength(1);
  });
});

describe('Zusagen: sieht ChurchTools die Plätze der Gruppe vollständig?', () => {
  /** Ein einfaches Mitglied: darf weder planen noch die Dienstgruppe sehen. */
  const MITGLIED = {
    planbareDienstgruppen: [],
    sichtbareDienstgruppen: [],
    ablaufKalender: [],
    terminKalender: [],
    abwesenheitenAller: false,
  };

  it('ein Mitglied ohne Recht an der Gruppe (nicht „für alle sichtbar“): ChurchTools liefert nur die eigenen Plätze – alle Termine stehen da, ohne Schild, nichts wird geladen', async () => {
    // Die eigenen Einträge allein ließen nur Termin 1 übrig – genau die, die keine Antwort brauchen.
    rohe.mockResolvedValue([{ id: 1, eventServices: [{ serviceId: 9 }] }] as RohTermin[]);
    zeige([MUSIK], startFuer({ rechte: MITGLIED }));
    await zurZusagenAnsicht();
    expect(
      await screen.findByRole('button', { name: /^Ja – Gottesdienst, So, 15\.11\./ }),
    ).toBeTruthy();
    expect(screen.getByText('Gebetsabend')).toBeTruthy();
    expect(screen.queryByText('Musik')).toBeNull();
    expect(rohe).not.toHaveBeenCalled();
  });

  it('ist die Dienstgruppe „für alle sichtbar“, kommen alle Plätze: die Liste wird gefiltert', async () => {
    const start = startFuer({
      rechte: MITGLIED,
      dienstgruppen: [
        { id: 1, name: 'Programm', fuerAlle: false },
        { id: 3, name: 'Technik', fuerAlle: false },
        { id: 4, name: 'Musik', fuerAlle: true },
      ],
    });
    zeige([{ ...MUSIK, fuerAlle: true }], start);
    await zurZusagenAnsicht();
    await screen.findByRole('button', { name: /^Ja – Gottesdienst, So, 08\.11\./ });
    expect(screen.queryByText('Gebetsabend')).toBeNull();
    expect(screen.getByText('Musik')).toBeTruthy();
    expect(rohe).toHaveBeenCalledTimes(1);
  });

  it('sind nur die Plätze EINER von zwei Zusagen-Gruppen vollständig (Musik ja, Technik nein), ist die Liste unvollständig: alle Termine', async () => {
    dokumente({ 3: 'zusagen', 4: 'zusagen' });
    zeige([TECHNIK, MUSIK], startFuer({ rechte: { ...MITGLIED, planbareDienstgruppen: [4] } }));
    await zurZusagenAnsicht();
    expect(await screen.findByText('Gebetsabend')).toBeTruthy();
    expect(screen.queryByText('Musik')).toBeNull();
    expect(rohe).not.toHaveBeenCalled();
  });

  it('die Rechtsfrage ist die der Matrix (`ganzSichtbar`): Recht, die Gruppe zu sehen, genügt', async () => {
    zeige([MUSIK], startFuer({ rechte: { ...MITGLIED, sichtbareDienstgruppen: [4] } }));
    await zurZusagenAnsicht();
    await screen.findByRole('button', { name: /^Ja – Gottesdienst, So, 08\.11\./ });
    expect(screen.queryByText('Gebetsabend')).toBeNull();
  });
});

describe('„Deine Zeiträume“ (Abwesenheiten)', () => {
  it('Zeiträume (mehrere Tage, ganze Tage) stehen als Karte oben; ein Haken mit Uhrzeit nicht', async () => {
    dienst.meine.mockResolvedValue([URLAUB, GANZER_TAG, HAKEN]);
    zeige();
    await zeile();
    const karte = screen.getByRole('region', { name: 'Deine Zeiträume' });
    expect(within(karte).getByText('Urlaub')).toBeTruthy();
    expect(within(karte).getByText(/Fr, 20\.11\. – So, 22\.11\./)).toBeTruthy();
    expect(within(karte).getByText(/Mi, 25\.11\. · ganztägig/)).toBeTruthy();
    // Grund „Abwesend“ (der Standard) grau, Urlaub rot (R9).
    expect(within(karte).getByText('Abwesend').className).not.toBe(
      within(karte).getByText('Urlaub').className,
    );
    expect(within(karte).getAllByRole('button')).toHaveLength(2);
    expect(within(karte).getByText('2')).toBeTruthy();
    // Die Karte steht VOR der Terminliste.
    const liste = screen.getByRole('region', { name: 'Verfügbarkeit' });
    expect(
      karte.compareDocumentPosition(screen.getByText('Gebetsabend')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(liste.contains(karte)).toBe(true);
  });

  it('ein Tipp auf einen Zeitraum öffnet das Ändern-Fenster dieses Eintrags', async () => {
    dienst.meine.mockResolvedValue([URLAUB]);
    zeige();
    await zeile();
    const karte = screen.getByRole('region', { name: 'Deine Zeiträume' });
    fireEvent.click(within(karte).getByRole('button', { name: /Urlaub/ }));
    const fenster = await screen.findByRole('dialog', { name: 'Abwesenheit ändern' });
    expect(within(fenster).getByDisplayValue('Ferien')).toBeTruthy();
  });

  it('ohne solche Einträge keine Karte', async () => {
    dienst.meine.mockResolvedValue([HAKEN]);
    zeige();
    await zeile();
    expect(screen.queryByRole('region', { name: 'Deine Zeiträume' })).toBeNull();
  });

  it('nur Zeiträume, die den gezeigten Zeitraum schneiden – ‹ › wechselt', async () => {
    dienst.meine.mockResolvedValue([
      URLAUB,
      { ...GANZER_TAG, id: 11, startDate: '2026-12-10', endDate: '2026-12-10' },
    ]);
    zeige();
    const z = await zeile();
    // 04.11.–01.12.: nur der Urlaub.
    expect(
      within(screen.getByRole('region', { name: 'Deine Zeiträume' })).getAllByRole('button'),
    ).toHaveLength(1);
    fireEvent.click(within(z).getByRole('button', { name: 'Zeitraum danach' }));
    // 02.12.–29.12.: nur der ganze Tag am 10.12.
    const karte = screen.getByRole('region', { name: 'Deine Zeiträume' });
    expect(within(karte).getAllByRole('button')).toHaveLength(1);
    expect(within(karte).getByText(/Do, 10\.12\. · ganztägig/)).toBeTruthy();
  });

  it('unter „Zusagen“ gibt es die Karte nicht', async () => {
    dienst.meine.mockResolvedValue([URLAUB]);
    zeige();
    await zurZusagenAnsicht();
    expect(screen.queryByRole('region', { name: 'Deine Zeiträume' })).toBeNull();
  });

  it('auch ohne Zusagen-Gruppe steht die Karte da', async () => {
    dienst.meine.mockResolvedValue([URLAUB]);
    zeige([]);
    await zeile();
    expect(screen.getByRole('region', { name: 'Deine Zeiträume' })).toBeTruthy();
  });
});

describe('„Alle Einträge …“ im „⋯“', () => {
  it('das Menü hat „Alle Einträge …“ und „Hilfe“; der erste öffnet die volle Liste (anstehend, früher) als Fenster', async () => {
    dienst.meine.mockResolvedValue([URLAUB, FRUEHER, HAKEN]);
    zeige([]);
    const z = await zeile();
    fireEvent.click(within(z).getByRole('button', { name: 'Mehr' }));
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual([
      'Alle Einträge …',
      'Hilfe',
    ]);
    fireEvent.click(screen.getByRole('menuitem', { name: /Alle Einträge/ }));
    const fenster = await screen.findByRole('dialog', { name: 'Alle Einträge' });
    // Anstehend: Urlaub und der Haken; Früher: der Urlaub im Oktober.
    expect(within(fenster).getByRole('button', { name: 'Anstehend (2)' })).toBeTruthy();
    expect(
      within(fenster).getAllByRole('button', { name: /^Abwesenheit .* ändern$/ }),
    ).toHaveLength(2);
    fireEvent.click(within(fenster).getByRole('button', { name: 'Früher (1)' }));
    expect(
      within(fenster).getAllByRole('button', { name: /^Abwesenheit .* ansehen$/ }),
    ).toHaveLength(1);
  });

  it('das Fenster hat keine Fußzeile – geschlossen wird mit dem X', async () => {
    zeige([]);
    await oeffneAlleEintraege(await zeile());
    const fenster = await screen.findByRole('dialog', { name: 'Alle Einträge' });
    expect(within(fenster).queryByRole('button', { name: 'Abbrechen' })).toBeNull();
    fireEvent.click(within(fenster).getByRole('button', { name: 'Fenster schließen' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Alle Einträge' })).toBeNull());
  });

  it('ein Tipp auf einen Eintrag öffnet das Ändern-Fenster; das Fenster mit den Einträgen bleibt darunter', async () => {
    dienst.meine.mockResolvedValue([URLAUB]);
    zeige([]);
    await oeffneAlleEintraege(await zeile());
    const fenster = await screen.findByRole('dialog', { name: 'Alle Einträge' });
    fireEvent.click(within(fenster).getByRole('button', { name: /^Abwesenheit .* ändern$/ }));
    expect(await screen.findByRole('dialog', { name: 'Abwesenheit ändern' })).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Alle Einträge' })).toBeTruthy();
  });

  it('ohne Eintrag sagt das Fenster, wo man einen einträgt', async () => {
    zeige([]);
    await oeffneAlleEintraege(await zeile());
    expect(await screen.findByText('Noch nichts eingetragen.')).toBeTruthy();
    expect(screen.getByText(/Unter „Abwesenheiten“ ein Kästchen abhaken/)).toBeTruthy();
  });

  it('am Handy kommt das Menü als Fenster und der Eintrag führt zur selben Liste', async () => {
    setzeHandy(true);
    zeige([]);
    const z = await zeile();
    fireEvent.click(within(z).getByRole('button', { name: 'Mehr' }));
    const menue = await screen.findByRole('dialog', { name: 'Mehr' });
    fireEvent.click(within(menue).getByRole('button', { name: /Alle Einträge/ }));
    expect(await screen.findByRole('dialog', { name: 'Alle Einträge' })).toBeTruthy();
    // Erst ging das Menü zu, dann das Fenster auf (Reihenfolge, Lehre 05.08.2026).
    expect(screen.queryByRole('dialog', { name: 'Mehr' })).toBeNull();
  });
});

describe('„Hilfe“ im „⋯“', () => {
  it('öffnet das Hilfe-Fenster der Seite', async () => {
    zeige([]);
    const z = await zeile();
    fireEvent.click(within(z).getByRole('button', { name: 'Mehr' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Hilfe' }));
    const fenster = await screen.findByRole('dialog', { name: 'Hilfe · Verfügbarkeit' });
    expect(within(fenster).getByText('Abwesenheiten und Zusagen')).toBeTruthy();
    expect(within(fenster).getByText('Deine Zeiträume')).toBeTruthy();
  });
});

describe('Fenster über Fenster: „Abwesenheit ändern“ über „Alle Einträge“', () => {
  const ueberDemFenster = async () => {
    dienst.meine.mockResolvedValue([URLAUB]);
    zeige([]);
    await oeffneAlleEintraege(await zeile());
    const liste = await screen.findByRole('dialog', { name: 'Alle Einträge' });
    fireEvent.click(within(liste).getByRole('button', { name: /^Abwesenheit .* ändern$/ }));
    return screen.findByRole('dialog', { name: 'Abwesenheit ändern' });
  };

  it('„‹“ führt zur Liste zurück – die Liste bleibt offen', async () => {
    const fenster = await ueberDemFenster();
    fireEvent.click(within(fenster).getByRole('button', { name: 'Zurück' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Abwesenheit ändern' })).toBeNull(),
    );
    expect(screen.getByRole('dialog', { name: 'Alle Einträge' })).toBeTruthy();
  });

  it('„Abbrechen“ führt ebenso zurück, das X schließt beide', async () => {
    let fenster = await ueberDemFenster();
    fireEvent.click(within(fenster).getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Abwesenheit ändern' })).toBeNull(),
    );
    expect(screen.getByRole('dialog', { name: 'Alle Einträge' })).toBeTruthy();
    const liste = screen.getByRole('dialog', { name: 'Alle Einträge' });
    fireEvent.click(within(liste).getByRole('button', { name: /^Abwesenheit .* ändern$/ }));
    fenster = await screen.findByRole('dialog', { name: 'Abwesenheit ändern' });
    fireEvent.click(within(fenster).getByRole('button', { name: 'Fenster schließen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('über „Deine Zeiträume“ liegt das Fenster auf keinem anderen: kein „‹“, „Abbrechen“ schließt', async () => {
    dienst.meine.mockResolvedValue([URLAUB]);
    zeige([]);
    await zeile();
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Deine Zeiträume' })).getByRole('button', {
        name: /Urlaub/,
      }),
    );
    const fenster = await screen.findByRole('dialog', { name: 'Abwesenheit ändern' });
    expect(within(fenster).queryByRole('button', { name: 'Zurück' })).toBeNull();
    fireEvent.click(within(fenster).getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
