// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vorlagenStandAus } from '@shared/ct/ablaufVorlagenListe';
import type { CtAblaufVorlage } from '@shared/ct/typen';
import type { UserCapabilities } from '@shared/types/index';
import { markTourDone } from '../utils/onboarding';

/**
 * Die Seite „Ablaufvorlagen“ in der Musik-App (E10-V3b): Der Baustein ist der aus `ui` (dort ausführlich getestet) –
 * hier geprüft, was die Musik-App dazugibt: Rechte aus den Capabilities (kein „Neue Vorlage“, „nur ansehen“, kein
 * „Bearbeiten“), der Weg „‹ Termine“ und dass gelesen wird, was die Weiche liefert.
 */
const api = vi.hoisted(() => ({
  getVorlagenStand: vi.fn(),
  getVorlage: vi.fn(),
  getAgendaServices: vi.fn(),
  vorlageAnlegen: vi.fn(),
  vorlageUmbenennen: vi.fn(),
  vorlageLoeschen: vi.fn(),
  reorderAgenda: vi.fn(),
  createAgendaItem: vi.fn(),
  updateAgendaItem: vi.fn(),
  setAgendaItemVorBeginn: vi.fn(),
  deleteAgendaItem: vi.fn(),
  restoreAgendaItem: vi.fn(),
}));
vi.mock('../services/churchtoolsApi', () => api);

const { Vorlagen } = await import('./Vorlagen');

const KALENDER = [
  { id: 1, name: 'Gottesdienst' },
  { id: 2, name: 'Jugend' },
];
const ROH: CtAblaufVorlage[] = [
  {
    id: 5,
    name: 'Gottesdienst',
    calendarId: 1,
    eventStartPosition: 0,
    items: [{ id: 50, position: 0, title: 'Begrüßung', type: 'normal', duration: 300 }],
    meta: { modifiedDate: '2026-11-12T10:00:00Z' },
  },
  { id: 6, name: 'Jugendabend', calendarId: 2, eventStartPosition: 0, items: [] },
];

const caps = (over: Partial<UserCapabilities> = {}): UserCapabilities =>
  ({
    isAdmin: false,
    canViewAgendas: true,
    vorlagenKalender: [1],
    ...over,
  }) as UserCapabilities;

function zeige(c: UserCapabilities, offeneId: number | null = null) {
  const onOeffnen = vi.fn();
  const zurueck = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Vorlagen caps={c} offeneId={offeneId} onOeffnen={onOeffnen} zurueck={zurueck} />
    </QueryClientProvider>,
  );
  return { onOeffnen, zurueck };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // Die Einführung ist nicht Gegenstand dieser Tests (sie hat eigene) – sie würde nur den Bildschirm abdunkeln.
  markTourDone('vorlagen-v1');
  markTourDone('vorlage-v1');
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  api.getVorlagenStand.mockImplementation(() =>
    Promise.resolve(vorlagenStandAus(ROH, KALENDER, 'Europe/Berlin')),
  );
  api.getVorlage.mockImplementation((id: number) => Promise.resolve(ROH.find((v) => v.id === id)));
  api.getAgendaServices.mockResolvedValue([{ id: 1, name: 'Musik' }]);
});
afterEach(() => vi.unstubAllGlobals());

describe('Liste', () => {
  it('zeigt die Vorlagen nach Kalender und führt mit „‹ Termine“ zurück', async () => {
    const { zurueck } = zeige(caps());
    expect(await screen.findByText('Jugendabend')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Ablaufvorlagen' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Termine/ }));
    expect(zurueck).toHaveBeenCalledTimes(1);
  });

  it('eine Vorlage antippen meldet ihre ID', async () => {
    const { onOeffnen } = zeige(caps());
    fireEvent.click(await screen.findByText('Jugendabend'));
    expect(onOeffnen).toHaveBeenCalledWith(6);
  });

  it('mit Recht für einen Kalender: „Neue Vorlage“ – und „nur ansehen“ beim anderen', async () => {
    zeige(caps({ vorlagenKalender: [1] }));
    await screen.findByText('Jugendabend');
    expect(screen.getByRole('button', { name: /Neue Vorlage/ })).toBeTruthy();
    expect(screen.getAllByText(/nur ansehen/)).toHaveLength(1);
  });

  it('ohne Recht: kein „Neue Vorlage“, überall „nur ansehen“', async () => {
    zeige(caps({ vorlagenKalender: [] }));
    await screen.findByText('Jugendabend');
    expect(screen.queryByRole('button', { name: /Neue Vorlage/ })).toBeNull();
    expect(screen.getAllByText(/nur ansehen/)).toHaveLength(2);
  });

  it('Admin darf überall; `null` heißt „alle Kalender“', async () => {
    zeige(caps({ vorlagenKalender: null }));
    await screen.findByText('Jugendabend');
    expect(screen.getByRole('button', { name: /Neue Vorlage/ })).toBeTruthy();
    expect(screen.queryByText(/nur ansehen/)).toBeNull();
  });

  it('ältere Server ohne `vorlagenKalender`: kein Knopf (anders als `null`)', async () => {
    zeige(caps({ vorlagenKalender: undefined }));
    await screen.findByText('Jugendabend');
    expect(screen.queryByRole('button', { name: /Neue Vorlage/ })).toBeNull();
  });
});

describe('Eine offene Vorlage', () => {
  it('liest sie über die Weiche und zeigt ihren Ablauf; „Bearbeiten“ nur im Kalender mit Recht', async () => {
    zeige(caps({ vorlagenKalender: [1] }), 5);
    expect(await screen.findByText('Begrüßung')).toBeTruthy();
    expect(api.getVorlage).toHaveBeenCalledWith(5);
    expect(await screen.findByText(/Kalender Gottesdienst/)).toBeTruthy();
    expect(await screen.findByRole('button', { name: /Bearbeiten/i })).toBeTruthy();
  });

  it('in einem Kalender ohne Recht: nur ansehen, kein „Bearbeiten“', async () => {
    zeige(caps({ vorlagenKalender: [2] }), 5);
    expect(await screen.findByText('Begrüßung')).toBeTruthy();
    // Erst prüfen, wenn die Ansicht fertig ist (Kalendername aus der Liste da) – sonst fehlte der Knopf nur, weil noch geladen wird.
    expect(await screen.findByText(/Kalender Gottesdienst/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Bearbeiten/ })).toBeNull();
  });

  it('Infos je Gruppe: die Gruppen aus den Capabilities kommen an (Knopf „Infos je Gruppe zeigen“), ohne Gruppen kein Knopf', async () => {
    // Gegenprobe-Lücke vom 17.11.2026: Fehlte `infoGruppen` an der Seite, blieb jeder Test grün – die Infos je
    // Dienstgruppe einer Vorlage wären in der Musik-App weder zu sehen noch zu ändern gewesen.
    zeige(caps({ infoGruppen: [{ id: 3, name: 'Technik' }] }), 5);
    expect(await screen.findByText('Begrüßung')).toBeTruthy();
    expect(await screen.findByTitle('Infos je Gruppe zeigen')).toBeTruthy();
  });

  it('ohne Gruppen in den Capabilities kein Knopf „Infos je Gruppe zeigen“', async () => {
    zeige(caps({ infoGruppen: [] }), 5);
    expect(await screen.findByText(/Kalender Gottesdienst/)).toBeTruthy();
    expect(screen.queryByTitle('Infos je Gruppe zeigen')).toBeNull();
  });

  it('sieht man nicht alle Dienstgruppen, steht im Bearbeiten-Modus der Hinweis wie am Termin', async () => {
    zeige(caps({ vorlagenKalender: [1], siehtAlleDienstgruppen: false }), 5);
    fireEvent.click(await screen.findByRole('button', { name: /Bearbeiten/i }));
    expect(await screen.findByText(/Du siehst nicht alle Dienstgruppen/)).toBeTruthy();
  });

  it('sieht man alle, steht der Hinweis nicht da', async () => {
    zeige(caps({ vorlagenKalender: [1], siehtAlleDienstgruppen: true }), 5);
    fireEvent.click(await screen.findByRole('button', { name: /Bearbeiten/i }));
    await screen.findByText(/Fertig/);
    expect(screen.queryByText(/Du siehst nicht alle Dienstgruppen/)).toBeNull();
  });

  it('„‹ Vorlagen“ führt zurück zur Liste (nicht aus den Terminen heraus)', async () => {
    const { onOeffnen, zurueck } = zeige(caps(), 5);
    await screen.findByText('Begrüßung');
    fireEvent.click(screen.getByRole('button', { name: /Vorlagen/ }));
    await waitFor(() => expect(onOeffnen).toHaveBeenCalledWith(null));
    expect(zurueck).not.toHaveBeenCalled();
  });
});
