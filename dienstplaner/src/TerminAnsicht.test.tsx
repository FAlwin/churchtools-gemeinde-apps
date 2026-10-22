// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { startFuer } from './start.testutil';
import { TerminAnsicht } from './TerminAnsicht';

/**
 * Die Termin-Ansicht (E6-1b) – mit dem echten Laden (`ladeTermin`, `ladeAblauf`), nur ChurchTools ist ersetzt.
 * So prüft der Test dieselben Regeln, die Liste und Matrix benutzen, statt handgeschriebener Pläne.
 */
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const TERMIN = {
  id: 7,
  name: 'Gottesdienst',
  startDate: '2026-10-18T08:00:00Z',
  endDate: '2026-10-18T10:00:00Z',
  eventServices: [
    { serviceId: 6, personId: 1, name: 'Alwin', isAccepted: true },
    { serviceId: 7, personId: null, name: null },
  ],
};
const ABLAUF = {
  items: [
    {
      id: 1,
      type: 'normal',
      title: 'Soundcheck',
      isBeforeEvent: true,
      start: '2026-10-18T07:30:00Z',
      duration: 1800,
    },
    { id: 2, type: 'header', title: 'Ankommen', start: '2026-10-18T08:00:00Z' },
    {
      id: 3,
      type: 'song',
      title: 'Lied',
      song: { title: 'Du großer Gott' },
      start: '2026-10-18T08:05:00Z',
      duration: 300,
      note: 'mit Chor',
    },
  ],
};

function ct({
  termin = () => json(200, { data: TERMIN }),
  ablauf = () => json(200, { data: ABLAUF }),
}: { termin?: () => Response; ablauf?: () => Response } = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/agenda')) return Promise.resolve(ablauf());
    if (url.includes('/events/')) return Promise.resolve(termin());
    return Promise.resolve(json(200, { data: [] }));
  });
}

function zeige(
  p: { vorher?: number | null; nachher?: number | null; start?: ReturnType<typeof startFuer> } = {},
) {
  const onTermin = vi.fn();
  const onZurueck = vi.fn();
  const ansicht = (terminId: number) => (
    <TerminAnsicht
      start={p.start ?? startFuer()}
      terminId={terminId}
      zeitzone="Europe/Berlin"
      vorher={p.vorher ?? null}
      nachher={p.nachher ?? null}
      zurueck="Termine"
      onTermin={onTermin}
      onZurueck={onZurueck}
    />
  );
  const { rerender } = render(ansicht(7));
  /** Wie ‹ ›: dieselbe Ansicht mit einem anderen Termin. */
  const wechsel = (terminId: number) => rerender(ansicht(terminId));
  return { onTermin, onZurueck, wechsel };
}

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TerminAnsicht (E6-1b)', () => {
  it('Kopf mit Datum, Beginn und Ende; der Ablauf mit Dauer neben der Zeit, Vorlauf und Linie „Beginn“', async () => {
    const spy = ct();
    zeige();
    expect(await screen.findByRole('heading', { name: 'Gottesdienst' })).toBeTruthy();
    const kopf = screen.getByRole('heading', { name: 'Gottesdienst' }).nextElementSibling!;
    expect(kopf.textContent).toBe('So, 18.10.2026 · 10:00 Uhr · Ende ca. 12:00 Uhr');
    const ablauf = screen.getByRole('region', { name: 'Ablauf' });
    expect(within(ablauf).getByText('Soundcheck')).toBeTruthy();
    expect(within(ablauf).getByText('30 Min')).toBeTruthy();
    expect(within(ablauf).getByText('Ankommen')).toBeTruthy();
    expect(within(ablauf).getByText(/Du großer Gott/)).toBeTruthy();
    expect(within(ablauf).getByText('mit Chor')).toBeTruthy();
    // Dauer steht in der Zeit-Spalte (Alwin: „Die Dauer bitte neben Zeit“) – nicht rechts am Titel.
    const zeit = within(ablauf).getByText('10:05').parentElement!;
    expect(zeit.textContent).toBe('10:055 Min');
    expect(within(ablauf).getByText(/Beginn/)).toBeTruthy();
    // Nur ansehen: Lieder sind keine Knöpfe.
    expect(within(ablauf).queryAllByRole('button')).toHaveLength(0);
    expect(
      spy.mock.calls.map((c) => new URL(String(c[0])).pathname + new URL(String(c[0])).search),
    ).toEqual(
      expect.arrayContaining(['/api/events/7?include=eventServices', '/api/events/7/agenda']),
    );
  });

  it('die Dienste nach Gruppe, mit denselben Plätzen wie in „Planen“ – offene Plätze als „frei“', async () => {
    ct();
    zeige();
    const dienste = await screen.findByRole('region', { name: 'Dienste' });
    expect(within(dienste).getByRole('heading', { name: 'Technik' })).toBeTruthy();
    expect(within(dienste).getByText('Ton')).toBeTruthy();
    expect(within(dienste).getByText('Licht')).toBeTruthy();
    expect(within(dienste).getByText('Alwin')).toBeTruthy();
    expect(within(dienste).getByText('frei')).toBeTruthy();
    // Nur ansehen: kein Platz ist ein Knopf.
    expect(within(dienste).queryAllByRole('button')).toHaveLength(0);
  });

  it('kein Ablauf (404) → „Noch kein Ablauf.“; leerer Ablauf → „noch leer“; die Dienste stehen trotzdem', async () => {
    ct({ ablauf: () => json(404, { message: 'Not found.' }) });
    zeige();
    expect(await screen.findByText('Noch kein Ablauf.')).toBeTruthy();
    expect(screen.getByText('Ton')).toBeTruthy();
    cleanup();
    vi.restoreAllMocks();
    ct({ ablauf: () => json(200, { data: { items: [] } }) });
    zeige();
    expect(await screen.findByText('Der Ablauf ist noch leer.')).toBeTruthy();
  });

  it('ein Termin ohne Dienste → Hinweis statt leerer Karte', async () => {
    ct({ termin: () => json(200, { data: { ...TERMIN, eventServices: [] } }) });
    zeige();
    expect(
      await screen.findByText('An diesem Termin stehen keine Dienste, die du sehen darfst.'),
    ).toBeTruthy();
  });

  it('Fehler → Fehlerkasten; „Erneut versuchen“ lädt neu; zurück geht auch im Fehlerfall', async () => {
    let erster = true;
    ct({
      termin: () => {
        if (erster) {
          erster = false;
          return json(502, {});
        }
        return json(200, { data: TERMIN });
      },
    });
    const { onZurueck } = zeige();
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByRole('heading', { name: 'Gottesdienst' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Termine/ }));
    expect(onZurueck).toHaveBeenCalled();
  });

  it('‹ › blättern zum vorigen/nächsten Termin; am Rand gesperrt', async () => {
    ct();
    const { onTermin } = zeige({ vorher: null, nachher: 9 });
    await screen.findByRole('heading', { name: 'Gottesdienst' });
    expect(screen.getByRole('button', { name: 'Voriger Termin' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Nächster Termin' }));
    expect(onTermin).toHaveBeenCalledWith(9);
  });
});

/**
 * Bearbeiten (E6-3a, #645) – mit dem echten Schreibweg (`ablaufAktionen` → Schreibkern → `browserSchreiber`), nur
 * ChurchTools ist ersetzt: ein Ablauf, der Löschen und Ändern wirklich umsetzt, damit das Neu-Lesen danach etwas
 * anderes sieht als vorher.
 */
describe('TerminAnsicht – Bearbeiten (E6-3a)', () => {
  /** Kalender 2; `edit agenda` für Kalender 2 → darf bearbeiten. */
  const IM_KALENDER = { ...TERMIN, calendar: { domainIdentifier: '2' } };
  const darfKalender = (ids: number[]) =>
    startFuer({ rechte: { ...startFuer().rechte, ablaufKalender: ids } });

  function ctMitAblauf(
    o: {
      termin?: object;
      gesperrt?: boolean;
      /** Das Lesen des Ablaufs nach dem n-ten Abruf scheitern lassen. */
      lesenScheitertAb?: number;
      /** Ab dem n-ten Abruf hält das Lesen an, bis `weiter()` – für „blättern, während neu gelesen wird“. */
      lesenHaeltAb?: number;
    } = {},
  ) {
    let items = ABLAUF.items.map((i, n) => ({ ...i, position: n }));
    let weiter = () => {};
    let versteckt: number | null = null;
    let lesen = 0;
    const schreiben: string[] = [];
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = new URL(String(input));
      const methode = init?.method ?? 'GET';
      if (url.pathname.endsWith('/csrftoken')) return Promise.resolve(json(200, { data: 'tok' }));
      if (methode !== 'GET') {
        schreiben.push(`${methode} ${url.pathname}`);
        if (o.gesperrt) return Promise.resolve(json(403, { message: 'Forbidden' }));
        const auge = /\/items\/(\d+)\/(hide|unhide)$/.exec(url.pathname);
        if (auge) {
          versteckt = auge[2] === 'hide' ? Number(auge[1]) : null;
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        const id = Number(url.pathname.split('/').pop());
        if (methode === 'DELETE') items = items.filter((i) => i.id !== id);
        if (methode === 'PUT') {
          const rumpf = JSON.parse(String(init?.body)) as { title?: string };
          items = items.map((i) => (i.id === id ? { ...i, title: rumpf.title ?? i.title } : i));
        }
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.pathname === '/api/events/9/agenda') {
        return Promise.resolve(json(200, { data: { items: [{ id: 90, title: 'Gebet' }] } }));
      }
      if (url.pathname.endsWith('/agenda')) {
        lesen++;
        if (o.lesenScheitertAb !== undefined && lesen >= o.lesenScheitertAb) {
          return Promise.resolve(json(502, {}));
        }
        const mitAuge = items.map((i) =>
          i.id === versteckt ? { ...i, startTimes: { '7': null } } : i,
        );
        const antwort = json(200, {
          data: { calendarId: 2, isLocked: o.gesperrt ?? false, items: mitAuge },
        });
        if (o.lesenHaeltAb !== undefined && lesen >= o.lesenHaeltAb) {
          return new Promise<Response>((r) => (weiter = () => r(antwort)));
        }
        return Promise.resolve(antwort);
      }
      if (url.pathname.startsWith('/api/events/')) {
        return Promise.resolve(json(200, { data: o.termin ?? IM_KALENDER }));
      }
      // `whoami` für die Fehler-Übersetzung: angemeldet.
      return Promise.resolve(json(200, { data: { id: 1 } }));
    });
    return {
      spy,
      schreiben,
      lesen: () => lesen,
      weiter: () => weiter(),
      /** Ein anderer löscht in ChurchTools einen Punkt. */
      fremdWeg: (id: number) => (items = items.filter((i) => i.id !== id)),
      fremdTitel: (id: number, title: string) =>
        (items = items.map((i) => (i.id === id ? { ...i, title } : i))),
    };
  }

  /** Den ersten Punkt (Soundcheck) über sein Punkt-Fenster löschen. */
  async function ersterWeg(): Promise<void> {
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Bearbeiten' })[0]);
    fireEvent.click(await screen.findByRole('button', { name: /Eintrag löschen/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Löschen$/ }));
  }

  it('Stift nur mit Recht: `edit agenda` für den Kalender des Termins ODER Admin des Termins', async () => {
    ctMitAblauf();
    zeige({ start: darfKalender([2]) });
    expect(await screen.findByRole('button', { name: 'Ablauf bearbeiten' })).toBeTruthy();
    cleanup();
    vi.restoreAllMocks();

    // Anderer Kalender → kein Stift.
    ctMitAblauf();
    zeige({ start: darfKalender([3]) });
    await screen.findByRole('heading', { name: 'Gottesdienst' });
    expect(screen.queryByRole('button', { name: 'Ablauf bearbeiten' })).toBeNull();
    cleanup();
    vi.restoreAllMocks();

    // Ohne `edit agenda`, aber Admin dieses Termins (ichId 1) → Stift.
    ctMitAblauf({ termin: { ...IM_KALENDER, adminIds: [1] } });
    zeige({ start: darfKalender([]) });
    expect(await screen.findByRole('button', { name: 'Ablauf bearbeiten' })).toBeTruthy();
  });

  it('löschen: schreibt in ChurchTools, liest danach neu und bietet „Rückgängig“ an', async () => {
    const ct = ctMitAblauf();
    zeige({ start: darfKalender([2]) });
    await screen.findByRole('heading', { name: 'Gottesdienst' });
    const vorher = ct.lesen();
    await ersterWeg();
    expect(await screen.findByText('„Soundcheck" gelöscht')).toBeTruthy();
    expect(ct.schreiben).toContain('DELETE /api/events/7/agenda/items/1');
    // Neu gelesen: ein Abruf für den frischen Stand vor dem Löschen (Schreibkern), einer danach (Termin-Ansicht).
    await waitFor(() => expect(ct.lesen()).toBe(vorher + 2));
    expect(screen.queryByText('Soundcheck')).toBeNull();
  });

  it('Titel ändern: ein PUT, danach steht der neue Titel – auch nach „Fertig“ in der Ansicht', async () => {
    const ct = ctMitAblauf();
    zeige({ start: darfKalender([2]) });
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Bearbeiten' })[0]);
    fireEvent.change(screen.getByPlaceholderText('Titel'), { target: { value: 'Technik-Check' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(ct.schreiben).toEqual(['PUT /api/events/7/agenda/items/1']));
    fireEvent.click(await screen.findByRole('button', { name: 'Fertig' }));
    const ablauf = screen.getByRole('region', { name: 'Ablauf' });
    expect(await within(ablauf).findByText('Technik-Check')).toBeTruthy();
  });

  it('scheitert nur das Neu-Lesen danach, bleibt das Gelöschte weg – mit Hinweis, nicht als Fehler zurückgerollt', async () => {
    // 1. Abruf: Ansicht, 2.: Schreibkern vor dem Löschen, ab dem 3. (Neu-Lesen danach) scheitert es.
    const ct = ctMitAblauf({ lesenScheitertAb: 3 });
    zeige({ start: darfKalender([2]) });
    await screen.findByRole('heading', { name: 'Gottesdienst' });
    await ersterWeg();
    expect(
      await screen.findByText(/Gespeichert\. Der Ablauf ließ sich danach nicht neu laden/),
    ).toBeTruthy();
    expect(ct.schreiben).toContain('DELETE /api/events/7/agenda/items/1');
    expect(screen.queryByText('Soundcheck')).toBeNull();
  });

  it('abgeschlossener Ablauf: Punkt antippen zeigt den Hinweis, kein Punkt-Fenster, nichts geschrieben', async () => {
    const ct = ctMitAblauf({ gesperrt: true });
    zeige({ start: darfKalender([2]) });
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Bearbeiten' })[0]);
    expect(await screen.findByText(/Dieser Ablauf ist in ChurchTools abgeschlossen/)).toBeTruthy();
    expect(screen.queryByPlaceholderText('Titel')).toBeNull();
    expect(ct.schreiben).toEqual([]);
  });

  it('Punkt inzwischen woanders gelöscht (404 beim Ändern): Meldung, und der Ablauf wird frisch gelesen', async () => {
    const ct = ctMitAblauf();
    zeige({ start: darfKalender([2]) });
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Bearbeiten' })[0]);
    ct.fremdWeg(1);
    const vorher = ct.lesen();
    fireEvent.change(screen.getByPlaceholderText('Titel'), { target: { value: 'Technik-Check' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Ablaufpunkt nicht gefunden.')).toBeTruthy();
    expect(ct.schreiben).toEqual([]);
    // Ein Abruf vom Schreibkern, einer zum Neu-Lesen – danach fehlt der Punkt auch in der Liste.
    await waitFor(() => expect(ct.lesen()).toBe(vorher + 2));
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() => expect(screen.queryByText('Soundcheck')).toBeNull());
  });

  it('kein Ablauf → kein Stift, auch mit Recht (anlegen kommt mit E6-5)', async () => {
    ct({ termin: () => json(200, { data: IM_KALENDER }), ablauf: () => json(404, {}) });
    zeige({ start: darfKalender([2]) });
    expect(await screen.findByText('Noch kein Ablauf.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ablauf bearbeiten' })).toBeNull();
  });

  it('blättern beendet das Bearbeiten', async () => {
    ctMitAblauf();
    const { wechsel } = zeige({ start: darfKalender([2]) });
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    expect(screen.getByRole('button', { name: 'Fertig' })).toBeTruthy();
    wechsel(9);
    expect(await screen.findByText('Gebet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ablauf bearbeiten' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Fertig' })).toBeNull();
  });

  it('blättern, während nach dem Speichern neu gelesen wird: die späte Antwort landet nicht im neuen Termin', async () => {
    // 1. Abruf: Ansicht, 2.: Schreibkern, 3. (Neu-Lesen nach dem Löschen) hält an.
    const ct = ctMitAblauf({ lesenHaeltAb: 3 });
    const { wechsel } = zeige({ start: darfKalender([2]) });
    await screen.findByRole('heading', { name: 'Gottesdienst' });
    await ersterWeg();
    await waitFor(() => expect(ct.lesen()).toBe(3));
    wechsel(9);
    expect(await screen.findByText('Gebet')).toBeTruthy();
    ct.weiter();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByText('Gebet')).toBeTruthy();
    expect(screen.queryByText('Ankommen')).toBeNull();
  });
  it('Auge: Schalter „An diesem Termin weglassen“ schreibt `hide`; danach steht der Punkt mit Hinweis da', async () => {
    const ct = ctMitAblauf();
    zeige({ start: darfKalender([2]) });
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Bearbeiten' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /An diesem Termin weglassen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(ct.schreiben).toEqual(['POST /api/events/7/agenda/items/1/hide']));
    expect(await screen.findByText('an diesem Termin weggelassen')).toBeTruthy();
  });
  it('Konflikt: derselbe Punkt woanders geändert → Rückfrage, Ablauf neu gelesen; „Trotzdem speichern“ schreibt', async () => {
    const ct = ctMitAblauf();
    zeige({ start: darfKalender([2]) });
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Bearbeiten' })[0]);
    ct.fremdTitel(1, 'Soundcheck von außen');
    const vorher = ct.lesen();
    fireEvent.change(screen.getByPlaceholderText('Titel'), { target: { value: 'Technik-Check' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect((await screen.findByRole('alert')).textContent).toContain('woanders geändert');
    expect(ct.schreiben).toEqual([]);
    await waitFor(() => expect(ct.lesen()).toBe(vorher + 2));
    fireEvent.click(screen.getByRole('button', { name: 'Trotzdem speichern' }));
    await waitFor(() => expect(ct.schreiben).toEqual(['PUT /api/events/7/agenda/items/1']));
  });
});
