// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  aufgabenAbgleich,
  neueAufgabe,
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

describe('Wer und Bis vor dem Text', () => {
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
    expect(vi.mocked(k.aendern).mock.calls[0][2](todo({ wer: [19] })).wer).toEqual([19, 7]);
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
