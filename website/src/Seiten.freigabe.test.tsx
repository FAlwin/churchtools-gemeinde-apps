// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { seitenStand } from '@shared/website/freigabe';
import type { EinheitStand, WebsiteStand } from '@shared/website/speicher';
import type { SeitenStatus } from '@shared/website/status';
import type { Zugang } from '@shared/website/zugang';
import { menue, seite } from '@shared/website/website.testdaten';
import * as D from './daten';
import { Seiten } from './Seiten';

vi.mock('./daten', () => ({
  ladeWebsite: vi.fn(),
  ladeOnline: vi.fn(),
  speichereSeite: vi.fn(),
  loescheSeite: vi.fn(),
  speichereMenue: vi.fn(),
  beginneBearbeiten: vi.fn(),
  beendeBearbeiten: vi.fn(),
  setzeStatus: vi.fn(),
  gebeFrei: vi.fn(),
}));
const d = vi.mocked(D);

const ORT = { modul: 7, kategorie: 20 };
const KAT = { modul: 7, entwuerfe: 20, veroeffentlicht: 21 };
const START = seite({ id: 's', titel: 'Willkommen', pfad: 'start', startseite: true });
const GRUPPEN = seite({ id: 'g', titel: 'Unsere Gruppen', pfad: 'unsere-gruppen' });
const ICH = { person: 5, name: 'Rita Redakteurin', fenster: 'f1' };
const T = '2026-11-20T10:00:00.000Z';

const online = (...ids: [string, string][]): WebsiteStand => ({
  ...stand(),
  staende: ids.map(
    ([id, st]): EinheitStand => ({ einheit: 'seite', id, stand: st, zeit: T, lesbar: true }),
  ),
});
const stand = (o: Partial<WebsiteStand> = {}): WebsiteStand => ({
  seiten: [START, GRUPPEN],
  menue: menue([]),
  einstellungen: null,
  probleme: [],
  verwaist: 0,
  sperren: {},
  einstellungenSperre: null,
  status: {},
  staende: [],
  ...o,
});
const st = (zustand: SeitenStatus['zustand'], o: Partial<SeitenStatus> = {}): SeitenStatus => ({
  zustand,
  von: 5,
  name: 'Rita Redakteurin',
  zeit: T,
  ...o,
});

const onGeaendert = vi.fn();
const zeigen = (zugang: Zugang) =>
  render(
    <Seiten
      ort={ORT}
      gemeinde="ECG"
      ich={ICH}
      rechte={{ html: zugang !== 'redakteur', menue: zugang !== 'redakteur' }}
      freigabe={{ zugang, veroeffentlicht: 21, onGeaendert }}
    />,
  );
const toolbar = () => screen.getByRole('region', { name: 'Vorschau' });

beforeEach(() => {
  vi.clearAllMocks();
  d.ladeWebsite.mockResolvedValue(stand());
  d.ladeOnline.mockResolvedValue(online());
  d.speichereSeite.mockResolvedValue(undefined);
  d.loescheSeite.mockResolvedValue(undefined);
  d.speichereMenue.mockResolvedValue(undefined);
  d.beginneBearbeiten.mockImplementation(async (_o, id) => ({
    art: 'ok',
    seite: [START, GRUPPEN].find((x) => x.id === id) ?? null,
    menue: null,
  }));
  d.beendeBearbeiten.mockResolvedValue(undefined);
  d.setzeStatus.mockImplementation(async (_k, _id, e) => st(e.zustand));
});

async function seiteWaehlen(titel: string) {
  const liste = await screen.findByRole('complementary', { name: 'Seiten' });
  fireEvent.click(within(liste).getByText(titel));
}

describe('Redakteur: Etikett und Einreichen', () => {
  it('nie online: „Entwurf“ und „Zur Prüfung einreichen“ – und das schreibt den Status „eingereicht“', async () => {
    zeigen('redakteur');
    await seiteWaehlen('Unsere Gruppen');
    expect(within(toolbar()).getByText('Entwurf')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Zur Prüfung einreichen' }));
    await waitFor(() => expect(d.setzeStatus).toHaveBeenCalledTimes(1));
    expect(d.setzeStatus).toHaveBeenCalledWith(KAT, 'g', { zustand: 'eingereicht' }, ICH);
    expect(await within(toolbar()).findByText('Eingereicht')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Zur Prüfung einreichen' })).toBeNull();
    expect(onGeaendert).toHaveBeenCalled();
  });

  it('online und unverändert: „Online“, es gibt nichts einzureichen', async () => {
    d.ladeOnline.mockResolvedValue(online(['g', seitenStand(GRUPPEN)]));
    zeigen('redakteur');
    await seiteWaehlen('Unsere Gruppen');
    expect(await within(toolbar()).findByText('Online')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Zur Prüfung einreichen' })).toBeNull();
  });

  it('online, aber seitdem geändert: „Geändert“ und Einreichen möglich', async () => {
    d.ladeOnline.mockResolvedValue(online(['g', 'ganz-anderer-stand']));
    zeigen('redakteur');
    await seiteWaehlen('Unsere Gruppen');
    expect(await within(toolbar()).findByText('Geändert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zur Prüfung einreichen' })).toBeTruthy();
  });

  it('schon eingereicht: kein zweites Einreichen – ändern darf man weiter (E-W24: „Seite einstellen“ bleibt)', async () => {
    d.ladeWebsite.mockResolvedValue(stand({ status: { g: st('eingereicht') } }));
    zeigen('redakteur');
    await seiteWaehlen('Unsere Gruppen');
    expect(within(toolbar()).getByText('Eingereicht')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Zur Prüfung einreichen' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Seite einstellen' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('nach „zurück“ steht die Anmerkung der Leitung an der Seite – und sie lässt sich erneut einreichen', async () => {
    d.ladeWebsite.mockResolvedValue(
      stand({
        status: {
          g: st('zurueck', { von: 1, name: 'Helene Wiebe', anmerkung: 'Bitte das Foto tauschen.' }),
        },
      }),
    );
    zeigen('redakteur');
    await seiteWaehlen('Unsere Gruppen');
    expect(within(toolbar()).getByText(/Bitte das Foto tauschen\./)).toBeTruthy();
    expect(within(toolbar()).getByText('Zurück')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zur Prüfung einreichen' })).toBeTruthy();
  });

  it('scheitert das Einreichen (503): es wird NICHT „Eingereicht“ gezeigt, die Meldung sagt, was nicht geschah', async () => {
    d.setzeStatus.mockRejectedValue(new ApiError(503, 'weg'));
    zeigen('redakteur');
    await seiteWaehlen('Unsere Gruppen');
    fireEvent.click(await screen.findByRole('button', { name: 'Zur Prüfung einreichen' }));
    expect(await screen.findByText(/nicht eingereicht\./)).toBeTruthy();
    expect(within(toolbar()).queryByText('Eingereicht')).toBeNull();
    expect(screen.getByRole('button', { name: 'Zur Prüfung einreichen' })).toBeTruthy();
    expect(onGeaendert).not.toHaveBeenCalled();
  });

  it('der Online-Stand lässt sich nicht lesen: nichts Falsches („Online“ / „Entwurf“) – Einreichen geht trotzdem', async () => {
    d.ladeOnline.mockRejectedValue(new ApiError(503, 'weg'));
    zeigen('redakteur');
    await seiteWaehlen('Unsere Gruppen');
    expect(await screen.findByRole('button', { name: 'Zur Prüfung einreichen' })).toBeTruthy();
    expect(within(toolbar()).queryByText('Online')).toBeNull();
    expect(within(toolbar()).queryByText('Entwurf')).toBeNull();
  });
});

describe('Redakteur: Löschen anfragen statt Löschen (E-W23)', () => {
  async function einstellenOeffnen() {
    zeigen('redakteur');
    await seiteWaehlen('Unsere Gruppen');
    fireEvent.click(await screen.findByRole('button', { name: 'Seite einstellen' }));
  }

  it('im Fenster steht „Löschen anfragen“, es gibt kein „Seite löschen“', async () => {
    await einstellenOeffnen();
    expect(await screen.findByRole('button', { name: 'Löschen anfragen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Seite löschen' })).toBeNull();
  });

  it('nach der Rückfrage ist „Löschen angefragt“ gesetzt; die Seite wird weder gelöscht noch das Menü verändert', async () => {
    await einstellenOeffnen();
    fireEvent.click(await screen.findByRole('button', { name: 'Löschen anfragen' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/bleibt die Seite unverändert/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Löschen anfragen' }));
    await waitFor(() =>
      expect(d.setzeStatus).toHaveBeenCalledWith(KAT, 'g', { zustand: 'loeschenAngefragt' }, ICH),
    );
    expect(d.loescheSeite).not.toHaveBeenCalled();
    expect(d.speichereMenue).not.toHaveBeenCalled();
    expect(await within(toolbar()).findByText('Löschen angefragt')).toBeTruthy();
  });

  it('Abbrechen fragt nichts an', async () => {
    await einstellenOeffnen();
    fireEvent.click(await screen.findByRole('button', { name: 'Löschen anfragen' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Abbrechen' }),
    );
    expect(d.setzeStatus).not.toHaveBeenCalled();
  });

  it('ist es schon angefragt, ist der Knopf aus', async () => {
    d.ladeWebsite.mockResolvedValue(stand({ status: { g: st('loeschenAngefragt') } }));
    await einstellenOeffnen();
    const knopf = await screen.findByRole('button', {
      name: 'Löschen angefragt',
    });
    expect(knopf).toHaveProperty('disabled', true);
  });
});

describe('Leitung: direkt veröffentlichen, selbst löschen', () => {
  async function veroeffentlichenKlicken() {
    fireEvent.click(await screen.findByRole('button', { name: 'Mehr' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Veröffentlichen' }));
  }

  it('keine „Zur Prüfung einreichen“, aber „Veröffentlichen“ im Mehr-Menü – es gibt die Seite frei und nimmt den Status weg', async () => {
    d.ladeWebsite.mockResolvedValue(stand({ status: { g: st('eingereicht') } }));
    d.gebeFrei.mockResolvedValue({ stand: 'x', statusEntfernt: true });
    zeigen('leitung');
    await seiteWaehlen('Unsere Gruppen');
    expect(screen.queryByRole('button', { name: 'Zur Prüfung einreichen' })).toBeNull();
    await veroeffentlichenKlicken();
    await waitFor(() =>
      expect(d.gebeFrei).toHaveBeenCalledWith(KAT, { einheit: 'seite', id: 'g' }),
    );
    await waitFor(() => expect(within(toolbar()).queryByText('Eingereicht')).toBeNull());
    expect(d.ladeOnline).toHaveBeenCalledTimes(2); // danach neu gelesen
    expect(onGeaendert).toHaveBeenCalled();
  });

  it('online und unverändert: nichts zu veröffentlichen (kein Mehr-Menü)', async () => {
    d.ladeOnline.mockResolvedValue(online(['g', seitenStand(GRUPPEN)]));
    zeigen('leitung');
    await seiteWaehlen('Unsere Gruppen');
    await within(toolbar()).findByText('Online');
    expect(screen.queryByRole('button', { name: 'Mehr' })).toBeNull();
  });

  it('scheitert das Veröffentlichen, steht das da – nichts gilt als online, der Status bleibt', async () => {
    d.ladeWebsite.mockResolvedValue(stand({ status: { g: st('eingereicht') } }));
    d.gebeFrei.mockRejectedValue(new ApiError(403, 'Dafür fehlt dir das Recht: nur die Leitung.'));
    zeigen('admin');
    await seiteWaehlen('Unsere Gruppen');
    await veroeffentlichenKlicken();
    expect(await screen.findByText(/nicht veröffentlicht/)).toBeTruthy();
    expect(screen.getByText(/Dafür fehlt dir das Recht/)).toBeTruthy();
    expect(within(toolbar()).getByText('Eingereicht')).toBeTruthy();
    expect(within(toolbar()).queryByText('Online')).toBeNull();
  });

  it('ist die Seite online, der Status aber blieb (Aufräumen gescheitert), steht das als Hinweis – nicht verschwiegen', async () => {
    d.gebeFrei.mockResolvedValue({ stand: 'x', statusEntfernt: false, grund: 'fehler' });
    zeigen('leitung');
    await seiteWaehlen('Unsere Gruppen');
    await veroeffentlichenKlicken();
    expect(await screen.findByText(/Status ließ sich aber gerade nicht zurücksetzen/)).toBeTruthy();
  });

  it('löscht selbst: „Seite löschen“ bleibt – und eine online stehende Seite wird im Fenster erwähnt', async () => {
    d.ladeOnline.mockResolvedValue(online(['g', seitenStand(GRUPPEN)]));
    zeigen('leitung');
    await seiteWaehlen('Unsere Gruppen');
    await within(toolbar()).findByText('Online');
    fireEvent.click(screen.getByRole('button', { name: 'Seite einstellen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Seite löschen' }));
    expect(
      within(await screen.findByRole('alertdialog')).getByText(/unter „Freigaben“ offline nimmst/),
    ).toBeTruthy();
  });
});

describe('Etikett in der Liste', () => {
  it('Seiten mit Status tragen ihr Etikett in der Liste, andere nicht', async () => {
    d.ladeWebsite.mockResolvedValue(stand({ status: { g: st('eingereicht') } }));
    zeigen('leitung');
    const liste = await screen.findByRole('complementary', { name: 'Seiten' });
    expect(within(liste).getByText('Eingereicht')).toBeTruthy();
    expect(within(liste).getAllByText(/Eingereicht|Zurück|Löschen angefragt/)).toHaveLength(1);
  });
});
