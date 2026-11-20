// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { modusSetzen, neueAufgabe, statusSetzen, teilSetzen } from '@shared/protokolle/aufgaben';
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
  q: {
    eintrag?: ToDoEintrag | null;
    herkunft?: Herkunft | null;
    leitung?: boolean;
    /** Leitung je Gruppe (statt für alle gleich). */
    leitungIn?: (g: ProtokollGruppe) => boolean;
    vorlage?: { status?: 'offen' | 'arbeit'; wer?: number[] };
  } = {},
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
      leitungIn={q.leitungIn ?? (() => q.leitung ?? true)}
      vorlage={q.vorlage}
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

describe('ToDoFenster: „Jeder für sich“ (W8a)', () => {
  const modus = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });
  /** Das Kästchen in der Liste „Wer ist fertig?“ (nicht das bei „Zuständig“). */
  const fertigBox = (name: RegExp) =>
    within(screen.getByText('Wer ist fertig?').parentElement!).getByRole<HTMLInputElement>(
      'checkbox',
      {
        name,
      },
    );
  const JEDER = teilSetzen(modusSetzen(BEAMER, true, 1, AM), 23, true, 23, AM);
  const EINTRAG_JEDER: ToDoEintrag = { aufgabe: JEDER, gruppe: LT };

  it('der Umschalter erscheint ab zwei Zuständigen – mit einem Zuständigen nicht', () => {
    zeige();
    expect(modus('Gemeinsam')).toBeTruthy();
    expect(modus('Jeder für sich')).toBeTruthy();
    cleanup();
    zeige({ eintrag: { aufgabe: { ...BEAMER, wer: [1] }, gruppe: LT } });
    expect(screen.queryByRole('button', { name: 'Jeder für sich' })).toBeNull();
  });

  it('Jeder für sich: „Wer ist fertig?“ ersetzt den Status-Umschalter; Speichern schickt nur den Modus', async () => {
    const { onFertig } = zeige();
    expect(screen.getByRole('group', { name: 'Status' })).toBeTruthy();
    fireEvent.click(modus('Jeder für sich'));
    expect(screen.queryByRole('group', { name: 'Status' })).toBeNull();
    expect(screen.getByText('Wer ist fertig?')).toBeTruthy();
    expect(screen.getAllByText('offen')).toHaveLength(2);
    fireEvent.click(knopf('Speichern'));
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(vi.mocked(W.toDoAendern).mock.calls[0][2]).toEqual({ jeder: true });
  });

  it('ein im Fenster gewählter Status geht bei „Jeder für sich“ nicht mit (der Gesamtstand ist abgeleitet)', async () => {
    const { onFertig } = zeige();
    fireEvent.click(knopf('Erledigt')); // Status-Umschalter, solange „Gemeinsam“ gilt
    fireEvent.click(modus('Jeder für sich'));
    fireEvent.click(knopf('Speichern'));
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(vi.mocked(W.toDoAendern).mock.calls[0][2]).toEqual({ jeder: true });
  });

  it('wer schon fertig ist, steht mit Datum da; Leitung hakt für andere, ein Mitglied nur sich selbst', async () => {
    const { onFertig } = zeige({ eintrag: EINTRAG_JEDER, leitung: false });
    expect(screen.getByText(/✓ am/)).toBeTruthy();
    const johann = fertigBox(/Johann/);
    const ich = fertigBox(/Alwin/);
    expect(johann.disabled).toBe(true); // nicht meiner, ich bin keine Leitung
    expect(ich.disabled).toBe(false);
    fireEvent.click(ich);
    fireEvent.click(knopf('Speichern'));
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(vi.mocked(W.toDoAendern).mock.calls[0][2]).toEqual({
      teile: [{ person: 1, fertig: true }],
    });
    expect(vi.mocked(W.toDoAendern).mock.calls[0][4]).toBe(false);
  });

  it('als Leitung: auch der Teil eines anderen lässt sich zurücknehmen', async () => {
    const { onFertig } = zeige({ eintrag: EINTRAG_JEDER, leitung: true });
    const johann = fertigBox(/Johann/);
    expect(johann.disabled).toBe(false);
    expect(johann.checked).toBe(true);
    fireEvent.click(johann);
    fireEvent.click(knopf('Speichern'));
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(vi.mocked(W.toDoAendern).mock.calls[0][2]).toEqual({
      teile: [{ person: 23, fertig: false }],
    });
    expect(vi.mocked(W.toDoAendern).mock.calls[0][4]).toBe(true);
  });

  it('zurück zu „Gemeinsam“: der Status-Umschalter ist wieder da, der Modus geht mit', async () => {
    const { onFertig } = zeige({ eintrag: EINTRAG_JEDER });
    fireEvent.click(modus('Gemeinsam'));
    expect(screen.getByRole('group', { name: 'Status' })).toBeTruthy();
    fireEvent.click(knopf('Speichern'));
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(vi.mocked(W.toDoAendern).mock.calls[0][2]).toEqual({ jeder: false });
  });

  it('ein neues To-Do mit „Jeder für sich“: Modus und mein Teil gehen ans Anlegen', async () => {
    const { onFertig } = zeige({ eintrag: null });
    fireEvent.change(screen.getByLabelText('Was ist zu tun?'), { target: { value: 'Neu' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Alwin/ })); // zuständig: ich
    fireEvent.click(screen.getByRole('checkbox', { name: /Johann/ })); // und Johann
    fireEvent.click(modus('Jeder für sich'));
    fireEvent.click(fertigBox(/Alwin/)); // mein Teil
    fireEvent.click(knopf('Anlegen'));
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(vi.mocked(W.toDoAnlegen).mock.calls[0][1]).toMatchObject({
      jeder: true,
      teile: [{ person: 1, fertig: true }],
    });
  });
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
      true,
      false,
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
      karte: { notiz: true },
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

  describe('Schalter „Alle“ (W5)', () => {
    const haken = (name: RegExp | string) =>
      screen.getByRole<HTMLInputElement>('checkbox', { name });

    it('Alle an → alle Mitglieder gewählt und gespeichert; einen abwählen → Schalter aus; Alle aus → leer', async () => {
      const { onFertig } = zeige({ eintrag: { aufgabe: { ...BEAMER, wer: [] }, gruppe: LT } });
      const alle = haken('Alle (2)');
      expect(alle.checked).toBe(false);
      fireEvent.click(alle);
      expect(haken(/Alwin/).checked && haken(/Johann/).checked).toBe(true);
      expect(alle.checked).toBe(true);
      fireEvent.click(haken(/Johann/));
      expect(alle.checked).toBe(false);
      fireEvent.click(haken(/Johann/));
      expect(alle.checked).toBe(true);
      fireEvent.click(knopf('Speichern'));
      await waitFor(() => expect(onFertig).toHaveBeenCalledWith(null));
      expect(vi.mocked(W.toDoAendern).mock.calls[0][2]).toEqual({ wer: [1, 23] });
      cleanup();
      zeige();
      fireEvent.click(haken('Alle (2)'));
      expect(haken(/Alwin/).checked || haken(/Johann/).checked).toBe(false);
    });

    it('ein externer Name bleibt unberührt', () => {
      zeige({ eintrag: { aufgabe: { ...BEAMER, wer: [], extern: 'Hausmeister' }, gruppe: LT } });
      fireEvent.click(haken('Alle (2)'));
      expect(screen.getByLabelText<HTMLInputElement>('Außerhalb der Gruppe (nur Name)').value).toBe(
        'Hausmeister',
      );
    });
  });

  it('Verlauf: Zuständig-Wechsel mit Namen; Unbekanntes aus neueren Fassungen als „geändert“ (S7-3)', () => {
    const mitWechsel = {
      ...BEAMER,
      verlauf: [
        ...BEAMER.verlauf,
        { am: AM, von: 1, art: 'zustaendig' as const, vorher: [23], nachher: [] },
        { am: AM, von: 23, art: 'etwasNeues' as unknown as 'notiz' },
      ],
    };
    zeige({ eintrag: { aufgabe: mitWechsel, gruppe: LT } });
    expect(screen.getByText(/Zuständig: Johann → niemand/)).toBeTruthy();
    expect(screen.getByText('geändert')).toBeTruthy();
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
    expect(W.toDoLoeschen).toHaveBeenCalledWith(
      { modul: 24, kategorie: 61 },
      'b',
      { person: 1, name: 'Alwin' },
      true,
      false,
    );
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
    // Leitung im Leitungsteam, in der Jugend nur Mitglied: zieht das To-Do dorthin um und ist man nicht dabei, sagt es das Fenster.
    zeige({ leitungIn: (g) => g.id === 11 });
    expect(screen.queryByText(/siehst du dieses To-Do nicht mehr/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Gruppe'), { target: { value: '194' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Spike/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Alwin/ }));
    expect(screen.getByText(/siehst du dieses To-Do nicht mehr/)).toBeTruthy();
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
        leitungIn={() => true}
        onFertig={vi.fn()}
        onSitzung={vi.fn()}
        onClose={vi.fn()}
      />,
    );

  it('Leitung, Mitgliederliste verborgen, Name im Verlauf gestempelt: „Johann“ statt „Person 23“ (S7-2a, Test-Instanz)', () => {
    const mitName = {
      ...BEAMER,
      verlauf: BEAMER.verlauf.map((v) => (v.von === 23 ? { ...v, name: 'Johann' } : v)),
    };
    verborgen({ aufgabe: mitName, gruppe: LT });
    expect(screen.getByText(/Außerdem zuständig: Johann – das bleibt so/)).toBeTruthy();
    expect(screen.getByText('Johann').closest('li')!.textContent).toMatch(/Status: in Arbeit/);
    expect(screen.queryByText(/Person 23/)).toBeNull();
  });

  it('Leitung, Mitgliederliste verborgen: ich selbst bin wählbar, andere Zuständige bleiben und werden genannt', () => {
    render(
      <ToDoFenster
        ich={{ person: 1, name: 'Alwin' }}
        modul={24}
        gruppen={[LT]}
        mitglieder={new Map([[11, 'verborgen']])}
        eintrag={EINTRAG}
        herkunft={null}
        leitungIn={() => true}
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

describe('ToDoFenster: Reihenfolge und „Erledigt von“ (W8b, Entwurf v2)', () => {
  /** Die Beschriftungen der Felder, in der Reihenfolge, in der sie im Fenster stehen. */
  const reihenfolge = (namen: string[]) => {
    const dialog = screen.getByRole('dialog');
    const text = dialog.textContent ?? '';
    return namen
      .map((n) => ({ n, i: text.indexOf(n) }))
      .sort((a, b) => a.i - b.i)
      .map((x) => x.n);
  };

  it('Was · Bis · Zuständig · So wird es erledigt · Status · Notizen – das Wichtige vorn', () => {
    zeige();
    const soll = [
      'Was ist zu tun?',
      'Bis',
      'Zuständig',
      'So wird es erledigt',
      'Status',
      'Notizen',
    ];
    expect(reihenfolge([...soll].reverse())).toEqual(soll);
  });

  it('Jeder für sich: „Wer ist fertig?“ steht ebenfalls nach „Zuständig“', () => {
    zeige({ eintrag: { aufgabe: modusSetzen(BEAMER, true, 1, AM), gruppe: LT } });
    const soll = ['Zuständig', 'So wird es erledigt', 'Wer ist fertig?', 'Notizen'];
    expect(reihenfolge([...soll].reverse())).toEqual(soll);
  });

  it('gemeinsam und erledigt: unter dem Status „Erledigt von Johann am 30.10.“', () => {
    const erledigt = statusSetzen(BEAMER, 'erledigt', 23, AM);
    zeige({ eintrag: { aufgabe: erledigt, gruppe: LT } });
    expect(screen.getByText('Erledigt von Johann am 30.10.')).toBeTruthy();
  });

  it('nicht erledigt: kein „Erledigt von“; ändert man den Status weg von „Erledigt“, verschwindet es', () => {
    zeige();
    expect(screen.queryByText(/^Erledigt von/)).toBeNull();
    cleanup();
    zeige({ eintrag: { aufgabe: statusSetzen(BEAMER, 'erledigt', 23, AM), gruppe: LT } });
    fireEvent.click(knopf('Offen'));
    expect(screen.queryByText(/^Erledigt von/)).toBeNull();
  });
});

describe('ToDoFenster: Mitarbeiter-Sicht (W9a)', () => {
  const GETEILT: ToDoEintrag = { aufgabe: BEAMER, gruppe: LT }; // Alwin (ich) und Johann
  const EIGEN: ToDoEintrag = { aufgabe: { ...BEAMER, wer: [1] }, gruppe: LT };
  const OHNE: ToDoEintrag = { aufgabe: { ...BEAMER, wer: [] }, gruppe: LT };
  const mitarbeiter = { leitung: false } as const;
  const kein = (name: string) => expect(screen.queryByRole('button', { name })).toBeNull();

  it('geteilt: Text, Gruppe, Frist und Zuständige stehen als Text, nicht als Feld – abhaken und Notiz gehen', () => {
    zeige({ eintrag: GETEILT, ...mitarbeiter });
    expect(screen.queryByLabelText('Was ist zu tun?')).toBeNull();
    expect(screen.queryByLabelText('Bis')).toBeNull();
    expect(screen.queryByLabelText('Gruppe')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull(); // keine Zuständigen-Liste
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Beamer')).toBeTruthy();
    expect(within(dialog).getByText('Leitungsteam')).toBeTruthy();
    expect(within(dialog).getByText('Alwin (du), Johann')).toBeTruthy();
    expect(screen.getByLabelText('Neue Notiz')).toBeTruthy();
    expect(knopf('Erledigt')).toBeTruthy(); // Gemeinsam: der ganze Status, auch „in Arbeit“
    expect(knopf('In Arbeit')).toBeTruthy();
    kein('Löschen');
    expect(screen.queryByRole('button', { name: /Auf Karte anzeigen/ })).toBeNull();
    expect(screen.getByRole('note').textContent).toMatch(/ändert die Leitung/);
  });

  it('geteilt: Notiz und Status gehen als Änderung an den Schreibweg – mit „Mitarbeiter“', async () => {
    const { onFertig } = zeige({ eintrag: GETEILT, ...mitarbeiter });
    fireEvent.change(screen.getByLabelText('Neue Notiz'), { target: { value: 'Läuft' } });
    fireEvent.click(knopf('Erledigt'));
    fireEvent.click(knopf('Speichern'));
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(vi.mocked(W.toDoAendern).mock.calls[0].slice(2)).toEqual([
      { status: 'erledigt', notiz: 'Läuft' },
      { person: 1, name: 'Alwin' },
      false,
      false,
    ]);
  });

  it('eigen: alles Bearbeitbare ist da, dazu Löschen und „Abgeben an“; Gruppe und Zuständige stehen als Text', () => {
    zeige({ eintrag: EIGEN, ...mitarbeiter });
    expect(screen.getByLabelText('Was ist zu tun?')).toBeTruthy();
    expect(screen.getByLabelText('Bis')).toBeTruthy();
    expect(knopf('Löschen')).toBeTruthy();
    expect(screen.queryByLabelText('Gruppe')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByLabelText('Abgeben an')).toBeTruthy();
    expect(within(screen.getByRole('dialog')).getByText('Alwin (du)')).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull(); // kein Schloss-Satz: hier darf er fast alles
  });

  it('eigen: abgeben an genau ein anderes Mitglied – sagt, dass es danach weg ist, und schickt nur die Zuständigen', async () => {
    const { onFertig } = zeige({ eintrag: EIGEN, ...mitarbeiter });
    fireEvent.change(screen.getByLabelText('Abgeben an'), { target: { value: '23' } });
    expect(
      screen.getByText(/Nach dem Speichern ist Johann zuständig und du siehst es nicht mehr/),
    ).toBeTruthy();
    fireEvent.click(knopf('Speichern'));
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(vi.mocked(W.toDoAendern).mock.calls[0][2]).toEqual({ wer: [23] });
  });

  it('eigen im Protokoll-Entwurf: Text steht als Text, kein Löschen – Satz sagt warum; Frist bleibt änderbar', () => {
    zeige({
      eintrag: EIGEN,
      herkunft: { titel: 'Leitungssitzung', schluessel: 'p:s1', entwurf: true },
      ...mitarbeiter,
    });
    expect(screen.queryByLabelText('Was ist zu tun?')).toBeNull();
    kein('Löschen');
    expect(screen.getByLabelText('Bis')).toBeTruthy();
    expect(screen.getByRole('note').textContent).toMatch(
      /Protokoll-Entwurf „Leitungssitzung“.*Leitung/,
    );
  });

  it('ohne Zuständigen: „Das mache ich“ statt Speichern, keine Notiz, Status nur als Text', async () => {
    const { onFertig } = zeige({ eintrag: OHNE, ...mitarbeiter });
    kein('Speichern');
    expect(screen.queryByLabelText('Neue Notiz')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Erledigt' })).toBeNull();
    expect(screen.getByText('noch niemand')).toBeTruthy();
    expect(screen.getByRole('note').textContent).toMatch(/Das mache ich/);
    fireEvent.click(knopf('Das mache ich'));
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(vi.mocked(W.toDoAendern).mock.calls[0].slice(2)).toEqual([
      { wer: [1] },
      { person: 1, name: 'Alwin' },
      false,
      false,
    ]);
  });

  it('neues To-Do: nur für mich – Zuständig steht fest, ohne Liste; angelegt wird mit mir als Einzigem', async () => {
    const { onFertig } = zeige({ eintrag: null, ...mitarbeiter, vorlage: { wer: [] } });
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByLabelText('Außerhalb der Gruppe (nur Name)')).toBeNull();
    expect(within(screen.getByRole('dialog')).getByText('Alwin (du)')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Was ist zu tun?'), { target: { value: 'Plakat' } });
    fireEvent.click(knopf('Anlegen'));
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(vi.mocked(W.toDoAnlegen).mock.calls[0][1]).toMatchObject({ wer: [1], extern: '' });
    expect(vi.mocked(W.toDoAnlegen).mock.calls[0][3]).toBe(false);
  });

  it('Leitung: alles wie bisher – Felder, Löschen, Zuständigen-Liste, kein Schloss-Satz', () => {
    zeige({ eintrag: GETEILT, leitung: true });
    expect(screen.getByLabelText('Was ist zu tun?')).toBeTruthy();
    expect(knopf('Löschen')).toBeTruthy();
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
    expect(screen.queryByRole('note')).toBeNull();
  });
});
