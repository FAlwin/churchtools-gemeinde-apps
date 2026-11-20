// @vitest-environment jsdom
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { BLOCKNOTE_DOKUMENT } from '@shared/protokolle/dokument.testdaten';
import { teileBauen, type ProtokollKopf } from '@shared/protokolle/speicher';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import {
  ablehnen,
  annehmen,
  NAECHSTE,
  neuerVorschlag,
  zielVon,
  type Vorschlag,
} from '@shared/protokolle/vorschlaege';
import { ausSchluessel, bereichSchluessel } from './vorschlaegeMerken';
import * as L from './lesen';
import * as V from './vorschlaegeSchreiben';
import * as SCH from './schreiben';
import { Sitzungen } from './Sitzungen';
import { neuAngebot, neuWaehlen } from './neuMenue.testutil';

// Vorschläge (S5-4): die Regel wird auf den gespeicherten Stand angewendet, wie bei ChurchTools.
const VS = vi.hoisted(() => ({ stand: new Map<string, unknown>() }));
vi.mock('./vorschlaegeSchreiben', () => ({
  vorschlagEinreichen: vi.fn((_o: unknown, v: { id: string }) => {
    VS.stand.set(v.id, v);
    return Promise.resolve(v);
  }),
  vorschlagSchreiben: vi.fn((_o: unknown, id: string, f: (v: unknown) => unknown) => {
    const neu = f(VS.stand.get(id));
    VS.stand.set(id, neu);
    return Promise.resolve(neu);
  }),
}));

// „Teilen / PDF“ (S6-3b): das Blatt festhalten statt zeichnen – jsdom kann kein pdf.js.
const BLAETTER = vi.hoisted(() => [] as unknown[]);
vi.mock('@ui/teilen/protokollPdf', () => ({
  protokollPdf: vi.fn(async (b: unknown) => {
    BLAETTER.push(b);
    const { jsPDF } = await import('jspdf');
    return new jsPDF();
  }),
}));
vi.mock('@ui/teilen/pdfSeiten', () => ({
  renderPdfToCanvases: vi.fn(() => Promise.resolve([])),
  renderPdfSeite: vi.fn(() => Promise.reject(new Error('jsdom'))),
}));
vi.mock('./mitglieder', () => ({
  ladeGruppenMitglieder: vi.fn(() => Promise.resolve('verborgen')),
}));

vi.mock('./lesen', async (orig) => ({
  ...(await orig<typeof import('./lesen')>()),
  ladeSitzungen: vi.fn(),
  ladeMitarbeit: vi.fn(),
}));
const m = vi.mocked(L);
vi.mock('./schreiben', async (orig) => ({
  ...(await orig<typeof import('./schreiben')>()),
  freigabeZuruecknehmen: vi.fn(),
}));

const ICH = { person: 1, name: 'Alwin' };
const GRUPPEN: ProtokollGruppe[] = [
  { id: 11, name: 'Leitungsteam', lage: 'eingerichtet', protokolle: 60, mitarbeit: 61 },
  { id: 7, name: 'Jugendleitung', lage: 'eingerichtet', protokolle: 70, mitarbeit: 71 },
];
const { stand, werte } = teileBauen(BLOCKNOTE_DOKUMENT, 'okt');
const KOPF: ProtokollKopf = {
  art: 'protokoll',
  fassung: 1,
  sitzung: 'okt',
  titel: 'Leitungssitzung',
  status: 'frei',
  beginn: '2026-10-14T17:00:00Z',
  termin: null,
  treffen: null,
  freigabe: { von: 1, am: '2026-10-15T08:00:00Z' },
  sperre: null,
  stand,
};
const PROTOKOLL: Sitzung = {
  schluessel: 'p:okt',
  beginn: KOPF.beginn,
  titel: 'Leitungssitzung',
  termin: null,
  treffen: null,
  kopf: KOPF,
  anfragen: [],
};
const KOMMEND: Sitzung = {
  schluessel: 't:4:114',
  beginn: '2027-03-17T17:00:00Z',
  titel: 'Klausur',
  termin: { kalender: 4, id: 114 },
  treffen: 15,
  kopf: null,
  anfragen: [{ person: 1, antwort: 'zugesagt' }],
};
const DATEN: L.GruppenSitzungen = {
  kommend: [KOMMEND],
  protokolle: [PROTOKOLL],
  teile: werte.map((w) => JSON.parse(w) as L.GruppenSitzungen['teile'][number]),
  kalender: 4,
  treffenNichtFreigegeben: false,
  punkte: 'vorschlagen',
};

beforeEach(() => {
  vi.clearAllMocks();
  VS.stand.clear();
  localStorage.clear();
  m.ladeSitzungen.mockResolvedValue(DATEN);
  m.ladeMitarbeit.mockResolvedValue({ aufgaben: [], todoVorschlaege: [], vorschlaege: [] });
});

describe('Reiter „Sitzungen“ (S3-2)', () => {
  it('zeigt Kommend und Protokolle der ersten Gruppe', async () => {
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} />);
    const kommend = await screen.findByRole('region', { name: 'Kommend' });
    expect(within(kommend).getByText('Klausur')).toBeTruthy();
    const protokolle = screen.getByRole('region', { name: 'Protokolle' });
    expect(within(protokolle).getByText(/freigegeben am 15\.10\.2026/)).toBeTruthy();
    expect(m.ladeSitzungen).toHaveBeenCalledWith(24, GRUPPEN[0], expect.any(String));
  });

  it('Gruppe wechseln lädt deren Sitzungen', async () => {
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} />);
    await screen.findByText('Klausur');
    // Die Überschrift ist die Gruppenwahl (kein Segment mit einem Knopf je Gruppe mehr).
    fireEvent.click(screen.getByRole('button', { name: `Gruppe wählen: ${GRUPPEN[0].name}` }));
    fireEvent.click(screen.getByRole('option', { name: 'Jugendleitung' }));
    await waitFor(() =>
      expect(m.ladeSitzungen).toHaveBeenLastCalledWith(24, GRUPPEN[1], expect.any(String)),
    );
    expect(screen.getByRole('button', { name: 'Gruppe wählen: Jugendleitung' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Gruppe' })).toBeNull();
  });

  it('Hinweise: kein Kalender gewählt, Gruppentreffen nicht freigegeben', async () => {
    m.ladeSitzungen.mockResolvedValue({ ...DATEN, kalender: null, treffenNichtFreigegeben: true });
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} />);
    expect(await screen.findByText(/noch kein Kalender gewählt/)).toBeTruthy();
    expect(screen.getByText(/Gruppentreffen dieser Gruppe sind für dich/)).toBeTruthy();
  });

  it('vorübergehender Fehler: „Erneut versuchen“ – keine leere Liste', async () => {
    m.ladeSitzungen.mockRejectedValueOnce(new ApiError(503, 'weg'));
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByText('Klausur')).toBeTruthy();
    expect(screen.queryByText('Keine kommenden Sitzungen.')).toBeNull();
  });

  it('Protokoll öffnen: das Dokument aus den Teilen, Bereiche, zurück zur Liste', async () => {
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} />);
    fireEvent.click(await screen.findByText(/freigegeben am 15\.10\.2026/));
    expect(await screen.findByText('Andacht & Gebet')).toBeTruthy();
    expect(screen.getByRole('region', { name: /To-Dos/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sitzungen' }));
    expect(await screen.findByRole('region', { name: 'Kommend' })).toBeTruthy();
  });

  it('Früheres Protokoll (K3b-2): „Öffnen“ im Fenster springt dorthin, „Zurück“ führt wieder her', async () => {
    const nov = teileBauen(
      [
        {
          id: 'n1',
          type: 'heading',
          props: { level: 1 },
          content: [{ type: 'text', text: 'Rückblick', styles: {} }],
          children: [],
        },
        { id: 'n2', type: 'verweis', props: { art: 'letztes-protokoll' }, children: [] },
      ],
      'nov',
    );
    const NOV: Sitzung = {
      ...PROTOKOLL,
      schluessel: 'p:nov',
      beginn: '2026-11-11T18:00:00Z',
      titel: 'Novembersitzung',
      kopf: {
        ...KOPF,
        sitzung: 'nov',
        titel: 'Novembersitzung',
        beginn: '2026-11-11T18:00:00Z',
        stand: nov.stand,
      },
    };
    m.ladeSitzungen.mockResolvedValue({
      ...DATEN,
      protokolle: [NOV, PROTOKOLL],
      teile: [
        ...DATEN.teile,
        ...nov.werte.map((w) => JSON.parse(w) as L.GruppenSitzungen['teile'][number]),
      ],
    });
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} />);
    fireEvent.click(await screen.findByText('Novembersitzung'));
    expect(await screen.findByText('Rückblick')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ansehen' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Öffnen' }));
    // Jetzt das Protokoll vom 14.10. – nicht mehr das vom November.
    expect(await screen.findByText('Andacht & Gebet')).toBeTruthy();
    expect(screen.queryByText('Rückblick')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sitzungen' }));
    expect(await screen.findByText('Rückblick')).toBeTruthy();
    // Von dort führt „Zurück“ wie immer zur Liste.
    fireEvent.click(screen.getByRole('button', { name: 'Sitzungen' }));
    expect(await screen.findByRole('region', { name: 'Kommend' })).toBeTruthy();
  });

  it('Sitzung ohne Protokoll: sagt das', async () => {
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} />);
    fireEvent.click(await screen.findByText('Klausur'));
    expect(await screen.findByText(/gibt es noch kein Protokoll/)).toBeTruthy();
  });

  it('Teile fehlen (gerade gespeichert): Hinweis statt halbem Dokument', async () => {
    m.ladeSitzungen.mockResolvedValue({ ...DATEN, teile: DATEN.teile.slice(0, 0) });
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} />);
    fireEvent.click(await screen.findByText(/freigegeben am 15\.10\.2026/));
    expect(await screen.findByText(/nicht vollständig lesbar/)).toBeTruthy();
    expect(screen.queryByText('Andacht & Gebet')).toBeNull();
  });

  it('S3-3: Auswahl von der Startseite – diese Gruppe, die Sitzung gleich offen', async () => {
    render(
      <Sitzungen
        ich={ICH}
        modul={24}
        gruppen={GRUPPEN}
        auswahl={{ gruppe: 7, sitzung: 'p:okt' }}
      />,
    );
    expect(await screen.findByText('Andacht & Gebet')).toBeTruthy();
    expect(m.ladeSitzungen).toHaveBeenCalledWith(24, GRUPPEN[1], expect.any(String));
    // „Zurück“ führt zur Liste dieser Gruppe – die Auswahl öffnet die Sitzung nicht noch einmal.
    fireEvent.click(screen.getByRole('button', { name: 'Sitzungen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Gruppe wählen: Jugendleitung' }));
    fireEvent.click(screen.getByRole('option', { name: 'Leitungsteam' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe wählen: Leitungsteam' }));
    fireEvent.click(screen.getByRole('option', { name: 'Jugendleitung' }));
    expect(await screen.findByRole('region', { name: 'Kommend' })).toBeTruthy();
    expect(screen.queryByText('Andacht & Gebet')).toBeNull();
  });

  it('S3-3: nur die Gruppe gewählt – die Liste, nichts geöffnet', async () => {
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} auswahl={{ gruppe: 7 }} />);
    expect(await screen.findByRole('region', { name: 'Kommend' })).toBeTruthy();
    expect(m.ladeSitzungen).toHaveBeenCalledWith(24, GRUPPEN[1], expect.any(String));
  });

  it('S3-4b: aus der Suche – Sitzung offen, zum Punkt gesprungen und hervorgehoben', async () => {
    const springen = vi.fn();
    Element.prototype.scrollIntoView = springen;
    const punkt = BLOCKNOTE_DOKUMENT.find((b) => b.type === 'heading')!.id;
    render(
      <Sitzungen
        ich={ICH}
        modul={24}
        gruppen={GRUPPEN}
        auswahl={{ gruppe: 11, sitzung: 'p:okt', punkt }}
      />,
    );
    const h = (await screen.findByText('Andacht & Gebet')).closest('h3')!;
    expect(h.id).toBe(`punkt-${punkt}`);
    expect(h.className).toMatch(/markiert/);
    expect(springen).toHaveBeenCalledTimes(1);
    expect(springen.mock.contexts[0]).toBe(h);
    // Zurück zur Liste und wieder hinein: kein Sprung, keine Hervorhebung mehr.
    fireEvent.click(screen.getByRole('button', { name: 'Sitzungen' }));
    fireEvent.click(await screen.findByText(/freigegeben am 15\.10\.2026/));
    expect((await screen.findByText('Andacht & Gebet')).closest('h3')!.className).not.toMatch(
      /markiert/,
    );
    expect(springen).toHaveBeenCalledTimes(1);
  });

  it('S3-4b: im React-Prüfmodus (zweimal geladen) bleibt der Sprung erhalten', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const punkt = BLOCKNOTE_DOKUMENT.find((b) => b.type === 'heading')!.id;
    render(
      <StrictMode>
        <Sitzungen
          ich={ICH}
          modul={24}
          gruppen={GRUPPEN}
          auswahl={{ gruppe: 11, sitzung: 'p:okt', punkt }}
        />
      </StrictMode>,
    );
    expect(m.ladeSitzungen.mock.calls.length).toBeGreaterThan(1);
    const h = (await screen.findByText('Andacht & Gebet')).closest('h3')!;
    await waitFor(() => expect(m.ladeSitzungen).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(h.className).toMatch(/markiert/);
  });

  it('keine Gruppe: ein Satz, kein Laden', () => {
    render(<Sitzungen ich={ICH} modul={24} gruppen={[]} />);
    expect(screen.getByText(/keiner Gruppe/)).toBeTruthy();
    expect(m.ladeSitzungen).not.toHaveBeenCalled();
  });
});

describe('Vorschläge (S5-4)', () => {
  const PETER = { person: 19, name: 'Peter Wiens' };
  const vorschlag = (id: string, ziel = zielVon(KOMMEND)): Vorschlag => {
    const v = neuerVorschlag({
      id,
      gruppe: 11,
      titel: `Thema ${id}`,
      text: '',
      ziel,
      ich: PETER,
      am: '2026-11-01T10:00:00Z',
    });
    VS.stand.set(id, v);
    return v;
  };
  const karte = () => screen.findByRole('region', { name: 'Vorschläge' });
  const vorschlagen = async (thema: string) => {
    await neuWaehlen('Punkt vorschlagen');
    fireEvent.change(screen.getByPlaceholderText(/Kinderbetreuung beim Gemeindeessen/), {
      target: { value: thema },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Vorschlagen' }));
  };

  it('Mitglied schlägt für die nächste Sitzung vor – mit vollem Namen; sieht ihn mit Stand, ohne Leitungs-Knöpfe', async () => {
    render(<Sitzungen ich={ICH} vollerName="Alwin Friesen" modul={24} gruppen={GRUPPEN} />);
    await vorschlagen('Neue Lieder');
    await waitFor(() => expect(V.vorschlagEinreichen).toHaveBeenCalledTimes(1));
    const [ort, v] = vi.mocked(V.vorschlagEinreichen).mock.calls[0];
    expect(ort).toEqual({ modul: 24, kategorie: 61 });
    expect(v).toMatchObject({
      titel: 'Neue Lieder',
      von: 1,
      name: 'Alwin Friesen',
      stand: 'offen',
      ziel: zielVon(KOMMEND),
    });
    const k = await karte();
    expect(within(k).getByText('Neue Lieder')).toBeTruthy();
    expect(within(k).getByText(/von Alwin Friesen \(du\)/)).toBeTruthy();
    // Die Knöpfe stehen erst im aufgeklappten Vorschlag.
    expect(within(k).queryByRole('button', { name: 'Zurückziehen' })).toBeNull();
    fireEvent.click(within(k).getByRole('button', { name: /Neue Lieder/ }));
    expect(within(k).getByRole('button', { name: 'Zurückziehen' })).toBeTruthy();
    expect(within(k).queryByRole('button', { name: 'Übernehmen' })).toBeNull();
    const kommend = screen.getByRole('region', { name: 'Kommend' });
    expect(within(kommend).getByText('1 Vorschlag offen')).toBeTruthy();
  });

  it('ohne festgelegte Sitzung: „Nächste Sitzung (noch nicht festgelegt)“', async () => {
    m.ladeSitzungen.mockResolvedValue({ ...DATEN, kommend: [] });
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} />);
    await vorschlagen('Jahresplanung');
    expect(
      screen.getByRole('option', { name: /Nächste Sitzung \(noch nicht festgelegt\)/ }),
    ).toBeTruthy();
    await waitFor(() => expect(V.vorschlagEinreichen).toHaveBeenCalled());
    expect(vi.mocked(V.vorschlagEinreichen).mock.calls[0][1].ziel).toEqual(NAECHSTE);
    expect(
      within(await karte()).getByText(/die nächste Sitzung · noch nicht festgelegt/),
    ).toBeTruthy();
  });

  it('Leitung übernimmt in der Liste: für diese Sitzung vorgemerkt', async () => {
    m.ladeMitarbeit.mockResolvedValue({
      aufgaben: [],
      todoVorschlaege: [],
      vorschlaege: [vorschlag('v1')],
    });
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} schreibbar={[60]} />);
    const k = await karte();
    fireEvent.click(within(k).getByRole('button', { name: /Thema v1/ }));
    expect(within(k).queryByRole('button', { name: 'Zurückziehen' })).toBeNull();
    fireEvent.click(within(k).getByRole('button', { name: 'Übernehmen' }));
    // Übernommene verschwinden aus der Liste – an der Sitzung steht die Marke.
    await waitFor(() => expect(within(k).queryByText('Thema v1')).toBeNull());
    const kommend = screen.getByRole('region', { name: 'Kommend' });
    expect(await within(kommend).findByText('1 Vorschlag übernommen')).toBeTruthy();
    expect(within(kommend).queryByText(/Vorschlag offen/)).toBeNull();
    expect(VS.stand.get('v1')).toMatchObject({ stand: 'angenommen', ziel: zielVon(KOMMEND) });
  });

  it('„Direkt eintragen“: keine Entscheidung nötig – „kommt ins Protokoll“, keine Leitungs-Knöpfe', async () => {
    m.ladeSitzungen.mockResolvedValue({ ...DATEN, punkte: 'direkt' });
    m.ladeMitarbeit.mockResolvedValue({
      aufgaben: [],
      todoVorschlaege: [],
      vorschlaege: [vorschlag('v1')],
    });
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} schreibbar={[60]} />);
    const k = await karte();
    expect(within(k).getByText('kommt ins Protokoll')).toBeTruthy();
    fireEvent.click(within(k).getByRole('button', { name: /Thema v1/ }));
    expect(within(k).queryByRole('button', { name: 'Übernehmen' })).toBeNull();
    expect(within(k).queryByRole('button', { name: 'Ablehnen' })).toBeNull();
  });

  describe('Kurzform und Aufräumen (W8c)', () => {
    const TAGE = 86_400_000;
    const vorTagen = (n: number) => new Date(Date.now() - n * TAGE).toISOString();
    const abgelehnt = (
      id: string,
      vor = 3,
      von = PETER,
      grund = 'Passt besser in die Jahresplanung.',
    ) => {
      const v = ablehnen(
        neuerVorschlag({
          id,
          gruppe: 11,
          titel: `Thema ${id}`,
          text: 'Ein längerer Text.',
          ziel: zielVon(KOMMEND),
          ich: von,
          am: '2026-11-01T10:00:00Z',
        }),
        grund,
        { person: 1, name: 'Alwin' },
        vorTagen(vor),
      );
      VS.stand.set(id, v);
      return v;
    };
    const mitText = (id: string, text: string) => {
      const v = { ...vorschlag(id), text };
      VS.stand.set(id, v);
      return v;
    };
    const laden = (vorschlaege: Vorschlag[], schreibbar: number[] = [60]) => {
      m.ladeMitarbeit.mockResolvedValue({ aufgaben: [], todoVorschlaege: [], vorschlaege });
      render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} schreibbar={schreibbar} />);
    };

    it('Kurzform: Titel und erste Textzeile, Knöpfe und voller Text erst aufgeklappt – immer nur einer', async () => {
      laden([mitText('a', 'Erste Zeile\nZweite Zeile'), mitText('b', 'Text B')]);
      const k = await karte();
      expect(within(k).getByText('Erste Zeile')).toBeTruthy();
      expect(within(k).queryByText(/Zweite Zeile/)).toBeNull();
      expect(within(k).queryAllByRole('button', { name: 'Übernehmen' })).toHaveLength(0);
      fireEvent.click(within(k).getByRole('button', { name: /Thema a/ }));
      expect(within(k).getByText(/Zweite Zeile/)).toBeTruthy();
      expect(within(k).getAllByRole('button', { name: 'Übernehmen' })).toHaveLength(1);
      // Ein zweiter klappt den ersten zu.
      fireEvent.click(within(k).getByRole('button', { name: /Thema b/ }));
      expect(within(k).queryByText(/Zweite Zeile/)).toBeNull();
      expect(within(k).getAllByRole('button', { name: 'Übernehmen' })).toHaveLength(1);
      // Noch einmal darauf: zu.
      fireEvent.click(within(k).getByRole('button', { name: /Thema b/ }));
      expect(within(k).queryAllByRole('button', { name: 'Übernehmen' })).toHaveLength(0);
    });

    it('Bereich: mit Offenen standardmäßig offen, ohne zu; Klick klappt zu, das Gerät merkt es', async () => {
      laden([vorschlag('a')]);
      const k = await karte();
      const kopf = within(k).getByRole('button', { name: /Vorschläge.*1 offen/ });
      expect(kopf.getAttribute('aria-expanded')).toBe('true');
      fireEvent.click(kopf);
      expect(kopf.getAttribute('aria-expanded')).toBe('false');
      expect(within(k).queryByText('Thema a')).toBeNull();
      expect(localStorage.getItem(bereichSchluessel(1, 11))).toBe('false');
    });

    it('Bereich: eine gemerkte Wahl gilt beim nächsten Öffnen', async () => {
      localStorage.setItem(bereichSchluessel(1, 11), 'false');
      laden([vorschlag('a')]);
      const k = await karte();
      expect(
        within(k)
          .getByRole('button', { name: /Vorschläge/ })
          .getAttribute('aria-expanded'),
      ).toBe('false');
      expect(within(k).queryByText('Thema a')).toBeNull();
    });

    it('Bereich ohne Offene: zu – und aufklappbar', async () => {
      laden([abgelehnt('x')]);
      const k = await karte();
      const kopf = within(k).getByRole('button', { name: /Vorschläge.*0 offen/ });
      expect(kopf.getAttribute('aria-expanded')).toBe('false');
      fireEvent.click(kopf);
      expect(within(k).getByText('Thema x')).toBeTruthy();
    });

    it('ohne Speicher im Gerät: alles funktioniert trotzdem', async () => {
      const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('gesperrt');
      });
      const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('gesperrt');
      });
      try {
        laden([vorschlag('a'), abgelehnt('x')]);
        const k = await karte();
        const kopf = within(k).getByRole('button', { name: /Vorschläge.*1 offen/ });
        expect(kopf.getAttribute('aria-expanded')).toBe('true');
        fireEvent.click(kopf);
        expect(kopf.getAttribute('aria-expanded')).toBe('false');
        fireEvent.click(kopf);
        fireEvent.click(within(k).getByRole('button', { name: /„Thema x“ ausblenden/ }));
        expect(within(k).queryByText('Thema x')).toBeNull();
      } finally {
        get.mockRestore();
        set.mockRestore();
      }
    });

    it('Übernommene und im Protokoll stehende stehen nicht in der Liste – die Sitzung zeigt sie als Marke', async () => {
      const an = annehmen(
        vorschlag('a'),
        KOMMEND,
        { person: 1, name: 'Alwin' },
        '2026-11-02T10:00:00Z',
      );
      VS.stand.set('a', an);
      laden([an, vorschlag('b')]);
      const k = await karte();
      expect(within(k).queryByText('Thema a')).toBeNull();
      expect(within(k).getByText('Thema b')).toBeTruthy();
      const kommend = screen.getByRole('region', { name: 'Kommend' });
      expect(within(kommend).getByText('1 Vorschlag übernommen')).toBeTruthy();
      expect(within(kommend).getByText('1 Vorschlag offen')).toBeTruthy();
    });

    it('Abgelehnt: eigene Gruppe mit „Grund“ und „noch N Tage“, aufgeklappt die volle Begründung – sonst keine Knöpfe', async () => {
      laden([abgelehnt('x', 3)]);
      const k = await karte();
      fireEvent.click(within(k).getByRole('button', { name: /Vorschläge/ }));
      expect(within(k).getByText(/Abgelehnt · verschwindet nach 7 Tagen/)).toBeTruthy();
      expect(within(k).getByText(/Grund: Passt besser/)).toBeTruthy();
      expect(within(k).getByText(/noch 4 Tage sichtbar/)).toBeTruthy();
      fireEvent.click(within(k).getByRole('button', { name: /^Thema x/ }));
      expect(within(k).getByText('Begründung:')).toBeTruthy();
      expect(within(k).queryByRole('button', { name: 'Übernehmen' })).toBeNull();
      expect(within(k).queryByRole('button', { name: 'Ablehnen' })).toBeNull();
    });

    it('Abgelehnt: nach 7 Tagen weg (noch gespeichert)', async () => {
      laden([abgelehnt('alt', 8), abgelehnt('neu', 6)]);
      const k = await karte();
      fireEvent.click(within(k).getByRole('button', { name: /Vorschläge/ }));
      expect(within(k).queryByText('Thema alt')).toBeNull();
      expect(within(k).getByText('Thema neu')).toBeTruthy();
      expect(within(k).getByText(/noch 1 Tag sichtbar/)).toBeTruthy();
      expect(VS.stand.get('alt')).toMatchObject({ stand: 'abgelehnt' });
    });

    it('Abgelehnt sehen nur der Vorschlagende und die Leitung', async () => {
      // Ein anderes Mitglied (ICH = 1, der Vorschlagende ist Peter): nichts.
      laden([abgelehnt('x', 1, PETER), abgelehnt('y', 1, ICH)], []);
      const k = await karte();
      fireEvent.click(within(k).getByRole('button', { name: /Vorschläge/ }));
      expect(within(k).queryByText('Thema x')).toBeNull();
      expect(within(k).getByText('Thema y')).toBeTruthy(); // der eigene
    });

    it('Abgelehnt: die Leitung sieht auch fremde', async () => {
      laden([abgelehnt('x', 1, PETER)]);
      const k = await karte();
      fireEvent.click(within(k).getByRole('button', { name: /Vorschläge/ }));
      expect(within(k).getByText('Thema x')).toBeTruthy();
    });

    it('„×“ blendet einen Abgelehnten früher aus – je Gerät gemerkt, auch nach dem Neuladen', async () => {
      laden([abgelehnt('x', 1), abgelehnt('y', 1)]);
      const k = await karte();
      fireEvent.click(within(k).getByRole('button', { name: /Vorschläge/ }));
      fireEvent.click(within(k).getByRole('button', { name: /„Thema x“ ausblenden/ }));
      expect(within(k).queryByText('Thema x')).toBeNull();
      expect(within(k).getByText('Thema y')).toBeTruthy();
      expect(JSON.parse(localStorage.getItem(ausSchluessel(1, 11)) ?? 'null')).toEqual(['x']);
      expect(VS.stand.get('x')).toMatchObject({ stand: 'abgelehnt' });
    });

    it('ausgeblendet bleibt ausgeblendet, wenn die Seite neu geladen wird', async () => {
      localStorage.setItem(ausSchluessel(1, 11), JSON.stringify(['x']));
      laden([abgelehnt('x', 1), abgelehnt('y', 1)]);
      const k = await karte();
      fireEvent.click(within(k).getByRole('button', { name: /Vorschläge/ }));
      expect(within(k).queryByText('Thema x')).toBeNull();
      expect(within(k).getByText('Thema y')).toBeTruthy();
    });
  });

  it('Gruppe ohne Mitarbeit-Kategorie (unvollständig): kein Vorschlagen, keine Karte', async () => {
    render(<Sitzungen ich={ICH} modul={24} gruppen={[{ ...GRUPPEN[0], mitarbeit: null }]} />);
    await screen.findByRole('region', { name: 'Kommend' });
    expect(await neuAngebot()).not.toContain('Punkt vorschlagen');
    expect(screen.queryByRole('region', { name: 'Vorschläge' })).toBeNull();
  });
});

describe('Freigegeben (S6-1)', () => {
  const MIT_VERLAUF = {
    ...KOPF,
    verlauf: [{ art: 'freigegeben', von: 1, name: 'Alwin Friesen', am: '2026-10-15T08:00:00Z' }],
  };
  const FREI: Sitzung = { ...PROTOKOLL, kopf: MIT_VERLAUF };

  it('Marke mit Namen; „Freigabe zurücknehmen“ nur für die Leitung – mit Rückfrage, danach neu geladen', async () => {
    m.ladeSitzungen.mockResolvedValue({ ...DATEN, protokolle: [FREI] });
    vi.mocked(SCH.freigabeZuruecknehmen).mockResolvedValue({
      art: 'ok',
      kopf: { ...KOPF, status: 'entwurf' },
    });
    const r = render(
      <Sitzungen ich={ICH} vollerName="Johann Becker" modul={24} gruppen={GRUPPEN} />,
    );
    fireEvent.click(await screen.findByText(/freigegeben am 15\.10\.2026/));
    expect(await screen.findByText('freigegeben am 15.10.2026 von Alwin Friesen')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Freigabe zurücknehmen/ })).toBeNull();
    r.unmount();

    render(
      <Sitzungen
        ich={ICH}
        vollerName="Johann Becker"
        modul={24}
        gruppen={GRUPPEN}
        schreibbar={[60]}
      />,
    );
    fireEvent.click(await screen.findByText(/freigegeben am 15\.10\.2026/));
    fireEvent.click(await screen.findByRole('button', { name: /Freigabe zurücknehmen/ }));
    expect(SCH.freigabeZuruecknehmen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Zurücknehmen' }));
    await waitFor(() =>
      expect(SCH.freigabeZuruecknehmen).toHaveBeenCalledWith(
        { modul: 24, kategorie: 60, sitzung: 'okt' },
        { person: 1, name: 'Johann Becker' },
      ),
    );
    await waitFor(() => expect(m.ladeSitzungen.mock.calls.length).toBeGreaterThanOrEqual(3));
  });

  it('zurückgenommen: Vermerk über dem Entwurf (auch beim Lesen)', async () => {
    const zurueck = {
      ...KOPF,
      status: 'entwurf' as const,
      freigabe: null,
      verlauf: [
        { art: 'freigegeben', von: 1, name: 'Alwin Friesen', am: '2026-10-15T08:00:00Z' },
        { art: 'zurueckgenommen', von: 7, name: 'Johann Becker', am: '2026-10-16T08:00:00Z' },
      ],
    };
    m.ladeSitzungen.mockResolvedValue({
      ...DATEN,
      kommend: [{ ...PROTOKOLL, kopf: zurueck }],
      protokolle: [],
    });
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} />);
    fireEvent.click(await screen.findByText('Entwurf'));
    expect(
      await screen.findByText(
        'Freigabe zurückgenommen am 16.10.2026 von Johann Becker – vorher freigegeben am 15.10.2026 von Alwin Friesen.',
      ),
    ).toBeTruthy();
  });
});

describe('Teilen / PDF (S6-3b)', () => {
  it('für alle, die lesen: Fenster mit Gemeinde und der nächsten Sitzung', async () => {
    BLAETTER.length = 0;
    render(
      <Sitzungen
        ich={ICH}
        vollerName="Alwin Friesen"
        gemeinde="ECG Donrath"
        modul={24}
        gruppen={GRUPPEN}
      />,
    );
    fireEvent.click(await screen.findByText(/freigegeben am 15\.10\.2026/));
    fireEvent.click(await screen.findByRole('button', { name: /Teilen \/ PDF/ }));
    expect(await screen.findByRole('dialog', { name: 'Protokoll teilen' })).toBeTruthy();
    expect(await screen.findByText(/Protokoll Leitungsteam 2026-10-14\.pdf/)).toBeTruthy();
    const b = BLAETTER.at(-1) as { gemeinde: string; uebersicht: { naechste: string | null } };
    expect(b.gemeinde).toBe('ECG Donrath');
    expect(b.uebersicht.naechste).toMatch(/17\.03\.2027/);
  });

  it('ohne Protokoll kein Knopf', async () => {
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} schreibbar={[60]} />);
    fireEvent.click(await screen.findByText('Klausur'));
    expect(await screen.findByText(/Für diese Sitzung gibt es noch kein Protokoll/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Teilen \/ PDF/ })).toBeNull();
  });
});

describe('„Neu“ am Handy (R3)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const geraet = (handy: boolean) =>
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: handy && q.includes('max-width'),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

  it('Handy: das schwebende Plus (kein Quadrat im Kopf), und es öffnet dasselbe Menü als Blatt', async () => {
    geraet(true);
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} />);
    await screen.findByRole('region', { name: 'Kommend' });
    const plus = screen.getByRole('button', { name: 'Neu' });
    expect(plus.className).toMatch(/plus/);
    expect(plus.className).not.toMatch(/(^|[\s_])neu([\s_]|$)/);
    fireEvent.click(plus);
    const blatt = within(screen.getByRole('dialog', { name: 'Neu' }));
    expect(blatt.getByRole('button', { name: 'Punkt vorschlagen' })).toBeTruthy();
  });

  it('Rechner/iPad: bleibt der grüne Knopf „Neu ⌄“ mit Menü', async () => {
    geraet(false);
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} />);
    await screen.findByRole('region', { name: 'Kommend' });
    const knopf = screen.getByRole('button', { name: 'Neu' });
    expect(knopf.className).toMatch(/(^|[\s_])neu([\s_]|$)/);
    expect(knopf.className).not.toMatch(/plus/);
  });
});
