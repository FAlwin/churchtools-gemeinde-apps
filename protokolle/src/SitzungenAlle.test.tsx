// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { BLOCKNOTE_DOKUMENT } from '@shared/protokolle/dokument.testdaten';
import { teileBauen, type ProtokollKopf } from '@shared/protokolle/speicher';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import * as L from './lesen';
import { Sitzungen } from './Sitzungen';
import { merkSchluessel } from './useToDoEinstellungen';
import { pruefen, VORGABE } from './todoEinstellungen';
import { werteAus } from './useToDoEinstellungen';
import { neuAngebot } from './neuMenue.testutil';

/**
 * „Alle Gruppen“ im Reiter „Sitzungen“ (27.11.2026): Start, Sortierung über Gruppen, Gruppen-Etikett, Filter (gemerkt),
 * „Weitere Protokolle zeigen“, Tipp öffnet die Sitzung in ihrer Gruppe, „Neu ⌄“. Die Lader sind Attrappen – was sie
 * liefern, prüfen `lesen*.test.ts`.
 */
vi.mock('./lesen', async (orig) => ({
  ...(await orig<typeof import('./lesen')>()),
  ladeUebersicht: vi.fn(),
  ladeSitzungen: vi.fn(),
  ladeMitarbeit: vi.fn(),
}));
// Ohne Netz: die Einstellungen gleichen sonst echt mit ChurchTools ab (`ohneAbgleich`).
vi.mock('./useToDoEinstellungen', async (orig) =>
  (await import('./ohneAbgleich.testutil')).ohneAbgleich(orig),
);
vi.mock('./mitglieder', () => ({
  ladeGruppenMitglieder: vi.fn(() => Promise.resolve('verborgen')),
}));
const m = vi.mocked(L);

const ICH = { person: 1, name: 'Alwin' };
const LEITUNG: ProtokollGruppe = {
  id: 11,
  name: 'Leitungsteam',
  lage: 'eingerichtet',
  protokolle: 60,
  mitarbeit: 61,
};
const JUGEND: ProtokollGruppe = {
  id: 7,
  name: 'Jugendleitung',
  lage: 'eingerichtet',
  protokolle: 70,
  mitarbeit: 71,
};
const GRUPPEN = [LEITUNG, JUGEND];

const { stand, werte } = teileBauen(BLOCKNOTE_DOKUMENT, 'okt');
const teile = werte.map((w) => JSON.parse(w) as L.GruppenSitzungen['teile'][number]);

/** Ein freigegebenes Protokoll. */
const protokoll = (id: string, beginn: string, titel: string): Sitzung => ({
  schluessel: `p:${id}`,
  beginn,
  titel,
  termin: null,
  treffen: null,
  kopf: {
    art: 'protokoll',
    fassung: 1,
    sitzung: id,
    titel,
    status: 'frei',
    beginn,
    termin: null,
    treffen: null,
    freigabe: { von: 1, am: '2026-10-15T08:00:00Z' },
    sperre: null,
    stand,
  } satisfies ProtokollKopf,
  anfragen: [],
});
/** Ein kommender Termin. */
const termin = (id: number, beginn: string, titel: string): Sitzung => ({
  schluessel: `t:4:${id}`,
  beginn,
  titel,
  termin: { kalender: 4, id },
  treffen: null,
  kopf: null,
  anfragen: [],
});
const sitzungen = (kommend: Sitzung[], protokolle: Sitzung[]): L.GruppenSitzungen => ({
  kommend,
  protokolle,
  teile,
  kalender: 4,
  treffenNichtFreigegeben: false,
  punkte: 'vorschlagen',
});
const uebersicht = (g: ProtokollGruppe, s: L.GruppenSitzungen): L.GruppenUebersicht => ({
  gruppe: g,
  sitzungen: s,
  aufgaben: [],
  todoVorschlaege: [],
});

// Kommend weit in der Zukunft, damit „ab heute“ nicht von der Uhr abhängt.
const L_KLAUSUR = termin(1, '2099-03-20T17:00:00Z', 'Klausur Leitung');
const L_JAHR = termin(2, '2099-01-10T17:00:00Z', 'Jahresplanung');
const J_TREFF = termin(3, '2099-02-05T17:00:00Z', 'Jugendtreff');
const L_PROT = protokoll('okt', '2026-10-14T17:00:00Z', 'Leitungssitzung Oktober');
const J_PROT = protokoll('okt', '2026-09-09T17:00:00Z', 'Jugendtreff September');
const L_NOV = protokoll('nov', '2026-11-11T17:00:00Z', 'Leitungssitzung November');

function standard() {
  m.ladeUebersicht.mockResolvedValue([
    uebersicht(LEITUNG, sitzungen([L_KLAUSUR, L_JAHR], [L_NOV, L_PROT])),
    uebersicht(JUGEND, sitzungen([J_TREFF], [J_PROT])),
  ]);
}

const zeilen = (region: string) =>
  within(screen.getByRole('region', { name: region }))
    .queryAllByRole('listitem')
    .map((li) => li.querySelector('b')!.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  standard();
  m.ladeSitzungen.mockResolvedValue(sitzungen([], [L_PROT]));
  m.ladeMitarbeit.mockResolvedValue({ aufgaben: [], todoVorschlaege: [], vorschlaege: [] });
});

describe('Start des Reiters', () => {
  it('ohne Auswahl: „Alle Gruppen“ – geladen wie die Startseite, keine einzelne Gruppe', async () => {
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} />);
    expect(await screen.findByText('Klausur Leitung')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gruppe wählen: Alle Gruppen' })).toBeTruthy();
    expect(m.ladeUebersicht).toHaveBeenCalledWith(24, GRUPPEN, expect.any(String));
    expect(m.ladeSitzungen).not.toHaveBeenCalled();
  });

  it('mit Auswahl (Sprung von Startseite/Suche): direkt in dieser Gruppe, keine „Alle“-Ansicht geladen', async () => {
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} auswahl={{ gruppe: 7 }} />);
    await waitFor(() =>
      expect(m.ladeSitzungen).toHaveBeenCalledWith(24, JUGEND, expect.any(String)),
    );
    expect(screen.getByRole('button', { name: 'Gruppe wählen: Jugendleitung' })).toBeTruthy();
    expect(m.ladeUebersicht).not.toHaveBeenCalled();
  });

  it('nur EINE Gruppe: wie bisher – keine „Alle“-Ansicht, einfache Überschrift', async () => {
    render(<Sitzungen ich={ICH} modul={24} gruppen={[LEITUNG]} />);
    await waitFor(() =>
      expect(m.ladeSitzungen).toHaveBeenCalledWith(24, LEITUNG, expect.any(String)),
    );
    expect(m.ladeUebersicht).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Gruppe wählen/ })).toBeNull();
    expect(screen.queryByText('Alle Gruppen')).toBeNull();
  });

  it('die Gruppenwahl hat „Alle Gruppen“ obenan – und führt aus einer Gruppe zurück dorthin', async () => {
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} auswahl={{ gruppe: 7 }} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Gruppe wählen: Jugendleitung' }));
    const optionen = screen.getAllByRole('option').map((o) => o.textContent);
    expect(optionen).toEqual(['Alle Gruppen', 'Leitungsteam', 'Jugendleitung']);
    fireEvent.click(screen.getByRole('option', { name: 'Alle Gruppen' }));
    expect(await screen.findByText('Klausur Leitung')).toBeTruthy();
  });

  it('Fehler beim Laden: „Erneut versuchen“ statt einer leeren Liste', async () => {
    m.ladeUebersicht.mockRejectedValueOnce(new ApiError(503, 'weg'));
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByText('Klausur Leitung')).toBeTruthy();
    expect(screen.queryByText('Keine kommenden Sitzungen.')).toBeNull();
  });
});

describe('Ansicht „Alle Gruppen“', () => {
  it('Kommend: alle Gruppen gemischt, früheste zuerst; Protokolle: neueste zuerst', async () => {
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} />);
    await screen.findByText('Klausur Leitung');
    expect(zeilen('Kommend')).toEqual(['Jahresplanung', 'Jugendtreff', 'Klausur Leitung']);
    expect(zeilen('Protokolle')).toEqual([
      'Leitungssitzung November',
      'Leitungssitzung Oktober',
      'Jugendtreff September',
    ]);
  });

  it('jede Zeile trägt ihre Gruppe als Etikett – in der Einzelgruppen-Ansicht keins', async () => {
    const r = render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} />);
    await screen.findByText('Klausur Leitung');
    const kommend = within(screen.getByRole('region', { name: 'Kommend' }));
    const treff = kommend.getByText('Jugendtreff').closest('li')!;
    expect(within(treff).getByText('Jugendleitung')).toBeTruthy();
    const jahr = kommend.getByText('Jahresplanung').closest('li')!;
    expect(within(jahr).getByText('Leitungsteam')).toBeTruthy();
    r.unmount();

    m.ladeSitzungen.mockResolvedValue(sitzungen([J_TREFF], []));
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} auswahl={{ gruppe: 7 }} />);
    const zeile = (await screen.findByText('Jugendtreff')).closest('li')!;
    expect(within(zeile).queryByText('Jugendleitung')).toBeNull();
  });

  it('leere Listen: eigene Sätze', async () => {
    m.ladeUebersicht.mockResolvedValue([
      uebersicht(LEITUNG, sitzungen([], [])),
      uebersicht(JUGEND, sitzungen([], [])),
    ]);
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} />);
    expect(await screen.findByText('Keine kommenden Sitzungen.')).toBeTruthy();
    expect(screen.getByText('Noch keine freigegebenen Protokolle.')).toBeTruthy();
  });

  it('„Weitere Protokolle zeigen“: erst 8, dann alle', async () => {
    const viele = Array.from({ length: 10 }, (_, i) =>
      protokoll(
        `x${i}`,
        `2026-0${i < 9 ? i + 1 : 9}-0${i + 1 > 9 ? 9 : i + 1}T17:00:00Z`,
        `Sitzung ${i}`,
      ),
    );
    m.ladeUebersicht.mockResolvedValue([
      uebersicht(LEITUNG, sitzungen([], viele)),
      uebersicht(JUGEND, sitzungen([], [])),
    ]);
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} />);
    await screen.findByText('Weitere Protokolle zeigen');
    expect(zeilen('Protokolle')).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: 'Weitere Protokolle zeigen' }));
    expect(zeilen('Protokolle')).toHaveLength(10);
    expect(screen.queryByText('Weitere Protokolle zeigen')).toBeNull();
  });

  it('ein Tipp wechselt in die Gruppe der Zeile und öffnet die Sitzung', async () => {
    m.ladeSitzungen.mockResolvedValue(sitzungen([], [J_PROT]));
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} />);
    fireEvent.click(await screen.findByText('Jugendtreff September'));
    expect(await screen.findByText('Andacht & Gebet')).toBeTruthy();
    expect(m.ladeSitzungen).toHaveBeenCalledWith(24, JUGEND, expect.any(String));
    expect(m.ladeSitzungen).not.toHaveBeenCalledWith(24, LEITUNG, expect.any(String));
    // „Zurück“ führt in die Liste dieser Gruppe.
    fireEvent.click(screen.getByRole('button', { name: 'Sitzungen' }));
    expect(
      await screen.findByRole('button', { name: 'Gruppe wählen: Jugendleitung' }),
    ).toBeTruthy();
  });
});

describe('Filter „Gruppen“', () => {
  const filterOeffnen = async () => {
    await screen.findByText('Klausur Leitung');
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    return within(screen.getByRole('dialog', { name: 'Filter' }));
  };

  it('blendet eine Gruppe in BEIDEN Karten aus und merkt es je Person (eigenes Feld, nicht die To-Dos)', async () => {
    const r = render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} />);
    const dialog = await filterOeffnen();
    fireEvent.click(dialog.getByRole('checkbox', { name: 'Jugendleitung' }));
    expect(zeilen('Kommend')).toEqual(['Jahresplanung', 'Klausur Leitung']);
    expect(zeilen('Protokolle')).toEqual(['Leitungssitzung November', 'Leitungssitzung Oktober']);
    expect(screen.getByRole('button', { name: 'Filter, 1 ausgeblendet' })).toBeTruthy();

    const gemerkt = JSON.parse(localStorage.getItem(merkSchluessel(1))!) as {
      felder: Record<string, { w: unknown }>;
    };
    expect(gemerkt.felder.sitzungenAus.w).toEqual(['7']);
    expect(gemerkt.felder.aus).toBeUndefined();

    // Nach dem Neuöffnen gilt der Filter noch.
    r.unmount();
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} />);
    await screen.findByText('Klausur Leitung');
    expect(screen.queryByText('Jugendtreff')).toBeNull();
    expect(screen.queryByText('Jugendtreff September')).toBeNull();
  });

  it('der Filter einer anderen Person gilt nicht', async () => {
    localStorage.setItem(
      merkSchluessel(2),
      JSON.stringify({ v: 1, felder: { sitzungenAus: { w: ['7', '11'], t: 5 } } }),
    );
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} />);
    expect(await screen.findByText('Jugendtreff')).toBeTruthy();
  });

  it('blendet der Filter alle Gruppen aus, steht das da', async () => {
    localStorage.setItem(
      merkSchluessel(1),
      JSON.stringify({ v: 1, felder: { sitzungenAus: { w: ['7', '11'], t: 5 } } }),
    );
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} />);
    await waitFor(() =>
      expect(screen.getAllByText('Der Filter blendet alle Gruppen aus.')).toHaveLength(2),
    );
    expect(screen.queryByText('Keine kommenden Sitzungen.')).toBeNull();
  });

  it('in der Einzelgruppen-Ansicht gibt es keinen Filter', async () => {
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} auswahl={{ gruppe: 7 }} />);
    await screen.findByRole('region', { name: 'Kommend' });
    expect(screen.queryByRole('button', { name: /Filter/ })).toBeNull();
  });
});

describe('„Neu ⌄“ in „Alle Gruppen“', () => {
  it('bietet nur „Neues Protokoll“', async () => {
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} schreibbar={[60, 70]} />);
    await screen.findByText('Klausur Leitung');
    expect(await neuAngebot()).toEqual(['Neues Protokoll']);
  });

  it('ohne beschreibbare Gruppe: kein Neu-Knopf', async () => {
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} schreibbar={[]} />);
    await screen.findByText('Klausur Leitung');
    expect(await neuAngebot()).toEqual([]);
  });

  it('das Fenster bietet nur die beschreibbaren Gruppen an', async () => {
    render(<Sitzungen ich={ICH} modul={24} gruppen={GRUPPEN} schreibbar={[70]} />);
    await screen.findByText('Klausur Leitung');
    fireEvent.click(screen.getByRole('button', { name: 'Neu' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Neues Protokoll' }));
    const fenster = await screen.findByRole('dialog');
    expect(within(fenster).getByText(/Jugendleitung/)).toBeTruthy();
    expect(within(fenster).queryByText(/Leitungsteam/)).toBeNull();
  });
});

describe('Einstellung „sitzungenAus“', () => {
  it('Vorgabe leer; Kaputtes wird zu leer, nur Texte bleiben', () => {
    expect(VORGABE.sitzungenAus).toEqual([]);
    expect(pruefen.sitzungenAus(undefined)).toEqual([]);
    expect(pruefen.sitzungenAus('7')).toEqual([]);
    expect(pruefen.sitzungenAus({ 0: '7' })).toEqual([]);
    expect(pruefen.sitzungenAus([7, null, '11', {}])).toEqual(['11']);
    expect(pruefen.sitzungenAus(['7', '11'])).toEqual(['7', '11']);
  });

  it('ein kaputtes Feld kostet die anderen nicht', () => {
    const w = werteAus({
      v: 1,
      felder: { sitzungenAus: { w: 42, t: 1 }, ansicht: { w: 'board', t: 1 } },
    });
    expect(w.sitzungenAus).toEqual([]);
    expect(w.ansicht).toBe('board');
  });
});
