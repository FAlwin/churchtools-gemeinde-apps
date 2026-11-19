// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  aufgabenAbgleich,
  modusSetzen,
  neueAufgabe,
  statusSetzen,
  vorabLesen,
  type Aufgabe,
} from '@shared/protokolle/aufgaben';
import { ableiten, type Block } from '@shared/protokolle/dokument';
import { AufgabenKontext, type AufgabenKontextWert } from './aufgabenKontext';
import { AufgabeBlock } from './EditorBloecke';

/**
 * Wer und Bis vor dem Text (K1, beim Durchklicken 28.10.2026). Ohne To-Do merkt sich der Block die Wahl (`vorab`), das
 * Anlegen übernimmt sie; mit To-Do geht alles ins To-Do. Der Block wird mit einem Attrappen-Editor gezeichnet, die
 * Übernahme beim Speichern läuft durch die echte Ableitung und den echten Abgleich.
 */

afterEach(cleanup);

const MITGLIEDER = [
  { id: 7, name: 'Johann Becker', bild: null, initialen: 'JB' },
  { id: 19, name: 'Spike Musiker', bild: null, initialen: 'SM' },
];

function zeige(q: {
  text: string;
  vorab?: string;
  todo?: Aufgabe;
  mitglieder?: AufgabenKontextWert['mitglieder'];
}) {
  const props = { aufgabe: 't1', vorab: q.vorab ?? '' };
  const editor = {
    isEditable: true,
    updateBlock: vi.fn((_id: string, u: { props: { vorab: string } }) => {
      props.vorab = u.props.vorab;
    }),
  };
  const k: AufgabenKontextWert = {
    todos: new Map(q.todo ? [[q.todo.id, q.todo]] : []),
    mitglieder: q.mitglieder ?? MITGLIEDER,
    bearbeitbar: true,
    statusAenderbar: true,
    ich: { person: 1, name: 'Alwin' },
    aendern: vi.fn(),
  };
  render(
    <AufgabenKontext.Provider value={k}>
      <AufgabeBlock
        block={{
          id: 'b1',
          props,
          content: q.text ? [{ type: 'text', text: q.text, styles: {} }] : [],
        }}
        editor={editor}
        contentRef={() => undefined}
      />
    </AufgabenKontext.Provider>,
  );
  return { editor, k, props };
}

const todo = (teil: Partial<Aufgabe> = {}): Aufgabe => ({
  ...neueAufgabe({ id: 't1', gruppe: 194, sitzung: 's1', text: 'Beamer', von: 1, am: 'x' }),
  ...teil,
});

const VIELE = Array.from({ length: 17 }, (_, i) => ({
  id: 100 + i,
  name: `Person${i + 1} Nach`,
  bild: null,
  initialen: 'PN',
}));

describe('Haken und „Jeder hakt für sich ab“ (W8a)', () => {
  const haken = (name: RegExp) => screen.getByRole('button', { name });

  it('der Haken hakt ab (offen/in Arbeit → erledigt) und nimmt zurück (erledigt → offen) – nie „in Arbeit“', () => {
    const { k } = zeige({ text: 'Beamer', todo: todo({ wer: [7] }) });
    fireEvent.click(haken(/Status: offen/));
    const von = (a: Aufgabe) => vi.mocked(k.aendern).mock.calls.at(-1)![2](a);
    expect(von(todo()).status).toBe('erledigt');
    expect(von(statusSetzen(todo(), 'arbeit', 1, 'x')).status).toBe('erledigt');
    cleanup();
    const z = zeige({ text: 'Beamer', todo: statusSetzen(todo(), 'erledigt', 1, 'x') });
    fireEvent.click(haken(/Status: erledigt/));
    expect(
      vi.mocked(z.k.aendern).mock.calls[0][2](statusSetzen(todo(), 'erledigt', 1, 'x')).status,
    ).toBe('offen');
  });

  it('„Jeder für sich“: der Haken ist mein Teil; die Auswahl „Jeder hakt für sich ab“ gibt es ab zwei Zuständigen', () => {
    const jeder = modusSetzen(todo({ wer: [1, 7, 19] }), true, 1, 'x');
    const { k } = zeige({ text: 'Beamer', todo: jeder });
    fireEvent.click(haken(/mein Teil/));
    const nachher = vi.mocked(k.aendern).mock.calls[0][2](jeder);
    expect(nachher.fertig).toHaveProperty('1');
    expect(nachher.status).toBe('arbeit');
    fireEvent.click(screen.getByRole('button', { name: 'Wer kümmert sich?' }));
    const box = screen.getByRole<HTMLInputElement>('checkbox', { name: 'Jeder hakt für sich ab' });
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect(vi.mocked(k.aendern).mock.calls[1][2](jeder).jeder).toBeUndefined();
  });

  it('der Modus-Schalter fehlt bei einem Zuständigen und solange es das To-Do nicht gibt', () => {
    zeige({ text: 'Beamer', todo: todo({ wer: [7] }) });
    fireEvent.click(screen.getByRole('button', { name: 'Wer kümmert sich?' }));
    expect(screen.queryByRole('checkbox', { name: 'Jeder hakt für sich ab' })).toBeNull();
    cleanup();
    zeige({ text: '' });
    fireEvent.click(screen.getByRole('button', { name: 'Wer kümmert sich?' }));
    expect(screen.queryByRole('checkbox', { name: 'Jeder hakt für sich ab' })).toBeNull();
  });
});

describe('Zuständige: Alle und Kürzung (W5)', () => {
  const wer = () => screen.getByRole('button', { name: 'Wer kümmert sich?' });

  it('Alle an → alle Mitglieder; Haken weg → Schalter aus; Alle aus → leer (über `zustaendigSetzen`, Verlauf)', () => {
    const { k } = zeige({ text: 'Beamer', todo: todo({ wer: [7] }) });
    fireEvent.click(wer());
    const alle = screen.getByRole<HTMLInputElement>('checkbox', { name: 'Alle (2)' });
    expect(alle.checked).toBe(false);
    fireEvent.click(alle);
    const neu = vi.mocked(k.aendern).mock.calls[0][2](todo({ wer: [7] }));
    expect(neu.wer).toEqual([7, 19]);
    expect(neu.verlauf.at(-1)).toMatchObject({ art: 'zustaendig' });
  });

  it('Alle zeigt „an“, wenn alle gewählt sind; Alle aus nimmt alle der Liste weg', () => {
    const { k } = zeige({ text: 'Beamer', todo: todo({ wer: [7, 19] }) });
    fireEvent.click(wer());
    const alle = screen.getByRole<HTMLInputElement>('checkbox', { name: 'Alle (2)' });
    expect(alle.checked).toBe(true);
    fireEvent.click(alle);
    const neu = vi.mocked(k.aendern).mock.calls[0][2](todo({ wer: [7, 19, 55] }));
    expect(neu.wer).toEqual([55]);
  });

  it('ohne To-Do (Vorab): Alle merkt sich alle im Block', () => {
    const { props } = zeige({ text: '' });
    fireEvent.click(wer());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Alle (2)' }));
    expect(vorabLesen(props.vorab)).toMatchObject({ wer: [7, 19] });
  });

  it('Schildchen: 17 Zuständige → 3 Namen und „+14“, voller Text im Tooltip; bis 3 unverändert', () => {
    zeige({ text: 'Beamer', mitglieder: VIELE, todo: todo({ wer: VIELE.map((m) => m.id) }) });
    expect(wer().textContent).toBe('Person1 Nach, Person2 Nach, Person3 Nach +14');
    expect(wer().getAttribute('title')).toBe(VIELE.map((m) => m.name).join(', '));
    cleanup();
    zeige({ text: 'Beamer', mitglieder: VIELE, todo: todo({ wer: [100, 101, 102] }) });
    expect(wer().textContent).toBe('Person1 Nach, Person2 Nach, Person3 Nach');
    expect(wer().getAttribute('title')).toBeNull();
  });
});

describe('Wer und Bis vor dem Text', () => {
  it('Escape klappt das Feld wieder zu, ohne zu wählen (`useEscape`, 16.11.2026)', () => {
    const { k } = zeige({ text: '' });
    fireEvent.click(screen.getByRole('button', { name: 'Wer kümmert sich?' }));
    expect(screen.getByRole('checkbox', { name: 'Johann Becker' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('checkbox', { name: 'Johann Becker' })).toBeNull();
    expect(k.aendern).not.toHaveBeenCalled();
  });

  it('ohne Text: Wer und Bis bedienbar, Status nicht; die Wahl landet im Block, nicht als To-Do', () => {
    const { editor, k, props } = zeige({ text: '' });
    // Status gibt es erst mit To-Do – ohne Text kein „antippen für …“.
    expect(screen.getByLabelText('Status: offen')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Wer kümmert sich?' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Johann Becker' }));
    expect(k.aendern).not.toHaveBeenCalled();
    expect(vorabLesen(props.vorab)).toEqual({ wer: [7], extern: '', bis: null });
    expect(editor.updateBlock).toHaveBeenCalledWith('b1', { props: { vorab: props.vorab } });
  });

  it('die Vorab-Wahl wird angezeigt und weitergeführt (zweite Wahl behält die erste)', () => {
    const { props } = zeige({
      text: '',
      vorab: JSON.stringify({ wer: [7], extern: '', bis: null }),
    });
    expect(screen.getByRole('button', { name: 'Wer kümmert sich?' }).textContent).toContain(
      'Johann Becker',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Bis wann?' }));
    const datum = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(datum, { target: { value: '2026-11-20' } });
    expect(vorabLesen(props.vorab)).toEqual({ wer: [7], extern: '', bis: '2026-11-20' });
  });

  it('mit Text, aber noch ohne To-Do: der erste Tipp legt das To-Do an – mit der Vorab-Wahl', () => {
    const { k } = zeige({
      text: 'Beamer',
      vorab: JSON.stringify({ wer: [7], extern: '', bis: '2026-11-20' }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Bis wann?' }));
    fireEvent.change(document.querySelector('input[type="date"]')!, {
      target: { value: '2026-11-27' },
    });
    const f = vi.mocked(k.aendern).mock.calls[0][2];
    expect(
      f(neueAufgabe({ id: 't1', gruppe: 194, sitzung: 's1', text: 'Beamer', von: 1, am: 'x' })),
    ).toMatchObject({ wer: [7], bis: '2026-11-27' });
  });

  it('mit To-Do: alles geht ins To-Do; die übernommene Vorab-Wahl verschwindet aus dem Block', () => {
    const { editor, k, props } = zeige({
      text: 'Beamer',
      vorab: JSON.stringify({ wer: [7], extern: '', bis: null }),
      todo: todo({ wer: [19] }),
    });
    expect(props.vorab).toBe('');
    expect(editor.updateBlock).toHaveBeenCalledWith('b1', { props: { vorab: '' } });
    expect(screen.getByRole('button', { name: 'Wer kümmert sich?' }).textContent).toContain(
      'Spike Musiker',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Wer kümmert sich?' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Johann Becker' }));
    const neu = vi.mocked(k.aendern).mock.calls[0][2](todo({ wer: [19] }));
    expect(neu.wer).toEqual([19, 7]);
    // S7-3: auch im Editor kommt der Wechsel in den Verlauf.
    expect(neu.verlauf.at(-1)).toMatchObject({
      art: 'zustaendig',
      von: 1,
      vorher: [19],
      nachher: [19, 7],
    });
  });
});

describe('Übernahme beim Speichern (echte Ableitung und Abgleich)', () => {
  it('das neue To-Do bekommt Wer und Bis aus dem Block', () => {
    const dok: Block[] = [
      {
        id: 'b1',
        type: 'aufgabe',
        props: {
          aufgabe: 't1',
          vorab: JSON.stringify({ wer: [7, 7], extern: ' Hausmeister ', bis: '2026-11-20' }),
        },
        content: [{ type: 'text', text: 'Beamer', styles: {} }],
        children: [],
      },
    ];
    const plan = aufgabenAbgleich({
      eintraege: ableiten(dok).aufgaben,
      vorhanden: [],
      gruppe: 194,
      sitzung: 's1',
      von: 1,
      am: '2026-10-28T10:00:00Z',
    });
    expect(plan.anlegen).toEqual([
      expect.objectContaining({
        id: 't1',
        text: 'Beamer',
        wer: [7],
        extern: 'Hausmeister',
        bis: '2026-11-20',
      }),
    ]);
  });

  it('gibt es das To-Do schon, ändert die alte Vorab-Wahl nichts', () => {
    const dok: Block[] = [
      {
        id: 'b1',
        type: 'aufgabe',
        props: { aufgabe: 't1', vorab: JSON.stringify({ wer: [7], extern: '', bis: null }) },
        content: [{ type: 'text', text: 'Beamer', styles: {} }],
        children: [],
      },
    ];
    const plan = aufgabenAbgleich({
      eintraege: ableiten(dok).aufgaben,
      vorhanden: [todo({ wer: [19] })],
      gruppe: 194,
      sitzung: 's1',
      von: 1,
      am: '2026-10-28T10:00:00Z',
    });
    expect(plan).toEqual({ anlegen: [], aendern: [] });
  });
});

describe('vorabLesen', () => {
  it.each([
    ['', null],
    ['kaputt', null],
    ['{}', null],
    [
      JSON.stringify({ wer: [1, 'x', 2.5], extern: 3, bis: '20.11.' }),
      { wer: [1], extern: '', bis: null },
    ],
    [
      JSON.stringify({ wer: [], extern: '', bis: '2026-11-20' }),
      { wer: [], extern: '', bis: '2026-11-20' },
    ],
  ])('%s → %o', (x, erwartet) => {
    expect(vorabLesen(x)).toEqual(erwartet);
  });
});

describe('Mitgliederliste verborgen (S7-2a: Mitglieder sahen „Person 1“)', () => {
  it('ich selbst mit Namen, andere aus dem Verlauf, wer nie schrieb als Zahl', () => {
    zeige({
      text: 'Beamer',
      mitglieder: 'verborgen',
      todo: todo({
        wer: [1, 7, 23],
        verlauf: [
          { am: 'x', von: 1, art: 'angelegt' },
          { am: 'x', von: 7, name: 'Johann', art: 'notiz', text: 'Angebot da' },
        ],
      }),
    });
    expect(screen.getByRole('button', { name: 'Wer kümmert sich?' }).textContent).toMatch(
      /Alwin.*Johann.*Person 23/,
    );
  });
});
