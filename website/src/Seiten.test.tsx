// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import type { WebsiteStand } from '@shared/website/speicher';
import { menue, seite } from '@shared/website/website.testdaten';
import * as D from './daten';
import { Seiten } from './Seiten';

vi.mock('./daten', () => ({
  ladeWebsite: vi.fn(),
  speichereSeite: vi.fn(),
  loescheSeite: vi.fn(),
  speichereMenue: vi.fn(),
}));
const d = vi.mocked(D);

const ORT = { modul: 7, kategorie: 20 };
const START = seite({ id: 's', titel: 'Willkommen', pfad: 'start', startseite: true });
const GRUPPEN = seite({
  id: 'g',
  titel: 'Unsere Gruppen',
  pfad: 'unsere-gruppen',
  startseite: false,
});
const IMPRESSUM = seite({ id: 'i', titel: 'Impressum', pfad: 'impressum', startseite: false });

const stand = (o: Partial<WebsiteStand> = {}): WebsiteStand => ({
  seiten: [START, GRUPPEN, IMPRESSUM],
  menue: menue([{ titel: 'Gruppen', ziel: { art: 'seite', seiteId: 'g' } }]),
  einstellungen: null,
  probleme: [],
  verwaist: 0,
  ...o,
});

const zeigen = () => render(<Seiten ort={ORT} gemeinde="ECG" />);

beforeEach(() => {
  d.ladeWebsite.mockResolvedValue(stand());
  d.speichereSeite.mockResolvedValue(undefined);
  d.loescheSeite.mockResolvedValue(undefined);
  d.speichereMenue.mockResolvedValue(undefined);
});

describe('Seitenliste und Vorschau', () => {
  it('zeigt „Im Menü“ und „Weitere Seiten“; die Startseite ist markiert; die Vorschau zeigt die gewählte Seite', async () => {
    zeigen();
    const liste = await screen.findByRole('complementary', { name: 'Seiten' });
    const imMenue = within(liste).getByRole('heading', { name: 'Im Menü' }).parentElement!;
    expect(within(imMenue).getByText('Unsere Gruppen')).toBeTruthy();
    const weitere = within(liste).getByRole('heading', { name: 'Weitere Seiten' }).parentElement!;
    expect(within(weitere).getByText('Impressum')).toBeTruthy();
    expect(within(weitere).getByText('Startseite')).toBeTruthy(); // die Marke neben „Willkommen“
    // Gewählt ist ohne Angabe die Startseite; ihre Vorschau steht da.
    expect(screen.getByTitle('Vorschau: Willkommen').getAttribute('sandbox')).toBe('allow-scripts');
    fireEvent.click(within(liste).getByText('Impressum'));
    expect(screen.getByTitle('Vorschau: Impressum')).toBeTruthy();
  });

  it('der Umschalter wechselt zwischen Computer und Handy', async () => {
    zeigen();
    await screen.findByTitle('Vorschau: Willkommen');
    const handy = screen.getByRole('button', { name: 'Handy' });
    fireEvent.click(handy);
    expect(handy.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Computer' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('Probleme mit gespeicherten Daten stehen sichtbar da – mit dem Satz, dass nichts gelöscht wird', async () => {
    d.ladeWebsite.mockResolvedValue(
      stand({
        probleme: [{ wert: 9, einheit: null, id: null, text: 'Der Wert 9 ist beschädigt.' }],
      }),
    );
    zeigen();
    expect(await screen.findByText('Der Wert 9 ist beschädigt.')).toBeTruthy();
    expect(screen.getByText(/niemand löscht sie/)).toBeTruthy();
  });

  it('ein Lesefehler zeigt „Erneut versuchen“ – und keine leere Seitenliste', async () => {
    d.ladeWebsite.mockRejectedValueOnce(new ApiError(503, 'weg'));
    zeigen();
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    await screen.findByTitle('Vorschau: Willkommen');
  });
});

describe('Startseite anlegen (nie von selbst)', () => {
  it('Website ohne Seite: Hinweis und Knopf – es wird NICHTS angelegt, bevor man ihn drückt', async () => {
    d.ladeWebsite.mockResolvedValue(stand({ seiten: [], menue: null }));
    zeigen();
    expect(await screen.findByText('Diese Website hat noch keine Startseite')).toBeTruthy();
    expect(d.speichereSeite).not.toHaveBeenCalled();
  });

  it('der Knopf legt die Startseite aus der Vorlage „start-schriftzug“ an und liest neu', async () => {
    d.ladeWebsite.mockResolvedValueOnce(stand({ seiten: [], menue: null }));
    zeigen();
    fireEvent.click(await screen.findByRole('button', { name: 'Startseite anlegen' }));
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(1));
    const [ort, angelegt] = d.speichereSeite.mock.calls[0];
    expect(ort).toEqual(ORT);
    expect(angelegt).toMatchObject({ titel: 'Startseite', pfad: 'start', startseite: true });
    expect(angelegt.abschnitte[0].vorlage).toBe('start-schriftzug');
    await waitFor(() => expect(d.ladeWebsite).toHaveBeenCalledTimes(2));
  });

  it('Seiten, aber keine davon Startseite: derselbe Hinweis', async () => {
    d.ladeWebsite.mockResolvedValue(stand({ seiten: [GRUPPEN] }));
    zeigen();
    expect(await screen.findByText('Diese Website hat noch keine Startseite')).toBeTruthy();
    expect(screen.getByText(/Keine der Seiten ist als Startseite festgelegt/)).toBeTruthy();
  });

  it('ein Fehler beim Anlegen steht da, es bleibt bei dem Hinweis', async () => {
    d.ladeWebsite.mockResolvedValue(stand({ seiten: [], menue: null }));
    d.speichereSeite.mockRejectedValue(new ApiError(503, 'x'));
    zeigen();
    fireEvent.click(await screen.findByRole('button', { name: 'Startseite anlegen' }));
    expect(await screen.findByText(/antwortet gerade nicht/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Startseite anlegen' })).toBeTruthy();
  });
});

describe('Neue Seite', () => {
  const fenster = () => screen.getByRole('dialog');

  async function oeffnen() {
    zeigen();
    fireEvent.click(await screen.findByRole('button', { name: 'Neue Seite' }));
    return within(fenster()).getByRole('textbox');
  }

  it('Titel eingeben: der Pfad entsteht von selbst; „Anlegen“ schreibt eine leere Seite in die Entwürfe', async () => {
    const titel = await oeffnen();
    fireEvent.change(titel, { target: { value: 'Über uns' } });
    expect(within(fenster()).getByText('/ueber-uns/')).toBeTruthy();
    fireEvent.click(within(fenster()).getByRole('button', { name: 'Anlegen' }));
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(1));
    const [ort, neu] = d.speichereSeite.mock.calls[0];
    expect(ort).toEqual(ORT);
    expect(neu).toMatchObject({ titel: 'Über uns', pfad: 'ueber-uns', abschnitte: [] });
    expect(neu.startseite).toBeUndefined();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(d.ladeWebsite).toHaveBeenCalledTimes(2);
  });

  it('ohne Titel ist „Anlegen“ gesperrt', async () => {
    await oeffnen();
    expect(within(fenster()).getByRole('button', { name: 'Anlegen' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('ein schon vergebener Pfad bekommt eine Endung', async () => {
    const titel = await oeffnen();
    fireEvent.change(titel, { target: { value: 'Impressum' } });
    expect(within(fenster()).getByText('/impressum-2/')).toBeTruthy();
  });

  it('scheitert das Speichern, bleibt das Fenster offen mit der Meldung – nichts ist verloren', async () => {
    d.speichereSeite.mockRejectedValue(new ApiError(504, 'x'));
    const titel = await oeffnen();
    fireEvent.change(titel, { target: { value: 'Jugend' } });
    fireEvent.click(within(fenster()).getByRole('button', { name: 'Anlegen' }));
    expect(await within(fenster()).findByRole('alert')).toBeTruthy();
    expect(within(fenster()).getByRole('textbox')).toHaveProperty('value', 'Jugend');
    expect(d.ladeWebsite).toHaveBeenCalledTimes(1);
  });
});

describe('Seite löschen', () => {
  async function loeschenOeffnen(titel: string) {
    zeigen();
    const liste = await screen.findByRole('complementary', { name: 'Seiten' });
    fireEvent.click(within(liste).getByText(titel));
    fireEvent.click(screen.getByRole('button', { name: 'Seite löschen' }));
    return screen.getByRole('alertdialog');
  }

  it('fragt erst nach – Abbrechen löscht nichts', async () => {
    const dialog = await loeschenOeffnen('Impressum');
    expect(within(dialog).getByText(/Impressum/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    expect(d.loescheSeite).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('eine Seite außerhalb des Menüs: nur die Seite wird gelöscht, das Menü bleibt unberührt', async () => {
    const dialog = await loeschenOeffnen('Impressum');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Löschen' }));
    await waitFor(() => expect(d.loescheSeite).toHaveBeenCalledWith(ORT, 'i'));
    expect(d.speichereMenue).not.toHaveBeenCalled();
    await waitFor(() => expect(d.ladeWebsite).toHaveBeenCalledTimes(2));
  });

  it('eine Seite im Menü: erst das Menü ohne sie speichern, DANN die Seite löschen – und der Hinweis nennt es', async () => {
    const dialog = await loeschenOeffnen('Unsere Gruppen');
    expect(within(dialog).getByText(/Der Menüpunkt zu dieser Seite wird entfernt/)).toBeTruthy();
    const reihenfolge: string[] = [];
    d.speichereMenue.mockImplementation(async () => void reihenfolge.push('menue'));
    d.loescheSeite.mockImplementation(async () => void reihenfolge.push('seite'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Löschen' }));
    await waitFor(() => expect(reihenfolge).toEqual(['menue', 'seite']));
    expect(d.speichereMenue.mock.calls[0][1]).toEqual({ eintraege: [] });
  });

  it('die Startseite zu löschen warnt, dass dann keine da ist', async () => {
    const dialog = await loeschenOeffnen('Willkommen');
    expect(within(dialog).getByText(/keine Startseite/)).toBeTruthy();
  });

  it('scheitert das Löschen, steht die Meldung im Fenster, die Seite bleibt, es wird nicht neu gelesen', async () => {
    d.loescheSeite.mockRejectedValue(new ApiError(503, 'x'));
    const dialog = await loeschenOeffnen('Impressum');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Löschen' }));
    expect(await within(screen.getByRole('alertdialog')).findByRole('alert')).toBeTruthy();
    expect(d.ladeWebsite).toHaveBeenCalledTimes(1);
  });

  it('scheitert das Speichern des Menüs, wird die Seite NICHT gelöscht', async () => {
    d.speichereMenue.mockRejectedValue(new ApiError(503, 'x'));
    const dialog = await loeschenOeffnen('Unsere Gruppen');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Löschen' }));
    await within(screen.getByRole('alertdialog')).findByRole('alert');
    expect(d.loescheSeite).not.toHaveBeenCalled();
  });
});
