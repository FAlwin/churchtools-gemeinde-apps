// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import { neueThemenreihe, neueZeile, type Themenreihe } from '@shared/protokolle/themenreihe';
import { Reihen } from './Reihen';
import * as Schreiben from './themenreiheSchreiben';
import { ladeGruppenMitglieder } from './mitglieder';

vi.mock('./themenreiheSchreiben', async (orig) => ({
  ...(await orig<typeof import('./themenreiheSchreiben')>()),
  ladeThemenreihen: vi.fn(),
  themenreiheSpeichern: vi.fn(),
}));
vi.mock('./mitglieder', () => ({ ladeGruppenMitglieder: vi.fn(() => Promise.resolve([])) }));
vi.mock('@ui/ct/terminInfosPort', () => ({ leseEvent: vi.fn(), speichereInfos: vi.fn() }));
afterEach(cleanup);

const gruppe = (
  id: number,
  name: string,
  mitarbeit: number | null = id + 1000,
): ProtokollGruppe => ({
  id,
  name,
  lage: 'eingerichtet',
  protokolle: id + 500,
  mitarbeit,
});
const JUGEND = gruppe(11, 'Jugend');
const TECHNIK = gruppe(19, 'Technik');
const OHNE = gruppe(23, 'Ohne Mitarbeit', null);

/** Weit in der Zukunft bzw. Vergangenheit: die Tests hängen nicht vom heutigen Datum ab. */
const reihe = (
  id: string,
  gruppeId: number,
  name: string,
  tage: string[],
  mitEvent = 0,
): Themenreihe =>
  neueThemenreihe({
    id,
    gruppe: gruppeId,
    name,
    von: 1,
    am: 'x',
    zeilen: tage.map((t, i) => ({
      ...neueZeile(`${id}-${i}`, t),
      thema: `${name} Thema ${i + 1}`,
      eventId: i < mitEvent ? 100 + i : null,
      eventTitel: i < mitEvent ? 'Jugendabend' : '',
    })),
  });

const JONA = reihe(
  'jona',
  11,
  'Jona',
  ['2099-01-13', '2099-01-20', '2099-01-27', '2099-02-03', '2099-02-10'],
  4,
);
const ALT = reihe('alt', 11, 'Alte Reihe', ['2001-03-01', '2001-03-08'], 2);
const LICHT = reihe('licht', 19, 'Licht und Ton', ['2099-06-01', '2099-06-08'], 0);

const gelesen = (stand: Record<number, Themenreihe[]>) =>
  vi
    .mocked(Schreiben.ladeThemenreihen)
    .mockImplementation(async (ort) => stand[ort.kategorie - 1000] ?? []);

/** Dieselbe Liste bei jedem Render (sonst lüde das Fenster „Event anlegen“ endlos). */
const KEINE_KALENDER: number[] = [];
const zeigen = (
  gruppen: ProtokollGruppe[],
  schreibbar: number[] = gruppen.map((g) => g.protokolle as number),
) =>
  render(
    <Reihen
      modul={24}
      ich={{ person: 1, name: 'Alwin' }}
      gruppen={gruppen}
      schreibbar={schreibbar}
      eventKalender={[4]}
      eventAnlegen={KEINE_KALENDER}
    />,
  );

/** Die Reihen in der Reihenfolge, in der sie in der Liste stehen. */
const namen = () =>
  screen
    .getAllByRole('listitem')
    .map((li) => within(li).getByText(/^(Jona|Alte Reihe|Licht und Ton)$/).textContent);

beforeEach(() => {
  vi.mocked(Schreiben.ladeThemenreihen).mockReset();
  vi.mocked(Schreiben.themenreiheSpeichern).mockReset();
  vi.mocked(ladeGruppenMitglieder).mockClear();
});

describe('Reiter „Reihen“: Liste', () => {
  it('gruppiert nach Gruppe, die nächste zuerst, vergangene danach – mit Zeitraum, Abenden und Etikett', async () => {
    gelesen({ 11: [ALT, JONA], 19: [LICHT] });
    zeigen([JUGEND, TECHNIK]);
    await screen.findByText('Jona');
    const jugend = screen.getByRole('group', { name: 'Jugend' });
    expect(within(jugend).getByText('Jugend')).toBeTruthy();
    expect(
      within(jugend)
        .getAllByRole('listitem')
        .map((li) => within(li).getByText(/^(Jona|Alte Reihe)$/).textContent),
    ).toEqual(['Jona', 'Alte Reihe']);
    expect(within(jugend).getByText('13. Jan – 10. Feb 2099 · 5 Abende')).toBeTruthy();
    expect(within(jugend).getByText('4 von 5 mit Event')).toBeTruthy();
    expect(within(jugend).getByText('2 von 2 mit Event')).toBeTruthy();
    const technik = screen.getByRole('group', { name: 'Technik' });
    expect(within(technik).getByText('0 von 2 mit Event')).toBeTruthy();
    // Die Reihenfolge der Gruppen ist die der Gruppen, nicht die der Reihen.
    expect(namen()).toEqual(['Jona', 'Alte Reihe', 'Licht und Ton']);
  });

  it('das Etikett ist nur grün, wenn jeder Abend ein Event hat', async () => {
    gelesen({ 11: [ALT, JONA] });
    zeigen([JUGEND]);
    const voll = (await screen.findByText('2 von 2 mit Event')).className;
    const teil = screen.getByText('4 von 5 mit Event').className;
    expect(voll).not.toBe(teil);
    expect(voll).toMatch(/gruen/);
    expect(teil).not.toMatch(/gruen/);
  });

  it('liest keine Events – nur die Reihen je Gruppe mit Mitarbeit, Gruppen ohne Mitarbeit werden übersprungen', async () => {
    gelesen({ 11: [JONA], 19: [LICHT] });
    zeigen([JUGEND, TECHNIK, OHNE]);
    await screen.findByText('Jona');
    expect(Schreiben.ladeThemenreihen).toHaveBeenCalledTimes(2);
    expect(vi.mocked(Schreiben.ladeThemenreihen).mock.calls.map((c) => c[0])).toEqual([
      { modul: 24, kategorie: 1011 },
      { modul: 24, kategorie: 1019 },
    ]);
  });

  it('liest höchstens zwei Gruppen gleichzeitig', async () => {
    let gleichzeitig = 0;
    let hoechstens = 0;
    vi.mocked(Schreiben.ladeThemenreihen).mockImplementation(async () => {
      gleichzeitig++;
      hoechstens = Math.max(hoechstens, gleichzeitig);
      await new Promise((r) => setTimeout(r, 5));
      gleichzeitig--;
      return [];
    });
    zeigen([gruppe(1, 'A'), gruppe(2, 'B'), gruppe(3, 'C'), gruppe(4, 'D'), gruppe(5, 'E')]);
    await screen.findByText(/Noch keine Reihen/);
    expect(Schreiben.ladeThemenreihen).toHaveBeenCalledTimes(5);
    expect(hoechstens).toBe(2);
  });

  it('Filter „Gruppe“ schränkt ein – und fehlt bei nur einer Gruppe', async () => {
    gelesen({ 11: [JONA], 19: [LICHT] });
    const a = zeigen([JUGEND, TECHNIK]);
    await screen.findByText('Jona');
    fireEvent.click(screen.getByRole('button', { name: /Filter/ }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Technik' }));
    await waitFor(() => expect(namen()).toEqual(['Licht und Ton']));
    fireEvent.click(screen.getByRole('radio', { name: 'Alle Gruppen' }));
    await waitFor(() => expect(namen()).toEqual(['Jona', 'Licht und Ton']));
    a.unmount();
    zeigen([JUGEND]);
    await screen.findByText('Jona');
    expect(screen.queryByRole('button', { name: /Filter/ })).toBeNull();
    // Bei einer Gruppe steht keine Zwischenüberschrift mit demselben Namen über der Liste.
    expect(screen.getByRole('group', { name: 'Jugend' }).textContent).not.toMatch(/^Jugend/);
  });

  it('leere Zustände: keine Gruppe, keine Reihen', async () => {
    zeigen([]);
    expect(await screen.findByText(/Du bist in keiner Gruppe/)).toBeTruthy();
    cleanup();
    gelesen({});
    zeigen([JUGEND]);
    expect(
      await screen.findByText(
        'Noch keine Reihen. Du legst sie hier mit „Neue Reihe“ an oder im Protokoll als Baustein „Reihe“.',
      ),
    ).toBeTruthy();
  });

  it('scheitert eine Gruppe, steht ein Fehlerkasten – kein Teilstand; „Erneut versuchen“ liest neu', async () => {
    vi.mocked(Schreiben.ladeThemenreihen).mockImplementation(async (ort) => {
      if (ort.kategorie === 1019) throw new Error('503');
      return [JONA];
    });
    zeigen([JUGEND, TECHNIK]);
    const nochmal = await screen.findByRole('button', { name: /Erneut versuchen/ });
    expect(screen.queryByText('Jona')).toBeNull();
    gelesen({ 11: [JONA], 19: [LICHT] });
    fireEvent.click(nochmal);
    expect(await screen.findByText('Licht und Ton')).toBeTruthy();
    expect(screen.getByText('Jona')).toBeTruthy();
  });
});

describe('Reiter „Reihen“: Karte', () => {
  it('ein Klick öffnet die Karte mit „Bearbeiten“ und „In Events übertragen“', async () => {
    gelesen({ 11: [JONA] });
    zeigen([JUGEND]);
    fireEvent.click(await screen.findByRole('button', { name: /Jona/ }));
    const fenster = await screen.findByRole('dialog');
    expect(within(fenster).getByText('Jona Thema 3')).toBeTruthy();
    expect(within(fenster).getByRole('button', { name: 'Bearbeiten' })).toBeTruthy();
    expect(within(fenster).getByRole('button', { name: 'In Events übertragen' })).toBeTruthy();
  });

  it('die Knöpfe richten sich nach dem Recht in der Gruppe DIESER Reihe', async () => {
    gelesen({ 11: [JONA], 19: [LICHT] });
    // Schreiben darf man nur in der Jugend.
    zeigen([JUGEND, TECHNIK], [JUGEND.protokolle as number]);
    fireEvent.click(await screen.findByRole('button', { name: /Licht und Ton/ }));
    const technik = await screen.findByRole('dialog');
    expect(within(technik).getByText('Licht und Ton Thema 1')).toBeTruthy();
    expect(within(technik).queryByRole('button', { name: 'Bearbeiten' })).toBeNull();
    expect(within(technik).queryByRole('button', { name: 'In Events übertragen' })).toBeNull();
    fireEvent.click(within(technik).getByRole('button', { name: 'Fenster schließen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /Jona/ }));
    const jugend = await screen.findByRole('dialog');
    expect(within(jugend).getByRole('button', { name: 'Bearbeiten' })).toBeTruthy();
  });

  it('„Bearbeiten“ liest die Reihe vorher frisch – das Fenster zeigt den Stand von jetzt, nicht den alten', async () => {
    gelesen({ 11: [JONA] });
    zeigen([JUGEND]);
    fireEvent.click(await screen.findByRole('button', { name: /Jona/ }));
    expect(Schreiben.ladeThemenreihen).toHaveBeenCalledTimes(1);
    // Inzwischen hat jemand anderes den Namen geändert.
    gelesen({ 11: [{ ...JONA, name: 'Jona neu' }] });
    fireEvent.click(await screen.findByRole('button', { name: 'Bearbeiten' }));
    expect(await screen.findByDisplayValue('Jona neu')).toBeTruthy();
    expect(Schreiben.ladeThemenreihen).toHaveBeenCalledTimes(2);
  });

  it('scheitert das frische Lesen, geht das Fenster mit dem bekannten Stand auf', async () => {
    gelesen({ 11: [JONA] });
    zeigen([JUGEND]);
    fireEvent.click(await screen.findByRole('button', { name: /Jona/ }));
    vi.mocked(Schreiben.ladeThemenreihen).mockRejectedValue(new Error('504'));
    fireEvent.click(await screen.findByRole('button', { name: 'Bearbeiten' }));
    expect(await screen.findByDisplayValue('Jona')).toBeTruthy();
  });

  it('nach dem Speichern gilt der neue Stand sofort in Liste und Karte', async () => {
    gelesen({ 11: [JONA] });
    vi.mocked(Schreiben.themenreiheSpeichern).mockImplementation(async (_o, r) => r);
    zeigen([JUGEND]);
    fireEvent.click(await screen.findByRole('button', { name: /Jona/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Bearbeiten' }));
    const name = await screen.findByDisplayValue('Jona');
    fireEvent.change(name, { target: { value: 'Jona und mehr' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(screen.queryByDisplayValue('Jona und mehr')).toBeNull());
    expect(within(screen.getByRole('dialog')).getByText('Jona und mehr')).toBeTruthy();
    expect(vi.mocked(Schreiben.themenreiheSpeichern).mock.calls[0][0]).toEqual({
      modul: 24,
      kategorie: 1011,
    });
  });
});

describe('Reiter „Reihen“: Neue Reihe', () => {
  const neuKnopf = () => screen.queryByRole('button', { name: 'Neue Reihe' });
  const fensterNeu = async () => within(await screen.findByRole('dialog', { name: 'Neue Reihe' }));
  const gruppeFeld = (f: ReturnType<typeof within>) =>
    f.queryByRole('combobox', { name: 'Gruppe' }) as HTMLSelectElement | null;

  it('den Knopf gibt es nur, wenn man in einer Gruppe mit Mitarbeit schreiben darf', async () => {
    gelesen({ 11: [JONA] });
    const a = zeigen([JUGEND]);
    await screen.findByText('Jona');
    expect(neuKnopf()).toBeTruthy();
    a.unmount();
    // Kein Schreibrecht.
    const b = zeigen([JUGEND], []);
    await screen.findByText('Jona');
    expect(neuKnopf()).toBeNull();
    b.unmount();
    // Schreibrecht, aber keine Mitarbeit-Kategorie.
    zeigen([OHNE]);
    await screen.findByText(/Noch keine Reihen/);
    expect(neuKnopf()).toBeNull();
  });

  it('bei genau einer Gruppe, in der man schreiben darf, gibt es kein Feld „Gruppe“', async () => {
    gelesen({});
    // In der Technik darf man nicht schreiben – wählbar ist nur die Jugend.
    zeigen([JUGEND, TECHNIK], [JUGEND.protokolle as number]);
    await screen.findByText(/Noch keine Reihen/);
    fireEvent.click(neuKnopf()!);
    const f = await fensterNeu();
    expect(gruppeFeld(f)).toBeNull();
  });

  it('bei mehreren Gruppen: das Feld „Gruppe“ ist mit der ersten vorbelegt – und mit der Gruppe aus dem Filter', async () => {
    gelesen({});
    zeigen([JUGEND, TECHNIK]);
    await screen.findByText(/Noch keine Reihen/);
    fireEvent.click(neuKnopf()!);
    expect(gruppeFeld(await fensterNeu())!.value).toBe('11');
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /Filter/ }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Technik' }));
    fireEvent.click(neuKnopf()!);
    expect(gruppeFeld(await fensterNeu())!.value).toBe('19');
  });

  it('nur Gruppen mit Schreibrecht stehen zur Wahl', async () => {
    gelesen({});
    zeigen(
      [JUGEND, TECHNIK, OHNE],
      [JUGEND.protokolle as number, TECHNIK.protokolle as number, OHNE.protokolle as number],
    );
    await screen.findByText(/Noch keine Reihen/);
    fireEvent.click(neuKnopf()!);
    const f = await fensterNeu();
    expect(
      within(gruppeFeld(f)!)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Jugend', 'Technik']);
  });

  it('ein Gruppenwechsel behält die Eingaben, lädt die Mitglieder der Gruppe neu und speichert in die gewählte Gruppe', async () => {
    gelesen({});
    vi.mocked(Schreiben.themenreiheSpeichern).mockImplementation(async (_o, r) => r);
    zeigen([JUGEND, TECHNIK]);
    await screen.findByText(/Noch keine Reihen/);
    fireEvent.click(neuKnopf()!);
    const f = await fensterNeu();
    fireEvent.change(f.getByLabelText('Name der Reihe'), { target: { value: 'Mischpult' } });
    expect(ladeGruppenMitglieder).toHaveBeenLastCalledWith(11);
    fireEvent.change(gruppeFeld(f)!, { target: { value: '19' } });
    // Dieselbe Eingabe, dieselbe Seite – nur die Mitglieder folgen der Gruppe.
    await waitFor(() => expect(ladeGruppenMitglieder).toHaveBeenLastCalledWith(19));
    expect(f.getByDisplayValue('Mischpult')).toBe(f.getByLabelText('Name der Reihe'));
    fireEvent.click(f.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(Schreiben.themenreiheSpeichern).toHaveBeenCalledTimes(1));
    const [ort, gespeichert] = vi.mocked(Schreiben.themenreiheSpeichern).mock.calls[0];
    expect(ort).toEqual({ modul: 24, kategorie: 1019 });
    expect(gespeichert.gruppe).toBe(19);
    expect(gespeichert.name).toBe('Mischpult');
    // Die neue Reihe steht sofort unter der gewählten Gruppe.
    const technik = await screen.findByRole('group', { name: 'Technik' });
    expect(within(technik).getByText('Mischpult')).toBeTruthy();
  });

  it('ohne Wechsel geht die Reihe in die vorbelegte Gruppe', async () => {
    gelesen({});
    vi.mocked(Schreiben.themenreiheSpeichern).mockImplementation(async (_o, r) => r);
    zeigen([JUGEND, TECHNIK]);
    await screen.findByText(/Noch keine Reihen/);
    fireEvent.click(neuKnopf()!);
    const f = await fensterNeu();
    fireEvent.change(f.getByLabelText('Name der Reihe'), { target: { value: 'Neu' } });
    fireEvent.click(f.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(Schreiben.themenreiheSpeichern).toHaveBeenCalledTimes(1));
    const [ort, gespeichert] = vi.mocked(Schreiben.themenreiheSpeichern).mock.calls[0];
    expect(ort).toEqual({ modul: 24, kategorie: 1011 });
    expect(gespeichert.gruppe).toBe(11);
  });

  it('das Feld „Gruppe“ ist gesperrt, sobald ein Speichern versucht wurde – auch nach einem Fehler', async () => {
    gelesen({});
    vi.mocked(Schreiben.themenreiheSpeichern).mockRejectedValueOnce(new Error('504'));
    vi.mocked(Schreiben.themenreiheSpeichern).mockImplementation(async (_o, r) => r);
    zeigen([JUGEND, TECHNIK]);
    await screen.findByText(/Noch keine Reihen/);
    fireEvent.click(neuKnopf()!);
    const f = await fensterNeu();
    fireEvent.change(f.getByLabelText('Name der Reihe'), { target: { value: 'Mischpult' } });
    expect(gruppeFeld(f)!.disabled).toBe(false);
    fireEvent.click(f.getByRole('button', { name: 'Speichern' }));
    await f.findByRole('alert');
    expect(gruppeFeld(f)!.disabled).toBe(true);
    // Der zweite Versuch schreibt mit derselben ID in dieselbe Gruppe – ein Doppel in einer anderen ist unmöglich.
    fireEvent.click(f.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(Schreiben.themenreiheSpeichern).toHaveBeenCalledTimes(2));
    const [erst, zweit] = vi.mocked(Schreiben.themenreiheSpeichern).mock.calls;
    expect(zweit[0]).toEqual(erst[0]);
    expect(zweit[1].id).toBe(erst[1].id);
    expect(zweit[1].gruppe).toBe(erst[1].gruppe);
  });

  it('ein neues Fenster erbt weder Gruppe noch Sperre vom vorigen', async () => {
    gelesen({});
    vi.mocked(Schreiben.themenreiheSpeichern).mockRejectedValue(new Error('504'));
    zeigen([JUGEND, TECHNIK]);
    await screen.findByText(/Noch keine Reihen/);
    fireEvent.click(neuKnopf()!);
    const f = await fensterNeu();
    fireEvent.change(gruppeFeld(f)!, { target: { value: '19' } });
    fireEvent.change(f.getByLabelText('Name der Reihe'), { target: { value: 'x' } });
    fireEvent.click(f.getByRole('button', { name: 'Speichern' }));
    await f.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(neuKnopf()!);
    const g = await fensterNeu();
    expect(gruppeFeld(g)!.value).toBe('11');
    expect(gruppeFeld(g)!.disabled).toBe(false);
  });
});
