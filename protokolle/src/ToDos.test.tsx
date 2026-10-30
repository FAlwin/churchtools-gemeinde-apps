// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { neueAufgabe, statusSetzen, type Aufgabe } from '@shared/protokolle/aufgaben';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { geplanterKopf } from '@shared/protokolle/planen';
import * as L from './lesen';
import * as M from './mitglieder';
import * as S from './aufgabenSchreiben';
import { ToDos } from './ToDos';
import { Startseite } from './Startseite';

/** Reiter „To-Dos“ (S7-1) – Lesen und Schreiben sind Attrappen; was sie tun, prüfen `lesen.test.ts` und Co. */
vi.mock('./lesen', async (orig) => ({
  ...(await orig<typeof import('./lesen')>()),
  ladeUebersicht: vi.fn(),
}));
vi.mock('./mitglieder', () => ({ ladeGruppenMitglieder: vi.fn() }));
vi.mock('./aufgabenSchreiben', async (orig) => ({
  ...(await orig<typeof import('./aufgabenSchreiben')>()),
  aufgabeAendern: vi.fn(),
}));

afterEach(cleanup);

const tageZurueck = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
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

const aufgabe = (id: string, gruppe: number, t: Partial<Aufgabe> = {}): Aufgabe => ({
  ...neueAufgabe({ id, gruppe, sitzung: null, text: id, von: 1, am: tageZurueck(40) }),
  ...t,
});
const SITZUNG: Sitzung = {
  schluessel: 'p:s1',
  beginn: '2026-10-14T17:00:00Z',
  titel: 'Leitungssitzung',
  termin: null,
  treffen: null,
  kopf: geplanterKopf(
    { titel: 'Leitungssitzung', beginn: '2026-10-14T17:00:00Z', termin: null, treffen: null },
    's1',
  ),
  anfragen: [],
};
const uebersicht = (lt: Aufgabe[], jg: Aufgabe[] = []): L.GruppenUebersicht[] => [
  {
    gruppe: LT,
    sitzungen: {
      kommend: [SITZUNG],
      protokolle: [],
      teile: [],
      kalender: 4,
      treffenNichtFreigegeben: false,
    },
    aufgaben: lt,
  },
  {
    gruppe: JG,
    sitzungen: {
      kommend: [],
      protokolle: [],
      teile: [],
      kalender: 4,
      treffenNichtFreigegeben: false,
    },
    aufgaben: jg,
  },
];

// Alwin (1) ist Leitung im Leitungsteam (Kategorie 60), in der Jugend nur Mitglied.
const MEINS = aufgabe('Beamer-Angebote einholen', 11, { wer: [1], sitzung: 's1' });
const FREMD_LT = aufgabe('Raum prüfen', 11, { wer: [23] });
const FREMD_JG = aufgabe('Liederliste', 194, { wer: [19] });
const OHNE_JG = aufgabe('Mikrofonständer überlegen', 194);
const ALT = statusSetzen(
  aufgabe('Gesangbücher aussortieren', 11, { wer: [1] }),
  'erledigt',
  1,
  tageZurueck(45),
);
const NEU_ERLEDIGT = statusSetzen(
  aufgabe('Kasse prüfen', 11, { wer: [1] }),
  'erledigt',
  1,
  tageZurueck(3),
);

const zeige = (schreibbar = [60], onSitzung = vi.fn()) => {
  render(
    <ToDos
      modul={24}
      ich={{ person: 1, name: 'Alwin' }}
      gruppen={[LT, JG]}
      schreibbar={schreibbar}
      onSitzung={onSitzung}
    />,
  );
  return onSitzung;
};
const texte = () => screen.queryAllByRole('listitem').map((li) => li.textContent ?? '');
const bereiche = () =>
  within(screen.getByRole('region', { name: 'To-Dos' }))
    .queryAllByRole('group')
    .map((g) => g.getAttribute('aria-label'));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(L.ladeUebersicht).mockResolvedValue(
    uebersicht([MEINS, FREMD_LT, ALT, NEU_ERLEDIGT], [FREMD_JG, OHNE_JG]),
  );
  vi.mocked(M.ladeGruppenMitglieder).mockImplementation((g) =>
    Promise.resolve(
      g === 11
        ? [
            { id: 1, name: 'Alwin Friesen', bild: null, initialen: 'AF' },
            { id: 23, name: 'Johann Becker', bild: null, initialen: 'JB' },
          ]
        : 'verborgen',
    ),
  );
});

describe('ToDos', () => {
  it('Sicht: als Leitung alle To-Dos der Gruppe, als Mitglied nur eigene und die ohne Zuständigen', async () => {
    zeige();
    await screen.findByText('Raum prüfen');
    expect(screen.queryByText('Liederliste')).toBeNull();
    expect(screen.getByText('Mikrofonständer überlegen')).toBeTruthy();
    expect(screen.getByText('Beamer-Angebote einholen')).toBeTruthy();
  });

  it('nach Status eingeteilt; ältere Erledigte erst per Schalter – und der Filter zeigt dafür keine Zahl', async () => {
    zeige();
    await screen.findByText('Raum prüfen');
    expect(bereiche()).toEqual(['Offen', 'Erledigt']);
    expect(screen.queryByText('Gesangbücher aussortieren')).toBeNull();
    expect(screen.getByRole('button', { name: 'Filter' })).toBeTruthy();
    const schalter = screen.getByRole('button', { name: /Ältere erledigte zeigen \(1\)/ });
    fireEvent.click(schalter);
    expect(screen.getByText('Gesangbücher aussortieren')).toBeTruthy();
    expect(schalter.getAttribute('aria-pressed')).toBe('true');
  });

  it('nach Person: ich zuerst, Namen aus den Mitgliedern, „Noch niemand zuständig“ zuletzt – und gemerkt', async () => {
    zeige();
    await screen.findByText('Raum prüfen');
    fireEvent.click(screen.getByRole('button', { name: 'Nach Person' }));
    await waitFor(() =>
      expect(bereiche()).toEqual(['Alwin Friesen (du)', 'Johann Becker', 'Noch niemand zuständig']),
    );
    cleanup();
    zeige();
    await screen.findByText('Raum prüfen');
    expect(bereiche()[0]).toBe('Alwin Friesen (du)');
  });

  it('Filter „Gruppen“: Jugend ausgeblendet → ihre To-Dos fehlen, die Zahl am Filter sagt es', async () => {
    zeige();
    await screen.findByText('Mikrofonständer überlegen');
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Filter' })).getByLabelText('Jugend'),
    );
    expect(screen.queryByText('Mikrofonständer überlegen')).toBeNull();
    expect(screen.getByRole('button', { name: /Filter, 1 ausgeblendet/ })).toBeTruthy();
  });

  it('Status-Marke: antippen schreibt den nächsten Status und zeigt den gespeicherten Stand', async () => {
    vi.mocked(S.aufgabeAendern).mockImplementation((_o, _id, aendern) =>
      Promise.resolve(aendern(FREMD_LT)),
    );
    zeige();
    await screen.findByText('Raum prüfen');
    const zeile = screen.getByText('Raum prüfen').closest('li')!;
    fireEvent.click(within(zeile).getByRole('button', { name: /Status: Offen/ }));
    await waitFor(() => expect(screen.getByRole('group', { name: 'In Arbeit' })).toBeTruthy());
    const [ort, id, aendern] = vi.mocked(S.aufgabeAendern).mock.calls[0];
    expect(ort).toEqual({ modul: 24, kategorie: 61 });
    expect(id).toBe(FREMD_LT.id);
    expect(aendern(FREMD_LT)).toMatchObject({
      status: 'arbeit',
      verlauf: [{}, { art: 'status', von: 1 }],
    });
  });

  it('Status-Marke: scheitert das Schreiben, sagt die Seite es und der Status bleibt', async () => {
    vi.mocked(S.aufgabeAendern).mockRejectedValue(new Error('weg'));
    zeige();
    await screen.findByText('Raum prüfen');
    fireEvent.click(
      within(screen.getByText('Raum prüfen').closest('li')!).getByRole('button', {
        name: /Status: Offen/,
      }),
    );
    expect((await screen.findByRole('alert')).textContent).toMatch(/ChurchTools/);
    expect(screen.queryByRole('group', { name: 'In Arbeit' })).toBeNull();
  });

  it('Status-Marke: To-Do inzwischen weg → genau das wird gesagt (nicht „antwortet gerade nicht“)', async () => {
    vi.mocked(S.aufgabeAendern).mockImplementation((_o, _id, aendern, anlegen) =>
      Promise.resolve().then(() => aendern(anlegen())),
    );
    zeige();
    await screen.findByText('Raum prüfen');
    fireEvent.click(
      within(screen.getByText('Raum prüfen').closest('li')!).getByRole('button', {
        name: /Status: Offen/,
      }),
    );
    expect((await screen.findByRole('alert')).textContent).toMatch(/gibt es nicht mehr/);
  });

  it('Text antippen öffnet das Fenster „To-Do“; „Neues To-Do“ öffnet es leer', async () => {
    zeige();
    fireEvent.click(await screen.findByRole('button', { name: 'Beamer-Angebote einholen' }));
    expect(screen.getByRole('dialog', { name: 'To-Do' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    fireEvent.click(screen.getByRole('button', { name: /Neues To-Do/ }));
    expect(screen.getByRole('dialog', { name: 'Neues To-Do' })).toBeTruthy();
  });

  it('nach dem Speichern im Fenster lädt die Liste neu (ohne „Wird geladen …“)', async () => {
    vi.mocked(S.aufgabeAendern).mockImplementation((_o, _id, aendern) =>
      Promise.resolve(aendern(MEINS)),
    );
    zeige();
    fireEvent.click(await screen.findByRole('button', { name: 'Beamer-Angebote einholen' }));
    fireEvent.change(screen.getByLabelText('Bis'), { target: { value: '2026-12-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(L.ladeUebersicht).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Wird geladen …')).toBeNull();
  });

  it('„Auf Karte anzeigen“: letzte Notiz und Sitzung auf der Karte, die Sitzung führt ins Protokoll', async () => {
    const mitKarte = {
      ...MEINS,
      karte: { notiz: true, sitzung: true },
      verlauf: [
        ...MEINS.verlauf,
        { am: tageZurueck(1), von: 1, art: 'notiz' as const, text: 'Zwei Angebote da' },
      ],
    };
    vi.mocked(L.ladeUebersicht).mockResolvedValue(uebersicht([mitKarte]));
    const onSitzung = zeige();
    await screen.findByText('Beamer-Angebote einholen');
    const zeile = screen.getByText('Beamer-Angebote einholen').closest('li')!;
    expect(zeile.textContent).toMatch(/Notizen.*Zwei Angebote da/);
    fireEvent.click(
      within(zeile).getByRole('button', { name: /Leitungssitzung – im Protokoll zeigen/ }),
    );
    expect(onSitzung).toHaveBeenCalledWith(11, 'p:s1');
  });

  it('ohne „Auf Karte anzeigen“: keine Notiz und keine Sitzung auf der Karte', async () => {
    zeige();
    await screen.findByText('Beamer-Angebote einholen');
    expect(screen.getByText('Beamer-Angebote einholen').closest('li')!.textContent).not.toMatch(
      /Notizen|Aus welcher Sitzung/,
    );
  });

  it('Wer: Namen aus den Mitgliedern, sonst „eine weitere Person“, ohne Zuständige ein Hinweis', async () => {
    vi.mocked(L.ladeUebersicht).mockResolvedValue(
      uebersicht([
        aufgabe('Zwei Leute', 11, { wer: [1, 99] }),
        aufgabe('Extern', 11, { extern: 'Hausmeister Müller' }),
      ]),
    );
    zeige();
    await screen.findByText('Zwei Leute');
    expect(texte().join(' | ')).toMatch(/Zwei Leute.*Alwin, eine weitere Person/);
    expect(texte().join(' | ')).toMatch(/Extern.*Hausmeister Müller/);
  });

  it('Mitgliederliste verborgen: die eigenen To-Dos zeigen trotzdem den eigenen Namen', async () => {
    // Gefunden in der Test-Instanz 30.10.2026: bei Spikes eigenen To-Dos stand „eine weitere Person“.
    vi.mocked(M.ladeGruppenMitglieder).mockResolvedValue('verborgen');
    zeige();
    await screen.findByText('Beamer-Angebote einholen');
    const zeile = screen.getByText('Beamer-Angebote einholen').closest('li')!;
    expect(zeile.textContent).toMatch(/Alwin/);
    expect(zeile.textContent).not.toMatch(/weitere/);
  });

  it('nur Mitglied (nirgends Leitung): Hinweis, was man sieht; Filter ohne „Andere“', async () => {
    zeige([]);
    await screen.findByText(/deine eigenen To-Dos und die, für die noch niemand zuständig ist/);
    expect(screen.queryByText('Raum prüfen')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(
      within(screen.getByRole('dialog', { name: 'Filter' })).queryByLabelText('Andere'),
    ).toBeNull();
  });

  it('Überfällig steht oben und rot', async () => {
    vi.mocked(L.ladeUebersicht).mockResolvedValue(
      uebersicht([aufgabe('Zu spät', 11, { wer: [1], bis: '2020-01-01' }), MEINS]),
    );
    zeige();
    await screen.findByText('Zu spät');
    expect(bereiche()).toEqual(['Überfällig', 'Offen']);
    expect(texte()[0]).toMatch(/überfällig/);
  });
});

describe('Startseite: „Alle anzeigen“', () => {
  it('öffnet den Reiter „To-Dos“', async () => {
    const onAlle = vi.fn();
    render(
      <Startseite
        modul={24}
        ich={1}
        gruppen={[LT]}
        onSitzung={vi.fn()}
        onGruppe={vi.fn()}
        onAlleToDos={onAlle}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Alle To-Dos/ }));
    expect(onAlle).toHaveBeenCalled();
  });
});
