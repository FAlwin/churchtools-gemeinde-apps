// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { gibFrei } from '@shared/website/freigabe';
import {
  EINSTELLUNGEN_ID,
  MENUE_ID,
  einstellungenSpeichern,
  menueSpeichern,
  seiteSpeichern,
  websiteAusWerten,
} from '@shared/website/speicher';
import { statusSetzen } from '@shared/website/status';
import { WEBSITE_LEITUNG, WEBSITE_REDAKTEUR, type Zugang } from '@shared/website/zugang';
import { nurWebsite } from '@shared/website/freigabe';
import { ENTWUERFE, ONLINE, fakeFreigabeSpeicher } from '@shared/website/freigabe.testutil';
import { baustein, einstellungen, menue, seiteMit } from '@shared/website/website.testdaten';
import * as D from './daten';
import * as M from './mailVersand';
import type { FreigabeDaten } from './daten';
import { Freigaben } from './Freigaben';

vi.mock('./daten', () => ({
  gebeFrei: vi.fn(),
  gebeAllesFrei: vi.fn(),
  setzeStatus: vi.fn(),
  entferneStatus: vi.fn(),
  entferneSeiteUndOnline: vi.fn(),
  speichereMenue: vi.fn(),
}));
vi.mock('./mailVersand', () => ({
  mailAnLeitung: vi.fn(),
  mailZurueck: vi.fn(),
  mailFreigaben: vi.fn(),
}));
const d = vi.mocked(D);
const m = vi.mocked(M);

const KAT = { modul: 7, entwuerfe: ENTWUERFE, veroeffentlicht: ONLINE };
const GRUPPE = 344;
const HELENE = { person: 1, name: 'Helene Wiebe', fenster: 'f1' };
const RITA = { person: 5, name: 'Rita Redakteurin', fenster: 'f2' };
const FRUEH = new Date('2026-11-20T08:00:00Z');
const SPAET = new Date('2026-11-20T09:00:00Z');
const onGeaendert = vi.fn();

const sei = (id: string, titel: string, text = id) =>
  seiteMit([baustein('text', { id: `t-${id}`, markdown: text })], { id, pfad: id, titel });

/**
 * Das Szenario aus echtem Schreiben (nicht aus Literalen): Startseite online · A eingereicht von Rita (neu) · B eingereicht von
 * Rita (später), online in älterer Fassung · C zurückgegeben an Rita · D Löschen angefragt von Rita (online) · E nur ein
 * unfertiger Entwurf ohne Einreichen · X nur noch online · Menü und Einstellungen geändert.
 */
async function szenario(): Promise<FreigabeDaten> {
  const s = fakeFreigabeSpeicher();
  const start = { ...sei('s', 'Willkommen'), startseite: true };
  for (const x of [
    start,
    sei('a', 'A'),
    sei('b', 'B', 'alt'),
    sei('c', 'C'),
    sei('d', 'D'),
    sei('e', 'E'),
  ])
    await seiteSpeichern(s.entwurfsOrt, x, FRUEH);
  for (const id of ['s', 'b', 'd']) await gibFrei(s.freigabeOrt, 'seite', id);
  await seiteSpeichern(s.entwurfsOrt, sei('b', 'B', 'neu'), SPAET);
  await seiteSpeichern(s.onlineOrt, sei('x', 'X'), FRUEH);
  await menueSpeichern(
    s.entwurfsOrt,
    menue([{ titel: 'D', ziel: { art: 'seite', seiteId: 'd' } }]),
    SPAET,
  );
  await einstellungenSpeichern(s.entwurfsOrt, einstellungen(), SPAET);
  await statusSetzen(s.entwurfsOrt, 'a', { zustand: 'eingereicht' }, RITA, SPAET);
  await statusSetzen(s.entwurfsOrt, 'b', { zustand: 'eingereicht' }, RITA, FRUEH);
  await statusSetzen(
    s.entwurfsOrt,
    'c',
    {
      zustand: 'zurueck',
      anmerkung: 'Bitte das Foto tauschen.',
      einreicher: { von: 5, name: RITA.name },
    },
    HELENE,
    SPAET,
  );
  await statusSetzen(s.entwurfsOrt, 'd', { zustand: 'loeschenAngefragt' }, RITA, SPAET);
  const entwurf = websiteAusWerten(s.werte[ENTWUERFE]);
  return { entwurf, online: nurWebsite(entwurf, websiteAusWerten(s.werte[ONLINE])) };
}

async function zeigen(zugang: Zugang, ichId = zugang === WEBSITE_REDAKTEUR ? 5 : 1) {
  const daten = await szenario();
  render(
    <Freigaben
      kategorien={KAT}
      daten={daten}
      zugang={zugang}
      ich={{ ...HELENE, person: ichId }}
      gemeinde="ECG"
      gruppe={GRUPPE}
      onGeaendert={onGeaendert}
    />,
  );
  return daten;
}
const liste = () => screen.getByRole('complementary', { name: 'Freigaben' });
const waehle = (titel: string) => fireEvent.click(within(liste()).getByText(titel));
const knopf = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  vi.clearAllMocks();
  d.gebeFrei.mockResolvedValue({ stand: 'x', statusEntfernt: true });
  d.setzeStatus.mockResolvedValue({ zustand: 'zurueck', von: 1, name: 'Helene', zeit: 'x' });
  d.entferneStatus.mockResolvedValue(undefined);
  d.entferneSeiteUndOnline.mockResolvedValue({ bleibtIn: [] });
  d.speichereMenue.mockResolvedValue(undefined);
  d.gebeAllesFrei.mockResolvedValue({ geschafft: [], fehler: null, offen: 0 });
  m.mailZurueck.mockResolvedValue({ art: 'aus' });
  m.mailFreigaben.mockResolvedValue({ art: 'aus' });
});

describe('Liste der Leitung', () => {
  it('Gruppen und Reihenfolge: Eingereicht (die älteste Bitte oben), Löschen angefragt, Zurückgegeben, Änderungen, Menü und Aussehen, nur noch online', async () => {
    await zeigen(WEBSITE_LEITUNG);
    const gruppen = within(liste())
      .getAllByRole('heading')
      .map((h) => h.textContent);
    expect(gruppen).toEqual([
      'Eingereicht',
      'Löschen angefragt',
      'Zurückgegeben',
      'Änderungen',
      'Menü und Aussehen',
      'Nur noch online',
    ]);
    const eingereicht = within(
      within(liste()).getByRole('heading', { name: 'Eingereicht' }).parentElement!,
    );
    // B wurde früher eingereicht als A.
    expect(eingereicht.getAllByRole('button').map((b) => b.textContent)).toEqual([
      expect.stringContaining('B'),
      expect.stringContaining('A'),
    ]);
    const aenderungen = within(
      within(liste()).getByRole('heading', { name: 'Änderungen' }).parentElement!,
    );
    expect(aenderungen.getByText('E')).toBeTruthy(); // der unfertige Entwurf ist für die Leitung sichtbar …
    expect(within(liste()).getByText('Menü')).toBeTruthy();
    expect(within(liste()).getByText('Einstellungen und Aussehen')).toBeTruthy();
    expect(within(liste()).getByText('X')).toBeTruthy();
  });

  it('die Vorschau zeigt den Entwurf der gewählten Seite mit dem echten Renderer', async () => {
    await zeigen(WEBSITE_LEITUNG);
    waehle('A');
    expect(screen.getByTitle('Vorschau: A')).toBeTruthy();
    expect(screen.getByText(/Eingereicht von Rita Redakteurin am/)).toBeTruthy();
  });

  it('nichts abweichend: ruhiger Hinweis, kein „Alles freigeben“', async () => {
    render(
      <Freigaben
        kategorien={KAT}
        daten={{
          entwurf: websiteAusWerten([]),
          online: nurWebsite(websiteAusWerten([]), websiteAusWerten([])),
        }}
        zugang={WEBSITE_LEITUNG}
        ich={HELENE}
        gemeinde="ECG"
        gruppe={GRUPPE}
        onGeaendert={onGeaendert}
      />,
    );
    expect(screen.getByText(/Alles ist so online, wie es im Entwurf steht/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Alles freigeben' })).toBeNull();
  });
});

describe('Freigeben und Zurückgeben', () => {
  it('eingereicht: „Freigeben“ gibt GENAU diese Einheit frei, meldet es und lässt neu lesen', async () => {
    await zeigen(WEBSITE_LEITUNG);
    waehle('A');
    fireEvent.click(knopf('Freigeben'));
    await waitFor(() =>
      expect(d.gebeFrei).toHaveBeenCalledWith(KAT, { einheit: 'seite', id: 'a' }),
    );
    expect(await screen.findByText('„A“ ist online.')).toBeTruthy();
    expect(onGeaendert).toHaveBeenCalledTimes(1);
  });

  it('scheitert es (503): die Meldung sagt, was NICHT geschah; nichts wird als online gemeldet; kein Neulesen nötig; ein neuer Versuch geht', async () => {
    d.gebeFrei.mockRejectedValueOnce(new ApiError(503, 'weg'));
    await zeigen(WEBSITE_LEITUNG);
    waehle('A');
    fireEvent.click(knopf('Freigeben'));
    expect(
      await screen.findByText(
        /„A“ wurde nicht veröffentlicht – online steht weiter die bisherige Fassung\./,
      ),
    ).toBeTruthy();
    expect(screen.queryByText('„A“ ist online.')).toBeNull();
    expect(onGeaendert).not.toHaveBeenCalled();
    fireEvent.click(knopf('Freigeben'));
    expect(await screen.findByText('„A“ ist online.')).toBeTruthy();
  });

  it('kein Recht beim Schreiben: die klare Meldung von ChurchTools bleibt lesbar', async () => {
    d.gebeFrei.mockRejectedValueOnce(
      new ApiError(403, 'Dafür fehlt dir das Recht: nur die Leitung.'),
    );
    await zeigen(WEBSITE_LEITUNG);
    waehle('A');
    fireEvent.click(knopf('Freigeben'));
    expect(await screen.findByText(/Dafür fehlt dir das Recht/)).toBeTruthy();
  });

  it('ist der Entwurf nach dem Lesen weitergeändert worden, sagt die Meldung, dass er eingereicht bleibt', async () => {
    d.gebeFrei.mockResolvedValue({ stand: 'x', statusEntfernt: false, grund: 'geaendert' });
    await zeigen(WEBSITE_LEITUNG);
    waehle('A');
    fireEvent.click(knopf('Freigeben'));
    expect(await screen.findByText(/noch einmal geändert .* bleibt eingereicht/)).toBeTruthy();
  });

  it('eine nicht eingereichte Seite heißt „Veröffentlichen“ und hat kein „Mit Anmerkung zurück“', async () => {
    await zeigen(WEBSITE_LEITUNG);
    waehle('E');
    expect(knopf('Veröffentlichen')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mit Anmerkung zurück' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Freigeben' })).toBeNull();
  });

  it('Menü und Einstellungen sind eigene Einträge: „Veröffentlichen“ gibt die feste Einheit frei – das Menü warnt vor Seiten, die noch nicht online sind', async () => {
    await zeigen(WEBSITE_LEITUNG);
    waehle('Menü');
    fireEvent.click(knopf('Veröffentlichen'));
    await waitFor(() =>
      expect(d.gebeFrei).toHaveBeenCalledWith(KAT, { einheit: 'menue', id: MENUE_ID }),
    );
    waehle('Einstellungen und Aussehen');
    fireEvent.click(knopf('Veröffentlichen'));
    await waitFor(() =>
      expect(d.gebeFrei).toHaveBeenCalledWith(KAT, {
        einheit: 'einstellungen',
        id: EINSTELLUNGEN_ID,
      }),
    );
  });

  it('„Mit Anmerkung zurück“ verlangt eine Anmerkung und schreibt sie samt Einreichender', async () => {
    await zeigen(WEBSITE_LEITUNG);
    waehle('A');
    fireEvent.click(knopf('Mit Anmerkung zurück'));
    const fenster = await screen.findByRole('dialog');
    const geben = within(fenster).getByRole('button', { name: 'Zurückgeben' });
    expect(geben).toHaveProperty('disabled', true);
    fireEvent.change(within(fenster).getByRole('textbox'), {
      target: { value: '  Bitte die Uhrzeit prüfen.  ' },
    });
    expect(geben).toHaveProperty('disabled', false);
    fireEvent.click(geben);
    await waitFor(() => expect(d.setzeStatus).toHaveBeenCalledTimes(1));
    expect(d.setzeStatus).toHaveBeenCalledWith(
      KAT,
      'a',
      {
        zustand: 'zurueck',
        anmerkung: 'Bitte die Uhrzeit prüfen.',
        einreicher: { von: 5, name: 'Rita Redakteurin' },
      },
      HELENE,
    );
    expect(onGeaendert).toHaveBeenCalled();
  });

  it('scheitert das Zurückgeben, bleibt das Fenster offen und nennt den Grund', async () => {
    d.setzeStatus.mockRejectedValue(new ApiError(503, 'weg'));
    await zeigen(WEBSITE_LEITUNG);
    waehle('A');
    fireEvent.click(knopf('Mit Anmerkung zurück'));
    const fenster = await screen.findByRole('dialog');
    fireEvent.change(within(fenster).getByRole('textbox'), { target: { value: 'x' } });
    fireEvent.click(within(fenster).getByRole('button', { name: 'Zurückgeben' }));
    expect(await within(fenster).findByRole('alert')).toBeTruthy();
    expect(onGeaendert).not.toHaveBeenCalled();
  });
});

describe('Löschen angefragt und „online, aber Entwurf gelöscht“', () => {
  it('„Löschen und offline nehmen“: erst nach der Rückfrage – zuerst das Menü ohne die Seite, dann online + Entwurf', async () => {
    const reihenfolge: string[] = [];
    d.speichereMenue.mockImplementation(async () => void reihenfolge.push('menue'));
    d.entferneSeiteUndOnline.mockImplementation(async () => {
      reihenfolge.push('seite');
      return { bleibtIn: [] };
    });
    await zeigen(WEBSITE_LEITUNG);
    waehle('D');
    fireEvent.click(knopf('Löschen und offline nehmen'));
    expect(d.entferneSeiteUndOnline).not.toHaveBeenCalled();
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Löschen und offline nehmen',
      }),
    );
    await waitFor(() => expect(reihenfolge).toEqual(['menue', 'seite']));
    expect(d.speichereMenue.mock.calls[0][1]).toEqual({ eintraege: [] });
    expect(d.entferneSeiteUndOnline).toHaveBeenCalledWith(KAT, 'd', null);
    expect(onGeaendert).toHaveBeenCalled();
  });

  it('scheitert das Menü, wird nichts gelöscht – das Fenster bleibt mit der Meldung', async () => {
    d.speichereMenue.mockRejectedValue(new ApiError(503, 'weg'));
    await zeigen(WEBSITE_LEITUNG);
    waehle('D');
    fireEvent.click(knopf('Löschen und offline nehmen'));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Löschen und offline nehmen' }));
    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    expect(d.entferneSeiteUndOnline).not.toHaveBeenCalled();
  });

  it('„Ablehnen“ nimmt nur den Status weg – die Seite bleibt', async () => {
    await zeigen(WEBSITE_LEITUNG);
    waehle('D');
    fireEvent.click(knopf('Ablehnen'));
    await waitFor(() => expect(d.entferneStatus).toHaveBeenCalledWith(KAT, 'd'));
    expect(d.entferneSeiteUndOnline).not.toHaveBeenCalled();
    expect(await screen.findByText(/abgelehnt – die Seite bleibt/)).toBeTruthy();
  });

  it('online, aber Entwurf gelöscht: „Offline nehmen“ nach Rückfrage – ohne das Menü anzufassen', async () => {
    await zeigen(WEBSITE_LEITUNG);
    waehle('X');
    fireEvent.click(knopf('Offline nehmen'));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Offline nehmen',
      }),
    );
    await waitFor(() => expect(d.entferneSeiteUndOnline).toHaveBeenCalledWith(KAT, 'x', null));
    expect(d.speichereMenue).not.toHaveBeenCalled();
  });
});

describe('Alles freigeben', () => {
  it('nimmt NUR eingereichte Seiten, Menü und Einstellungen – nie den nicht eingereichten Entwurf, nie Löschen angefragt', async () => {
    await zeigen(WEBSITE_LEITUNG);
    fireEvent.click(knopf('Alles freigeben'));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/„A“.*„B“|„B“.*„A“/)).toBeTruthy();
    expect(within(dialog).queryByText(/„E“/)).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alles freigeben' }));
    await waitFor(() => expect(d.gebeAllesFrei).toHaveBeenCalledTimes(1));
    const ziele = d.gebeAllesFrei.mock.calls[0][1];
    expect(ziele.map((z) => `${z.einheit}:${z.id}`).sort()).toEqual(
      ['seite:a', 'seite:b', `menue:${MENUE_ID}`, `einstellungen:${EINSTELLUNGEN_ID}`].sort(),
    );
  });

  it('bricht der Lauf ab, steht, was geschafft ist – und wie viele nicht mehr versucht wurden; die Liste liest trotzdem neu', async () => {
    d.gebeAllesFrei.mockResolvedValue({
      geschafft: [{ einheit: 'seite', id: 'a' }],
      fehler: { ziel: { einheit: 'seite', id: 'b' }, fehler: new ApiError(503, 'weg') },
      offen: 2,
    });
    await zeigen(WEBSITE_LEITUNG);
    fireEvent.click(knopf('Alles freigeben'));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alles freigeben' }));
    expect(
      await within(dialog).findByText(
        /1 von 4 sind online\. Bei „B“ ist es abgebrochen \(2 weitere nicht mehr versucht\)/,
      ),
    ).toBeTruthy();
    expect(onGeaendert).toHaveBeenCalled();
  });
});

describe('Redakteur: nur lesen', () => {
  it('sieht nur seine eigenen Seiten – eingereicht, zurückgegeben, Löschen angefragt –, kein Menü, kein Aussehen, nichts Fremdes', async () => {
    await zeigen(WEBSITE_REDAKTEUR);
    const titel = within(liste())
      .getAllByRole('button')
      .map((b) => b.textContent ?? '');
    expect(titel.some((t) => t.startsWith('A'))).toBe(true);
    expect(titel.some((t) => t.startsWith('B'))).toBe(true);
    expect(titel.some((t) => t.startsWith('C'))).toBe(true);
    expect(titel.some((t) => t.startsWith('D'))).toBe(true);
    for (const nicht of ['E', 'X', 'Menü', 'Einstellungen und Aussehen'])
      expect(titel.some((t) => t.startsWith(nicht))).toBe(false);
  });

  it('hat keinen einzigen Knopf zum Freigeben, Veröffentlichen, Zurückgeben, Löschen, Ablehnen oder „Alles freigeben“', async () => {
    await zeigen(WEBSITE_REDAKTEUR);
    for (const t of ['A', 'B', 'C', 'D']) {
      waehle(t);
      for (const name of [
        /Freigeben/,
        /Veröffentlichen/,
        /Mit Anmerkung zurück/,
        /Löschen und offline/,
        /Ablehnen/,
        /Offline nehmen/,
        /Alles freigeben/,
      ])
        expect(screen.queryByRole('button', { name })).toBeNull();
    }
  });

  it('eine zurückgegebene Seite zeigt die Anmerkung der Leitung', async () => {
    await zeigen(WEBSITE_REDAKTEUR);
    waehle('C');
    expect(screen.getByText(/Bitte das Foto tauschen\./)).toBeTruthy();
  });

  it('eine andere Redakteurin sieht davon nichts (nur den ruhigen Hinweis)', async () => {
    await zeigen(WEBSITE_REDAKTEUR, 77);
    expect(screen.queryByRole('complementary', { name: 'Freigaben' })).toBeNull();
    expect(screen.getByText(/Du hast gerade nichts eingereicht/)).toBeTruthy();
  });
});

describe('Mails im Freigabe-Weg (W3b-3): Zurückgeben und Freigeben', () => {
  const ORT_MAIL = { modul: 7, entwuerfe: ENTWUERFE, gruppe: GRUPPE };

  async function zurueckgeben(anmerkung = 'Bitte die Uhrzeit prüfen.') {
    await zeigen(WEBSITE_LEITUNG);
    waehle('A');
    fireEvent.click(knopf('Mit Anmerkung zurück'));
    const fenster = await screen.findByRole('dialog');
    fireEvent.change(within(fenster).getByRole('textbox'), { target: { value: anmerkung } });
    fireEvent.click(within(fenster).getByRole('button', { name: 'Zurückgeben' }));
  }

  it('Zurückgeben: Mail an den EINREICHENDEN (Rita) mit der Anmerkung – erst nachdem der Status gesetzt ist', async () => {
    m.mailZurueck.mockResolvedValue({ art: 'gesendet' });
    await zurueckgeben();
    expect(
      await screen.findByText(/Wer eingereicht hatte, ist per Mail benachrichtigt\./),
    ).toBeTruthy();
    expect(m.mailZurueck).toHaveBeenCalledWith(
      ORT_MAIL,
      { seite: 'A', anmerkung: 'Bitte die Uhrzeit prüfen.', einreicher: 5 },
      HELENE,
    );
    expect(d.setzeStatus.mock.invocationCallOrder[0]).toBeLessThan(
      m.mailZurueck.mock.invocationCallOrder[0],
    );
  });

  it('scheitert das Zurückgeben, geht keine Mail', async () => {
    d.setzeStatus.mockRejectedValue(new ApiError(503, 'weg'));
    await zurueckgeben('x');
    await waitFor(() => expect(d.setzeStatus).toHaveBeenCalled());
    await screen.findAllByRole('alert');
    expect(m.mailZurueck).not.toHaveBeenCalled();
  });

  it('Mail beim Zurückgeben nicht verschickt: Hinweis mit Grund, das Zurückgeben gilt (Fenster zu, neu gelesen)', async () => {
    m.mailZurueck.mockResolvedValue({ art: 'nichtVerschickt', grund: 'kein Recht.' });
    await zurueckgeben();
    const hinweis = await screen.findByText(/Die Mail an den Einreichenden ging nicht raus/);
    expect(hinweis.textContent).toContain('kein Recht.');
    expect(hinweis.textContent).toContain('„A“ ist mit deiner Anmerkung zurückgegeben.');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onGeaendert).toHaveBeenCalled();
  });

  it('Mail beim Zurückgeben unklar: der Hinweis rät ab, noch einmal zurückzugeben', async () => {
    m.mailZurueck.mockResolvedValue({ art: 'unklar' });
    await zurueckgeben();
    expect((await screen.findByText(/Ob die Mail rausging, ist unklar/)).textContent).toContain(
      'Bitte nicht noch einmal zurückgeben',
    );
  });

  it('Schalter aus („aus“): kein Hinweis', async () => {
    await zurueckgeben();
    await screen.findByText('„A“ ist mit deiner Anmerkung zurückgegeben.');
    expect(screen.queryByText(/Mail/)).toBeNull();
  });

  it('Freigeben einer eingereichten Seite: Mail an den Einreichenden – nach dem Freigeben', async () => {
    m.mailFreigaben.mockResolvedValue({ art: 'gesendet' });
    await zeigen(WEBSITE_LEITUNG);
    waehle('A');
    fireEvent.click(knopf('Freigeben'));
    expect(
      await screen.findByText(
        /„A“ ist online\. Wer eingereicht hatte, ist per Mail benachrichtigt\./,
      ),
    ).toBeTruthy();
    expect(m.mailFreigaben).toHaveBeenCalledWith(ORT_MAIL, [{ titel: 'A', einreicher: 5 }], HELENE);
    expect(d.gebeFrei.mock.invocationCallOrder[0]).toBeLessThan(
      m.mailFreigaben.mock.invocationCallOrder[0],
    );
  });

  it('scheitert das Freigeben, geht keine Mail', async () => {
    d.gebeFrei.mockRejectedValueOnce(new ApiError(503, 'weg'));
    await zeigen(WEBSITE_LEITUNG);
    waehle('A');
    fireEvent.click(knopf('Freigeben'));
    await screen.findByText(/wurde nicht veröffentlicht/);
    expect(m.mailFreigaben).not.toHaveBeenCalled();
  });

  it('„Veröffentlichen“ einer nicht eingereichten Seite (Änderung) und das Menü: keine Mail', async () => {
    await zeigen(WEBSITE_LEITUNG);
    waehle('E');
    fireEvent.click(knopf('Veröffentlichen'));
    await waitFor(() => expect(d.gebeFrei).toHaveBeenCalledTimes(1));
    expect(m.mailFreigaben).not.toHaveBeenCalled();
  });

  async function alleFreigeben() {
    await zeigen(WEBSITE_LEITUNG);
    fireEvent.click(knopf('Alles freigeben'));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alles freigeben' }));
    return dialog;
  }

  it('Alles freigeben: EIN Aufruf für alle eingereichten Seiten, die jetzt online sind (der Baustein bündelt je Person) – Menü und Einstellungen zählen nicht', async () => {
    d.gebeAllesFrei.mockResolvedValue({
      geschafft: [
        { einheit: 'seite', id: 'a' },
        { einheit: 'seite', id: 'b' },
        { einheit: 'menue', id: MENUE_ID },
        { einheit: 'einstellungen', id: EINSTELLUNGEN_ID },
      ],
      fehler: null,
      offen: 0,
    });
    m.mailFreigaben.mockResolvedValue({ art: 'gesendet' });
    await alleFreigeben();
    expect(
      await screen.findByText(/Wer eingereicht hatte, ist per Mail benachrichtigt\./),
    ).toBeTruthy();
    expect(m.mailFreigaben).toHaveBeenCalledTimes(1);
    expect(m.mailFreigaben).toHaveBeenCalledWith(
      ORT_MAIL,
      [
        { titel: 'A', einreicher: 5 },
        { titel: 'B', einreicher: 5 },
      ],
      HELENE,
    );
  });

  it('bricht „Alles freigeben“ ab, gehen Mails nur für das, was geschafft ist – der Hinweis steht bei der Abbruch-Meldung', async () => {
    d.gebeAllesFrei.mockResolvedValue({
      geschafft: [{ einheit: 'seite', id: 'a' }],
      fehler: { ziel: { einheit: 'seite', id: 'b' }, fehler: new ApiError(503, 'weg') },
      offen: 2,
    });
    m.mailFreigaben.mockResolvedValue({ art: 'gesendet' });
    const dialog = await alleFreigeben();
    expect(await within(dialog).findByText(/Bei „B“ ist es abgebrochen/)).toBeTruthy();
    expect(m.mailFreigaben).toHaveBeenCalledWith(ORT_MAIL, [{ titel: 'A', einreicher: 5 }], HELENE);
    expect(within(dialog).getByText(/per Mail benachrichtigt/)).toBeTruthy();
  });

  it('wurde nichts geschafft: keine Mail', async () => {
    d.gebeAllesFrei.mockResolvedValue({
      geschafft: [],
      fehler: { ziel: { einheit: 'seite', id: 'a' }, fehler: new ApiError(503, 'weg') },
      offen: 3,
    });
    await alleFreigeben();
    await screen.findAllByText(/0 von 4 sind online/);
    expect(m.mailFreigaben).not.toHaveBeenCalled();
  });
});
