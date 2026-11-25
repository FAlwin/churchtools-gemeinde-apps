// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { TerminZeile } from '@shared/protokolle/termine';
import type { TerminVorlage } from '@shared/protokolle/terminVorlagen';
import * as K from './terminAnlegen';
import * as V from './terminVorlagenLesen';
import * as B from './buchungenLesen';
import * as E from './eventsLesen';
import * as A from './anmeldungLesen';
import { ladeSchreibKalender } from './kalenderListe';
import { terminLegen } from './terminEintragen';
import { terminVermerken } from './terminStandSchreiben';
import { TerminFenster } from './TerminFenster';

/**
 * Der Reiter „Anmeldung“ im Fenster „In Kalender eintragen“ (W15-5): Rechte (Reiter da/weg), Vorgaben, Typwechsel,
 * Vorschau mit fester Uhr, Fuß „legt sofort N Gruppen an“, was an `terminLegen` geht, Meldungen nach dem Anlegen, Vorlagen.
 */
vi.mock('./kalenderListe', () => ({ ladeSchreibKalender: vi.fn() }));
vi.mock('./terminAnlegen', async (orig) => ({
  ...(await orig<typeof import('./terminAnlegen')>()),
  kalenderTermineAmTag: vi.fn(),
}));
vi.mock('./terminEintragen', () => ({ terminLegen: vi.fn(), NICHT_NACHGELESEN: 'x' }));
vi.mock('./terminStandSchreiben', () => ({ terminVermerken: vi.fn() }));
vi.mock('./terminVorlagenLesen', async (orig) => ({
  ...(await orig<typeof import('./terminVorlagenLesen')>()),
  ladeVorlagen: vi.fn(),
  ladeTags: vi.fn(() => Promise.resolve([])),
  vorlageSpeichern: vi.fn(),
}));
vi.mock('./buchungenLesen', () => ({ ladeRessourcen: vi.fn() }));
vi.mock('./eventsLesen', () => ({ ladeEventVorlagen: vi.fn() }));
vi.mock('./anmeldungLesen', () => ({ ladeGruppentypen: vi.fn(), ladeGruppenDesTyps: vi.fn() }));

/** Der Termin liegt einen Tag nach „heute“ (fest auf den 25.11.2026 gesetzt). */
const ZEILE: TerminZeile = {
  schluessel: 'termin-s-b',
  gruppe: { id: 11, name: 'Leitungsteam' },
  sitzung: { id: 's', schluessel: 'p:s', titel: 'Festplanung', beginn: '2026-11-21T18:00:00Z' },
  blockId: 'b',
  text: 'Heiligabend, 16 Uhr',
  datum: '2026-11-26',
  punkt: null,
};
const STAND = { vermerke: [] } as never;
const TYPEN = [
  { id: 1, name: 'Kleingruppe' },
  { id: 5, name: 'Anmeldung' },
];
const GRUPPEN: Record<number, { id: number; name: string }[]> = {
  1: [
    { id: 301, name: 'Hauskreis Nord' },
    { id: 302, name: 'Jugendkreis' },
  ],
  5: [{ id: 304, name: 'Anmeldung Freizeit (Vorlage)' }],
};

const onFertig = vi.fn();
const element = (
  typen: number[] = [1, 5],
  extra: { vorlagen?: number[]; events?: number[] } = {},
) => (
  <TerminFenster
    zeile={ZEILE}
    gruppenKalender={4}
    schreibbar={[4, 2]}
    gruppentypenAnlegen={typen}
    vorlagenSchreiben={extra.vorlagen}
    eventsAnlegen={extra.events}
    ort={{ modul: 24, kategorie: 61 }}
    ich={1}
    zeitzone="Europe/Berlin"
    onFertig={onFertig}
    onClose={vi.fn()}
  />
);
const zeigen = (...a: Parameters<typeof element>) => render(element(...a));
const fenster = async () => await screen.findByRole('dialog', { name: 'In Kalender eintragen' });
const reiterAnmeldung = async (f: HTMLElement) => {
  fireEvent.click(await within(f).findByRole('button', { name: 'Anmeldung' }));
  await within(f).findByRole('switch', { name: /für Anmeldung erstellen/ });
};
const schalter = (f: HTMLElement) =>
  within(f).getByRole<HTMLInputElement>('switch', { name: /für Anmeldung erstellen/ });
const anschalten = async (f: HTMLElement) => {
  await waitFor(() => expect(schalter(f).disabled).toBe(false));
  fireEvent.click(schalter(f));
  await within(f).findByLabelText('Gruppentyp');
};
const feld = (f: HTMLElement, name: string | RegExp) =>
  within(f).getByLabelText<HTMLSelectElement>(name);
/** Aus „Kalender“ eine wöchentliche Reihe bis 24.12.2026 machen – 26.11., 03.12., 10.12., 17.12., 24.12. */
const woechentlich = (f: HTMLElement) => {
  fireEvent.change(within(f).getByLabelText('Wiederholungen'), { target: { value: '7' } });
  fireEvent.change(within(f).getByLabelText('Wiederholen bis'), {
    target: { value: '2026-12-24' },
  });
};
const zeilen = (f: HTMLElement) =>
  within(f)
    .queryAllByRole('listitem')
    .map((l) => l.textContent);
const fuss = (f: HTMLElement) => within(f).queryByText(/Beim Speichern legt ChurchTools sofort/);
const speichern = (f: HTMLElement) =>
  within(f).getByRole<HTMLButtonElement>('button', { name: 'Speichern' });

beforeEach(() => {
  // Nur die Uhr festlegen – echte Timer bleiben, sonst hängen `findBy*`/`waitFor`.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-25T12:00:00Z'));
  vi.mocked(ladeSchreibKalender).mockResolvedValue([
    { id: 4, name: 'Gemeindeleitung' },
    { id: 2, name: 'Gottesdienst' },
  ] as never);
  vi.mocked(K.kalenderTermineAmTag).mockResolvedValue([]);
  vi.mocked(V.ladeVorlagen).mockResolvedValue([]);
  vi.mocked(B.ladeRessourcen).mockResolvedValue([]);
  vi.mocked(E.ladeEventVorlagen).mockResolvedValue([{ id: 0, name: 'Standard' }]);
  vi.mocked(A.ladeGruppentypen).mockResolvedValue(TYPEN);
  vi.mocked(A.ladeGruppenDesTyps).mockImplementation((typ) => Promise.resolve(GRUPPEN[typ] ?? []));
  vi.mocked(terminLegen).mockResolvedValue({ art: 'angelegt', id: 700 });
  vi.mocked(terminVermerken).mockResolvedValue(STAND);
  onFertig.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Reiter und Rechte', () => {
  it('ohne Recht in einem Gruppentyp gibt es den Reiter nicht – und nichts wird geladen', async () => {
    zeigen([]);
    const f = await fenster();
    expect(within(f).queryByRole('button', { name: 'Anmeldung' })).toBeNull();
    expect(A.ladeGruppentypen).not.toHaveBeenCalled();
  });

  it('mit Recht: der Reiter ist da, die Gruppentypen werden mit genau den erlaubten Nummern geladen', async () => {
    zeigen([1, 5]);
    const f = await fenster();
    expect(await within(f).findByRole('button', { name: 'Anmeldung' })).toBeTruthy();
    expect(vi.mocked(A.ladeGruppentypen).mock.calls[0][0]).toEqual(new Set([1, 5]));
  });

  it('Reihenfolge wie in ChurchTools: Kalender, Anmeldung, Events', async () => {
    zeigen([1], { events: [4] });
    const f = await fenster();
    await within(f).findByRole('button', { name: 'Events' });
    const namen = within(f)
      .getAllByRole('button', { name: /^(Kalender|Anmeldung|Events)$/ })
      .map((b) => b.textContent);
    expect(namen).toEqual(['Kalender', 'Anmeldung', 'Events']);
  });

  it('das Recht hängt nicht am Kalender: im anderen Kalender bleibt der Reiter', async () => {
    zeigen([1]);
    const f = await fenster();
    fireEvent.change(await screen.findByLabelText('Kalender'), { target: { value: '2' } });
    expect(within(f).getByRole('button', { name: 'Anmeldung' })).toBeTruthy();
  });
});

describe('Schalter und Vorgaben', () => {
  it('Aus ist die Vorgabe: nur der Satz zur Einzahl, keine Felder, nichts im Fuß', async () => {
    zeigen();
    const f = await fenster();
    await reiterAnmeldung(f);
    expect(schalter(f).checked).toBe(false);
    expect(within(f).getByText('Gruppe für Anmeldung erstellen')).toBeTruthy();
    expect(
      within(f).getByText(
        'Für einen Kalendereintrag wird automatisch eine Gruppe erstellt. Dies hat keine Auswirkung auf bereits erstellte Gruppen.',
      ),
    ).toBeTruthy();
    expect(within(f).queryByLabelText('Gruppentyp')).toBeNull();
    expect(fuss(f)).toBeNull();
  });

  it('mit Wiederholung: Mehrzahl und der Satz „Für jede Wiederholung …“', async () => {
    zeigen();
    const f = await fenster();
    woechentlich(f);
    await reiterAnmeldung(f);
    expect(within(f).getByText('Gruppen für Anmeldung erstellen')).toBeTruthy();
    expect(
      within(f).getByText(/Für jede Wiederholung wird eine separate Gruppe erstellt/),
    ).toBeTruthy();
  });

  it('anschalten: Typ „Kleingruppe“ (1), 14 Tage, keine Kopiervorlage, nie beenden', async () => {
    zeigen();
    const f = await fenster();
    await reiterAnmeldung(f);
    await anschalten(f);
    expect(feld(f, 'Gruppentyp').value).toBe('1');
    expect(feld(f, /Wie viele Tage im Voraus/).value).toBe('14');
    expect(feld(f, 'Gruppe als Kopiervorlage').value).toBe('');
    expect(feld(f, /Wie viele Tage nach dem Termin/).value).toBe('');
  });

  it('ohne Kleingruppe unter den erlaubten: der erste erlaubte', async () => {
    vi.mocked(A.ladeGruppentypen).mockResolvedValue([{ id: 5, name: 'Anmeldung' }]);
    zeigen([5]);
    const f = await fenster();
    await reiterAnmeldung(f);
    await anschalten(f);
    expect(feld(f, 'Gruppentyp').value).toBe('5');
  });

  it('Auswahlen wie in ChurchTools: Gruppentypen nach Name, Tage 1/7/14/30/90/365, Beenden leer + dieselben Tage', async () => {
    zeigen();
    const f = await fenster();
    await reiterAnmeldung(f);
    await anschalten(f);
    expect([...feld(f, 'Gruppentyp').options].map((o) => o.text)).toEqual([
      'Kleingruppe',
      'Anmeldung',
    ]);
    expect([...feld(f, /Wie viele Tage im Voraus/).options].map((o) => o.value)).toEqual([
      '1',
      '7',
      '14',
      '30',
      '90',
      '365',
    ]);
    expect([...feld(f, /Wie viele Tage nach dem Termin/).options].map((o) => o.value)).toEqual([
      '',
      '1',
      '7',
      '14',
      '30',
      '90',
      '365',
    ]);
  });

  it('die Gruppentypen laden nicht: Hinweis, Schalter gesperrt – ohne Typ gäbe es nichts zu speichern', async () => {
    vi.mocked(A.ladeGruppentypen).mockRejectedValue(new Error('weg'));
    zeigen();
    const f = await fenster();
    fireEvent.click(await within(f).findByRole('button', { name: 'Anmeldung' }));
    await within(f).findByRole('alert');
    expect(schalter(f).disabled).toBe(true);
  });
});

describe('Kopiervorlage', () => {
  it('nur Gruppen des gewählten Gruppentyps – ein Typwechsel leert die Auswahl und lädt die des neuen Typs', async () => {
    zeigen();
    const f = await fenster();
    await reiterAnmeldung(f);
    await anschalten(f);
    await waitFor(() => expect(feld(f, 'Gruppe als Kopiervorlage').disabled).toBe(false));
    expect([...feld(f, 'Gruppe als Kopiervorlage').options].map((o) => o.text)).toEqual([
      '',
      'Hauskreis Nord',
      'Jugendkreis',
    ]);
    fireEvent.change(feld(f, 'Gruppe als Kopiervorlage'), { target: { value: '302' } });
    expect(feld(f, 'Gruppe als Kopiervorlage').value).toBe('302');
    fireEvent.change(feld(f, 'Gruppentyp'), { target: { value: '5' } });
    expect(feld(f, 'Gruppe als Kopiervorlage').value).toBe('');
    await waitFor(() =>
      expect([...feld(f, 'Gruppe als Kopiervorlage').options].map((o) => o.text)).toEqual([
        '',
        'Anmeldung Freizeit (Vorlage)',
      ]),
    );
    expect(A.ladeGruppenDesTyps).toHaveBeenLastCalledWith(5);
    // Nach dem Typwechsel geht keine Kopiervorlage des alten Typs mit.
    fireEvent.click(speichern(await fenster()));
    await waitFor(() => expect(terminLegen).toHaveBeenCalled());
    expect(vi.mocked(terminLegen).mock.calls[0][0].eintrag.anmeldung).toEqual({
      typ: 5,
      tage: 14,
      vorlage: null,
      beenden: null,
    });
  });

  it('die Gruppen eines Typs werden erst gelesen, wenn der Schalter an ist', async () => {
    zeigen();
    const f = await fenster();
    await reiterAnmeldung(f);
    expect(A.ladeGruppenDesTyps).not.toHaveBeenCalled();
    await anschalten(f);
    await waitFor(() => expect(A.ladeGruppenDesTyps).toHaveBeenCalledWith(1));
  });

  it('der Erklärtext zur Kopiervorlage steht da', async () => {
    zeigen();
    const f = await fenster();
    await reiterAnmeldung(f);
    await anschalten(f);
    expect(
      within(f).getByText(
        /Ohne Auswahl einer Kopiervorlage wird eine neue Gruppe erstellt und verknüpft/,
      ),
    ).toBeTruthy();
  });
});

describe('Vorschau und Fuß (feste Uhr: heute = 25.11.2026)', () => {
  it('ein Einzeltermin morgen: „– 26.11.2026 16:00“, der Fuß nennt 1 Gruppe', async () => {
    zeigen();
    const f = await fenster();
    await reiterAnmeldung(f);
    await anschalten(f);
    within(f).getByText('Folgende Gruppen werden direkt erstellt und mit dem Kalender verknüpft:');
    expect(zeilen(f)).toEqual(['– 26.11.2026 16:00']);
    expect(fuss(f)?.textContent).toBe('Beim Speichern legt ChurchTools sofort 1 Gruppe an.');
  });

  it('wöchentlich bis 24.12.: mit 14 Tagen 26.11. und 03.12. – mit 30 Tagen alle fünf – mit 1 Tag nur der erste', async () => {
    zeigen();
    const f = await fenster();
    woechentlich(f);
    await reiterAnmeldung(f);
    await anschalten(f);
    expect(zeilen(f)).toEqual(['– 26.11.2026 16:00', '– 03.12.2026 16:00']);
    expect(fuss(f)?.textContent).toBe('Beim Speichern legt ChurchTools sofort 2 Gruppen an.');
    fireEvent.change(feld(f, /Wie viele Tage im Voraus/), { target: { value: '30' } });
    expect(zeilen(f)).toHaveLength(5);
    fireEvent.change(feld(f, /Wie viele Tage im Voraus/), { target: { value: '1' } });
    expect(zeilen(f)).toEqual(['– 26.11.2026 16:00']);
  });

  it('liegt kein Einzeltermin im Fenster: der Satz „keine Gruppen“ – und der Fuß sagt nichts', async () => {
    zeigen();
    const f = await fenster();
    fireEvent.change(within(f).getByLabelText('Beginn Datum'), { target: { value: '2027-03-04' } });
    await reiterAnmeldung(f);
    await anschalten(f);
    within(f).getByText('Mit der aktuellen Konfiguration werden keine Gruppen erstellt.');
    expect(zeilen(f)).toEqual([]);
    expect(fuss(f)).toBeNull();
  });

  it('der Fuß erscheint nur mit Schalter an – wieder aus, wieder weg', async () => {
    zeigen();
    const f = await fenster();
    await reiterAnmeldung(f);
    await anschalten(f);
    expect(fuss(f)).toBeTruthy();
    fireEvent.click(schalter(f));
    expect(fuss(f)).toBeNull();
  });

  it('der Fuß steht auch im Reiter „Kalender“ – er gehört zum Speichern', async () => {
    zeigen();
    const f = await fenster();
    await reiterAnmeldung(f);
    await anschalten(f);
    fireEvent.click(within(f).getByRole('button', { name: 'Kalender' }));
    expect(fuss(f)).toBeTruthy();
  });
});

describe('Speichern', () => {
  it('Schalter aus: `anmeldung` ist null – es geht nichts mit', async () => {
    zeigen();
    const f = await fenster();
    await waitFor(() => expect(speichern(f).disabled).toBe(false));
    fireEvent.click(speichern(f));
    await waitFor(() => expect(terminLegen).toHaveBeenCalled());
    expect(vi.mocked(terminLegen).mock.calls[0][0].eintrag.anmeldung).toBeNull();
  });

  it('Schalter an mit Kopiervorlage und Beenden: genau diese Auswahl geht an terminLegen', async () => {
    zeigen();
    const f = await fenster();
    await reiterAnmeldung(f);
    await anschalten(f);
    await waitFor(() => expect(feld(f, 'Gruppe als Kopiervorlage').disabled).toBe(false));
    fireEvent.change(feld(f, 'Gruppe als Kopiervorlage'), { target: { value: '301' } });
    fireEvent.change(feld(f, /Wie viele Tage im Voraus/), { target: { value: '7' } });
    fireEvent.change(feld(f, /Wie viele Tage nach dem Termin/), { target: { value: '30' } });
    fireEvent.click(speichern(f));
    await waitFor(() => expect(terminLegen).toHaveBeenCalled());
    expect(vi.mocked(terminLegen).mock.calls[0][0].eintrag.anmeldung).toEqual({
      typ: 1,
      tage: 7,
      vorlage: 301,
      beenden: 30,
    });
  });

  it('wird das Recht nach dem Anschalten kleiner (anderer Typ erlaubt, keiner mehr): es geht keine Anmeldung mit', async () => {
    const { rerender } = zeigen([1, 5]);
    const f = await fenster();
    await reiterAnmeldung(f);
    await anschalten(f);
    // Typ 1 ist gewählt – nur noch Typ 5 erlaubt: ChurchTools bekäme sonst einen Typ, in dem die Person nicht anlegen darf.
    rerender(element([5]));
    await waitFor(() => expect(speichern(f).disabled).toBe(false));
    fireEvent.click(speichern(f));
    await waitFor(() => expect(terminLegen).toHaveBeenCalledTimes(1));
    expect(vi.mocked(terminLegen).mock.calls[0][0].eintrag.anmeldung).toBeNull();
    expect(fuss(f)).toBeNull();
  });

  it('ohne Recht (kein Reiter) geht nie eine Anmeldung mit', async () => {
    zeigen([]);
    const f = await fenster();
    await waitFor(() => expect(speichern(f).disabled).toBe(false));
    fireEvent.click(speichern(f));
    await waitFor(() => expect(terminLegen).toHaveBeenCalled());
    expect(vi.mocked(terminLegen).mock.calls[0][0].eintrag.anmeldung).toBeNull();
  });

  it('„Nur verknüpfen“: Hinweis im Reiter, Schalter gesperrt, der Fuß verspricht keine Gruppen', async () => {
    vi.mocked(K.kalenderTermineAmTag).mockResolvedValue([
      { id: 161, titel: 'Heiligabend', beginn: '2026-11-26T15:00:00Z' },
    ]);
    zeigen();
    const f = await fenster();
    await within(f).findByText(/schon „Heiligabend“/);
    await reiterAnmeldung(f);
    within(f).getByText(
      /Du verknüpfst einen vorhandenen Termin – dabei werden keine Gruppen angelegt/,
    );
    expect(schalter(f).disabled).toBe(true);
    fireEvent.click(within(f).getByLabelText(/Trotzdem neu anlegen/));
    expect(schalter(f).disabled).toBe(false);
    await anschalten(f);
    fireEvent.click(within(f).getByLabelText(/Nur verknüpfen/));
    expect(fuss(f)).toBeNull();
  });
});

describe('Nach dem Anlegen', () => {
  const ok = { signupFehlt: false, fehlend: [], unklar: false };

  it('alles da: das Fenster geht zu', async () => {
    vi.mocked(terminLegen).mockResolvedValue({ art: 'angelegt', id: 700, anmeldung: ok });
    zeigen();
    const f = await fenster();
    await reiterAnmeldung(f);
    await anschalten(f);
    fireEvent.click(speichern(f));
    await waitFor(() => expect(onFertig).toHaveBeenCalledWith(STAND));
  });

  it('eine Gruppe fehlt: der Termin ist vermerkt, das Fenster bleibt mit EINER Meldung und geht erst mit „Fertig“ zu', async () => {
    vi.mocked(terminLegen).mockResolvedValue({
      art: 'angelegt',
      id: 700,
      anmeldung: { ...ok, fehlend: ['Heiligabend – 26.11.2026, 16:00'] },
    });
    zeigen();
    const f = await fenster();
    await reiterAnmeldung(f);
    await anschalten(f);
    fireEvent.click(speichern(f));
    await within(f).findByText(/Die Gruppe „Heiligabend – 26.11.2026, 16:00“ wurde nicht angelegt/);
    expect(terminVermerken).toHaveBeenCalledTimes(1);
    expect(onFertig).not.toHaveBeenCalled();
    fireEvent.click(within(f).getByRole('button', { name: 'Fertig' }));
    expect(onFertig).toHaveBeenCalledWith(STAND);
  });

  it('nicht nachlesbar: „unklar“ – nicht „fehlt“', async () => {
    vi.mocked(terminLegen).mockResolvedValue({
      art: 'angelegt',
      id: 700,
      anmeldung: { ...ok, unklar: true },
    });
    zeigen();
    const f = await fenster();
    await reiterAnmeldung(f);
    await anschalten(f);
    fireEvent.click(speichern(f));
    const text = (await within(f).findByText(/ließ sich nicht nachlesen/)).textContent;
    expect(text).not.toMatch(/nicht angelegt/);
  });

  it('`signup` am Termin fehlt: eigene Meldung', async () => {
    vi.mocked(terminLegen).mockResolvedValue({
      art: 'angelegt',
      id: 700,
      anmeldung: { ...ok, signupFehlt: true },
    });
    zeigen();
    const f = await fenster();
    await reiterAnmeldung(f);
    await anschalten(f);
    fireEvent.click(speichern(f));
    await within(f).findByText(/die Anmeldung am Termin nicht gespeichert/);
  });
});

describe('Termin-Vorlagen', () => {
  const vorlage = (extra: Partial<TerminVorlage>): TerminVorlage => ({
    id: 9,
    kalender: 4,
    titel: 'Freizeit',
    untertitel: '',
    beschreibung: '',
    link: '',
    intern: false,
    ganztaegig: false,
    startzeit: '10:00',
    dauer: 3600,
    art: 0,
    frequenz: 1,
    option: 0,
    wiederDauer: 0,
    adresse: null,
    tags: [],
    imAuftrag: null,
    buchungen: [],
    eventVorlage: null,
    anmeldungTyp: null,
    anmeldungTage: null,
    anmeldungBeenden: null,
    anmeldungVorlage: null,
    ...extra,
  });

  it('eine Vorlage mit erlaubtem Gruppentyp schaltet den Schalter an und füllt die Felder', async () => {
    vi.mocked(V.ladeVorlagen).mockResolvedValue([
      vorlage({ anmeldungTyp: 5, anmeldungTage: 30, anmeldungBeenden: 7, anmeldungVorlage: 304 }),
    ]);
    zeigen();
    const f = await fenster();
    fireEvent.click(await within(f).findByLabelText('Freizeit'));
    await reiterAnmeldung(f);
    expect(schalter(f).checked).toBe(true);
    expect(feld(f, 'Gruppentyp').value).toBe('5');
    expect(feld(f, /Wie viele Tage im Voraus/).value).toBe('30');
    expect(feld(f, /Wie viele Tage nach dem Termin/).value).toBe('7');
    await waitFor(() => expect(feld(f, 'Gruppe als Kopiervorlage').value).toBe('304'));
  });

  it('eine Vorlage mit einem Gruppentyp, den die Person nicht anlegen darf: Schalter bleibt aus', async () => {
    vi.mocked(V.ladeVorlagen).mockResolvedValue([vorlage({ anmeldungTyp: 2 })]);
    zeigen();
    const f = await fenster();
    fireEvent.click(await within(f).findByLabelText('Freizeit'));
    await reiterAnmeldung(f);
    expect(schalter(f).checked).toBe(false);
  });

  it('eine Vorlage ohne Anmeldung schaltet einen angeschalteten Schalter wieder aus', async () => {
    vi.mocked(V.ladeVorlagen).mockResolvedValue([vorlage({})]);
    zeigen();
    const f = await fenster();
    await reiterAnmeldung(f);
    await anschalten(f);
    fireEvent.click(within(f).getByRole('button', { name: 'Kalender' }));
    fireEvent.click(await within(f).findByLabelText('Freizeit'));
    fireEvent.click(within(f).getByRole('button', { name: 'Anmeldung' }));
    expect(schalter(f).checked).toBe(false);
  });

  it('„Als Vorlage speichern“ nimmt die Anmeldung mit (Schalter an) – und lässt sie ohne weg', async () => {
    vi.mocked(V.vorlageSpeichern).mockResolvedValue([] as never);
    zeigen([1, 5], { vorlagen: [4] });
    const f = await fenster();
    await reiterAnmeldung(f);
    await anschalten(f);
    fireEvent.click(await within(f).findByRole('button', { name: 'Als Vorlage speichern' }));
    await waitFor(() => expect(V.vorlageSpeichern).toHaveBeenCalledTimes(1));
    expect(vi.mocked(V.vorlageSpeichern).mock.calls[0][0].anmeldung).toEqual({
      typ: 1,
      tage: 14,
      vorlage: null,
      beenden: null,
    });
  });
});
