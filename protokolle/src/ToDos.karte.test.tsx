// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  modusSetzen,
  neueAufgabe,
  statusSetzen,
  teilSetzen,
  type Aufgabe,
} from '@shared/protokolle/aufgaben';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import * as L from './lesen';
import * as M from './mitglieder';
import * as S from './aufgabenSchreiben';
import { ToDos } from './ToDos';
import { gruppiereNach, imFilter, offenesFilter, zustaendigKurz } from './todosFilter.testutil';

/**
 * Karte, Tabelle und Kopfzeile der To-Do-Übersicht (W8b, Entwurf `todos-vorschlaege-v2`). Die Regeln dahinter (Frist in Worten,
 * Fälligkeits-Fächer, „erledigt von“, Schnellfilter) prüfen die Tests in `@shared/protokolle`; hier: dass die Seite sie
 * benutzt und richtig zeigt. Die Breite des Kastens ist eine Attrappe (jsdom hat keine Layout-Breite).
 */
const kasten = vi.hoisted(() => ({ breite: null as number | null }));
vi.mock('./useKastenBreite', async (orig) => ({
  ...(await orig<typeof import('./useKastenBreite')>()),
  useKastenBreite: () => [vi.fn(), kasten.breite] as const,
}));
vi.mock('./lesen', async (orig) => ({
  ...(await orig<typeof import('./lesen')>()),
  ladeUebersicht: vi.fn(),
}));
vi.mock('./mitglieder', () => ({ ladeGruppenMitglieder: vi.fn() }));
vi.mock('./useToDoEinstellungen', async (orig) =>
  (await import('./ohneAbgleich.testutil')).ohneAbgleich(orig),
);
vi.mock('./aufgabenSchreiben', async (orig) => ({
  ...(await orig<typeof import('./aufgabenSchreiben')>()),
  aufgabeAendern: vi.fn(),
}));

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
// Donnerstag, 19.11.2026.
const JETZT = new Date('2026-11-19T10:00:00Z');
const AM = '2026-11-01T08:00:00Z';
const aufgabe = (text: string, gruppe: number, t: Partial<Aufgabe> = {}): Aufgabe => ({
  ...neueAufgabe({ id: text, gruppe, sitzung: null, text, wer: [1], von: 1, am: AM }),
  ...t,
});
const jeder = (text: string, wer = [1, 23, 7]): Aufgabe =>
  teilSetzen(
    modusSetzen(aufgabe(text, 11, { wer }), true, 1, AM),
    23,
    true,
    23,
    '2026-11-18T08:00:00Z',
  );

const aufgaben = (lt: Aufgabe[], jg: Aufgabe[] = []) =>
  vi.mocked(L.ladeUebersicht).mockResolvedValue(
    [
      [LT, lt],
      [JG, jg],
    ].map(([gruppe, liste]) => ({
      gruppe: gruppe as ProtokollGruppe,
      sitzungen: {
        kommend: [],
        protokolle: [],
        teile: [],
        kalender: 4,
        treffenNichtFreigegeben: false,
        punkte: 'vorschlagen' as const,
      },
      aufgaben: liste as Aufgabe[],
    })),
  );
const zeige = () =>
  render(
    <ToDos
      modul={24}
      ich={{ person: 1, name: 'Alwin' }}
      gruppen={[LT, JG]}
      schreibbar={[60, 62]}
      onSitzung={vi.fn()}
    />,
  );
const zeile = (t: string) => screen.getByText(t).closest('li')!;
const bereiche = () =>
  within(screen.getByRole('region', { name: 'To-Dos' }))
    .queryAllByRole('group')
    .map((g) => g.getAttribute('aria-label'));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  kasten.breite = null;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(JETZT);
  vi.mocked(M.ladeGruppenMitglieder).mockImplementation((g) =>
    Promise.resolve(
      g === 11
        ? [
            { id: 1, name: 'Alwin Friesen', bild: null, initialen: 'AF' },
            { id: 23, name: 'Johann Becker', bild: null, initialen: 'JB' },
            { id: 7, name: 'Maria Dück', bild: null, initialen: 'MD' },
          ]
        : 'verborgen',
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Karte (W8b)', () => {
  it('Frist in Worten: heute, morgen, Wochentag, Datum, „seit …“ – das Kästchen trägt die Farbe', async () => {
    aufgaben([
      aufgabe('Heute dran', 11, { bis: '2026-11-19' }),
      aufgabe('Morgen dran', 11, { bis: '2026-11-20' }),
      aufgabe('Am Samstag', 11, { bis: '2026-11-21' }),
      aufgabe('Später', 11, { bis: '2026-11-29' }),
      aufgabe('Zu spät', 11, { bis: '2026-10-20' }),
    ]);
    zeige();
    await screen.findByText('Heute dran');
    const kaestchen = (t: string, wort: string) => within(zeile(t)).getByText(wort);
    expect(kaestchen('Heute dran', 'heute').className).toMatch(/bald/);
    expect(kaestchen('Morgen dran', 'morgen').className).toMatch(/bald/);
    expect(kaestchen('Am Samstag', 'Samstag').title).toBe('Sa, 21.11.2026');
    expect(kaestchen('Später', '29.11.').className).not.toMatch(/bald|ueberfaellig/);
    expect(kaestchen('Zu spät', 'seit 20.10.').className).toMatch(/ueberfaellig/);
  });

  it('Gruppe: nur wenn mehrere Gruppen im Spiel sind', async () => {
    aufgaben([aufgabe('Eins', 11)], [aufgabe('Zwei', 194)]);
    zeige();
    await screen.findByText('Eins');
    expect(within(zeile('Eins')).getByText('Leitungsteam')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Filter' })).getByLabelText('Jugend'),
    );
    expect(screen.queryByText('Zwei')).toBeNull();
    expect(within(zeile('Eins')).queryByText('Leitungsteam')).toBeNull();
  });

  it('Schild „in Arbeit“: in der Liste an der Karte; im Board nicht in der Spalte „In Arbeit“, nach Person schon', async () => {
    aufgaben([aufgabe('Wird gemacht', 11, { status: 'arbeit' })]);
    zeige();
    await screen.findByText('Wird gemacht');
    expect(within(zeile('Wird gemacht')).getByText('in Arbeit')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Board' }));
    expect(within(zeile('Wird gemacht')).queryByText('in Arbeit')).toBeNull();
    gruppiereNach('Person');
    expect(within(zeile('Wird gemacht')).getByText('in Arbeit')).toBeTruthy();
  });

  it('„Jeder für sich“: ☑ 1/3 klappt auf, wer fertig ist (Name, ✓ Datum / offen) – und wieder zu; kein Schild „in Arbeit“', async () => {
    aufgaben([jeder('Abwesenheiten eintragen')]);
    zeige();
    await screen.findByText('Abwesenheiten eintragen');
    const z = within(zeile('Abwesenheiten eintragen'));
    expect(z.queryByText('in Arbeit')).toBeNull();
    const knopf = z.getByRole('button', { name: 'Wer ist fertig? 1 von 3' });
    expect(knopf.textContent).toBe('1/3');
    expect(z.queryByRole('list', { name: 'Wer ist fertig?' })).toBeNull();
    fireEvent.click(knopf);
    expect(knopf.getAttribute('aria-expanded')).toBe('true');
    const liste = z.getByRole('list', { name: 'Wer ist fertig?' });
    // Gesichter tragen Initialen (aria-hidden) vor dem Namen: „AF“, „JB“, „MD“.
    expect(
      within(liste)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['AFduoffen', 'JBJohann✓ 18.11.', 'MDMariaoffen']);
    fireEvent.click(knopf);
    expect(z.queryByRole('list', { name: 'Wer ist fertig?' })).toBeNull();
  });

  it('erledigt: „Erledigt von Johann am 12.11.“ statt Fußzeile, Titel durchgestrichen; „Jeder für sich“ ganz fertig: „Alle fertig am …“', async () => {
    const alle = teilSetzen(
      teilSetzen(jeder('Alle dran'), 1, true, 1, '2026-11-17T08:00:00Z'),
      7,
      true,
      7,
      '2026-11-18T09:00:00Z',
    );
    aufgaben([
      statusSetzen(
        aufgabe('Kasse prüfen', 11, { wer: [23], bis: '2026-11-01' }),
        'erledigt',
        23,
        '2026-11-12T10:00:00Z',
      ),
      alle,
    ]);
    zeige();
    await screen.findByText('Kasse prüfen');
    const z = within(zeile('Kasse prüfen'));
    expect(z.getByText('Erledigt von Johann am 12.11.')).toBeTruthy();
    expect(screen.getByText('Kasse prüfen').className).toMatch(/durch/);
    // Keine Frist-Fußzeile mehr bei Erledigten.
    expect(z.queryByText('01.11.')).toBeNull();
    expect(within(zeile('Alle dran')).getByText('Alle fertig am 18.11.')).toBeTruthy();
  });

  it('erledigt von mir: „Erledigt von dir am …“', async () => {
    aufgaben([statusSetzen(aufgabe('Meins', 11), 'erledigt', 1, '2026-11-18T10:00:00Z')]);
    zeige();
    await screen.findByText('Meins');
    expect(within(zeile('Meins')).getByText('Erledigt von dir am 18.11.')).toBeTruthy();
  });
});

describe('Tabelle am PC (W8b)', () => {
  const zeilen = () => {
    aufgaben(
      [
        aufgabe('Offenes', 11, { bis: '2026-11-21' }),
        aufgabe('Laufendes', 11, { status: 'arbeit' }),
        jeder('Gemeinsames'),
        statusSetzen(
          aufgabe('Fertiges', 11, { wer: [23] }),
          'erledigt',
          23,
          '2026-11-12T10:00:00Z',
        ),
      ],
      [aufgabe('Jugendding', 194, { wer: [] })],
    );
  };
  const kopf = () => screen.queryByText('Überblick');

  it('unter 720 px (und solange die Breite unbekannt ist): Karten, keine Tabelle', async () => {
    zeilen();
    zeige();
    await screen.findByText('Offenes');
    expect(kopf()).toBeNull();
    cleanup();
    kasten.breite = 719;
    zeige();
    await screen.findByText('Offenes');
    expect(kopf()).toBeNull();
  });

  it('ab 720 px die Tabelle: Aufgabe · Fällig · Zuständig · Stand · Überblick – die Gruppe fällt zuerst weg, erst ab 860 px steht sie da', async () => {
    zeilen();
    kasten.breite = 760;
    zeige();
    await screen.findByText('Offenes');
    const spalten = () =>
      ['Aufgabe', 'Gruppe', 'Fällig', 'Zuständig', 'Stand', 'Überblick'].filter((s) =>
        kopf()!.parentElement!.textContent.includes(s),
      );
    expect(spalten()).toEqual(['Aufgabe', 'Fällig', 'Zuständig', 'Stand', 'Überblick']);
    cleanup();
    kasten.breite = 900;
    zeige();
    await screen.findByText('Offenes');
    expect(spalten()).toEqual(['Aufgabe', 'Gruppe', 'Fällig', 'Zuständig', 'Stand', 'Überblick']);
  });

  it('Gruppenspalte nur, wenn mehrere Gruppen im Spiel sind', async () => {
    zeilen();
    kasten.breite = 900;
    zeige();
    await screen.findByText('Offenes');
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Filter' })).getByLabelText('Jugend'),
    );
    expect(kopf()!.parentElement!.textContent).not.toContain('Gruppe');
  });

  it('Stand: offen grau · „in Arbeit“ · „1 von 3 fertig“ · erledigt mit Gesicht und Datum', async () => {
    zeilen();
    kasten.breite = 900;
    zeige();
    await screen.findByText('Offenes');
    expect(zeile('Offenes').textContent).toContain('offen');
    expect(zeile('Offenes').textContent).toContain('Samstag');
    expect(within(zeile('Laufendes')).getByText('in Arbeit')).toBeTruthy();
    expect(within(zeile('Gemeinsames')).getByText('1 von 3 fertig')).toBeTruthy();
    const erledigt = within(zeile('Fertiges')).getByTitle('Erledigt von Johann am 12.11.');
    expect(erledigt.textContent).toBe('JB12.11.');
    // Zuständig: eine Person mit Namen, mehrere nur Gesichter.
    expect(within(zeile('Offenes')).getByText('Alwin')).toBeTruthy();
    expect(within(zeile('Gemeinsames')).queryByText('Alwin')).toBeNull();
  });

  it('☑ 1/3 in der Tabelle klappt unter der Zeile auf, wer fertig ist', async () => {
    zeilen();
    kasten.breite = 900;
    zeige();
    await screen.findByText('Gemeinsames');
    const z = zeile('Gemeinsames');
    fireEvent.click(within(z).getByRole('button', { name: 'Wer ist fertig? 1 von 3' }));
    expect(within(z).getByRole('list', { name: 'Wer ist fertig?' })).toBeTruthy();
  });

  it('Rückgängig steht auch in der Tabellenzeile', async () => {
    zeilen();
    vi.mocked(S.aufgabeAendern).mockImplementation((_o, _id, aendern) =>
      Promise.resolve(aendern(aufgabe('Offenes', 11, { bis: '2026-11-21' }))),
    );
    kasten.breite = 900;
    zeige();
    await screen.findByText('Offenes');
    fireEvent.click(within(zeile('Offenes')).getByRole('button', { name: /Status: offen/ }));
    await waitFor(() =>
      expect(within(zeile('Offenes')).getByRole('button', { name: 'Rückgängig' })).toBeTruthy(),
    );
    // Die Zeile bleibt in „Offen“ an ihrem Platz.
    expect(within(screen.getByRole('group', { name: 'Offen' })).getByText('Offenes')).toBeTruthy();
  });

  it('das Board bleibt Karten, auch bei breitem Kasten', async () => {
    zeilen();
    kasten.breite = 1100;
    zeige();
    await screen.findByText('Offenes');
    fireEvent.click(screen.getByRole('button', { name: 'Board' }));
    expect(kopf()).toBeNull();
  });
});

describe('Werkzeugzeile und Filter (W8b, B6)', () => {
  it('„Nur meine“ ist ein Kurzweg auf den Filter „Zuständig“: blendet „Andere“ und „Noch niemand“ aus, „Ich“ bleibt', async () => {
    aufgaben(
      [
        aufgabe('Meins', 11),
        aufgabe('Fremd', 11, { wer: [23] }),
        aufgabe('Niemand', 11, { wer: [] }),
      ],
      [],
    );
    zeige();
    await screen.findByText('Fremd');
    // Die Pillen „Alle | Meine“ stehen nicht mehr über der Liste – der Kurzweg liegt im Filter.
    expect(screen.queryByRole('group', { name: 'Zuständigkeit' })).toBeNull();
    zustaendigKurz('Nur meine');
    expect(screen.queryByText('Fremd')).toBeNull();
    expect(screen.queryByText('Niemand')).toBeNull();
    expect(screen.getByText('Meins')).toBeTruthy();
    // Derselbe Zustand im Filter – nicht eine zweite Logik daneben.
    const d = imFilter();
    expect(d.getByLabelText<HTMLInputElement>('Ich').checked).toBe(true);
    expect(d.getByLabelText<HTMLInputElement>('Andere').checked).toBe(false);
    expect(d.getByLabelText<HTMLInputElement>('Noch niemand').checked).toBe(false);
    // Die Zahl am Knopf sagt, dass etwas ausgeblendet ist.
    expect(screen.getByRole('button', { name: /Filter, 2 ausgeblendet/ })).toBeTruthy();
    // Im Filter „Andere“ wieder dazunehmen.
    fireEvent.click(d.getByLabelText('Andere'));
    expect(screen.getByText('Fremd')).toBeTruthy();
    // „Alle“ räumt den Filter „Zuständig“ wieder.
    zustaendigKurz('Alle');
    expect(screen.getByText('Niemand')).toBeTruthy();
    expect(d.getByLabelText<HTMLInputElement>('Noch niemand').checked).toBe(true);
    expect(screen.getByRole('button', { name: 'Filter' })).toBeTruthy();
  });

  it('Einteilen „Fälligkeit“: Überfällig · Diese Woche · Später · Ohne Frist · Erledigt', async () => {
    aufgaben([
      aufgabe('A', 11, { bis: '2026-10-20' }),
      aufgabe('B', 11, { bis: '2026-11-21' }),
      aufgabe('C', 11, { bis: '2027-01-15' }),
      aufgabe('D', 11),
      statusSetzen(aufgabe('E', 11), 'erledigt', 1, '2026-11-18T10:00:00Z'),
    ]);
    zeige();
    await screen.findByText('A');
    gruppiereNach('Fälligkeit');
    expect(bereiche()).toEqual(['Überfällig', 'Diese Woche', 'Später', 'Ohne Frist', 'Erledigt']);
    expect(within(screen.getByRole('group', { name: 'Diese Woche' })).getByText('B')).toBeTruthy();
    // Gemerkt wie die anderen Einstellungen.
    cleanup();
    zeige();
    await screen.findByText('A');
    expect(bereiche()[0]).toBe('Überfällig');
  });

  it('im Board gibt es kein „Fälligkeit“ – es zeigt dann die Statusspalten', async () => {
    aufgaben([aufgabe('A', 11, { bis: '2026-10-20' })]);
    zeige();
    await screen.findByText('A');
    gruppiereNach('Fälligkeit');
    fireEvent.click(screen.getByRole('button', { name: 'Board' }));
    expect(
      within(screen.getByRole('region', { name: 'To-Dos als Board' }))
        .getAllByRole('group')
        .map((g) => g.getAttribute('aria-label')),
    ).toEqual(['Offen', 'In Arbeit', 'Erledigt']);
    // Die Wahl heißt im Board „Spalten nach“ und hat keine Fälligkeit – Status ist gewählt.
    const d = offenesFilter();
    expect(d.getByRole('group', { name: 'Spalten nach' })).toBeTruthy();
    expect(d.queryByRole('radio', { name: 'Fälligkeit' })).toBeNull();
    expect(d.getByRole('radio', { name: 'Status' })).toHaveProperty('checked', true);
  });
});
