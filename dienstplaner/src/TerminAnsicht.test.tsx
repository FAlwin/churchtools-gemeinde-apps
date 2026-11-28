// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { diensteAus } from '@shared/ct/dienste';
import { startFuer } from './start.testutil';
import { leisesFeldKlasse } from './leisesFeld.testutil';
import { mehrEintrag, mehrEintragOder, oeffneMehr } from './mehrMenue.testutil';
import { fensterKnoepfe } from '@ui/fenster/fenster.testutil';
import { TerminAnsicht } from './TerminAnsicht';
import { TERMIN_VERWEIGERT } from './ladeTermine';
import { einteilungSchluessel } from '@shared/dienstplan/tausch';
import { tauschAttrappe } from './tausch.testutil';
import type { Tausch } from './useTausch';
import type { TerminBlatt } from '@shared/ct/terminBlatt';
import type { EntwurfAnschluss } from './ladeEntwuerfe';
import type { Entwurf } from '@shared/dienstplan/entwuerfe';
import { ALWIN, daten, entwurf, gesendet, nachgebaut } from './entwurfAnschluss.testutil';

// Teilen (E8-1): Das Blatt wird festgehalten statt gezeichnet – geprüft wird, was aus den echten Plan-Daten entsteht.
const blaetter = vi.hoisted(() => [] as unknown[]);
// Die Liedauswahl (LW2b) ist hier eine Attrappe – ihr Innenleben prüfen die Tests in `ui/lied`; hier zählt, OB das
// Punkt-Fenster sie zeigt und was ein gewähltes Lied auslöst.
vi.mock('./LiedWahl', () => ({
  LiedWahl: (p: {
    onGewaehlt: (arrangementId: number, name: string) => void;
    onAbbrechen: () => void;
  }) => (
    <div role="dialog" aria-label="Liedauswahl (Attrappe)">
      <button onClick={() => p.onGewaehlt(31, 'Way Maker')}>Way Maker wählen</button>
      <button onClick={p.onAbbrechen}>Attrappe abbrechen</button>
    </div>
  ),
}));
vi.mock('@ui/teilen/terminBlattPdf', () => ({
  terminBlattPdf: vi.fn(async (b: unknown) => {
    blaetter.push(b);
    const { jsPDF } = await import('jspdf');
    return new jsPDF();
  }),
}));
vi.mock('@ui/teilen/pdfSeiten', () => ({
  renderPdfToCanvases: vi.fn(() => Promise.resolve([])),
  renderPdfSeite: vi.fn(() => Promise.reject(new Error('jsdom'))),
}));

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
  p: {
    vorher?: number | null;
    nachher?: number | null;
    start?: ReturnType<typeof startFuer>;
    tausch?: Tausch;
    entwuerfe?: EntwurfAnschluss;
    handy?: boolean;
    liveStart?: boolean;
  } = {},
) {
  const onTermin = vi.fn();
  const onZurueck = vi.fn();
  const onGeaendert = vi.fn();
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
      onGeaendert={onGeaendert}
      tausch={p.tausch}
      entwuerfe={p.entwuerfe}
      heute="2026-10-01"
      handy={p.handy ?? false}
      liveStart={p.liveStart}
    />
  );
  const { rerender } = render(ansicht(7));
  /** Wie ‹ ›: dieselbe Ansicht mit einem anderen Termin. */
  const wechsel = (terminId: number) => rerender(ansicht(terminId));
  return { onTermin, onZurueck, wechsel, onGeaendert };
}

/** Den ersten Punkt im Bearbeiten antippen – der Stift an der Zeile ist weg (B8), die Zeile selbst öffnet das Fenster. */
function ersterPunkt(): void {
  fireEvent.click(document.querySelector<HTMLElement>('[data-tour="edit-item"]')!);
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
    // Ende = wann der letzte Punkt vorbei ist (Lied 10:05 + 5 Min), nicht das Ende des Termins (12:00) und ohne „ca.“
    // (Alwin, 30.10.2026).
    // Daneben die Dauer ab Beginn (Alwin, 28.11.2026) – „mit Vorlauf“ steht nur im Balken „Ende“ unter dem Ablauf.
    expect(kopf.textContent).toBe('So, 18.10.2026 · 10:00 Uhr · Ende 10:10 Uhr · Dauer 10 Min');
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
    // Unter dem Ablauf der Balken „Ende“ mit der Dauer, hier auch „mit Vorlauf“ (Soundcheck 30 Min; Alwin, 28.11.2026).
    expect(
      within(ablauf).getByRole('separator', {
        name: 'Ende 10:10 · Dauer 10 Min · mit Vorlauf 40 Min',
      }),
    ).toBeTruthy();
    // Nur ansehen – bis auf die Punkte (B8, E20: Tipp auf den Punkt = Einzelansicht, Tipp auf die Lied-Karte = Lied-Ansicht,
    // E6-O O4). Im Kopf dazu das „⋯“-Menü (B8): „Spalten wählen“ (Infos je Gruppe, E6-4) und „Ablauf zeigen“ (E6b-1).
    expect(
      within(ablauf)
        .queryAllByRole('button')
        .map((b) => b.getAttribute('aria-label') ?? b.textContent),
    ).toEqual([
      'Mehr',
      '„Soundcheck“ ansehen',
      '„Lied – Du großer Gott“ ansehen',
      'Du großer Gott',
    ]);
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
    // Als Planer (Technik) sind der freie und der belegte Platz Knöpfe wie in der Matrix (F1) – ohne Planen-Recht
    // keiner (Test unter „Einteilen in der Termin-Ansicht“). Ohne Entwurfs-Anschluss kein Zauberstab.
    expect(
      within(dienste)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label') ?? b.textContent),
    ).toEqual(['frei – Wer kann? (Platz 1 von 1)', 'Alwin – zugesagt: zurückziehen oder ersetzen']);
  });

  it('„Tauschen“ (E7-3) nur an meinem eigenen Platz – nicht am freien, nicht ohne Tausch-Zustand', async () => {
    ct();
    const tausch = tauschAttrappe();
    zeige({ tausch });
    const dienste = await screen.findByRole('region', { name: 'Dienste' });
    const knoepfe = within(dienste).getAllByRole('button', { name: /Tauschen/ });
    expect(knoepfe).toHaveLength(1);
    // Er steht in der Zeile „Ton“ – dort ist Alwin eingeteilt (serviceId 6).
    expect(knoepfe[0].closest('div[class*="dienst"]')?.textContent).toContain('Ton');
    fireEvent.click(knoepfe[0]);
    expect(await screen.findByText(/Ton · Gottesdienst/)).toBeTruthy();
    expect(tausch.kandidaten).toHaveBeenCalledWith(
      einteilungSchluessel({ eventId: 7, serviceId: 6, index: null }),
    );
  });

  it('läuft am eigenen Platz eine Anfrage, steht dort ihr Stand mit „Zurückziehen“ statt „Tauschen“', async () => {
    ct();
    const tausch: Tausch = {
      ...tauschAttrappe(),
      stand: (terminId, ort) =>
        terminId === 7 && ort.serviceId === 6
          ? { art: 'offen', id: 12, name: 'Spike Musiker', beginn: '2027-01-10T09:00:00Z' }
          : null,
    };
    zeige({ tausch });
    const dienste = await screen.findByRole('region', { name: 'Dienste' });
    expect(await within(dienste).findByText(/bei Spike Musiker \(So, 10\.01\.\)/)).toBeTruthy();
    expect(within(dienste).getByRole('button', { name: 'Zurückziehen' })).toBeTruthy();
    expect(within(dienste).queryByRole('button', { name: /Tauschen/ })).toBeNull();
  });

  it('„Teilen“ hinter dem Titel öffnet „Termin teilen“ – Dienste aus denselben Plätzen, Ablauf mit Beginn', async () => {
    ct();
    blaetter.length = 0;
    zeige();
    await screen.findByRole('region', { name: 'Dienste' });
    fireEvent.click(screen.getByRole('button', { name: 'Termin als PDF teilen' }));
    expect(await screen.findByRole('dialog', { name: 'Termin teilen' })).toBeTruthy();
    await waitFor(() => expect(blaetter.length).toBeGreaterThan(0));
    const b = blaetter.at(-1) as TerminBlatt;
    expect(b.titel).toBe('Gottesdienst');
    expect(b.untertitel).toMatch(/^Sonntag, 18\. Oktober 2026 · 10:00/);
    expect(b.app).toBe('Dienstplaner');
    expect(b.dienste).toEqual([
      expect.objectContaining({
        name: 'Technik',
        // In der Reihenfolge des Plans – wie die Karte „Dienste“ der Termin-Ansicht.
        dienste: [
          { name: 'Licht', personen: [], frei: 1 },
          { name: 'Ton', personen: [{ name: 'Alwin', angefragt: false }], frei: 0 },
        ],
      }),
    ]);
    expect(b.ablauf?.zeilen.map((z) => z.art)).toContain('beginn');
  });

  it('kein Ablauf (404) → „Noch kein Ablauf.“; leerer Ablauf → „noch leer“; die Dienste stehen trotzdem', async () => {
    ct({ ablauf: () => json(404, { message: 'Not found.' }) });
    zeige();
    expect(await screen.findByText('Noch kein Ablauf.')).toBeTruthy();
    expect(screen.getByText('Ton')).toBeTruthy();
    // Ohne Ablauf kein Ende – auch nicht das des Termins aus ChurchTools.
    expect(
      screen.getByRole('heading', { name: 'Gottesdienst' }).nextElementSibling!.textContent,
    ).toBe('So, 18.10.2026 · 10:00 Uhr');
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

  it('Termin ohne Recht → „Diesen Termin zeigt dir ChurchTools nicht“, auch wenn der Ablauf zuerst scheitert', async () => {
    // Der Ablauf antwortet sofort mit „verboten“, der Termin erst danach – trotzdem zählt der Fehler des Termins.
    const verbot = {
      message: 'Keine ausreichende Berechtigung.',
      messageKey: 'error.forbidden.view',
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/agenda')) return Promise.resolve(json(403, verbot));
      if (url.includes('/events/'))
        return new Promise((fertig) => setTimeout(() => fertig(json(403, verbot)), 20));
      return Promise.resolve(json(200, { data: [] }));
    });
    zeige();
    expect(await screen.findByText(TERMIN_VERWEIGERT)).toBeTruthy();
    expect(screen.queryByText(/Dienste planen darf/)).toBeNull();
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
      /** Die Predigtserie (`series`) des Ablaufs; ein `PUT …/agenda` setzt sie wie ChurchTools (gekürzt, leer = null). */
      serie?: string | null;
      /** Weitere Termine, die sich den Ablauf teilen – wie ChurchTools als Schlüssel in `startTimes` (`verbundeneTermine`). */
      verbunden?: number[];
    } = {},
  ) {
    let items = ABLAUF.items.map((i, n) => ({ ...i, position: n }));
    let serie = o.serie ?? null;
    /** Die Rümpfe aller `PUT …/agenda` (Ablauf selbst, nicht seine Punkte). */
    const ablaufRuempfe: unknown[] = [];
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
        if (methode === 'PUT' && url.pathname.endsWith('/agenda')) {
          const rumpf = JSON.parse(String(init?.body)) as { series?: string | null };
          ablaufRuempfe.push(rumpf);
          if ('series' in rumpf) serie = rumpf.series?.trim() || null;
          return Promise.resolve(json(200, { data: {} }));
        }
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
        const mitAuge = items.map((i, n) =>
          i.id === versteckt
            ? { ...i, startTimes: { '7': null } }
            : n === 0 && o.verbunden
              ? {
                  ...i,
                  startTimes: Object.fromEntries(
                    [7, ...o.verbunden].map((t) => [String(t), i.start]),
                  ),
                }
              : i,
        );
        const antwort = json(200, {
          data: {
            calendarId: 2,
            isLocked: o.gesperrt ?? false,
            series: serie,
            items: mitAuge,
          },
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
      ablaufRuempfe,
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
    ersterPunkt();
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
    ersterPunkt();
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
    ersterPunkt();
    expect(await screen.findByText(/Dieser Ablauf ist in ChurchTools abgeschlossen/)).toBeTruthy();
    expect(screen.queryByPlaceholderText('Titel')).toBeNull();
    expect(ct.schreiben).toEqual([]);
  });

  it('Punkt inzwischen woanders gelöscht (404 beim Ändern): Meldung, und der Ablauf wird frisch gelesen', async () => {
    const ct = ctMitAblauf();
    zeige({ start: darfKalender([2]) });
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    ersterPunkt();
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

  /**
   * **Predigtserie** (27.11.2026, wie die ChurchTools-App): in der Ansicht nur, wenn gesetzt; im Bearbeiten öffnet die Zeile
   * das Fenster, gespeichert wird NUR `{ series }` (gemessen: mitgeschickte Punkte ersetzten die ganze Liste).
   */
  it('Predigtserie: Ansicht zeigt sie nur, wenn gesetzt; ohne Serie keine Zeile', async () => {
    ctMitAblauf({ serie: 'Die Psalmen' });
    zeige({ start: darfKalender([2]) });
    const ablauf = await screen.findByRole('region', { name: 'Ablauf' });
    expect(await within(ablauf).findByText('Die Psalmen')).toBeTruthy();
    expect(within(ablauf).getByText('Predigtserie')).toBeTruthy();
    cleanup();
    vi.restoreAllMocks();

    ctMitAblauf();
    zeige({ start: darfKalender([2]) });
    await screen.findByText('Soundcheck');
    expect(screen.queryByText('Predigtserie')).toBeNull();
  });

  it('Predigtserie setzen: im Bearbeiten die Zeile antippen, eintippen, speichern → nur { series }, danach neu gelesen', async () => {
    const ct = ctMitAblauf();
    zeige({ start: darfKalender([2]) });
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    fireEvent.click(await screen.findByRole('button', { name: /Predigtserie\s*keine/ }));
    const fenster = await screen.findByRole('dialog', { name: 'Predigtserie' });
    // Nicht geteilt: kein Hinweis auf andere Termine.
    expect(within(fenster).queryByText(/Gilt für alle Termine/)).toBeNull();
    fireEvent.change(within(fenster).getByRole('textbox'), {
      target: { value: '  Römerbrief  ' },
    });
    fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(ct.ablaufRuempfe).toEqual([{ series: 'Römerbrief' }]));
    expect(ct.schreiben).toEqual(['PUT /api/events/7/agenda']);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Predigtserie' })).toBeNull());
    expect(await screen.findByRole('button', { name: /Predigtserie\s*Römerbrief/ })).toBeTruthy();
  });

  it('Predigtserie entfernen: Feld leeren und speichern schreibt { series: null }', async () => {
    const ct = ctMitAblauf({ serie: 'Die Psalmen', verbunden: [8] });
    zeige({ start: darfKalender([2]) });
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    fireEvent.click(await screen.findByRole('button', { name: /Predigtserie\s*Die Psalmen/ }));
    const fenster = await screen.findByRole('dialog', { name: 'Predigtserie' });
    // Geteilter Ablauf: der Hinweis sagt, dass die Serie für alle Termine gilt.
    expect(within(fenster).getByText(/Gilt für alle Termine mit diesem Ablauf/)).toBeTruthy();
    fireEvent.change(within(fenster).getByRole('textbox'), { target: { value: '' } });
    fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(ct.ablaufRuempfe).toEqual([{ series: null }]));
    expect(await screen.findByRole('button', { name: /Predigtserie\s*keine/ })).toBeTruthy();
  });

  it('abgeschlossen: Schloss im Ablauf-Kopf; die Serie steht da, lässt sich aber nicht öffnen', async () => {
    const ct = ctMitAblauf({ gesperrt: true, serie: 'Die Psalmen' });
    zeige({ start: darfKalender([2]) });
    expect(await screen.findByRole('img', { name: 'In ChurchTools abgeschlossen' })).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    expect(await screen.findByText('Die Psalmen')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Predigtserie/ })).toBeNull();
    expect(ct.schreiben).toEqual([]);
    cleanup();
    vi.restoreAllMocks();

    // Offen: kein Schloss.
    ctMitAblauf();
    zeige({ start: darfKalender([2]) });
    await screen.findByText('Soundcheck');
    expect(screen.queryByRole('img', { name: 'In ChurchTools abgeschlossen' })).toBeNull();
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
    ersterPunkt();
    fireEvent.click(screen.getByRole('button', { name: /An diesem Termin weglassen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(ct.schreiben).toEqual(['POST /api/events/7/agenda/items/1/hide']));
    expect(await screen.findByText('an diesem Termin weggelassen')).toBeTruthy();
  });
  it('Konflikt: derselbe Punkt woanders geändert → Rückfrage, Ablauf neu gelesen; „Trotzdem speichern“ schreibt', async () => {
    const ct = ctMitAblauf();
    zeige({ start: darfKalender([2]) });
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    ersterPunkt();
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
  it('Hinweis (#676): wer nicht alle Dienstgruppen sieht, bekommt ihn beim Bearbeiten – wer alle sieht, nicht', async () => {
    ctMitAblauf();
    // Sicht nur auf Technik (3), Programm und Musik nicht für alle sichtbar.
    zeige({
      start: startFuer({
        rechte: {
          ...startFuer().rechte,
          ablaufKalender: [2],
          sichtbareDienstgruppen: [3],
          planbareDienstgruppen: [3],
        },
      }),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    expect(screen.getByText(/Du siehst nicht alle Dienstgruppen/)).toBeTruthy();
    cleanup();
    vi.restoreAllMocks();

    ctMitAblauf();
    zeige({
      start: startFuer({
        rechte: { ...startFuer().rechte, ablaufKalender: [2], sichtbareDienstgruppen: null },
      }),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    expect(screen.queryByText(/Du siehst nicht alle Dienstgruppen/)).toBeNull();
  });

  /**
   * **Der Ablauf wie in der Musik-App (Ruhige Bedienung B8, Alwin 20.11.2026):** Tipp auf den Punkt → Einzelansicht,
   * kein Stift an der Zeile, der Kopf in Stufen („Bearbeiten“ + „⋯“, im Bearbeiten „+ Eintrag hinzufügen“, „⋯“ und
   * „Fertig“). Dieselben Bausteine (`ui/ablauf`) – hier nur die Verdrahtung im Dienstplaner.
   */
  describe('wie in der Musik-App (B8)', () => {
    afterEach(() => vi.unstubAllGlobals());
    const breite = (handy: boolean) =>
      vi.stubGlobal('matchMedia', () => ({
        matches: handy,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));
    const ablaufKarte = () => screen.getByRole('region', { name: 'Ablauf' });
    const knoepfe = (wurzel: HTMLElement) =>
      within(wurzel)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim());

    it('Tipp auf den Punkt öffnet die Einzelansicht „Position 1/2“ (auch breit als Seite); „Danach“ blättert, der Rand ist gesperrt', async () => {
      breite(false);
      ctMitAblauf();
      zeige({ start: darfKalender([2]) });
      fireEvent.click(await screen.findByRole('button', { name: '„Soundcheck“ ansehen' }));
      const fenster = await screen.findByRole('dialog', { name: 'Soundcheck' });
      expect(within(fenster).getByText('Position 1/2')).toBeTruthy();
      expect(within(fenster).getByRole('button', { name: 'Davor' })).toHaveProperty(
        'disabled',
        true,
      );
      fireEvent.click(within(fenster).getByRole('button', { name: 'Danach' }));
      expect(within(fenster).getByText('Position 2/2')).toBeTruthy();
      expect(within(fenster).getByRole('button', { name: 'Danach' })).toHaveProperty(
        'disabled',
        true,
      );
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByText(/^Position \d/)).toBeNull();
    });

    it('am Handy eine eigene Seite („Position 1/2“, „‹ Ablauf“), kein Fenster', async () => {
      breite(true);
      ctMitAblauf();
      zeige({ start: darfKalender([2]), handy: true });
      fireEvent.click(await screen.findByRole('button', { name: '„Soundcheck“ ansehen' }));
      const seite = await screen.findByRole('dialog', { name: 'Soundcheck' });
      expect(within(seite).getByText('Position 1/2')).toBeTruthy();
      fireEvent.click(within(seite).getByRole('button', { name: /Ablauf/ }));
      expect(screen.queryByRole('dialog', { name: 'Soundcheck' })).toBeNull();
    });

    it('Kopf in Stufen: Ansehen = „Bearbeiten“ + „⋯“ (Spalten, Ablauf zeigen); Bearbeiten = „+“, „⋯“, „Fertig“', async () => {
      breite(false);
      ctMitAblauf();
      zeige({ start: darfKalender([2]) });
      await screen.findByRole('button', { name: 'Ablauf bearbeiten' });
      expect(knoepfe(ablaufKarte()).slice(0, 2)).toEqual(['Mehr', 'Ablauf bearbeiten']);
      expect(
        within(oeffneMehr())
          .getAllByRole('menuitem')
          .map((m) => m.textContent),
      ).toEqual(['Spalten wählen', 'Ablauf zeigen']);
      fireEvent.click(screen.getByRole('button', { name: 'Ablauf bearbeiten' }));
      // Im Bearbeiten: grünes „+“, „⋯“ (Als Vorlage …/Neu aufsetzen …), blaues „Fertig“ – und es steht nichts dazwischen.
      expect(knoepfe(ablaufKarte()).slice(0, 3)).toEqual(['Eintrag hinzufügen', 'Mehr', 'Fertig']);
      expect(mehrEintragOder('Ablauf zeigen')).toBeNull();
      expect(mehrEintragOder(/Neu aufsetzen/)).toBeTruthy();
    });

    it('der Stift an der Zeile entfällt – die Zeile antippen öffnet das Punkt-Fenster', async () => {
      breite(false);
      ctMitAblauf();
      zeige({ start: darfKalender([2]) });
      fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
      expect(screen.queryByRole('button', { name: 'Bearbeiten' })).toBeNull();
      ersterPunkt();
      expect(await screen.findByPlaceholderText('Titel')).toBeTruthy();
    });

    it('„Ablauf zeigen“ im „⋯“-Menü öffnet die Anzeige (Aktion, nicht nur Menü zu)', async () => {
      breite(false);
      ctMitAblauf();
      zeige({ start: darfKalender([2]) });
      await screen.findByRole('button', { name: 'Ablauf bearbeiten' });
      mehrEintrag('Ablauf zeigen');
      expect(screen.getByRole('dialog', { name: /^Ablauf: / })).toBeTruthy();
      expect(screen.queryByRole('menu', { name: 'Mehr' })).toBeNull();
    });
  });

  describe('grünes „+“ oben im Ablauf (Alwin, 28.10.2026 – wie „+ Termin“ im ChurchTools-Kalender)', () => {
    afterEach(() => vi.unstubAllGlobals());
    const breite = (handy: boolean) =>
      vi.stubGlobal('matchMedia', () => ({
        matches: handy,
        addEventListener: () => {},
        removeEventListener: () => {},
      }));

    it('am Rechner: im Kopf der Karte „Ablauf“, mit Menü – kein schwebendes Plus', async () => {
      breite(false);
      ctMitAblauf();
      zeige({ start: darfKalender([2]) });
      fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
      const plus = screen.getAllByRole('button', { name: 'Eintrag hinzufügen' });
      expect(plus).toHaveLength(1);
      const kopf = screen.getByRole('heading', { name: 'Ablauf' }).parentElement!;
      expect(kopf.contains(plus[0])).toBe(true);
      fireEvent.click(plus[0]);
      // Lieder verknüpft nur die Musik-App – im Dienstplaner gibt es kein „Lied hinzufügen“.
      expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual([
        'Programmpunkt hinzufügen',
        'Überschrift hinzufügen',
      ]);
    });

    it('am Handy: das schwebende Plus wie bisher, nichts im Kopf', async () => {
      breite(true);
      ctMitAblauf();
      zeige({ start: darfKalender([2]) });
      fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
      const plus = screen.getByRole('button', { name: 'Eintrag hinzufügen' });
      const kopf = screen.getByRole('heading', { name: 'Ablauf' }).parentElement!;
      expect(kopf.contains(plus)).toBe(false);
      expect(plus.getAttribute('aria-expanded')).toBeNull();
    });
  });
});

/**
 * Ablauf anlegen (E6-5a, #681) – mit dem echten Kern (`ablaufAnlegen`: vorher prüfen, nachher nachlesen) und den
 * echten Regeln für die Vorschläge; ChurchTools ist nachgebaut und legt den Ablauf wirklich an.
 */
describe('TerminAnsicht – Ablauf anlegen (E6-5a)', () => {
  const ZIEL = { ...TERMIN, calendar: { domainIdentifier: '2' } };
  const frueher = (id: number, tag: string, kal: string) => ({
    id,
    name: 'Gottesdienst',
    startDate: `${tag}T08:00:00Z`,
    endDate: `${tag}T10:00:00Z`,
    calendar: { domainIdentifier: kal },
  });

  function ctAnlegen() {
    let angelegt: string | null = null;
    const geschrieben: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = new URL(String(input));
      const p = url.pathname;
      const m = init?.method ?? 'GET';
      if (p.endsWith('/csrftoken')) return Promise.resolve(json(200, { data: 'tok' }));
      if (m !== 'GET') {
        geschrieben.push(`${m} ${p}${url.search}`);
        if (p === '/api/events/7/agenda') angelegt = url.search;
        return Promise.resolve(json(200, { data: {} }));
      }
      if (p === '/api/agendatemplates') {
        return Promise.resolve(
          json(200, {
            data: [
              { id: 30, name: 'Jugend', calendarId: 3, items: [{}] },
              { id: 31, name: 'Sonntag', calendarId: 2, items: [{}, {}] },
            ],
          }),
        );
      }
      if (p === '/api/events' && url.searchParams.get('from')) {
        return Promise.resolve(
          json(200, {
            data: [
              frueher(5, '2026-10-11', '2'), // mit Ablauf
              frueher(6, '2026-10-04', '2'), // ohne Ablauf
              frueher(8, '2026-10-11', '3'), // anderer Kalender
              { ...ZIEL },
            ],
          }),
        );
      }
      if (p === '/api/events/5/agenda') {
        return Promise.resolve(json(200, { data: { items: [{ id: 1 }, { id: 2 }, { id: 3 }] } }));
      }
      if (p === '/api/events/7/agenda') {
        return Promise.resolve(
          angelegt === null
            ? json(404, { message: 'Not found.' })
            : json(200, {
                data: { calendarId: 2, items: [{ id: 99, title: 'Begrüßung', type: 'normal' }] },
              }),
        );
      }
      if (/^\/api\/events\/\d+\/agenda$/.test(p)) return Promise.resolve(json(404, {}));
      if (p === '/api/events/7') return Promise.resolve(json(200, { data: ZIEL }));
      return Promise.resolve(json(200, { data: { id: 1 } }));
    });
    return { geschrieben, angelegt: () => angelegt };
  }

  const darf = startFuer({ rechte: { ...startFuer().rechte, ablaufKalender: [2] } });

  it('ohne Recht kein Knopf – nur „Noch kein Ablauf.“', async () => {
    ctAnlegen();
    zeige();
    expect(await screen.findByText('Noch kein Ablauf.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Ablauf anlegen/ })).toBeNull();
  });

  it('„Ablauf anlegen“ ist das leise gestrichelte Feld (R10, B8) wie in der Musik-App – kein eigener Knopf', async () => {
    ctAnlegen();
    zeige({ start: darf });
    const knopf = await screen.findByRole('button', { name: /Ablauf anlegen/ });
    expect(knopf.className).toBe(leisesFeldKlasse());
  });

  it('Vorlage des eigenen Kalenders vorausgewählt; früherer Termin nur mit Ablauf aus demselben Kalender; Anlegen schreibt und öffnet das Bearbeiten', async () => {
    const ct = ctAnlegen();
    zeige({ start: darf });
    fireEvent.click(await screen.findByRole('button', { name: /Ablauf anlegen/ }));
    // Vorlagen: „Sonntag“ (Kalender 2) zuerst und gewählt.
    const sonntag = await screen.findByRole('button', { name: /Sonntag/ });
    expect(sonntag.getAttribute('aria-pressed')).toBe('true');
    // Wie ein früherer: nur Termin 5 (mit Ablauf, Kalender 2).
    fireEvent.click(screen.getByRole('button', { name: /Wie eine frühere/ }));
    expect(await screen.findByText('3 Punkte')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Gottesdienst/ })).toHaveLength(1);
    // Datum wie in der Musik-App („11. Okt“, nicht „11. OKT“).
    expect(screen.getByText('11. Okt · Gottesdienst')).toBeTruthy();
    // Zurück zur Vorlage und anlegen.
    fireEvent.click(screen.getByRole('button', { name: /Aus einer Vorlage/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Anlegen' }));
    await waitFor(() => expect(ct.angelegt()).toBe('?template_id=31'));
    expect(ct.geschrieben).toEqual(['PUT /api/events/7/agenda?template_id=31']);
    // Danach: der Ablauf steht da, und man ist im Bearbeiten.
    expect(await screen.findByRole('button', { name: 'Fertig' })).toBeTruthy();
    expect(await screen.findByText('Begrüßung')).toBeTruthy();
  });

  it('„wie ein früherer“ kopiert per `event_id`', async () => {
    const ct = ctAnlegen();
    zeige({ start: darf });
    fireEvent.click(await screen.findByRole('button', { name: /Ablauf anlegen/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Wie eine frühere/ }));
    await screen.findByText('3 Punkte');
    fireEvent.click(screen.getByRole('button', { name: 'Anlegen' }));
    await waitFor(() => expect(ct.angelegt()).toBe('?event_id=5'));
  });
});

/**
 * Neu aufsetzen (E6-5b, #691) – mit dem echten Kern (`ablaufNeuAufsetzen`: vorher vergleichen, nachher nachlesen);
 * ChurchTools ist nachgebaut wie gemessen: Vorlage ersetzt mit neuen IDs, `DELETE` löst den geteilten Ablauf.
 */
describe('TerminAnsicht – Neu aufsetzen (E6-5b)', () => {
  const ZIEL = { ...TERMIN, calendar: { domainIdentifier: '2' } };
  const darf = startFuer({ rechte: { ...startFuer().rechte, ablaufKalender: [2] } });

  function ctNeu(o: { geteilt?: boolean } = {}) {
    let items: { id: number; title: string }[] | null = [
      { id: 1, title: 'Alt eins' },
      { id: 2, title: 'Alt zwei' },
    ];
    let geteilt = o.geteilt ?? false;
    let ids = 100;
    const geschrieben: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = new URL(String(input));
      const p = url.pathname;
      const m = init?.method ?? 'GET';
      if (p.endsWith('/csrftoken')) return Promise.resolve(json(200, { data: 'tok' }));
      if (m !== 'GET') {
        const rumpf = init?.body ? (JSON.parse(String(init.body)) as unknown) : null;
        geschrieben.push(`${m} ${p}${url.search} ${JSON.stringify(rumpf)}`);
        if (m === 'DELETE') {
          items = null;
          geteilt = false;
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        if (url.searchParams.get('template_id') === '31') {
          items = [
            { id: ids++, title: 'Neu eins' },
            { id: ids++, title: 'Neu zwei' },
          ];
        }
        return Promise.resolve(json(200, { data: {} }));
      }
      if (p === '/api/agendatemplates') {
        return Promise.resolve(
          json(200, { data: [{ id: 31, name: 'Sonntag', calendarId: 2, items: [{}, {}] }] }),
        );
      }
      if (p === '/api/agendatemplates/31') {
        return Promise.resolve(json(200, { data: { id: 31, items: [{}, {}] } }));
      }
      if (p === '/api/events/7/agenda') {
        if (items === null) return Promise.resolve(json(404, { message: 'Not found.' }));
        const keys = geteilt ? ['7', '8'] : ['7'];
        return Promise.resolve(
          json(200, {
            data: {
              calendarId: 2,
              meta: { modifiedDate: '2026-10-23T10:00:00Z' },
              items: items.map((i) => ({
                ...i,
                type: 'normal',
                startTimes: Object.fromEntries(keys.map((k) => [k, '2026-10-18T08:00:00Z'])),
              })),
            },
          }),
        );
      }
      if (p === '/api/events/8') {
        return Promise.resolve(
          json(200, {
            data: { id: 8, name: 'Abendgottesdienst', startDate: '2026-10-18T16:00:00Z' },
          }),
        );
      }
      if (p === '/api/events' && url.searchParams.get('from'))
        return Promise.resolve(json(200, { data: [] }));
      if (p === '/api/events/7') return Promise.resolve(json(200, { data: ZIEL }));
      return Promise.resolve(json(200, { data: { id: 1 } }));
    });
    return { geschrieben };
  }

  async function bisZurNachfrage(): Promise<void> {
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    mehrEintrag(/Neu aufsetzen/);
    await screen.findByRole('button', { name: /Sonntag/ });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
  }

  it('aus der Vorlage ersetzen: Nachfrage mit Zahl, ein PUT, danach die neuen Punkte – weiter im Bearbeiten', async () => {
    const ct = ctNeu();
    zeige({ start: darf });
    await bisZurNachfrage();
    expect(
      await screen.findByText(
        /Die 2 Punkte dieses Ablaufs werden durch die Vorlage „Sonntag“ ersetzt/,
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ersetzen' }));
    expect(await screen.findByText('Neu eins')).toBeTruthy();
    expect(ct.geschrieben).toEqual(['PUT /api/events/7/agenda?template_id=31 {}']);
    expect(screen.getByRole('button', { name: 'Fertig' })).toBeTruthy();
  });

  it('geteilt, nur für diesen Termin: nennt den anderen Termin, löst die Verbindung und legt mit dem Kalender an', async () => {
    const ct = ctNeu({ geteilt: true });
    zeige({ start: darf });
    await bisZurNachfrage();
    expect(await screen.findByText('So, 18.10. · 18:00 · Abendgottesdienst')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nur für diesen Termin neu' }));
    expect(await screen.findByText('Neu eins')).toBeTruthy();
    expect(ct.geschrieben).toEqual([
      'DELETE /api/events/7/agenda null',
      'PUT /api/events/7/agenda?template_id=31 {"calendarId":2}',
    ]);
  });
});

/**
 * „Als Vorlage …“ (E10-V5) – mit dem echten Kern (`ablaufAlsVorlage`: ein POST mit allen Punkten, danach nachlesen);
 * ChurchTools ist nachgebaut. Der Link steht nur im Bearbeiten-Modus und nur mit Recht im Kalender des Termins.
 */
describe('TerminAnsicht – Als Vorlage … (E10-V5)', () => {
  const ZIEL = { ...TERMIN, calendar: { domainIdentifier: '2' } };
  const basis = startFuer().rechte;
  const darf = startFuer({
    rechte: { ...basis, ablaufKalender: [2], vorlagenKalender: [2] },
  });
  const nurAblauf = startFuer({ rechte: { ...basis, ablaufKalender: [2], vorlagenKalender: [3] } });

  function ctVorlage() {
    const geschrieben: { methode: string; pfad: string; rumpf: Record<string, unknown> }[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = new URL(String(input));
      const p = url.pathname;
      const m = init?.method ?? 'GET';
      if (p.endsWith('/csrftoken')) return Promise.resolve(json(200, { data: 'tok' }));
      if (m !== 'GET') {
        geschrieben.push({
          methode: m,
          pfad: p,
          rumpf: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {},
        });
        return Promise.resolve(json(200, { data: { id: 50 } }));
      }
      if (p === '/api/agendatemplates')
        return Promise.resolve(
          json(200, { data: [{ id: 31, name: 'Sonntag', calendarId: 2, items: [{}, {}] }] }),
        );
      if (p === '/api/agendatemplates/50')
        return Promise.resolve(json(200, { data: { id: 50, items: [{}, {}, {}] } }));
      if (p === '/api/calendars')
        return Promise.resolve(json(200, { data: [{ id: 2, name: 'Gottesdienst' }] }));
      if (p.endsWith('/agenda')) return Promise.resolve(json(200, { data: ABLAUF }));
      if (p === '/api/events/7') return Promise.resolve(json(200, { data: ZIEL }));
      return Promise.resolve(json(200, { data: [] }));
    });
    return { geschrieben };
  }

  it('mit Recht: Link links neben „Neu aufsetzen …“; Speichern schreibt EINEN POST mit Name, Kalender und allen Punkten', async () => {
    const ct = ctVorlage();
    zeige({ start: darf });
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    // Im „⋯“-Menü (B8, R6), nicht mehr in der Hinweiszeile: „Als Vorlage …“ vor „Neu aufsetzen …“.
    const namen = within(oeffneMehr())
      .getAllByRole('menuitem')
      .map((b) => b.textContent?.trim());
    expect(namen).toEqual(['Als Vorlage …', 'Neu aufsetzen …']);
    mehrEintrag(/Als Vorlage/);
    expect(
      await screen.findByText(/Ablauf von: Gottesdienst · So, 18.10.2026 · 3 Punkte/),
    ).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Speichern' })).toHaveProperty('disabled', false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Als Vorlage „Gottesdienst“ gespeichert.')).toBeTruthy();
    expect(ct.geschrieben).toHaveLength(1);
    const [post] = ct.geschrieben;
    expect(`${post.methode} ${post.pfad}`).toBe('POST /api/agendatemplates');
    expect(post.rumpf).toMatchObject({ name: 'Gottesdienst', calendarId: 2 });
    expect((post.rumpf.items as unknown[]).length).toBe(3);
    // Das Fenster ist zu, man bleibt im Bearbeiten.
    expect(screen.queryByText('Als Vorlage speichern')).toBeNull();
    expect(screen.getByRole('button', { name: 'Fertig' })).toBeTruthy();
  });

  it('ohne Recht für den Kalender des Termins (nur Ablauf bearbeiten, Vorlagen eines anderen Kalenders): kein Link', async () => {
    ctVorlage();
    zeige({ start: nurAblauf });
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    expect(mehrEintragOder(/Neu aufsetzen/)).toBeTruthy();
    expect(mehrEintragOder(/Als Vorlage/)).toBeNull();
  });

  it('in der Ansicht (nicht beim Bearbeiten) steht der Eintrag nicht', async () => {
    ctVorlage();
    zeige({ start: darf });
    await screen.findByRole('button', { name: 'Ablauf bearbeiten' });
    expect(mehrEintragOder(/Als Vorlage/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Als Vorlage/ })).toBeNull();
  });
});

/** Lied-Karte (E6-O1): Den Autor liefert der Ablauf nicht – eine Sammelabfrage holt ihn; scheitert sie, fehlt nur er. */
describe('TerminAnsicht – Autor auf der Lied-Karte (E6-O1)', () => {
  const MIT_LIED = {
    items: [
      {
        id: 1,
        type: 'song',
        title: 'Lied',
        song: { songId: 41, title: 'Treu', key: 'A', bpm: 75 },
      },
      {
        id: 2,
        type: 'song',
        title: 'Lied',
        song: { songId: 42, title: 'Halleluja', key: null, bpm: null },
      },
    ],
  };
  function ctLieder(lieder: () => Response) {
    const abfragen: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = new URL(String(input));
      if (url.pathname === '/api/songs') {
        abfragen.push(url.search);
        return Promise.resolve(lieder());
      }
      if (url.pathname.endsWith('/agenda')) return Promise.resolve(json(200, { data: MIT_LIED }));
      if (url.pathname.startsWith('/api/events/'))
        return Promise.resolve(json(200, { data: TERMIN }));
      return Promise.resolve(json(200, { data: [] }));
    });
    return abfragen;
  }

  it('eine Abfrage für alle Lieder; der Autor steht in der Karte', async () => {
    const abfragen = ctLieder(() =>
      json(200, {
        data: [
          { id: 41, author: 'Uwe Peters' },
          { id: 42, author: '' },
        ],
      }),
    );
    zeige();
    expect(await screen.findByText('A · 75 bpm · Uwe Peters')).toBeTruthy();
    expect(abfragen).toEqual(['?ids[]=41&ids[]=42']); // so in der Test-Instanz gemessen (E6-O0)
  });

  it('scheitert die Abfrage, steht die Karte ohne Autor da – kein Fehler auf der Seite', async () => {
    ctLieder(() => json(502, {}));
    zeige();
    expect(await screen.findByText('A · 75 bpm')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('TerminAnsicht – Lied-Ansicht (E6-O O4)', () => {
  const MIT_LIED = {
    items: [
      {
        id: 3,
        type: 'song',
        title: 'Lied',
        song: {
          songId: 41,
          arrangementId: 410,
          title: 'Treu',
          arrangement: 'Standard',
          key: 'A',
          bpm: 75,
        },
      },
    ],
  };
  const LIED = {
    id: 41,
    name: 'Treu',
    author: 'Uwe Peters',
    copyright: 'Beispiel-Verlag',
    ccli: '1234567',
    arrangements: [
      {
        id: 410,
        name: 'Standard',
        key: 'A',
        keyOfArrangement: 'A',
        bpm: '75',
        beat: null,
        files: [
          {
            name: 'Treu.chordpro',
            fileUrl: 'https://ct.test/?q=public/filedownload&id=901&filename=a',
          },
          {
            name: 'Treu — Akustik (App).chordpro',
            fileUrl: 'https://ct.test/?q=public/filedownload&id=902&filename=b',
          },
          { name: 'Treu.pdf', fileUrl: 'https://ct.test/?q=public/filedownload&id=903&filename=c' },
        ],
      },
    ],
  };
  const darf = startFuer({ rechte: { ...startFuer().rechte, ablaufKalender: [2] } });
  function ctLied(o: { lied?: () => Response; module?: unknown[] } = {}) {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = new URL(String(input));
      if (url.pathname === '/api/songs')
        return Promise.resolve(o.lied ? o.lied() : json(200, { data: [LIED] }));
      if (url.pathname === '/api/custommodules')
        return Promise.resolve(json(200, { data: o.module ?? [{ shorty: 'musik-app' }] }));
      if (url.pathname.endsWith('/agenda')) return Promise.resolve(json(200, { data: MIT_LIED }));
      if (url.pathname.startsWith('/api/events/'))
        return Promise.resolve(
          json(200, { data: { ...TERMIN, calendar: { domainIdentifier: '2' } } }),
        );
      return Promise.resolve(json(200, { data: [] }));
    });
  }
  const liedAntippen = async () =>
    fireEvent.click(await screen.findByRole('button', { name: /Uwe Peters/ }));

  it('Lied-Karte antippen: Autor · Verlag · CCLI, Arrangement, Tonart · Tempo, Dateien – ohne App-Versionen', async () => {
    ctLied();
    zeige();
    await liedAntippen();
    const fenster = await screen.findByRole('dialog', { name: 'Treu' });
    expect(within(fenster).getByText('Uwe Peters · Beispiel-Verlag · CCLI 1234567')).toBeTruthy();
    expect(within(fenster).getByText('Standard')).toBeTruthy();
    expect(within(fenster).getByText('A · 75 bpm')).toBeTruthy();
    const dateien = within(within(fenster).getByRole('region', { name: 'Dateien' })).getAllByRole(
      'link',
    );
    expect(dateien.map((a) => a.getAttribute('href'))).toEqual([
      'https://ct.test/?q=public/filedownload&id=901&filename=a',
      'https://ct.test/?q=public/filedownload&id=903&filename=c',
    ]);
    expect(dateien[0].textContent).toContain('Notenblatt (ChordPro)');
    expect(dateien[0].getAttribute('target')).toBe('_blank');
  });

  it('„In der Musik-App öffnen“ führt direkt zum Lied dieses Punkts in diesem Termin – mit seinem Tag', async () => {
    ctLied();
    zeige();
    await liedAntippen();
    const link = await screen.findByRole('link', { name: 'In der Musik-App öffnen' });
    expect(link.getAttribute('href')).toBe(
      `${window.location.origin}/ccm/musik-app/#/termin/7/punkt/3?am=2026-10-18`,
    );
    // Kein „Schließen“ neben dem X (02.11.2026) – nur der Link in die Musik-App steht unten.
    expect(fensterKnoepfe()).toEqual(['Fenster schließen']);
  });

  it('„Musik-App“ über dem Ablauf öffnet den Ablauf DIESES Termins, nicht nur die App (30.10.2026)', async () => {
    ctLied();
    zeige();
    const link = await screen.findByRole('link', { name: 'Musik-App' });
    expect(link.getAttribute('href')).toBe(
      `${window.location.origin}/ccm/musik-app/#/termin/7?am=2026-10-18`,
    );
  });

  it('„Bearbeiten“ steht mit Wort da, grau; im Bearbeiten blau „Fertig“ (30.10.2026)', async () => {
    ctLied();
    zeige({ start: darf });
    const knopf = await screen.findByRole('button', { name: 'Ablauf bearbeiten' });
    expect(knopf.textContent).toBe('Bearbeiten');
    expect(knopf.className).not.toMatch(/haupt/);
    fireEvent.click(knopf);
    const fertig = screen.getByRole('button', { name: 'Fertig' });
    expect(fertig.textContent).toBe('Fertig');
    expect(fertig.className).toMatch(/haupt/);
  });

  it('ohne Musik-App: Knopf ausgegraut, darunter wer sie installiert (Alwin, 28.10.2026)', async () => {
    ctLied({ module: [] });
    zeige();
    await liedAntippen();
    expect(
      await screen.findByText(
        /Die Musik-App ist hier nicht installiert – das macht ein ChurchTools-Admin\./,
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'In der Musik-App öffnen' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.queryByRole('link', { name: 'In der Musik-App öffnen' })).toBeNull();
  });

  it('Lied nicht ladbar: steht da, was der Ablauf weiß, mit Hinweis – kein Fehler auf der Seite', async () => {
    ctLied({ lied: () => json(502, {}) });
    zeige();
    fireEvent.click(await screen.findByRole('button', { name: /A · 75 bpm/ }));
    const fenster = await screen.findByRole('dialog', { name: 'Treu' });
    expect(within(fenster).getByText('Standard')).toBeTruthy();
    expect(within(fenster).getByText(/ließ sich gerade nicht laden/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('im Punkt-Fenster: Zeile „Lied“ öffnet die Ansicht an seiner Stelle; „Zurück“ behält die Eingaben', async () => {
    ctLied();
    zeige({ start: darf });
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    ersterPunkt();
    fireEvent.change(screen.getByPlaceholderText('z. B. Lied'), { target: { value: 'Lobpreis' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Lied: Treu – ansehen' }));
    expect(await screen.findByText('Uwe Peters · Beispiel-Verlag · CCLI 1234567')).toBeTruthy();
    // An der Stelle des Punkt-Fensters, nicht darüber: „‹“ oben zurück (seit 02.11.2026) – und ohne neues Einblenden.
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(fensterKnoepfe()).toEqual(['Zurück', 'Fenster schließen']);
    expect(screen.getByRole('dialog').parentElement!.className).toMatch(/still/);
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(screen.getByPlaceholderText<HTMLInputElement>('z. B. Lied').value).toBe('Lobpreis');
    // Auch der Rückweg ersetzt nur das Fenster, statt es neu einzublenden.
    expect(screen.getByRole('dialog').parentElement!.className).toMatch(/still/);
  });

  /** LW2b (06.11.2026): Wer Lieder sehen darf, bekommt im Punkt-Fenster die Liedauswahl wie in der Musik-App. */
  const mitLiedern = (sehen: boolean) => ({
    ...darf,
    lieder: { sehen, rechte: { statistik: false, ccli: false, liederAendern: false } },
  });

  it('mit Lied-Rechten: Zeile „Lied“ öffnet die Liedauswahl, dazu „Verknüpfung aufheben“ (LW2b)', async () => {
    ctLied();
    zeige({ start: mitLiedern(true) });
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    ersterPunkt();
    expect(await screen.findByRole('button', { name: 'Verknüpfung aufheben' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lied: Treu – ansehen' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Lied: Treu – anderes wählen' }));
    expect(await screen.findByRole('dialog', { name: 'Liedauswahl (Attrappe)' })).toBeTruthy();
    // Ein gewähltes Lied ist nur vorgemerkt – zurück im Punkt-Fenster steht es dort, geschrieben wird erst mit Speichern.
    fireEvent.click(screen.getByRole('button', { name: 'Way Maker wählen' }));
    expect(
      await screen.findByRole('button', { name: 'Lied: Way Maker – anderes wählen' }),
    ).toBeTruthy();
  });

  it('ohne das Recht, Lieder zu sehen: keine Liedauswahl, weiter die Lied-Ansicht (LW2b)', async () => {
    ctLied();
    zeige({ start: mitLiedern(false) });
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    ersterPunkt();
    expect(await screen.findByRole('button', { name: 'Lied: Treu – ansehen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Verknüpfung aufheben' })).toBeNull();
  });

  it('von der Lied-Karte geöffnet: blendet ein wie jedes Fenster', async () => {
    ctLied();
    zeige();
    await liedAntippen();
    expect(
      (await screen.findByRole('dialog', { name: 'Treu' })).parentElement!.className,
    ).not.toMatch(/still/);
  });
});

describe('Infos je Dienstgruppe in der Termin-Ansicht (E6-4, Entwurf `e6-infos-spalten.html`)', () => {
  // Sichtbar sind hier Technik und Musik (planbar), Programm nicht – so filtert ChurchTools auch die Infos.
  // Die Spaltenwahl merkt sich das Gerät – je Test frisch, sonst hakte ein Test die Wahl des vorigen wieder ab.
  beforeEach(() => localStorage.clear());
  const darf = startFuer({ rechte: { ...startFuer().rechte, ablaufKalender: [2] } });
  function ctInfos() {
    let notes = [{ serviceGroupId: 3, note: 'Mikro 1' }];
    const schreiben: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = new URL(String(input));
      const methode = init?.method ?? 'GET';
      if (url.pathname.endsWith('/csrftoken')) return Promise.resolve(json(200, { data: 'tok' }));
      if (methode !== 'GET') {
        schreiben.push(`${methode} ${url.pathname} ${String(init?.body ?? '')}`);
        const g = /\/servicegroups\/(\d+)$/.exec(url.pathname);
        if (g) {
          const note = (JSON.parse(String(init?.body ?? '{}')) as { note?: string }).note;
          notes = [
            ...notes.filter((n) => n.serviceGroupId !== Number(g[1])),
            ...(note ? [{ serviceGroupId: Number(g[1]), note }] : []),
          ];
        }
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.pathname.endsWith('/agenda'))
        return Promise.resolve(
          json(200, {
            data: {
              calendarId: 2,
              items: [
                {
                  id: 1,
                  type: 'normal',
                  title: 'Begrüßung',
                  start: '2026-10-18T08:00:00Z',
                  duration: 300,
                  serviceGroupNotes: notes,
                  responsible: {
                    persons: [
                      {
                        service: '[Technik]',
                        person: {
                          title: 'Anna Feld',
                          initials: 'AF',
                          imageUrl: 'https://ct.test/anna.jpg',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          }),
        );
      if (url.pathname.startsWith('/api/events/'))
        return Promise.resolve(
          json(200, { data: { ...TERMIN, calendar: { domainIdentifier: '2' } } }),
        );
      return Promise.resolve(
        json(200, { data: url.pathname.endsWith('/whoami') ? { id: 1 } : [] }),
      );
    });
    return { schreiben };
  }

  it('„Spalten“ → Technik angehakt → eigene Spalte mit der Info; Programm (nicht sichtbar) wird nicht angeboten', async () => {
    ctInfos();
    zeige({ start: darf });
    await screen.findByRole('button', { name: 'Ablauf bearbeiten' });
    mehrEintrag('Spalten wählen');
    const menue = screen.getByRole('dialog', { name: 'Infos als Spalten zeigen' });
    expect(
      within(menue)
        .getAllByRole('checkbox')
        .map((c) => c.closest('label')!.textContent),
    ).toEqual(['Technik1 Punkt', 'Musik–']);
    fireEvent.click(within(menue).getByRole('checkbox', { name: /Technik/ }));
    const ablauf = screen.getByRole('region', { name: 'Ablauf' });
    expect(within(ablauf).getByText('Mikro 1')).toBeTruthy();
    // In ChurchTools selbst: das Foto im Kreis (die Musik-App auf dem eigenen Server zeigt nur Kürzel).
    expect(ablauf.querySelector('img')?.getAttribute('src')).toBe('https://ct.test/anna.jpg');
    // Beim Bearbeiten kein „Spalten“ – dort gilt das Punkt-Fenster; die gewählte Info bleibt am Rechner als Spalte stehen
    // und ist direkt in der Zelle bearbeitbar (21.11.2026, vorher eine Zeile unter dem Punkt).
    fireEvent.click(screen.getByRole('button', { name: 'Ablauf bearbeiten' }));
    expect(mehrEintragOder('Spalten wählen')).toBeNull();
    const zelle = within(screen.getByRole('region', { name: 'Ablauf' })).getByText(/Mikro 1/);
    expect(zelle.textContent).toBe('Mikro 1');
    expect(zelle.closest('button')?.getAttribute('aria-label')).toMatch(
      /^Info für Technik bei „.*“ bearbeiten$/,
    );
  });

  it('im Punkt-Fenster geändert: schreibt NUR diese Gruppe, der Punkt selbst bleibt', async () => {
    const { schreiben } = ctInfos();
    zeige({ start: darf });
    fireEvent.click(await screen.findByRole('button', { name: 'Ablauf bearbeiten' }));
    ersterPunkt();
    const feld = await screen.findByRole<HTMLTextAreaElement>('textbox', {
      name: 'Info für Technik',
    });
    expect(feld.value).toBe('Mikro 1');
    expect(screen.queryByRole('textbox', { name: 'Info für Programm' })).toBeNull();
    fireEvent.change(feld, { target: { value: 'Mikro 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(schreiben).toHaveLength(1));
    expect(schreiben[0]).toBe(
      'PUT /api/events/7/agenda/items/1/servicegroups/3 {"note":"Mikro 2"}',
    );
  });

  it('„Ablauf zeigen“ (E6b-1): öffnet die Anzeige mit den gewählten Infos; nicht beim Bearbeiten; „Schließen“ führt zurück', async () => {
    ctInfos();
    zeige({ start: darf });
    await screen.findByRole('button', { name: 'Ablauf bearbeiten' });
    mehrEintrag('Spalten wählen');
    fireEvent.click(screen.getByRole('checkbox', { name: /Technik/ }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Infos als Spalten zeigen' })).getByRole('button', {
        name: 'Fenster schließen',
      }),
    );
    mehrEintrag('Ablauf zeigen');
    const anzeige = screen.getByRole('dialog', { name: /^Ablauf: / });
    expect(within(anzeige).getByText('Begrüßung')).toBeTruthy();
    expect(within(anzeige).getByText(/Mikro 1/).textContent).toBe('Technik: Mikro 1');
    fireEvent.click(within(anzeige).getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('dialog', { name: /^Ablauf: / })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ablauf bearbeiten' }));
    expect(mehrEintragOder('Ablauf zeigen')).toBeNull();
  });
});

describe('„Live“ (E6b-2 L2)', () => {
  const MIT_ID = { ...ABLAUF, id: 31 };

  /** ChurchTools mit Live-Agenda: `stelle` wie `pos_id` (gemessen: Zeichenkette oder `null`). */
  function ctLive(
    stelle: string | null,
    { ablauf = MIT_ID, termin = TERMIN }: { ablauf?: typeof MIT_ID; termin?: typeof TERMIN } = {},
  ) {
    const live: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/api/csrftoken')) return Promise.resolve(json(200, { data: 'c' }));
      if (url.includes('churchservice/ajax')) {
        live.push(String(init?.body));
        return Promise.resolve(
          json(200, {
            status: 'success',
            data: {
              pos_id: stelle,
              switchdate: stelle === null ? null : '2026-10-18T08:06:00Z',
              addseconds: '0',
              category_id: '2',
              currentTime: Date.now(),
            },
          }),
        );
      }
      if (url.includes('/agenda')) return Promise.resolve(json(200, { data: ablauf }));
      if (url.includes('/events/')) return Promise.resolve(json(200, { data: termin }));
      return Promise.resolve(json(200, { data: [] }));
    });
    return live;
  }

  /** Nur die Uhr anhalten – Zeitgeber laufen echt (die Termin-Ansicht lädt über sie). */
  function heute(iso: string) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.parse(iso));
  }
  afterEach(() => vi.useRealTimers());

  it('am Tag des Termins und gestartet: roter Punkt; der Knopf öffnet „Live“, „Schließen“ führt zurück', async () => {
    heute('2026-10-18T08:10:00Z');
    const live = ctLive('2');
    zeige();
    const knopf = await screen.findByRole('button', { name: 'Live – läuft gerade in ChurchTools' });
    expect(within(knopf).getByTestId('live-punkt')).toBeTruthy();
    expect(live[0]).toBe('func=loadAgendaLivePosition&event_id=7&agenda_id=31');
    fireEvent.click(knopf);
    const ansicht = screen.getByRole('dialog', { name: 'Live: Gottesdienst' });
    const jetzt = within(ansicht).getByRole('region', { name: 'Jetzt' });
    expect((await within(jetzt).findByRole('heading')).textContent).toBe('Lied – Du großer Gott');
    fireEvent.click(within(ansicht).getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('dialog', { name: 'Live: Gottesdienst' })).toBeNull();
  });

  it('Start mit offener Live-Ansicht (Knopf „Live“ auf der Startseite): sie ist gleich da, „Schließen“ führt zum Termin und räumt die Adresse auf', async () => {
    heute('2026-10-18T08:10:00Z');
    ctLive('2');
    window.history.replaceState(null, '', '#/termin/7/live');
    zeige({ liveStart: true });
    const ansicht = await screen.findByRole('dialog', { name: 'Live: Gottesdienst' });
    fireEvent.click(within(ansicht).getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('dialog', { name: 'Live: Gottesdienst' })).toBeNull();
    expect(window.location.hash).toBe('#/termin/7');
    // Ohne den Start bleibt sie zu.
    cleanup();
    zeige();
    await screen.findByRole('button', { name: 'Live – läuft gerade in ChurchTools' });
    expect(screen.queryByRole('dialog', { name: 'Live: Gottesdienst' })).toBeNull();
  });

  it('Steuern (L3): mit „Live-Agenda steuern“ am eigenen Dienst Knöpfe, sonst nicht – Regel aus `planAus`', async () => {
    heute('2026-10-18T07:00:00Z');
    ctLive(null);
    const mitRecht = startFuer({
      dienste: diensteAus([
        { id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [7], allowControlLiveAgenda: true },
        { id: 7, name: 'Licht', serviceGroupId: 3, groupIds: [7] },
      ]),
    });
    zeige({ start: mitRecht });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Live-Agenda von ChurchTools folgen' }),
    );
    const ansicht = screen.getByRole('dialog', { name: 'Live: Gottesdienst' });
    expect(within(ansicht).getByRole('group', { name: 'Live-Agenda steuern' })).toBeTruthy();
    fireEvent.click(within(ansicht).getByRole('button', { name: 'Schließen' }));
    cleanup();
    zeige();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Live-Agenda von ChurchTools folgen' }),
    );
    expect(screen.queryByRole('group', { name: 'Live-Agenda steuern' })).toBeNull();
  });

  it('Infos in „Live“ (L4-1, A16): an diesem Termin eingeteilt → nur die Infos der eigenen Dienstgruppe; sonst die „Spalten“-Wahl', async () => {
    heute('2026-10-18T08:10:00Z');
    const lied = ABLAUF.items[2];
    const mitInfos = {
      ...MIT_ID,
      items: [
        ...ABLAUF.items.slice(0, 2),
        {
          ...lied,
          serviceGroupNotes: [
            { serviceGroupId: 3, note: 'Mikro für den Chor' },
            { serviceGroupId: 4, note: 'Band leise' },
          ],
        },
      ],
    };
    // „Spalten“ steht auf Musik – für „Live“ zählt das nicht, wenn man eingeteilt ist.
    localStorage.setItem('dienstplaner.ablauf.infoSpalten', JSON.stringify([4]));
    // Alwin ist „Ton“ (Technik, Gruppe 3) – er sieht Technik und Musik, ist aber nur in Technik eingeteilt.
    ctLive('2', { ablauf: mitInfos });
    zeige();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Live – läuft gerade in ChurchTools' }),
    );
    const ansicht = screen.getByRole('dialog', { name: 'Live: Gottesdienst' });
    const jetzt = within(ansicht).getByRole('region', { name: 'Jetzt' });
    await within(jetzt).findByText(/Mikro für den Chor/);
    expect(within(ansicht).queryByText(/Band leise/)).toBeNull();
    fireEvent.click(within(ansicht).getByRole('button', { name: 'Schließen' }));
    cleanup();
    // Nirgends eingeteilt: wie bisher die Wahl unter „Spalten“ (hier Musik).
    ctLive('2', { ablauf: mitInfos, termin: { ...TERMIN, eventServices: [] } });
    zeige();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Live – läuft gerade in ChurchTools' }),
    );
    const ansicht2 = screen.getByRole('dialog', { name: 'Live: Gottesdienst' });
    const jetzt2 = within(ansicht2).getByRole('region', { name: 'Jetzt' });
    await within(jetzt2).findByText(/Band leise/);
    expect(within(ansicht2).queryByText(/Mikro für den Chor/)).toBeNull();
  });

  it('am Tag, aber nicht gestartet: Knopf ohne Punkt', async () => {
    heute('2026-10-18T07:00:00Z');
    const live = ctLive(null);
    zeige();
    await waitFor(() => expect(live).toHaveLength(1));
    expect(screen.getByRole('button', { name: 'Live-Agenda von ChurchTools folgen' })).toBeTruthy();
    expect(screen.queryByTestId('live-punkt')).toBeNull();
  });

  it('an einem anderen Tag: Knopf (zum Vorbereiten) ohne Punkt – und ohne Abfrage', async () => {
    heute('2026-10-17T08:10:00Z');
    const live = ctLive('2');
    zeige();
    expect(
      await screen.findByRole('button', { name: 'Live-Agenda von ChurchTools folgen' }),
    ).toBeTruthy();
    expect(screen.queryByTestId('live-punkt')).toBeNull();
    expect(live).toHaveLength(0);
  });

  it('am Tag, aber schon am Ende: kein Punkt', async () => {
    heute('2026-10-18T09:30:00Z');
    const live = ctLive('3');
    zeige();
    await waitFor(() => expect(live).toHaveLength(1));
    expect(screen.queryByTestId('live-punkt')).toBeNull();
  });
});

describe('„Weitere Infos“ (T1)', () => {
  /** ChurchTools mit einem Termin, dessen Infos sich speichern lassen – PUT wie gemessen (`isCanceled` fehlt → false). */
  function ctInfos(start: { description: string | null; isCanceled?: boolean }) {
    const termin = {
      ...TERMIN,
      description: start.description,
      isCanceled: start.isCanceled ?? false,
    };
    const schreiben: unknown[] = [];
    let stumm = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/api/csrftoken')) return Promise.resolve(json(200, { data: 'c' }));
      if (url.includes('/agenda')) return Promise.resolve(json(200, { data: ABLAUF }));
      if (url.includes('/events/7') && init?.method === 'PUT') {
        const b = JSON.parse(String(init.body)) as {
          description: string | null;
          isCanceled?: boolean;
        };
        schreiben.push(b);
        if (stumm) return Promise.resolve(json(200, { data: termin }));
        termin.description = b.description;
        termin.isCanceled = b.isCanceled === true;
        return Promise.resolve(json(200, { data: termin }));
      }
      if (url.includes('/events/')) {
        return Promise.resolve(json(200, { data: { ...termin } }));
      }
      return Promise.resolve(json(200, { data: [] }));
    });
    return {
      schreiben,
      termin,
      /** Beim nächsten Lesen hat jemand anderes schon gespeichert. */
      fremdGespeichert: (text: string) => {
        termin.description = text;
      },
      /** ChurchTools meldet Erfolg, übernimmt aber nichts. */
      stumm: () => (stumm = true),
    };
  }
  const darf = () => startFuer({ rechte: { ...startFuer().rechte, terminKalender: [2] } });

  it('der Anfang in einer Zeile unter dem Datum; ⓘ öffnet sie ganz – ohne Recht ohne „Bearbeiten“', async () => {
    ctInfos({ description: 'Abendmahl – Becher vorbereiten.\nGäste aus Siegburg.' });
    zeige();
    const zeile = await screen.findByRole('button', {
      name: 'Abendmahl – Becher vorbereiten. Gäste aus Siegburg.',
    });
    fireEvent.click(zeile);
    const f = screen.getByRole('dialog', { name: 'Weitere Infos' });
    expect(within(f).getByText(/Gäste aus Siegburg/).textContent).toBe(
      'Abendmahl – Becher vorbereiten.\nGäste aus Siegburg.',
    );
    expect(within(f).queryByRole('button', { name: 'Bearbeiten' })).toBeNull();
    fireEvent.click(within(f).getByRole('button', { name: 'Fenster schließen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weitere Infos zum Termin' }));
    expect(screen.getByRole('dialog', { name: 'Weitere Infos' })).toBeTruthy();
  });

  it('ohne Infos und ohne Recht kein ⓘ; mit Recht öffnet ⓘ gleich das Textfeld, „Abbrechen“ schließt', async () => {
    ctInfos({ description: null });
    zeige();
    await screen.findByRole('heading', { name: 'Gottesdienst' });
    expect(screen.queryByRole('button', { name: 'Weitere Infos zum Termin' })).toBeNull();
    cleanup();
    vi.restoreAllMocks();
    ctInfos({ description: null });
    zeige({ start: darf() });
    fireEvent.click(await screen.findByRole('button', { name: 'Weitere Infos zum Termin' }));
    // Leer und mit Recht: kein Zwischenschritt „Noch keine Infos“ → „Bearbeiten“ (Test-Instanz, 02.11.2026).
    expect(screen.getByRole('textbox', { name: 'Für alle, die den Termin sehen' })).toBeTruthy();
    expect(screen.queryByText('Noch keine Infos zu diesem Termin.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog', { name: 'Weitere Infos' })).toBeNull();
  });

  it('bearbeiten und speichern: description und frisches isCanceled gehen mit, die Zeile zeigt den neuen Text', async () => {
    const ct = ctInfos({ description: 'alt', isCanceled: true });
    const { onGeaendert } = zeige({ start: darf() });
    fireEvent.click(await screen.findByRole('button', { name: 'Weitere Infos zum Termin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    const feld = screen.getByRole('textbox', { name: 'Für alle, die den Termin sehen' });
    expect(screen.getByText('3 / 4000')).toBeTruthy();
    fireEvent.change(feld, { target: { value: 'neu\nmit Zeile' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(ct.schreiben).toHaveLength(1));
    expect(ct.schreiben[0]).toEqual({ description: 'neu\nmit Zeile', isCanceled: true });
    // Die Termine anderswo (Matrix) sind damit veraltet – die App lädt sie leise neu (03.11.2026).
    expect(onGeaendert).toHaveBeenCalledOnce();
    expect(await screen.findByRole('button', { name: 'neu mit Zeile' })).toBeTruthy();
    expect(
      within(screen.getByRole('dialog', { name: 'Weitere Infos' })).getByText(/mit Zeile/),
    ).toBeTruthy();
  });

  it('gemeldet, aber nicht übernommen: eigene Meldung statt „antwortet gerade nicht“', async () => {
    const ct = ctInfos({ description: 'alt' });
    ct.stumm();
    zeige({ start: darf() });
    fireEvent.click(await screen.findByRole('button', { name: 'Weitere Infos zum Termin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'neu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'ChurchTools hat die Infos nicht übernommen. Bitte noch einmal versuchen.',
    );
  });

  it('zu lang: Zähler rot, Speichern gesperrt', async () => {
    ctInfos({ description: '' });
    zeige({ start: darf() });
    fireEvent.click(await screen.findByRole('button', { name: 'Weitere Infos zum Termin' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x'.repeat(4001) } });
    expect(screen.getByText(/4001 \/ 4000/).textContent).toMatch(/zu lang/);
    expect(screen.getByRole('button', { name: 'Speichern' }).hasAttribute('disabled')).toBe(true);
  });

  it('inzwischen woanders gespeichert: nachfragen statt überschreiben – „Ihre übernehmen“ oder „Meine speichern“', async () => {
    const ct = ctInfos({ description: 'alt' });
    zeige({ start: darf() });
    fireEvent.click(await screen.findByRole('button', { name: 'Weitere Infos zum Termin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'meins' } });
    ct.fremdGespeichert('von David');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /eben woanders geändert.*von David/s,
    );
    expect(ct.schreiben).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Meine speichern' }));
    await waitFor(() => expect(ct.schreiben).toHaveLength(1));
    expect(ct.termin.description).toBe('meins');
  });

  it('„Ihre übernehmen“: der Text aus ChurchTools ins Feld und in die Zeile, nichts geschrieben', async () => {
    const ct = ctInfos({ description: 'alt' });
    zeige({ start: darf() });
    fireEvent.click(await screen.findByRole('button', { name: 'Weitere Infos zum Termin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'meins' } });
    ct.fremdGespeichert('von David');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ihre übernehmen' }));
    expect(screen.getByRole('textbox')).toHaveProperty('value', 'von David');
    expect(screen.getByRole('button', { name: 'von David' })).toBeTruthy();
    expect(ct.schreiben).toHaveLength(0);
  });
});

describe('Dateien am Termin (T2a)', () => {
  const download = (id: number) =>
    `${window.location.origin}/?q=public/filedownload&id=${id}&filename=abc`;
  /** `eventFiles` wie in der Terminliste gemessen (02.11.2026) – ohne Größe. */
  const EVENT_FILES = [
    { title: 'Folien.pdf', domainType: 'file', domainIdentifier: '21', frontendUrl: download(21) },
    {
      title: 'Liedtexte',
      domainType: 'link',
      domainIdentifier: '22',
      frontendUrl: 'https://example.org/x',
    },
  ];
  /** Die ausführliche Liste (`/files/service/7`) – mit Größe; `frisch` ersetzt sie (z. B. inzwischen eine mehr). */
  function ctDateien(o: { eventFiles?: unknown[]; frisch?: unknown[] | 'fehler' } = {}) {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/agenda')) return Promise.resolve(json(200, { data: ABLAUF }));
      if (url.includes('/files/service/7')) {
        if (o.frisch === 'fehler') return Promise.resolve(json(503, {}));
        return Promise.resolve(
          json(200, {
            data: o.frisch ?? [
              { id: 21, name: 'Folien.pdf', type: 'file', fileUrl: download(21), size: 2516582 },
              {
                id: 22,
                name: 'Liedtexte',
                type: 'link',
                fileUrl: 'https://example.org/x',
                size: null,
              },
            ],
          }),
        );
      }
      if (url.includes('/events/')) {
        return Promise.resolve(
          json(200, { data: { ...TERMIN, eventFiles: o.eventFiles ?? EVENT_FILES } }),
        );
      }
      return Promise.resolve(json(200, { data: [] }));
    });
  }
  const knopf = (n: number) => screen.findByRole('button', { name: `Dateien zum Termin (${n})` });

  it('Büroklammer mit Zahl im Kopf; das Fenster zeigt die Dateien mit Größe und öffnet sie aus ChurchTools', async () => {
    ctDateien();
    const { onGeaendert } = zeige();
    fireEvent.click(await knopf(2));
    const f = screen.getByRole('dialog', { name: 'Dateien' });
    expect(within(f).getByText('Gottesdienst · So, 18.10.2026')).toBeTruthy();
    expect(await within(f).findByText('PDF · 2,4 MB')).toBeTruthy();
    const pdf = within(f).getByRole('link', { name: /Folien\.pdf/ });
    expect(pdf.getAttribute('href')).toBe(download(21));
    expect(pdf.getAttribute('target')).toBe('_blank');
    expect(
      within(f)
        .getByRole('link', { name: /Liedtexte/ })
        .getAttribute('href'),
    ).toBe('https://example.org/x');
    expect(within(f).getByText('Link · example.org')).toBeTruthy();
    // Dieselben Dateien wie im Plan: nichts veraltet, nichts neu zu laden.
    expect(onGeaendert).not.toHaveBeenCalled();
  });

  it('in ChurchTools: ⓘ und Büroklammer im Kopf sind die Zeichen der Dienstplan-Liste', async () => {
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        forEach: (fn: (f: { family: string }) => void) => fn({ family: 'Font Awesome Pro' }),
      },
    });
    try {
      ctDateien({ eventFiles: [], frisch: [] });
      zeige({ start: startFuer({ rechte: { ...startFuer().rechte, terminKalender: [2] } }) });
      const klammer = await screen.findByRole('button', { name: 'Datei an den Termin anhängen' });
      expect(klammer.querySelector('i')?.className).toBe('fas fa-paperclip');
      expect(
        screen.getByRole('button', { name: 'Weitere Infos zum Termin' }).querySelector('i')
          ?.className,
      ).toBe('fas fa-info');
    } finally {
      delete (document as { fonts?: unknown }).fonts;
    }
  });

  it('ohne Dateien und ohne Recht keine Büroklammer', async () => {
    ctDateien({ eventFiles: [] });
    zeige();
    await screen.findByRole('heading', { name: 'Gottesdienst' });
    expect(screen.queryByRole('button', { name: /^Dateien zum Termin|anhängen/ })).toBeNull();
  });

  it('ohne Dateien, aber mit Recht (T2b): Büroklammer ohne Zahl, öffnet gleich „Anhang hinzufügen“', async () => {
    ctDateien({ eventFiles: [], frisch: [] });
    zeige({ start: startFuer({ rechte: { ...startFuer().rechte, terminKalender: [2] } }) });
    const knopf = await screen.findByRole('button', { name: 'Datei an den Termin anhängen' });
    expect(knopf.textContent).toBe('');
    fireEvent.click(knopf);
    expect(screen.getByRole('dialog', { name: 'Anhang hinzufügen' })).toBeTruthy();
  });

  it('mit Recht (T2b): ein Tipp auf eine Datei zeigt ihr kleines Fenster, unten „Anhang hinzufügen“', async () => {
    ctDateien();
    zeige({ start: startFuer({ rechte: { ...startFuer().rechte, terminKalender: [2] } }) });
    fireEvent.click(await knopf(2));
    const f = screen.getByRole('dialog', { name: 'Dateien' });
    expect(within(f).getByRole('button', { name: 'Anhang hinzufügen' })).toBeTruthy();
    // Kein Link mehr in der Liste – erst das kleine Fenster (Öffnen, Umbenennen, Löschen; Entwurf D1, 03.11.2026).
    expect(within(f).queryByRole('link')).toBeNull();
    fireEvent.click(within(f).getByRole('button', { name: /Folien\.pdf/ }));
    const d = screen.getByRole('dialog', { name: 'Folien.pdf' });
    expect(within(d).getByRole('link', { name: 'Öffnen' }).getAttribute('href')).toBe(download(21));
  });

  it('die frische Liste zählt: inzwischen eine Datei mehr → die Zahl im Kopf folgt', async () => {
    ctDateien({
      frisch: [
        { id: 21, name: 'Folien.pdf', type: 'file', fileUrl: download(21), size: 1 },
        { id: 22, name: 'Liedtexte', type: 'link', fileUrl: 'https://example.org/x', size: null },
        { id: 23, name: 'Plakat.png', type: 'file', fileUrl: download(23), size: 2 },
      ],
    });
    const { onGeaendert } = zeige();
    fireEvent.click(await knopf(2));
    expect(await screen.findByRole('link', { name: /Plakat\.png/ })).toBeTruthy();
    // Inzwischen eine mehr: Der Plan der Matrix ist veraltet.
    expect(onGeaendert).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Fenster schließen' }));
    expect(await knopf(3)).toBeTruthy();
  });

  it('frische Liste nicht ladbar: die bekannten Dateien bleiben stehen, mit Hinweis', async () => {
    ctDateien({ frisch: 'fehler' });
    zeige();
    fireEvent.click(await knopf(2));
    const f = screen.getByRole('dialog', { name: 'Dateien' });
    expect((await within(f).findByRole('status')).textContent).toMatch(/zuletzt bekannte Stand/);
    expect(within(f).getByRole('link', { name: /Folien\.pdf/ })).toBeTruthy();
    expect(within(f).getByRole('link', { name: /Liedtexte/ })).toBeTruthy();
    // Und die Zahl im Kopf bleibt.
    fireEvent.click(within(f).getByRole('button', { name: 'Fenster schließen' }));
    expect(await knopf(2)).toBeTruthy();
  });

  it('eine Datei auf fremdem Host und ein Link ohne http(s) führen nirgendwohin', async () => {
    ctDateien({
      frisch: [
        {
          id: 21,
          name: 'Fremd.pdf',
          type: 'file',
          fileUrl: 'https://boese.example/?q=public/filedownload&id=21',
          size: 1,
        },
        { id: 22, name: 'Skript', type: 'link', fileUrl: 'javascript:alert(1)', size: null },
      ],
    });
    zeige();
    fireEvent.click(await knopf(2));
    const f = screen.getByRole('dialog', { name: 'Dateien' });
    expect(await within(f).findByText('Fremd.pdf')).toBeTruthy();
    expect(within(f).queryByRole('link')).toBeNull();
    expect(within(f).getByText('Skript')).toBeTruthy();
  });
});

describe('Einteilen in der Termin-Ansicht (F1, 09.11.2026)', () => {
  // Termin 7: Ton (Dienst 6) hat Alwin, Licht (Dienst 7) ist frei – beide in Technik (Gruppe 3), die Alwin plant.
  const hier = (x: Parameters<typeof entwurf>[0] = {}) =>
    entwurf({ ort: { eventId: 7, serviceId: 7, index: null }, ...x });
  const leiste = () =>
    screen.queryByRole('status', { name: 'Noch nicht gesendet' })?.textContent ?? null;

  it('als Planer: „frei“ antippen öffnet „Wer kann?“ – dasselbe Fenster wie in der Matrix; dazu die Hilfe „?“', async () => {
    ct();
    zeige({ entwuerfe: nachgebaut() });
    fireEvent.click(await screen.findByRole('button', { name: /^frei – Wer kann\?/ }));
    // Das Fenster „Wer kann?“ der Matrix (`WerKann`) – Titel Dienst · Tag.
    expect(await screen.findByRole('dialog', { name: /^Licht · / })).toBeTruthy();
    // Der Hinweis steht nicht mehr unter den Diensten, sondern in der Hilfe „?“ im Kopf.
    expect(screen.queryByText(/Freien Platz antippen zeigt/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Hilfe zu Termin' }));
    expect(screen.getByText(/Freien Platz antippen zeigt „Wer kann\?“/)).toBeTruthy();
  });

  it('die Vorgabe „Anfrage | direkt“ des Dienstes (P2m, je Gerät aus der Matrix) gilt auch hier: Licht direkt → Entwurf direkt', async () => {
    const spy = ct();
    const sonst = spy.getMockImplementation()!;
    spy.mockImplementation((input, init) =>
      String(input).includes('possiblepersons')
        ? Promise.resolve(
            json(200, {
              data: [{ person: { domainIdentifier: '46', title: 'Ben Test' }, score: 0 }],
            }),
          )
        : sonst(input, init),
    );
    const s = vi.fn((_d: unknown, _g: number, e: Omit<Entwurf, 'zeit' | 'version' | 'von'>) =>
      Promise.resolve({
        ok: true as const,
        entwurf: { ...e, von: ALWIN, zeit: '2026-10-01T10:00:00.000Z', version: 1 },
      }),
    );
    localStorage.setItem('dienstplaner.planen.ansicht', JSON.stringify({ direktDienste: [7] }));
    try {
      zeige({ entwuerfe: nachgebaut({ speichern: s }) });
      fireEvent.click(await screen.findByRole('button', { name: /^frei – Wer kann\?/ }));
      fireEvent.click(await screen.findByRole('button', { name: /^Ben Test/ }));
      await waitFor(() => expect(s).toHaveBeenCalledTimes(1));
      expect(s.mock.calls[0][2]).toMatchObject({ modus: 'direkt', ort: { serviceId: 7 } });
    } finally {
      localStorage.removeItem('dienstplaner.planen.ansicht');
    }
  });

  it('ohne Planen-Recht: Plätze nur zum Ansehen, keine Hilfe, kein Zauberstab – wie bisher', async () => {
    ct();
    zeige({
      entwuerfe: nachgebaut(),
      start: startFuer({
        rechte: {
          planbareDienstgruppen: [],
          sichtbareDienstgruppen: [3],
          ablaufKalender: [],
          terminKalender: [],
          abwesenheitenAller: false,
        },
      }),
    });
    expect(await screen.findByText('frei')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /frei – Wer kann/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hilfe zu Termin' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Automatische Planung/ })).toBeNull();
  });

  it('ein Entwurf steht am Platz; unten die Leiste „an diesem Termin“ – Entwürfe anderer Termine zählen nicht', async () => {
    ct();
    const anschluss = nachgebaut({
      laden: () =>
        Promise.resolve(daten([hier(), entwurf({ ort: { eventId: 99, serviceId: 7, index: 1 } })])),
    });
    zeige({ entwuerfe: anschluss });
    await waitFor(() =>
      expect(leiste()).toBe(
        '1 Entwurf noch nicht gesendetan diesem TerminAlle verwerfenAnsehen und senden',
      ),
    );
    expect(screen.getByTitle(/^Entwurf von/).textContent).toContain('Ben Test');
    // Die anderen Termine werden hier nicht nachgefragt (nur „Planen“ sucht alte Entwürfe).
    expect(anschluss.termine).not.toHaveBeenCalled();
  });

  it('„Ansehen und senden“: nur dieser Termin, Hinweis auf die anderen; danach Termin leise neu und Bescheid an die anderen Ansichten', async () => {
    // Nach dem Senden steht in ChurchTools Ben Test (angefragt) an Licht – und der Entwurf ist weg.
    let gesendetIst = false;
    const spy = ct({
      termin: () =>
        json(200, {
          data: gesendetIst
            ? {
                ...TERMIN,
                eventServices: [
                  TERMIN.eventServices[0],
                  { serviceId: 7, personId: 46, name: 'Ben Test', isAccepted: false },
                ],
              }
            : TERMIN,
        }),
    });
    const senden = vi.fn((...a: Parameters<ReturnType<typeof gesendet>>) => {
      gesendetIst = true;
      return gesendet()(...a);
    });
    const { onGeaendert } = zeige({
      entwuerfe: nachgebaut({
        laden: () =>
          Promise.resolve(
            daten(
              gesendetIst
                ? []
                : [hier(), entwurf({ ort: { eventId: 99, serviceId: 7, index: 1 } })],
            ),
          ),
        senden,
      }),
    });
    await waitFor(() => expect(leiste()).toMatch(/^1 Entwurf/));
    fireEvent.click(screen.getByRole('button', { name: 'Ansehen und senden' }));
    expect(
      await screen.findByText(
        'An einem anderen Termin liegen noch Entwürfe – die sendest du unter „Planen“.',
      ),
    ).toBeTruthy();
    const vorher = spy.mock.calls.filter(([u]) => String(u).includes('/events/')).length;
    fireEvent.click(await screen.findByRole('button', { name: 'Jetzt senden (1)' }));
    await screen.findByText('Gesendet');
    expect(senden.mock.calls[0][1]).toEqual([{ entwurf: hier(), kategorie: 30 }]);
    fireEvent.click(await screen.findByRole('button', { name: 'Fenster schließen' }));
    await waitFor(() =>
      expect(spy.mock.calls.filter(([u]) => String(u).includes('/events/')).length).toBe(
        vorher + 1,
      ),
    );
    expect(onGeaendert).toHaveBeenCalled();
    // Leise: die Ansicht bleibt stehen (kein „Termin wird geladen …“) – und zeigt danach, was jetzt in ChurchTools steht.
    expect(screen.queryByText('Termin wird geladen …')).toBeNull();
    const dienste = screen.getByRole('region', { name: 'Dienste' });
    await waitFor(() => expect(within(dienste).queryByText('frei')).toBeNull());
    expect(within(dienste).getByText('Ben Test')).toBeTruthy();
    expect(leiste()).toBeNull();
  });

  it('Zauberstab je Gruppe für diesen Termin – öffnet die automatische Planung', async () => {
    ct();
    zeige({ entwuerfe: nachgebaut() });
    fireEvent.click(await screen.findByRole('button', { name: 'Automatische Planung Technik' }));
    expect(
      await screen.findByRole('dialog', { name: /Automatische Planung · Technik/ }),
    ).toBeTruthy();
  });

  it('am Handy: „Ansehen & senden“, ohne Zusatzzeile', async () => {
    ct();
    zeige({
      handy: true,
      entwuerfe: nachgebaut({ laden: () => Promise.resolve(daten([hier()])) }),
    });
    await waitFor(() => expect(leiste()).toBe('1 EntwurfVerwerfenAnsehen & senden'));
  });
});
