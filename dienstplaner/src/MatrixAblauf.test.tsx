// @vitest-environment jsdom
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { planAus } from '@shared/dienstplan/plan';
import type { RohTermin } from '@shared/dienstplan/termine';
import { startFuer } from './start.testutil';
import { leseAnsicht } from './planenAnsicht';
import { Planen } from './Planen';

/**
 * **Der Ablauf in der Matrix** (E6-6a, Entwurf `e6-6-entwurf-2.html`) – mit dem echten Laden (`ladeAblauf`) und dem
 * echten Schreibweg, nur ChurchTools ist ersetzt. Die Spalten kommen aus dem Erzeuger (`planAus`), nicht aus
 * handgeschriebenen Plänen – sonst stimmten Kalender und Admins des Termins nur im Test.
 */
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ROH = [
  // Kalender 2: darf man bearbeiten (`edit agenda` für 2).
  {
    id: 10,
    name: 'Gottesdienst',
    startDate: '2026-10-18T08:00:00Z',
    calendar: { domainIdentifier: '2' },
  },
  // Kalender 5: nur ansehen.
  {
    id: 11,
    name: 'Gebetsabend',
    startDate: '2026-10-21T17:00:00Z',
    calendar: { domainIdentifier: '5' },
  },
  // Abgesagt – nur ansehen, auch mit Recht.
  {
    id: 12,
    name: 'Gemeindeversammlung',
    startDate: '2026-10-23T17:00:00Z',
    isCanceled: true,
    calendar: { domainIdentifier: '2' },
  },
  // Ohne Ablauf, mit Recht.
  {
    id: 13,
    name: 'Gottesdienst',
    startDate: '2026-10-25T09:00:00Z',
    calendar: { domainIdentifier: '2' },
  },
].map((t) => ({
  ...t,
  eventServices: [{ serviceId: 6, personId: null, name: null }],
})) as RohTermin[];

const START = startFuer({ rechte: { ...startFuer().rechte, ablaufKalender: [2] } });
const PLAN = planAus(ROH, {
  ichId: 1,
  dienste: START.dienste,
  dienstgruppen: START.dienstgruppen,
  zeitzone: 'Europe/Berlin',
  planbar: () => true,
  ganzSichtbar: () => true,
});

const ABLAUF_10 = [
  {
    id: 1,
    type: 'normal',
    title: 'Soundcheck',
    isBeforeEvent: true,
    duration: 1800,
    note: 'Mikros prüfen',
    responsible: {
      text: 'Technik-Team',
      persons: [{ service: '[Ton]', person: { title: 'Tom Test', initials: 'TT' } }],
    },
  },
  { id: 2, type: 'header', title: 'Ankommen' },
  {
    id: 3,
    type: 'song',
    title: 'Lied',
    song: { songId: 41, arrangementId: 410, title: 'Du großer Gott', key: 'C' },
    duration: 300,
  },
];

/**
 * ChurchTools zum Nachspielen: Abläufe je Termin (10 und 11 haben einen, 12 und 13 nicht), Schreiben an Termin 10.
 * `ablauf11` ersetzt die Antwort für Termin 11 (Fehler); `gesperrt10` schließt den Ablauf von Termin 10 ab.
 */
function ct(
  o: { ablauf11?: () => Response; erstesNeuLesenHalten?: boolean; gesperrt10?: boolean } = {},
) {
  let items = ABLAUF_10.map((i, n) => ({ ...i, position: n }));
  const schreiben: string[] = [];
  const gelesen: string[] = [];
  // Das erste Lesen von Termin 10 nach dem ersten Schreiben hält an (mit dem Stand von DAMALS), bis `weiter()`.
  let gehalten: (() => void) | null = null;
  let weiter = () => {};
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = new URL(String(input));
    const methode = init?.method ?? 'GET';
    if (url.pathname.endsWith('/csrftoken')) return Promise.resolve(json(200, { data: 'tok' }));
    if (methode !== 'GET') {
      schreiben.push(`${methode} ${url.pathname}`);
      const id = Number(url.pathname.split('/').pop());
      if (methode === 'PUT') {
        const rumpf = JSON.parse(String(init?.body)) as { title?: string };
        items = items.map((i) => (i.id === id ? { ...i, title: rumpf.title ?? i.title } : i));
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    const agenda = /^\/api\/events\/(\d+)\/agenda$/.exec(url.pathname);
    if (agenda) {
      gelesen.push(agenda[1]);
      if (agenda[1] === '10') {
        const antwort = json(200, {
          data: { calendarId: 2, isLocked: o.gesperrt10 === true, items },
        });
        if (o.erstesNeuLesenHalten && schreiben.length === 1 && !gehalten) {
          return new Promise<Response>((r) => {
            gehalten = () => r(antwort);
            weiter = gehalten;
          });
        }
        return Promise.resolve(antwort);
      }
      if (agenda[1] === '11') {
        return Promise.resolve(
          o.ablauf11?.() ??
            json(200, {
              data: { calendarId: 5, isLocked: false, items: [{ id: 90, title: 'Gebet' }] },
            }),
        );
      }
      return Promise.resolve(json(404, { message: 'Not found.' }));
    }
    if (url.pathname === '/api/songs') {
      return Promise.resolve(
        json(200, {
          data: [{ id: 41, name: 'Du großer Gott', author: 'Carl Boberg', arrangements: [] }],
        }),
      );
    }
    // `custommodules` (keine Musik-App) und `whoami` für die Fehler-Übersetzung.
    return Promise.resolve(json(200, { data: url.pathname.endsWith('/whoami') ? { id: 1 } : [] }));
  });
  return { spy, schreiben, gelesen, weiter: () => weiter() };
}

function zeige(o: { handy?: boolean; start?: typeof START } = {}) {
  render(
    <StrictMode>
      <Planen
        zustand={{ art: 'fertig', zeilen: [], plan: PLAN, wochen: 8 }}
        handy={o.handy ?? false}
        onNochmal={() => {}}
        onMehr={() => {}}
        mehrMoeglich={false}
        ladeZeitraum={() => new Promise<never>(() => {})}
        heute="2026-10-14"
        ablauf={{ start: o.start ?? START, zeitzone: 'Europe/Berlin' }}
      />
    </StrictMode>,
  );
}

/** Die Zellen der Gruppenzeile „Ablauf“ (ohne die Kopfzelle). */
const gruppenZeile = () =>
  screen
    .getByRole('button', { name: /^Ablauf$/ })
    .closest('tr')!
    .querySelectorAll('td');
/** Die Zelle mit dem Ablauf eines Termins (Spalte `n`, 0 = erster Termin). */
const ablaufZelle = (n: number) =>
  screen
    .getByRole('button', { name: /^Ablauf$/ })
    .closest('tr')!
    .nextElementSibling!.querySelectorAll('td')[n];

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Matrix – Ablauf (E6-6a)', () => {
  it('oben über den Dienstgruppen, aufgeklappt, je Termin „N Punkte“ bzw. „kein Ablauf“', async () => {
    ct();
    zeige();
    await waitFor(() =>
      expect([...gruppenZeile()].map((td) => td.textContent)).toEqual([
        '3 Punkte',
        '1 Punkt',
        'kein Ablauf',
        'kein Ablauf',
      ]),
    );
    // Die erste Zeile im Rumpf ist der Ablauf – vor den Dienstgruppen.
    const zeilen = screen.getAllByRole('rowheader').map((r) => r.textContent);
    expect(zeilen[0]).toBe('Ablauf');
    expect(zeilen.indexOf('Ablauf')).toBeLessThan(zeilen.findIndex((t) => t?.includes('Technik')));
    expect(screen.getByRole('button', { name: /^Ablauf$/ }).getAttribute('aria-expanded')).toBe(
      'true',
    );
  });

  it('schmale Form: Uhrzeit, Dauer, Titel samt Liedname – ohne Zuständige, Notiz und Lied-Karte', async () => {
    ct();
    zeige();
    const zelle = await waitFor(() => {
      const z = ablaufZelle(0);
      expect(within(z).getByText('Soundcheck')).toBeTruthy();
      return z;
    });
    expect(within(zelle).getByText('30 Min')).toBeTruthy();
    expect(within(zelle).getByText('Ankommen')).toBeTruthy();
    expect(within(zelle).getByText('Du großer Gott')).toBeTruthy();
    expect(within(zelle).queryByText(/Tom Test|Technik-Team/)).toBeNull();
    expect(within(zelle).queryByText('Mikros prüfen')).toBeNull();
    // Keine Lied-Karte (Tonart · Autor) und keine Kreise mit Kürzeln.
    expect(within(zelle).queryByText(/Carl Boberg/)).toBeNull();
    expect(within(zelle).queryByText('TT')).toBeNull();
  });

  it('ein Lied antippen öffnet die Lied-Ansicht (wie in der Termin-Ansicht)', async () => {
    ct();
    zeige();
    await waitFor(() => expect(within(ablaufZelle(0)).getByText('Du großer Gott')).toBeTruthy());
    fireEvent.click(within(ablaufZelle(0)).getByText('Du großer Gott'));
    const fenster = await screen.findByRole('dialog');
    expect(within(fenster).getByText('Du großer Gott')).toBeTruthy();
    expect(within(fenster).getByText(/Carl Boberg/)).toBeTruthy();
  });

  it('EIN „Ablauf bearbeiten“ öffnet alle Termine, die man bearbeiten darf; die übrigen tragen ein Schloss; „Fertig“ schließt', async () => {
    ct();
    zeige();
    await waitFor(() => expect(within(ablaufZelle(0)).getByText('Soundcheck')).toBeTruthy());
    // Nur ansehen: keine Griffe, kein „Ablauf anlegen“.
    expect(screen.queryAllByRole('button', { name: 'Verschieben' })).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Ablauf anlegen/ })).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: 'Ablauf bearbeiten – alle gezeigten Termine' }),
    );
    // Termin 10 (Kalender 2): Griffe, und das grüne Plus steht oben neben „3 Punkte“ – nicht mehr als „+ Punkt“ unter
    // dem Ablauf (E6-6c).
    expect(within(ablaufZelle(0)).getAllByRole('button', { name: 'Verschieben' })).toHaveLength(3);
    expect(within(ablaufZelle(0)).queryByRole('button', { name: /Punkt/ })).toBeNull();
    expect(
      within(gruppenZeile()[0]).getByRole('button', {
        name: 'Eintrag hinzufügen – Gottesdienst, So, 18.10.',
      }),
    ).toBeTruthy();
    // Wo man nur ansieht oder kein Ablauf ist, gibt es kein Plus.
    for (const n of [1, 2, 3]) {
      expect(
        within(gruppenZeile()[n]).queryByRole('button', { name: /Eintrag hinzufügen/ }),
      ).toBeNull();
    }
    // Termin 11 (Kalender 5) und 12 (abgesagt): nur ansehen, mit Schloss in der Gruppenzeile.
    expect(within(ablaufZelle(1)).queryAllByRole('button', { name: 'Verschieben' })).toHaveLength(
      0,
    );
    expect(within(gruppenZeile()[1]).getByLabelText('Nur ansehen')).toBeTruthy();
    expect(within(gruppenZeile()[2]).getByLabelText('Nur ansehen')).toBeTruthy();
    expect(within(ablaufZelle(2)).queryByRole('button', { name: /Ablauf anlegen/ })).toBeNull();
    // Termin 13 (ohne Ablauf, mit Recht): „Ablauf anlegen“ erst jetzt.
    expect(within(ablaufZelle(3)).getByRole('button', { name: /Ablauf anlegen/ })).toBeTruthy();
    expect(within(gruppenZeile()[0]).queryByLabelText(/ansehen/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Fertig' }));
    expect(screen.queryAllByRole('button', { name: 'Verschieben' })).toHaveLength(0);
  });

  it('„Ablauf bearbeiten“ steht mit Wort oben in der Leiste (E6-6c), nicht in der Tabelle; im Bearbeiten „Fertig“', async () => {
    ct();
    zeige();
    await waitFor(() => expect(within(ablaufZelle(0)).getByText('Soundcheck')).toBeTruthy());
    const knopf = screen.getByRole('button', {
      name: 'Ablauf bearbeiten – alle gezeigten Termine',
    });
    expect(knopf.textContent).toBe('Ablauf bearbeiten');
    expect(knopf.closest('table')).toBeNull();
    fireEvent.click(knopf);
    expect(screen.getByRole('button', { name: 'Fertig' }).textContent).toBe('Fertig');
  });

  it('das Plus neben „N Punkte“ klappt das kleine Menü auf – kein Blatt von unten – und öffnet das Punkt-Fenster', async () => {
    ct();
    zeige();
    await waitFor(() => expect(within(ablaufZelle(0)).getByText('Soundcheck')).toBeTruthy());
    fireEvent.click(
      screen.getByRole('button', { name: 'Ablauf bearbeiten – alle gezeigten Termine' }),
    );
    const plus = within(gruppenZeile()[0]).getByRole('button', {
      name: 'Eintrag hinzufügen – Gottesdienst, So, 18.10.',
    });
    fireEvent.click(plus);
    // Das Menü steht beim Plus, in der Gruppenzeile.
    const menue = within(gruppenZeile()[0]).getByRole('menu', { name: 'Option wählen' });
    expect(screen.queryByRole('dialog', { name: 'Option wählen' })).toBeNull();
    fireEvent.click(within(menue).getByRole('menuitem', { name: 'Programmpunkt hinzufügen' }));
    expect(await screen.findByRole('dialog', { name: 'Neuer Eintrag' })).toBeTruthy();
  });

  it('abgeschlossener Ablauf: im Bearbeiten das Schloss statt des Plus', async () => {
    ct({ gesperrt10: true });
    zeige();
    await waitFor(() => expect(within(ablaufZelle(0)).getByText('Soundcheck')).toBeTruthy());
    fireEvent.click(
      screen.getByRole('button', { name: 'Ablauf bearbeiten – alle gezeigten Termine' }),
    );
    expect(within(gruppenZeile()[0]).getByLabelText('Abgeschlossen – nur ansehen')).toBeTruthy();
    expect(
      within(gruppenZeile()[0]).queryByRole('button', { name: /Eintrag hinzufügen/ }),
    ).toBeNull();
  });

  it('ohne Recht an allen gezeigten Terminen: kein „Ablauf bearbeiten“', async () => {
    ct();
    zeige({ start: startFuer() });
    await waitFor(() => expect(gruppenZeile()[0].textContent).toBe('3 Punkte'));
    expect(screen.queryByRole('button', { name: /Ablauf bearbeiten/ })).toBeNull();
  });

  it('bearbeiten: Punkt antippen → Punkt-Fenster, ein PUT, danach neu gelesen – auch im StrictMode', async () => {
    const c = ct();
    zeige();
    await waitFor(() => expect(within(ablaufZelle(0)).getByText('Soundcheck')).toBeTruthy());
    fireEvent.click(
      screen.getByRole('button', { name: 'Ablauf bearbeiten – alle gezeigten Termine' }),
    );
    fireEvent.click(within(ablaufZelle(0)).getAllByRole('button', { name: 'Bearbeiten' })[0]);
    fireEvent.change(screen.getByPlaceholderText('Titel'), { target: { value: 'Technik-Check' } });
    const vorher = c.gelesen.filter((id) => id === '10').length;
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(c.schreiben).toEqual(['PUT /api/events/10/agenda/items/1']));
    // Neu gelesen und übernommen – auch nach „Fertig“ steht der neue Titel in der schmalen Ansicht.
    await waitFor(() =>
      expect(c.gelesen.filter((id) => id === '10').length).toBeGreaterThan(vorher),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fertig' }));
    expect(await within(ablaufZelle(0)).findByText('Technik-Check')).toBeTruthy();
  });

  it('zweimal schnell gespeichert: ein langsames älteres Neu-Lesen überschreibt das neuere nicht', async () => {
    const c = ct({ erstesNeuLesenHalten: true });
    zeige();
    await waitFor(() => expect(within(ablaufZelle(0)).getByText('Soundcheck')).toBeTruthy());
    fireEvent.click(
      screen.getByRole('button', { name: 'Ablauf bearbeiten – alle gezeigten Termine' }),
    );
    const speichere = async (titel: string, nr: number) => {
      fireEvent.click(within(ablaufZelle(0)).getAllByRole('button', { name: 'Bearbeiten' })[0]);
      fireEvent.change(screen.getByPlaceholderText('Titel'), { target: { value: titel } });
      fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
      await waitFor(() => expect(c.schreiben).toHaveLength(nr));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    };
    await speichere('Eins', 1); // das Neu-Lesen danach hängt – mit dem Stand „Eins“
    const zehn = () => c.gelesen.filter((id) => id === '10').length;
    const vorher = zehn();
    await speichere('Zwei', 2); // dieses kommt sofort – mit „Zwei“
    // Erst wenn das neuere Lesen angekommen und übernommen ist, kommt die alte Antwort.
    await waitFor(() => expect(zehn()).toBeGreaterThan(vorher));
    await act(() => new Promise((r) => setTimeout(r, 30)));
    c.weiter(); // jetzt erst die alte Antwort
    fireEvent.click(screen.getByRole('button', { name: 'Fertig' }));
    expect(await within(ablaufZelle(0)).findByText('Zwei')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 50));
    expect(within(ablaufZelle(0)).queryByText('Eins')).toBeNull();
  });

  it('zugeklappt merkt sich das Gerät; der Stift klappt wieder auf', async () => {
    ct();
    zeige();
    await waitFor(() => expect(gruppenZeile()[0].textContent).toBe('3 Punkte'));
    fireEvent.click(screen.getByRole('button', { name: /^Ablauf$/ }));
    expect(screen.getByRole('button', { name: /^Ablauf$/ }).getAttribute('aria-expanded')).toBe(
      'false',
    );
    expect(screen.queryByText('Soundcheck')).toBeNull();
    expect(leseAnsicht().ablaufZu).toBe(true);

    // Neu geöffnet: weiter zu – die Anzahl steht trotzdem da.
    cleanup();
    zeige();
    expect(screen.getByRole('button', { name: /^Ablauf$/ }).getAttribute('aria-expanded')).toBe(
      'false',
    );
    await waitFor(() => expect(gruppenZeile()[0].textContent).toBe('3 Punkte'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Ablauf bearbeiten – alle gezeigten Termine' }),
    );
    expect(screen.getByRole('button', { name: /^Ablauf$/ }).getAttribute('aria-expanded')).toBe(
      'true',
    );
    expect(leseAnsicht().ablaufZu).toBe(false);
  });

  it('ließ sich ein Ablauf nicht laden: „nicht geladen“ – „Erneut versuchen“ lädt ihn nochmal', async () => {
    let einmal = true;
    const c = ct({
      ablauf11: () => {
        if (!einmal) return json(200, { data: { items: [{ id: 90, title: 'Gebet' }] } });
        einmal = false;
        return json(502, {});
      },
    });
    zeige();
    await waitFor(() => expect(gruppenZeile()[1].textContent).toBe('nicht geladen'));
    expect(within(ablaufZelle(1)).getByText(/Ablauf nicht geladen/)).toBeTruthy();
    fireEvent.click(within(ablaufZelle(1)).getByRole('button', { name: 'Erneut versuchen' }));
    expect(await within(ablaufZelle(1)).findByText('Gebet')).toBeTruthy();
    expect(gruppenZeile()[1].textContent).toBe('1 Punkt');
    expect(c.gelesen.filter((id) => id === '11')).toHaveLength(2);
  });
});

describe('Matrix am Handy – Ablauf (E6-6a)', () => {
  it('der gewählte Termin wie in der Termin-Ansicht: mit Zuständigen und Notiz; geladen nur dieser', async () => {
    const c = ct();
    zeige({ handy: true });
    expect(await screen.findByText(/Tom Test/)).toBeTruthy();
    expect(screen.getByText('TT')).toBeTruthy();
    expect(screen.getByText('Mikros prüfen')).toBeTruthy();
    expect(screen.getByText('3 Punkte')).toBeTruthy();
    expect([...new Set(c.gelesen)]).toEqual(['10']);
  });

  it('Bearbeiten wie in der Termin-Ansicht – aber ohne „Neu aufsetzen …“', async () => {
    ct();
    zeige({ handy: true });
    await screen.findByText(/Tom Test/);
    fireEvent.click(screen.getByRole('button', { name: 'Ablauf bearbeiten – Gottesdienst' }));
    expect(screen.getAllByRole('button', { name: 'Verschieben' })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /Neu aufsetzen/ })).toBeNull();
  });
});
