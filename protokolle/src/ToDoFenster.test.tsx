// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { neueAufgabe, statusSetzen } from '@shared/protokolle/aufgaben';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import type { Person } from '@shared/organigramm/mitglieder';
import type { ToDoEintrag } from '@shared/protokolle/uebersicht';
import * as W from './todoSchreiben';
import { ToDoFenster, type Herkunft } from './ToDoFenster';

/** Fenster „To-Do“ (S7-2a) – der Schreibweg ist eine Attrappe; was er tut, prüft `todoSchreiben.test.ts`. */
vi.mock('./todoSchreiben', () => ({
  toDoAendern: vi.fn(),
  toDoAnlegen: vi.fn(),
  toDoLoeschen: vi.fn(),
  toDoVerschieben: vi.fn(),
}));
afterEach(cleanup);

const LT: ProtokollGruppe = {
  id: 11,
  name: 'Leitungsteam',
  lage: 'eingerichtet',
  protokolle: 60,
  mitarbeit: 61,
};
const JG: ProtokollGruppe = {
  id: 194,
  name: 'Jugend',
  lage: 'eingerichtet',
  protokolle: 62,
  mitarbeit: 65,
};
const p = (id: number, name: string): Person => ({
  id,
  name,
  bild: null,
  initialen: name.slice(0, 2),
});
const MITGLIEDER = new Map<number, Person[] | 'verborgen'>([
  [11, [p(1, 'Alwin Friesen'), p(23, 'Johann Becker')]],
  [194, [p(1, 'Alwin Friesen'), p(19, 'Spike Musiker')]],
]);
const AM = '2026-10-30T10:00:00Z';
const BEAMER = statusSetzen(
  neueAufgabe({
    id: 'b',
    gruppe: 11,
    sitzung: 's1',
    text: 'Beamer',
    wer: [1, 23],
    bis: '2026-11-01',
    von: 1,
    am: AM,
  }),
  'arbeit',
  23,
  AM,
);
const EINTRAG: ToDoEintrag = { aufgabe: BEAMER, gruppe: LT };
const FREI: Herkunft = { titel: 'Leitungssitzung', schluessel: 'p:s1', entwurf: false };

const zeige = (
  q: { eintrag?: ToDoEintrag | null; herkunft?: Herkunft | null; leitung?: boolean } = {},
) => {
  const props = {
    onFertig: vi.fn(),
    onSitzung: vi.fn(),
    onClose: vi.fn(),
  };
  render(
    <ToDoFenster
      ich={{ person: 1, name: 'Alwin' }}
      modul={24}
      gruppen={[LT, JG]}
      mitglieder={MITGLIEDER}
      eintrag={q.eintrag === undefined ? EINTRAG : q.eintrag}
      herkunft={q.herkunft === undefined ? FREI : q.herkunft}
      leitungIn={() => q.leitung ?? true}
      {...props}
    />,
  );
  return props;
};
const knopf = (name: RegExp | string) => screen.getByRole<HTMLButtonElement>('button', { name });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(W.toDoAendern).mockResolvedValue(BEAMER);
  vi.mocked(W.toDoAnlegen).mockResolvedValue(BEAMER);
  vi.mocked(W.toDoLoeschen).mockResolvedValue();
  vi.mocked(W.toDoVerschieben).mockResolvedValue({ hinweis: null });
});

describe('ToDoFenster', () => {
  it('zeigt das To-Do; Speichern erst nach einer Änderung – und dann nur das Geänderte', async () => {
    const { onFertig } = zeige();
    expect(screen.getByLabelText<HTMLTextAreaElement>('Was ist zu tun?').value).toBe('Beamer');
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: /Johann/ }).checked).toBe(true);
    expect(knopf('Speichern').disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Bis'), { target: { value: '2026-11-20' } });
    fireEvent.click(knopf('Speichern'));
    await waitFor(() => expect(onFertig).toHaveBeenCalledWith(null));
    expect(vi.mocked(W.toDoAendern).mock.calls[0]).toEqual([
      { modul: 24, kategorie: 61 },
      'b',
      { bis: '2026-11-20' },
      { person: 1, name: 'Alwin' },
    ]);
  });

  it('„Auf Karte anzeigen“ und Notiz gehen mit; der Status über den Umschalter', async () => {
    const { onFertig } = zeige();
    fireEvent.click(screen.getAllByRole('button', { name: /Auf Karte anzeigen/ })[0]);
    fireEvent.change(screen.getByLabelText('Neue Notiz'), { target: { value: 'Angebot da' } });
    fireEvent.click(knopf('Erledigt'));
    fireEvent.click(knopf('Speichern'));
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(vi.mocked(W.toDoAendern).mock.calls[0][2]).toEqual({
      status: 'erledigt',
      notiz: 'Angebot da',
      karte: { notiz: true, sitzung: false },
    });
  });

  it('aus einem Protokoll-Entwurf: Text, Gruppe und Löschen gesperrt, mit Hinweis', () => {
    zeige({ herkunft: { ...FREI, entwurf: true } });
    expect(screen.getByText(/Steht im Protokoll-Entwurf „Leitungssitzung“/)).toBeTruthy();
    expect(screen.getByLabelText<HTMLTextAreaElement>('Was ist zu tun?').disabled).toBe(true);
    expect(screen.getByLabelText<HTMLSelectElement>('Gruppe').disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Löschen' })).toBeNull();
  });

  it('ohne Sitzung kein Schalter „Auf Karte anzeigen“ dort; Sitzung nicht geladen: „Aus einer älteren Sitzung.“', () => {
    zeige({ eintrag: { aufgabe: { ...BEAMER, sitzung: null }, gruppe: LT }, herkunft: null });
    expect(screen.getByText('Ohne Sitzung angelegt.')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Auf Karte anzeigen/ })).toHaveLength(1);
    cleanup();
    zeige({ herkunft: null });
    expect(screen.getByText('Aus einer älteren Sitzung.')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Auf Karte anzeigen/ })).toHaveLength(2);
  });

  it('„im Protokoll zeigen“ springt in die Sitzung', () => {
    const { onSitzung } = zeige();
    fireEvent.click(knopf(/im Protokoll zeigen/));
    expect(onSitzung).toHaveBeenCalledWith(11, 'p:s1');
  });

  it('Löschen fragt erst nach, dann wird nur vermerkt', async () => {
    const { onFertig } = zeige();
    fireEvent.click(knopf('Löschen'));
    expect(W.toDoLoeschen).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Löschen' }).at(-1)!);
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(W.toDoLoeschen).toHaveBeenCalledWith({ modul: 24, kategorie: 61 }, 'b', {
      person: 1,
      name: 'Alwin',
    });
  });

  it('Gruppe wechseln: verschieben – Zuständige, die dort kein Mitglied sind, fallen weg', async () => {
    const { onFertig } = zeige();
    fireEvent.change(screen.getByLabelText('Gruppe'), { target: { value: '194' } });
    expect(screen.getByText(/zieht nach „Jugend“ um/)).toBeTruthy();
    fireEvent.click(knopf('Speichern'));
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(vi.mocked(W.toDoVerschieben).mock.calls[0][0]).toMatchObject({
      von: { ort: { modul: 24, kategorie: 61 }, name: 'Leitungsteam' },
      nach: { ort: { modul: 24, kategorie: 65 }, gruppe: 194, name: 'Jugend' },
      id: 'b',
      wer: [1],
    });
  });

  it('Neues To-Do: „Anlegen“ erst mit Text; ohne Zuständige geht; ein zweiter Versuch nimmt dieselbe ID', async () => {
    vi.mocked(W.toDoAnlegen).mockRejectedValueOnce(new Error('weg'));
    const { onFertig } = zeige({ eintrag: null, herkunft: null });
    expect(screen.getByRole('dialog', { name: 'Neues To-Do' })).toBeTruthy();
    expect(screen.queryByText('Aus welcher Sitzung')).toBeNull();
    expect(knopf('Anlegen').disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Was ist zu tun?'), { target: { value: 'Sommerfest' } });
    fireEvent.click(knopf('Anlegen'));
    await screen.findByRole('alert');
    fireEvent.click(knopf('Anlegen'));
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    const [a, b] = vi.mocked(W.toDoAnlegen).mock.calls;
    expect(a[1]).toMatchObject({ gruppe: 11, text: 'Sommerfest', wer: [], status: 'offen' });
    expect(b[1].neueId).toBe(a[1].neueId);
  });

  it('Mitglied ohne sich selbst: Hinweis, dass es das To-Do danach nicht mehr sieht (Frage 3)', () => {
    zeige({ leitung: false });
    expect(screen.queryByRole('note')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: /Alwin/ }));
    expect(screen.getByRole('note').textContent).toMatch(/siehst du dieses To-Do nicht mehr/);
  });

  const verborgen = (eintrag: ToDoEintrag) =>
    render(
      <ToDoFenster
        ich={{ person: 1, name: 'Alwin' }}
        modul={24}
        gruppen={[LT]}
        mitglieder={new Map([[11, 'verborgen']])}
        eintrag={eintrag}
        herkunft={null}
        leitungIn={() => false}
        onFertig={vi.fn()}
        onSitzung={vi.fn()}
        onClose={vi.fn()}
      />,
    );

  it('Mitgliederliste verborgen, Name im Verlauf gestempelt: „Johann“ statt „Person 23“ (S7-2a, Test-Instanz)', () => {
    const mitName = {
      ...BEAMER,
      verlauf: BEAMER.verlauf.map((v) => (v.von === 23 ? { ...v, name: 'Johann' } : v)),
    };
    verborgen({ aufgabe: mitName, gruppe: LT });
    expect(screen.getByText(/Außerdem zuständig: Johann – das bleibt so/)).toBeTruthy();
    expect(screen.getByText('Johann').closest('li')!.textContent).toMatch(/Status: in Arbeit/);
    expect(screen.queryByText(/Person 23/)).toBeNull();
  });

  it('Mitgliederliste verborgen: ich selbst bin wählbar, andere Zuständige bleiben und werden genannt', () => {
    render(
      <ToDoFenster
        ich={{ person: 1, name: 'Alwin' }}
        modul={24}
        gruppen={[LT]}
        mitglieder={new Map([[11, 'verborgen']])}
        eintrag={EINTRAG}
        herkunft={null}
        leitungIn={() => false}
        onFertig={vi.fn()}
        onSitzung={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('checkbox', { name: /Alwin/ })).toBeTruthy();
    expect(
      screen.getByText(/Außerdem zuständig: eine weitere Person – das bleibt so/),
    ).toBeTruthy();
    // Schrieb er nie mit Namen, steht im Verlauf „jemand“ – nie eine Personennummer.
    expect(screen.queryByText(/Person 23/)).toBeNull();
    expect(screen.getByText('jemand')).toBeTruthy();
  });
});
