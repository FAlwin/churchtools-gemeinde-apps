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
  type WebsiteStand,
} from '@shared/website/speicher';
import { statusSetzen } from '@shared/website/status';
import type { Zugang } from '@shared/website/zugang';
import { ENTWUERFE, ONLINE, fakeFreigabeSpeicher } from '@shared/website/freigabe.testutil';
import { baustein, einstellungen, menue, seiteMit } from '@shared/website/website.testdaten';
import * as D from './daten';
import { Freigaben } from './Freigaben';

vi.mock('./daten', () => ({
  gebeFrei: vi.fn(),
  gebeAllesFrei: vi.fn(),
  setzeStatus: vi.fn(),
  entferneStatus: vi.fn(),
  entferneSeiteUndOnline: vi.fn(),
  speichereMenue: vi.fn(),
}));
const d = vi.mocked(D);

const KAT = { modul: 7, entwuerfe: ENTWUERFE, veroeffentlicht: ONLINE };
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
async function szenario(): Promise<{ entwurf: WebsiteStand; online: WebsiteStand }> {
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
  return {
    entwurf: websiteAusWerten(s.werte[ENTWUERFE]),
    online: websiteAusWerten(s.werte[ONLINE]),
  };
}

async function zeigen(zugang: Zugang, ichId = zugang === 'redakteur' ? 5 : 1) {
  const daten = await szenario();
  render(
    <Freigaben
      kategorien={KAT}
      daten={daten}
      zugang={zugang}
      ich={{ ...HELENE, person: ichId }}
      gemeinde="ECG"
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
  d.entferneSeiteUndOnline.mockResolvedValue(undefined);
  d.speichereMenue.mockResolvedValue(undefined);
  d.gebeAllesFrei.mockResolvedValue({ geschafft: [], fehler: null, offen: 0 });
});

describe('Liste der Leitung', () => {
  it('Gruppen und Reihenfolge: Eingereicht (die älteste Bitte oben), Löschen angefragt, Zurückgegeben, Änderungen, Menü und Aussehen, nur noch online', async () => {
    await zeigen('leitung');
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
    await zeigen('leitung');
    waehle('A');
    expect(screen.getByTitle('Vorschau: A')).toBeTruthy();
    expect(screen.getByText(/Eingereicht von Rita Redakteurin am/)).toBeTruthy();
  });

  it('nichts abweichend: ruhiger Hinweis, kein „Alles freigeben“', async () => {
    render(
      <Freigaben
        kategorien={KAT}
        daten={{ entwurf: websiteAusWerten([]), online: websiteAusWerten([]) }}
        zugang="leitung"
        ich={HELENE}
        gemeinde="ECG"
        onGeaendert={onGeaendert}
      />,
    );
    expect(screen.getByText(/Alles ist so online, wie es im Entwurf steht/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Alles freigeben' })).toBeNull();
  });
});

describe('Freigeben und Zurückgeben', () => {
  it('eingereicht: „Freigeben“ gibt GENAU diese Einheit frei, meldet es und lässt neu lesen', async () => {
    await zeigen('leitung');
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
    await zeigen('leitung');
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
    await zeigen('leitung');
    waehle('A');
    fireEvent.click(knopf('Freigeben'));
    expect(await screen.findByText(/Dafür fehlt dir das Recht/)).toBeTruthy();
  });

  it('ist der Entwurf nach dem Lesen weitergeändert worden, sagt die Meldung, dass er eingereicht bleibt', async () => {
    d.gebeFrei.mockResolvedValue({ stand: 'x', statusEntfernt: false, grund: 'geaendert' });
    await zeigen('leitung');
    waehle('A');
    fireEvent.click(knopf('Freigeben'));
    expect(await screen.findByText(/noch einmal geändert .* bleibt eingereicht/)).toBeTruthy();
  });

  it('eine nicht eingereichte Seite heißt „Veröffentlichen“ und hat kein „Mit Anmerkung zurück“', async () => {
    await zeigen('leitung');
    waehle('E');
    expect(knopf('Veröffentlichen')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mit Anmerkung zurück' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Freigeben' })).toBeNull();
  });

  it('Menü und Einstellungen sind eigene Einträge: „Veröffentlichen“ gibt die feste Einheit frei – das Menü warnt vor Seiten, die noch nicht online sind', async () => {
    await zeigen('leitung');
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
    await zeigen('leitung');
    waehle('A');
    fireEvent.click(knopf('Mit Anmerkung zurück'));
    const fenster = await screen.findByRole('dialog');
    const geben = within(fenster).getByRole('button', { name: 'Zurückgeben' }) as HTMLButtonElement;
    expect(geben.disabled).toBe(true);
    fireEvent.change(within(fenster).getByRole('textbox'), {
      target: { value: '  Bitte die Uhrzeit prüfen.  ' },
    });
    expect(geben.disabled).toBe(false);
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
    await zeigen('leitung');
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
    d.entferneSeiteUndOnline.mockImplementation(async () => void reihenfolge.push('seite'));
    await zeigen('leitung');
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
    expect(d.entferneSeiteUndOnline).toHaveBeenCalledWith(KAT, 'd');
    expect(onGeaendert).toHaveBeenCalled();
  });

  it('scheitert das Menü, wird nichts gelöscht – das Fenster bleibt mit der Meldung', async () => {
    d.speichereMenue.mockRejectedValue(new ApiError(503, 'weg'));
    await zeigen('leitung');
    waehle('D');
    fireEvent.click(knopf('Löschen und offline nehmen'));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Löschen und offline nehmen' }));
    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    expect(d.entferneSeiteUndOnline).not.toHaveBeenCalled();
  });

  it('„Ablehnen“ nimmt nur den Status weg – die Seite bleibt', async () => {
    await zeigen('leitung');
    waehle('D');
    fireEvent.click(knopf('Ablehnen'));
    await waitFor(() => expect(d.entferneStatus).toHaveBeenCalledWith(KAT, 'd'));
    expect(d.entferneSeiteUndOnline).not.toHaveBeenCalled();
    expect(await screen.findByText(/abgelehnt – die Seite bleibt/)).toBeTruthy();
  });

  it('online, aber Entwurf gelöscht: „Offline nehmen“ nach Rückfrage – ohne das Menü anzufassen', async () => {
    await zeigen('leitung');
    waehle('X');
    fireEvent.click(knopf('Offline nehmen'));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Offline nehmen',
      }),
    );
    await waitFor(() => expect(d.entferneSeiteUndOnline).toHaveBeenCalledWith(KAT, 'x'));
    expect(d.speichereMenue).not.toHaveBeenCalled();
  });
});

describe('Alles freigeben', () => {
  it('nimmt NUR eingereichte Seiten, Menü und Einstellungen – nie den nicht eingereichten Entwurf, nie Löschen angefragt', async () => {
    await zeigen('leitung');
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
    await zeigen('leitung');
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
    await zeigen('redakteur');
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
    await zeigen('redakteur');
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
    await zeigen('redakteur');
    waehle('C');
    expect(screen.getByText(/Bitte das Foto tauschen\./)).toBeTruthy();
  });

  it('eine andere Redakteurin sieht davon nichts (nur den ruhigen Hinweis)', async () => {
    await zeigen('redakteur', 77);
    expect(screen.queryByRole('complementary', { name: 'Freigaben' })).toBeNull();
    expect(screen.getByText(/Du hast gerade nichts eingereicht/)).toBeTruthy();
  });
});
