// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { TerminZeile } from '@shared/protokolle/termine';
import type { Ressource } from '@shared/protokolle/terminRessourcen';
import type { TerminVorlage } from '@shared/protokolle/terminVorlagen';
import * as K from './terminAnlegen';
import * as V from './terminVorlagenLesen';
import * as B from './buchungenLesen';
import * as E from './eventsLesen';
import { ladeSchreibKalender } from './kalenderListe';
import { terminLegen } from './terminEintragen';
import { terminVermerken } from './terminStandSchreiben';
import { TerminFenster } from './TerminFenster';

/** Der Reiter „Events“ im Fenster „In Kalender eintragen“ (W15-3): Rechte je Kalender, Zeilen, Rückfrage „für alle“, Nachlesen. */
vi.mock('./kalenderListe', () => ({ ladeSchreibKalender: vi.fn() }));
vi.mock('./terminAnlegen', async (orig) => ({
  ...(await orig<typeof import('./terminAnlegen')>()),
  kalenderTermineAmTag: vi.fn(),
}));
vi.mock('./terminEintragen', () => ({ terminLegen: vi.fn(), NICHT_NACHGELESEN: 'x' }));
vi.mock('./terminStandSchreiben', () => ({ terminVermerken: vi.fn() }));
vi.mock('./terminVorlagenLesen', async (orig) => ({
  ...(await orig<typeof import('./terminVorlagenLesen')>()),
  ladeVorlagen: vi.fn(),
  ladeTags: vi.fn(() => Promise.resolve([])),
  vorlageSpeichern: vi.fn(),
}));
vi.mock('./buchungenLesen', () => ({ ladeRessourcen: vi.fn() }));
vi.mock('./eventsLesen', () => ({ ladeEventVorlagen: vi.fn() }));

const RESSOURCEN: Ressource[] = [{ id: 1, name: 'Saal', typId: 10, typ: 'Raum', anzahl: 1 }];
const ZEILE: TerminZeile = {
  schluessel: 'termin-s-b',
  gruppe: { id: 11, name: 'Leitungsteam' },
  sitzung: { id: 's', schluessel: 'p:s', titel: 'Festplanung', beginn: '2026-11-21T18:00:00Z' },
  blockId: 'b',
  text: 'Heiligabend, 16 Uhr',
  datum: '2027-12-24',
  punkt: null,
};
const STAND = { vermerke: [] } as never;
const VORLAGEN = [
  { id: 0, name: 'Standard' },
  { id: 7, name: 'Jugend' },
];

const onFertig = vi.fn();
const zeigen = (events: number[] = [4], buchen: number[] = []) =>
  render(
    <TerminFenster
      zeile={ZEILE}
      gruppenKalender={4}
      schreibbar={[4, 2]}
      eventsAnlegen={events}
      ressourcenBuchen={buchen}
      ort={{ modul: 24, kategorie: 61 }}
      ich={1}
      zeitzone="Europe/Berlin"
      onFertig={onFertig}
      onClose={vi.fn()}
    />,
  );
const fenster = async () => await screen.findByRole('dialog', { name: 'In Kalender eintragen' });
const reiterEvents = async (f: HTMLElement) => {
  fireEvent.click(await within(f).findByRole('button', { name: 'Events' }));
  await within(f).findByText('Event-Datum');
};
/** Aus „Kalender“ eine wöchentliche Reihe bis 14.01.2028 machen – vier Zeilen (24.12., 31.12., 07.01., 14.01.). */
const woechentlich = (f: HTMLElement) => {
  fireEvent.change(within(f).getByLabelText('Wiederholungen'), { target: { value: '7' } });
  fireEvent.change(within(f).getByLabelText('Wiederholen bis'), {
    target: { value: '2028-01-14' },
  });
};
const auswahl = (f: HTMLElement, datum: string) =>
  within(f).getByLabelText<HTMLSelectElement>(`Eventvorlage ${datum}`);
const werte = (f: HTMLElement) =>
  within(f)
    .getAllByLabelText<HTMLSelectElement>(/^Eventvorlage \d/)
    .map((s) => s.value);

beforeEach(() => {
  vi.mocked(ladeSchreibKalender).mockResolvedValue([
    { id: 4, name: 'Gemeindeleitung' },
    { id: 2, name: 'Gottesdienst' },
  ] as never);
  vi.mocked(K.kalenderTermineAmTag).mockResolvedValue([]);
  vi.mocked(V.ladeVorlagen).mockResolvedValue([]);
  vi.mocked(B.ladeRessourcen).mockResolvedValue(RESSOURCEN);
  vi.mocked(E.ladeEventVorlagen).mockResolvedValue(VORLAGEN);
  vi.mocked(terminLegen).mockResolvedValue({ art: 'angelegt', id: 700 });
  vi.mocked(terminVermerken).mockResolvedValue(STAND);
  onFertig.mockReset();
});
afterEach(cleanup);

describe('Reiter und Rechte', () => {
  it('ohne Recht gibt es den Reiter nicht – und es wird nichts geladen', async () => {
    zeigen([]);
    const f = await fenster();
    expect(within(f).queryByRole('button', { name: 'Events' })).toBeNull();
    expect(E.ladeEventVorlagen).not.toHaveBeenCalled();
  });

  it('Reihenfolge wie in ChurchTools: Kalender, Events, Ressourcen', async () => {
    zeigen([4], [1]);
    const f = await fenster();
    const namen = within(f)
      .getAllByRole('button', { name: /^(Kalender|Events|Ressourcen)$/ })
      .map((b) => b.textContent);
    expect(namen).toEqual(['Kalender', 'Events', 'Ressourcen']);
  });

  it('das Recht gilt je Kalender: im anderen Kalender geht der Reiter weg – und kommt zurück', async () => {
    zeigen([4]);
    const f = await fenster();
    await within(f).findByRole('button', { name: 'Events' });
    const kalender = await screen.findByLabelText<HTMLSelectElement>('Kalender');
    fireEvent.change(kalender, { target: { value: '2' } });
    await waitFor(() => expect(within(f).queryByRole('button', { name: 'Events' })).toBeNull());
    fireEvent.change(kalender, { target: { value: '4' } });
    expect(await within(f).findByRole('button', { name: 'Events' })).toBeTruthy();
  });

  it('wer im Reiter Events war und den Kalender wechselt, landet wieder bei „Kalender“ – gesendet wird kein Event', async () => {
    zeigen([4]);
    const f = await fenster();
    await reiterEvents(f);
    fireEvent.change(auswahl(f, '24.12.2027'), { target: { value: '0' } });
    fireEvent.click(within(f).getByRole('button', { name: 'Kalender' }));
    fireEvent.change(await screen.findByLabelText('Kalender'), { target: { value: '2' } });
    await waitFor(() =>
      expect(within(f).getByRole<HTMLButtonElement>('button', { name: 'Speichern' }).disabled).toBe(
        false,
      ),
    );
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(terminLegen).toHaveBeenCalled());
    expect(vi.mocked(terminLegen).mock.calls[0][0].eintrag.events).toEqual({});
  });
});

describe('Tabelle', () => {
  it('Satz oben, Spalten „Event-Datum“ und „Eventvorlage“; ohne Wiederholung eine Zeile mit Datum und Uhrzeit', async () => {
    zeigen();
    const f = await fenster();
    await reiterEvents(f);
    expect(
      within(f).getByText(/Um Dienste zu erstellen, bitte eine entsprechende Vorlage/),
    ).toBeTruthy();
    expect(within(f).getByRole('columnheader', { name: 'Eventvorlage' })).toBeTruthy();
    expect(within(f).getAllByRole('row')).toHaveLength(2);
    expect(within(f).getByText('24.12.2027')).toBeTruthy();
    expect(within(f).getByText('16:00')).toBeTruthy();
  });

  it('Auswahl: leerer Eintrag ganz oben, dann die Vorlagen in der Reihenfolge von ChurchTools – auch „Standard“ (Nummer 0)', async () => {
    zeigen();
    const f = await fenster();
    await reiterEvents(f);
    const optionen = [...auswahl(f, '24.12.2027').options].map((o) => [o.value, o.text]);
    expect(optionen).toEqual([
      ['', ''],
      ['0', 'Standard'],
      ['7', 'Jugend'],
    ]);
    expect(auswahl(f, '24.12.2027').value).toBe('');
  });

  it('eine Zeile je Einzeltermin der Reihe; ganztägig nur das Datum', async () => {
    zeigen();
    const f = await fenster();
    woechentlich(f);
    await reiterEvents(f);
    expect(within(f).getAllByRole('row')).toHaveLength(5);
    expect(within(f).getAllByText('16:00')).toHaveLength(4);
    fireEvent.click(within(f).getByRole('button', { name: 'Kalender' }));
    fireEvent.click(within(f).getByLabelText('Ganztägig'));
    fireEvent.click(within(f).getByRole('button', { name: 'Events' }));
    expect(within(f).queryByText('16:00')).toBeNull();
    expect(within(f).getByText('07.01.2028')).toBeTruthy();
  });

  it('Ausnahmen und weitere Termine verändern die Zeilen', async () => {
    zeigen();
    const f = await fenster();
    woechentlich(f);
    fireEvent.click(within(f).getByRole('button', { name: 'Ausnahmen: Datum hinzufügen' }));
    fireEvent.change(within(f).getByLabelText('Ausnahmen: Datum wählen'), {
      target: { value: '2027-12-31' },
    });
    fireEvent.click(within(f).getByRole('button', { name: 'Weitere Termine: Datum hinzufügen' }));
    fireEvent.change(within(f).getByLabelText('Weitere Termine: Datum wählen'), {
      target: { value: '2028-01-03' },
    });
    await reiterEvents(f);
    expect(
      within(f)
        .getAllByLabelText(/^Eventvorlage \d/)
        .map((x) => x.getAttribute('aria-label')),
    ).toEqual([
      'Eventvorlage 24.12.2027',
      'Eventvorlage 03.01.2028',
      'Eventvorlage 07.01.2028',
      'Eventvorlage 14.01.2028',
    ]);
  });

  it('ab 200 Zeilen: Hinweis „nur die ersten 200“', async () => {
    zeigen();
    const f = await fenster();
    fireEvent.change(within(f).getByLabelText('Wiederholungen'), { target: { value: '1' } });
    fireEvent.change(within(f).getByLabelText('Wiederholen bis'), {
      target: { value: '2028-12-31' },
    });
    await reiterEvents(f);
    expect(within(f).getAllByRole('row')).toHaveLength(201);
    expect(within(f).getByText(/nur die ersten 200 Termine gezeigt/)).toBeTruthy();
  });

  it('Eventvorlagen lassen sich nicht laden: Meldung mit „Noch einmal versuchen“', async () => {
    vi.mocked(E.ladeEventVorlagen).mockRejectedValueOnce(new Error('weg'));
    zeigen();
    const f = await fenster();
    await reiterEvents(f);
    fireEvent.click(await within(f).findByRole('button', { name: 'Noch einmal versuchen' }));
    await waitFor(() => expect(E.ladeEventVorlagen).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(auswahl(f, '24.12.2027').options.length).toBe(3));
  });
});

describe('Rückfrage „für alle Termine“', () => {
  const mehrere = async () => {
    zeigen();
    const f = await fenster();
    woechentlich(f);
    await reiterEvents(f);
    return f;
  };
  const frage = () => screen.queryByRole('alertdialog');

  it('bei mehr als einer Zeile fragt das Fenster – Bestätigen setzt die Vorlage in allen Zeilen', async () => {
    const f = await mehrere();
    fireEvent.change(auswahl(f, '31.12.2027'), { target: { value: '7' } });
    const d = frage()!;
    expect(within(d).getByText('Achtung')).toBeTruthy();
    expect(
      within(d).getByText('Soll die Vorlage für alle Termine übernommen werden?'),
    ).toBeTruthy();
    fireEvent.click(within(d).getByRole('button', { name: 'Bestätigen' }));
    expect(frage()).toBeNull();
    expect(werte(f)).toEqual(['7', '7', '7', '7']);
  });

  it('Abbrechen lässt die Vorlage nur in dieser Zeile', async () => {
    const f = await mehrere();
    fireEvent.change(auswahl(f, '31.12.2027'), { target: { value: '7' } });
    fireEvent.click(within(frage()!).getByRole('button', { name: 'Abbrechen' }));
    expect(frage()).toBeNull();
    expect(werte(f)).toEqual(['', '7', '', '']);
  });

  it('die Vorlage mit der Nummer 0 („Standard“) fragt ebenfalls und gilt als gewählt, nicht als leer', async () => {
    const f = await mehrere();
    fireEvent.change(auswahl(f, '24.12.2027'), { target: { value: '0' } });
    expect(frage()).not.toBeNull();
    expect(auswahl(f, '24.12.2027').value).toBe('0');
    fireEvent.click(within(frage()!).getByRole('button', { name: 'Bestätigen' }));
    expect(werte(f)).toEqual(['0', '0', '0', '0']);
  });

  it('den leeren Eintrag wählen fragt nicht – er leert nur diese Zeile', async () => {
    const f = await mehrere();
    fireEvent.change(auswahl(f, '31.12.2027'), { target: { value: '7' } });
    fireEvent.click(within(frage()!).getByRole('button', { name: 'Bestätigen' }));
    fireEvent.change(auswahl(f, '07.01.2028'), { target: { value: '' } });
    expect(frage()).toBeNull();
    expect(werte(f)).toEqual(['7', '7', '', '7']);
  });

  it('bei genau einer Zeile gibt es keine Rückfrage', async () => {
    zeigen();
    const f = await fenster();
    await reiterEvents(f);
    fireEvent.change(auswahl(f, '24.12.2027'), { target: { value: '7' } });
    expect(frage()).toBeNull();
    expect(auswahl(f, '24.12.2027').value).toBe('7');
  });
});

describe('Speichern: Events werden nachgelesen', () => {
  const speichern = async (f: HTMLElement) => {
    await waitFor(() =>
      expect(within(f).getByRole<HTMLButtonElement>('button', { name: 'Speichern' }).disabled).toBe(
        false,
      ),
    );
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
  };
  const mitEvent = async (buchen: number[] = []) => {
    zeigen([4], buchen);
    const f = await fenster();
    woechentlich(f);
    await reiterEvents(f);
    fireEvent.change(auswahl(f, '31.12.2027'), { target: { value: '0' } });
    fireEvent.click(within(frage()).getByRole('button', { name: 'Abbrechen' }));
    return f;
  };
  const frage = () => screen.getByRole('alertdialog');

  it('die gewählte Zeile geht zu ChurchTools (Nummer 0 inklusive); sind alle Events da, geht das Fenster zu', async () => {
    vi.mocked(terminLegen).mockResolvedValue({
      art: 'angelegt',
      id: 700,
      events: { fehlend: [], unklar: false },
    });
    const f = await mitEvent();
    await speichern(f);
    await waitFor(() => expect(onFertig).toHaveBeenCalledWith(STAND));
    expect(vi.mocked(terminLegen).mock.calls[0][0].eintrag.events).toEqual({ '2027-12-31': 0 });
  });

  it('ein Event fehlt: der Vermerk entsteht, das Fenster bleibt und nennt den Termin', async () => {
    vi.mocked(terminLegen).mockResolvedValue({
      art: 'angelegt',
      id: 700,
      events: { fehlend: ['2027-12-31'], unklar: false },
    });
    const f = await mitEvent();
    await speichern(f);
    expect(await within(f).findByText(/am 31\.12\.2027 wurde kein Event angelegt/)).toBeTruthy();
    expect(within(f).getByText(/bitte in ChurchTools anlegen/)).toBeTruthy();
    expect(terminVermerken).toHaveBeenCalledTimes(1);
    expect(onFertig).not.toHaveBeenCalled();
    fireEvent.click(within(f).getByRole('button', { name: 'Fertig' }));
    expect(onFertig).toHaveBeenCalledWith(STAND);
  });

  it('Nachlesen unklar: eigene Meldung – nicht „fehlt“', async () => {
    vi.mocked(terminLegen).mockResolvedValue({
      art: 'angelegt',
      id: 700,
      events: { fehlend: [], unklar: true },
    });
    const f = await mitEvent();
    await speichern(f);
    expect(
      await within(f).findByText(/Events angelegt wurden, ließ sich nicht nachlesen/),
    ).toBeTruthy();
    expect(within(f).queryByText(/wurde kein Event/)).toBeNull();
  });

  it('Buchung UND Event fehlen: EINE Meldung mit beidem', async () => {
    vi.mocked(terminLegen).mockResolvedValue({
      art: 'angelegt',
      id: 700,
      buchungen: { fehlend: [1], unklar: false },
      events: { fehlend: ['2027-12-31'], unklar: false },
    });
    const f = await mitEvent([1]);
    await speichern(f);
    const meldung = await within(f).findByText(/wurde nicht gebucht/);
    expect(meldung.textContent).toMatch(/wurde kein Event angelegt/);
    expect(within(f).getAllByRole('alert')).toHaveLength(1);
  });

  it('Vermerk scheitert: „Nochmal vermerken“ zeigt die Event-Meldung weiter, es wird nichts doppelt angelegt', async () => {
    vi.mocked(terminLegen).mockResolvedValue({
      art: 'angelegt',
      id: 700,
      events: { fehlend: ['2027-12-31'], unklar: false },
    });
    vi.mocked(terminVermerken).mockRejectedValueOnce(new Error('weg'));
    const f = await mitEvent();
    await speichern(f);
    await within(f).findByRole('button', { name: 'Nochmal vermerken' });
    expect(within(f).getByText(/wurde kein Event angelegt/)).toBeTruthy();
    fireEvent.click(within(f).getByRole('button', { name: 'Nochmal vermerken' }));
    await within(f).findByRole('button', { name: 'Fertig' });
    expect(terminLegen).toHaveBeenCalledTimes(1);
  });

  it('ChurchTools lehnt ab (z. B. 422): die Meldung steht im Fenster, nichts wird vermerkt', async () => {
    vi.mocked(terminLegen).mockRejectedValue(new Error('Datum passt nicht zur Reihe'));
    const f = await mitEvent();
    await speichern(f);
    await within(f).findByRole('alert');
    expect(terminVermerken).not.toHaveBeenCalled();
  });
});

describe('„Nur verknüpfen“ und Vorlagen', () => {
  it('beim Verknüpfen steht im Reiter, dass keine Events angelegt werden – und die Auswahl ist gesperrt', async () => {
    vi.mocked(K.kalenderTermineAmTag).mockResolvedValue([
      { id: 161, titel: 'Heiligabend – Familiengottesdienst', beginn: '' },
    ]);
    zeigen();
    const f = await fenster();
    await within(f).findByText(/schon „Heiligabend/);
    await reiterEvents(f);
    expect(within(f).getByText(/dabei werden keine Events angelegt/)).toBeTruthy();
    expect(auswahl(f, '24.12.2027').disabled).toBe(true);
    fireEvent.click(within(f).getByLabelText(/Trotzdem neu anlegen/));
    expect(within(f).queryByText(/dabei werden keine Events angelegt/)).toBeNull();
    expect(auswahl(f, '24.12.2027').disabled).toBe(false);
  });

  const vorlage = (extra: Partial<TerminVorlage>): TerminVorlage => ({
    id: 9,
    kalender: 4,
    titel: 'Gottesdienst',
    untertitel: '',
    beschreibung: '',
    link: '',
    intern: false,
    ganztaegig: false,
    startzeit: '10:00',
    dauer: 3600,
    art: 7,
    frequenz: 1,
    option: 0,
    wiederDauer: 86_400 * 14,
    adresse: null,
    tags: [],
    imAuftrag: null,
    buchungen: [],
    eventVorlage: null,
    anmeldungTyp: null,
    anmeldungTage: null,
    anmeldungBeenden: null,
    anmeldungVorlage: null,
    ...extra,
  });

  it('eine Termin-Vorlage, die erkennbar eine Eventvorlage nennt (auch 0), setzt sie in alle Zeilen', async () => {
    vi.mocked(V.ladeVorlagen).mockResolvedValue([vorlage({ eventVorlage: 0 })]);
    zeigen();
    const f = await fenster();
    fireEvent.click(await within(f).findByLabelText('Gottesdienst'));
    await reiterEvents(f);
    expect(werte(f)).toEqual(['0', '0', '0']);
  });

  it('eine Termin-Vorlage ohne erkennbare Eventvorlage lässt die Zeilen leer', async () => {
    vi.mocked(V.ladeVorlagen).mockResolvedValue([vorlage({})]);
    zeigen();
    const f = await fenster();
    fireEvent.click(await within(f).findByLabelText('Gottesdienst'));
    await reiterEvents(f);
    expect(werte(f)).toEqual(['', '', '']);
  });
});
