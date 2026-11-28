// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import {
  neueThemenreihe,
  neueZeile,
  type ReiheEvent,
  type Themenreihe,
} from '@shared/protokolle/themenreihe';
import { eventZumTerminLesen, ladeEventVorlagen } from './eventsLesen';
import { ladeSchreibKalender } from './kalenderListe';
import { ReiheFenster } from './ReiheFenster';
import { schonImKalender, terminLegen } from './terminEintragen';

vi.mock('./kalenderListe', () => ({ ladeSchreibKalender: vi.fn() }));
vi.mock('./terminEintragen', () => ({ schonImKalender: vi.fn(), terminLegen: vi.fn() }));
vi.mock('./eventsLesen', async (orig) => ({
  ...(await orig<typeof import('./eventsLesen')>()),
  ladeEventVorlagen: vi.fn(),
  eventZumTerminLesen: vi.fn(),
}));
// „Event wählen“ liest `GET /events` – hier ohne Events.
vi.mock('@ui/ct/verbindung', async (orig) => ({
  ...(await orig<typeof import('@ui/ct/verbindung')>()),
  ctDaten: vi.fn(() => Promise.resolve([])),
}));

/** Reihe, Scheibe 3: Events aus den Abenden in ChurchTools anlegen – Knöpfe, Fenster, Ablauf, Zusammenfassung. */
const reihe: Themenreihe = neueThemenreihe({
  id: 'r1',
  gruppe: 11,
  name: 'Jugendabend',
  von: 1,
  am: 'x',
  zeilen: [
    { ...neueZeile('a', '2027-01-13'), eventId: 10, eventTitel: 'Bestehendes Event' },
    neueZeile('b', '2027-01-27'),
    neueZeile('c', '2027-02-10'),
  ],
});
/** Dazu ein Abend ohne Datum – der zählt nicht (und ließe sich ohnehin nicht speichern). */
const mitLeerem: Themenreihe = neueThemenreihe({ ...reihe, zeilen: [...reihe.zeilen, neueZeile('d', '')] });
const KALENDER = [4];
const VORLAGEN = [
  { id: 0, name: 'Standard' },
  { id: 7, name: 'Jugend' },
];
const event = (id: number, tag: string): ReiheEvent => ({
  id,
  name: 'Jugendabend',
  startDate: `${tag}T18:30:00Z`,
  tag,
  kalenderId: 4,
});

/** `null`: die Prop fehlt ganz (kein Recht bekannt). */
const zeigen = (eventAnlegen: readonly number[] | null = KALENDER, r = reihe) =>
  render(
    <ReiheFenster
      reihe={r}
      neu={false}
      mitglieder={[]}
      ort={{ modul: 24, kategorie: 61 }}
      ich={{ person: 1 }}
      eventAnlegen={eventAnlegen ?? undefined}
      onGespeichert={vi.fn()}
      onClose={vi.fn()}
    />,
  );
const sammel = () => screen.queryByRole('button', { name: /^Events? für \d+ Abend/ });
const speichern = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Speichern' });
const dialog = async () => await screen.findByRole('dialog', { name: /Event/ });
const waehle = (f: HTMLElement, wert = '0') =>
  fireEvent.change(within(f).getByLabelText('Eventvorlage'), { target: { value: wert } });
const anlegenKnopf = (f: HTMLElement) =>
  within(f).getByRole<HTMLButtonElement>('button', { name: /anlegen$|^Anlegen$/ });
const einzeln = async (nr = 0) => {
  fireEvent.click(screen.getAllByRole('button', { name: 'Event wählen' })[nr]);
  fireEvent.click(await screen.findByRole('button', { name: /neu anlegen/ }));
  const f = await screen.findByRole('dialog', { name: 'Event anlegen' });
  await within(f).findByRole('option', { name: 'Standard' });
  return f;
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(ladeSchreibKalender).mockResolvedValue([{ id: 4, name: 'Jugend' }]);
  vi.mocked(ladeEventVorlagen).mockResolvedValue(VORLAGEN);
  vi.mocked(schonImKalender).mockResolvedValue(null);
  let nr = 700;
  vi.mocked(terminLegen).mockImplementation(async () => ({
    art: 'angelegt',
    id: nr++,
    events: { fehlend: [], unklar: false },
  }));
  vi.mocked(eventZumTerminLesen).mockImplementation(async (q) => event(q.termin + 100, q.tag));
});
afterEach(cleanup);

describe('Knöpfe: nur mit Recht, nur für Abende mit Datum und ohne Event', () => {
  it('ohne Recht (keine Kalender oder kein Wert) gibt es weder den Sammelknopf noch „+ Event am …“', async () => {
    for (const k of [[], null] as const) {
      const a = zeigen(k);
      expect(sammel()).toBeNull();
      fireEvent.click(screen.getAllByRole('button', { name: 'Event wählen' })[0]);
      await screen.findByText(/gibt es kein Event/);
      expect(screen.queryByRole('button', { name: /neu anlegen/ })).toBeNull();
      a.unmount();
    }
    expect(ladeSchreibKalender).not.toHaveBeenCalled();
  });

  it('mit Recht: N = Abende mit gültigem Datum und ohne Event (a hat ein Event, d kein Datum)', () => {
    zeigen(KALENDER, mitLeerem);
    expect(screen.getByRole('button', { name: 'Events für 2 Abende anlegen …' })).toBeTruthy();
  });

  it('ein Abend: „Event für 1 Abend anlegen …“; keiner: kein Knopf', () => {
    const eins = neueThemenreihe({ ...reihe, zeilen: [reihe.zeilen[0], reihe.zeilen[1]] });
    const a = zeigen(KALENDER, eins);
    expect(screen.getByRole('button', { name: 'Event für 1 Abend anlegen …' })).toBeTruthy();
    a.unmount();
    zeigen(KALENDER, neueThemenreihe({ ...reihe, zeilen: [reihe.zeilen[0], neueZeile('d', '')] }));
    expect(sammel()).toBeNull();
  });

  it('nichts wird geladen, bevor das Fenster „Event anlegen“ aufgeht', () => {
    zeigen();
    expect(ladeSchreibKalender).not.toHaveBeenCalled();
    expect(ladeEventVorlagen).not.toHaveBeenCalled();
  });

  it('in „Event wählen“ steht unten „+ Event am 27.01.2027 neu anlegen …“', async () => {
    zeigen();
    fireEvent.click(screen.getAllByRole('button', { name: 'Event wählen' })[0]);
    expect(await screen.findByRole('button', { name: '+ Event am 27.01.2027 neu anlegen …' })).toBeTruthy();
  });
});

describe('Einzeln anlegen', () => {
  it('das Fenster: Abend als Etikett, Kalender nur mit beiden Rechten, Titel = Name der Reihe, 19:30–21:30, Vorlage Pflicht', async () => {
    zeigen();
    const f = await einzeln();
    expect(ladeSchreibKalender).toHaveBeenCalledWith(KALENDER);
    expect(within(f).getByText('27.01.2027')).toBeTruthy();
    expect(within(f).getByLabelText<HTMLInputElement>('Titel').value).toBe('Jugendabend');
    expect(within(f).getByLabelText<HTMLInputElement>('Beginn').value).toBe('19:30');
    expect(within(f).getByLabelText<HTMLInputElement>('Ende').value).toBe('21:30');
    expect(within(f).getByText('Aus der Vorlage kommen Dienste und Ablauf. Es geht keine Einladung raus.')).toBeTruthy();
    expect(anlegenKnopf(f).disabled).toBe(true);
  });

  it('die Vorlage „Standard“ (Nummer 0) ist wählbar und gültig', async () => {
    zeigen();
    const f = await einzeln();
    waehle(f, '0');
    expect(anlegenKnopf(f).disabled).toBe(false);
    fireEvent.click(anlegenKnopf(f));
    await waitFor(() => expect(terminLegen).toHaveBeenCalled());
    expect(vi.mocked(terminLegen).mock.calls[0][0].eintrag.events).toEqual({ '2027-01-27': 0 });
  });

  it('ein leerer Titel ist ein Pflichtfeld', async () => {
    zeigen();
    const f = await einzeln();
    waehle(f, '7');
    fireEvent.change(within(f).getByLabelText('Titel'), { target: { value: '  ' } });
    expect(anlegenKnopf(f).disabled).toBe(true);
    fireEvent.change(within(f).getByLabelText('Titel'), { target: { value: 'Teenkreis' } });
    expect(anlegenKnopf(f).disabled).toBe(false);
  });

  it('Anlegen → Nachlesen → die Zeile trägt das Event, Speichern ist aktiv, die Zusammenfassung sagt „speichern“', async () => {
    zeigen();
    expect(speichern().disabled).toBe(true);
    const f = await einzeln();
    waehle(f, '7');
    fireEvent.click(anlegenKnopf(f));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Event anlegen' })).toBeNull());
    // Zeile b zeigt jetzt das nachgelesene Event, c bleibt bei „Event wählen“.
    expect(screen.getAllByRole('button', { name: 'Event wählen' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Jugendabend' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('1 Event angelegt. Jetzt die Reihe speichern.');
    expect(speichern().disabled).toBe(false);
    // Vorlage 7, Kalender 4, Titel der Reihe, ohne Einladung.
    const q = vi.mocked(terminLegen).mock.calls[0][0];
    expect(q.eintrag).toMatchObject({ kalender: 4, titel: 'Jugendabend', tag: '2027-01-27', events: { '2027-01-27': 7 } });
    expect(q.eingeladen).toBeUndefined();
  });

  it('201, aber das Event ist nicht zu finden: die Zeile bleibt ohne Event, Speichern bleibt aus, die Meldung sagt, was zu tun ist', async () => {
    vi.mocked(eventZumTerminLesen).mockResolvedValue(null);
    zeigen();
    const f = await einzeln();
    waehle(f);
    fireEvent.click(anlegenKnopf(f));
    const s = await screen.findByRole('status');
    expect(s.textContent).toContain('Es wurde kein Event angelegt.');
    expect(s.textContent).toContain(
      'Termin am 27.01.2027 angelegt, das Event ließ sich nicht finden – bitte in ChurchTools nachsehen und über „Event wählen“ zuordnen.',
    );
    expect(screen.getAllByRole('button', { name: 'Event wählen' })).toHaveLength(2);
    expect(speichern().disabled).toBe(true);
  });

  it('scheitert das Nachlesen (vorübergehend): nichts übernommen, Meldung, nur ein Anlegen', async () => {
    vi.mocked(eventZumTerminLesen).mockRejectedValue(new ApiError(503, 'weg'));
    zeigen();
    const f = await einzeln();
    waehle(f);
    fireEvent.click(anlegenKnopf(f));
    const s = await screen.findByRole('status');
    expect(s.textContent).toContain('das Event ließ sich nicht finden');
    expect(terminLegen).toHaveBeenCalledTimes(1);
    expect(speichern().disabled).toBe(true);
  });

  it('schonImKalender wirft: für diesen Tag wird NICHTS angelegt, der Fehler steht in der Meldung', async () => {
    vi.mocked(schonImKalender).mockRejectedValue(new ApiError(503, 'weg'));
    zeigen();
    const f = await einzeln();
    waehle(f);
    fireEvent.click(anlegenKnopf(f));
    const s = await screen.findByRole('status');
    expect(s.textContent).toContain('Am 27.01.2027 wurde nichts angelegt');
    expect(terminLegen).not.toHaveBeenCalled();
  });

  it('steht am Tag schon so ein Termin: nichts angelegt, Meldung mit Kalender und Titel', async () => {
    vi.mocked(schonImKalender).mockResolvedValue({ id: 9, titel: 'Jugendabend extra', beginn: 'x' });
    zeigen();
    const f = await einzeln();
    waehle(f);
    fireEvent.click(anlegenKnopf(f));
    const s = await screen.findByRole('status');
    expect(s.textContent).toContain(
      'Am 27.01.2027 steht im Kalender „Jugend“ schon „Jugendabend extra“. Dort wird nichts angelegt; ordne ihn über „Event wählen“ zu.',
    );
    expect(terminLegen).not.toHaveBeenCalled();
  });
});

describe('Für alle Abende auf einmal', () => {
  const sammeln = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Events für 2 Abende anlegen …' }));
    const f = await screen.findByRole('dialog', { name: 'Events für 2 Abende anlegen' });
    await within(f).findByRole('option', { name: 'Standard' });
    return f;
  };

  it('das Fenster nennt alle Daten und legt mit „2 Events anlegen“ an', async () => {
    zeigen();
    const f = await sammeln();
    expect(within(f).getByText('27.01.2027')).toBeTruthy();
    expect(within(f).getByText('10.02.2027')).toBeTruthy();
    waehle(f);
    fireEvent.click(within(f).getByRole('button', { name: '2 Events anlegen' }));
    const s = await screen.findByRole('status');
    expect(s.textContent).toBe('2 Events angelegt. Jetzt die Reihe speichern.');
    expect(screen.queryByRole('button', { name: /Event wählen/ })).toBeNull();
    expect(speichern().disabled).toBe(false);
    // Der Sammelknopf ist weg: es gibt keinen Abend ohne Event mehr.
    expect(sammel()).toBeNull();
  });

  it('NACHEINANDER: der zweite Abend wird erst geprüft und angelegt, wenn der erste durch ist', async () => {
    let frei: ((v: Awaited<ReturnType<typeof terminLegen>>) => void) | null = null;
    vi.mocked(terminLegen).mockImplementationOnce(
      () => new Promise((r) => (frei = r as typeof frei)),
    );
    zeigen();
    const f = await sammeln();
    waehle(f);
    fireEvent.click(within(f).getByRole('button', { name: '2 Events anlegen' }));
    await waitFor(() => expect(terminLegen).toHaveBeenCalledTimes(1));
    // Der erste Abend hängt – der zweite wurde noch nicht einmal geprüft.
    await new Promise((r) => setTimeout(r, 30));
    expect(schonImKalender).toHaveBeenCalledTimes(1);
    expect(terminLegen).toHaveBeenCalledTimes(1);
    expect(within(f).getByRole('button', { name: /Legt an … 1 von 2/ })).toBeTruthy();
    frei!({ art: 'angelegt', id: 700, events: { fehlend: [], unklar: false } });
    await waitFor(() => expect(terminLegen).toHaveBeenCalledTimes(2));
    expect(vi.mocked(terminLegen).mock.calls.map((c) => c[0].eintrag.tag)).toEqual([
      '2027-01-27',
      '2027-02-10',
    ]);
    await screen.findByRole('status');
  });

  it('ein Tag mit ähnlichem Termin: kein Anlegen für ihn, der andere Tag läuft, EINE Zusammenfassung', async () => {
    vi.mocked(schonImKalender).mockImplementation(async (e) =>
      e.tag === '2027-02-10' ? { id: 9, titel: 'Jugendabend', beginn: 'x' } : null,
    );
    zeigen();
    const f = await sammeln();
    waehle(f);
    fireEvent.click(within(f).getByRole('button', { name: '2 Events anlegen' }));
    const s = await screen.findByRole('status');
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(s.textContent).toContain('1 Event angelegt. Jetzt die Reihe speichern.');
    expect(s.textContent).toContain('Am 10.02.2027 steht im Kalender „Jugend“ schon „Jugendabend“.');
    expect(vi.mocked(terminLegen).mock.calls.map((c) => c[0].eintrag.tag)).toEqual(['2027-01-27']);
    // Der Abend ohne Treffer bleibt bei „Event wählen“.
    expect(screen.getAllByRole('button', { name: 'Event wählen' })).toHaveLength(1);
  });

  it('ein Fehler an einem Tag bricht den anderen nicht ab', async () => {
    vi.mocked(terminLegen).mockRejectedValueOnce(new ApiError(422, 'abgelehnt'));
    zeigen();
    const f = await sammeln();
    waehle(f);
    fireEvent.click(within(f).getByRole('button', { name: '2 Events anlegen' }));
    const s = await screen.findByRole('status');
    expect(s.textContent).toContain('1 Event angelegt.');
    expect(s.textContent).toContain('Am 27.01.2027 wurde nichts angelegt');
    expect(terminLegen).toHaveBeenCalledTimes(2);
  });
});
