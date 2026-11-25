// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { seitenStand } from '@shared/website/freigabe';
import type { EinheitStand, WebsiteStand } from '@shared/website/speicher';
import type { SeitenStatus } from '@shared/website/status';
import type { OnlineKategorie } from '@shared/website/freigabe';
import { WEBSITE_LEITUNG, WEBSITE_REDAKTEUR, type Zugang } from '@shared/website/zugang';
import { menue, seite } from '@shared/website/website.testdaten';
import * as D from './daten';
import * as M from './mailVersand';
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
vi.mock('./mailVersand', () => ({
  mailAnLeitung: vi.fn(),
  mailZurueck: vi.fn(),
  mailFreigaben: vi.fn(),
}));
const d = vi.mocked(D);
const m = vi.mocked(M);

const ORT = { modul: 7, kategorie: 20 };
const KAT = { modul: 7, entwuerfe: 20, veroeffentlicht: 21, untergruppen: [] };
const START = seite({ id: 's', titel: 'Willkommen', pfad: 'start', startseite: true });
const GRUPPEN = seite({ id: 'g', titel: 'Unsere Gruppen', pfad: 'unsere-gruppen' });
const GRUPPE = 344;
const ICH = { person: 5, name: 'Rita Redakteurin', fenster: 'f1' };
const T = '2026-11-20T10:00:00.000Z';

/** Der Online-Stand, wie `ladeOnline` ihn liefert (W3b-4b: je Kategorie) – hier nur die der Website (21). */
const online = (...ids: [string, string][]): OnlineKategorie[] => [
  { bereich: null, kategorie: 21, stand: onlineStand(...ids) },
];
const onlineStand = (...ids: [string, string][]): WebsiteStand => ({
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
      rechte={{ html: zugang !== WEBSITE_REDAKTEUR, menue: zugang !== WEBSITE_REDAKTEUR }}
      freigabe={{ zugang, veroeffentlicht: 21, gruppe: GRUPPE, onGeaendert }}
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
  m.mailAnLeitung.mockResolvedValue({ art: 'aus' });
  m.mailFreigaben.mockResolvedValue({ art: 'aus' });
});

async function seiteWaehlen(titel: string) {
  const liste = await screen.findByRole('complementary', { name: 'Seiten' });
  fireEvent.click(within(liste).getByText(titel));
}

describe('Redakteur: Etikett und Einreichen', () => {
  it('nie online: „Entwurf“ und „Zur Prüfung einreichen“ – und das schreibt den Status „eingereicht“', async () => {
    zeigen(WEBSITE_REDAKTEUR);
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
    zeigen(WEBSITE_REDAKTEUR);
    await seiteWaehlen('Unsere Gruppen');
    expect(await within(toolbar()).findByText('Online')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Zur Prüfung einreichen' })).toBeNull();
  });

  it('online, aber seitdem geändert: „Geändert“ und Einreichen möglich', async () => {
    d.ladeOnline.mockResolvedValue(online(['g', 'ganz-anderer-stand']));
    zeigen(WEBSITE_REDAKTEUR);
    await seiteWaehlen('Unsere Gruppen');
    expect(await within(toolbar()).findByText('Geändert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zur Prüfung einreichen' })).toBeTruthy();
  });

  it('schon eingereicht: kein zweites Einreichen – ändern darf man weiter (E-W24: „Seite einstellen“ bleibt)', async () => {
    d.ladeWebsite.mockResolvedValue(stand({ status: { g: st('eingereicht') } }));
    zeigen(WEBSITE_REDAKTEUR);
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
    zeigen(WEBSITE_REDAKTEUR);
    await seiteWaehlen('Unsere Gruppen');
    expect(within(toolbar()).getByText(/Bitte das Foto tauschen\./)).toBeTruthy();
    expect(within(toolbar()).getByText('Zurück')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zur Prüfung einreichen' })).toBeTruthy();
  });

  it('scheitert das Einreichen (503): es wird NICHT „Eingereicht“ gezeigt, die Meldung sagt, was nicht geschah', async () => {
    d.setzeStatus.mockRejectedValue(new ApiError(503, 'weg'));
    zeigen(WEBSITE_REDAKTEUR);
    await seiteWaehlen('Unsere Gruppen');
    fireEvent.click(await screen.findByRole('button', { name: 'Zur Prüfung einreichen' }));
    expect(await screen.findByText(/nicht eingereicht\./)).toBeTruthy();
    expect(within(toolbar()).queryByText('Eingereicht')).toBeNull();
    expect(screen.getByRole('button', { name: 'Zur Prüfung einreichen' })).toBeTruthy();
    expect(onGeaendert).not.toHaveBeenCalled();
  });

  it('der Online-Stand lässt sich nicht lesen: nichts Falsches („Online“ / „Entwurf“) – Einreichen geht trotzdem', async () => {
    d.ladeOnline.mockRejectedValue(new ApiError(503, 'weg'));
    zeigen(WEBSITE_REDAKTEUR);
    await seiteWaehlen('Unsere Gruppen');
    expect(await screen.findByRole('button', { name: 'Zur Prüfung einreichen' })).toBeTruthy();
    expect(within(toolbar()).queryByText('Online')).toBeNull();
    expect(within(toolbar()).queryByText('Entwurf')).toBeNull();
  });
});

describe('Redakteur: Löschen anfragen statt Löschen (E-W23)', () => {
  async function einstellenOeffnen() {
    zeigen(WEBSITE_REDAKTEUR);
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
    zeigen(WEBSITE_LEITUNG);
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
    zeigen(WEBSITE_LEITUNG);
    await seiteWaehlen('Unsere Gruppen');
    await within(toolbar()).findByText('Online');
    expect(screen.queryByRole('button', { name: 'Mehr' })).toBeNull();
  });

  it('scheitert das Veröffentlichen, steht das da – nichts gilt als online, der Status bleibt', async () => {
    d.ladeWebsite.mockResolvedValue(stand({ status: { g: st('eingereicht') } }));
    d.gebeFrei.mockRejectedValue(new ApiError(403, 'Dafür fehlt dir das Recht: nur die Leitung.'));
    zeigen(WEBSITE_LEITUNG);
    await seiteWaehlen('Unsere Gruppen');
    await veroeffentlichenKlicken();
    expect(await screen.findByText(/nicht veröffentlicht/)).toBeTruthy();
    expect(screen.getByText(/Dafür fehlt dir das Recht/)).toBeTruthy();
    expect(within(toolbar()).getByText('Eingereicht')).toBeTruthy();
    expect(within(toolbar()).queryByText('Online')).toBeNull();
  });

  it('ist die Seite online, der Status aber blieb (Aufräumen gescheitert), steht das als Hinweis – nicht verschwiegen', async () => {
    d.gebeFrei.mockResolvedValue({ stand: 'x', statusEntfernt: false, grund: 'fehler' });
    zeigen(WEBSITE_LEITUNG);
    await seiteWaehlen('Unsere Gruppen');
    await veroeffentlichenKlicken();
    expect(await screen.findByText(/Status ließ sich aber gerade nicht zurücksetzen/)).toBeTruthy();
  });

  it('löscht selbst: „Seite löschen“ bleibt – und eine online stehende Seite wird im Fenster erwähnt', async () => {
    d.ladeOnline.mockResolvedValue(online(['g', seitenStand(GRUPPEN)]));
    zeigen(WEBSITE_LEITUNG);
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
    zeigen(WEBSITE_LEITUNG);
    const liste = await screen.findByRole('complementary', { name: 'Seiten' });
    expect(within(liste).getByText('Eingereicht')).toBeTruthy();
    expect(within(liste).getAllByText(/Eingereicht|Zurück|Löschen angefragt/)).toHaveLength(1);
  });
});

describe('Mails im Freigabe-Weg (W3b-3): Einreichen, Löschen anfragen, Veröffentlichen', () => {
  const ORT_MAIL = { modul: 7, entwuerfe: 20, gruppe: GRUPPE };

  async function einreichen() {
    zeigen(WEBSITE_REDAKTEUR);
    await seiteWaehlen('Unsere Gruppen');
    fireEvent.click(await screen.findByRole('button', { name: 'Zur Prüfung einreichen' }));
  }

  it('Einreichen: Mail an die Leitung mit Seitentitel und Handelnden; der Hinweis sagt „gesendet“', async () => {
    m.mailAnLeitung.mockResolvedValue({ art: 'gesendet' });
    await einreichen();
    expect(await screen.findByText('Die Leitung ist per Mail benachrichtigt.')).toBeTruthy();
    expect(m.mailAnLeitung).toHaveBeenCalledTimes(1);
    expect(m.mailAnLeitung).toHaveBeenCalledWith(
      ORT_MAIL,
      { art: 'eingereicht', seite: 'Unsere Gruppen' },
      ICH,
    );
  });

  it('die Mail geht erst, NACHDEM der Status geschrieben und nachgelesen ist – nicht vorher', async () => {
    let fertig: (s: SeitenStatus) => void = () => {};
    d.setzeStatus.mockReturnValueOnce(new Promise<SeitenStatus>((ok) => (fertig = ok)));
    await einreichen();
    await waitFor(() => expect(d.setzeStatus).toHaveBeenCalledTimes(1));
    expect(m.mailAnLeitung).not.toHaveBeenCalled();
    fertig(st('eingereicht'));
    await waitFor(() => expect(m.mailAnLeitung).toHaveBeenCalledTimes(1));
    expect(d.setzeStatus.mock.invocationCallOrder[0]).toBeLessThan(
      m.mailAnLeitung.mock.invocationCallOrder[0],
    );
  });

  it('scheitert das Einreichen, geht KEINE Mail', async () => {
    d.setzeStatus.mockRejectedValue(new ApiError(503, 'weg'));
    await einreichen();
    expect(await screen.findByText(/nicht eingereicht\./)).toBeTruthy();
    expect(m.mailAnLeitung).not.toHaveBeenCalled();
  });

  it('Mail nicht verschickt: kurzer Hinweis mit Grund – das Einreichen gilt trotzdem (Etikett „Eingereicht“, kein Fehlerkasten)', async () => {
    m.mailAnLeitung.mockResolvedValue({
      art: 'nichtVerschickt',
      grund: 'Mails über ChurchTools schicken darfst du hier nicht.',
    });
    await einreichen();
    const hinweis = await screen.findByText(/ging nicht raus/);
    expect(hinweis.textContent).toContain('Mails über ChurchTools schicken darfst du hier nicht.');
    expect(hinweis.textContent).toContain('trotzdem eingereicht');
    expect(await within(toolbar()).findByText('Eingereicht')).toBeTruthy();
    expect(screen.queryByText(/nicht eingereicht\./)).toBeNull();
    expect(onGeaendert).toHaveBeenCalled();
  });

  it('Mail unklar: der Hinweis rät ausdrücklich ab, noch einmal einzureichen, und verweist auf „Freigaben“', async () => {
    m.mailAnLeitung.mockResolvedValue({ art: 'unklar' });
    await einreichen();
    const hinweis = await screen.findByText(/Ob die Mail an die Leitung rausging, ist unklar/);
    expect(hinweis.textContent).toContain('Bitte nicht noch einmal einreichen');
    expect(hinweis.textContent).toContain('Reiter „Freigaben“');
  });

  it('Schalter aus oder niemand zu benachrichtigen: gar kein Hinweis', async () => {
    for (const art of ['aus', 'niemand'] as const) {
      m.mailAnLeitung.mockResolvedValue({ art });
      const { unmount } = zeigen(WEBSITE_REDAKTEUR);
      await seiteWaehlen('Unsere Gruppen');
      fireEvent.click(await screen.findByRole('button', { name: 'Zur Prüfung einreichen' }));
      await within(toolbar()).findByText('Eingereicht');
      expect(screen.queryByText(/Mail/)).toBeNull();
      unmount();
    }
  });

  it('Löschen anfragen: Mail an die Leitung – mit eigenem Anlass, erst nach dem Status', async () => {
    m.mailAnLeitung.mockResolvedValue({ art: 'gesendet' });
    zeigen(WEBSITE_REDAKTEUR);
    await seiteWaehlen('Unsere Gruppen');
    fireEvent.click(await screen.findByRole('button', { name: 'Seite einstellen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Löschen anfragen' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Löschen anfragen' }));
    await waitFor(() => expect(m.mailAnLeitung).toHaveBeenCalledTimes(1));
    expect(m.mailAnLeitung).toHaveBeenCalledWith(
      ORT_MAIL,
      { art: 'loeschenAngefragt', seite: 'Unsere Gruppen' },
      ICH,
    );
    expect(d.setzeStatus.mock.invocationCallOrder[0]).toBeLessThan(
      m.mailAnLeitung.mock.invocationCallOrder[0],
    );
  });

  it('scheitert das Löschen anfragen, geht keine Mail', async () => {
    d.setzeStatus.mockRejectedValue(new ApiError(503, 'weg'));
    zeigen(WEBSITE_REDAKTEUR);
    await seiteWaehlen('Unsere Gruppen');
    fireEvent.click(await screen.findByRole('button', { name: 'Seite einstellen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Löschen anfragen' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Löschen anfragen',
      }),
    );
    await waitFor(() => expect(d.setzeStatus).toHaveBeenCalled());
    expect(m.mailAnLeitung).not.toHaveBeenCalled();
  });

  async function veroeffentlichen() {
    fireEvent.click(await screen.findByRole('button', { name: 'Mehr' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Veröffentlichen' }));
  }

  it('Leitung veröffentlicht eine EINGEREICHTE Seite: Mail an den Einreichenden („ist freigegeben“), erst nach dem Freigeben', async () => {
    d.ladeWebsite.mockResolvedValue(stand({ status: { g: st('eingereicht', { von: 5 }) } }));
    d.gebeFrei.mockResolvedValue({ stand: 'x', statusEntfernt: true });
    m.mailFreigaben.mockResolvedValue({ art: 'gesendet' });
    zeigen(WEBSITE_LEITUNG);
    await seiteWaehlen('Unsere Gruppen');
    await veroeffentlichen();
    expect(
      await screen.findByText('Wer eingereicht hatte, ist per Mail benachrichtigt.'),
    ).toBeTruthy();
    expect(m.mailFreigaben).toHaveBeenCalledWith(
      ORT_MAIL,
      [{ titel: 'Unsere Gruppen', einreicher: 5 }],
      ICH,
    );
    expect(d.gebeFrei.mock.invocationCallOrder[0]).toBeLessThan(
      m.mailFreigaben.mock.invocationCallOrder[0],
    );
  });

  it('eine nicht eingereichte Seite (kein Status) zu veröffentlichen schickt keine Mail', async () => {
    d.gebeFrei.mockResolvedValue({ stand: 'x', statusEntfernt: true });
    zeigen(WEBSITE_LEITUNG);
    await seiteWaehlen('Unsere Gruppen');
    await veroeffentlichen();
    await waitFor(() => expect(d.gebeFrei).toHaveBeenCalled());
    expect(m.mailFreigaben).not.toHaveBeenCalled();
  });

  it('scheitert das Veröffentlichen, geht keine Mail', async () => {
    d.ladeWebsite.mockResolvedValue(stand({ status: { g: st('eingereicht', { von: 5 }) } }));
    d.gebeFrei.mockRejectedValue(new ApiError(503, 'weg'));
    zeigen(WEBSITE_LEITUNG);
    await seiteWaehlen('Unsere Gruppen');
    await veroeffentlichen();
    expect(await screen.findByText(/nicht veröffentlicht/)).toBeTruthy();
    expect(m.mailFreigaben).not.toHaveBeenCalled();
  });

  it('Mail beim Veröffentlichen unklar: der Hinweis steht NEBEN dem Hinweis zum Status – keiner ersetzt den anderen', async () => {
    d.ladeWebsite.mockResolvedValue(stand({ status: { g: st('eingereicht', { von: 5 }) } }));
    d.gebeFrei.mockResolvedValue({ stand: 'x', statusEntfernt: false, grund: 'fehler' });
    m.mailFreigaben.mockResolvedValue({ art: 'unklar' });
    zeigen(WEBSITE_LEITUNG);
    await seiteWaehlen('Unsere Gruppen');
    await veroeffentlichen();
    const text = (await screen.findByText(/Ob die Mail rausging, ist unklar/)).textContent ?? '';
    expect(text).toContain(
      'Die Seite ist online. Ihr Status ließ sich aber gerade nicht zurücksetzen',
    );
  });
});
