// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import type { OnlineKategorie } from '@shared/website/freigabe';
import type { Seite } from '@shared/website/modell';
import type { WebsiteStand } from '@shared/website/speicher';
import { WEBSITE_LEITUNG, WEBSITE_REDAKTEUR, type Zugang } from '@shared/website/zugang';
import { menue, seite } from '@shared/website/website.testdaten';
import * as D from './daten';
import * as M from './mailVersand';
import { Seiten } from './Seiten';

/**
 * **Bereiche im Reiter „Seiten“** (W3b-4b, E-W30/E-W31): Untergruppen sehen nur ihre Seiten, die Vorschau und die Adressen
 * arbeiten mit allen; eine neue Seite erbt den Bereich; Startseite und Bereich setzt nur die Leitung der Website; freigeben je
 * Bereich. Zahlen realistisch und verschieden: Website-Gruppe 344 (Entwürfe 20, Veröffentlicht 21), Jugend 347 (Kategorie 117),
 * Technik 348 (Kategorie 118).
 */
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
  wechsleBereich: vi.fn(),
}));
vi.mock('./mailVersand', () => ({
  mailAnLeitung: vi.fn(),
  mailZurueck: vi.fn(),
  mailFreigaben: vi.fn(),
}));
const d = vi.mocked(D);
const m = vi.mocked(M);

const JUGEND = 347;
const TECHNIK = 348;
const UNTER = [
  { gruppe: JUGEND, kategorie: 117 },
  { gruppe: TECHNIK, kategorie: 118 },
];
const NAMEN = {
  website: 'Website',
  untergruppen: [
    { gruppe: JUGEND, name: 'Website – Jugend' },
    { gruppe: TECHNIK, name: 'Website – Technik' },
  ],
};
/** Eine Seite, die KEINE Startseite ist (`seite()` legt sonst eine Startseite an). */
const normal = (id: string, titel: string, o: Partial<Seite> = {}): Seite => {
  const { startseite: _start, ...rest } = seite({ id, titel, pfad: id === 'i' ? 'impressum' : id });
  return { ...rest, ...o };
};
const START = seite({ id: 's', titel: 'Willkommen', pfad: 'start', startseite: true });
const IMPRESSUM = normal('i', 'Impressum');
const JUGENDABEND = normal('j', 'Jugendabend', { pfad: 'jugendabend', bereich: JUGEND });
const TECHNIKSEITE = normal('t', 'Technik', { pfad: 'technik', bereich: TECHNIK });
const ALLE = [START, IMPRESSUM, JUGENDABEND, TECHNIKSEITE];

const stand = (o: Partial<WebsiteStand> = {}): WebsiteStand => ({
  seiten: ALLE,
  menue: menue([{ titel: 'Impressum', ziel: { art: 'seite', seiteId: 'i' } }]),
  einstellungen: null,
  probleme: [],
  verwaist: 0,
  sperren: {},
  einstellungenSperre: null,
  status: {},
  staende: [],
  ...o,
});
const leer = (bereich: number | null, kategorie: number): OnlineKategorie => ({
  bereich,
  kategorie,
  stand: stand({ seiten: [], menue: null, staende: [] }),
});

const JUGEND_REDAKTEUR: Zugang = { sieht: [JUGEND], leitet: [] };
const JUGEND_LEITUNG: Zugang = { sieht: [JUGEND], leitet: [JUGEND] };

const zeigen = (zugang: Zugang, rechte = { html: false, menue: false }) =>
  render(
    <Seiten
      ort={{ modul: 7, kategorie: 20 }}
      gemeinde="ECG"
      ich={{ person: 5, name: 'Rita', fenster: 'f1' }}
      rechte={rechte}
      freigabe={{
        zugang,
        veroeffentlicht: 21,
        untergruppen: UNTER,
        bereiche: NAMEN,
        gruppe: 344,
        onGeaendert: vi.fn(),
      }}
    />,
  );
const liste = () => screen.findByRole('complementary', { name: 'Seiten' });

beforeEach(() => {
  vi.clearAllMocks();
  d.ladeWebsite.mockResolvedValue(stand());
  d.ladeOnline.mockResolvedValue([leer(null, 21), leer(JUGEND, 117), leer(TECHNIK, 118)]);
  d.speichereSeite.mockResolvedValue(undefined);
  d.beginneBearbeiten.mockImplementation(async (_o, id) => ({
    art: 'ok',
    seite: ALLE.find((x) => x.id === id) ?? null,
    menue: null,
  }));
  d.beendeBearbeiten.mockResolvedValue(undefined);
  m.mailAnLeitung.mockResolvedValue({ art: 'aus' });
});

describe('Seitenliste je Bereich (E-W31)', () => {
  it('Redakteur der Untergruppe sieht nur Seiten seines Bereichs – auch nicht die Startseite der Website; gezeigt wird eine eigene', async () => {
    zeigen(JUGEND_REDAKTEUR);
    const l = await liste();
    expect(within(l).getByText('Jugendabend')).toBeTruthy();
    for (const fremd of ['Willkommen', 'Impressum', 'Technik'])
      expect(within(l).queryByText(fremd)).toBeNull();
    expect(
      within(screen.getByRole('region', { name: 'Vorschau' })).getByText('Jugendabend'),
    ).toBeTruthy();
  });

  it('„Im Menü“ zeigt nur sichtbare Seiten: das Impressum der Website steht dort nicht', async () => {
    zeigen(JUGEND_REDAKTEUR);
    const l = await liste();
    expect(within(l).getByText('Noch keine Seite im Menü.')).toBeTruthy();
  });

  it('Redakteur der Website sieht alle Seiten', async () => {
    zeigen(WEBSITE_REDAKTEUR);
    const l = await liste();
    for (const t of ['Willkommen', 'Impressum', 'Jugendabend', 'Technik'])
      expect(within(l).getByText(t)).toBeTruthy();
  });
});

describe('Neue Seite (E-W30): Bereich erben, Adresse über ALLE Bereiche frei', () => {
  async function neueSeite(titel: string) {
    await liste();
    fireEvent.click(screen.getAllByRole('button', { name: 'Neue Seite' })[0]);
    const f = await screen.findByRole('dialog');
    fireEvent.change(within(f).getByPlaceholderText(/Unsere Gruppen/), {
      target: { value: titel },
    });
    return f;
  }

  it('Redakteur der Untergruppe: „Impressum“ gibt es (unsichtbar) in der Website → Adresse impressum-2, Bereich Jugend', async () => {
    zeigen(JUGEND_REDAKTEUR);
    const f = await neueSeite('Impressum');
    expect(within(f).getByText('/impressum-2/')).toBeTruthy();
    expect(within(f).queryByLabelText('Bereich')).toBeNull();
    fireEvent.click(within(f).getByRole('button', { name: 'Anlegen' }));
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(1));
    expect(d.speichereSeite.mock.calls[0][1]).toMatchObject({
      pfad: 'impressum-2',
      bereich: JUGEND,
    });
  });

  it('in mehreren Untergruppen: Auswahl im Fenster – gewählt wird gespeichert', async () => {
    zeigen({ sieht: [JUGEND, TECHNIK], leitet: [] });
    const f = await neueSeite('Probe');
    const feld = within(f).getByLabelText<HTMLSelectElement>('Bereich');
    expect([...feld.options].map((o) => o.text)).toEqual(['Website – Jugend', 'Website – Technik']);
    fireEvent.change(feld, { target: { value: String(TECHNIK) } });
    fireEvent.click(within(f).getByRole('button', { name: 'Anlegen' }));
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(1));
    expect(d.speichereSeite.mock.calls[0][1]).toMatchObject({ bereich: TECHNIK });
  });

  it('Leitung/Redakteur der Website: ohne Bereich (gehört der Website)', async () => {
    zeigen(WEBSITE_REDAKTEUR);
    const f = await neueSeite('Probe');
    fireEvent.click(within(f).getByRole('button', { name: 'Anlegen' }));
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(1));
    expect(d.speichereSeite.mock.calls[0][1]).not.toHaveProperty('bereich');
  });
});

describe('Nur die Leitung der Website: Bereich und Startseite (E-W22)', () => {
  it('„Bereich“ in „Seite einstellen“: Website-Leitung ja (mit allen eingerichteten Untergruppen), Leitung der Untergruppe nein', async () => {
    const { unmount } = zeigen(WEBSITE_LEITUNG, { html: true, menue: true });
    await liste();
    fireEvent.click(screen.getByRole('button', { name: 'Seite einstellen' }));
    const f = await screen.findByRole('dialog');
    expect(
      [...within(f).getByLabelText<HTMLSelectElement>('Bereich').options].map((o) => o.text),
    ).toEqual(['Website', 'Website – Jugend', 'Website – Technik']);
    unmount();
    zeigen(JUGEND_LEITUNG);
    await liste();
    fireEvent.click(screen.getByRole('button', { name: 'Seite einstellen' }));
    expect(within(await screen.findByRole('dialog')).queryByLabelText('Bereich')).toBeNull();
  });

  it('„Startseite anlegen“: nur die Leitung der Website; der Redakteur liest, wer es tut; Untergruppen sehen den Hinweis nicht', async () => {
    d.ladeWebsite.mockResolvedValue(stand({ seiten: [IMPRESSUM, JUGENDABEND] }));
    const a = zeigen(WEBSITE_LEITUNG, { html: true, menue: true });
    expect(await screen.findByRole('button', { name: 'Startseite anlegen' })).toBeTruthy();
    a.unmount();
    const b = zeigen(WEBSITE_REDAKTEUR);
    expect(await screen.findByText(/Die Startseite legt die Leitung der Website an/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Startseite anlegen' })).toBeNull();
    b.unmount();
    zeigen(JUGEND_REDAKTEUR);
    await liste();
    expect(screen.queryByText(/noch keine Startseite/)).toBeNull();
  });
});

describe('Freigeben je Bereich an der Seite', () => {
  it('Leitung der Untergruppe: an ihrer Seite „Veröffentlichen“ (mit den Kategorien der Untergruppen)', async () => {
    d.gebeFrei.mockResolvedValue({ stand: 'x', statusEntfernt: true });
    zeigen(JUGEND_LEITUNG);
    await liste();
    expect(screen.queryByRole('button', { name: 'Zur Prüfung einreichen' })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Mehr' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Veröffentlichen' }));
    await waitFor(() =>
      expect(d.gebeFrei).toHaveBeenCalledWith(
        { modul: 7, entwuerfe: 20, veroeffentlicht: 21, untergruppen: UNTER },
        { einheit: 'seite', id: 'j' },
      ),
    );
  });

  it('Leitung der Untergruppe, die alle Seiten sieht: an einer Website-Seite nur „Einreichen“, nicht „Veröffentlichen“', async () => {
    zeigen({ sieht: 'alle', leitet: [JUGEND] });
    const l = await liste();
    fireEvent.click(within(l).getByText('Impressum'));
    expect(await screen.findByRole('button', { name: 'Zur Prüfung einreichen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mehr' })).toBeNull();
  });

  it('bleibt die Seite beim Verschieben im alten Bereich stehen, sagt die Meldung es (mit Namen)', async () => {
    d.gebeFrei.mockResolvedValue({ stand: 'x', statusEntfernt: true, bleibtIn: [null] });
    zeigen(JUGEND_LEITUNG);
    await liste();
    fireEvent.click(await screen.findByRole('button', { name: 'Mehr' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Veröffentlichen' }));
    expect(
      await screen.findByText(/„Jugendabend“ steht zusätzlich noch online im Bereich „Website“/),
    ).toBeTruthy();
  });

  it('liegt die Seite online im falschen Bereich, heißt sie „Geändert“ – auch bei gleichem Text', async () => {
    const online = stand({
      staende: [],
    });
    d.ladeOnline.mockResolvedValue([
      {
        bereich: null,
        kategorie: 21,
        stand: {
          ...online,
          staende: [{ einheit: 'seite', id: 'j', stand: 'gleich', zeit: 'x', lesbar: true }],
        },
      },
      leer(JUGEND, 117),
    ]);
    zeigen(JUGEND_REDAKTEUR);
    await liste();
    expect(
      await within(screen.getByRole('region', { name: 'Vorschau' })).findByText('Geändert'),
    ).toBeTruthy();
  });
});

describe('Bereich ändern → die Online-Fassung wandert sofort mit (W3b-4b-2, E-W32)', () => {
  const KATEGORIEN = { modul: 7, entwuerfe: 20, veroeffentlicht: 21, untergruppen: UNTER };
  /** Die Leitung der Website stellt das Impressum (Website, online) auf Jugend. */
  async function aufJugend() {
    zeigen(WEBSITE_LEITUNG, { html: true, menue: true });
    const l = await liste();
    fireEvent.click(within(l).getByText('Impressum'));
    await screen.findByText('Impressum', { selector: 'strong' });
    fireEvent.click(screen.getByRole('button', { name: 'Seite einstellen' }));
    const f = await screen.findByRole('dialog');
    fireEvent.change(within(f).getByLabelText('Bereich'), { target: { value: String(JUGEND) } });
    fireEvent.click(within(f).getByRole('button', { name: 'Fertig' }));
  }

  it('erst den Entwurf speichern, dann verschieben (alter → neuer Bereich), danach den Online-Stand neu lesen', async () => {
    d.wechsleBereich.mockResolvedValue({ verschoben: true });
    await aufJugend();
    expect(
      await screen.findByText('„Impressum“ steht online jetzt im Bereich „Website – Jugend“.'),
    ).toBeTruthy();
    expect(d.wechsleBereich).toHaveBeenCalledWith(KATEGORIEN, 'i', null, JUGEND);
    expect(d.speichereSeite.mock.calls.at(-1)?.[1]).toMatchObject({ id: 'i', bereich: JUGEND });
    expect(d.speichereSeite.mock.invocationCallOrder.at(-1)!).toBeLessThan(
      d.wechsleBereich.mock.invocationCallOrder[0],
    );
    await waitFor(() => expect(d.ladeOnline).toHaveBeenCalledTimes(2));
  });

  it('verschieben scheitert (503): eigene Meldung – online vorerst noch im alten Bereich; das Speichern gilt als gelungen', async () => {
    d.wechsleBereich.mockRejectedValue(new ApiError(503, 'x'));
    await aufJugend();
    expect(
      await screen.findByText(
        /Der neue Bereich von „Impressum“ ist gespeichert\. Online steht die Seite aber vorerst noch im Bereich „Website“ – „Veröffentlichen“ verschiebt sie\./,
      ),
    ).toBeTruthy();
    expect(screen.getByText('Gespeichert')).toBeTruthy();
    expect(screen.queryByText('Nicht gespeichert')).toBeNull();
    expect(screen.queryByText(/steht online jetzt/)).toBeNull();
    await waitFor(() => expect(d.ladeOnline).toHaveBeenCalledTimes(2));
  });

  it('verschoben, aber im alten Bereich nicht entfernt: dieselbe Meldung wie beim Freigeben („bleibt“)', async () => {
    d.wechsleBereich.mockResolvedValue({ verschoben: true, bleibtIn: [null] });
    await aufJugend();
    expect(
      await screen.findByText(/„Impressum“ steht zusätzlich noch online im Bereich „Website“/),
    ).toBeTruthy();
  });

  it('nicht online (nichts zu verschieben): keine Meldung', async () => {
    d.wechsleBereich.mockResolvedValue({ verschoben: false });
    await aufJugend();
    await waitFor(() => expect(d.wechsleBereich).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(d.ladeOnline).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/steht online jetzt/)).toBeNull();
  });
});
