// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { TerminZeile } from '@shared/protokolle/termine';
import { terminVermerken } from './terminStandSchreiben';
import { nachbauEnde, nachbauStarten, type Nachbau } from './nachbau.testhilfe';
import { TerminFenster } from './TerminFenster';

/**
 * **Der Reiter „Besprechungsanfragen“ im Fenster „In Kalender eintragen“** (W15-4) – mit den echten Lesern und Schreibern
 * gegen die nachgestellte ChurchTools-Instanz. Die Test-Instanz verschickt echte Mails; hier zählt darum das **Mail-Protokoll**
 * des Nachbaus (`ct.mails`), nicht nur der Rumpf: Schalter aus → keine Mail, Wechsel des Kalenders → keine Mail, „Nur
 * verknüpfen“ → keine Mail, nach einer unklaren Antwort legt ein zweiter Klick nichts neu an.
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
const person = (id: number, name: string, gruppe?: string, typ = 'groupMember') => ({
  type: gruppe ? typ : 'person',
  ...(gruppe ? { groupName: gruppe } : {}),
  person: { title: name, domainType: 'person', domainIdentifier: String(id) },
});
const onFertig = vi.fn();
const zeigen = () =>
  render(
    <TerminFenster
      zeile={ZEILE}
      gruppenKalender={4}
      schreibbar={[4, 2, 5]}
      ort={{ modul: 24, kategorie: 61 }}
      ich={1}
      zeitzone="Europe/Berlin"
      onFertig={onFertig}
      onClose={vi.fn()}
    />,
  );
const fenster = async () => await screen.findByRole('dialog', { name: 'In Kalender eintragen' });
const posts = () => ct.aufrufe.filter((a) => a === 'POST /calendars/4/appointments');
const bereit = async (f: HTMLElement, name = 'Speichern') =>
  await waitFor(() =>
    expect(within(f).getByRole<HTMLButtonElement>('button', { name }).disabled).toBe(false),
  );
const reiterAnfragen = async (f: HTMLElement) => {
  fireEvent.click(await within(f).findByRole('button', { name: 'Besprechungsanfragen' }));
  return await within(f).findByRole('switch', { name: 'Besprechungsanfrage erstellen' });
};
const anschalten = async (f: HTMLElement) => {
  fireEvent.click(await reiterAnfragen(f));
  await within(f).findByText('Alwin Friesen');
};
const haken = (f: HTMLElement, name: string) =>
  within(f).getByRole<HTMLInputElement>('checkbox', { name: new RegExp(`^${name}`) });
const speichern = async (f: HTMLElement, name = 'Speichern') => {
  await bereit(f, name);
  fireEvent.click(within(f).getByRole('button', { name }));
};
/** Zurück in den Reiter „Kalender“ und den Kalender wechseln. */
const kalenderWechseln = async (f: HTMLElement, id: string) => {
  const reiter = within(f).queryByRole('button', { name: 'Kalender' });
  if (reiter) fireEvent.click(reiter);
  fireEvent.change(await screen.findByLabelText('Kalender'), { target: { value: id } });
};

beforeEach(() => {
  ct = nachbauStarten();
  ct.kalender = [
    { id: 4, name: 'Gemeindeleitung', type: 'group' },
    { id: 2, name: 'Gottesdienst', type: 'church' },
    { id: 5, name: 'Gruppe Zwei', type: 'group' },
  ];
  ct.kandidaten = [
    person(1, 'Alwin Friesen'),
    person(19, 'Spike Musiker', 'TEST Protokolle S2'),
    person(1, 'Alwin Friesen', 'TEST Protokolle S2'),
    person(20, 'Anna Beispiel', 'Leitung'),
  ];
  vi.mocked(terminVermerken).mockResolvedValue({ vermerke: [] } as never);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  onFertig.mockReset();
});
afterEach(() => {
  cleanup();
  nachbauEnde();
});

describe('Reiter nur bei Gruppenkalendern', () => {
  it('Gruppenkalender: der Reiter steht zwischen Kalender und Events/Ressourcen', async () => {
    zeigen();
    const f = await fenster();
    await within(f).findByRole('button', { name: 'Besprechungsanfragen' });
    expect(
      within(f)
        .getAllByRole('button', { name: /^(Kalender|Besprechungsanfragen)$/ })
        .map((b) => b.textContent),
    ).toEqual(['Kalender', 'Besprechungsanfragen']);
  });

  it('Gemeindekalender (church): kein Reiter – und es werden keine Kandidaten geladen', async () => {
    zeigen();
    const f = await fenster();
    await within(f).findByRole('button', { name: 'Besprechungsanfragen' });
    ct.aufrufe.length = 0;
    fireEvent.change(await screen.findByLabelText('Kalender'), { target: { value: '2' } });
    await waitFor(() =>
      expect(within(f).queryByRole('button', { name: 'Besprechungsanfragen' })).toBeNull(),
    );
    expect(ct.aufrufe.join()).not.toMatch(/candidates/);
  });
});

describe('der Reiter selbst', () => {
  it('Schalter ist aus – nichts angezeigt außer dem Satz; an: Suchfeld und Tabelle, ich vorgewählt und nicht abwählbar', async () => {
    zeigen();
    const f = await fenster();
    const schalter = await reiterAnfragen(f);
    expect((schalter as HTMLInputElement).checked).toBe(false);
    within(f).getByText(/alle Personen angefragt werden.*„Gemeindeleitung“/);
    expect(within(f).queryByPlaceholderText('Nach Name oder Gruppe suchen …')).toBeNull();
    fireEvent.click(schalter);
    await within(f).findByText('Bei Wiederholungsterminen wird die gesamte Serie angefragt.');
    await within(f).findByText('Spike Musiker');
    // Alwin kommt einmal (entdoppelt) – mit Gruppenname.
    expect(within(f).getAllByText('Alwin Friesen')).toHaveLength(1);
    const ich = haken(f, 'Alwin');
    expect(ich.checked).toBe(true);
    expect(ich.disabled).toBe(true);
    expect(haken(f, 'Spike').checked).toBe(false);
    expect(within(f).getAllByText('Nicht angefragt')).toHaveLength(2);
    fireEvent.click(haken(f, 'Spike'));
    expect(within(f).getAllByText('Wird angefragt …')).toHaveLength(2);
  });

  it('Suche nach Name oder Gruppe; „alle“ wählt die angezeigten', async () => {
    zeigen();
    const f = await fenster();
    await anschalten(f);
    fireEvent.change(within(f).getByPlaceholderText('Nach Name oder Gruppe suchen …'), {
      target: { value: 'leitung' },
    });
    expect(within(f).queryByText('Spike Musiker')).toBeNull();
    fireEvent.click(within(f).getByRole('checkbox', { name: /Alle angezeigten/ }));
    fireEvent.change(within(f).getByPlaceholderText('Nach Name oder Gruppe suchen …'), {
      target: { value: '' },
    });
    expect(haken(f, 'Anna').checked).toBe(true);
    expect(haken(f, 'Spike').checked).toBe(false);
  });

  it('Kandidaten nicht lesbar: Fehler mit „Noch einmal versuchen“ – und Speichern bleibt gesperrt, solange der Schalter an ist', async () => {
    ct.kandidatenFehler = true;
    zeigen();
    const f = await fenster();
    fireEvent.click(await reiterAnfragen(f));
    await within(f).findByRole('alert');
    expect(within(f).getByRole<HTMLButtonElement>('button', { name: 'Speichern' }).disabled).toBe(
      true,
    );
    // Schalter wieder aus: gespeichert werden darf wieder.
    fireEvent.click(within(f).getByRole('switch'));
    await bereit(f);
  });
});

describe('Mails – das Mail-Protokoll des Nachbaus', () => {
  it('Schalter aus: 0 Mails, kein `meetingrequests`; der Fuß sagt „keine Einladungen“', async () => {
    zeigen();
    const f = await fenster();
    await reiterAnfragen(f);
    within(f).getByText(/Es werden keine Einladungen verschickt/);
    await speichern(f);
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(ct.mails).toEqual([]);
    expect(ct.terminRumpf).not.toHaveProperty('meetingrequests');
  });

  it('Schalter an, ich + zwei andere: genau zwei Mails „Neue Besprechungsanfrage“ – und der Fuß sagt vorher „sofort … an 2 Personen“', async () => {
    zeigen();
    const f = await fenster();
    await anschalten(f);
    fireEvent.click(haken(f, 'Spike'));
    fireEvent.click(haken(f, 'Anna'));
    expect(
      within(f)
        .getByText(/sofort/)
        .closest('p')?.textContent,
    ).toBe('Die Einladung geht sofort per Mail an 2 Personen.');
    expect(within(f).queryByText(/Es werden keine Einladungen verschickt/)).toBeNull();
    await speichern(f);
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    // In der Reihenfolge der Liste (nach Namen): Alwin, Anna, Spike.
    expect(ct.terminRumpf?.meetingrequests).toEqual([
      { inviteeId: 1 },
      { inviteeId: 20 },
      { inviteeId: 19 },
    ]);
    expect(ct.mails.map((m) => `${m.person}:${m.art}`).sort()).toEqual(['19:neu', '20:neu']);
    expect(posts()).toHaveLength(1);
  });

  it('Schalter an, nur ich: keine Mail und kein „sofort“ im Fuß', async () => {
    zeigen();
    const f = await fenster();
    await anschalten(f);
    expect(within(f).queryByText(/sofort/)).toBeNull();
    await speichern(f);
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(ct.mails).toEqual([]);
  });

  it('Vorlage mit „Im Auftrag von“: dann bin auch ich eingeladen – der Fuß sagt „sofort … an 1 Person“, und genau diese Mail geht raus', async () => {
    // Gemessen 26.11.2026: mit `onBehalfOfPid` ist diese Person der Einlader; meine eigene Anfrage steht auf „offen“ (Mail).
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
    await anschalten(f);
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

  it('Personen gewählt, dann Wechsel des Kalenders 4 → Gottesdienst: 0 Mails', async () => {
    zeigen();
    const f = await fenster();
    await anschalten(f);
    fireEvent.click(haken(f, 'Spike'));
    await kalenderWechseln(f, '2');
    await bereit(f);
    expect(within(f).queryByText(/sofort/)).toBeNull();
    await speichern(f);
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(ct.terminRumpf).not.toHaveProperty('meetingrequests');
    expect(ct.mails).toEqual([]);
  });

  it('Wechsel 4 → Gottesdienst → zurück zu 4: die Auswahl ist geleert, der Schalter aus – 0 Mails', async () => {
    zeigen();
    const f = await fenster();
    await anschalten(f);
    fireEvent.click(haken(f, 'Spike'));
    await kalenderWechseln(f, '2');
    await kalenderWechseln(f, '4');
    const schalter = await reiterAnfragen(f);
    expect((schalter as HTMLInputElement).checked).toBe(false);
    await speichern(f);
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(ct.mails).toEqual([]);
    expect(ct.terminRumpf).not.toHaveProperty('meetingrequests');
  });

  it('Wechsel zu einem anderen Gruppenkalender: Auswahl geleert, Schalter aus – 0 Mails', async () => {
    zeigen();
    const f = await fenster();
    await anschalten(f);
    fireEvent.click(haken(f, 'Spike'));
    await kalenderWechseln(f, '5');
    const schalter = await reiterAnfragen(f);
    expect((schalter as HTMLInputElement).checked).toBe(false);
    await speichern(f);
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(ct.mails).toEqual([]);
  });

  it('„Nur verknüpfen“ (am Tag steht schon so ein Termin): 0 Mails, kein POST, der Fuß verspricht nichts', async () => {
    ct.termine.push({
      kalender: 4,
      id: 161,
      titel: 'Heiligabend – Familiengottesdienst',
      beginn: '2027-12-24T09:00:00Z',
      anfragen: [],
    });
    zeigen();
    const f = await fenster();
    await within(f).findByText(/schon „Heiligabend – Familiengottesdienst“/);
    await anschalten(f);
    fireEvent.click(haken(f, 'Spike'));
    within(f).getByText(/Du verknüpfst einen vorhandenen Termin/);
    expect(within(f).queryByText(/sofort/)).toBeNull();
    within(f).getByText(/Es werden keine Einladungen verschickt/);
    await speichern(f, 'Verknüpfen');
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(posts()).toEqual([]);
    expect(ct.mails).toEqual([]);
  });
});

describe('nach dem Anlegen', () => {
  it('ChurchTools lädt eine Person nicht ein: der Termin bleibt, das Fenster nennt sie und geht erst mit „Fertig“ zu', async () => {
    ct.anfrageVerschluckt.add(19);
    zeigen();
    const f = await fenster();
    await anschalten(f);
    fireEvent.click(haken(f, 'Spike'));
    await speichern(f);
    await within(f).findByText(/Nicht angefragt hat ChurchTools: Spike Musiker/);
    expect(onFertig).not.toHaveBeenCalled();
    expect(vi.mocked(terminVermerken)).toHaveBeenCalled();
    fireEvent.click(within(f).getByRole('button', { name: 'Fertig' }));
    expect(onFertig).toHaveBeenCalled();
  });

  it('Anfragen nicht lesbar: „ließ sich nicht nachlesen“, nicht „nicht angefragt“', async () => {
    ct.anfragenLesenFehler = true;
    zeigen();
    const f = await fenster();
    await anschalten(f);
    fireEvent.click(haken(f, 'Spike'));
    await speichern(f);
    const m = await within(f).findByText(/Besprechungsanfragen angekommen sind, ließ sich nicht/);
    expect(m.textContent).not.toMatch(/Nicht angefragt hat/);
  });

  it('unklare Antwort beim Anlegen: ein zweiter Klick auf „Speichern“ legt nichts neu an und schickt keine Mail', async () => {
    ct.terminFehler = { status: 504, angelegt: false };
    zeigen();
    const f = await fenster();
    await anschalten(f);
    fireEvent.click(haken(f, 'Spike'));
    await speichern(f);
    await within(f).findByText(/Einladung doppelt/);
    expect(posts()).toHaveLength(1);
    // Zweiter Klick: Speichern ist gesperrt (der Termin ist nicht auffindbar) – es geht nichts raus.
    await waitFor(() =>
      expect(within(f).getByRole<HTMLButtonElement>('button', { name: 'Speichern' }).disabled).toBe(
        true,
      ),
    );
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(posts()).toHaveLength(1);
    expect(ct.mails).toEqual([]);
  });

  it('unklare Antwort, Termin aber angelegt (Mails sind raus): die Prüfung findet ihn – der zweite Klick heißt „Verknüpfen“ und legt nichts neu an', async () => {
    ct.terminFehler = { status: 504, angelegt: true };
    // Das Nachsehen direkt nach dem Anlegen scheitert (500) – danach, bei der neuen Prüfung, nicht mehr.
    const echtes = globalThis.fetch;
    let sperre = true;
    vi.stubGlobal('fetch', async (...a: Parameters<typeof fetch>) => {
      const url = String(a[0] instanceof Request ? a[0].url : a[0]);
      if (sperre && /calendars\/appointments\?/.test(url) && posts().length > 0)
        return new Response('{}', { status: 500 });
      return echtes(...a);
    });
    zeigen();
    const f = await fenster();
    await anschalten(f);
    fireEvent.click(haken(f, 'Spike'));
    await speichern(f);
    await within(f).findByText(/Einladung doppelt/);
    expect(posts()).toHaveLength(1);
    // Die Prüfung direkt nach der unklaren Antwort ist gescheitert (Fehler mit „Noch einmal versuchen“) – Speichern bleibt gesperrt.
    expect(within(f).getByRole<HTMLButtonElement>('button', { name: 'Speichern' }).disabled).toBe(
      true,
    );
    sperre = false;
    fireEvent.click(await within(f).findByRole('button', { name: 'Noch einmal versuchen' }));
    await bereit(f, 'Verknüpfen');
    fireEvent.click(within(f).getByRole('button', { name: 'Verknüpfen' }));
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(posts()).toHaveLength(1);
    expect(ct.mails).toEqual([{ person: 19, art: 'neu' }]);
  });
});

describe('Handy: Bereiche als Auswahl statt Reiter (Alwin 25.11.2026)', () => {
  it('statt der Reiterleiste eine Auswahl „Bereich“ mit allen Reitern; Wechsel zeigt den Bereich', async () => {
    const echt = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: true,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    try {
      zeigen();
      const f = await fenster();
      const wahl = await within(f).findByLabelText<HTMLSelectElement>('Bereich');
      await waitFor(() =>
        expect([...wahl.options].map((o) => o.text)).toContain('Besprechungsanfragen'),
      );
      expect([...wahl.options].map((o) => o.text)[0]).toBe('Kalender');
      expect(within(f).queryByRole('button', { name: 'Besprechungsanfragen' })).toBeNull();
      fireEvent.change(wahl, { target: { value: 'anfragen' } });
      expect(await within(f).findByText('Besprechungsanfrage erstellen')).toBeTruthy();
    } finally {
      window.matchMedia = echt;
    }
  });
});
