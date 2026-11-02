// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ablaufZeileAus } from '@shared/ct/ablaufZeile';
import { liveStandAus, type LiveGrund, type LiveStand } from '@shared/ct/liveAgenda';
import type { CtAgendaItem } from '@shared/ct/typen';
import { LiveAnsicht } from './LiveAnsicht';
import { TAKT_MS } from './useLive';

/**
 * **„Live“ zum Folgen** (E6b-2 L2, Entwurf `e6b-2-live.html` Variante A). Der Stand kommt aus `liveStandAus` (Antworten
 * wie gemessen), Liste und Lage aus dem echten Kern; nur das Lesen ist ersetzt. **Fake-Timer:** Takt (2,5 s) und Uhr
 * (1 s) werden vorgespult, sonst täte ein echter Zeitgeber die Arbeit, die der Test der Ansicht zuschreibt.
 */
const T = 216;
const ms = (iso: string) => Date.parse(iso);

/** Der Ablauf des Probe-Termins aus der Messung L0 – „Lied“ weggelassen –, dazu Zuständige, Infos und ein Lied ohne Dauer. */
const ITEMS: CtAgendaItem[] = [
  {
    id: 964,
    title: 'Ankommen',
    type: 'header',
    duration: 0,
    startTimes: { '216': '2027-03-07T09:00:00Z' },
  },
  {
    id: 968,
    title: 'Begrüßung',
    type: 'text',
    duration: 300,
    startTimes: { '216': '2027-03-07T09:00:00Z' },
  },
  { id: 970, title: 'Lied', type: 'text', duration: 240, startTimes: { '216': null } },
  {
    id: 972,
    title: 'Predigt',
    type: 'text',
    duration: 1800,
    startTimes: { '216': '2027-03-07T09:05:00Z' },
    responsible: {
      text: '[Predigt]',
      persons: [{ service: '[Predigt]', person: { title: 'Clara Test' } }],
    },
    note: 'Thema folgt',
    serviceGroupNotes: [{ serviceGroupId: 3, note: 'Headset' }],
  },
  {
    id: 973,
    title: 'Lied',
    type: 'song',
    duration: 0,
    startTimes: { '216': '2027-03-07T09:35:00Z' },
    song: { title: 'Wie groß', songId: 5, arrangementId: 7 } as CtAgendaItem['song'],
  },
  {
    id: 974,
    title: 'Ansagen',
    type: 'text',
    duration: 300,
    startTimes: { '216': '2027-03-07T09:35:00Z' },
  },
  {
    id: 976,
    title: 'Segen',
    type: 'text',
    duration: 300,
    startTimes: { '216': '2027-03-07T09:40:00Z' },
  },
];
const ZEILEN = ITEMS.map((i) => ablaufZeileAus(i, T, 'Europe/Berlin'));
const ENDE = 7;

/** Eine Antwort wie gemessen; `uhrVor`: um wie viel die Uhr des Geräts der von ChurchTools vorausgeht. */
function stand(
  stelle: number | null,
  seit: string | null,
  o: { zusatz?: number; uhrVor?: number } = {},
): LiveStand {
  return liveStandAus({
    pos_id: stelle === null ? null : String(stelle),
    switchdate: seit,
    addseconds: o.zusatz === undefined ? null : String(o.zusatz),
    category_id: '2',
    currentTime: Date.now() - (o.uhrVor ?? 0),
  }) as LiveStand;
}

type Antwort =
  | { stelle: number | null; seit: string | null; zusatz?: number; uhrVor?: number }
  | LiveGrund;

function zeige(antworten: Antwort[]) {
  const folge = [...antworten];
  const lesen = vi.fn((_t: number, _a: number) => {
    const a = folge.length > 1 ? folge.shift()! : folge[0];
    return Promise.resolve(
      typeof a === 'string'
        ? ({ ok: false, grund: a } as const)
        : ({ ok: true, stand: stand(a.stelle, a.seit, a) } as const),
    );
  });
  const onSchliessen = vi.fn();
  render(
    <LiveAnsicht
      titel="Gottesdienst"
      tag="2027-03-07"
      beginn="10:00"
      terminId={T}
      agendaId={126}
      items={ITEMS}
      zeilen={ZEILEN}
      infoGruppen={[{ id: 3, name: 'Technik' }]}
      zeitzone="Europe/Berlin"
      onSchliessen={onSchliessen}
      lesen={lesen}
    />,
  );
  return { lesen, onSchliessen };
}

/** Promises der Abfrage abarbeiten, ohne die Zeit weiterzudrehen. */
const fertig = () => act(() => vi.advanceTimersByTimeAsync(0));
const spulen = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

const jetztBereich = () => screen.getByRole('region', { name: 'Jetzt' });
const restzeit = () => screen.getByLabelText('Restzeit').textContent;

function sichtbarkeit(wert: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => wert });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(ms('2027-03-07T09:08:00Z'));
  sichtbarkeit('visible');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('LiveAnsicht', () => {
  it('läuft: Jetzt mit Zuständigen und Infos, Dann, Restzeit, Abweichung, Liste mit erledigt/weggelassen/aktuell', async () => {
    zeige([{ stelle: 3, seit: '2027-03-07T09:07:00Z' }]);
    await fertig();
    const jetzt = jetztBereich();
    expect(within(jetzt).getByText('Jetzt')).toBeTruthy();
    expect(within(jetzt).getByRole('heading').textContent).toBe('Predigt');
    // Die Notiz wie in der Live-Agenda von ChurchTools.
    expect(within(jetzt).getByText('Thema folgt')).toBeTruthy();
    expect(within(jetzt).getByText('Clara Test')).toBeTruthy();
    expect(within(jetzt).getByText(/Headset/).textContent).toBe('Technik: Headset');
    // Das Lied ohne Dauer läuft mit „Jetzt“ mit, „Dann“ ist der nächste eigene Punkt.
    expect(within(jetzt).getByText('mit Lied – Wie groß')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Dann' })).getByText('Ansagen')).toBeTruthy();
    expect(restzeit()).toBe('29:00noch, von 30 Min');
    expect(screen.getByText('2 Min. später')).toBeTruthy();
    const liste = screen.getByRole('list', { name: 'Ablauf' });
    const punkte = within(liste).getAllByRole('listitem');
    expect(punkte.map((p) => p.textContent)).toEqual([
      '10:00Begrüßung',
      'Lied',
      '10:05PredigtClara Test',
      '10:35Lied – Wie groß',
      '10:35Ansagen',
      '10:40Segen',
    ]);
    expect(punkte[0].className).toMatch(/erledigt/);
    expect(punkte[0].querySelector('svg')).toBeTruthy();
    expect(punkte[1].className).toMatch(/weggelassen/);
    expect(punkte[2].getAttribute('aria-current')).toBe('step');
    expect(screen.getByText('Live').getAttribute('data-laeuft')).toBe('true');
  });

  it('nicht gestartet: „Jetzt“ nach der Uhr, mit Hinweis – kein Punkt „läuft“, keine Abweichung', async () => {
    vi.setSystemTime(ms('2027-03-07T09:10:00Z'));
    zeige([{ stelle: null, seit: null }]);
    await fertig();
    expect(within(jetztBereich()).getByText('Jetzt · nach Plan')).toBeTruthy();
    expect(within(jetztBereich()).getByRole('heading').textContent).toBe('Predigt');
    expect(screen.getByText('Noch nicht gestartet – „Jetzt“ folgt der Uhr.')).toBeTruthy();
    expect(restzeit()).toBe('25:00noch, von 30 Min');
    expect(screen.queryByText(/Gesamt/)).toBeNull();
    expect(screen.getByText('Live').getAttribute('data-laeuft')).toBe('false');
  });

  it('vor dem ersten Punkt: „Noch nicht begonnen“ mit Beginn, „Dann“ der erste', async () => {
    vi.setSystemTime(ms('2027-03-07T08:50:00Z'));
    zeige([{ stelle: null, seit: null }]);
    await fertig();
    expect(within(jetztBereich()).getByRole('heading').textContent).toBe('Noch nicht begonnen');
    expect(within(jetztBereich()).getByText('Beginn 10:00')).toBeTruthy();
    expect(
      within(screen.getByRole('region', { name: 'Dann' })).getByText('Begrüßung'),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Restzeit')).toBeNull();
  });

  it('Zeit um: rot, „+1:45“ und „über der Zeit“', async () => {
    vi.setSystemTime(ms('2027-03-07T09:06:45Z'));
    zeige([{ stelle: 1, seit: '2027-03-07T09:00:00Z' }]);
    await fertig();
    expect(restzeit()).toBe('+1:45über der Zeit');
    expect(screen.getByLabelText('Restzeit').className).toMatch(/ueber/);
    // Kein Bogen mehr, nur die rote Spur (sonst stand oben ein blauer Punkt – Demo, 02.11.2026).
    expect(screen.getByLabelText('Restzeit').querySelectorAll('circle')).toHaveLength(1);
  });

  it('Ende: „Ablauf vorbei“, fertig um, Abweichung; alles erledigt', async () => {
    vi.setSystemTime(ms('2027-03-07T09:50:00Z'));
    zeige([{ stelle: ENDE, seit: '2027-03-07T09:49:00Z' }]);
    await fertig();
    expect(within(jetztBereich()).getByRole('heading').textContent).toBe('Ablauf vorbei');
    expect(within(jetztBereich()).getByText(/Fertig um/).textContent).toBe(
      'Fertig um 10:49 · 4 Min. später',
    );
    expect(screen.queryByRole('region', { name: 'Dann' })).toBeNull();
    const punkte = within(screen.getByRole('list', { name: 'Ablauf' })).getAllByRole('listitem');
    expect(punkte.filter((p) => /erledigt/.test(p.className))).toHaveLength(5);
  });

  it('rechnet in der Uhr von ChurchTools: geht das Gerät 3 s vor, stimmt die Restzeit trotzdem', async () => {
    zeige([{ stelle: 3, seit: '2027-03-07T09:07:57Z', uhrVor: 3000 }]);
    await fertig();
    // ChurchTools-Zeit 09:07:57 = Wechsel gerade eben → volle 30:00 (ohne Abgleich wären es 29:57).
    expect(restzeit()).toBe('30:00noch, von 30 Min');
  });

  it('fragt sofort und dann alle 2,5 s – folgt einem Weiterschalten in ChurchTools; die Restzeit läuft jede Sekunde', async () => {
    const { lesen } = zeige([
      { stelle: 3, seit: '2027-03-07T09:07:00Z' },
      { stelle: 3, seit: '2027-03-07T09:07:00Z' },
      { stelle: 5, seit: '2027-03-07T09:08:02Z' },
    ]);
    await fertig();
    expect(lesen).toHaveBeenCalledTimes(1);
    expect(lesen).toHaveBeenLastCalledWith(T, 126);
    await spulen(1000);
    expect(restzeit()).toBe('28:59noch, von 30 Min');
    await spulen(TAKT_MS - 1001);
    expect(lesen).toHaveBeenCalledTimes(1);
    await spulen(1);
    expect(lesen).toHaveBeenCalledTimes(2);
    await spulen(TAKT_MS);
    expect(lesen).toHaveBeenCalledTimes(3);
    expect(within(jetztBereich()).getByRole('heading').textContent).toBe('Ansagen');
  });

  it('langsame Leitung: die nächste Abfrage erst, wenn die vorige zurück ist', async () => {
    let antworten: (() => void) | null = null;
    const lesen = vi.fn(
      () =>
        new Promise<{ ok: true; stand: LiveStand }>((ok) => {
          antworten = () => ok({ ok: true, stand: stand(3, '2027-03-07T09:07:00Z') });
        }),
    );
    render(
      <LiveAnsicht
        titel="Gottesdienst"
        tag="2027-03-07"
        beginn="10:00"
        terminId={T}
        agendaId={126}
        items={ITEMS}
        zeilen={ZEILEN}
        infoGruppen={[]}
        zeitzone="Europe/Berlin"
        onSchliessen={() => {}}
        lesen={lesen}
      />,
    );
    await spulen(TAKT_MS * 4);
    // Auch ein Wechsel der Sichtbarkeit fragt nicht doppelt.
    sichtbarkeit('visible');
    await fertig();
    expect(lesen).toHaveBeenCalledTimes(1);
    await act(async () => antworten?.());
    await spulen(TAKT_MS);
    expect(lesen).toHaveBeenCalledTimes(2);
  });

  it('kurzer Aussetzer: der letzte Stand bleibt, Hinweis mit Uhrzeit, es wird weiter gefragt', async () => {
    // Stand „Ansagen“, obwohl laut Uhr die Predigt dran wäre – nur so sieht man, dass der Stand stehen bleibt.
    const { lesen } = zeige([{ stelle: 5, seit: '2027-03-07T09:07:00Z' }, 'voruebergehend']);
    await fertig();
    await spulen(TAKT_MS);
    expect(screen.getByRole('status').textContent).toBe(
      'Keine Verbindung – Stand von 10:08 Uhr. Wird wieder versucht.',
    );
    expect(within(jetztBereich()).getByRole('heading').textContent).toBe('Ansagen');
    expect(within(jetztBereich()).getByText('Jetzt')).toBeTruthy();
    await spulen(TAKT_MS);
    expect(lesen).toHaveBeenCalledTimes(3);
  });

  it('nie gelesen und ChurchTools antwortet nicht: nach der Uhr, mit Hinweis', async () => {
    zeige(['voruebergehend']);
    await fertig();
    expect(screen.getByRole('status').textContent).toMatch(/antwortet gerade nicht/);
    expect(within(jetztBereich()).getByText('Jetzt · nach Plan')).toBeTruthy();
  });

  it.each([
    ['kein-recht', 'ChurchTools lässt dich die Live-Agenda dieses Termins nicht sehen.'],
    [
      'abgemeldet',
      'Du bist bei ChurchTools abgemeldet. Bitte neu anmelden und „Live“ wieder öffnen.',
    ],
    ['unlesbar', 'ChurchTools antwortet anders als erwartet – „Live“ geht gerade nicht.'],
  ] as const)(
    '%s: Meldung, und es wird nicht mehr gefragt – auch nicht beim Zurückkehren',
    async (grund, text) => {
      const { lesen } = zeige([grund]);
      await fertig();
      expect(screen.getByRole('status').textContent).toBe(text);
      await spulen(TAKT_MS * 4);
      sichtbarkeit('visible');
      await fertig();
      expect(lesen).toHaveBeenCalledTimes(1);
    },
  );

  it('nur solange sichtbar: verdeckt keine Abfragen, beim Zurückkehren sofort', async () => {
    const { lesen } = zeige([{ stelle: 3, seit: '2027-03-07T09:07:00Z' }]);
    await fertig();
    sichtbarkeit('hidden');
    await spulen(TAKT_MS * 4);
    expect(lesen).toHaveBeenCalledTimes(1);
    sichtbarkeit('visible');
    await fertig();
    expect(lesen).toHaveBeenCalledTimes(2);
    await spulen(TAKT_MS);
    expect(lesen).toHaveBeenCalledTimes(3);
  });

  it('nach dem Schließen keine Abfragen mehr', async () => {
    const { lesen, onSchliessen } = zeige([{ stelle: 3, seit: '2027-03-07T09:07:00Z' }]);
    await fertig();
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onSchliessen).toHaveBeenCalledTimes(1);
    cleanup();
    await spulen(TAKT_MS * 3);
    expect(lesen).toHaveBeenCalledTimes(1);
  });

  it('eine Antwort, die erst nach dem Schließen kommt, stößt keine weitere Abfrage an', async () => {
    let antworten: (() => void) | null = null;
    const lesen = vi.fn(
      () =>
        new Promise<{ ok: true; stand: LiveStand }>((ok) => {
          antworten = () => ok({ ok: true, stand: stand(3, '2027-03-07T09:07:00Z') });
        }),
    );
    render(
      <LiveAnsicht
        titel="Gottesdienst"
        tag="2027-03-07"
        beginn="10:00"
        terminId={T}
        agendaId={126}
        items={ITEMS}
        zeilen={ZEILEN}
        infoGruppen={[]}
        zeitzone="Europe/Berlin"
        onSchliessen={() => {}}
        lesen={lesen}
      />,
    );
    await fertig();
    cleanup();
    await act(async () => antworten?.());
    await spulen(TAKT_MS * 3);
    expect(lesen).toHaveBeenCalledTimes(1);
  });

  it('Esc schließt', async () => {
    const { onSchliessen } = zeige([{ stelle: 3, seit: '2027-03-07T09:07:00Z' }]);
    await fertig();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onSchliessen).toHaveBeenCalledTimes(1);
  });
});
