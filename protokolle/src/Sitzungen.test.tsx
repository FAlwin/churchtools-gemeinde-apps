// @vitest-environment jsdom
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { BLOCKNOTE_DOKUMENT } from '@shared/protokolle/dokument.testdaten';
import { teileBauen, type ProtokollKopf } from '@shared/protokolle/speicher';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { NAECHSTE, neuerVorschlag, zielVon, type Vorschlag } from '@shared/protokolle/vorschlaege';
import * as L from './lesen';
import * as V from './vorschlaegeSchreiben';
import * as SCH from './schreiben';
import { Sitzungen } from './Sitzungen';

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
  m.ladeSitzungen.mockResolvedValue(DATEN);
  m.ladeMitarbeit.mockResolvedValue({ aufgaben: [], vorschlaege: [] });
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
    fireEvent.click(screen.getByRole('button', { name: 'Jugendleitung' }));
    await waitFor(() =>
      expect(m.ladeSitzungen).toHaveBeenLastCalledWith(24, GRUPPEN[1], expect.any(String)),
    );
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
    expect(await screen.findByRole('heading', { name: 'Jugendleitung' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Leitungsteam' }));
    fireEvent.click(screen.getByRole('button', { name: 'Jugendleitung' }));
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
    fireEvent.click(
      await screen.findByRole('button', { name: /Punkt für eine Sitzung vorschlagen/ }),
    );
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
    expect(within(k).getByRole('button', { name: 'Zurückziehen' })).toBeTruthy();
    expect(within(k).queryByRole('button', { name: 'Übernehmen' })).toBeNull();
    const kommend = screen.getByRole('region', { name: 'Kommend' });
    expect(within(kommend).getByText('1 Vorschlag')).toBeTruthy();
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
    m.ladeMitarbeit.mockResolvedValue({ aufgaben: [], vorschlaege: [vorschlag('v1')] });
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} schreibbar={[60]} />);
    const k = await karte();
    expect(within(k).queryByRole('button', { name: 'Zurückziehen' })).toBeNull();
    fireEvent.click(within(k).getByRole('button', { name: 'Übernehmen' }));
    expect(await within(k).findByText('übernommen')).toBeTruthy();
    expect(VS.stand.get('v1')).toMatchObject({ stand: 'angenommen', ziel: zielVon(KOMMEND) });
  });

  it('„Direkt eintragen“: keine Entscheidung nötig – „kommt ins Protokoll“, keine Leitungs-Knöpfe', async () => {
    m.ladeSitzungen.mockResolvedValue({ ...DATEN, punkte: 'direkt' });
    m.ladeMitarbeit.mockResolvedValue({ aufgaben: [], vorschlaege: [vorschlag('v1')] });
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} schreibbar={[60]} />);
    const k = await karte();
    expect(within(k).getByText('kommt ins Protokoll')).toBeTruthy();
    expect(within(k).queryByRole('button', { name: 'Übernehmen' })).toBeNull();
    expect(within(k).queryByRole('button', { name: 'Ablehnen' })).toBeNull();
  });

  it('Gruppe ohne Mitarbeit-Kategorie (unvollständig): kein Vorschlagen, keine Karte', async () => {
    render(<Sitzungen ich={ICH} modul={24} gruppen={[{ ...GRUPPEN[0], mitarbeit: null }]} />);
    await screen.findByRole('region', { name: 'Kommend' });
    expect(screen.queryByRole('button', { name: /Punkt für eine Sitzung vorschlagen/ })).toBeNull();
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
