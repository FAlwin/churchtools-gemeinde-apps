// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { alsGeloescht, neueAufgabe, type Aufgabe } from '@shared/protokolle/aufgaben';
import { geplanterKopf } from '@shared/protokolle/planen';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { ApiError } from '@ui/ct/fehler';
import * as B from './bearbeiten';
import * as L from './loeschen';
import { ProtokollLoeschen } from './ProtokollLoeschen';
import { SitzungAnsicht } from './SitzungAnsicht';

/** Fenster „Protokoll löschen?“ (W6) – Lesen und Löschen sind Attrappen; was sie tun, prüfen `loeschen.test.ts` und `loeschenListe.test.ts`. */
vi.mock('./bearbeiten', async (orig) => ({
  ...(await orig<typeof import('./bearbeiten')>()),
  terminStand: vi.fn(),
}));
vi.mock('./loeschen', async (orig) => ({
  ...(await orig<typeof import('./loeschen')>()),
  protokollLoeschen: vi.fn(),
}));

afterEach(cleanup);

const ZONE = 'Europe/Berlin';
const BEGINN = '2027-05-26T17:30:00Z';
const stand = vi.mocked(B.terminStand);
const loeschen = vi.mocked(L.protokollLoeschen);

const sitzung = (teil: Partial<Sitzung> = {}, status: 'entwurf' | 'frei' = 'entwurf'): Sitzung => ({
  schluessel: 'p:s1',
  beginn: BEGINN,
  titel: 'Leitungssitzung',
  termin: null,
  treffen: null,
  kopf: {
    ...geplanterKopf(
      { titel: 'Leitungssitzung', beginn: BEGINN, termin: null, treffen: null },
      's1',
    ),
    status,
  },
  anfragen: [],
  ...teil,
});
const MIT_TERMIN = { termin: { kalender: 4, id: 70 }, treffen: 80 };

const todo = (id: string, s: string | null = 's1'): Aufgabe =>
  neueAufgabe({ id, gruppe: 194, sitzung: s, text: id, von: 7, am: '2026-11-10T10:00:00Z' });

const GRUPPE = { id: 194, protokolle: 62, mitarbeit: 63 };
const zeige = (
  s: Sitzung = sitzung(),
  extra: Partial<Parameters<typeof ProtokollLoeschen>[0]> = {},
) => {
  const q = { onFertig: vi.fn(), onClose: vi.fn() };
  render(
    <ProtokollLoeschen
      sitzung={s}
      gruppe={GRUPPE}
      modul={24}
      ich={{ person: 1, name: 'Alwin Friesen' }}
      zeitzone={ZONE}
      aufgaben={[]}
      {...q}
      {...extra}
    />,
  );
  return q;
};
const loeschenKnopf = () => screen.getByRole('button', { name: /^(Löschen|Nochmal versuchen)$/ });
const plan = () => loeschen.mock.calls.at(-1)![0];

beforeEach(() => {
  vi.clearAllMocks();
  stand.mockResolvedValue({
    roh: { repeatId: 0, signup: null, title: 'Leitungssitzung', startDate: BEGINN },
    eingeladen: [1, 19, 7, 23],
    termine: [],
  });
  loeschen.mockResolvedValue({ art: 'ok' });
});

describe('ProtokollLoeschen – was die Rückfrage zeigt', () => {
  it('nur das Protokoll: Titel · Datum · Status, der Satz „nicht rückgängig“ – sonst nichts', () => {
    zeige();
    expect(screen.getByRole('dialog', { name: 'Protokoll löschen?' })).toBeTruthy();
    expect(screen.getByText('Leitungssitzung · 26.05.2027 · Entwurf')).toBeTruthy();
    expect(screen.getByText('Das lässt sich nicht rückgängig machen.')).toBeTruthy();
    expect(screen.queryByText(/To-Dos aus diesem Protokoll/)).toBeNull();
    expect(screen.queryByText('In ChurchTools außerdem löschen')).toBeNull();
  });

  it('freigegeben heißt im Status „freigegeben“', () => {
    zeige(sitzung({}, 'frei'));
    expect(screen.getByText('Leitungssitzung · 26.05.2027 · freigegeben')).toBeTruthy();
  });

  it('To-Dos: Überschrift mit Zahl; „Mitlöschen“ ist vorgewählt, „Behalten“ nicht; gelöschte und fremde zählen nicht', () => {
    zeige(sitzung(), {
      aufgaben: [
        todo('a'),
        todo('b'),
        todo('c', 's2'),
        todo('d', null),
        alsGeloescht(todo('e'), 1, '2026-11-11T10:00:00Z'),
      ],
    });
    expect(screen.getByText('To-Dos aus diesem Protokoll (2)')).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('radio', { name: /^Mitlöschen/ }).checked).toBe(true);
    expect(screen.getByText('im Verlauf vermerkt')).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('radio', { name: /^Behalten/ }).checked).toBe(false);
  });

  it('ohne Mitarbeit-Kategorie: keine To-Do-Frage', () => {
    zeige(sitzung(), { aufgaben: [todo('a')], gruppe: { ...GRUPPE, mitarbeit: null } });
    expect(screen.queryByText(/To-Dos aus diesem Protokoll/)).toBeNull();
  });

  it('Termin und Gruppentreffen: Häkchen, anfangs aus; die Zahl derer, die die Mail bekommen (ohne mich)', async () => {
    zeige(sitzung(MIT_TERMIN));
    const termin = await screen.findByRole('checkbox', { name: /Termin „Leitungssitzung“/ });
    expect((termin as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText('3 Eingeladene bekommen die Mail „Termin gelöscht“.')).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: /Gruppentreffen/ }).checked).toBe(
      false,
    );
    expect(screen.getByText('In ChurchTools außerdem löschen')).toBeTruthy();
  });

  it('Gruppentreffen: ein abgeschlossenes sagt, dass die Anwesenheit verloren geht – ein offenes nicht', () => {
    zeige(sitzung({ treffen: 80, abgeschlossen: true }));
    expect(screen.getByText('Abgeschlossen – die Anwesenheit geht mit verloren.')).toBeTruthy();
    cleanup();
    zeige(sitzung({ treffen: 80 }));
    expect(screen.getByRole('checkbox', { name: /Gruppentreffen/ })).toBeTruthy();
    expect(screen.queryByText(/Anwesenheit geht mit verloren/)).toBeNull();
  });

  it('Treffen aus dem Kopf zählt auch (Kopf vor Liste)', () => {
    const s = sitzung();
    zeige({ ...s, kopf: { ...s.kopf!, treffen: 81 } });
    expect(screen.getByRole('checkbox', { name: /Gruppentreffen/ })).toBeTruthy();
  });

  it('Serie: der Zusatz sagt „nur diese Sitzung, ohne Mail“', async () => {
    stand.mockResolvedValue({
      roh: { repeatId: 7, signup: null, title: 'Leitungssitzung', startDate: BEGINN },
      eingeladen: [1, 19],
      termine: [],
    });
    zeige(sitzung(MIT_TERMIN));
    expect(await screen.findByText(/Nur diese Sitzung fällt aus der Serie/)).toBeTruthy();
  });

  it('Termin mit Anmeldung: Häkchen gesperrt, mit Grund', async () => {
    stand.mockResolvedValue({
      roh: { repeatId: 0, signup: {}, title: 'Leitungssitzung', startDate: BEGINN },
      eingeladen: [1],
      termine: [],
    });
    zeige(sitzung(MIT_TERMIN));
    const haken = await screen.findByRole('checkbox', { name: /Termin „Leitungssitzung“/ });
    expect((haken as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/hängt eine Anmeldung/)).toBeTruthy();
  });

  it('Termin schon weg (404): kein Häkchen dafür – das Gruppentreffen bleibt wählbar', async () => {
    stand.mockRejectedValue(new ApiError(404, 'weg'));
    zeige(sitzung(MIT_TERMIN));
    await waitFor(() => expect(stand).toHaveBeenCalled());
    await screen.findByRole('checkbox', { name: /Gruppentreffen/ });
    expect(screen.queryByRole('checkbox', { name: /Termin „/ })).toBeNull();
    expect(screen.queryByText(/ließ sich gerade nicht lesen/)).toBeNull();
  });

  it('Termin nicht lesbar (Fehler): kein Häkchen, ein Hinweis, dass er bleibt', async () => {
    stand.mockRejectedValue(new ApiError(502, 'Gateway'));
    zeige(sitzung(MIT_TERMIN));
    expect(await screen.findByText(/Der Termin ließ sich gerade nicht lesen/)).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /Termin „/ })).toBeNull();
  });
});

describe('ProtokollLoeschen – Löschen', () => {
  it('ohne Auswahl: nur das Protokoll – To-Dos bleiben, Termin und Treffen unberührt', async () => {
    const { onFertig } = zeige(sitzung(MIT_TERMIN), { aufgaben: [] });
    await screen.findByRole('checkbox', { name: /Termin „/ });
    fireEvent.click(loeschenKnopf());
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(plan()).toMatchObject({
      ort: { modul: 24, kategorie: 62, sitzung: 's1' },
      gruppe: 194,
      todos: false,
      termin: null,
      treffen: null,
    });
  });

  it('To-Dos „Mitlöschen“ (vorgewählt) → todos: true; „Behalten“ → todos: false', async () => {
    const { onFertig } = zeige(sitzung(), { aufgaben: [todo('a')] });
    fireEvent.click(loeschenKnopf());
    await waitFor(() => expect(onFertig).toHaveBeenCalledTimes(1));
    expect(plan().todos).toBe(true);
    cleanup();
    zeige(sitzung(), { aufgaben: [todo('a')], onFertig: vi.fn() });
    fireEvent.click(screen.getByRole('radio', { name: /^Behalten/ }));
    fireEvent.click(loeschenKnopf());
    await waitFor(() => expect(loeschen).toHaveBeenCalledTimes(2));
    expect(plan().todos).toBe(false);
  });

  it('Termin angehakt: der Termin geht mit (Einzeltermin ohne „art“); Treffen angehakt: dessen ID', async () => {
    zeige(sitzung(MIT_TERMIN));
    fireEvent.click(await screen.findByRole('checkbox', { name: /Termin „/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Gruppentreffen/ }));
    fireEvent.click(loeschenKnopf());
    await waitFor(() => expect(loeschen).toHaveBeenCalled());
    expect(plan().termin).toEqual({
      termin: { kalender: 4, id: 70 },
      beginn: BEGINN,
      zeitzone: ZONE,
    });
    expect(plan().treffen).toBe(80);
  });

  it('bei einer Serie nur diese Sitzung („diese“) – nie die ganze Serie', async () => {
    stand.mockResolvedValue({
      roh: { repeatId: 7, signup: null, title: 'Leitungssitzung', startDate: BEGINN },
      eingeladen: [1, 19],
      termine: [],
    });
    zeige(sitzung(MIT_TERMIN));
    fireEvent.click(await screen.findByRole('checkbox', { name: /Termin „/ }));
    fireEvent.click(loeschenKnopf());
    await waitFor(() => expect(loeschen).toHaveBeenCalled());
    expect(plan().termin).toMatchObject({ art: 'diese' });
  });

  it('gelöscht → das Fenster meldet „fertig“ (der Aufrufer geht zur Liste)', async () => {
    const { onFertig, onClose } = zeige();
    fireEvent.click(loeschenKnopf());
    await waitFor(() => expect(onFertig).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ein Schritt scheitert: Fenster bleibt offen mit der Meldung, der Knopf heißt „Nochmal versuchen“', async () => {
    loeschen.mockRejectedValueOnce(
      new ApiError(409, 'Schon erledigt: To-Dos als gelöscht vermerkt. Noch offen: der Termin.'),
    );
    const { onFertig } = zeige();
    fireEvent.click(loeschenKnopf());
    expect((await screen.findByRole('alert')).textContent).toContain('Schon erledigt: To-Dos');
    expect(onFertig).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Nochmal versuchen' }));
    await waitFor(() => expect(onFertig).toHaveBeenCalledTimes(1));
    expect(loeschen).toHaveBeenCalledTimes(2);
  });

  it('jemand schreibt: Meldung mit Namen, nichts gelöscht, Fenster bleibt', async () => {
    loeschen.mockResolvedValueOnce({
      art: 'gesperrt',
      sperre: { von: 19, name: 'Peter', seit: BEGINN },
      erledigt: [],
    });
    const { onFertig } = zeige();
    fireEvent.click(loeschenKnopf());
    expect((await screen.findByRole('alert')).textContent).toContain('Peter schreibt gerade');
    expect(onFertig).not.toHaveBeenCalled();
  });

  it('„vorher“ läuft vor dem Löschen; Abbrechen meldet „abgebrochen“ und schließt', async () => {
    const reihenfolge: string[] = [];
    const vorher = vi.fn(() => {
      reihenfolge.push('vorher');
      return Promise.resolve();
    });
    loeschen.mockImplementation(() => {
      reihenfolge.push('loeschen');
      return Promise.resolve({ art: 'ok' as const });
    });
    const { onFertig } = zeige(sitzung(), { vorher });
    fireEvent.click(loeschenKnopf());
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(reihenfolge).toEqual(['vorher', 'loeschen']);
    cleanup();

    const onAbbrechen = vi.fn();
    const { onClose } = zeige(sitzung(), { onAbbrechen });
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onAbbrechen).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Knopf „Löschen“ in der Sitzungsansicht', () => {
  const ansicht = (s: Sitzung, onLoeschen?: () => void) =>
    render(
      <SitzungAnsicht
        sitzung={s}
        gruppe="Technik"
        gruppeId={194}
        protokolle={[]}
        teile={[]}
        aufgaben={[]}
        zeitzone={ZONE}
        onLoeschen={onLoeschen}
        onZurueck={() => undefined}
      />,
    );

  it('für die Leitung (onLoeschen) bei Entwurf und freigegeben – er öffnet die Rückfrage', () => {
    const auf = vi.fn();
    ansicht(sitzung(), auf);
    fireEvent.click(screen.getByRole('button', { name: 'Protokoll löschen' }));
    expect(auf).toHaveBeenCalledTimes(1);
    cleanup();
    ansicht(sitzung({}, 'frei'), vi.fn());
    expect(screen.getByRole('button', { name: 'Protokoll löschen' })).toBeTruthy();
  });

  it('ohne onLoeschen (nicht die Leitung) gibt es ihn nicht', () => {
    ansicht(sitzung());
    expect(screen.queryByRole('button', { name: 'Protokoll löschen' })).toBeNull();
  });

  it('ohne Protokoll (kein Kopf) und bei einem bloß geplanten gibt es ihn nicht', () => {
    ansicht(sitzung({ kopf: null }), vi.fn());
    expect(screen.queryByRole('button', { name: 'Protokoll löschen' })).toBeNull();
    cleanup();
    const geplant = sitzung();
    ansicht({ ...geplant, kopf: { ...geplant.kopf!, status: 'geplant' } }, vi.fn());
    expect(screen.queryByRole('button', { name: 'Protokoll löschen' })).toBeNull();
  });
});
