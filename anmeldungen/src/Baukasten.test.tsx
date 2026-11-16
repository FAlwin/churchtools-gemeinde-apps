// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';
import { fensterKnoepfe } from '@ui/fenster/fenster.testutil';
import { vorlageVon } from '@shared/anmeldung/gestaltung';
import { geburtsdatumAn, type OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import type { Bedingung } from '@shared/anmeldung/bedingungen';
import * as FF from './formularFelder';
import * as EI from './einrichten';
import { ApiError } from '@ui/ct/fehler';
import { Baukasten } from './Baukasten';
import { _blickVergessen } from './baukastenBlick';
import { RegelListe } from './RegelListe';
import { PAUSE_DESIGN_MS, PAUSE_FELD_MS } from './useEntwurf';
import { fehlerMeldung } from './zustand';

vi.mock('./formularFelder', () => ({
  feldSpeichern: vi.fn(),
  feldTypAendern: vi.fn(),
  feldEntfernen: vi.fn(),
  feldEinordnen: vi.fn(),
  regelSpeichern: vi.fn(),
  ctFelderLesen: vi.fn(),
  antwortenZaehlen: vi.fn(),
}));
vi.mock('./einrichten', async (original) => ({
  ...(await original<typeof import('./einrichten')>()),
  aendereEinstellungen: vi.fn(),
  bildHochladen: vi.fn(),
  bildEntfernen: vi.fn(),
  umbenennen: vi.fn(),
  gemeindeLogo: vi.fn(),
  logoListe: vi.fn(),
  logoHochladen: vi.fn(),
  logoEntfernen: vi.fn(),
  istGruppenAdmin: vi.fn(),
}));
const ff = vi.mocked(FF);
const ei = vi.mocked(EI);

/** Kinder-Event mit einer eigenen Auswahl „Gruppe“ (Spalte 501, Antworten mit IDs 11/12). */
function einstellungen(): OeffentlicheEinstellungen {
  const e = neueEinstellungen('kinder');
  e.formular.person.push({
    id: 'f1',
    art: 'eigen',
    typ: 'radio',
    frage: 'Gruppe',
    hilfe: '',
    zustand: 'freiwillig',
    antworten: ['Minis', 'Kids'],
  });
  e.ctFelder = { ...e.ctFelder, f1: 501 };
  return e;
}

function zeigen(e = einstellungen(), darf = true) {
  const gespeichert = vi.fn();
  const r = render(
    <Baukasten
      id={91}
      name="Kindertag"
      gemeinde="ECG Donrath"
      einstellungen={e}
      bildUrl={null}
      darf={darf}
      heute="2026-10-13"
      onGespeichert={gespeichert}
    />,
  );
  const huelle = (feldId: string) => r.container.querySelector(`[data-feld="${feldId}"]`)!;
  return { gespeichert, huelle, ...r };
}

const dt = () => ({ setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: '' });

/** jsdom gibt `clientY` an Zieh-Ereignisse nicht weiter (kein DragEvent) – hier von Hand. */
function mitY(typ: 'dragOver' | 'drop' | 'dragEnter', el: Element, y: number) {
  const ev = createEvent[typ](el);
  Object.defineProperty(ev, 'clientY', { value: y });
  fireEvent(el, ev);
}

/**
 * jsdom kennt keine Maße: Jedes Feld bekommt einen Platz (100 px hoch, untereinander), die Bühne beginnt bei 0.
 * Gibt zurück, wo die obere bzw. untere Hälfte eines Felds liegt.
 */
function lage(container: HTMLElement) {
  const felder = [...container.querySelectorAll<HTMLElement>('[data-feld]')];
  felder.forEach((el, i) => {
    el.getBoundingClientRect = () =>
      ({ top: 100 + i * 100, bottom: 180 + i * 100, height: 80 }) as DOMRect;
  });
  return (id: string, wo: 'oben' | 'unten') => {
    const i = felder.findIndex((el) => el.dataset.feld === id);
    return 100 + i * 100 + (wo === 'oben' ? 10 : 70);
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  _blickVergessen();
  ff.feldSpeichern.mockResolvedValue({} as never);
  ff.feldEntfernen.mockResolvedValue({ art: 'geloescht' });
  ff.feldEinordnen.mockResolvedValue(undefined);
  ff.regelSpeichern.mockResolvedValue(undefined);
  ff.ctFelderLesen.mockResolvedValue(
    new Map([
      [
        501,
        {
          id: 501,
          name: 'Gruppe',
          options: [
            { id: 11, name: 'Minis' },
            { id: 12, name: 'Kids' },
          ],
        },
      ],
    ]),
  );
  ff.antwortenZaehlen.mockResolvedValue(new Map());
  ei.aendereEinstellungen.mockResolvedValue({} as never);
  ei.gemeindeLogo.mockResolvedValue(null);
  ei.logoListe.mockResolvedValue([]);
  ei.istGruppenAdmin.mockResolvedValue(false);
});
afterEach(() => vi.useRealTimers());

describe('Baukasten (A5): Bausteine ins Formular', () => {
  it('antippen ohne gewähltes Feld → ans Ende von „Jedes Kind“, neue Kennung, gleich bearbeitbar', async () => {
    const { gespeichert } = zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Kurzer Text' }));
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalled());
    const [id, bereich, feld, antworten, vorId] = ff.feldSpeichern.mock.calls[0];
    expect([id, bereich, antworten, vorId]).toEqual([91, 'person', undefined, null]);
    expect(feld).toMatchObject({ id: 'f2', art: 'eigen', typ: 'text', frage: 'Neue Frage' });
    expect(screen.getByLabelText('Frage')).toHaveProperty('value', 'Neue Frage');
    await waitFor(() =>
      expect(gespeichert).toHaveBeenCalledWith('„Kurzer Text“ hinzugefügt.', true),
    );
  });

  it('antippen mit gewähltem Feld → gleich darunter', async () => {
    const { huelle } = zeigen();
    fireEvent.click(huelle('allergy'));
    fireEvent.click(screen.getByRole('button', { name: 'Ja / Nein' }));
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalled());
    const [, bereich, , , vorId] = ff.feldSpeichern.mock.calls[0];
    expect([bereich, vorId]).toEqual(['person', 'foto']);
  });

  it('empfohlene Bausteine: was schon im Formular ist, ist ausgegraut; Anschrift kommt in den Kontakt', async () => {
    zeigen();
    expect(screen.getByRole('button', { name: 'Telefon' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Telefon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Anschrift' }));
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalledTimes(1));
    const [, bereich, feld] = ff.feldSpeichern.mock.calls[0];
    expect(bereich).toBe('anmeldung');
    expect(feld).toMatchObject({ id: 'addr', art: 'standard', zustand: 'freiwillig' });
  });

  it('ziehen: über der oberen Hälfte eines Felds → davor, über der unteren → danach', async () => {
    const { huelle, container } = zeigen();
    const y = lage(container);
    fireEvent.dragStart(screen.getByRole('button', { name: 'Datum' }), { dataTransfer: dt() });
    mitY('dragOver', huelle('allergy'), y('allergy', 'unten'));
    mitY('drop', huelle('allergy'), y('allergy', 'unten'));
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalled());
    const [, bereich, feld, , vorId] = ff.feldSpeichern.mock.calls[0];
    expect([bereich, vorId]).toEqual(['person', 'foto']);
    expect(feld).toMatchObject({ typ: 'date' });
  });

  it('die Lücke öffnet sich an der Stelle; dort loslassen legt dort ab', async () => {
    const { huelle, container } = zeigen();
    const y = lage(container);
    fireEvent.dragStart(screen.getByRole('button', { name: 'Zahl' }), { dataTransfer: dt() });
    mitY('dragOver', huelle('foto'), y('foto', 'oben'));
    const luecke = screen.getByText('Hier loslassen');
    expect(luecke.nextElementSibling?.getAttribute('data-feld')).toBe('foto');
    mitY('drop', luecke, y('foto', 'oben'));
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalled());
    expect(ff.feldSpeichern.mock.calls[0][4]).toBe('foto');
    expect(screen.queryByText('Hier loslassen')).toBeNull();
  });

  it('die Lücke springt nicht: gerechnet wird mit den Plätzen vom Start, nicht mit verschobenen Feldern', () => {
    const { huelle, container } = zeigen();
    const y = lage(container);
    fireEvent.dragStart(screen.getByRole('button', { name: 'Zahl' }), { dataTransfer: dt() });
    mitY('dragOver', huelle('allergy'), y('allergy', 'oben'));
    // Jetzt stehen die Felder im Browser woanders (die Lücke schiebt sie) – die Stelle bleibt dieselbe.
    for (const el of container.querySelectorAll<HTMLElement>('[data-feld]'))
      el.getBoundingClientRect = () => ({ top: 5000, bottom: 5080, height: 80 }) as DOMRect;
    mitY('dragOver', huelle('allergy'), y('allergy', 'oben'));
    expect(screen.getByText('Hier loslassen').nextElementSibling?.getAttribute('data-feld')).toBe(
      'allergy',
    );
  });

  it('zwischen zwei Bereichen entscheidet die Nähe; ganz unten im Kontakt = unter den Bemerkungen', async () => {
    const { huelle, container } = zeigen();
    const y = lage(container);
    fireEvent.dragStart(screen.getByRole('button', { name: 'Zahl' }), { dataTransfer: dt() });
    // Knapp unter dem letzten Feld des Kontakts (Bemerkungen) → ganz unten im Kontakt.
    mitY('dragOver', huelle('note'), y('note', 'unten') + 15);
    mitY('drop', huelle('note'), y('note', 'unten') + 15);
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalled());
    // „ganz unten“ = vor Preis/Datenschutz, also unter die Bemerkungen.
    expect(ff.feldSpeichern.mock.calls[0].slice(1, 2)).toEqual(['anmeldung']);
    expect(ff.feldSpeichern.mock.calls[0][4]).toBe('price');
  });

  it('ein vorhandenes Feld ist ganz greifbar; beim Ziehen steht an seiner Stelle nur die Lücke – erst nach dem Start', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { huelle, container } = zeigen();
    lage(container);
    expect(huelle('allergy').getAttribute('draggable')).toBe('true');
    fireEvent.dragStart(huelle('allergy'), { dataTransfer: dt() });
    // Während `dragstart` ändert sich nichts – Ausblenden in dem Moment bricht das Ziehen in Chrome ab.
    expect(huelle('allergy').className).not.toMatch(/wirdGezogen/);
    expect(screen.queryByText('Hier loslassen')).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(10);
    });
    expect(huelle('allergy').className).toMatch(/wirdGezogen/);
    expect(screen.getByText('Hier loslassen').nextElementSibling?.getAttribute('data-feld')).toBe(
      'allergy',
    );
    // Dort losgelassen → nichts verschoben.
    fireEvent.drop(huelle('allergy'));
    expect(ff.feldEinordnen).not.toHaveBeenCalled();
  });

  it('abgelegt wird, wo losgelassen wird – auch ohne vorheriges „dragover“', async () => {
    const { huelle, container } = zeigen();
    const y = lage(container);
    fireEvent.dragStart(screen.getByRole('button', { name: 'Zahl' }), { dataTransfer: dt() });
    mitY('drop', huelle('birth'), y('birth', 'unten'));
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalled());
    expect(ff.feldSpeichern.mock.calls[0][4]).toBe('allergy');
  });

  it('vorhandenes Feld in den anderen Bereich ziehen → nur verschoben; beim Start springt nichts', async () => {
    const { huelle, container } = zeigen();
    const y = lage(container);
    const vorher = container.innerHTML.length;
    fireEvent.dragStart(huelle('f1'), { dataTransfer: dt() });
    expect(screen.queryByText('Hier loslassen')).toBeNull();
    expect(Math.abs(container.innerHTML.length - vorher)).toBeLessThan(80);
    // Obere Hälfte der Bemerkungen = vor die Bemerkungen.
    mitY('dragOver', huelle('note'), y('note', 'oben'));
    mitY('drop', huelle('note'), y('note', 'oben'));
    await waitFor(() =>
      expect(ff.feldEinordnen).toHaveBeenCalledWith(91, 'f1', 'anmeldung', 'note'),
    );
    expect(ff.feldSpeichern).not.toHaveBeenCalled();
  });

  it('am Rand der Bühne wird beim Ziehen mitgescrollt', () => {
    const { huelle, container } = zeigen();
    lage(container);
    const scroll = vi.fn();
    (document.scrollingElement ?? document.documentElement).scrollBy = scroll;
    fireEvent.dragStart(screen.getByRole('button', { name: 'Zahl' }), { dataTransfer: dt() });
    mitY('dragOver', huelle('name'), window.innerHeight - 10);
    expect(scroll).toHaveBeenCalledWith(0, expect.any(Number));
    expect(scroll.mock.calls[0][1]).toBeGreaterThan(0);
  });

  it('Pfeile verschieben ohne Ziehen (Handy, Tastatur) – nur am gewählten Feld, nicht schon beim Darüberfahren', async () => {
    const { huelle } = zeigen();
    expect(screen.queryByRole('button', { name: 'Gruppe nach oben' })).toBeNull();
    fireEvent.click(huelle('f1'));
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe nach oben' }));
    await waitFor(() => expect(ff.feldEinordnen).toHaveBeenCalledWith(91, 'f1', 'person', 'foto'));
    expect(screen.getByRole('button', { name: 'Gruppe nach unten' })).toHaveProperty(
      'disabled',
      false,
    );
  });
});

describe('Baukasten (#845, 4b-1): Ziehen abbrechen, Gleiten, Knöpfe am Feld', () => {
  it('Ziehen abgebrochen (Esc, außerhalb losgelassen) → die Lücke verschwindet, nichts wird abgelegt', () => {
    const { huelle, container } = zeigen();
    const y = lage(container);
    fireEvent.dragStart(screen.getByRole('button', { name: 'Zahl' }), { dataTransfer: dt() });
    mitY('dragOver', huelle('allergy'), y('allergy', 'oben'));
    expect(screen.getByText('Hier loslassen')).toBeTruthy();
    fireEvent.dragEnd(screen.getByRole('button', { name: 'Zahl' }));
    expect(screen.queryByText('Hier loslassen')).toBeNull();
    mitY('drop', huelle('allergy'), y('allergy', 'oben'));
    expect(ff.feldSpeichern).not.toHaveBeenCalled();
  });

  it('wandert die Lücke, gleiten die Felder von ihrem alten Platz zum neuen', () => {
    const animate = vi.fn();
    Element.prototype.animate = animate;
    try {
      const { huelle, container } = zeigen();
      const y = lage(container);
      fireEvent.dragStart(screen.getByRole('button', { name: 'Zahl' }), { dataTransfer: dt() });
      // Die Lücke über „allergy“ schiebt die Felder darunter um 50 px nach unten.
      const alt = huelle('note').getBoundingClientRect();
      huelle('note').getBoundingClientRect = () =>
        ({ top: alt.top + 50, bottom: alt.bottom + 50, height: 80 }) as DOMRect;
      mitY('dragOver', huelle('allergy'), y('allergy', 'oben'));
      const fuerNote = animate.mock.contexts.indexOf(huelle('note'));
      expect(fuerNote).toBeGreaterThanOrEqual(0);
      expect(animate.mock.calls[fuerNote][0]).toEqual([
        { transform: 'translateY(-50px)' },
        { transform: 'none' },
      ]);
      // Was nicht gewandert ist, gleitet nicht.
      expect(animate.mock.contexts).not.toContain(huelle('allergy'));
    } finally {
      delete (Element.prototype as Partial<Element>).animate;
    }
  });

  it('Pfeile am Rand gesperrt: das erste Feld nicht nach oben, das letzte nicht nach unten', () => {
    const { huelle, container } = zeigen();
    fireEvent.click(huelle('f1'));
    expect(screen.getByRole('button', { name: 'Gruppe nach unten' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', { name: 'Gruppe nach oben' })).toHaveProperty(
      'disabled',
      false,
    );
    const erstes = container.querySelector<HTMLElement>('[data-bereich="person"]')!;
    fireEvent.click(erstes);
    const oben = within(erstes).getByRole('button', { name: / nach oben$/ });
    expect(oben).toHaveProperty('disabled', true);
    expect(within(erstes).getByRole('button', { name: / nach unten$/ })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('nach unten: ans Ende des Bereichs, wenn es das vorletzte Feld war', async () => {
    const { huelle } = zeigen();
    fireEvent.click(huelle('f1'));
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe nach oben' }));
    await waitFor(() => expect(ff.feldEinordnen).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe nach unten' }));
    await waitFor(() => expect(ff.feldEinordnen).toHaveBeenCalledTimes(2));
    expect(ff.feldEinordnen.mock.calls[1]).toEqual([91, 'f1', 'person', null]);
  });

  it('kopieren: ein eigenes Feld als „(Kopie)“ gleich darunter', async () => {
    const { huelle } = zeigen();
    fireEvent.click(huelle('f1'));
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe kopieren' }));
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalled());
    const [, bereich, feld] = ff.feldSpeichern.mock.calls[0];
    expect(bereich).toBe('person');
    expect(feld).toMatchObject({
      art: 'eigen',
      typ: 'radio',
      frage: 'Gruppe (Kopie)',
      antworten: ['Minis', 'Kids'],
    });
    expect(feld.id).not.toBe('f1');
  });
});

describe('Baukasten (A5): direkt im Feld bearbeiten', () => {
  it('nach einer Pause beim Tippen gespeichert – vorher nicht; die IDs der Antworten gehen mit', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { huelle } = zeigen();
    fireEvent.click(huelle('f1'));
    await waitFor(() => expect(ff.ctFelderLesen).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Frage'), { target: { value: 'Welche Gruppe?' } });
    fireEvent.change(screen.getByLabelText('Antwort 1'), { target: { value: 'Kleine' } });
    await act(async () => {
      vi.advanceTimersByTime(PAUSE_FELD_MS - 1);
    });
    expect(ff.feldSpeichern).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalled());
    const [, bereich, feld, antworten] = ff.feldSpeichern.mock.calls[0];
    expect(bereich).toBe('person');
    expect(feld).toMatchObject({ frage: 'Welche Gruppe?', antworten: ['Kleine', 'Kids'] });
    expect(antworten).toEqual([
      // `von`: der Name beim Laden – daran ziehen die Bedingungen mit (F1c).
      { text: 'Kleine', altId: '11', von: 'Minis' },
      { text: 'Kids', altId: '12', von: 'Kids' },
    ]);
  });

  it('umbenannt, bevor die IDs da sind → die ID kommt trotzdem an die richtige Antwort', async () => {
    let laden!: (m: Awaited<ReturnType<typeof FF.ctFelderLesen>>) => void;
    ff.ctFelderLesen.mockReturnValue(new Promise((r) => (laden = r)));
    const { huelle } = zeigen();
    fireEvent.click(huelle('f1'));
    fireEvent.change(screen.getByLabelText('Antwort 2'), { target: { value: 'Große' } });
    await act(async () =>
      laden(
        new Map([
          [
            501,
            {
              id: 501,
              name: 'Gruppe',
              options: [
                { id: 11, name: 'Minis' },
                { id: 12, name: 'Kids' },
              ],
            },
          ],
        ]),
      ),
    );
    fireEvent.click(huelle('allergy'));
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalled());
    expect(ff.feldSpeichern.mock.calls[0][3]).toEqual([
      { text: 'Minis', altId: '11', von: 'Minis' },
      { text: 'Große', altId: '12', von: 'Kids' },
    ]);
  });

  it('ein anderes Feld wählen speichert sofort', async () => {
    const { huelle } = zeigen();
    fireEvent.click(huelle('tel'));
    fireEvent.change(screen.getByLabelText('Hilfetext'), { target: { value: 'für Notfälle' } });
    fireEvent.click(huelle('f1'));
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalled());
    expect(ff.feldSpeichern.mock.calls[0][2]).toMatchObject({ id: 'tel', hilfe: 'für Notfälle' });
  });

  it('ohne Frage wird nicht gespeichert – mit Hinweis', async () => {
    const { huelle } = zeigen();
    fireEvent.click(huelle('f1'));
    fireEvent.change(screen.getByLabelText('Frage'), { target: { value: '  ' } });
    fireEvent.click(huelle('allergy'));
    expect(await screen.findByText('Nicht gespeichert: Bitte eine Frage eintragen.')).toBeTruthy();
    expect(ff.feldSpeichern).not.toHaveBeenCalled();
  });

  it('gespeichert wird ohne Leerzeichen am Rand – Frage und Antworten', async () => {
    const { huelle } = zeigen();
    fireEvent.click(huelle('f1'));
    fireEvent.change(screen.getByLabelText('Frage'), { target: { value: '  Welche Gruppe?  ' } });
    fireEvent.change(screen.getByLabelText('Antwort 1'), { target: { value: ' Kleine ' } });
    fireEvent.click(huelle('allergy'));
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalled());
    expect(ff.feldSpeichern.mock.calls[0][2]).toMatchObject({
      frage: 'Welche Gruppe?',
      antworten: ['Kleine', 'Kids'],
    });
  });

  it('beim Verlassen des Baukastens wird das angefangene Feld gleich gespeichert', async () => {
    vi.useFakeTimers();
    const { huelle, unmount } = zeigen();
    fireEvent.click(huelle('f1'));
    fireEvent.change(screen.getByLabelText('Frage'), { target: { value: 'Welche Gruppe?' } });
    unmount();
    // Vor Ablauf der Pause – gespeichert hat das Verlassen, nicht die Uhr.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAUSE_FELD_MS - 1);
    });
    expect(ff.feldSpeichern).toHaveBeenCalledTimes(1);
    expect(ff.feldSpeichern.mock.calls[0][2]).toMatchObject({ frage: 'Welche Gruppe?' });
  });

  it('ein gewähltes Vorlagen-Feld entfernen → weg und nicht mehr gewählt (taucht nicht wieder auf)', async () => {
    ff.feldEntfernen.mockResolvedValue({ art: 'ausgeblendet', antworten: 0 });
    const { huelle } = zeigen();
    fireEvent.click(huelle('allergy'));
    expect(screen.getByLabelText('Frage')).toBeTruthy();
    fireEvent.click(
      within(huelle('allergy') as HTMLElement).getByRole('button', { name: / entfernen$/ }),
    );
    await waitFor(() => expect(ff.feldEntfernen).toHaveBeenCalledWith(91, 'allergy'));
    expect(huelle('allergy')).toBeNull();
    expect(screen.queryByLabelText('Frage')).toBeNull();
    expect(ff.feldSpeichern).not.toHaveBeenCalled();
  });

  it('entfernen: die Meldung sagt, was passiert ist (Antworten bleiben)', async () => {
    ff.feldEntfernen.mockResolvedValue({ art: 'ausgeblendet', antworten: 3 });
    const { gespeichert, huelle } = zeigen();
    fireEvent.click(huelle('f1'));
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe entfernen' }));
    await waitFor(() => expect(ff.feldEntfernen).toHaveBeenCalledWith(91, 'f1'));
    await waitFor(() =>
      expect(gespeichert).toHaveBeenCalledWith(
        '„Gruppe“ ausgeblendet – die 3 Antworten bleiben in ChurchTools.',
        true,
      ),
    );
  });

  it('gewähltes Feld: Werkzeug unten im Feld statt über dem Text', () => {
    const { huelle } = zeigen();
    fireEvent.click(huelle('f1'));
    const knopf = screen.getByRole('button', { name: 'Gruppe entfernen' });
    expect(knopf.closest('[class*="werkzeugUnten"]')).toBeTruthy();
  });

  it('Name und E-Mail: verschieben ja, entfernen und bearbeiten nein; Datenschutz bleibt ganz, wo er ist', () => {
    const { huelle } = zeigen();
    expect(screen.queryByRole('button', { name: 'E-Mail nach oben' })).toBeNull();
    // Gewählt: nur verschieben – nicht bearbeiten, nicht entfernen.
    fireEvent.click(huelle('mail'));
    expect(screen.getByRole('button', { name: 'E-Mail nach oben' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'E-Mail entfernen' })).toBeNull();
    expect(screen.queryByLabelText('Frage')).toBeNull();
    expect(huelle('mail').textContent).toContain('gehört immer dazu');
    // Keine Werkzeuge – nur das ⓘ „Woher kommt das?“.
    expect(
      [...huelle('priv').querySelectorAll('button')].map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Woher kommt das?']);
    expect(huelle('priv').getAttribute('draggable')).toBe('false');
  });
});

describe('Baukasten: Woher kommt was (Entwurf v5, 14.10.2026)', () => {
  it('ⓘ nur an Pflicht- und Herkunfts-Stellen; Antippen klappt den Grund auf und wieder zu, ohne das Feld zu wählen', () => {
    const { huelle, container } = zeigen();
    const orte = [...container.querySelectorAll<HTMLElement>('[data-hinweis]')].map(
      (el) => el.dataset.hinweis,
    );
    // Die Kinder-Vorlage fragt das Geburtsdatum ab – es kommt aus „Wer meldet sich an?“.
    expect(orte).toEqual(['kontakt', 'name', 'mail', 'teil', 'pname', 'birth', 'priv']);
    // Ein ⓘ im (inerten) Feld: Der Tipp landet bei der Hülle.
    fireEvent.click(huelle('mail').querySelector('[data-hinweis]')!);
    expect(screen.getByRole('note').textContent).toMatch(/schickt ChurchTools die Bestätigung/);
    expect(screen.queryByLabelText('Frage')).toBeNull();
    fireEvent.click(huelle('mail').querySelector('[data-hinweis]')!);
    expect(screen.queryByRole('note')).toBeNull();
    // Am Bereich: nennt die Einstellung und den Knopf „+ Weiteres Kind“.
    fireEvent.click(container.querySelector('[data-hinweis="teil"]')!);
    expect(screen.getByRole('note').textContent).toMatch(/hier: Nur Kinder.*Weiteres Kind/);
  });

  it('im Browser ist der Feldinhalt inert: Der Tipp landet bei der Hülle und trifft das ⓘ an seiner Stelle', () => {
    const { huelle } = zeigen();
    const i = huelle('mail').querySelector<HTMLElement>('[data-hinweis]')!;
    i.getBoundingClientRect = () =>
      ({ left: 100, right: 120, top: 50, bottom: 70, width: 20, height: 20 }) as DOMRect;
    fireEvent.click(huelle('mail'), { clientX: 300, clientY: 60 });
    expect(screen.queryByRole('note')).toBeNull();
    fireEvent.click(huelle('mail'), { clientX: 110, clientY: 60 });
    expect(screen.getByRole('note').textContent).toMatch(/schickt ChurchTools die Bestätigung/);
  });

  it('das ⓘ hängt am letzten Wort der Überschrift (rutscht am Handy nicht allein in eine neue Zeile)', () => {
    const { container } = zeigen();
    expect(container.querySelector('[data-hinweis="teil"]')!.parentElement!.textContent).toBe(
      'an?',
    );
  });

  it('der Personen-Teil sagt im Baukasten, dass er sich wiederholt', () => {
    zeigen();
    expect(screen.getByText('wiederholt sich für jedes Kind')).toBeTruthy();
  });

  it('ein normales Feld antippen wählt es weiter aus (kein ⓘ dort)', () => {
    const { huelle } = zeigen();
    expect(huelle('allergy').querySelector('[data-hinweis]')).toBeNull();
    fireEvent.click(huelle('allergy'));
    expect(screen.getByLabelText('Frage')).toBeTruthy();
  });

  it('„Wer meldet sich an?“ in der Leiste: Formular ändert sich sofort, gespeichert wie im Reiter', async () => {
    const { container } = zeigen();
    const leiste = screen.getByRole('complementary', { name: 'Bausteine und Design' });
    fireEvent.click(within(leiste).getByRole('button', { name: /^Einzelpersonen/ }));
    expect(screen.queryByText(/Weiteres Kind|Weitere Person/)).toBeNull();
    // Die Kinder-Vorlage fragt es ab – ausschalten.
    expect(container.querySelector('[data-feld="birth"]')).toBeTruthy();
    fireEvent.click(within(leiste).getByRole('button', { name: /Geburtsdatum abfragen/ }));
    expect(container.querySelector('[data-feld="birth"]')).toBeNull();
    await waitFor(() => expect(ei.aendereEinstellungen).toHaveBeenCalledTimes(2));
    const zuletzt = ei.aendereEinstellungen.mock.calls[1][1](neueEinstellungen('kinder'));
    expect(zuletzt.wer).toBe('einzeln');
    expect(geburtsdatumAn(zuletzt.formular)).toBe(false);
  });

  it('Preise nach Alter, Geburtsdatum aus → Warnung in der Leiste', () => {
    const e = einstellungen();
    e.preis = { ...e.preis, alter: [{ von: 0, bis: 2, art: 'frei', wert: 0 }] };
    zeigen(e);
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Geburtsdatum abfragen/ }));
    expect(screen.getByRole('alert').textContent).toMatch(/Es gibt Preise nach Alter/);
  });
});

describe('Baukasten am Handy (Entwurf v6, 14.10.2026): antippen statt ziehen', () => {
  const finger = (an: boolean) =>
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: an && q === '(pointer: coarse)' }));
  afterEach(() => vi.unstubAllGlobals());

  it('mit dem Finger lässt sich nichts ziehen – weder Felder noch Bausteine; Antippen setzt unter das gewählte Feld', async () => {
    finger(true);
    const { huelle } = zeigen();
    expect(huelle('allergy').getAttribute('draggable')).toBe('false');
    expect(screen.getByRole('button', { name: 'Ja / Nein' }).getAttribute('draggable')).toBe(
      'false',
    );
    fireEvent.click(huelle('allergy'));
    fireEvent.click(screen.getByRole('button', { name: 'Ja / Nein' }));
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalled());
    expect(ff.feldSpeichern.mock.calls[0][4]).toBe('foto');
  });

  it('mit Maus bleibt Ziehen', () => {
    finger(false);
    const { huelle } = zeigen();
    expect(huelle('allergy').getAttribute('draggable')).toBe('true');
    expect(screen.getByRole('button', { name: 'Ja / Nein' }).getAttribute('draggable')).toBe(
      'true',
    );
  });
});

describe('Baukasten (A5): Speichern eins nach dem anderen', () => {
  it('das zweite Speichern beginnt erst, wenn das erste fertig ist', async () => {
    let fertig!: () => void;
    ff.feldSpeichern.mockReturnValueOnce(new Promise((r) => (fertig = () => r({} as never))));
    const { huelle } = zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Kurzer Text' }));
    fireEvent.click(huelle('f1'));
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe nach oben' }));
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalled());
    expect(ff.feldEinordnen).not.toHaveBeenCalled();
    expect(screen.getByText('Wird gespeichert …')).toBeTruthy();
    await act(async () => fertig());
    await waitFor(() => expect(ff.feldEinordnen).toHaveBeenCalled());
  });

  it('ein Fehler wird gezeigt; „Nochmal“ wiederholt genau diese Aufgabe', async () => {
    const fehler = new ApiError(504, 'Zeitüberschreitung');
    ff.feldEinordnen.mockRejectedValueOnce(fehler);
    const { huelle } = zeigen();
    fireEvent.click(huelle('f1'));
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe nach oben' }));
    const meldung = await screen.findByRole('alert');
    expect(meldung.textContent).toContain(fehlerMeldung(fehler).text);
    fireEvent.click(screen.getByRole('button', { name: 'Nochmal' }));
    await waitFor(() => expect(ff.feldEinordnen).toHaveBeenCalledTimes(2));
    expect(ff.feldEinordnen.mock.calls[1]).toEqual(ff.feldEinordnen.mock.calls[0]);
  });
});

describe('Baukasten (A5): Design', () => {
  it('mehrere Änderungen kurz hintereinander → EIN Speichern mit allen', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    zeigen();
    const leiste = screen.getByRole('complementary', { name: 'Bausteine und Design' });
    fireEvent.click(within(leiste).getByRole('button', { name: 'Design' }));
    fireEvent.click(screen.getByRole('button', { name: /^Klassisch.*Kopfband/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Beere' }));
    await act(async () => {
      vi.advanceTimersByTime(PAUSE_DESIGN_MS - 1);
    });
    expect(ei.aendereEinstellungen).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    await waitFor(() => expect(ei.aendereEinstellungen).toHaveBeenCalledTimes(1));
    const aendern = ei.aendereEinstellungen.mock.calls[0][1];
    const neu = aendern(neueEinstellungen('kinder'));
    expect(neu.gestaltung).toMatchObject({
      ...vorlageVon('klassisch').werte,
      vorlage: 'klassisch',
      farbe: '#a3245c',
    });
  });

  it('Begrüßungstext direkt im Formular; beim Verlassen sofort gespeichert', async () => {
    zeigen();
    const text = screen.getByLabelText('Begrüßungstext');
    fireEvent.change(text, { target: { value: 'Herzlich willkommen!' } });
    fireEvent.blur(text);
    await waitFor(() => expect(ei.aendereEinstellungen).toHaveBeenCalledTimes(1));
    expect(
      ei.aendereEinstellungen.mock.calls[0][1](neueEinstellungen('kinder')).gestaltung.text,
    ).toBe('Herzlich willkommen!');
  });

  it('beim Verlassen des Baukastens wird ein wartendes Design gleich gespeichert', async () => {
    vi.useFakeTimers();
    const { unmount } = zeigen();
    const leiste = screen.getByRole('complementary', { name: 'Bausteine und Design' });
    fireEvent.click(within(leiste).getByRole('button', { name: 'Design' }));
    fireEvent.click(screen.getByRole('button', { name: 'Beere' }));
    expect(ei.aendereEinstellungen).not.toHaveBeenCalled();
    unmount();
    // Vor Ablauf der Pause – gespeichert hat das Verlassen, nicht die Uhr.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAUSE_DESIGN_MS - 1);
    });
    expect(ei.aendereEinstellungen).toHaveBeenCalledTimes(1);
    expect(
      ei.aendereEinstellungen.mock.calls[0][1](neueEinstellungen('kinder')).gestaltung.farbe,
    ).toBe('#a3245c');
  });

  it('kommt ein neuer Stand, während das Design noch wartet, bleibt der Zwischenstand stehen', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { rerender } = zeigen();
    fireEvent.change(screen.getByLabelText('Begrüßungstext'), { target: { value: 'Hallo!' } });
    rerender(
      <Baukasten
        id={91}
        name="Kindertag"
        gemeinde="ECG Donrath"
        einstellungen={einstellungen()}
        bildUrl={null}
        darf
        heute="2026-10-13"
        onGespeichert={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Begrüßungstext')).toHaveProperty('value', 'Hallo!');
  });

  it('Name direkt im Kopf ändern → umbenannt', async () => {
    ei.umbenennen.mockResolvedValue(undefined);
    zeigen();
    const name = screen.getByLabelText('Name der Veranstaltung');
    fireEvent.change(name, { target: { value: 'Kinderfest' } });
    fireEvent.blur(name);
    await waitFor(() => expect(ei.umbenennen).toHaveBeenCalledWith(91, 'Kinderfest'));
    // Mehrzeilig, damit lange Namen umbrechen; Enter speichert statt eine neue Zeile zu machen.
    expect(name.tagName).toBe('TEXTAREA');
    fireEvent.change(name, { target: { value: 'Kinder\nfest' } });
    expect(name).toHaveProperty('value', 'Kinder fest');
  });

  it('Titelbild ist nicht umkehrbar (kein „Rückgängig“)', async () => {
    ei.bildHochladen.mockResolvedValue('https://ct.test/bild.png');
    const { gespeichert } = zeigen();
    const datei = new File(['x'], 'b.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Titelbild hochladen'), { target: { files: [datei] } });
    await waitFor(() => expect(gespeichert).toHaveBeenCalledWith('Titelbild hochgeladen.', false));
  });
});

describe('Baukasten (A5): Ansichten', () => {
  it('ohne Recht: nur das Formular, keine Bausteine, keine Hüllen', () => {
    const { container } = zeigen(einstellungen(), false);
    expect(screen.queryByRole('button', { name: 'Kurzer Text' })).toBeNull();
    expect(container.querySelector('[data-feld]')).toBeNull();
    expect(screen.getByText('Nur die Leitung kann das Formular ändern.')).toBeTruthy();
  });

  it('Vorschau: ohne Leiste, Formular zum Ausprobieren', () => {
    const { container } = zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau' }));
    expect(screen.queryByRole('complementary', { name: 'Bausteine und Design' })).toBeNull();
    expect(container.querySelector('[data-feld]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Verbindlich anmelden' })).toBeTruthy();
  });
});

describe('Baukasten (Feinheiten): Leiste, Fragetyp, Design', () => {
  it('Gruppen klappen ein und aus; Zahlen; was schon drin ist, hat einen Haken', () => {
    const { container } = zeigen();
    const kopf = screen.getByRole('button', { name: /Eigene Fragen/ });
    expect(kopf.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(kopf);
    expect(kopf.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Kurzer Text' })).toBeNull();
    expect(screen.getByRole('button', { name: /Empfohlen/ }).textContent).toMatch(
      // Kinder-Vorlage: seit A6-2b mit Erziehungsberechtigten und Unterschrift.
      /7 von 10 im Formular/,
    );
    const telefon = screen.getByRole('button', { name: 'Telefon' });
    expect(telefon.querySelector('[class*="haken"]')).toBeTruthy();
    expect(container.querySelector('[class*="haken"]')).toBeTruthy();
  });

  it('Fragetyp ändern: mit allem, was gerade am Feld steht; Antworten bleiben', async () => {
    ff.feldTypAendern.mockResolvedValue({} as never);
    const { huelle } = zeigen();
    fireEvent.click(huelle('f1'));
    await waitFor(() => expect(ff.antwortenZaehlen).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Frage'), { target: { value: 'Gruppe?' } });
    fireEvent.change(screen.getByLabelText('Fragetyp'), { target: { value: 'select' } });
    await waitFor(() => expect(ff.feldTypAendern).toHaveBeenCalled());
    expect(ff.feldTypAendern.mock.calls[0][1]).toMatchObject({
      id: 'f1',
      typ: 'select',
      frage: 'Gruppe?',
      antworten: ['Minis', 'Kids'],
    });
    // Das Tippen davor wird nicht zusätzlich gespeichert – der Typwechsel nimmt es mit.
    expect(ff.feldSpeichern).not.toHaveBeenCalled();
  });

  it('Fragetyp: aus einem Textfeld wird eine Auswahl mit zwei Antworten zum Ausfüllen', async () => {
    ff.feldTypAendern.mockResolvedValue({} as never);
    zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Kurzer Text' }));
    fireEvent.change(await screen.findByLabelText('Fragetyp'), { target: { value: 'radio' } });
    await waitFor(() => expect(ff.feldTypAendern).toHaveBeenCalled());
    expect(ff.feldTypAendern.mock.calls[0][1]).toMatchObject({
      typ: 'radio',
      antworten: ['Antwort 1', 'Antwort 2'],
    });
  });

  it('Fragetyp gesperrt, wenn schon jemand geantwortet hat', async () => {
    ff.antwortenZaehlen.mockResolvedValue(
      new Map([[501, { gesamt: 2, jeOption: new Map([['11', 2]]) }]]),
    );
    const { huelle } = zeigen();
    fireEvent.click(huelle('f1'));
    await waitFor(() => expect(screen.getByLabelText('Fragetyp')).toHaveProperty('disabled', true));
  });

  it('Design einzeln ändern: Muster, Logo-Platz, Schrift – „seitdem geändert“ zählt mit', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    zeigen();
    const leiste = screen.getByRole('complementary', { name: 'Bausteine und Design' });
    fireEvent.click(within(leiste).getByRole('button', { name: 'Design' }));
    // Kinder-Event startet bei „Bunt“ mit Konfetti – umstellbar auf Sterne (Alwin: „andere Hintergründe“).
    fireEvent.click(screen.getByRole('button', { name: /^Sterne/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Links neben dem Titel' }));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Schrift: Text' })).getByRole('button', {
        name: 'Lesbar',
      }),
    );
    expect(screen.getByText(/seitdem geändert: Muster, Text/)).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(PAUSE_DESIGN_MS);
    });
    await waitFor(() => expect(ei.aendereEinstellungen).toHaveBeenCalledTimes(1));
    const g = ei.aendereEinstellungen.mock.calls[0][1](neueEinstellungen('kinder')).gestaltung;
    expect(g).toMatchObject({ muster: 'sterne', logoOrt: 'links', textSchrift: 'lesbar' });
  });

  it('Gemeindelogo aus ChurchTools: wird übernommen, sobald es bekannt ist (nur mit Recht)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    ei.gemeindeLogo.mockResolvedValue('https://ct.test/images/558/logo');
    zeigen();
    await waitFor(() => expect(ei.gemeindeLogo).toHaveBeenCalled());
    await act(async () => {
      vi.advanceTimersByTime(PAUSE_DESIGN_MS + 10);
    });
    await waitFor(() => expect(ei.aendereEinstellungen).toHaveBeenCalled());
    const g = ei.aendereEinstellungen.mock.calls[0][1](neueEinstellungen('kinder')).gestaltung;
    expect(g).toMatchObject({ logo: 'ct', logoUrl: 'https://ct.test/images/558/logo' });
  });

  it('Eigenes Logo: bisherige zur Auswahl, Neues hochladen wählt es gleich; Formular bleibt, bis eins gewählt ist', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const alt = { id: 300, name: 'Jugend', url: 'https://ct.test/images/9/alt' };
    const neu = { id: 301, name: 'Kinder', url: 'https://ct.test/images/10/neu' };
    ei.logoListe.mockResolvedValue([alt]);
    ei.logoHochladen.mockResolvedValue(neu);
    zeigen();
    const leiste = screen.getByRole('complementary', { name: 'Bausteine und Design' });
    fireEvent.click(within(leiste).getByRole('button', { name: 'Design' }));
    fireEvent.click(screen.getByRole('button', { name: /Eigenes/ }));
    // Nur „Eigenes“ ist markiert, solange man eins aussucht – nicht zusätzlich das Gemeindelogo.
    expect(screen.getByRole('button', { name: /Gemeindelogo/ }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    await act(async () => {
      vi.advanceTimersByTime(PAUSE_DESIGN_MS + 10);
    });
    expect(ei.aendereEinstellungen).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Jugend' }));
    await act(async () => {
      vi.advanceTimersByTime(PAUSE_DESIGN_MS + 10);
    });
    await waitFor(() => expect(ei.aendereEinstellungen).toHaveBeenCalledTimes(1));
    const g = ei.aendereEinstellungen.mock.calls[0][1](neueEinstellungen('kinder')).gestaltung;
    expect(g).toMatchObject({ logo: 'eigen', logoUrl: alt.url });

    const d = new File(['x'], 'Kinder.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Eigenes Logo hochladen'), { target: { files: [d] } });
    await waitFor(() => expect(ei.logoHochladen).toHaveBeenCalledWith(91, d));
    expect(
      (await screen.findByRole('button', { name: 'Kinder' })).getAttribute('aria-pressed'),
    ).toBe('true');
    // Entfernen nur für Gruppen-Admins.
    expect(screen.queryByLabelText('Logo entfernen')).toBeNull();
  });

  it('Eigenes Logo entfernen (Gruppen-Admin): erst Warnung; das gewählte → „Kein Logo“', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const l = { id: 300, name: 'Jugend', url: 'https://ct.test/images/9/alt' };
    ei.logoListe.mockResolvedValue([l]);
    ei.istGruppenAdmin.mockResolvedValue(true);
    ei.logoEntfernen.mockResolvedValue(undefined);
    const e = einstellungen();
    e.gestaltung = { ...e.gestaltung, logo: 'eigen', logoUrl: l.url };
    zeigen(e);
    const leiste = screen.getByRole('complementary', { name: 'Bausteine und Design' });
    fireEvent.click(within(leiste).getByRole('button', { name: 'Design' }));
    fireEvent.change(await screen.findByLabelText('Logo entfernen'), { target: { value: '300' } });
    expect(ei.logoEntfernen).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/hat danach keins mehr/);
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    await waitFor(() => expect(ei.logoEntfernen).toHaveBeenCalledWith(300));
    await act(async () => {
      vi.advanceTimersByTime(PAUSE_DESIGN_MS + 10);
    });
    await waitFor(() => expect(ei.aendereEinstellungen).toHaveBeenCalled());
    const g = ei.aendereEinstellungen.mock.calls.at(-1)![1](neueEinstellungen('kinder')).gestaltung;
    expect(g).toMatchObject({ logo: 'keins', logoUrl: null });
  });

  it('Gemeindelogo lässt sich nicht holen: wie „keins hinterlegt“ – nicht wählbar statt ewig „lädt“', async () => {
    ei.gemeindeLogo.mockRejectedValue(new TypeError('Failed to fetch'));
    zeigen();
    const leiste = screen.getByRole('complementary', { name: 'Bausteine und Design' });
    fireEvent.click(within(leiste).getByRole('button', { name: 'Design' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Gemeindelogo/ })).toHaveProperty('disabled', true),
    );
  });

  it('eigene Logos lassen sich nicht laden: Fehler, „Neues hochladen“ geht trotzdem', async () => {
    ei.logoListe.mockRejectedValue(new TypeError('Failed to fetch'));
    zeigen();
    const leiste = screen.getByRole('complementary', { name: 'Bausteine und Design' });
    fireEvent.click(within(leiste).getByRole('button', { name: 'Design' }));
    fireEvent.click(screen.getByRole('button', { name: /Eigenes/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/antwortet gerade nicht/);
    expect(screen.queryByText('Logos werden geladen …')).toBeNull();
    expect(screen.getByRole('button', { name: '+ Neues hochladen' })).toBeTruthy();
  });

  it('ein anderes eigenes Logo entfernen: verschwindet aus der Auswahl, ohne neu zu laden', async () => {
    const jugend = { id: 300, name: 'Jugend', url: 'https://ct.test/images/9/alt' };
    const kinder = { id: 301, name: 'Kinder', url: 'https://ct.test/images/10/neu' };
    ei.logoListe.mockResolvedValue([jugend, kinder]);
    ei.istGruppenAdmin.mockResolvedValue(true);
    ei.logoEntfernen.mockResolvedValue(undefined);
    const e = einstellungen();
    e.gestaltung = { ...e.gestaltung, logo: 'eigen', logoUrl: kinder.url };
    zeigen(e);
    const leiste = screen.getByRole('complementary', { name: 'Bausteine und Design' });
    fireEvent.click(within(leiste).getByRole('button', { name: 'Design' }));
    fireEvent.change(await screen.findByLabelText('Logo entfernen'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    await waitFor(() => expect(ei.logoEntfernen).toHaveBeenCalledWith(300));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Jugend' })).toBeNull());
    expect(screen.getByRole('button', { name: 'Kinder' })).toBeTruthy();
    expect(ei.logoListe).toHaveBeenCalledTimes(1);
  });

  it('ohne Recht wird das Logo nicht übernommen (kein Schreiben)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    ei.gemeindeLogo.mockResolvedValue('https://ct.test/images/558/logo');
    zeigen(einstellungen(), false);
    await waitFor(() => expect(ei.gemeindeLogo).toHaveBeenCalled());
    await act(async () => {
      vi.advanceTimersByTime(PAUSE_DESIGN_MS + 50);
    });
    expect(ei.aendereEinstellungen).not.toHaveBeenCalled();
  });
});

/** Fenster wie ChurchTools (E6-O F4): die Blätter am Handy – X oben rechts, unten nur „Fertig“. */
describe('Baukasten-Blätter im ChurchTools-Aufbau', () => {
  it('„Baustein“ und „Design“ öffnen ein Fenster zum Wählen – nur mit X (seit 02.11.2026 ohne „Fertig“)', () => {
    zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Baustein' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(fensterKnoepfe()[0]).toBe('Fenster schließen');
    expect(fensterKnoepfe()).not.toContain('Fertig');
  });
});

// ── F1c: Bedingungen im Baukasten (Entwurf f1-bedingungen-nachweise-v1, Ansicht 1; Alwin 12.11.2026) ──
describe('Baukasten (F1c): Bedingungen einstellen', () => {
  /** Kinder-Event mit „Gruppe“ (f1: Minis/Kids) und „Welche Kids-Gruppe?“ (f2) nur, wenn Gruppe „Kids“. */
  function mitZiel(bed = true): OeffentlicheEinstellungen {
    const e = einstellungen();
    e.formular.person.push({
      id: 'f2',
      art: 'eigen',
      typ: 'text',
      frage: 'Welche Kids-Gruppe?',
      hilfe: '',
      zustand: 'freiwillig',
      antworten: [],
      ...(bed ? { bed: { modus: 'eine', regeln: [{ feld: 'f1', op: 'ist', wert: 'Kids' }] } } : {}),
    });
    e.ctFelder = { ...e.ctFelder, f2: 502 };
    return e;
  }
  const dialog = () => screen.getByRole('dialog');

  it('Knopf „Nur zeigen, wenn …“ → Fenster → Speichern speichert gleich (nicht erst nach der Pause)', async () => {
    const { huelle } = zeigen(mitZiel(false));
    fireEvent.click(huelle('f2'));
    fireEvent.click(screen.getByRole('button', { name: 'Nur zeigen, wenn …' }));
    expect(within(dialog()).getByText('Bedingung: Welche Kids-Gruppe?')).toBeTruthy();
    // Vorgabe: die letzte Frage davor mit Antworten – hier „Gruppe“, „ist“, die erste Antwort.
    expect(within(dialog()).getByLabelText<HTMLSelectElement>('Frage 1').value).toBe('f1');
    fireEvent.change(within(dialog()).getByLabelText('Antwort 1'), { target: { value: 'Kids' } });
    expect(
      within(dialog()).getByText(
        'Die Frage erscheint nur, wenn „Gruppe“ ist Kids. Pflicht gilt nur, solange sie zu sehen ist.',
      ),
    ).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalled());
    expect(ff.feldSpeichern.mock.calls[0][2]).toMatchObject({
      id: 'f2',
      bed: { modus: 'eine', regeln: [{ feld: 'f1', op: 'ist', wert: 'Kids' }] },
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Bedingung ändern' })).toBeTruthy();
  });

  it('mehrere Bedingungen: „eine reicht / alle müssen“, Vergleich ohne Wert, „Bedingung entfernen“', async () => {
    const { huelle } = zeigen(mitZiel());
    fireEvent.click(huelle('f2'));
    fireEvent.click(screen.getByRole('button', { name: 'Bedingung ändern' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: '+ Bedingung' }));
    fireEvent.change(within(dialog()).getByLabelText('Vergleich 2'), {
      target: { value: 'ausgefuellt' },
    });
    expect(within(dialog()).queryByLabelText('Antwort 2')).toBeNull();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'alle müssen' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalledTimes(1));
    expect(ff.feldSpeichern.mock.calls[0][2].bed).toEqual({
      modus: 'alle',
      regeln: [
        { feld: 'f1', op: 'ist', wert: 'Kids' },
        { feld: 'f1', op: 'ausgefuellt' },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Bedingung ändern' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Bedingung entfernen' }));
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalledTimes(2));
    expect(ff.feldSpeichern.mock.calls[1][2].bed).toBeUndefined();
  });

  it('Pfeil an einer Antwort → „nur wählbar, wenn …“ mit Ausgrauen und Hinweis', async () => {
    const { huelle } = zeigen();
    fireEvent.click(huelle('f1'));
    fireEvent.click(screen.getByRole('button', { name: '„Kids“ nur wählbar, wenn …' }));
    expect(within(dialog()).getByText('Antwort „Kids“')).toBeTruthy();
    fireEvent.change(within(dialog()).getByLabelText('Hinweis'), {
      target: { value: 'nur mit Telefon' },
    });
    fireEvent.change(within(dialog()).getByLabelText('Frage 1'), { target: { value: 'tel' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalled());
    expect(ff.feldSpeichern.mock.calls[0][2].antwortBed).toEqual({
      Kids: {
        modus: 'eine',
        regeln: [{ feld: 'tel', op: 'ausgefuellt' }],
        art: 'grau',
        grund: 'nur mit Telefon',
      },
    });
    expect(
      screen
        .getByRole('button', { name: '„Kids“ nur wählbar, wenn …' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('ausblenden: ohne Hinweis gespeichert', async () => {
    const { huelle } = zeigen();
    fireEvent.click(huelle('f1'));
    fireEvent.click(screen.getByRole('button', { name: '„Minis“ nur wählbar, wenn …' }));
    fireEvent.change(within(dialog()).getByLabelText('Hinweis'), { target: { value: 'egal' } });
    fireEvent.change(within(dialog()).getByLabelText('Darstellung'), { target: { value: 'weg' } });
    expect(within(dialog()).queryByLabelText('Hinweis')).toBeNull();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalled());
    expect(ff.feldSpeichern.mock.calls[0][2].antwortBed?.Minis).toEqual({
      modus: 'eine',
      regeln: [expect.any(Object)],
      art: 'weg',
    });
  });

  it('Hinweis am Feld: „Nur wenn …“ unter dem nicht gewählten Feld, mit Kurzname', () => {
    const e = mitZiel();
    e.formular.person.find((f) => f.id === 'f1')!.kurz = 'Gruppe kurz';
    const { huelle } = zeigen(e);
    expect(
      within(huelle('f2') as HTMLElement).getByText('Nur wenn „Gruppe kurz“ ist Kids'),
    ).toBeTruthy();
  });

  it('Kurzname nur an Fragen, auf die eine Bedingung schaut', async () => {
    const { huelle } = zeigen(mitZiel());
    fireEvent.click(huelle('f2'));
    expect(screen.queryByLabelText('Kurzname für Bedingungen')).toBeNull();
    fireEvent.click(huelle('f1'));
    const kurz = screen.getByLabelText<HTMLInputElement>('Kurzname für Bedingungen');
    expect(kurz.placeholder).toBe('Kurzname für Bedingungen (freiwillig): Gruppe');
    fireEvent.change(kurz, { target: { value: 'Gr.' } });
    fireEvent.click(huelle('f2'));
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalled());
    expect(ff.feldSpeichern.mock.calls[0][2]).toMatchObject({ id: 'f1', kurz: 'Gr.' });
  });

  it('Verschieben, das eine Bedingung kaputt machte, wird gesperrt – mit Satz', async () => {
    const { huelle } = zeigen(mitZiel());
    fireEvent.click(huelle('f1'));
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe nach unten' }));
    expect(
      await screen.findByText(
        '„Gruppe“ muss vor „Welche Kids-Gruppe?“ bleiben – dort ist sie Bedingung.',
      ),
    ).toBeTruthy();
    expect(ff.feldEinordnen).not.toHaveBeenCalled();
  });

  it('eben getippt, gleich verschoben: die Sperre kennt schon den neuen Kurznamen', async () => {
    const { huelle } = zeigen(mitZiel());
    fireEvent.click(huelle('f1'));
    fireEvent.change(screen.getByLabelText('Kurzname für Bedingungen'), {
      target: { value: 'Gr.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe nach unten' }));
    expect(
      await screen.findByText(
        '„Gr.“ muss vor „Welche Kids-Gruppe?“ bleiben – dort ist sie Bedingung.',
      ),
    ).toBeTruthy();
  });

  it('eben getippt, gleich verschoben: die Änderung bleibt in der Anzeige', async () => {
    const { huelle } = zeigen();
    fireEvent.click(huelle('f1'));
    fireEvent.change(screen.getByLabelText('Hilfetext'), {
      target: { value: 'bitte eine wählen' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe nach oben' }));
    await waitFor(() => expect(ff.feldEinordnen).toHaveBeenCalled());
    fireEvent.click(huelle('allergy'));
    expect(within(huelle('f1') as HTMLElement).getByText('bitte eine wählen')).toBeTruthy();
  });

  it('Quelle entfernt → die Bedingung fällt mit weg, die Meldung sagt es', async () => {
    const { huelle, gespeichert } = zeigen(mitZiel());
    fireEvent.click(huelle('f1'));
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe entfernen' }));
    await waitFor(() =>
      expect(gespeichert).toHaveBeenCalledWith(
        '„Gruppe“ entfernt. Die Bedingung bei „Welche Kids-Gruppe?“ fällt mit weg.',
        true,
      ),
    );
    expect(within(huelle('f2') as HTMLElement).queryByText(/Nur wenn/)).toBeNull();
  });

  it('Antwort umbenannt → die Bedingung, die darauf schaut, zeigt gleich den neuen Namen', async () => {
    const { huelle, gespeichert } = zeigen(mitZiel());
    fireEvent.click(huelle('f1'));
    fireEvent.change(screen.getByLabelText('Antwort 2'), { target: { value: 'Große' } });
    fireEvent.click(huelle('f2'));
    await waitFor(() => expect(gespeichert).toHaveBeenCalledWith('„Gruppe“ gespeichert.', true));
    fireEvent.click(huelle('allergy'));
    expect(
      within(huelle('f2') as HTMLElement).getByText('Nur wenn „Gruppe“ ist Große'),
    ).toBeTruthy();
  });

  it('zweimal umbenannt: das zweite Mal zieht vom gespeicherten Namen aus mit, nicht vom Namen beim Laden', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { huelle } = zeigen(mitZiel());
    fireEvent.click(huelle('f1'));
    await waitFor(() => expect(ff.ctFelderLesen).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Antwort 2'), { target: { value: 'Große' } });
    // Gespeichert nach der Pause beim Tippen – das Feld bleibt gewählt.
    await act(async () => {
      vi.advanceTimersByTime(PAUSE_FELD_MS);
    });
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('Antwort 2'), { target: { value: 'Riesen' } });
    fireEvent.click(huelle('f2'));
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalledTimes(2));
    expect(ff.feldSpeichern.mock.calls[1][3]).toEqual([
      { text: 'Minis', altId: '11', von: 'Minis' },
      { text: 'Riesen', altId: '12', von: 'Große' },
    ]);
    fireEvent.click(huelle('allergy'));
    expect(
      within(huelle('f2') as HTMLElement).getByText('Nur wenn „Gruppe“ ist Riesen'),
    ).toBeTruthy();
  });

  it('eigene Antwort mit Bedingung umbenannt: beim nächsten Speichern bleibt die Bedingung am neuen Namen', async () => {
    const e = einstellungen();
    e.formular.person.find((f) => f.id === 'f1')!.antwortBed = {
      Kids: { modus: 'eine', regeln: [{ feld: 'tel', op: 'ausgefuellt' }], art: 'grau' },
    };
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { huelle } = zeigen(e);
    fireEvent.click(huelle('f1'));
    fireEvent.change(screen.getByLabelText('Antwort 2'), { target: { value: 'Große' } });
    await act(async () => {
      vi.advanceTimersByTime(PAUSE_FELD_MS);
    });
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('Hilfetext'), { target: { value: 'bitte wählen' } });
    fireEvent.click(huelle('allergy'));
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalledTimes(2));
    expect(Object.keys(ff.feldSpeichern.mock.calls[1][2].antwortBed ?? {})).toEqual(['Große']);
  });

  it('Geburtsdatum ausgeschaltet, während ein Feld mit Bedingung darauf gewählt ist → der Entwurf übernimmt das', async () => {
    const e = einstellungen();
    e.formular.person.push({
      id: 'f3',
      art: 'eigen',
      typ: 'text',
      frage: 'Welcher Kurs?',
      hilfe: '',
      zustand: 'freiwillig',
      antworten: [],
      bed: { modus: 'eine', regeln: [{ feld: 'birth', op: 'ausgefuellt' }] },
    });
    const { huelle } = zeigen(e);
    fireEvent.click(huelle('f3'));
    expect(screen.getByRole('button', { name: 'Bedingung ändern' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Geburtsdatum abfragen/ }));
    expect(screen.getByRole('button', { name: 'Nur zeigen, wenn …' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Hilfetext'), { target: { value: 'x' } });
    fireEvent.click(huelle('allergy'));
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalled());
    expect(ff.feldSpeichern.mock.calls[0][2]).toMatchObject({ id: 'f3' });
    expect(ff.feldSpeichern.mock.calls[0][2].bed).toBeUndefined();
  });

  it('Feldgrenze je Teil: angezeigt; ist ein Teil voll, kommt kein Baustein mehr hinein', () => {
    const e = einstellungen();
    for (let i = e.formular.person.length; i < 60; i++)
      e.formular.person.push({
        id: `v${i}`,
        art: 'eigen',
        typ: 'text',
        frage: `Voll ${i}`,
        hilfe: '',
        zustand: 'aus',
        antworten: [],
      });
    zeigen(e);
    expect(
      screen.getByText(`Kontakt ${e.formular.anmeldung.length} von 60 · je Person 60 von 60`),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Kurzer Text' }));
    expect(
      screen.getByText(
        'Hier passen höchstens 60 Felder hinein (ausgeblendete zählen mit). Erst ein Feld entfernen.',
      ),
    ).toBeTruthy();
    expect(ff.feldSpeichern).not.toHaveBeenCalled();
  });
});

// ── F1d: Reiter „Formular | Bedingungen“ (Entwurf F1 Ansicht 1; Alwin 12.11.2026: Reiter über dem Formular) ──
describe('Baukasten (F1d): Reiter „Bedingungen“', () => {
  const KIDS: Bedingung = { modus: 'eine', regeln: [{ feld: 'f1', op: 'ist', wert: 'Kids' }] };
  /** „Gruppe“ (f1: Minis/Kids), danach f2 und f3 – mit `bed2`/`bed3` als Bedingung. */
  function mitZielen(bed2?: Bedingung, bed3?: Bedingung): OeffentlicheEinstellungen {
    const e = einstellungen();
    for (const [id, frage, bed] of [
      ['f2', 'Welche Kids-Gruppe?', bed2],
      ['f3', 'Wer holt ab?', bed3],
    ] as const)
      e.formular.person.push({
        id,
        art: 'eigen',
        typ: 'text',
        frage,
        hilfe: '',
        zustand: 'freiwillig',
        antworten: [],
        ...(bed ? { bed } : {}),
      });
    return e;
  }
  const dialog = () => screen.getByRole('dialog');
  const reiter = (name: RegExp) => screen.getByRole('button', { name });
  const karten = () =>
    screen.getAllByRole('listitem').filter((li) => li.textContent?.startsWith('wenn'));

  it('Reiter über dem Formular, mit Zahl; „Bedingungen“ zeigt die Liste ohne Leiste, „Formular“ wieder das Formular', () => {
    const { huelle } = zeigen(mitZielen(KIDS));
    expect(reiter(/^Bedingungen 1$/).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(reiter(/^Bedingungen/));
    expect(reiter(/^Bedingungen/).getAttribute('aria-pressed')).toBe('true');
    expect(karten()).toHaveLength(1);
    expect(karten()[0].textContent).toContain('„Gruppe“ ist Kids');
    expect(karten()[0].textContent).toContain('zeige Welche Kids-Gruppe?');
    // Ohne Bausteine-Leiste, ohne Computer/Handy und ohne „+ Baustein“ unten.
    expect(screen.queryByRole('complementary', { name: 'Bausteine und Design' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Größe der Ansicht' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Baustein' })).toBeNull();
    expect(huelle('f2')).toBeNull();
    fireEvent.click(reiter(/^Formular$/));
    expect(huelle('f2')).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'Bausteine und Design' })).toBeTruthy();
  });

  it('der Reiter bleibt, wenn der Baukasten neu aufgebaut wird („Rückgängig“ lädt die Veranstaltung neu)', () => {
    const erst = zeigen(mitZielen(KIDS));
    fireEvent.click(reiter(/^Bedingungen/));
    erst.unmount();
    const dann = zeigen(mitZielen(KIDS));
    expect(reiter(/^Bedingungen/).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(reiter(/^Formular$/));
    dann.unmount();
    zeigen(mitZielen(KIDS));
    expect(reiter(/^Formular$/).getAttribute('aria-pressed')).toBe('true');
  });

  it('gleiche Bedingungen stehen als EINE Regel mit beiden Zielen', () => {
    zeigen(mitZielen(KIDS, KIDS));
    expect(reiter(/^Bedingungen 1$/)).toBeTruthy();
    fireEvent.click(reiter(/^Bedingungen/));
    expect(karten()).toHaveLength(1);
    expect(karten()[0].textContent).toContain('zeige Welche Kids-Gruppe?Wer holt ab?');
  });

  it('ohne Regeln: der Hinweis, wie man eine anlegt', () => {
    zeigen(mitZielen());
    fireEvent.click(reiter(/^Bedingungen 0$/));
    expect(screen.getByText(/Noch keine Bedingungen/)).toBeTruthy();
  });

  it('„Neue Regel“ mit mehreren Zielen → EIN Speichern für alle, gleich in der Liste', async () => {
    const { gespeichert } = zeigen(mitZielen());
    fireEvent.click(reiter(/^Bedingungen/));
    fireEvent.click(screen.getByRole('button', { name: 'Neue Regel' }));
    expect(within(dialog()).getByText('Neue Regel')).toBeTruthy();
    fireEvent.change(within(dialog()).getByLabelText('Frage 1'), { target: { value: 'f1' } });
    fireEvent.change(within(dialog()).getByLabelText('Antwort 1'), { target: { value: 'Kids' } });
    // Ohne Ziel lässt sich nichts speichern.
    expect(
      within(dialog()).getByRole<HTMLButtonElement>('button', { name: 'Speichern' }).disabled,
    ).toBe(true);
    fireEvent.click(within(dialog()).getByRole('checkbox', { name: /Wer holt ab\?/ }));
    fireEvent.click(within(dialog()).getByRole('checkbox', { name: /Welche Kids-Gruppe\?/ }));
    expect(
      within(dialog()).getByText(
        'Diese 2 Felder erscheinen nur, wenn „Gruppe“ ist Kids. Pflicht gilt nur, solange sie zu sehen ist.',
      ),
    ).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(ff.regelSpeichern).toHaveBeenCalledTimes(1));
    // Die Ziele in der Reihenfolge des Formulars.
    expect(ff.regelSpeichern).toHaveBeenCalledWith(91, [], [{ id: 'f2' }, { id: 'f3' }], KIDS);
    await waitFor(() => expect(gespeichert).toHaveBeenCalledWith('Regel gespeichert.', true));
    expect(karten()).toHaveLength(1);
    expect(reiter(/^Bedingungen 1$/)).toBeTruthy();
    expect(ff.feldSpeichern).not.toHaveBeenCalled();
  });

  it('keine Kreise: Ziele nur nach der Quelle, Quellen nur vor allen gewählten Zielen', () => {
    zeigen(mitZielen());
    fireEvent.click(reiter(/^Bedingungen/));
    fireEvent.click(screen.getByRole('button', { name: 'Neue Regel' }));
    fireEvent.change(within(dialog()).getByLabelText('Frage 1'), { target: { value: 'f1' } });
    const ziele = () =>
      within(dialog())
        .getAllByRole('checkbox')
        .map((c) => c.closest('label')!.textContent);
    expect(ziele()).toContain('Welche Kids-Gruppe?');
    expect(ziele()).not.toContain('Gruppe'); // nicht auf sich selbst
    // „Wer holt ab?“ gewählt → „Welche Kids-Gruppe?“ (davor) ist Quelle, „Wer holt ab?“ selbst nicht.
    fireEvent.click(within(dialog()).getByRole('checkbox', { name: /Wer holt ab\?/ }));
    const quellen = [...within(dialog()).getByLabelText<HTMLSelectElement>('Frage 1').options].map(
      (o) => o.textContent,
    );
    expect(quellen).toContain('Welche Kids-Gruppe?');
    expect(quellen).not.toContain('Wer holt ab?');
    // Quelle „Welche Kids-Gruppe?“ → als Ziel bleibt nur, was danach steht.
    fireEvent.change(within(dialog()).getByLabelText('Frage 1'), { target: { value: 'f2' } });
    expect(ziele()).not.toContain('Welche Kids-Gruppe?');
    expect(ziele()).toContain('Wer holt ab?');
  });

  it('„Bearbeiten“ ändert die Regel für alle Ziele; ein abgewähltes Ziel verliert sie', async () => {
    zeigen(mitZielen(KIDS, KIDS));
    fireEvent.click(reiter(/^Bedingungen/));
    fireEvent.click(screen.getByRole('button', { name: /^Regel bearbeiten/ }));
    expect(within(dialog()).getByText('Regel bearbeiten')).toBeTruthy();
    fireEvent.change(within(dialog()).getByLabelText('Antwort 1'), { target: { value: 'Minis' } });
    fireEvent.click(within(dialog()).getByRole('checkbox', { name: /Wer holt ab\?/ }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(ff.regelSpeichern).toHaveBeenCalledTimes(1));
    const MINIS = { modus: 'eine', regeln: [{ feld: 'f1', op: 'ist', wert: 'Minis' }] };
    expect(ff.regelSpeichern).toHaveBeenCalledWith(
      91,
      [{ id: 'f2' }, { id: 'f3' }],
      [{ id: 'f2' }],
      MINIS,
    );
    // Gleich zu sehen: Die Liste hat jetzt nur noch „Welche Kids-Gruppe?“ an dieser Regel.
    expect(karten()[0].textContent).toContain('„Gruppe“ ist Minis');
    expect(karten()[0].textContent).not.toContain('Wer holt ab?');
  });

  it('„Regel entfernen“ nimmt sie von allen Zielen', async () => {
    const { gespeichert } = zeigen(mitZielen(KIDS, KIDS));
    fireEvent.click(reiter(/^Bedingungen/));
    fireEvent.click(screen.getByRole('button', { name: /^Regel bearbeiten/ }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Regel entfernen' }));
    await waitFor(() => expect(ff.regelSpeichern).toHaveBeenCalledTimes(1));
    const beide = [{ id: 'f2' }, { id: 'f3' }];
    expect(ff.regelSpeichern).toHaveBeenCalledWith(91, beide, beide, null);
    await waitFor(() => expect(gespeichert).toHaveBeenCalledWith('Regel entfernt.', true));
    expect(screen.getByText(/Noch keine Bedingungen/)).toBeTruthy();
  });

  it('ein Feld mit anderer Bedingung: das Fenster sagt vorher, dass sie ersetzt wird', () => {
    zeigen(mitZielen(undefined, { ...KIDS, regeln: [{ feld: 'f1', op: 'ist', wert: 'Minis' }] }));
    fireEvent.click(reiter(/^Bedingungen/));
    fireEvent.click(screen.getByRole('button', { name: 'Neue Regel' }));
    fireEvent.change(within(dialog()).getByLabelText('Frage 1'), { target: { value: 'f1' } });
    expect(
      within(dialog()).getByRole('checkbox', {
        name: /Wer holt ab\? \(hat schon eine andere Bedingung – wird ersetzt\)/,
      }),
    ).toBeTruthy();
    expect(within(dialog()).getByRole('checkbox', { name: 'Welche Kids-Gruppe?' })).toBeTruthy();
  });

  it('Antwort-Regel: „nur wählbar in“ mit Darstellung, Ziele bleiben', async () => {
    const e = mitZielen();
    e.formular.person.push({
      id: 'f4',
      art: 'eigen',
      typ: 'radio',
      frage: 'Dienst',
      hilfe: '',
      zustand: 'freiwillig',
      antworten: ['Küche', 'Leitung'],
      antwortBed: { Leitung: { ...KIDS, art: 'grau', grund: 'nur für Kids' } },
    });
    zeigen(e);
    fireEvent.click(reiter(/^Bedingungen 1$/));
    expect(karten()[0].textContent).toContain(
      '„Leitung“ nur wählbar in Dienst · sonst ausgegraut („nur für Kids“)',
    );
    fireEvent.click(screen.getByRole('button', { name: /^Regel bearbeiten/ }));
    expect(within(dialog()).queryAllByRole('checkbox')).toHaveLength(0);
    fireEvent.change(within(dialog()).getByLabelText('Darstellung'), { target: { value: 'weg' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(ff.regelSpeichern).toHaveBeenCalledTimes(1));
    const ziel = [{ id: 'f4', antwort: 'Leitung' }];
    expect(ff.regelSpeichern).toHaveBeenCalledWith(91, ziel, ziel, { ...KIDS, art: 'weg' });
  });

  it('eine kaputte Regel steht rot in der Liste', () => {
    zeigen(mitZielen({ ...KIDS, regeln: [{ feld: 'f1', op: 'ist', wert: 'Teens' }] }));
    fireEvent.click(reiter(/^Bedingungen/));
    expect(within(karten()[0]).getByRole('alert').textContent).toContain(
      'Die Antwort „Teens“ gibt es bei „Gruppe“ nicht mehr.',
    );
  });

  it('Reiter wechseln speichert das angefangene Feld zuerst', async () => {
    const { huelle } = zeigen(mitZielen());
    fireEvent.click(huelle('f2'));
    fireEvent.change(screen.getByLabelText('Hilfetext'), { target: { value: 'z. B. Löwen' } });
    fireEvent.click(reiter(/^Bedingungen/));
    await waitFor(() => expect(ff.feldSpeichern).toHaveBeenCalledTimes(1));
    expect(ff.feldSpeichern.mock.calls[0][2]).toMatchObject({ id: 'f2', hilfe: 'z. B. Löwen' });
  });

  it('Fenster am Feld: teilen sich mehrere Felder die Bedingung, sagt es das', () => {
    const { huelle } = zeigen(mitZielen(KIDS, KIDS));
    fireEvent.click(huelle('f2'));
    fireEvent.click(screen.getByRole('button', { name: 'Bedingung ändern' }));
    expect(
      within(dialog()).getByText(
        'Dieselbe Bedingung haben auch: „Wer holt ab?“. Hier änderst du sie nur für diese Frage; gemeinsam geht es im Reiter „Bedingungen“.',
      ),
    ).toBeTruthy();
  });

  it('eine Regel, deren Quelle hinter dem Ziel steht: erst eine gültige Quelle wählen, dann speichern', () => {
    // Altbestand: „Welche Kids-Gruppe?“ schaut auf „Wer holt ab?“ – das steht dahinter.
    zeigen(mitZielen({ ...KIDS, regeln: [{ feld: 'f3', op: 'ausgefuellt' }] }));
    fireEvent.click(reiter(/^Bedingungen/));
    fireEvent.click(screen.getByRole('button', { name: /^Regel bearbeiten/ }));
    const speichern = () =>
      within(dialog()).getByRole<HTMLButtonElement>('button', { name: 'Speichern' });
    expect(within(dialog()).getByLabelText<HTMLSelectElement>('Frage 1').value).toBe('');
    expect(speichern().disabled).toBe(true);
    fireEvent.change(within(dialog()).getByLabelText('Frage 1'), { target: { value: 'f1' } });
    expect(speichern().disabled).toBe(false);
  });

  it('ohne mögliche Quelle lässt sich keine neue Regel anlegen', () => {
    const fo = { anmeldung: [], person: [] };
    render(<RegelListe formular={fo} darf onBearbeiten={vi.fn()} />);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Neue Regel' }).disabled).toBe(
      true,
    );
  });
});
