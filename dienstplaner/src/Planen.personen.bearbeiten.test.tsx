// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { planAus } from '@shared/dienstplan/plan';
import type { RohTermin } from '@shared/dienstplan/termine';
import type { GruppenStand, PersonenDaten } from '@shared/dienstplan/personenDaten';
import { diensteAus } from '@shared/ct/dienste';
import { Fehler } from '@shared/dienstplan/einteilen.testutil';
import { KAT, MODUL, speicher } from '@shared/dienstplan/entwuerfe.testutil';
import { inhaltAusWerten, type SchubladenStand } from '@shared/dienstplan/entwuerfe';
import { personenlisteSpeichern } from '@shared/dienstplan/personenlisteSpeichern';
import { BEGLEITUNG, LEITUNG, liste, listeWert } from '@shared/dienstplan/personenliste.testutil';
import type { Personenliste } from '@shared/dienstplan/personenliste';
import type { EntwuerfeDaten } from './ladeEntwuerfe';
import { daten, nachgebaut, TECHNIK } from './entwurfAnschluss.testutil';
import { mehrEintrag, mehrEintragOder } from './mehrMenue.testutil';
import { Planen } from './Planen';
import { ganzSichtbar, planbar } from './start';
import { startFuer } from './start.testutil';

/**
 * **„Liste bearbeiten“ in „Personen“ (PL-2)**: Menüeintrag, Modus mit Band, Griffe und Ziehen, Personen-Fenster (Tags, Pause),
 * „Tags verwalten“, Rechte, Konflikt und Fehler. Gespeichert wird über den **echten Kern** (`personenlisteSpeichern`) in einen
 * nachgebauten Speicher – die Tests prüfen, was dort danach steht und was der Leser daraus macht, nicht Literale.
 */

// Das Ziehen selbst braucht echte Maße (jsdom hat keine) – darum fängt der Test die Rückrufe des Zieh-Bereichs ab und löst
// „losgelassen“ selbst aus. Gezogen wird sonst nur am Griff, das prüft `ZiehZeile` über seine Zugänglichkeits-Merkmale.
const ziehen = vi.hoisted(() => ({
  ende: null as null | ((e: { active: { id: string }; over: { id: string } | null }) => void),
}));
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const m = await importOriginal<typeof import('@dnd-kit/core')>();
  const { createElement } = await import('react');
  return {
    ...m,
    DndContext: (props: Parameters<typeof m.DndContext>[0]) => {
      ziehen.ende = props.onDragEnd as unknown as typeof ziehen.ende;
      return createElement(m.DndContext, props);
    },
  };
});

const START = startFuer({
  dienste: diensteAus([
    { id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [7], sortKey: 1 },
    { id: 9, name: 'Gesang', serviceGroupId: 4, groupIds: [9], sortKey: 2 },
  ]),
  rechte: {
    planbareDienstgruppen: [3, 4],
    sichtbareDienstgruppen: null,
    ablaufKalender: [],
    terminKalender: [],
    abwesenheitenAller: false,
  },
});
const ROH = [
  {
    id: 20,
    name: 'Gottesdienst',
    startDate: '2026-10-18T08:00:00Z',
    endDate: '2026-10-18T09:30:00Z',
    eventServices: [
      { serviceId: 6, personId: 5, name: 'Anna Test', isAccepted: true, index: null },
      { serviceId: 9, personId: 5, name: 'Anna Test', isAccepted: false, index: 1 },
      { serviceId: 9, personId: null, name: null, index: 2 },
    ],
  },
] as RohTermin[];
const PLAN = planAus(ROH, {
  ichId: START.ichId,
  dienste: START.dienste,
  dienstgruppen: START.dienstgruppen,
  zeitzone: 'Europe/Berlin',
  planbar: (d) => planbar(START, d),
  ganzSichtbar: (d) => ganzSichtbar(START, d),
});
const person = (id: number, name: string) => ({
  id,
  name,
  bild: null,
  initialen: name.slice(0, 2),
});
const ANNA = person(5, 'Anna Test');
const BEN = person(8, 'Ben Test');
const CARLA = person(11, 'Carla Test');
const da = (mitglieder: ReturnType<typeof person>[]): GruppenStand => ({
  art: 'da',
  mitglieder,
  abwesenheiten: [],
});
const STAND: PersonenDaten = new Map<number, GruppenStand>([
  [7, da([ANNA])],
  [9, da([ANNA, BEN, CARLA])],
]);

/** Gesang = Dienst 9 in Dienstgruppe 4 (Musik), Ton = Dienst 6 in Dienstgruppe 3 (Technik). */
const MUSIK = { id: 4, name: 'Musik', fuerAlle: false };

type Stand = Partial<Record<3 | 4, SchubladenStand>>;

/**
 * Die Seite mit zwei nachgebauten Speichern (je Dienstgruppe einer): `werte` sind die Werte der Schublade von Musik (4) bzw.
 * Technik (3). `stand` legt fest, was man in welcher Gruppe darf; `geladen` ist die Liste, mit der die Seite startet (die
 * Speicher können inzwischen weiter sein – dann kommt es zum Konflikt).
 */
function aufbauen(
  o: {
    stand?: Stand;
    musik?: Partial<Personenliste>;
    technik?: Partial<Personenliste>;
    geladenMusik?: Partial<Personenliste> | null;
    ohneAnschluss?: boolean;
    ansicht?: 'raster' | 'matrix';
  } = {},
) {
  const stand: Required<Stand> = { 3: 'bereit', 4: 'bereit', ...o.stand };
  const musik = speicher(o.musik ? [listeWert(o.musik, 900)] : []);
  const technik = speicher(o.technik ? [listeWert(o.technik, 901)] : []);
  const speicherVon = { 3: technik, 4: musik } as const;
  const aus = (
    g: 3 | 4,
    wert: Partial<Personenliste> | undefined | null,
  ): [number, Personenliste][] => (wert ? [[g, liste(wert)]] : []);
  const geladen: EntwuerfeDaten = {
    ...daten([], {}, [
      ...aus(4, o.geladenMusik === undefined ? o.musik : o.geladenMusik),
      ...aus(3, o.technik),
    ]),
    schubladen: new Map([
      [3, { gruppe: TECHNIK, kategorie: 31, stand: stand[3] }],
      [4, { gruppe: MUSIK, kategorie: 30, stand: stand[4] }],
    ]),
  };
  const personenliste = vi.fn(
    (
      _d: EntwuerfeDaten,
      g: number,
      aendern: Parameters<typeof personenlisteSpeichern>[3],
      v: number | null,
    ) => personenlisteSpeichern(speicherVon[g as 3 | 4].port, MODUL, KAT, aendern, v),
  );
  localStorage.setItem(
    'dienstplaner.planen.ansicht',
    JSON.stringify({ unteransicht: o.ansicht ?? 'raster' }),
  );
  const fokus = vi.fn();
  render(
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan: PLAN, wochen: 8 }}
      handy={false}
      onNochmal={() => {}}
      onMehr={() => {}}
      mehrMoeglich={false}
      ladeZeitraum={vi.fn(() => new Promise<never>(() => {}))}
      heute="2026-10-14"
      ladePersonen={vi.fn(() => Promise.resolve(STAND))}
      entwuerfe={
        o.ohneAnschluss
          ? undefined
          : nachgebaut({ laden: vi.fn(() => Promise.resolve(geladen)), personenliste })
      }
    />,
  );
  return { musik, technik, personenliste, fokus };
}

const raster = () => screen.findByRole('table', { name: 'Personen und ihre Einsätze' });
const zeileVon = (t: HTMLElement, id: number): HTMLElement => {
  const z = t.querySelector(`tr[data-person="${id}"]`);
  if (!z) throw new Error(`Keine Zeile für Person ${id}`);
  return z as HTMLElement;
};
/** Die Personen-IDs des Gesang-Blocks (Dienst 9) von oben nach unten – Zeilen ohne Ton-Doppelgänger (Anna steht auch bei Ton). */
const reihenfolge = (t: HTMLElement): number[] => {
  const start = [...t.querySelectorAll('tbody tr')].findIndex(
    (z) => z.textContent?.includes('Gesang') && !z.hasAttribute('data-person'),
  );
  const rows = [...t.querySelectorAll('tbody tr')].slice(start + 1);
  const ende = rows.findIndex((z) => z.textContent?.startsWith('Plätze'));
  return rows
    .slice(0, ende)
    .filter((z) => z.hasAttribute('data-person'))
    .map((z) => Number(z.getAttribute('data-person')));
};
const gelesen = (werte: Parameters<typeof inhaltAusWerten>[0]) =>
  inhaltAusWerten(werte).personenliste;

/** Menü → „Liste bearbeiten“ → warten, bis das Band da ist. */
async function modusAn() {
  mehrEintrag('Liste bearbeiten');
  await screen.findByRole('status', { name: 'Liste bearbeiten' });
}

// jsdom kennt `window.scrollTo` nicht – nach dem Ziehen holt `resetViewportAfterDrag` die Seite nach oben.
Object.defineProperty(window, 'scrollTo', { value: vi.fn(), configurable: true });

afterEach(() => {
  cleanup();
  localStorage.clear();
  ziehen.ende = null;
});

describe('„Liste bearbeiten“ – Menü und Modus (PL-2)', () => {
  it('der Eintrag steht im „⋯“-Menü, wo man die Liste einer gezeigten Dienstgruppe ändern darf', async () => {
    aufbauen();
    await raster();
    await waitFor(() => expect(mehrEintragOder('Liste bearbeiten')).not.toBeNull());
  });

  it('ohne Recht (nur lesen, nicht eingerichtet, kein Anschluss) gibt es den Eintrag nicht', async () => {
    aufbauen({ stand: { 3: 'nur-lesen', 4: 'nur-lesen' } });
    await raster();
    await waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(3));
    expect(mehrEintragOder('Liste bearbeiten')).toBeNull();
    cleanup();
    aufbauen({ stand: { 3: 'fehlt', 4: 'einrichtbar' } });
    await raster();
    expect(mehrEintragOder('Liste bearbeiten')).toBeNull();
    cleanup();
    aufbauen({ ohneAnschluss: true });
    await raster();
    expect(mehrEintragOder('Liste bearbeiten')).toBeNull();
  });

  it('aus der Matrix: der Eintrag wechselt nach „Personen“ und schaltet den Modus an; „Fertig“ beendet ihn', async () => {
    aufbauen({ ansicht: 'matrix' });
    await waitFor(() => expect(mehrEintragOder('Liste bearbeiten')).not.toBeNull());
    await modusAn();
    const t = await raster();
    expect(
      within(screen.getByRole('status', { name: 'Liste bearbeiten' })).getByRole('button', {
        name: 'Tags verwalten',
      }),
    ).toBeTruthy();
    expect(
      t.querySelector('tr[data-person="8"] [aria-label="Ben Test verschieben"]'),
    ).not.toBeNull();
    // Im Modus gibt es den Eintrag nicht noch einmal.
    expect(mehrEintragOder('Liste bearbeiten')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fertig' }));
    expect(screen.queryByRole('status', { name: 'Liste bearbeiten' })).toBeNull();
    expect(t.querySelector('[aria-label$="verschieben"]')).toBeNull();
  });

  it('ein Wechsel der Ansicht beendet den Modus', async () => {
    aufbauen();
    await raster();
    await waitFor(() => expect(mehrEintragOder('Liste bearbeiten')).not.toBeNull());
    await modusAn();
    fireEvent.click(screen.getByRole('button', { name: 'Matrix' }));
    expect(screen.queryByRole('status', { name: 'Liste bearbeiten' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Personen' }));
    await raster();
    expect(screen.queryByRole('status', { name: 'Liste bearbeiten' })).toBeNull();
  });
});

describe('Rechte je Dienstgruppe (PL-2)', () => {
  it('ohne Recht in einer Gruppe: dort keine Griffe, der Name bleibt der Fokus; in der anderen gibt es beides', async () => {
    // Technik (Ton, Anna) darf man ändern, Musik (Gesang) nur lesen.
    aufbauen({ stand: { 3: 'bereit', 4: 'nur-lesen' } });
    const t = await raster();
    await waitFor(() => expect(mehrEintragOder('Liste bearbeiten')).not.toBeNull());
    await modusAn();
    // Gesang: Ben und Carla stehen nur dort.
    await waitFor(() => expect(zeileVon(t, 8)).toBeTruthy());
    expect(within(zeileVon(t, 8)).queryByLabelText('Ben Test verschieben')).toBeNull();
    expect(within(zeileVon(t, 11)).queryByLabelText('Carla Test verschieben')).toBeNull();
    // … und der Name setzt weiter den Fokus (aria-pressed), öffnet kein Fenster.
    const ben = zeileVon(t, 8).querySelector('th button') as HTMLElement;
    expect(ben.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(ben);
    expect(screen.queryByRole('dialog', { name: 'Ben Test' })).toBeNull();
    // Ton: Anna hat dort einen Griff (zwei Zeilen für Anna: Ton und Gesang – nur Ton ist ändernd).
    const annaZeilen = [...t.querySelectorAll('tr[data-person="5"]')];
    expect(
      annaZeilen.filter((z) => z.querySelector('[aria-label="Anna Test verschieben"]')),
    ).toHaveLength(1);
  });
});

describe('Personen-Fenster: Tags und Pause (PL-2)', () => {
  async function fensterFuer(id: number, name: string, o: Parameters<typeof aufbauen>[0] = {}) {
    const r = aufbauen(o);
    const t = await raster();
    await waitFor(() => expect(mehrEintragOder('Liste bearbeiten')).not.toBeNull());
    await modusAn();
    fireEvent.click(within(zeileVon(t, id)).getByTitle('Tags und Pause'));
    const f = await screen.findByRole('dialog', { name });
    return { ...r, t, f };
  }

  it('der Name öffnet das Fenster (Titel = Name) mit den Tags bei diesem Dienst und der Pause in der Dienstgruppe', async () => {
    const { f } = await fensterFuer(8, 'Ben Test', { musik: { tags: [BEGLEITUNG, LEITUNG] } });
    expect(within(f).getByText('Tags bei Gesang')).toBeTruthy();
    expect(within(f).getByText('Pause in Musik')).toBeTruthy();
    expect(within(f).getByRole('checkbox', { name: /Begleitung/ })).toHaveProperty(
      'checked',
      false,
    );
    expect(within(f).getByRole('button', { name: 'Keine' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    // Der erklärende Satz.
    expect(f.textContent).toContain('keine Erinnerung');
    expect(f.textContent).toContain('Kann nicht');
  });

  it('Tags ankreuzen und speichern: je Person UND Dienst im Speicher, Kürzel erscheint am Bild', async () => {
    const { f, musik, t } = await fensterFuer(8, 'Ben Test', {
      musik: { tags: [BEGLEITUNG, LEITUNG] },
    });
    fireEvent.click(within(f).getByRole('checkbox', { name: /Leitung/ }));
    fireEvent.click(within(f).getByRole('checkbox', { name: /Begleitung/ }));
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ben Test' })).toBeNull());
    const l = gelesen(musik.s.werte);
    // In der Reihenfolge der Tag-Liste, nicht des Anklickens; Schlüssel `<Dienst>|<Person>`.
    expect(l?.tagsVon).toEqual({ '9|8': ['b', 'l'] });
    expect(l?.version).toBe(2);
    await waitFor(() =>
      expect(within(zeileVon(t, 8)).getByTitle('Begleitung, Leitung').textContent).toBe('BL'),
    );
  });

  it('Pause „Bis Datum“: ohne gültiges Datum nicht speicherbar; mit Datum steht es (einschließlich) im Speicher', async () => {
    const { f, musik } = await fensterFuer(8, 'Ben Test');
    fireEvent.click(within(f).getByRole('button', { name: 'Bis Datum' }));
    expect(within(f).getByRole('button', { name: 'Speichern' })).toHaveProperty('disabled', true);
    fireEvent.change(within(f).getByLabelText(/bis einschließlich/), {
      target: { value: '2027-01-31' },
    });
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(gelesen(musik.s.werte)?.pause).toEqual({ '8': { bis: '2027-01-31' } }),
    );
    // Eine Pause über den ganzen Zeitraum: Ben rückt nach unten, blass.
    expect(screen.queryByRole('dialog', { name: 'Ben Test' })).toBeNull();
  });

  it('Pause „Ohne Ende“ → Ben steht unten unter „In Pause …“; „Keine“ holt ihn zurück', async () => {
    const { f, musik, t } = await fensterFuer(8, 'Ben Test');
    fireEvent.click(within(f).getByRole('button', { name: 'Ohne Ende' }));
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(gelesen(musik.s.werte)?.pause).toEqual({ '8': {} }));
    await waitFor(() => expect(zeileVon(t, 8).className).toMatch(/ruhend/));
    expect(t.textContent).toContain('In Pause oder ganz abwesend');
    // Wer pausiert, hat keinen Griff – sein Name öffnet aber das Fenster, um die Pause zu beenden.
    expect(within(zeileVon(t, 8)).queryByLabelText('Ben Test verschieben')).toBeNull();
    fireEvent.click(within(zeileVon(t, 8)).getByTitle('Tags und Pause'));
    const f2 = await screen.findByRole('dialog', { name: 'Ben Test' });
    expect(within(f2).getByRole('button', { name: 'Ohne Ende' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(within(f2).getByRole('button', { name: 'Keine' }));
    fireEvent.click(within(f2).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(gelesen(musik.s.werte)?.pause).toEqual({}));
    await waitFor(() => expect(zeileVon(t, 8).className).not.toMatch(/ruhend/));
  });

  it('ohne Tags: Hinweis und der Weg zu „Tags verwalten“', async () => {
    const { f } = await fensterFuer(8, 'Ben Test');
    expect(f.textContent).toContain('Für Musik gibt es noch keine Tags.');
    fireEvent.click(within(f).getByRole('button', { name: 'Tags verwalten …' }));
    expect(await screen.findByRole('dialog', { name: 'Tags verwalten' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Ben Test' })).toBeNull();
  });

  it('Konflikt (ein anderer Planer war schneller): Hinweis, das Fenster bleibt mit der Eingabe offen, der neue Stand ist geladen', async () => {
    // Die Seite startete mit Version 1, im Speicher steht inzwischen Version 2 mit anderer Reihenfolge.
    const { f, musik, t } = await fensterFuer(8, 'Ben Test', {
      musik: { version: 2, reihe: [11, 8, 5], tags: [BEGLEITUNG] },
      geladenMusik: { version: 1, reihe: [5], tags: [BEGLEITUNG] },
    });
    fireEvent.click(within(f).getByRole('checkbox', { name: /Begleitung/ }));
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    expect((await within(f).findByRole('alert')).textContent).toContain('Ein anderer Planer');
    // Nichts überschrieben …
    expect(gelesen(musik.s.werte)?.version).toBe(2);
    expect(musik.s.schreibvorgaenge).toEqual([]);
    // … die Eingabe bleibt …
    expect(screen.getByRole('dialog', { name: 'Ben Test' })).toBe(f);
    expect(within(f).getByRole('checkbox', { name: /Begleitung/ })).toHaveProperty('checked', true);
    // … und das Raster zeigt jetzt den Stand des anderen Planers (Carla, Ben, Anna).
    await waitFor(() => expect(reihenfolge(t)).toEqual([11, 8, 5]));
    // Ein zweiter Versuch auf dem neuen Stand geht durch.
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(gelesen(musik.s.werte)?.tagsVon).toEqual({ '9|8': ['b'] }));
    expect(gelesen(musik.s.werte)?.version).toBe(3);
  });

  it('vorübergehender Fehler (503): Hinweis, Fenster und Eingabe bleiben, nichts wird übernommen', async () => {
    const { f, musik, t } = await fensterFuer(8, 'Ben Test', { musik: { tags: [BEGLEITUNG] } });
    musik.s.schreibenWirft = new Fehler(503);
    fireEvent.click(within(f).getByRole('checkbox', { name: /Begleitung/ }));
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    expect((await within(f).findByRole('alert')).textContent).toContain(
      'ChurchTools antwortet gerade nicht',
    );
    expect(within(f).getByRole('checkbox', { name: /Begleitung/ })).toHaveProperty('checked', true);
    // Das Raster zeigt nichts, was nicht bestätigt ist.
    expect(within(zeileVon(t, 8)).queryByTitle('Begleitung')).toBeNull();
    expect(gelesen(musik.s.werte)?.tagsVon).toEqual({});
    // Nur ein Versuch (nie automatisch wiederholt).
    expect(musik.s.schreibvorgaenge).toHaveLength(1);
  });

  it('ein Tipp neben das Fenster verwirft nichts, was schon angekreuzt ist', async () => {
    const { f } = await fensterFuer(8, 'Ben Test', { musik: { tags: [BEGLEITUNG] } });
    fireEvent.click(within(f).getByRole('checkbox', { name: /Begleitung/ }));
    fireEvent.click(f.parentElement as HTMLElement);
    expect(screen.queryByRole('dialog', { name: 'Ben Test' })).not.toBeNull();
  });
});

describe('„Tags verwalten“ (PL-2)', () => {
  async function tagsFenster(o: Parameters<typeof aufbauen>[0] = {}) {
    const r = aufbauen(o);
    const t = await raster();
    await waitFor(() => expect(mehrEintragOder('Liste bearbeiten')).not.toBeNull());
    await modusAn();
    fireEvent.click(
      within(screen.getByRole('status', { name: 'Liste bearbeiten' })).getByRole('button', {
        name: 'Tags verwalten',
      }),
    );
    const f = await screen.findByRole('dialog', { name: 'Tags verwalten' });
    return { ...r, t, f };
  }

  it('die Dienstgruppe wählt man nur unter denen, die man ändern darf', async () => {
    const { f } = await tagsFenster({ stand: { 3: 'bereit', 4: 'bereit' } });
    const wahl = within(f).getByRole('group', { name: 'Dienstgruppe' });
    expect(
      within(wahl)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Technik', 'Musik']);
    cleanup();
    const { f: f2 } = await tagsFenster({ stand: { 3: 'nur-lesen', 4: 'bereit' } });
    // Nur eine bearbeitbare Gruppe: keine Wahl, sondern ihr Name.
    expect(within(f2).queryByRole('group', { name: 'Dienstgruppe' })).toBeNull();
    expect(within(f2).getByText('Musik')).toBeTruthy();
  });

  it('anlegen: Name und Kürzel (großgeschrieben, höchstens 2 Zeichen) → im Speicher, am Bild erst, wenn eine Person ihn hat', async () => {
    const { f, musik } = await tagsFenster({ stand: { 3: 'nur-lesen', 4: 'bereit' } });
    fireEvent.click(within(f).getByRole('button', { name: 'Tag' }));
    fireEvent.change(within(f).getByLabelText('Name'), { target: { value: 'Begleitung' } });
    fireEvent.change(within(f).getByLabelText('Kürzel'), { target: { value: 'beg' } });
    expect(within(f).getByLabelText('Kürzel')).toHaveProperty('value', 'BE');
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Tags verwalten' })).toBeNull(),
    );
    expect(gelesen(musik.s.werte)?.tags).toEqual([{ id: 't1', name: 'Begleitung', kuerzel: 'BE' }]);
  });

  it('umbenennen behält die ID und damit die Zuordnung; ein leerer Name wird nicht gespeichert', async () => {
    const { f, musik } = await tagsFenster({
      stand: { 3: 'nur-lesen', 4: 'bereit' },
      musik: { tags: [BEGLEITUNG, LEITUNG], tagsVon: { '9|8': ['b'] } },
    });
    const namen = within(f).getAllByLabelText('Name');
    fireEvent.change(namen[0], { target: { value: 'Begleitung Gesang' } });
    fireEvent.change(namen[1], { target: { value: '   ' } });
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(gelesen(musik.s.werte)?.version).toBe(2));
    const l = gelesen(musik.s.werte);
    expect(l?.tags).toEqual([{ id: 'b', name: 'Begleitung Gesang', kuerzel: 'B' }]);
    expect(l?.tagsVon).toEqual({ '9|8': ['b'] });
  });

  it('löschen nimmt den Tag auch allen Personen weg – der Hinweis steht da, das Kürzel am Bild verschwindet', async () => {
    const { f, musik, t } = await tagsFenster({
      stand: { 3: 'nur-lesen', 4: 'bereit' },
      musik: { tags: [BEGLEITUNG, LEITUNG], tagsVon: { '9|8': ['b', 'l'], '9|11': ['l'] } },
    });
    expect(f.textContent).toContain('Ein gelöschter Tag verschwindet bei allen Personen');
    expect(within(zeileVon(t, 11)).getByTitle('Leitung')).toBeTruthy();
    fireEvent.click(within(f).getByRole('button', { name: 'Tag Leitung löschen' }));
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(gelesen(musik.s.werte)?.tags.map((x) => x.id)).toEqual(['b']));
    expect(gelesen(musik.s.werte)?.tagsVon).toEqual({ '9|8': ['b'] });
    await waitFor(() => expect(within(zeileVon(t, 11)).queryByTitle('Leitung')).toBeNull());
  });

  it('Speichern ohne Änderung schreibt nichts; ein Fehler lässt das Fenster mit der Eingabe offen', async () => {
    const { f, musik, personenliste } = await tagsFenster({
      stand: { 3: 'nur-lesen', 4: 'bereit' },
      musik: { tags: [BEGLEITUNG] },
    });
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Tags verwalten' })).toBeNull(),
    );
    // Gar nicht erst angefragt (nicht erst vom Kern als „schon so gespeichert“ abgefangen).
    expect(personenliste).not.toHaveBeenCalled();
    expect(musik.s.schreibvorgaenge).toEqual([]);
    // Zweiter Anlauf mit Änderung und Serverfehler.
    cleanup();
    const r = await tagsFenster({
      stand: { 3: 'nur-lesen', 4: 'bereit' },
      musik: { tags: [BEGLEITUNG] },
    });
    r.musik.s.schreibenWirft = new Fehler(504);
    fireEvent.change(within(r.f).getByLabelText('Name'), { target: { value: 'Neu' } });
    fireEvent.click(within(r.f).getByRole('button', { name: 'Speichern' }));
    expect((await within(r.f).findByRole('alert')).textContent).toContain('antwortet gerade nicht');
    expect(within(r.f).getByLabelText('Name')).toHaveProperty('value', 'Neu');
  });
});

describe('Ziehen ordnet um (PL-2)', () => {
  it('eine Zeile über eine andere ziehen speichert die neue Reihenfolge der Dienstgruppe – und das Raster zeigt sie', async () => {
    const { musik } = aufbauen({ musik: { reihe: [11, 8, 5] } });
    const t = await raster();
    await waitFor(() => expect(mehrEintragOder('Liste bearbeiten')).not.toBeNull());
    await modusAn();
    await waitFor(() => expect(reihenfolge(t)).toEqual([11, 8, 5]));
    // Anna (unten) wird über Carla (oben) gelegt.
    ziehen.ende?.({ active: { id: '9|5' }, over: { id: '9|11' } });
    await waitFor(() => expect(gelesen(musik.s.werte)?.reihe).toEqual([5, 11, 8]));
    expect(gelesen(musik.s.werte)?.version).toBe(2);
    await waitFor(() => expect(reihenfolge(t)).toEqual([5, 11, 8]));
  });

  it('ohne gespeicherte Reihenfolge entsteht sie aus der heutigen (alphabetischen) Ansicht', async () => {
    const { musik } = aufbauen();
    const t = await raster();
    await waitFor(() => expect(mehrEintragOder('Liste bearbeiten')).not.toBeNull());
    await modusAn();
    await waitFor(() => expect(reihenfolge(t)).toEqual([5, 8, 11])); // Anna, Ben, Carla
    ziehen.ende?.({ active: { id: '9|11' }, over: { id: '9|5' } });
    await waitFor(() => expect(gelesen(musik.s.werte)?.reihe).toEqual([11, 5, 8]));
    await waitFor(() => expect(reihenfolge(t)).toEqual([11, 5, 8]));
  });

  it('die Reihenfolge gilt je Dienstgruppe – eine andere Gruppe bleibt, wie sie ist', async () => {
    const { technik, musik } = aufbauen({ technik: { reihe: [5] } });
    await raster();
    await waitFor(() => expect(mehrEintragOder('Liste bearbeiten')).not.toBeNull());
    await modusAn();
    ziehen.ende?.({ active: { id: '9|11' }, over: { id: '9|5' } });
    await waitFor(() => expect(gelesen(musik.s.werte)?.reihe).toEqual([11, 5, 8]));
    expect(gelesen(technik.s.werte)?.version).toBe(1);
    expect(technik.s.schreibvorgaenge).toEqual([]);
  });

  it('losgelassen ohne Ziel, auf sich selbst oder ohne Recht: nichts wird gespeichert', async () => {
    const { musik, personenliste } = aufbauen({ stand: { 3: 'bereit', 4: 'nur-lesen' } });
    await raster();
    await waitFor(() => expect(mehrEintragOder('Liste bearbeiten')).not.toBeNull());
    await modusAn();
    ziehen.ende?.({ active: { id: '9|5' }, over: null });
    ziehen.ende?.({ active: { id: '9|5' }, over: { id: '9|5' } });
    // Musik darf man nicht ändern, auch wenn jemand dort „loslässt“.
    ziehen.ende?.({ active: { id: '9|5' }, over: { id: '9|11' } });
    expect(personenliste).not.toHaveBeenCalled();
    expect(musik.s.schreibvorgaenge).toEqual([]);
  });

  it('Konflikt beim Ziehen: der Hinweis sagt es ruhig, der Stand des anderen Planers steht da', async () => {
    const { musik } = aufbauen({
      musik: { version: 2, reihe: [8, 11, 5] },
      geladenMusik: { version: 1, reihe: [11, 8, 5] },
    });
    const t = await raster();
    await waitFor(() => expect(mehrEintragOder('Liste bearbeiten')).not.toBeNull());
    await modusAn();
    await waitFor(() => expect(reihenfolge(t)).toEqual([11, 8, 5]));
    ziehen.ende?.({ active: { id: '9|5' }, over: { id: '9|11' } });
    expect((await screen.findByText(/Ein anderer Planer/)).textContent).toContain(
      'Ein anderer Planer',
    );
    expect(musik.s.schreibvorgaenge).toEqual([]);
    await waitFor(() => expect(reihenfolge(t)).toEqual([8, 11, 5]));
  });

  it('vorübergehender Fehler beim Ziehen: Hinweis, die Anzeige bleibt wie bestätigt', async () => {
    const { musik } = aufbauen({ musik: { reihe: [11, 8, 5] } });
    const t = await raster();
    await waitFor(() => expect(mehrEintragOder('Liste bearbeiten')).not.toBeNull());
    await modusAn();
    musik.s.schreibenWirft = new Fehler(504);
    ziehen.ende?.({ active: { id: '9|5' }, over: { id: '9|11' } });
    await waitFor(() => expect(screen.getByText(/antwortet gerade nicht/)).toBeTruthy());
    expect(reihenfolge(t)).toEqual([11, 8, 5]);
    expect(musik.s.schreibvorgaenge).toHaveLength(1);
  });
});
