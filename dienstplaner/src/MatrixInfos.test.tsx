// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { planAus } from '@shared/dienstplan/plan';
import type { RohTermin } from '@shared/dienstplan/termine';
import { startFuer } from './start.testutil';
import { leseAnsicht } from './planenAnsicht';
import { Planen } from './Planen';

/**
 * **„Infos & Dateien“ in der Matrix** (T1b, Entwurf `matrix-infos.html` Variante 2) – mit dem echten Speichern über den
 * Kern, nur ChurchTools ist ersetzt. Die Spalten kommen aus dem Erzeuger (`planAus`), samt Infos und Kalender.
 */
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ROH = [
  // Kalender 2 (darf ändern), mit Infos.
  {
    id: 10,
    name: 'Gottesdienst',
    startDate: '2026-10-18T08:00:00Z',
    calendar: { domainIdentifier: '2' },
    description: 'Abendmahl – Becher vorbereiten.\nGäste aus Siegburg.',
  },
  // Kalender 5: nur ansehen, ohne Infos.
  {
    id: 11,
    name: 'Gebetsabend',
    startDate: '2026-10-21T17:00:00Z',
    calendar: { domainIdentifier: '5' },
  },
  // Kalender 2, ohne Infos – „+ Infos“.
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

const START = startFuer({ rechte: { ...startFuer().rechte, terminKalender: [2] } });
const PLAN = planAus(ROH, {
  ichId: 1,
  dienste: START.dienste,
  dienstgruppen: START.dienstgruppen,
  zeitzone: 'Europe/Berlin',
  planbar: () => true,
  ganzSichtbar: () => true,
});

const download = (id: number) =>
  `${window.location.origin}/?q=public/filedownload&id=${id}&filename=abc`;
/** `eventFiles` wie in der Terminliste gemessen (02.11.2026) – ohne Größe. */
const eventFile = (id: number, title: string) => ({
  title,
  domainType: 'file',
  domainIdentifier: String(id),
  frontendUrl: download(id),
});
/** Die ausführliche Liste (`/files/service/{id}`) – aus den `eventFiles` des Termins, mit Größe. */
const ausDenEventFiles = (eventId: number): unknown[] =>
  (
    (ROH_DATEIEN.find((t) => t.id === eventId)?.eventFiles ?? []) as ReturnType<typeof eventFile>[]
  ).map((e) => ({
    id: Number(e.domainIdentifier),
    name: e.title,
    type: 'file',
    fileUrl: e.frontendUrl,
    size: 1024,
  }));
let frischeDateien = ausDenEventFiles;
let ROH_DATEIEN: RohTermin[] = [];

/** ChurchTools: kein Termin hat einen Ablauf; Infos lassen sich speichern (PUT wie gemessen). */
function ct() {
  const termine = new Map(ROH.map((t) => [t.id, { ...t, isCanceled: false }]));
  const schreiben: { pfad: string; rumpf: unknown }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/csrftoken')) return Promise.resolve(json(200, { data: 't' }));
    if (url.pathname.endsWith('/agenda')) return Promise.resolve(json(404, {}));
    const f = /\/api\/files\/service\/(\d+)$/.exec(url.pathname);
    if (f) return Promise.resolve(json(200, { data: frischeDateien(Number(f[1])) }));
    const m = /\/api\/events\/(\d+)$/.exec(url.pathname);
    if (m) {
      const t = termine.get(Number(m[1]))!;
      if (init?.method === 'PUT') {
        const r = JSON.parse(String(init.body)) as {
          description: string | null;
          isCanceled?: boolean;
        };
        schreiben.push({ pfad: url.pathname, rumpf: r });
        t.description = r.description;
        t.isCanceled = r.isCanceled === true;
      }
      return Promise.resolve(json(200, { data: t }));
    }
    return Promise.resolve(json(200, { data: [] }));
  });
  return { schreiben };
}

function zeige(o: { handy?: boolean } = {}) {
  render(
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan: PLAN, wochen: 8 }}
      handy={o.handy ?? false}
      onNochmal={() => {}}
      onMehr={() => {}}
      mehrMoeglich={false}
      ladeZeitraum={() => new Promise<never>(() => {})}
      heute="2026-10-14"
      ablauf={{ start: START, zeitzone: 'Europe/Berlin' }}
    />,
  );
}

const gruppenKnopf = () => screen.getByRole('button', { name: /^Infos & Dateien$/ });
/** Die Zellen der Infos-Zeile (ohne die Kopfzelle). */
const zellen = () => gruppenKnopf().closest('tr')!.nextElementSibling!.querySelectorAll('td');
/** Der Infotext einer Zelle – im grauen Kasten, nur zum Lesen (T2b, Variante D1). */
const infosText = (i: number) => zellen()[i].querySelector('p')?.textContent ?? null;
/** Die Namen der Anhänge einer Zelle. */
const anhaenge = (i: number) => [...zellen()[i].querySelectorAll('li')].map((l) => l.textContent);

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('„Infos & Dateien“ in der Matrix (T1b)', () => {
  it('eigene Gruppe über dem Ablauf; oben ⓘ und Büroklammer wo man darf, der Text nur zum Lesen, sonst –', () => {
    ct();
    zeige();
    const knoepfe = screen.getAllByRole('button', { expanded: true }).map((b) => b.textContent);
    expect(knoepfe.indexOf('Infos & Dateien')).toBeLessThan(knoepfe.indexOf('Ablauf'));
    const [t10, t11, t13] = zellen();
    const z10 = within(t10 as HTMLElement);
    // Mit Infos: das ⓘ hellblau hinterlegt; der Text steht im Kasten und ist selbst kein Knopf (T2b, 03.11.2026).
    expect(
      z10.getByRole('button', { name: 'Weitere Infos Gottesdienst, So, 18.10.2026' }).className,
    ).toMatch(/offen/);
    expect(infosText(0)).toBe('Abendmahl – Becher vorbereiten.\nGäste aus Siegburg.');
    expect(z10.getByText(/Becher vorbereiten/).closest('button')).toBeNull();
    expect(
      z10.getByRole('button', { name: 'Datei an Gottesdienst, So, 18.10.2026 anhängen' }),
    ).toBeTruthy();
    expect(within(t11 as HTMLElement).queryByRole('button')).toBeNull();
    expect(t11.textContent).toBe('–');
    // Ohne Infos, aber mit Recht: ⓘ (nicht hinterlegt) und Büroklammer.
    const i13 = within(t13 as HTMLElement).getByRole('button', {
      name: 'Weitere Infos Gottesdienst, So, 25.10.2026',
    });
    expect(i13.className).not.toMatch(/offen/);
    expect(
      within(t13 as HTMLElement).getByRole('button', {
        name: 'Datei an Gottesdienst, So, 25.10.2026 anhängen',
      }),
    ).toBeTruthy();
  });

  it('ⓘ öffnet das Fenster; leer → gleich schreiben → speichern, die Zelle zeigt den Text sofort', async () => {
    const { schreiben } = ct();
    zeige();
    fireEvent.click(
      within(zellen()[2] as HTMLElement).getByRole('button', { name: /^Weitere Infos/ }),
    );
    const f = screen.getByRole('dialog', { name: 'Weitere Infos' });
    expect(within(f).getByText('Gottesdienst · So, 25.10.2026')).toBeTruthy();
    // Leer und mit Recht: gleich das Textfeld, ohne „Bearbeiten“.
    expect(within(f).queryByRole('button', { name: 'Bearbeiten' })).toBeNull();
    fireEvent.change(within(f).getByRole('textbox'), {
      target: { value: 'Taufe – Becken füllen.' },
    });
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(schreiben).toHaveLength(1));
    expect(schreiben[0]).toEqual({
      pfad: '/api/events/13',
      rumpf: { description: 'Taufe – Becken füllen.', isCanceled: false },
    });
    await waitFor(() => expect(infosText(2)).toBe('Taufe – Becken füllen.'));
    expect(
      within(zellen()[2] as HTMLElement).getByRole('button', { name: /^Weitere Infos/ }).className,
    ).toMatch(/offen/);
  });

  it('nach dem Speichern zählt der Plan wieder, sobald er einen anderen Text bringt', async () => {
    const { schreiben } = ct();
    const planMit = (beschreibung: string | undefined) =>
      planAus(
        ROH.map((r) => (r.id === 13 ? { ...r, description: beschreibung } : r)),
        {
          ichId: 1,
          dienste: START.dienste,
          dienstgruppen: START.dienstgruppen,
          zeitzone: 'Europe/Berlin',
          planbar: () => true,
          ganzSichtbar: () => true,
        },
      );
    const ansicht = (plan: typeof PLAN) => (
      <Planen
        zustand={{ art: 'fertig', zeilen: [], plan, wochen: 8 }}
        handy={false}
        onNochmal={() => {}}
        onMehr={() => {}}
        mehrMoeglich={false}
        ladeZeitraum={() => new Promise<never>(() => {})}
        heute="2026-10-14"
        ablauf={{ start: START, zeitzone: 'Europe/Berlin' }}
      />
    );
    const { rerender } = render(ansicht(planMit(undefined)));
    fireEvent.click(
      within(zellen()[2] as HTMLElement).getByRole('button', { name: /^Weitere Infos/ }),
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'meins' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(schreiben).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Fenster schließen' }));
    // Der Plan bringt noch den alten Stand (leer) → der gespeicherte Text bleibt stehen.
    rerender(ansicht(planMit(undefined)));
    expect(infosText(2)).toBe('meins');
    // Inzwischen hat jemand anderes geändert, der Plan liest neu → sein Text gilt.
    rerender(ansicht(planMit('Von David')));
    expect(infosText(2)).toBe('Von David');
  });

  it('ohne Recht: Fenster nur zum Lesen', () => {
    ct();
    zeige();
    fireEvent.click(
      within(zellen()[0] as HTMLElement).getByRole('button', { name: /^Weitere Infos/ }),
    );
    expect(
      within(screen.getByRole('dialog', { name: 'Weitere Infos' })).getByRole('button', {
        name: 'Bearbeiten',
      }),
    ).toBeTruthy();
    cleanup();
    vi.restoreAllMocks();
    ct();
    render(
      <Planen
        zustand={{ art: 'fertig', zeilen: [], plan: PLAN, wochen: 8 }}
        handy={false}
        onNochmal={() => {}}
        onMehr={() => {}}
        mehrMoeglich={false}
        ladeZeitraum={() => new Promise<never>(() => {})}
        heute="2026-10-14"
        ablauf={{ start: startFuer(), zeitzone: 'Europe/Berlin' }}
      />,
    );
    fireEvent.click(
      within(zellen()[0] as HTMLElement).getByRole('button', { name: /^Weitere Infos/ }),
    );
    expect(
      within(screen.getByRole('dialog', { name: 'Weitere Infos' })).queryByRole('button', {
        name: 'Bearbeiten',
      }),
    ).toBeNull();
    // Ohne Recht und ohne Infos: weder ⓘ noch Büroklammer, nur der Strich.
    expect(within(zellen()[2] as HTMLElement).queryByRole('button')).toBeNull();
    expect(zellen()[2].textContent).toBe('–');
  });

  it('in ChurchTools: ⓘ und Büroklammer sind die Zeichen der Dienstplan-Liste (`fas fa-info`, `fas fa-paperclip`)', () => {
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        forEach: (fn: (f: { family: string }) => void) => fn({ family: 'Font Awesome Pro' }),
      },
    });
    try {
      ct();
      zeige();
      const z = within(zellen()[0] as HTMLElement);
      expect(z.getByRole('button', { name: /^Weitere Infos/ }).querySelector('i')?.className).toBe(
        'fas fa-info',
      );
      expect(z.getByRole('button', { name: /anhängen$/ }).querySelector('i')?.className).toBe(
        'fas fa-paperclip',
      );
    } finally {
      delete (document as { fonts?: unknown }).fonts;
    }
  });

  it('zuklappbar, auf dem Gerät gemerkt wie „Ablauf“', () => {
    ct();
    zeige();
    fireEvent.click(gruppenKnopf());
    expect(gruppenKnopf().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: /^Weitere Infos Gottesdienst/ })).toBeNull();
    expect(leseAnsicht().infosZu).toBe(true);
    cleanup();
    zeige();
    expect(gruppenKnopf().getAttribute('aria-expanded')).toBe('false');
  });

  it('am Handy: die Gruppe beim gewählten Termin', () => {
    ct();
    zeige({ handy: true });
    expect(gruppenKnopf()).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /^Weitere Infos Gottesdienst, So, 18\.10\.2026/ }),
    ).toBeTruthy();
  });
});

describe('Dateien in der Matrix (T2a)', () => {
  // Termin 10 mit Infos und vier Dateien, Termin 11 ohne Infos und ohne Recht, aber mit einer Datei.
  const roh = (): RohTermin[] =>
    ROH.map((t) =>
      t.id === 10
        ? {
            ...t,
            eventFiles: [
              eventFile(21, 'Folien.pdf'),
              eventFile(22, 'Video.mp4'),
              eventFile(23, 'Plakat.png'),
              eventFile(24, 'Ablauf.docx'),
            ],
          }
        : t.id === 11
          ? { ...t, eventFiles: [eventFile(31, 'Gebetsliste.pdf')] }
          : t,
    );
  const planMit = (r: RohTermin[]) =>
    planAus(r, {
      ichId: 1,
      dienste: START.dienste,
      dienstgruppen: START.dienstgruppen,
      zeitzone: 'Europe/Berlin',
      planbar: () => true,
      ganzSichtbar: () => true,
    });
  const ansicht = (plan: typeof PLAN) => (
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan, wochen: 8 }}
      handy={false}
      onNochmal={() => {}}
      onMehr={() => {}}
      mehrMoeglich={false}
      ladeZeitraum={() => new Promise<never>(() => {})}
      heute="2026-10-14"
      ablauf={{ start: START, zeitzone: 'Europe/Berlin' }}
    />
  );
  beforeEach(() => {
    ROH_DATEIEN = roh();
    frischeDateien = ausDenEventFiles;
  });

  it('„Anhänge:“ unter den Infos, höchstens drei, dann „+ N weitere“; ohne Recht öffnet ein Tipp die Datei direkt', () => {
    ct();
    render(ansicht(planMit(ROH_DATEIEN)));
    const [t10, t11] = zellen();
    const z10 = within(t10 as HTMLElement);
    expect(z10.getByText('Anhänge:')).toBeTruthy();
    expect(
      z10
        .getAllByRole('button', { name: / – Gottesdienst, So, 18\.10\.2026$/ })
        .map((b) => b.textContent),
    ).toEqual(['Folien.pdf', 'Video.mp4', 'Plakat.png']);
    expect(
      z10.getByRole('button', { name: 'Alle 4 Dateien Gottesdienst, So, 18.10.2026' }).textContent,
    ).toBe('+ 1 weitere');
    // Ohne Recht (Termin 11): kein Strich, sondern die Datei als Link – sie öffnet sich direkt aus ChurchTools.
    expect(anhaenge(1)).toEqual(['Gebetsliste.pdf']);
    const link = within(t11 as HTMLElement).getByRole('link', { name: 'Gebetsliste.pdf' });
    expect([link.getAttribute('href'), link.getAttribute('target')]).toEqual([
      download(31),
      '_blank',
    ]);
    expect(within(t11 as HTMLElement).queryByRole('button')).toBeNull();
  });

  it('die Fenster stehen nicht in der Tabelle – ein Fenster in `tbody` wäre kein gültiges HTML', () => {
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});
    ct();
    render(ansicht(planMit(ROH_DATEIEN)));
    fireEvent.click(
      within(zellen()[0] as HTMLElement).getByRole('button', { name: /^Weitere Infos/ }),
    );
    expect(screen.getByRole('dialog', { name: 'Weitere Infos' }).closest('table')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fenster schließen' }));
    fireEvent.click(
      within(zellen()[0] as HTMLElement).getByRole('button', {
        name: 'Video.mp4 – Gottesdienst, So, 18.10.2026',
      }),
    );
    expect(screen.getByRole('dialog', { name: 'Video.mp4' }).closest('table')).toBeNull();
    const verschachtelt = fehler.mock.calls.filter((c) =>
      String(c[0]).includes('validateDOMNesting'),
    );
    expect(verschachtelt).toEqual([]);
  });

  it('mit Recht öffnet ein Tipp auf eine Datei ihr kleines Fenster; „‹“ führt zu allen Dateien', async () => {
    ct();
    render(ansicht(planMit(ROH_DATEIEN)));
    fireEvent.click(
      within(zellen()[0] as HTMLElement).getByRole('button', {
        name: 'Video.mp4 – Gottesdienst, So, 18.10.2026',
      }),
    );
    const f = screen.getByRole('dialog', { name: 'Video.mp4' });
    expect(within(f).getByRole('link', { name: 'Öffnen' }).getAttribute('href')).toBe(download(22));
    fireEvent.click(within(f).getByRole('button', { name: 'Zurück' }));
    expect(await screen.findByRole('button', { name: /Ablauf\.docx/ })).toBeTruthy();
  });

  it('das Fenster lädt frisch; die frische Liste ersetzt die Zeilen, bis der Plan Neues bringt', async () => {
    ct();
    const { rerender } = render(ansicht(planMit(ROH_DATEIEN)));
    // ChurchTools kennt inzwischen nur noch eine Datei an Termin 10 – unter anderem Namen.
    frischeDateien = (id) =>
      id === 10
        ? [{ id: 21, name: 'Folien neu.pdf', type: 'file', fileUrl: download(21), size: 2048 }]
        : [];
    fireEvent.click(
      within(zellen()[0] as HTMLElement).getByRole('button', { name: /^Alle 4 Dateien/ }),
    );
    const f = screen.getByRole('dialog', { name: 'Dateien' });
    expect(within(f).getByText('Gottesdienst · So, 18.10.2026')).toBeTruthy();
    expect(await within(f).findByText('PDF · 2 KB')).toBeTruthy();
    fireEvent.click(within(f).getByRole('button', { name: 'Fenster schließen' }));
    expect(anhaenge(0)).toEqual(['Folien neu.pdf']);
    // Der Plan bringt noch den alten Stand → die frische Liste bleibt.
    rerender(ansicht(planMit(roh())));
    expect(anhaenge(0)).toEqual(['Folien neu.pdf']);
    // Der Plan liest neu und bringt etwas anderes → der Plan gilt.
    rerender(
      ansicht(
        planMit(
          roh().map((t) => (t.id === 10 ? { ...t, eventFiles: [eventFile(32, 'Andere.pdf')] } : t)),
        ),
      ),
    );
    expect(anhaenge(0)).toEqual(['Andere.pdf']);
  });

  it('die Büroklammer (T2b) nur mit Recht; öffnet gleich „Anhang hinzufügen“, „‹“ führt zu den Dateien', async () => {
    ct();
    render(ansicht(planMit(ROH_DATEIEN)));
    const [t10, t11, t13] = zellen();
    expect(within(t11 as HTMLElement).queryByRole('button', { name: /anhängen$/ })).toBeNull();
    expect(
      within(t13 as HTMLElement).getByRole('button', {
        name: 'Datei an Gottesdienst, So, 25.10.2026 anhängen',
      }),
    ).toBeTruthy();
    fireEvent.click(
      within(t10 as HTMLElement).getByRole('button', {
        name: 'Datei an Gottesdienst, So, 18.10.2026 anhängen',
      }),
    );
    const f = screen.getByRole('dialog', { name: 'Anhang hinzufügen' });
    fireEvent.click(within(f).getByRole('button', { name: 'Zurück' }));
    expect(await screen.findByRole('button', { name: /Ablauf\.docx/ })).toBeTruthy();
  });

  it('„+ N weitere“ öffnet dasselbe Fenster mit allen Dateien', async () => {
    ct();
    render(ansicht(planMit(ROH_DATEIEN)));
    fireEvent.click(
      within(zellen()[0] as HTMLElement).getByRole('button', { name: /^Alle 4 Dateien/ }),
    );
    const f = screen.getByRole('dialog', { name: 'Dateien' });
    expect(await within(f).findByRole('button', { name: /Ablauf\.docx/ })).toBeTruthy();
    expect(within(f).getAllByRole('button', { name: /\.(pdf|mp4|png|docx)/ })).toHaveLength(4);
  });
});
