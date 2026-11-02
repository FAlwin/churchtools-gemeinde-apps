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
  it('eigene Gruppe über dem Ablauf; je Termin die Infos, „+ Infos“ wo man darf, sonst –', () => {
    ct();
    zeige();
    const knoepfe = screen.getAllByRole('button', { expanded: true }).map((b) => b.textContent);
    expect(knoepfe.indexOf('Infos & Dateien')).toBeLessThan(knoepfe.indexOf('Ablauf'));
    const [t10, t11, t13] = zellen();
    expect(
      within(t10 as HTMLElement).getByRole('button', {
        name: 'Weitere Infos Gottesdienst, So, 18.10.2026: Abendmahl – Becher vorbereiten.\nGäste aus Siegburg.',
      }),
    ).toBeTruthy();
    expect(within(t11 as HTMLElement).queryByRole('button')).toBeNull();
    expect(t11.textContent).toBe('–');
    expect(
      within(t13 as HTMLElement).getByRole('button', {
        name: 'Infos für Gottesdienst, So, 25.10.2026 schreiben',
      }),
    ).toBeTruthy();
  });

  it('antippen öffnet das Fenster; „+ Infos“ → schreiben → speichern, die Zelle zeigt den Text sofort', async () => {
    const { schreiben } = ct();
    zeige();
    fireEvent.click(within(zellen()[2] as HTMLElement).getByRole('button'));
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
    expect(
      await within(zellen()[2] as HTMLElement).findByRole('button', {
        name: 'Weitere Infos Gottesdienst, So, 25.10.2026: Taufe – Becken füllen.',
      }),
    ).toBeTruthy();
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
    fireEvent.click(within(zellen()[2] as HTMLElement).getByRole('button'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'meins' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(schreiben).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Fenster schließen' }));
    // Der Plan bringt noch den alten Stand (leer) → der gespeicherte Text bleibt stehen.
    rerender(ansicht(planMit(undefined)));
    expect(zellen()[2].textContent).toBe('meins');
    // Inzwischen hat jemand anderes geändert, der Plan liest neu → sein Text gilt.
    rerender(ansicht(planMit('Von David')));
    expect(zellen()[2].textContent).toBe('Von David');
  });

  it('ohne Recht: Fenster nur zum Lesen', () => {
    ct();
    zeige();
    fireEvent.click(within(zellen()[0] as HTMLElement).getByRole('button'));
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
    fireEvent.click(within(zellen()[0] as HTMLElement).getByRole('button'));
    expect(
      within(screen.getByRole('dialog', { name: 'Weitere Infos' })).queryByRole('button', {
        name: 'Bearbeiten',
      }),
    ).toBeNull();
    // Ohne Recht auch kein „+ Infos“.
    expect(within(zellen()[2] as HTMLElement).queryByRole('button')).toBeNull();
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

  it('unter den Infos je Datei eine Zeile, höchstens drei, dann „+ N weitere“; ohne Infos und Recht nur die Dateien', () => {
    ct();
    render(ansicht(planMit(ROH_DATEIEN)));
    const [t10, t11] = zellen();
    const z10 = within(t10 as HTMLElement);
    expect(z10.getByRole('button', { name: /^Weitere Infos Gottesdienst/ })).toBeTruthy();
    expect(
      z10.getAllByRole('button', { name: /^Dateien Gottesdienst/ }).map((b) => b.textContent),
    ).toEqual(['Folien.pdf', 'Video.mp4', 'Plakat.png']);
    expect(
      z10.getByRole('button', { name: 'Alle 4 Dateien Gottesdienst, So, 18.10.2026' }).textContent,
    ).toBe('+ 1 weitere');
    // Kein Strich, wenn es Dateien gibt.
    expect(t11.textContent).toBe('Gebetsliste.pdf');
  });

  it('eine Datei-Zeile öffnet das Dateien-Fenster; die frische Liste ersetzt die Zeilen, bis der Plan Neues bringt', async () => {
    ct();
    const { rerender } = render(ansicht(planMit(ROH_DATEIEN)));
    // ChurchTools kennt inzwischen nur noch eine Datei an Termin 11 – unter anderem Namen.
    frischeDateien = (id) =>
      id === 11
        ? [{ id: 31, name: 'Gebetsliste neu.pdf', type: 'file', fileUrl: download(31), size: 2048 }]
        : [];
    fireEvent.click(within(zellen()[1] as HTMLElement).getByRole('button'));
    const f = screen.getByRole('dialog', { name: 'Dateien' });
    expect(within(f).getByText('Gebetsabend · Mi, 21.10.2026')).toBeTruthy();
    expect(await within(f).findByText('PDF · 2 KB')).toBeTruthy();
    fireEvent.click(within(f).getByRole('button', { name: 'Fenster schließen' }));
    expect(zellen()[1].textContent).toBe('Gebetsliste neu.pdf');
    // Der Plan bringt noch den alten Stand → die frische Liste bleibt.
    rerender(ansicht(planMit(roh())));
    expect(zellen()[1].textContent).toBe('Gebetsliste neu.pdf');
    // Der Plan liest neu und bringt etwas anderes → der Plan gilt.
    rerender(
      ansicht(
        planMit(
          roh().map((t) => (t.id === 11 ? { ...t, eventFiles: [eventFile(32, 'Andere.pdf')] } : t)),
        ),
      ),
    );
    expect(zellen()[1].textContent).toBe('Andere.pdf');
  });

  it('„+ N weitere“ öffnet dasselbe Fenster mit allen Dateien', async () => {
    ct();
    render(ansicht(planMit(ROH_DATEIEN)));
    fireEvent.click(
      within(zellen()[0] as HTMLElement).getByRole('button', { name: /^Alle 4 Dateien/ }),
    );
    const f = screen.getByRole('dialog', { name: 'Dateien' });
    expect(await within(f).findByRole('link', { name: /Ablauf\.docx/ })).toBeTruthy();
    expect(within(f).getAllByRole('link')).toHaveLength(4);
  });
});
