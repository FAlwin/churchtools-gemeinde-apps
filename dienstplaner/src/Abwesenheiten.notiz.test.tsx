// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Absence, AbsenceEvent } from '@shared/types/index';
import type { Dienstgruppe } from '@shared/ct/dienstgruppen';
import type { Antworten } from '@shared/dienstplan/verfuegbarkeit';
import type { AbwesenheitenDienst } from '@ui/abwesenheiten/ctDienst';
import { Abwesenheiten } from './Abwesenheiten';
import { standardInhalt } from '@shared/dienstplan/abfragenSpeicher';
import { ladeAbfragen } from './ladeAbfragen';
import { ladeMeineDienste } from './ladeBeiwerk';
import {
  ladeVerfuegbarkeit,
  speichereVerfuegbarkeit,
  type Verfuegbarkeit,
} from './ladeVerfuegbarkeit';

/**
 * **Notiz am Termin + „nur bestimmte Dienste“ (E5c-2)** – die Seite „Verfügbarkeit“ mit dem Notiz-Fenster. Aufbau wie
 * `Abwesenheiten.zusagen.test.tsx`: Abwesenheiten gegen eine Attrappe des ChurchTools-Dienstes, Ja/Vielleicht gegen eine
 * Attrappe des Speichers. Die Karte, die der Speicher bekommt, wird gegen das geprüft, was die Seite selbst erzeugt.
 */
const dienst = {
  meine: vi.fn<AbwesenheitenDienst['meine']>(),
  termine: vi.fn<AbwesenheitenDienst['termine']>(),
  gruende: vi.fn<AbwesenheitenDienst['gruende']>(),
  anlegen: vi.fn<AbwesenheitenDienst['anlegen']>(),
  aendern: vi.fn<AbwesenheitenDienst['aendern']>(),
  loeschen: vi.fn<AbwesenheitenDienst['loeschen']>(),
};
vi.mock('@ui/abwesenheiten/ctDienst', () => ({ abwesenheitenDienst: () => dienst }));
// Die Gruppe fragt nach Zusagen (Startwert) – dann gibt es in der Seite den Umschalter „Abwesenheiten | Zusagen“.
vi.mock('./ladeAbfragen', () => ({ ladeAbfragen: vi.fn(), speichereAbfragen: vi.fn() }));
vi.mock('./ladeBeiwerk', () => ({ ladeMeineDienste: vi.fn() }));
vi.mock('./ladeVerfuegbarkeit', async (orig) => ({
  ...(await orig<typeof import('./ladeVerfuegbarkeit')>()),
  ladeVerfuegbarkeit: vi.fn(),
  speichereVerfuegbarkeit: vi.fn(),
}));
const laden = vi.mocked(ladeVerfuegbarkeit);
const speichern = vi.mocked(speichereVerfuegbarkeit);

const HEUTE = '2026-11-04';
const ev = (id: number, name: string, tag: string): AbsenceEvent => ({
  id,
  name,
  date: tag,
  startDate: `${tag}T09:00:00Z`,
  endDate: `${tag}T10:30:00Z`,
});
const TERMINE = [
  ev(1, 'Gottesdienst', '2026-11-08'),
  ev(2, 'Gebetsabend', '2026-11-11'),
  ev(3, 'Gottesdienst', '2026-11-15'),
];
const TECHNIK: Dienstgruppe = { id: 3, name: 'Technik', fuerAlle: false };
const DIENSTE = [
  { id: 11, name: 'Gesang' },
  { id: 12, name: 'Gitarre' },
  { id: 13, name: 'Ton' },
];

const abw = (id: number, von: string, bis: string = von, comment = ''): Absence => ({
  id,
  startDate: von,
  endDate: bis,
  startTime: null,
  endTime: null,
  reason: 'Abwesend',
  reasonId: 1,
  comment,
  vonApp: false,
});

let stand: Verfuegbarkeit;
const bereit = (antworten: Antworten = {}): Verfuegbarkeit => ({
  modul: 16,
  gruppen: [{ gruppe: TECHNIK, kategorie: 30, stand: 'bereit' }],
  bereit: [30],
  antworten,
  vertretungen: {},
  lesefehler: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  stand = bereit();
  dienst.meine.mockResolvedValue([]);
  dienst.termine.mockResolvedValue(TERMINE);
  dienst.gruende.mockResolvedValue([{ id: 1, name: 'Abwesend', standard: true }]);
  dienst.anlegen.mockResolvedValue({} as Absence);
  dienst.aendern.mockResolvedValue({} as Absence);
  dienst.loeschen.mockResolvedValue(undefined);
  vi.mocked(ladeMeineDienste).mockResolvedValue(new Map());
  vi.mocked(ladeAbfragen).mockResolvedValue({
    inhalt: standardInhalt(),
    gespeichert: null,
    unlesbar: false,
    fehler: null,
  });
  laden.mockImplementation(() => Promise.resolve(stand));
  speichern.mockImplementation((_v, _p, antworten) => {
    stand = { ...stand, antworten };
    return Promise.resolve({ ok: true });
  });
});

const zeige = (eigeneDienste = DIENSTE) =>
  render(
    <Abwesenheiten
      ichId={19}
      zeitzone="Europe/Berlin"
      heute={HEUTE}
      dienstgruppen={[TECHNIK]}
      eigeneDienste={eigeneDienste}
    />,
  );
const knopf = (wahl: 'Ja' | 'Vielleicht' | 'Nein', name: string, tag: string) =>
  screen.getByRole<HTMLButtonElement>('button', { name: `${wahl} – ${name}, ${tag}` });
const GD1 = 'So, 08.11.';
const GA = 'Mi, 11.11.';
const bereitSein = async () => {
  await screen.findByText('Gebetsabend');
  // Die Seite geht mit „Abwesenheiten“ auf; Ja · Vielleicht · Nein stehen unter „Zusagen“.
  fireEvent.click(await screen.findByRole('button', { name: 'Zusagen' }));
  await waitFor(() => expect(laden).toHaveBeenCalled());
  await act(async () => {
    await Promise.resolve();
  });
};
const klick = async (el: HTMLElement) => {
  await act(async () => {
    fireEvent.click(el);
    await Promise.resolve();
  });
};
const speichereKlick = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await new Promise((r) => setTimeout(r, 0));
  });
};
const leiste = () =>
  screen.queryAllByRole('status').find((e) => /vorgemerkt/.test(e.textContent ?? ''));
const gedrueckt = (el: HTMLElement) => el.getAttribute('aria-pressed') === 'true';
/** Der Link „Notiz“ eines Termins (`null`, wenn es ihn nicht gibt). */
const notizLink = (name: string, tag: string) =>
  screen.queryByRole<HTMLButtonElement>('button', { name: new RegExp(`^Notiz – ${name}, ${tag}`) });
const oeffneNotiz = async (name: string, tag: string) => {
  await klick(notizLink(name, tag)!);
  return screen.getByRole('dialog', { name: 'Notiz' });
};
const tippe = (fenster: HTMLElement, text: string) =>
  fireEvent.change(within(fenster).getByLabelText('Kommentar'), { target: { value: text } });
const schalter = (fenster: HTMLElement, name: string) =>
  within(fenster).getByRole<HTMLInputElement>('checkbox', { name });
const uebernehmen = (fenster: HTMLElement) => klick(within(fenster).getByText('Übernehmen'));
/** Die Karte, die der Speicher beim (einzigen) Aufruf bekam. */
const karte = (): Antworten => speichern.mock.calls[0][2];

describe('Der Link „Notiz“ unter dem Termin', () => {
  it('ohne Antwort gibt es ihn nicht; mit Ja, Vielleicht oder Nein steht er da', async () => {
    zeige();
    await bereitSein();
    expect(notizLink('Gottesdienst', GD1)).toBeNull();
    await klick(knopf('Ja', 'Gottesdienst', GD1));
    expect(notizLink('Gottesdienst', GD1)!.textContent).toBe('+ Notiz');
    await klick(knopf('Vielleicht', 'Gottesdienst', GD1));
    expect(notizLink('Gottesdienst', GD1)).not.toBeNull();
    await klick(knopf('Nein', 'Gottesdienst', GD1));
    expect(notizLink('Gottesdienst', GD1)).not.toBeNull();
    // Keine Antwort mehr: Nein wieder weg.
    await klick(knopf('Nein', 'Gottesdienst', GD1));
    await klick(knopf('Vielleicht', 'Gottesdienst', GD1));
    expect(notizLink('Gottesdienst', GD1)).toBeNull();
  });

  it('mit Notiz steht nur ihr Text im Link (B4, ohne „Notiz:“)', async () => {
    stand = bereit({ '1': { a: 'ja', tag: '2026-11-08', notiz: 'nur bis 12 Uhr' } });
    zeige();
    await bereitSein();
    expect(notizLink('Gottesdienst', GD1)!.textContent).toBe('nur bis 12 Uhr');
  });

  it('gesperrt, wenn Ja/Vielleicht nicht gespeichert werden können (keine bereite Schublade)', async () => {
    stand = { ...bereit({ '1': { a: 'ja', tag: '2026-11-08' } }), bereit: [] };
    zeige();
    await bereitSein();
    expect(notizLink('Gottesdienst', GD1)!.disabled).toBe(true);
  });
});

describe('Ja/Vielleicht: Kommentar und „Nur bestimmte Dienste“', () => {
  it('das Fenster: Titel, Termin, Kommentar mit Hinweis, ein Schalter je Dienst – alle an', async () => {
    zeige();
    await bereitSein();
    await klick(knopf('Ja', 'Gottesdienst', GD1));
    const f = await oeffneNotiz('Gottesdienst', GD1);
    expect(within(f).getByText(/So, 08\.11\./)).not.toBeNull();
    expect(within(f).getByPlaceholderText('z. B. nur bis 12 Uhr')).not.toBeNull();
    expect(
      within(f).getByText(
        'Sehen die Planer deiner Dienstgruppe – und wer am Termin eine Vertretung sucht.',
      ),
    ).not.toBeNull();
    expect(within(f).getByText('Nur bestimmte Dienste')).not.toBeNull();
    for (const d of DIENSTE) expect(schalter(f, d.name).checked).toBe(true);
    expect(within(f).getByLabelText('Kommentar').getAttribute('maxlength')).toBe('140');
  });

  it('übernehmen merkt vor (Ring am Knopf, Leiste zählt) und speichert erst mit „Speichern“: Karte mit Notiz und Diensten', async () => {
    zeige();
    await bereitSein();
    await klick(knopf('Ja', 'Gottesdienst', GD1));
    const f = await oeffneNotiz('Gottesdienst', GD1);
    tippe(f, 'nur bis 12 Uhr');
    await klick(schalter(f, 'Ton'));
    await uebernehmen(f);
    expect(screen.queryByRole('dialog', { name: 'Notiz' })).toBeNull();
    expect(notizLink('Gottesdienst', GD1)!.textContent).toBe('nur bis 12 Uhr');
    expect(leiste()!.textContent).toContain('1 Änderung vorgemerkt');
    expect(knopf('Ja', 'Gottesdienst', GD1).className).toMatch(/antwortVorgemerkt/);
    expect(speichern).not.toHaveBeenCalled();
    await speichereKlick();
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(karte()).toEqual({
      '1': { a: 'ja', tag: '2026-11-08', notiz: 'nur bis 12 Uhr', dienste: [11, 12] },
    });
    // Danach neu geladen: der gespeicherte Stand steht ohne Vormerkung da.
    await waitFor(() => expect(leiste()).toBeUndefined());
    expect(notizLink('Gottesdienst', GD1)!.textContent).toBe('nur bis 12 Uhr');
  });

  it('alle Dienste an → die Karte hat kein `dienste` (gilt für alle)', async () => {
    zeige();
    await bereitSein();
    await klick(knopf('Ja', 'Gottesdienst', GD1));
    const f = await oeffneNotiz('Gottesdienst', GD1);
    tippe(f, 'gern');
    await uebernehmen(f);
    await speichereKlick();
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(karte()['1']).toEqual({ a: 'ja', tag: '2026-11-08', notiz: 'gern' });
    expect('dienste' in karte()['1']).toBe(false);
  });

  it('mindestens ein Dienst bleibt an: sonst Hinweis und „Übernehmen“ gesperrt', async () => {
    zeige();
    await bereitSein();
    await klick(knopf('Ja', 'Gottesdienst', GD1));
    const f = await oeffneNotiz('Gottesdienst', GD1);
    const ok = within(f).getByText<HTMLButtonElement>('Übernehmen');
    for (const d of DIENSTE) await klick(schalter(f, d.name));
    expect(within(f).getByText('Mindestens ein Dienst muss an bleiben.')).not.toBeNull();
    expect(ok.disabled).toBe(true);
    await klick(ok);
    // Das Fenster bleibt offen; vorgemerkt ist weiter nur das „Ja“.
    expect(screen.queryByRole('dialog', { name: 'Notiz' })).not.toBeNull();
    expect(notizLink('Gottesdienst', GD1)!.textContent).toBe('+ Notiz');
    await klick(schalter(f, 'Gitarre'));
    expect(ok.disabled).toBe(false);
    expect(within(f).queryByText('Mindestens ein Dienst muss an bleiben.')).toBeNull();
  });

  it('nur die Notiz einer gespeicherten Antwort geändert → wird gespeichert (gleiche Antwort, anderer Text)', async () => {
    stand = bereit({ '1': { a: 'ja', tag: '2026-11-08', notiz: 'alt' } });
    zeige();
    await bereitSein();
    const f = await oeffneNotiz('Gottesdienst', GD1);
    tippe(f, 'neu');
    await uebernehmen(f);
    expect(leiste()!.textContent).toContain('1 Änderung vorgemerkt');
    await speichereKlick();
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(karte()['1']).toEqual({ a: 'ja', tag: '2026-11-08', notiz: 'neu' });
  });

  it('nur die Dienste einer gespeicherten Antwort geändert → wird gespeichert', async () => {
    stand = bereit({ '1': { a: 'ja', tag: '2026-11-08', dienste: [11, 12] } });
    zeige();
    await bereitSein();
    const f = await oeffneNotiz('Gottesdienst', GD1);
    expect(schalter(f, 'Ton').checked).toBe(false);
    expect(schalter(f, 'Gesang').checked).toBe(true);
    await klick(schalter(f, 'Ton'));
    await uebernehmen(f);
    await speichereKlick();
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect('dienste' in karte()['1']).toBe(false);
  });

  it('Fenster öffnen und ohne Änderung übernehmen → nichts vorgemerkt', async () => {
    stand = bereit({ '1': { a: 'ja', tag: '2026-11-08', notiz: 'gleich', dienste: [12] } });
    zeige();
    await bereitSein();
    const f = await oeffneNotiz('Gottesdienst', GD1);
    await uebernehmen(f);
    expect(leiste()).toBeUndefined();
  });

  it('„Verwerfen“ nimmt die Notiz zurück', async () => {
    zeige();
    await bereitSein();
    await klick(knopf('Ja', 'Gottesdienst', GD1));
    const f = await oeffneNotiz('Gottesdienst', GD1);
    tippe(f, 'vorgemerkt');
    await uebernehmen(f);
    await klick(screen.getByRole('button', { name: 'Verwerfen' }));
    expect(leiste()).toBeUndefined();
    expect(knopf('Ja', 'Gottesdienst', GD1).getAttribute('aria-pressed')).toBe('false');
    await klick(knopf('Ja', 'Gottesdienst', GD1));
    expect(notizLink('Gottesdienst', GD1)!.textContent).toBe('+ Notiz');
  });

  it('Esc schließt das Fenster, ohne zu übernehmen', async () => {
    zeige();
    await bereitSein();
    await klick(knopf('Ja', 'Gottesdienst', GD1));
    const f = await oeffneNotiz('Gottesdienst', GD1);
    tippe(f, 'verloren');
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
      await Promise.resolve();
    });
    expect(screen.queryByRole('dialog', { name: 'Notiz' })).toBeNull();
    expect(notizLink('Gottesdienst', GD1)!.textContent).toBe('+ Notiz');
  });

  it('Abbrechen schließt ohne zu übernehmen', async () => {
    zeige();
    await bereitSein();
    await klick(knopf('Ja', 'Gottesdienst', GD1));
    const f = await oeffneNotiz('Gottesdienst', GD1);
    tippe(f, 'verloren');
    await klick(within(f).getByText('Abbrechen'));
    expect(screen.queryByRole('dialog', { name: 'Notiz' })).toBeNull();
    expect(notizLink('Gottesdienst', GD1)!.textContent).toBe('+ Notiz');
  });

  it('Ja → Vielleicht lässt Notiz und Dienste stehen; noch einmal auf den aktiven Knopf löscht beides', async () => {
    stand = bereit({ '1': { a: 'ja', tag: '2026-11-08', notiz: 'bleibt', dienste: [12] } });
    zeige();
    await bereitSein();
    await klick(knopf('Vielleicht', 'Gottesdienst', GD1));
    expect(notizLink('Gottesdienst', GD1)!.textContent).toBe('bleibt');
    await speichereKlick();
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(karte()['1']).toEqual({
      a: 'vielleicht',
      tag: '2026-11-08',
      notiz: 'bleibt',
      dienste: [12],
    });
    // Keine Antwort: weg samt Notiz.
    await waitFor(() => expect(leiste()).toBeUndefined());
    await klick(knopf('Vielleicht', 'Gottesdienst', GD1));
    expect(notizLink('Gottesdienst', GD1)).toBeNull();
    speichern.mockClear();
    await speichereKlick();
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(karte()).toEqual({});
  });

  it('ohne eigene Dienste: nur der Kommentar, kein Abschnitt „Nur bestimmte Dienste“', async () => {
    zeige([]);
    await bereitSein();
    await klick(knopf('Ja', 'Gottesdienst', GD1));
    const f = await oeffneNotiz('Gottesdienst', GD1);
    expect(within(f).queryByText('Nur bestimmte Dienste')).toBeNull();
    tippe(f, 'ok');
    await uebernehmen(f);
    await speichereKlick();
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(karte()['1']).toEqual({ a: 'ja', tag: '2026-11-08', notiz: 'ok' });
  });
});

describe('Nein: der Kommentar gehört der ChurchTools-Abwesenheit', () => {
  it('das Fenster hat nur den Kommentar (kein „Nur bestimmte Dienste“) und den Nein-Hinweis', async () => {
    zeige();
    await bereitSein();
    await klick(knopf('Nein', 'Gottesdienst', GD1));
    const f = await oeffneNotiz('Gottesdienst', GD1);
    expect(
      within(f).getByText('Steht als Kommentar der Abwesenheit in ChurchTools.'),
    ).not.toBeNull();
    expect(
      within(f).queryByText(
        'Sehen die Planer deiner Dienstgruppe – und wer am Termin eine Vertretung sucht.',
      ),
    ).toBeNull();
    expect(within(f).queryByText('Nur bestimmte Dienste')).toBeNull();
    expect(within(f).queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('neues Nein mit Kommentar → die Abwesenheit wird mit `comment` angelegt; der Antworten-Speicher bleibt unberührt', async () => {
    zeige();
    await bereitSein();
    await klick(knopf('Nein', 'Gottesdienst', GD1));
    const f = await oeffneNotiz('Gottesdienst', GD1);
    tippe(f, 'Familienfeier');
    await uebernehmen(f);
    expect(leiste()!.textContent).toContain('1 Änderung vorgemerkt');
    expect(notizLink('Gottesdienst', GD1)!.textContent).toBe('Familienfeier');
    await speichereKlick();
    await waitFor(() => expect(dienst.anlegen).toHaveBeenCalledTimes(1));
    expect(dienst.anlegen.mock.calls[0][0]).toMatchObject({
      startDate: '2026-11-08',
      comment: 'Familienfeier',
    });
    expect(speichern).not.toHaveBeenCalled();
  });

  it('Nein ohne Kommentar → kein `comment` im Aufruf', async () => {
    zeige();
    await bereitSein();
    await klick(knopf('Nein', 'Gottesdienst', GD1));
    await speichereKlick();
    await waitFor(() => expect(dienst.anlegen).toHaveBeenCalledTimes(1));
    expect('comment' in dienst.anlegen.mock.calls[0][0]).toBe(false);
  });

  it('Kommentar einer gespeicherten Abwesenheit ändern → über `aendern` (nicht anlegen/löschen), Leiste zählt', async () => {
    dienst.meine.mockResolvedValue([abw(77, '2026-11-08', '2026-11-08', 'alt')]);
    zeige();
    await bereitSein();
    expect(notizLink('Gottesdienst', GD1)!.textContent).toBe('alt');
    const f = await oeffneNotiz('Gottesdienst', GD1);
    expect(within(f).getByLabelText<HTMLTextAreaElement>('Kommentar').value).toBe('alt');
    tippe(f, 'neu');
    await uebernehmen(f);
    expect(leiste()!.textContent).toContain('1 Änderung vorgemerkt');
    expect(dienst.aendern).not.toHaveBeenCalled();
    await speichereKlick();
    await waitFor(() => expect(dienst.aendern).toHaveBeenCalledTimes(1));
    expect(dienst.aendern).toHaveBeenCalledWith(77, {
      startDate: '2026-11-08',
      endDate: '2026-11-08',
      comment: 'neu',
    });
    expect(dienst.anlegen).not.toHaveBeenCalled();
    expect(dienst.loeschen).not.toHaveBeenCalled();
  });

  it('unveränderten Kommentar übernehmen → nichts vorgemerkt', async () => {
    dienst.meine.mockResolvedValue([abw(77, '2026-11-08', '2026-11-08', 'gleich')]);
    zeige();
    await bereitSein();
    const f = await oeffneNotiz('Gottesdienst', GD1);
    await uebernehmen(f);
    expect(leiste()).toBeUndefined();
  });

  it('ein Zeitraum (mehrere Tage) gehört nicht dem Termin: kein Notiz-Link, der Kommentar bleibt unter „Einträge“', async () => {
    dienst.meine.mockResolvedValue([abw(78, '2026-11-08', '2026-11-10', 'Urlaub')]);
    zeige();
    await bereitSein();
    expect(gedrueckt(knopf('Nein', 'Gottesdienst', GD1))).toBe(true);
    expect(notizLink('Gottesdienst', GD1)).toBeNull();
  });
});

describe('Wechsel der Antwort', () => {
  it('Ja → Nein: der Kommentar wandert in die Abwesenheit, die Dienste fallen weg, die Antwort wird gelöscht', async () => {
    stand = bereit({
      '1': { a: 'ja', tag: '2026-11-08', notiz: 'nur bis 12 Uhr', dienste: [11] },
      '3': { a: 'ja', tag: '2026-11-15' },
    });
    zeige();
    await bereitSein();
    await klick(knopf('Nein', 'Gottesdienst', GD1));
    expect(notizLink('Gottesdienst', GD1)!.textContent).toBe('nur bis 12 Uhr');
    const f = await oeffneNotiz('Gottesdienst', GD1);
    expect(within(f).queryByText('Nur bestimmte Dienste')).toBeNull();
    await klick(within(f).getByText('Abbrechen'));
    expect(leiste()!.textContent).toContain('1 Änderung vorgemerkt');
    await speichereKlick();
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(dienst.anlegen.mock.calls[0][0]).toMatchObject({ comment: 'nur bis 12 Uhr' });
    expect(karte()).toEqual({ '3': { a: 'ja', tag: '2026-11-15' } });
  });

  it('Ja → Nein → Ja: nichts geht verloren (Notiz und Dienste wie vorher, keine Änderung vorgemerkt)', async () => {
    stand = bereit({ '1': { a: 'ja', tag: '2026-11-08', notiz: 'bis 12', dienste: [11, 13] } });
    zeige();
    await bereitSein();
    await klick(knopf('Nein', 'Gottesdienst', GD1));
    await klick(knopf('Ja', 'Gottesdienst', GD1));
    expect(leiste()).toBeUndefined();
    expect(notizLink('Gottesdienst', GD1)!.textContent).toBe('bis 12');
    const f = await oeffneNotiz('Gottesdienst', GD1);
    expect(schalter(f, 'Gitarre').checked).toBe(false);
  });

  it('Nein (gespeichert) → Ja: der Kommentar der Abwesenheit wird die Notiz, die Abwesenheit wird gelöscht', async () => {
    dienst.meine.mockResolvedValue([abw(77, '2026-11-08', '2026-11-08', 'Familienfeier')]);
    zeige();
    await bereitSein();
    await klick(knopf('Ja', 'Gottesdienst', GD1));
    expect(leiste()!.textContent).toContain('1 Änderung vorgemerkt');
    expect(notizLink('Gottesdienst', GD1)!.textContent).toBe('Familienfeier');
    await speichereKlick();
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(dienst.loeschen).toHaveBeenCalledWith(77);
    expect(karte()['1']).toEqual({ a: 'ja', tag: '2026-11-08', notiz: 'Familienfeier' });
  });

  it('Nein → keine Antwort: Notiz und Kommentar sind weg, nichts vorgemerkt', async () => {
    zeige();
    await bereitSein();
    await klick(knopf('Nein', 'Gottesdienst', GD1));
    const f = await oeffneNotiz('Gottesdienst', GD1);
    tippe(f, 'vergessen');
    await uebernehmen(f);
    await klick(knopf('Nein', 'Gottesdienst', GD1));
    expect(leiste()).toBeUndefined();
    expect(notizLink('Gottesdienst', GD1)).toBeNull();
    await klick(knopf('Nein', 'Gottesdienst', GD1));
    expect(notizLink('Gottesdienst', GD1)!.textContent).toBe('+ Notiz');
  });

  it('Verwerfen nimmt auch einen vorgemerkten Nein-Kommentar zurück', async () => {
    dienst.meine.mockResolvedValue([abw(77, '2026-11-08', '2026-11-08', 'alt')]);
    zeige();
    await bereitSein();
    const f = await oeffneNotiz('Gottesdienst', GD1);
    tippe(f, 'neu');
    await uebernehmen(f);
    await klick(screen.getByRole('button', { name: 'Verwerfen' }));
    expect(leiste()).toBeUndefined();
    expect(notizLink('Gottesdienst', GD1)!.textContent).toBe('alt');
  });
});

describe('Zwei Termine bleiben getrennt', () => {
  it('Notiz am einen Termin berührt den anderen nicht', async () => {
    zeige();
    await bereitSein();
    await klick(knopf('Ja', 'Gottesdienst', GD1));
    await klick(knopf('Ja', 'Gebetsabend', GA));
    const f = await oeffneNotiz('Gebetsabend', GA);
    tippe(f, 'nur Gebetsabend');
    await uebernehmen(f);
    await speichereKlick();
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(karte()).toEqual({
      '1': { a: 'ja', tag: '2026-11-08' },
      '2': { a: 'ja', tag: '2026-11-11', notiz: 'nur Gebetsabend' },
    });
  });
});
