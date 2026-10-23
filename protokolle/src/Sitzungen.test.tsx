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

vi.mock('./lesen', async (orig) => ({
  ...(await orig<typeof import('./lesen')>()),
  ladeSitzungen: vi.fn(),
  ladeAufgaben: vi.fn(),
}));
const m = vi.mocked(L);

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
};

beforeEach(() => {
  vi.clearAllMocks();
  m.ladeSitzungen.mockResolvedValue(DATEN);
  m.ladeAufgaben.mockResolvedValue([]);
});

describe('Reiter „Sitzungen“ (S3-2)', () => {
  it('zeigt Kommend und Protokolle der ersten Gruppe', async () => {
    render(<Sitzungen modul={24} gruppen={GRUPPEN} />);
    const kommend = await screen.findByRole('region', { name: 'Kommend' });
    expect(within(kommend).getByText('Klausur')).toBeTruthy();
    const protokolle = screen.getByRole('region', { name: 'Protokolle' });
    expect(within(protokolle).getByText(/freigegeben am 15\.10\.2026/)).toBeTruthy();
    expect(m.ladeSitzungen).toHaveBeenCalledWith(24, GRUPPEN[0], expect.any(String));
  });

  it('Gruppe wechseln lädt deren Sitzungen', async () => {
    render(<Sitzungen modul={24} gruppen={GRUPPEN} />);
    await screen.findByText('Klausur');
    fireEvent.click(screen.getByRole('button', { name: 'Jugendleitung' }));
    await waitFor(() =>
      expect(m.ladeSitzungen).toHaveBeenLastCalledWith(24, GRUPPEN[1], expect.any(String)),
    );
  });

  it('Hinweise: kein Kalender gewählt, Gruppentreffen nicht freigegeben', async () => {
    m.ladeSitzungen.mockResolvedValue({ ...DATEN, kalender: null, treffenNichtFreigegeben: true });
    render(<Sitzungen modul={24} gruppen={GRUPPEN} />);
    expect(await screen.findByText(/noch kein Kalender gewählt/)).toBeTruthy();
    expect(screen.getByText(/Gruppentreffen dieser Gruppe sind für dich/)).toBeTruthy();
  });

  it('vorübergehender Fehler: „Erneut versuchen“ – keine leere Liste', async () => {
    m.ladeSitzungen.mockRejectedValueOnce(new ApiError(503, 'weg'));
    render(<Sitzungen modul={24} gruppen={GRUPPEN} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByText('Klausur')).toBeTruthy();
    expect(screen.queryByText('Keine kommenden Sitzungen.')).toBeNull();
  });

  it('Protokoll öffnen: das Dokument aus den Teilen, Bereiche, zurück zur Liste', async () => {
    render(<Sitzungen modul={24} gruppen={GRUPPEN} />);
    fireEvent.click(await screen.findByText(/freigegeben am 15\.10\.2026/));
    expect(await screen.findByText('Andacht & Gebet')).toBeTruthy();
    expect(screen.getByRole('region', { name: /To-Dos/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sitzungen' }));
    expect(await screen.findByRole('region', { name: 'Kommend' })).toBeTruthy();
  });

  it('Sitzung ohne Protokoll: sagt das', async () => {
    render(<Sitzungen modul={24} gruppen={GRUPPEN} />);
    fireEvent.click(await screen.findByText('Klausur'));
    expect(await screen.findByText(/gibt es noch kein Protokoll/)).toBeTruthy();
  });

  it('Teile fehlen (gerade gespeichert): Hinweis statt halbem Dokument', async () => {
    m.ladeSitzungen.mockResolvedValue({ ...DATEN, teile: DATEN.teile.slice(0, 0) });
    render(<Sitzungen modul={24} gruppen={GRUPPEN} />);
    fireEvent.click(await screen.findByText(/freigegeben am 15\.10\.2026/));
    expect(await screen.findByText(/nicht vollständig lesbar/)).toBeTruthy();
    expect(screen.queryByText('Andacht & Gebet')).toBeNull();
  });

  it('S3-3: Auswahl von der Startseite – diese Gruppe, die Sitzung gleich offen', async () => {
    render(<Sitzungen modul={24} gruppen={GRUPPEN} auswahl={{ gruppe: 7, sitzung: 'p:okt' }} />);
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
    render(<Sitzungen modul={24} gruppen={GRUPPEN} auswahl={{ gruppe: 7 }} />);
    expect(await screen.findByRole('region', { name: 'Kommend' })).toBeTruthy();
    expect(m.ladeSitzungen).toHaveBeenCalledWith(24, GRUPPEN[1], expect.any(String));
  });

  it('keine Gruppe: ein Satz, kein Laden', () => {
    render(<Sitzungen modul={24} gruppen={[]} />);
    expect(screen.getByText(/keiner Gruppe/)).toBeTruthy();
    expect(m.ladeSitzungen).not.toHaveBeenCalled();
  });
});
