// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BlockNoteEditor, type PartialBlock } from '@blocknote/core';
import { ohneWert, schnappschussAus, schnappschussWert } from '@shared/protokolle/anwesenheit';
import type { Block } from '@shared/protokolle/dokument';
import type { ProtokollKopf } from '@shared/protokolle/speicher';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { schema, TABELLEN, type ProtokollEditor } from './editorSchema';
import { einhaengen } from './editorTest.testutil';
import { FestePunkteRahmen } from './FestePunkteRahmen';
import { FesterPunkt } from './FesterPunkt';
import { VerweisBlock } from './EditorBloecke';
import { ProtokollAnsicht } from './ProtokollAnsicht';
import { nachbauEnde, nachbauStarten, type Nachbau } from './nachbau.testhilfe';

/**
 * **Fester Punkt „Anwesenheit“** (S5-3) im echten Rahmen gegen die nachgestellte ChurchTools-Instanz: von selbst
 * vorbelegt, Tippen, wieder offen, lesen, Gäste, Treffen anlegen, abgeschlossen.
 */

let ct: Nachbau;
const G = 194;
beforeEach(() => {
  ct = nachbauStarten();
  ct.treffen.set(G, [{ id: 15, startDate: '2026-11-11T18:00:00Z' }]);
});
afterEach(() => {
  cleanup();
  nachbauEnde();
});

const kopf: ProtokollKopf = {
  art: 'protokoll',
  fassung: 1,
  sitzung: 'heute',
  titel: 'Leitungssitzung',
  status: 'entwurf',
  beginn: '2026-11-11T18:00:00Z',
  termin: { kalender: 4, id: 114 },
  treffen: 15,
  freigabe: null,
  sperre: null,
  stand: 'x',
};
const SITZUNG: Sitzung = {
  schluessel: 'p:heute',
  beginn: kopf.beginn,
  titel: 'Leitungssitzung',
  termin: kopf.termin,
  treffen: 15,
  kopf,
  anfragen: [
    { person: 1, antwort: 'zugesagt' },
    { person: 19, antwort: 'abgesagt' },
  ],
};

function zeige(
  punkt: React.ReactNode,
  q: { sitzung?: Sitzung; onTreffenAnlegen?: () => Promise<number>; schreibt?: boolean } = {},
) {
  return render(
    <FestePunkteRahmen
      sitzung={q.sitzung ?? SITZUNG}
      gruppe={G}
      protokolle={[]}
      teile={[]}
      aufgaben={[]}
      zeitzone="Europe/Berlin"
      onTreffenAnlegen={q.onTreffenAnlegen}
      schreibt={q.schreibt}
    >
      {punkt}
    </FestePunkteRahmen>,
  );
}

const imTreffen = (person: number) => ct.teilnahme.get(15)?.get(person) ?? 'unsure';
const gedrueckt = (name: string) =>
  within(screen.getByRole('group', { name }))
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.textContent);

describe('Anwesenheit beim Schreiben (S5-3)', () => {
  it('von selbst vorbelegt: Zusage anwesend, Absage abwesend – steht im Gruppentreffen', async () => {
    zeige(<FesterPunkt art="anwesenheit" abhaken gaeste="" gaesteSetzen={() => {}} fest="" />);
    await screen.findByRole('group', { name: 'Alwin Friesen' });
    expect(gedrueckt('Alwin Friesen')).toEqual(['Anwesend']);
    expect(gedrueckt('Spike Musiker')).toEqual(['Abwesend']);
    expect([imTreffen(1), imTreffen(19)]).toEqual(['present', 'absent']);
    // Aufgeklappt eine Zeile mit Zahlen – die Liste springt beim Tippen nicht.
    expect(screen.getByText('Anwesend 1 · Abwesend 1 · Offen 0')).toBeTruthy();
  });

  it('nochmal tippen heißt wieder offen – auch im Gruppentreffen', async () => {
    zeige(<FesterPunkt art="anwesenheit" abhaken gaeste="" gaesteSetzen={() => {}} fest="" />);
    const alwin = await screen.findByRole('group', { name: 'Alwin Friesen' });
    fireEvent.click(within(alwin).getByRole('button', { name: 'Anwesend' }));
    await waitFor(() => expect(imTreffen(1)).toBe('unsure'));
    await waitFor(() => expect(gedrueckt('Alwin Friesen')).toEqual([]));
  });

  it('schon begonnen (jemand hat etwas eingetragen): keine Vorbelegung', async () => {
    ct.treffen.get(G)![0].hasEditingStarted = true;
    zeige(<FesterPunkt art="anwesenheit" abhaken gaeste="" gaesteSetzen={() => {}} fest="" />);
    await screen.findByRole('group', { name: 'Alwin Friesen' });
    expect(gedrueckt('Alwin Friesen')).toEqual([]);
    expect(ct.teilnahme.get(15)).toBeUndefined();
  });

  it('lässt sich die Anwesenheit nicht lesen: Fehler statt „wird gelesen“', async () => {
    ct.fehlerBei = { methode: 'GET', status: 503 };
    zeige(<FesterPunkt art="anwesenheit" abhaken gaeste="" gaesteSetzen={() => {}} fest="" />);
    expect((await screen.findByRole('alert')).textContent).toMatch(/antwortet gerade nicht/);
    expect(screen.queryByText('Anwesenheit wird gelesen …')).toBeNull();
  });

  it('fehlt das Recht, steht es da – und nichts bleibt halb', async () => {
    ct.treffen.get(G)![0].hasEditingStarted = true;
    zeige(<FesterPunkt art="anwesenheit" abhaken gaeste="" gaesteSetzen={() => {}} fest="" />);
    const alwin = await screen.findByRole('group', { name: 'Alwin Friesen' });
    ct.treffenVerboten = true;
    fireEvent.click(within(alwin).getByRole('button', { name: 'Anwesend' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Gruppentreffen zu pflegen/);
  });

  it('Gäste: hinzufügen und entfernen gehen an den Block (nur im Protokoll)', async () => {
    const setzen = vi.fn();
    zeige(
      <FesterPunkt
        art="anwesenheit"
        abhaken
        gaeste='["Erika Fast"]'
        gaesteSetzen={setzen}
        fest=""
      />,
    );
    await screen.findByText('Erika Fast');
    fireEvent.change(screen.getByRole('textbox', { name: 'Gast hinzufügen' }), {
      target: { value: '  Hans Wall ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
    expect(setzen).toHaveBeenLastCalledWith(['Erika Fast', 'Hans Wall']);
    fireEvent.click(screen.getByRole('button', { name: 'Erika Fast entfernen' }));
    expect(setzen).toHaveBeenLastCalledWith([]);
    expect(ct.teilnehmer.map((t) => t.person)).toEqual([1, 19]); // nie ins Gruppentreffen
  });

  it('abgeschlossenes Treffen: nur noch lesen', async () => {
    ct.treffen.get(G)![0].isCompleted = true;
    zeige(<FesterPunkt art="anwesenheit" abhaken gaeste="" gaesteSetzen={() => {}} fest="" />);
    await screen.findByText(/abgeschlossen – die Anwesenheit steht fest/);
    expect(screen.queryByRole('group', { name: 'Alwin Friesen' })).toBeNull();
    expect(ct.teilnahme.get(15)).toBeUndefined();
  });

  it('ohne Gruppentreffen: „Gruppentreffen anlegen“ – danach gleich die Anwesenheit', async () => {
    const ohne: Sitzung = { ...SITZUNG, treffen: null, kopf: { ...kopf, treffen: null } };
    const anlegen = vi.fn(async () => 15);
    zeige(<FesterPunkt art="anwesenheit" abhaken gaeste="" gaesteSetzen={() => {}} fest="" />, {
      sitzung: ohne,
      onTreffenAnlegen: anlegen,
    });
    expect(screen.getByText('Zu dieser Sitzung gibt es noch kein Gruppentreffen.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Gruppentreffen anlegen' }));
    await screen.findByRole('group', { name: 'Alwin Friesen' });
    expect(anlegen).toHaveBeenCalledTimes(1);
  });
});

describe('Person aus dem Protokoll nehmen (17.11.2026)', () => {
  const schreiben = (ohne: unknown, setzen = vi.fn(), extra: Record<string, unknown> = {}) =>
    zeige(
      <FesterPunkt
        art="anwesenheit"
        abhaken
        gaeste=""
        gaesteSetzen={() => {}}
        ohne={ohne}
        ohneSetzen={setzen}
        fest=""
        {...extra}
      />,
    );

  it('je Person ein Knopf – er meldet die Person-ID an den Block, im Gruppentreffen ändert sich nichts', async () => {
    const setzen = vi.fn();
    schreiben('', setzen);
    await screen.findByRole('group', { name: 'Alwin Friesen' });
    const vorher = [imTreffen(1), imTreffen(19)];
    fireEvent.click(screen.getByRole('button', { name: 'Spike Musiker aus dem Protokoll nehmen' }));
    expect(setzen).toHaveBeenLastCalledWith([19]);
    expect([imTreffen(1), imTreffen(19)]).toEqual(vorher);
    expect(ct.teilnehmer.map((t) => t.person)).toEqual([1, 19]); // nie aus dem Gruppentreffen
  });

  it('wer schon ausgeblendet ist, steht nicht in der Liste und nicht in den Zahlen; die zweite Person kommt dazu', async () => {
    const setzen = vi.fn();
    schreiben(ohneWert([19]), setzen);
    await screen.findByRole('group', { name: 'Alwin Friesen' });
    expect(screen.queryByRole('group', { name: 'Spike Musiker' })).toBeNull();
    expect(screen.getByText('Anwesend 1 · Abwesend 0 · Offen 0')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Alwin Friesen aus dem Protokoll nehmen' }));
    expect(setzen).toHaveBeenLastCalledWith([19, 1]);
  });

  it('„n ausgeblendet“ mit „Zeigen“: die Ausgeblendeten klappen auf, „Zurückholen“ nimmt sie wieder herein', async () => {
    const setzen = vi.fn();
    schreiben(ohneWert([19]), setzen);
    await screen.findByText('1 ausgeblendet');
    expect(screen.queryByRole('button', { name: 'Spike Musiker zurückholen' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Zeigen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Spike Musiker zurückholen' }));
    expect(setzen).toHaveBeenLastCalledWith([]);
  });

  it('ohne Ausgeblendete gibt es die Zeile nicht', async () => {
    schreiben('');
    await screen.findByRole('group', { name: 'Alwin Friesen' });
    expect(screen.queryByText(/ausgeblendet/)).toBeNull();
  });

  it('die Vorbelegung überspringt Ausgeblendete: nichts davon steht im Gruppentreffen', async () => {
    schreiben(ohneWert([19]));
    await screen.findByRole('group', { name: 'Alwin Friesen' });
    expect(imTreffen(1)).toBe('present'); // die Zusage wird eingetragen …
    expect(imTreffen(19)).toBe('unsure'); // … die Absage der ausgeblendeten Person nicht
  });

  it('zugeklappt zählt die Kurzform ohne sie', async () => {
    ct.treffen.get(G)![0].hasEditingStarted = true;
    ct.teilnahme.set(15, new Map([[1, 'present']]));
    zeige(
      <FesterPunkt art="anwesenheit" abhaken={false} gaeste="" ohne={ohneWert([19])} fest="" />,
    );
    const kopfzeile = await screen.findByRole('button', { expanded: false });
    expect(kopfzeile.textContent).toBe('Anwesend (1): Alwin Friesen');
  });

  it('beim Lesen: ausgeblendete Person erscheint gar nicht, auch kein Knopf und keine Zeile „ausgeblendet“', async () => {
    ct.treffen.get(G)![0].hasEditingStarted = true;
    zeige(
      <FesterPunkt art="anwesenheit" abhaken={false} gaeste="" ohne={ohneWert([19])} fest="" />,
    );
    fireEvent.click(await screen.findByRole('button', { expanded: false }));
    expect(screen.queryByText(/Spike Musiker/)).toBeNull();
    expect(screen.queryByText(/ausgeblendet/)).toBeNull();
    expect(screen.queryByRole('button', { name: /aus dem Protokoll nehmen/ })).toBeNull();
  });

  it('abgeschlossenes Treffen: Tippen gesperrt, Ausblenden bleibt möglich (betrifft nur das Protokoll)', async () => {
    ct.treffen.get(G)![0].isCompleted = true;
    const setzen = vi.fn();
    schreiben('', setzen);
    await screen.findByText(/abgeschlossen – die Anwesenheit steht fest/);
    expect(screen.queryByRole('group', { name: 'Spike Musiker' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Spike Musiker aus dem Protokoll nehmen' }));
    expect(setzen).toHaveBeenLastCalledWith([19]);
  });
});

describe('Anwesenheit beim Lesen (S5-3)', () => {
  it('zugeklappt die Kurzform; keine Knöpfe, keine Vorbelegung', async () => {
    ct.treffen.get(G)![0].hasEditingStarted = true;
    ct.teilnahme.set(15, new Map([[1, 'present']]));
    zeige(<FesterPunkt art="anwesenheit" abhaken={false} gaeste='["Hans Wall"]' fest="" />);
    const kopfzeile = await screen.findByRole('button', { expanded: false });
    expect(kopfzeile.textContent).toBe(
      'Anwesend (1): Alwin FriesenOffen: Spike MusikerGäste: Hans Wall',
    );
    fireEvent.click(kopfzeile);
    expect(screen.queryByRole('group', { name: 'Alwin Friesen' })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Gruppentreffen anlegen' })).toBeNull();
  });

  it('die Lese-Ansicht des Protokolls reicht props.ohne an den Kasten: die Person fehlt, auch aufgeklappt', async () => {
    ct.treffen.get(G)![0].hasEditingStarted = true;
    ct.teilnahme.set(15, new Map([[1, 'present']]));
    zeige(
      <ProtokollAnsicht
        dokument={[
          {
            id: 'v',
            type: 'verweis',
            props: { art: 'anwesenheit', ohne: ohneWert([19]) },
            children: [],
          },
        ]}
      />,
    );
    const kopfzeile = await screen.findByRole('button', { expanded: false });
    expect(kopfzeile.textContent).toBe('Anwesend (1): Alwin Friesen');
    fireEvent.click(kopfzeile);
    expect(screen.queryByText(/Spike Musiker/)).toBeNull();
  });

  it('ohne Treffen beim Lesen: nur der Satz, kein Knopf', () => {
    const ohne: Sitzung = { ...SITZUNG, treffen: null, kopf: { ...kopf, treffen: null } };
    zeige(<FesterPunkt art="anwesenheit" abhaken={false} gaeste="" fest="" />, {
      sitzung: ohne,
      onTreffenAnlegen: async () => 15,
    });
    expect(screen.getByText('Zu dieser Sitzung gibt es noch kein Gruppentreffen.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gruppentreffen anlegen' })).toBeNull();
  });
});

describe('Im Editor (VerweisBlock)', () => {
  type Teil = PartialBlock<
    typeof schema.blockSchema,
    typeof schema.inlineContentSchema,
    typeof schema.styleSchema
  >;
  const editorMit = (dok: readonly Block[]): ProtokollEditor =>
    einhaengen(BlockNoteEditor.create({ schema, tables: TABELLEN, initialContent: dok as Teil[] }));

  it('ein Gast landet in props.gaeste; das Eingabefeld bekommt den Klick, der Rest des Kastens nicht', async () => {
    const e = editorMit([
      { id: 'v', type: 'verweis', props: { art: 'anwesenheit' }, children: [] },
    ]);
    const block = () => {
      const b = e.getBlock('v')!;
      return { id: 'v', props: b.props as { art: string; fest: string; gaeste?: string } };
    };
    const { rerender } = zeige(<VerweisBlock block={block()} editor={e} />);
    const feld = await screen.findByRole('textbox', { name: 'Gast hinzufügen' });
    const druck = (el: Element) => {
      const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
      return ev.defaultPrevented;
    };
    expect(druck(feld)).toBe(false);
    expect(druck(screen.getByText('Alwin Friesen'))).toBe(true);
    fireEvent.change(feld, { target: { value: 'Hans Wall' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
    expect(e.getBlock('v')!.props).toMatchObject({ gaeste: '["Hans Wall"]' });
    act(() =>
      rerender(
        <FestePunkteRahmen
          sitzung={SITZUNG}
          gruppe={G}
          protokolle={[]}
          teile={[]}
          aufgaben={[]}
          zeitzone="Europe/Berlin"
        >
          <VerweisBlock block={block()} editor={e} />
        </FestePunkteRahmen>,
      ),
    );
    expect(await screen.findByText('Hans Wall')).toBeTruthy();
  });

  it('eine Person aus dem Protokoll nehmen landet in props.ohne – und wieder zurückholen leert es', async () => {
    const e = editorMit([
      { id: 'v', type: 'verweis', props: { art: 'anwesenheit' }, children: [] },
    ]);
    const block = () => {
      const b = e.getBlock('v')!;
      return {
        id: 'v',
        props: b.props as { art: string; fest: string; gaeste?: string; ohne?: string },
      };
    };
    const rahmen = (b: ReturnType<typeof block>) => (
      <FestePunkteRahmen
        sitzung={SITZUNG}
        gruppe={G}
        protokolle={[]}
        teile={[]}
        aufgaben={[]}
        zeitzone="Europe/Berlin"
      >
        <VerweisBlock block={b} editor={e} />
      </FestePunkteRahmen>
    );
    const { rerender } = zeige(<VerweisBlock block={block()} editor={e} />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Spike Musiker aus dem Protokoll nehmen' }),
    );
    expect(e.getBlock('v')!.props).toMatchObject({ ohne: ohneWert([19]) });
    act(() => rerender(rahmen(block())));
    expect(screen.queryByRole('group', { name: 'Spike Musiker' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Zeigen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Spike Musiker zurückholen' }));
    expect(e.getBlock('v')!.props).toMatchObject({ ohne: '' });
  });

  it('gesperrter Editor: nur lesen – kein Tippen, keine Vorbelegung', async () => {
    const e = editorMit([
      { id: 'v', type: 'verweis', props: { art: 'anwesenheit' }, children: [] },
    ]);
    e.isEditable = false;
    zeige(<VerweisBlock block={{ id: 'v', props: { art: 'anwesenheit', fest: '' } }} editor={e} />);
    await screen.findByRole('button', { expanded: false });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /aus dem Protokoll nehmen/ })).toBeNull();
    expect(ct.teilnahme.get(15)).toBeUndefined();
  });
});

describe('Fester Punkt: je Art ausdrücklich (S5-3)', () => {
  it('eine Art, die diese Fassung nicht kennt, erscheint nicht als „Offene To-Dos“', () => {
    zeige(<FesterPunkt art="aus-der-zukunft" abhaken={false} fest="" />);
    expect(screen.getByText('Fester Punkt')).toBeTruthy();
    expect(screen.queryByText(/Offene To-Dos/)).toBeNull();
  });
});

/**
 * **Das Protokoll merkt sich die Anwesenheit** (W16): Schnappschuss beim Schreiben (am Rückgängig-Verlauf vorbei), beim
 * Lesen live – und bei 403 oder einem vorübergehenden Fehler der Schnappschuss, ohne Fehlermeldung.
 */
describe('Schnappschuss der Anwesenheit (W16)', () => {
  const GEMERKT = schnappschussWert({
    personen: [
      { person: 1, name: 'Alwin Friesen', status: 'da' },
      { person: 19, name: 'Spike Musiker', status: 'weg' },
    ],
  });

  it('Lesen ohne Recht am Gruppentreffen (403): der Schnappschuss, ohne Fehlermeldung', async () => {
    ct.treffenVerboten = true;
    zeige(<FesterPunkt art="anwesenheit" abhaken={false} fest="" schnappschuss={GEMERKT} />);
    expect(await screen.findByText(/Alwin Friesen/)).toBeTruthy();
    expect(screen.getByText(/Anwesend \(1\):/)).toBeTruthy();
    expect(screen.getByText('Spike Musiker')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Lesen bei vorübergehendem Fehler (503): ebenso der Schnappschuss', async () => {
    ct.fehlerBei = { methode: 'GET', status: 503 };
    zeige(<FesterPunkt art="anwesenheit" abhaken={false} fest="" schnappschuss={GEMERKT} />);
    expect(await screen.findByText(/Anwesend \(1\):/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('ohne Schnappschuss bleibt es bei der Meldung wie bisher', async () => {
    ct.treffenVerboten = true;
    zeige(<FesterPunkt art="anwesenheit" abhaken={false} fest="" />);
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('wo ChurchTools die Anwesenheit zeigt, gilt sie live – nicht der Schnappschuss', async () => {
    ct.teilnahme.set(15, new Map([[19, 'present']]));
    ct.treffen.get(G)![0].hasEditingStarted = true;
    zeige(<FesterPunkt art="anwesenheit" abhaken={false} fest="" schnappschuss={GEMERKT} />);
    expect(await screen.findByText(/Anwesend \(1\):/)).toBeTruthy();
    expect(screen.getByText('Spike Musiker')).toBeTruthy();
    expect(screen.getByText(/Offen:/)).toBeTruthy(); // Alwin ist live offen, im Schnappschuss anwesend
  });

  it('Lese-Ansicht (ProtokollAnsicht) liest den Schnappschuss aus dem Block', async () => {
    ct.treffenVerboten = true;
    const dok: Block[] = [
      {
        id: 'v',
        type: 'verweis',
        props: { art: 'anwesenheit', schnappschuss: GEMERKT },
        children: [],
      },
    ];
    zeige(<ProtokollAnsicht dokument={dok} aufgaben={[]} />);
    expect(await screen.findByText(/Anwesend \(1\):/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('beim Schreiben: ein eigener Tipp schreibt den Schnappschuss gleich mit', async () => {
    ct.treffen.get(G)![0].hasEditingStarted = true;
    const merken = vi.fn();
    zeige(
      <FesterPunkt
        art="anwesenheit"
        abhaken
        gaeste=""
        gaesteSetzen={() => {}}
        fest=""
        schnappschussSetzen={merken}
      />,
    );
    const spike = await screen.findByRole('group', { name: 'Spike Musiker' });
    expect(merken).not.toHaveBeenCalled(); // bloßes Öffnen schreibt nichts (sonst nähme es die Sperre)
    fireEvent.click(within(spike).getByRole('button', { name: 'Anwesend' }));
    await waitFor(() => expect(merken).toHaveBeenCalledTimes(1));
    expect(schnappschussAus(merken.mock.calls[0][0])?.personen).toEqual([
      { person: 1, name: 'Alwin Friesen', status: 'offen' },
      { person: 19, name: 'Spike Musiker', status: 'da' },
    ]);
  });

  it('solange das Fenster schreibt: der gelesene Stand kommt von selbst hinein – einmal, nicht bei jedem Zeichnen', async () => {
    const merken = vi.fn();
    const punkt = (gemerkt: string) => (
      <FesterPunkt
        art="anwesenheit"
        abhaken
        gaeste=""
        gaesteSetzen={() => {}}
        fest=""
        schnappschuss={gemerkt}
        schnappschussSetzen={merken}
      />
    );
    const { rerender } = zeige(punkt(''), { schreibt: true });
    await waitFor(() => expect(merken).toHaveBeenCalledTimes(1));
    const wert = merken.mock.calls[0][0] as string;
    // Nach der Vorbelegung: Alwin hat zugesagt, Spike abgesagt.
    expect(wert).toBe(GEMERKT);
    act(() =>
      rerender(
        <FestePunkteRahmen
          sitzung={SITZUNG}
          gruppe={G}
          protokolle={[]}
          teile={[]}
          aufgaben={[]}
          zeitzone="Europe/Berlin"
          schreibt
        >
          {punkt(wert)}
        </FestePunkteRahmen>,
      ),
    );
    await act(() => Promise.resolve());
    expect(merken).toHaveBeenCalledTimes(1);
  });

  it('im Editor: der Schnappschuss steht im Block – und Rückgängig nimmt ihn nicht zurück (ohneVerlauf)', async () => {
    const e = einhaengen(
      BlockNoteEditor.create({
        schema,
        tables: TABELLEN,
        initialContent: [
          { id: 'p', type: 'paragraph', content: 'Vorher' },
          { id: 'v', type: 'verweis', props: { art: 'anwesenheit' } },
        ] as never,
      }),
    );
    e.updateBlock('p', { content: 'Vorher getippt' });
    const block = () => {
      const b = e.getBlock('v')!;
      return { id: 'v', props: b.props as { art: string; fest: string; schnappschuss?: string } };
    };
    zeige(<VerweisBlock block={block()} editor={e} />, { schreibt: true });
    await waitFor(() => expect(e.getBlock('v')!.props).toMatchObject({ schnappschuss: GEMERKT }));
    // Rückgängig trifft das Getippte, nicht den Schnappschuss – sonst schriebe der Kasten ihn sofort wieder, und
    // Rückgängig drehte sich im Kreis (TF-PROT-29).
    expect(e.undo()).toBe(true);
    expect(JSON.stringify(e.getBlock('p')?.content)).not.toContain('getippt');
    expect(e.getBlock('v')!.props).toMatchObject({ schnappschuss: GEMERKT });
  });
});
