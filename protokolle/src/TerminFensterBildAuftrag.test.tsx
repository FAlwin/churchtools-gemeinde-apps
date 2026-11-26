// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { TerminZeile } from '@shared/protokolle/termine';
import { terminVermerken } from './terminStandSchreiben';
import { nachbauEnde, nachbauStarten, type Nachbau } from './nachbau.testhilfe';
import { TerminFenster } from './TerminFenster';

/**
 * **„Im Auftrag von“ und „Bild“ im Fenster „In Kalender eintragen“** – mit den echten Lesern und Schreibern gegen die
 * nachgestellte ChurchTools-Instanz. „Im Auftrag von“ ändert, wer Einlader der Besprechungsanfrage ist (dann bekomme auch ich
 * eine Mail); das Bild wird nach dem Anlegen hochgeladen und danach **nachgelesen** (ein `200` ist kein Beleg).
 */
vi.mock('./terminStandSchreiben', () => ({ terminVermerken: vi.fn() }));

let ct: Nachbau;
const ZEILE: TerminZeile = {
  schluessel: 'termin-s-b',
  gruppe: { id: 11, name: 'Leitungsteam' },
  sitzung: { id: 's', schluessel: 'p:s', titel: 'Festplanung', beginn: '2026-11-21T18:00:00Z' },
  blockId: 'b',
  text: 'Heiligabend, 16 Uhr',
  datum: '2027-12-24',
  punkt: null,
};
const onFertig = vi.fn();
const zeigen = (extra: { vorlagenSchreiben?: number[] } = {}) =>
  render(
    <TerminFenster
      zeile={ZEILE}
      gruppenKalender={4}
      schreibbar={[4, 2]}
      ort={{ modul: 24, kategorie: 61 }}
      ich={1}
      zeitzone="Europe/Berlin"
      onFertig={onFertig}
      onClose={vi.fn()}
      {...extra}
    />,
  );
const fenster = async () => await screen.findByRole('dialog', { name: 'In Kalender eintragen' });
const bereit = async (f: HTMLElement, name = 'Speichern') =>
  await waitFor(() =>
    expect(within(f).getByRole<HTMLButtonElement>('button', { name }).disabled).toBe(false),
  );
const speichern = async (f: HTMLElement, name = 'Speichern') => {
  await bereit(f, name);
  fireEvent.click(within(f).getByRole('button', { name }));
};
const BEN = { id: 49, vor: 'Ben', nach: 'Test A2' };
/** Im Feld „Im Auftrag von“ „Ben“ tippen und den Vorschlag anklicken – die Suche wartet echte 300 ms. */
const personWaehlen = async (f: HTMLElement) => {
  fireEvent.change(await within(f).findByRole('combobox', { name: 'Im Auftrag von' }), {
    target: { value: 'Ben' },
  });
  fireEvent.click(await within(f).findByRole('option', { name: 'Ben Test A2' }));
};
const bildWaehlen = async (f: HTMLElement, name = 'plakat.png') => {
  const datei = new File(['x'], name, { type: 'image/png' });
  fireEvent.change(await within(f).findByLabelText('Bild wählen'), { target: { files: [datei] } });
  return datei;
};
const bildPosts = () => ct.aufrufe.filter((a) => a.startsWith('POST /files/appointment_image/'));
beforeEach(() => {
  ct = nachbauStarten();
  ct.kalender = [
    { id: 4, name: 'Gemeindeleitung', type: 'group' },
    { id: 2, name: 'Gottesdienst', type: 'church' },
  ];
  ct.kandidaten = [
    {
      type: 'person',
      person: { title: 'Alwin Friesen', domainType: 'person', domainIdentifier: '1' },
    },
  ];
  ct.personen = [BEN, { id: 50, vor: 'Anna', nach: 'Alt' }];
  vi.mocked(terminVermerken).mockResolvedValue({ vermerke: [] } as never);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  // jsdom kennt keine Objekt-URLs.
  URL.createObjectURL = vi.fn(() => 'blob:vorschau');
  URL.revokeObjectURL = vi.fn();
  onFertig.mockReset();
});
afterEach(() => {
  cleanup();
  nachbauEnde();
  delete (URL as { createObjectURL?: unknown }).createObjectURL;
  delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
});

describe('Im Auftrag von', () => {
  it('steht zwischen Link und Ort; Tippen schlägt Personen vor, ein Klick setzt den Namen ins Feld, das Kreuz leert es', async () => {
    zeigen();
    const f = await fenster();
    const namen = [...f.querySelectorAll('[role="group"]')].map((g) =>
      g.getAttribute('aria-label'),
    );
    const reihenfolge = namen.filter((n) =>
      ['Im Auftrag von', 'Ort', 'Bild', 'Tags'].includes(n ?? ''),
    );
    expect(reihenfolge).toEqual(['Im Auftrag von', 'Ort', 'Bild', 'Tags']);
    await personWaehlen(f);
    const feld = within(f).getByRole<HTMLInputElement>('textbox', { name: 'Im Auftrag von' });
    expect(feld.value).toBe('Ben Test A2');
    expect(within(f).queryByRole('listbox')).toBeNull();
    fireEvent.click(within(f).getByRole('button', { name: 'Im Auftrag von leeren' }));
    expect(within(f).getByRole('combobox', { name: 'Im Auftrag von' })).toBeTruthy();
    await speichern(f);
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(ct.terminRumpf).not.toHaveProperty('onBehalfOfPid');
  });

  it('Person im Feld gewählt (nicht über eine Vorlage), Besprechungsanfrage nur an mich: „sofort … an 1 Person“, und genau diese Mail geht raus', async () => {
    // Gemessen 26.11.2026: mit `onBehalfOfPid` ist diese Person der Einlader; meine eigene Anfrage steht auf „offen“ (Mail).
    zeigen();
    const f = await fenster();
    await personWaehlen(f);
    fireEvent.click(await within(f).findByRole('button', { name: 'Besprechungsanfragen' }));
    fireEvent.click(
      await within(f).findByRole('switch', { name: 'Besprechungsanfrage erstellen' }),
    );
    await within(f).findByText('Alwin Friesen');
    expect(
      within(f)
        .getByText(/sofort/)
        .closest('p')?.textContent,
    ).toBe('Die Einladung geht sofort per Mail an 1 Person.');
    await speichern(f);
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(ct.terminRumpf?.onBehalfOfPid).toBe(49);
    expect(ct.mails).toEqual([{ person: 1, art: 'neu' }]);
  });

  it('ohne Person im Feld: dieselbe Anfrage nur an mich bleibt ohne Mail und ohne „sofort“', async () => {
    zeigen();
    const f = await fenster();
    fireEvent.click(await within(f).findByRole('button', { name: 'Besprechungsanfragen' }));
    fireEvent.click(
      await within(f).findByRole('switch', { name: 'Besprechungsanfrage erstellen' }),
    );
    await within(f).findByText('Alwin Friesen');
    expect(within(f).queryByText(/sofort/)).toBeNull();
    await speichern(f);
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(ct.mails).toEqual([]);
  });

  it('Vorlage mit „Im Auftrag von“: der Name wird nachgeladen und steht im Feld', async () => {
    ct.vorlagen = [
      {
        id: 8,
        calendarId: 4,
        title: 'Mit Auftrag',
        startTime: '16:00',
        duration: 3600,
        allDay: false,
        isInternal: false,
        repeatId: 0,
        onBehalfOfPid: 49,
      },
    ];
    zeigen();
    const f = await fenster();
    fireEvent.click(await within(f).findByLabelText('Mit Auftrag'));
    await waitFor(() =>
      expect(
        within(f).getByRole<HTMLInputElement>('textbox', { name: 'Im Auftrag von' }).value,
      ).toBe('Ben Test A2'),
    );
  });

  it('scheitert das Nachladen des Namens, steht „Person 49“ da – und die Nummer geht trotzdem mit', async () => {
    ct.vorlagen = [
      {
        id: 8,
        calendarId: 4,
        title: 'Mit Auftrag',
        startTime: '16:00',
        duration: 3600,
        allDay: false,
        isInternal: false,
        repeatId: 0,
        onBehalfOfPid: 49,
      },
    ];
    const echt = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation((i, init) =>
      String(i).includes('/persons?')
        ? Promise.reject(new TypeError('Failed to fetch'))
        : echt(i, init),
    );
    zeigen();
    const f = await fenster();
    fireEvent.click(await within(f).findByLabelText('Mit Auftrag'));
    await waitFor(() =>
      expect(
        within(f).getByRole<HTMLInputElement>('textbox', { name: 'Im Auftrag von' }).value,
      ).toBe('Person 49'),
    );
    await speichern(f);
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(ct.terminRumpf?.onBehalfOfPid).toBe(49);
  });

  it('„Als Vorlage speichern“ schreibt die im Feld gewählte Person als `onBehalfOfPid`', async () => {
    zeigen({ vorlagenSchreiben: [4] });
    const f = await fenster();
    await personWaehlen(f);
    await bereit(f, 'Als Vorlage speichern');
    fireEvent.click(within(f).getByRole('button', { name: 'Als Vorlage speichern' }));
    await within(f).findByText('Die Vorlage „Heiligabend“ ist gespeichert.');
    expect(ct.vorlagen).toEqual([
      expect.objectContaining({ title: 'Heiligabend', onBehalfOfPid: 49 }),
    ]);
  });
});

describe('Bild', () => {
  it('„+ Hinzufügen“ öffnet die Dateiwahl (nur Bilder); danach Vorschau mit Dateiname, ✕ entfernt sie und gibt die Objekt-URL frei', async () => {
    zeigen();
    const f = await fenster();
    const wahl = await within(f).findByLabelText<HTMLInputElement>('Bild wählen');
    expect(wahl.accept).toBe('image/*');
    const klick = vi.spyOn(wahl, 'click');
    const reihe = within(f).getByRole('group', { name: 'Bild' });
    fireEvent.click(within(reihe).getByRole('button', { name: '+ Hinzufügen' }));
    expect(klick).toHaveBeenCalled();
    const datei = await bildWaehlen(f);
    expect(URL.createObjectURL).toHaveBeenCalledWith(datei);
    expect(within(reihe).getByText('plakat.png')).toBeTruthy();
    expect(reihe.querySelector('img')?.getAttribute('src')).toBe('blob:vorschau');
    fireEvent.click(within(reihe).getByRole('button', { name: 'Bild entfernen' }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:vorschau');
    expect(within(reihe).getByRole('button', { name: '+ Hinzufügen' })).toBeTruthy();
  });

  it('beim Schließen des Fensters wird die Objekt-URL freigegeben', async () => {
    const r = zeigen();
    const f = await fenster();
    await bildWaehlen(f);
    r.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:vorschau');
  });

  it('Erfolg: nach dem Anlegen wird hochgeladen und am Termin nachgelesen – das Fenster geht zu', async () => {
    zeigen();
    const f = await fenster();
    await bildWaehlen(f);
    await speichern(f);
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    const termin = ct.termine[0];
    expect(bildPosts()).toEqual([`POST /files/appointment_image/${termin.id}`]);
    expect(termin.bild?.name).toBe('plakat.png');
    // Danach wurde der Termin neu gelesen (zweiter Abruf nach dem Anlegen, der erste prüft Titel und Beginn).
    expect(
      ct.aufrufe.filter((a) => a === `GET /calendars/4/appointments/${termin.id}`).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('ohne Bild: kein Upload', async () => {
    zeigen();
    const f = await fenster();
    await speichern(f);
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(bildPosts()).toEqual([]);
  });

  it('Upload scheitert (5xx): der Termin steht, der Vermerk entsteht, das Fenster nennt es und bleibt bis „Fertig“ offen', async () => {
    ct.bildFehler = { status: 502, angelegt: false };
    zeigen();
    const f = await fenster();
    await bildWaehlen(f);
    await speichern(f);
    await within(f).findByText(/Das Bild wurde nicht am Termin gespeichert/);
    expect(ct.termine).toHaveLength(1);
    expect(vi.mocked(terminVermerken)).toHaveBeenCalledTimes(1);
    expect(onFertig).not.toHaveBeenCalled();
    fireEvent.click(within(f).getByRole('button', { name: 'Fertig' }));
    expect(onFertig).toHaveBeenCalled();
  });

  it('Upload sagt 5xx, hat das Bild aber gespeichert: das Nachlesen belegt es – keine Meldung', async () => {
    ct.bildFehler = { status: 504, angelegt: true };
    zeigen();
    const f = await fenster();
    await bildWaehlen(f);
    await speichern(f);
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(ct.termine[0].bild?.name).toBe('plakat.png');
  });

  it('Upload sagt 200, speichert aber nichts: das Fenster meldet es, der Termin bleibt', async () => {
    ct.bildSchlucken = true;
    zeigen();
    const f = await fenster();
    await bildWaehlen(f);
    await speichern(f);
    await within(f).findByText(/Das Bild wurde nicht am Termin gespeichert/);
    expect(ct.termine).toHaveLength(1);
    expect(vi.mocked(terminVermerken)).toHaveBeenCalledTimes(1);
    expect(onFertig).not.toHaveBeenCalled();
  });

  it('Upload klappt, das Nachlesen scheitert: „ließ sich nicht nachlesen“ statt „fehlt“', async () => {
    zeigen();
    const f = await fenster();
    await bildWaehlen(f);
    const echt = vi.mocked(fetch).getMockImplementation()!;
    let hochgeladen = false;
    vi.mocked(fetch).mockImplementation((i, init) => {
      if (
        hochgeladen &&
        /\/appointments\/\d+$/.test(String(i)) &&
        (init?.method ?? 'GET') === 'GET'
      )
        return Promise.resolve(new Response('{}', { status: 500 }));
      return echt(i, init);
    });
    const xhr = globalThis.XMLHttpRequest;
    vi.stubGlobal(
      'XMLHttpRequest',
      class extends xhr {
        override send(body: Document | XMLHttpRequestBodyInit | null): void {
          hochgeladen = true;
          super.send(body);
        }
      },
    );
    await speichern(f);
    await within(f).findByText(/Ob das Bild gespeichert wurde, ließ sich nicht nachlesen/);
    expect(ct.termine).toHaveLength(1);
    expect(vi.mocked(terminVermerken)).toHaveBeenCalledTimes(1);
  });

  it('„Nur verknüpfen“: kein Upload – der vorhandene Termin bleibt ohne Bild', async () => {
    ct.termine = [
      {
        kalender: 4,
        id: 9,
        titel: 'Heiligabend',
        beginn: '2027-12-24T15:00:00Z',
        ende: '2027-12-24T16:00:00Z',
        anfragen: [],
      },
    ];
    zeigen();
    const f = await fenster();
    await bildWaehlen(f);
    await within(f).findByText(/schon „Heiligabend“/);
    await speichern(f, 'Verknüpfen');
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(bildPosts()).toEqual([]);
    expect(ct.termine[0].bild).toBeUndefined();
    expect(ct.aufrufe.filter((a) => a === 'POST /calendars/4/appointments')).toEqual([]);
  });

  it('eine Vorlage lässt das gewählte Bild in Ruhe', async () => {
    ct.vorlagen = [
      {
        id: 8,
        calendarId: 4,
        title: 'Mit Vorlage',
        startTime: '16:00',
        duration: 3600,
        allDay: false,
        isInternal: false,
        repeatId: 0,
      },
    ];
    zeigen();
    const f = await fenster();
    await bildWaehlen(f);
    fireEvent.click(await within(f).findByLabelText('Mit Vorlage'));
    await waitFor(() =>
      expect(within(f).getByRole<HTMLInputElement>('textbox', { name: 'Titel *' }).value).toBe(
        'Mit Vorlage',
      ),
    );
    expect(within(f).getByText('plakat.png')).toBeTruthy();
  });
});
