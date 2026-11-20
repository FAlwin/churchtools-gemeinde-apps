// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { neueAufgabe, type Aufgabe } from '@shared/protokolle/aufgaben';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import { neuerToDoVorschlag, vorschlagAblehnen } from '@shared/protokolle/todoVorschlag';
import * as L from './lesen';
import * as M from './mitglieder';
import * as V from './todoVorschlagSchreiben';
import { ToDos } from './ToDos';

/**
 * **To-Do-Vorschläge im Reiter „To-Dos“** (W9b, Entwurf `todos-rechte-w9-v1`): der Bereich „Vorgeschlagen“, die Wahl „Für
 * mich | Vorschlag an die Gruppe“, das Fenster „Vorschlag übernehmen“, „Ablehnen“. Gelesen wird mit `ladeUebersicht`
 * (Attrappe): `aufgaben` sind die To-Dos, `todoVorschlaege` die Vorschläge – getrennt, wie sie der Leser liefert. Die
 * Schreibwege sind Attrappen; was sie tun, prüft `todoVorschlagSchreiben.test.ts`.
 */
vi.mock('./lesen', async (orig) => ({
  ...(await orig<typeof import('./lesen')>()),
  ladeUebersicht: vi.fn(),
}));
vi.mock('./mitglieder', () => ({ ladeGruppenMitglieder: vi.fn() }));
vi.mock('./useToDoEinstellungen', async (orig) =>
  (await import('./ohneAbgleich.testutil')).ohneAbgleich(orig),
);
vi.mock('./todoVorschlagSchreiben', () => ({
  vorschlagAnlegen: vi.fn(),
  todoVorschlagAendern: vi.fn(),
  todoVorschlagZurueckziehen: vi.fn(),
  todoVorschlagUebernehmen: vi.fn(),
  todoVorschlagAblehnen: vi.fn(),
}));

const LT: ProtokollGruppe = {
  id: 11,
  name: 'Leitungsteam',
  lage: 'eingerichtet',
  protokolle: 60,
  mitarbeit: 61,
};
const AM = '2026-11-18T10:00:00.000Z';
const ICH = { person: 1, name: 'Alwin Friesen' };
const PETER = { person: 19, name: 'Peter Wiens' };
const LEITUNG = { person: 7, name: 'Johann Becker' };

const todo = (text: string, wer: number[] = [1]): Aufgabe =>
  neueAufgabe({ id: text, gruppe: 11, sitzung: null, text, wer, von: 1, am: AM });
const vorschlag = (id: string, text: string, von = PETER, warum = ''): Aufgabe =>
  neuerToDoVorschlag({ id, gruppe: 11, text, bis: '2026-12-03', warum, von, am: AM });
const VOR_PETER = vorschlag('vp', 'Kabel neu ordnen', PETER, 'Wir suchen jedes Mal.');
const VOR_ICH = vorschlag('vi', 'Stativ anschaffen', ICH);
const ABGELEHNT = vorschlagAblehnen(
  vorschlag('va', 'Mischpult kaufen', ICH),
  'Haben wir schon.',
  LEITUNG,
  new Date(Date.now() - 3 * 86_400_000).toISOString(),
);

const uebersicht = (aufgaben: Aufgabe[], todoVorschlaege: Aufgabe[]): L.GruppenUebersicht[] => [
  {
    gruppe: LT,
    sitzungen: {
      kommend: [],
      protokolle: [],
      teile: [],
      kalender: 4,
      treffenNichtFreigegeben: false,
      punkte: 'vorschlagen',
    },
    aufgaben,
    todoVorschlaege,
  },
];
const zeige = (schreibbar: number[], onAufgaben = vi.fn()) =>
  render(
    <ToDos
      modul={24}
      ich={ICH}
      gruppen={[LT]}
      schreibbar={schreibbar}
      onSitzung={vi.fn()}
      onAufgaben={onAufgaben}
    />,
  );
const bereich = () => screen.queryByRole('region', { name: 'Vorgeschlagen' });
const liste = () => screen.getByRole('region', { name: 'To-Dos' });
const MITARBEITER: number[] = [];
const LEITUNG_SICHT = [60];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(L.ladeUebersicht).mockResolvedValue(
    uebersicht([todo('Raum prüfen')], [VOR_PETER, VOR_ICH, ABGELEHNT]),
  );
  vi.mocked(M.ladeGruppenMitglieder).mockResolvedValue([
    { id: 1, name: 'Alwin Friesen', bild: null, initialen: 'AF' },
    { id: 19, name: 'Peter Wiens', bild: null, initialen: 'PW' },
    { id: 23, name: 'Johann Becker', bild: null, initialen: 'JB' },
  ]);
  vi.mocked(V.todoVorschlagUebernehmen).mockResolvedValue(todo('x'));
  vi.mocked(V.todoVorschlagAblehnen).mockResolvedValue(todo('x'));
  vi.mocked(V.todoVorschlagZurueckziehen).mockResolvedValue(todo('x'));
  vi.mocked(V.todoVorschlagAendern).mockResolvedValue(todo('x'));
  vi.mocked(V.vorschlagAnlegen).mockResolvedValue(todo('x'));
});
afterEach(cleanup);

describe('Bereich „Vorgeschlagen“: die Leitung', () => {
  it('Kopf „Vorgeschlagen · 2 warten auf dich“; alle offenen der Gruppe und die Abgelehnten (7 Tage)', async () => {
    zeige(LEITUNG_SICHT);
    await screen.findByText('Raum prüfen');
    const b = bereich()!;
    expect(within(b).getByText('Vorgeschlagen')).toBeTruthy();
    expect(within(b).getByText('2 warten auf dich')).toBeTruthy();
    expect(within(b).getByText('Kabel neu ordnen')).toBeTruthy();
    expect(within(b).getByText('Stativ anschaffen')).toBeTruthy();
    expect(within(b).getByText(/Abgelehnt · verschwindet nach 7 Tagen/)).toBeTruthy();
    expect(within(b).getByText('Mischpult kaufen')).toBeTruthy();
  });

  it('ein Vorschlag ist KEIN To-Do: er steht nicht in der Liste und nicht in der Zahl der offenen', async () => {
    zeige(LEITUNG_SICHT);
    await screen.findByText('Raum prüfen');
    const l = liste();
    for (const t of ['Kabel neu ordnen', 'Stativ anschaffen', 'Mischpult kaufen'])
      expect(within(l).queryByText(t)).toBeNull();
    expect(within(l).getByText('Raum prüfen')).toBeTruthy();
    // „Offen · 1“: nur das echte To-Do zählt.
    expect(within(l).getByRole('group', { name: /offen/i }).textContent).toMatch(/^Offen1/);
  });

  it('der Zähler am Reiter (`onAufgaben`) bekommt nur To-Dos', async () => {
    const onAufgaben = vi.fn();
    zeige(LEITUNG_SICHT, onAufgaben);
    await screen.findByText('Raum prüfen');
    await waitFor(() => expect(onAufgaben).toHaveBeenCalled());
    const stand = onAufgaben.mock.calls.at(-1)![0] as { aufgaben: Aufgabe[] }[];
    expect(stand.flatMap((s) => s.aufgaben.map((a) => a.text))).toEqual(['Raum prüfen']);
  });

  it('auch im Board steht der Bereich, die Spalten zeigen keine Vorschläge', async () => {
    zeige(LEITUNG_SICHT);
    await screen.findByText('Raum prüfen');
    fireEvent.click(screen.getByRole('button', { name: 'Board' }));
    const board = await screen.findByRole('region', { name: 'To-Dos als Board' });
    expect(bereich()).toBeTruthy();
    expect(within(board).queryByText('Kabel neu ordnen')).toBeNull();
    expect(within(bereich()!).getByText('Kabel neu ordnen')).toBeTruthy();
  });

  it('Übernehmen …: das Fenster „Vorschlag übernehmen“, vorausgefüllt – Speichern übernimmt denselben Datensatz', async () => {
    zeige(LEITUNG_SICHT);
    fireEvent.click(await screen.findByRole('button', { name: /Kabel neu ordnen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen …' }));
    const d = await screen.findByRole('dialog', { name: 'Vorschlag übernehmen' });
    expect(within(d).getByText(/Vorschlag von Peter\. Wähle die Zuständigen/)).toBeTruthy();
    expect(within(d).getByLabelText<HTMLTextAreaElement>('Was ist zu tun?').value).toBe(
      'Kabel neu ordnen',
    );
    expect(within(d).getByLabelText<HTMLInputElement>('Bis').value).toBe('2026-12-03');
    // Die Notiz „Warum?“ steht bei den Notizen (und im Verlauf); Löschen gibt es hier nicht.
    expect(within(d).getByText('Wir suchen jedes Mal.')).toBeTruthy();
    expect(within(d).queryByRole('button', { name: 'Löschen' })).toBeNull();
    fireEvent.click(within(d).getByRole('checkbox', { name: /Johann Becker/ }));
    fireEvent.click(within(d).getByRole('button', { name: 'Übernehmen' }));
    await waitFor(() => expect(V.todoVorschlagUebernehmen).toHaveBeenCalledTimes(1));
    const [ort, id, x, ich, leitung] = vi.mocked(V.todoVorschlagUebernehmen).mock.calls[0];
    expect([ort, id, ich.person, leitung]).toEqual([{ modul: 24, kategorie: 61 }, 'vp', 1, true]);
    expect(x).toEqual({ wer: [23] });
    // Danach liest die Übersicht neu.
    await waitFor(() => expect(L.ladeUebersicht).toHaveBeenCalledTimes(2));
  });

  it('Ablehnen …: kleines Fenster mit Begründung – „sieht Peter 7 Tage lang“', async () => {
    zeige(LEITUNG_SICHT);
    fireEvent.click(await screen.findByRole('button', { name: /Kabel neu ordnen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ablehnen …' }));
    const d = await screen.findByRole('dialog', { name: 'Vorschlag ablehnen' });
    expect(within(d).getByText(/sieht Peter 7 Tage lang/)).toBeTruthy();
    fireEvent.change(within(d).getByRole('textbox'), { target: { value: 'Nicht jetzt.' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Ablehnen' }));
    await waitFor(() => expect(V.todoVorschlagAblehnen).toHaveBeenCalledTimes(1));
    const [, id, grund, , leitung] = vi.mocked(V.todoVorschlagAblehnen).mock.calls[0];
    expect([id, grund, leitung]).toEqual(['vp', 'Nicht jetzt.', true]);
  });

  it('der Wahlschalter „Wofür?“ fehlt bei „Neues To-Do“ – die Leitung legt wie bisher an', async () => {
    zeige(LEITUNG_SICHT);
    await screen.findByText('Raum prüfen');
    fireEvent.click(screen.getByRole('button', { name: /Neues To-Do/ }));
    const d = await screen.findByRole('dialog', { name: 'Neues To-Do' });
    expect(within(d).queryByText('Wofür?')).toBeNull();
  });
});

describe('Bereich „Vorgeschlagen“: ein Mitarbeiter', () => {
  it('sieht nur die eigenen: „wartet auf die Leitung“, die Abgelehnte mit Grund, den Satz – keinen Entscheidungsknopf', async () => {
    zeige(MITARBEITER);
    await screen.findByText('Raum prüfen');
    const b = bereich()!;
    expect(within(b).getByText('1 offen')).toBeTruthy();
    expect(within(b).getByText('Stativ anschaffen')).toBeTruthy();
    expect(within(b).getByText(/wartet auf die Leitung/)).toBeTruthy();
    // Der Vorschlag eines anderen Mitarbeiters ist nicht zu sehen.
    expect(within(b).queryByText('Kabel neu ordnen')).toBeNull();
    expect(screen.queryByText('Kabel neu ordnen')).toBeNull();
    expect(within(b).getByText('Grund: Haben wir schon.')).toBeTruthy();
    expect(within(b).getByText(/Übernimmt die Leitung deinen Vorschlag/)).toBeTruthy();
    expect(within(b).queryByRole('button', { name: /Übernehmen|Ablehnen …/ })).toBeNull();
  });

  it('ein Vorschlag ist kein To-Do: kein „Das mache ich“, kein Haken – weder für den eigenen noch sonst', async () => {
    zeige(MITARBEITER);
    await screen.findByText('Raum prüfen');
    expect(screen.queryByRole('button', { name: 'Das mache ich' })).toBeNull();
    expect(within(liste()).queryByText('Stativ anschaffen')).toBeNull();
    // Ohne Zuständigen (wer = []) – würde ein Vorschlag durchrutschen, stünde er jedem Mitarbeiter als „Das mache ich“ da.
  });

  it('Ändern (eigener, offener Vorschlag): Fenster „Vorschlag ändern“, vorausgefüllt – Speichern ändert', async () => {
    zeige(MITARBEITER);
    fireEvent.click(await screen.findByRole('button', { name: /Stativ anschaffen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ändern' }));
    const d = await screen.findByRole('dialog', { name: 'Vorschlag ändern' });
    const text = within(d).getByLabelText<HTMLTextAreaElement>('Was ist zu tun?');
    expect(text.value).toBe('Stativ anschaffen');
    // Ohne Änderung kein Speichern.
    expect(within(d).getByRole<HTMLButtonElement>('button', { name: 'Speichern' }).disabled).toBe(
      true,
    );
    fireEvent.change(text, { target: { value: 'Stativ und Tasche anschaffen' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(V.todoVorschlagAendern).toHaveBeenCalledTimes(1));
    const [ort, id, x] = vi.mocked(V.todoVorschlagAendern).mock.calls[0];
    expect([ort, id]).toEqual([{ modul: 24, kategorie: 61 }, 'vi']);
    expect(x).toMatchObject({ text: 'Stativ und Tasche anschaffen', bis: '2026-12-03' });
  });

  it('Zurückziehen: schreibt und liest neu', async () => {
    zeige(MITARBEITER);
    fireEvent.click(await screen.findByRole('button', { name: /Stativ anschaffen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Zurückziehen' }));
    await waitFor(() => expect(V.todoVorschlagZurueckziehen).toHaveBeenCalledTimes(1));
    expect(vi.mocked(V.todoVorschlagZurueckziehen).mock.calls[0][1]).toBe('vi');
    await waitFor(() => expect(L.ladeUebersicht).toHaveBeenCalledTimes(2));
  });

  it('der Abgelehnte lässt sich mit „×“ ausblenden', async () => {
    zeige(MITARBEITER);
    await screen.findByText('Raum prüfen');
    fireEvent.click(
      within(bereich()!).getByRole('button', { name: /„Mischpult kaufen“ ausblenden/ }),
    );
    expect(within(bereich()!).queryByText('Mischpult kaufen')).toBeNull();
  });

  it('nichts zu zeigen: der Bereich fehlt ganz', async () => {
    vi.mocked(L.ladeUebersicht).mockResolvedValue(uebersicht([todo('Raum prüfen')], [VOR_PETER]));
    zeige(MITARBEITER);
    await screen.findByText('Raum prüfen');
    expect(bereich()).toBeNull();
  });
});

describe('„Neues To-Do“ als Mitarbeiter: Für mich | Vorschlag an die Gruppe', () => {
  const oeffnen = async () => {
    zeige(MITARBEITER);
    await screen.findByText('Raum prüfen');
    fireEvent.click(screen.getByRole('button', { name: /Neues To-Do/ }));
    return screen.findByRole('dialog', { name: 'Neues To-Do' });
  };

  it('oben die Wahl; „Für mich“ ist vorgewählt und bleibt das gewohnte Fenster', async () => {
    const d = await oeffnen();
    expect(within(d).getByText('Wofür?')).toBeTruthy();
    expect(within(d).getByRole('button', { name: 'Für mich' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(within(d).getByRole('button', { name: 'Anlegen' })).toBeTruthy();
  });

  it('„Vorschlag an die Gruppe“: Überschrift, Hinweis, „Warum?“, Knopf „Vorschlagen“ – speichert einen Vorschlag', async () => {
    const d = await oeffnen();
    fireEvent.click(within(d).getByRole('button', { name: 'Vorschlag an die Gruppe' }));
    const v = await screen.findByRole('dialog', { name: 'To-Do vorschlagen' });
    expect(
      within(v).getByText('Wer es macht, legt die Leitung fest, wenn sie den Vorschlag übernimmt.'),
    ).toBeTruthy();
    expect(within(v).getByLabelText('Warum? (optional)')).toBeTruthy();
    expect(within(v).queryByText('Zuständig')).toBeNull();
    const knopf = within(v).getByRole<HTMLButtonElement>('button', { name: 'Vorschlagen' });
    expect(knopf.disabled).toBe(true); // erst mit Text
    fireEvent.change(within(v).getByLabelText('Was ist zu tun?'), {
      target: { value: 'Mikrofon-Ständer besorgen' },
    });
    fireEvent.change(within(v).getByLabelText('Warum? (optional)'), {
      target: { value: 'Zwei sind kaputt.' },
    });
    fireEvent.click(knopf);
    await waitFor(() => expect(V.vorschlagAnlegen).toHaveBeenCalledTimes(1));
    const [ort, q, ich, leitung] = vi.mocked(V.vorschlagAnlegen).mock.calls[0];
    expect(ort).toEqual({ modul: 24, kategorie: 61 });
    expect(q).toMatchObject({
      gruppe: 11,
      text: 'Mikrofon-Ständer besorgen',
      bis: null,
      warum: 'Zwei sind kaputt.',
    });
    expect([ich.person, leitung]).toEqual([1, false]);
  });
});
