// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { neueAufgabe, statusSetzen } from '@shared/protokolle/aufgaben';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import type { Person } from '@shared/organigramm/mitglieder';
import type { ToDoEintrag } from '@shared/protokolle/uebersicht';
import * as W from './todoSchreiben';
import * as N from './nachziehen';
import { ToDoFenster, type Herkunft } from './ToDoFenster';

/** Fenster „To-Do“ (S7-2a) – der Schreibweg ist eine Attrappe; was er tut, prüft `todoSchreiben.test.ts`. */
vi.mock('./todoSchreiben', () => ({
  toDoAendern: vi.fn(),
  toDoAnlegen: vi.fn(),
  toDoLoeschen: vi.fn(),
  toDoVerschieben: vi.fn(),
}));
vi.mock('./nachziehen', () => ({ imEntwurfNachziehen: vi.fn() }));
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
  vi.mocked(N.imEntwurfNachziehen).mockResolvedValue({ art: 'ok', hinweis: null });
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

  describe('aus einem Protokoll-Entwurf (S7-2b: dort nachziehen)', () => {
    const ENTWURF: Herkunft = { ...FREI, entwurf: true };
    const nachziehen = () => vi.mocked(N.imEntwurfNachziehen).mock.calls[0][0];

    it('Text: erst im Entwurf (Protokoll der Gruppe, Sitzung des To-Dos) – das To-Do selbst nicht noch einmal', async () => {
      const { onFertig } = zeige({ herkunft: ENTWURF });
      expect(screen.getByText(/Text, Gruppe und Löschen werden dort mit geändert/)).toBeTruthy();
      fireEvent.change(screen.getByLabelText('Was ist zu tun?'), {
        target: { value: 'Beamer leihen' },
      });
      fireEvent.click(knopf('Speichern'));
      await waitFor(() => expect(onFertig).toHaveBeenCalledWith(null));
      expect(nachziehen()).toMatchObject({
        ort: { modul: 24, kategorie: 60, sitzung: 's1' },
        mitarbeit: { modul: 24, kategorie: 61 },
        gruppe: 11,
        aufgabe: 'b',
        n: { art: 'text', text: 'Beamer leihen' },
        ich: { person: 1, name: 'Alwin' },
      });
      expect(nachziehen().ich.fenster).toEqual(expect.any(String));
      expect(W.toDoAendern).not.toHaveBeenCalled();
    });

    it('Text und Bis: danach nur der Rest ins To-Do (ohne Text)', async () => {
      const { onFertig } = zeige({ herkunft: ENTWURF });
      fireEvent.change(screen.getByLabelText('Was ist zu tun?'), {
        target: { value: 'Beamer leihen' },
      });
      fireEvent.change(screen.getByLabelText('Bis'), { target: { value: '2026-11-20' } });
      fireEvent.click(knopf('Speichern'));
      await waitFor(() => expect(onFertig).toHaveBeenCalled());
      expect(vi.mocked(W.toDoAendern).mock.calls[0][2]).toEqual({ bis: '2026-11-20' });
    });

    it('jemand schreibt gerade: nichts gespeichert, Meldung mit Namen, Fenster bleibt offen', async () => {
      vi.mocked(N.imEntwurfNachziehen).mockResolvedValue({
        art: 'gesperrt',
        sperre: { von: 7, name: 'Johann', seit: '2026-10-30T10:00:00Z', fenster: 'j1' },
      });
      const { onFertig } = zeige({ herkunft: ENTWURF });
      fireEvent.change(screen.getByLabelText('Was ist zu tun?'), {
        target: { value: 'Beamer leihen' },
      });
      fireEvent.change(screen.getByLabelText('Bis'), { target: { value: '2026-11-20' } });
      fireEvent.click(knopf('Speichern'));
      expect((await screen.findByRole('alert')).textContent).toMatch(
        /Johann schreibt gerade am Protokoll „Leitungssitzung“.*Gespeichert wurde nichts/,
      );
      expect(onFertig).not.toHaveBeenCalled();
      expect(W.toDoAendern).not.toHaveBeenCalled();
    });

    it('inzwischen kein Entwurf mehr: wie bisher nur das To-Do (mit Text)', async () => {
      vi.mocked(N.imEntwurfNachziehen).mockResolvedValue({ art: 'kein-entwurf' });
      const { onFertig } = zeige({ herkunft: ENTWURF });
      fireEvent.change(screen.getByLabelText('Was ist zu tun?'), {
        target: { value: 'Beamer leihen' },
      });
      fireEvent.click(knopf('Speichern'));
      await waitFor(() => expect(onFertig).toHaveBeenCalled());
      expect(vi.mocked(W.toDoAendern).mock.calls[0][2]).toEqual({ text: 'Beamer leihen' });
    });

    it('Löschen: Rückfrage nennt den Entwurf, dann „raus“; ist es keiner mehr, nur das To-Do', async () => {
      vi.mocked(N.imEntwurfNachziehen).mockResolvedValue({ art: 'kein-entwurf' });
      const { onFertig } = zeige({ herkunft: ENTWURF });
      fireEvent.click(knopf('Löschen'));
      expect(screen.getByText(/aus dem Protokoll-Entwurf „Leitungssitzung“/)).toBeTruthy();
      fireEvent.click(screen.getAllByRole('button', { name: 'Löschen' }).at(-1)!);
      await waitFor(() => expect(onFertig).toHaveBeenCalled());
      expect(nachziehen().n).toEqual({ art: 'raus' });
      expect(W.toDoLoeschen).toHaveBeenCalledTimes(1);
    });

    it('Gruppe: „abgegeben“ – das Anlegen in der neuen Gruppe läuft als `zuvor` (unter der Sperre)', async () => {
      const { onFertig } = zeige({ herkunft: ENTWURF });
      fireEvent.change(screen.getByLabelText('Gruppe'), { target: { value: '194' } });
      fireEvent.click(knopf('Speichern'));
      await waitFor(() => expect(onFertig).toHaveBeenCalled());
      expect(nachziehen().n).toEqual({ art: 'abgegeben', text: 'Beamer', gruppe: 'Jugend' });
      expect(W.toDoVerschieben).not.toHaveBeenCalled(); // die Attrappe ruft `zuvor` nicht auf …
      await nachziehen().zuvor!(); // … das tut der echte Weg unter der Sperre
      expect(W.toDoVerschieben).toHaveBeenCalledTimes(1);
    });

    it('nicht im Entwurf: das Protokoll wird nicht angefasst', async () => {
      const { onFertig } = zeige();
      fireEvent.change(screen.getByLabelText('Was ist zu tun?'), {
        target: { value: 'Beamer leihen' },
      });
      fireEvent.click(knopf('Speichern'));
      await waitFor(() => expect(onFertig).toHaveBeenCalled());
      expect(N.imEntwurfNachziehen).not.toHaveBeenCalled();
    });
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
