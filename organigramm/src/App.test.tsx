// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { baumAus, elternAus, type OrgGruppe } from '@shared/organigramm/gruppen';
import { rollenAus } from '@shared/organigramm/mitglieder';
import type { OrgRechte } from '@shared/organigramm/rechte';
import { diensteAus } from '@shared/ct/dienste';
import { App } from './App';
import { ladeStart, type Start } from './start';
import {
  fehlendeNachladen,
  gruppenNachladen,
  ladeMitglieder,
  type MitgliederDaten,
} from './ladeMitglieder';
import { ladeEinsaetze } from './ladeEinsaetze';
import { ladePlan } from './plan';
import { ladeGruppenRechte } from './mitgliedschaft';
import { personenSuchen } from '@ui/ct/personen';
import { heuteImKalender } from '@shared/ct/zeit';
import type { Einsaetze, PersonEinsatz } from '@shared/organigramm/einsaetze';

vi.mock('./start', () => ({ ladeStart: vi.fn() }));
vi.mock('./ladeMitglieder', () => ({
  ladeMitglieder: vi.fn(),
  fehlendeNachladen: vi.fn(),
  neueGruppenNachladen: vi.fn((d: unknown) => Promise.resolve(d)),
  gruppenNachladen: vi.fn((d: unknown) => Promise.resolve(d)),
}));
// Ein nachgebautes ChurchTools für Mitgliedschaften (O6): je Person Rolle/Status/Ende – und die Rechte je Gruppe.
const cm = vi.hoisted(() => {
  type M = { rolleId: number | null; status: string | null; ende: string | null };
  const m = new Map<number, M>();
  const log: string[] = [];
  const rechte = {
    wert: { aufnehmen: false, rolleAendern: false, beenden: false } as
      | { aufnehmen: boolean; rolleAendern: boolean; beenden: boolean }
      | Error,
  };
  return {
    m,
    log,
    rechte,
    zugriff: {
      lesen: (_g: number, p: number) => Promise.resolve(m.has(p) ? { ...m.get(p)! } : null),
      schreiben: (_g: number, p: number, f: Record<string, unknown>) => {
        log.push(`schreiben ${p} ${JSON.stringify(f)}`);
        const alt = m.get(p) ?? { rolleId: null, status: null, ende: null };
        m.set(p, {
          rolleId: 'groupTypeRoleId' in f ? (f.groupTypeRoleId as number) : alt.rolleId,
          status: 'groupMemberStatus' in f ? (f.groupMemberStatus as string) : alt.status,
          ende: 'memberEndDate' in f ? (f.memberEndDate as string | null) : alt.ende,
        });
        return Promise.resolve();
      },
      entfernen: (_g: number, p: number) => {
        log.push(`entfernen ${p}`);
        m.delete(p);
        return Promise.resolve();
      },
      nichtUebernommen: (was: string) => new Error(`nicht übernommen: ${was}`),
    },
  };
});
vi.mock('./mitgliedschaft', () => ({
  mitgliedZugriff: cm.zugriff,
  ladeGruppenRechte: vi.fn(() =>
    cm.rechte.wert instanceof Error
      ? Promise.reject(cm.rechte.wert)
      : Promise.resolve(cm.rechte.wert),
  ),
}));
vi.mock('@ui/ct/personen', () => ({ personenSuchen: vi.fn() }));
// Ein nachgebautes ChurchTools für die Struktur (O5): Obergruppen je Gruppe und ein Protokoll der Aufrufe.
const ct = vi.hoisted(() => {
  const eltern = new Map<number, number[]>();
  const gruppen = new Set<number>();
  const log: string[] = [];
  const panne: { setzen: Error | null } = { setzen: null };
  return {
    eltern,
    gruppen,
    log,
    panne,
    zugriff: {
      obergruppen: (id: number) => Promise.resolve([...(eltern.get(id) ?? [])]),
      setzen: (id: number, e: number) => {
        log.push(`setzen ${id}→${e}`);
        if (panne.setzen) return Promise.reject(panne.setzen);
        eltern.set(id, [...new Set([...(eltern.get(id) ?? []), e])]);
        return Promise.resolve();
      },
      loesen: (id: number, e: number) => {
        log.push(`loesen ${id}→${e}`);
        eltern.set(
          id,
          (eltern.get(id) ?? []).filter((x) => x !== e),
        );
        return Promise.resolve();
      },
      anlegen: (d: { name: string; typId: number; statusId: number; elternId: number }) => {
        log.push(`anlegen ${d.name} Typ ${d.typId} Status ${d.statusId} unter ${d.elternId}`);
        gruppen.add(300);
        eltern.set(300, [d.elternId]);
        return Promise.resolve(300);
      },
      gibtEs: (id: number) => Promise.resolve(gruppen.has(id)),
      loeschen: (id: number) => {
        log.push(`loeschen ${id}`);
        gruppen.delete(id);
        return Promise.resolve();
      },
      nichtUebernommen: (was: string) => new Error(`nicht übernommen: ${was}`),
    },
  };
});
vi.mock('./struktur', () => ({
  strukturZugriff: ct.zugriff,
  ladeAktivStatus: () => Promise.resolve(1),
}));
vi.mock('./ladeEinsaetze', () => ({ ladeEinsaetze: vi.fn() }));
// Der Plan (O7) – hier nur, ob der Reiter da ist; die Bedienung prüft NeueGliederung.test.tsx.
vi.mock('./plan', () => ({
  ladePlan: vi.fn(() => Promise.resolve({ ok: true, daten: null })),
  speicherePlan: vi.fn(),
  verwerfePlan: vi.fn(),
}));
const laden = vi.mocked(ladeStart);
const mitgliederLaden = vi.mocked(ladeMitglieder);
const nachladen = vi.mocked(fehlendeNachladen);
const einsaetzeLaden = vi.mocked(ladeEinsaetze);

const g = (id: number, name: string, typId = 2, farbe: string | null = null): OrgGruppe => ({
  id,
  name,
  typId,
  statusId: 1,
  farbe,
});
// Gottesdienst (10) → Technik (7) → Stream (12); Café (47); Verteiler „Infos“ (34, Typ 9)
const GRUPPEN = [
  g(10, 'Gottesdienst'),
  g(7, 'Technik'),
  g(12, 'Stream', 2, 'gray'),
  g(47, 'Café'),
  g(34, 'Infos', 9),
];
const ELTERN = elternAus([
  { groupId: 10, children: [7] },
  { groupId: 7, children: [12] },
]);

/** Rechte ohne alles – Tests setzen nur, was sie brauchen (EINE Stelle, wenn ein Recht dazukommt). */
const rechte = (x: Partial<OrgRechte> = {}): OrgRechte => ({
  gruppenVerwalten: false,
  anlegbareTypen: [],
  bearbeitbareGruppen: [],
  bearbeitbareTypen: [],
  mitgliederAlle: false,
  mitgliederGruppen: [],
  mitgliederTypen: [],
  ...x,
});

function start(extra: Partial<Start> = {}): Start {
  return {
    ichId: 1,
    vorname: 'Alwin',
    gemeinde: 'ECG',
    gruppen: GRUPPEN,
    baum: baumAus(GRUPPEN, ELTERN),
    eltern: ELTERN,
    typFarben: new Map([
      [2, 'lime'],
      [9, 'teal'],
    ]),
    typNamen: new Map([
      [2, 'Dienst'],
      [9, 'Verteiler'],
    ]),
    rollen: rollenAus([
      // Rollen der Dienst-Gruppen (Typ 2), wie gemessen – Mitarbeiter ist die Standardrolle
      { id: 15, name: 'Mitarbeiter', isLeader: false, sortKey: 0, groupTypeId: 2, isDefault: true },
      { id: 16, name: 'Leiter', isLeader: true, sortKey: 1, groupTypeId: 2 },
      { id: 17, name: 'Co-Leiter', isLeader: true, sortKey: 2, groupTypeId: 2 },
    ]),
    dienste: diensteAus([{ id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [7] }]),
    rechte: rechte({ gruppenVerwalten: true }),
    geleitet: [],
    ...extra,
  };
}

const p = (id: number, name: string) => [id, { id, name, bild: null, initialen: name[0] }] as const;
const MITGLIEDER: MitgliederDaten = {
  je: new Map([
    [
      10,
      {
        art: 'sichtbar',
        mitglieder: [
          { personId: 2, rolleId: 15 },
          { personId: 1, rolleId: 16 },
        ],
        angefragt: [],
      },
    ],
    [
      7,
      {
        art: 'sichtbar',
        mitglieder: [
          { personId: 3, rolleId: 15 },
          { personId: 4, rolleId: 17 },
          { personId: 1, rolleId: 16 },
        ],
        angefragt: [],
      },
    ],
    [12, { art: 'verborgen' }],
    [47, { art: 'fehler' }],
    [34, { art: 'sichtbar', mitglieder: [], angefragt: [{ personId: 5, rolleId: 15 }] }],
  ]),
  personen: new Map([
    p(1, 'Alwin Friesen'),
    p(2, 'Bea Berg'),
    p(3, 'Carl Clau'),
    p(4, 'Dora Dorn'),
    p(5, 'Emil Ernst'),
  ]),
};

const zeile = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

const e = (vergangen: number, kommend = 0): PersonEinsatz => ({
  vergangen,
  kommend,
  letzter: '2026-10-18T08:00:00Z',
  jeDienst: new Map([[6, vergangen]]),
});
// Alwin dient fast jede Woche; Carl ist im Dienst-Team Technik, aber ohne Einsatz; Ton hat 3 freie Plätze
const EINSAETZE: Einsaetze = {
  jePerson: new Map([
    [1, e(30, 2)],
    [4, e(2)],
  ]),
  offenJeDienst: new Map([[6, 3]]),
};

beforeEach(() => {
  cm.m.clear();
  cm.m.set(3, { rolleId: 15, status: 'active', ende: null });
  cm.m.set(4, { rolleId: 17, status: 'active', ende: null });
  cm.m.set(1, { rolleId: 16, status: 'active', ende: null });
  cm.log.length = 0;
  cm.rechte.wert = { aufnehmen: false, rolleAendern: false, beenden: false };
  ct.eltern.clear();
  ct.eltern.set(7, [10]);
  ct.eltern.set(12, [7]);
  ct.gruppen.clear();
  ct.log.length = 0;
  ct.panne.setzen = null;
  localStorage.clear();
  window.location.hash = '';
  laden.mockResolvedValue(start());
  mitgliederLaden.mockResolvedValue(MITGLIEDER);
  einsaetzeLaden.mockResolvedValue(EINSAETZE);
});

describe('App des Organigramms (O2)', () => {
  it('Bereiche als Karten, Untergruppen als Zeilen – mit Personen, Leitung und Diensten', async () => {
    render(<App />);
    const gd = within(await screen.findByRole('region', { name: 'Gottesdienst' }));
    // Große Bereiche zuerst (die meisten Gruppen darunter), dann nach Name – nicht einfach alphabetisch
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Gottesdienst',
      'Café',
      'Infos',
    ]);
    // Kopf: Gruppen darunter, Personen im ganzen Bereich (jede einmal), Leitung der Gruppe selbst
    expect(await gd.findByText('1 Gruppe · 4 Personen · Leitung: Alwin Friesen')).toBeTruthy();
    // Technik: Leiter vor Co-Leiter (Reihenfolge aus ChurchTools), Dienst als Schildchen
    expect(gd.getByText('3 Personen · Leitung: Alwin Friesen, Dora Dorn')).toBeTruthy();
    expect(gd.getByText('Ton')).toBeTruthy();
    // Stream: kein Leserecht → bleibt im Baum, ohne Namen
    expect(gd.getByText('Mitglieder nicht sichtbar')).toBeTruthy();
  });

  it('vorübergehender Fehler bei einer Gruppe → dort gesagt und „Erneut versuchen“ lädt nur nach', async () => {
    nachladen.mockResolvedValue(MITGLIEDER);
    render(<App />);
    // Café ist ein Bereich: sein Kopf sagt es selbst (nicht nur der Hinweis oben)
    const cafe = within(await screen.findByRole('region', { name: 'Café' }));
    expect(cafe.getByText('Mitglieder gerade nicht ladbar')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(nachladen).toHaveBeenCalledWith(MITGLIEDER);
    expect(laden).toHaveBeenCalledTimes(1);
  });

  it('Bereich MIT Untergruppen, selbst nicht lesbar → sein Kopf sagt es (nicht nur Zahlen der Untergruppen)', async () => {
    mitgliederLaden.mockResolvedValue({
      ...MITGLIEDER,
      je: new Map([...MITGLIEDER.je, [10, { art: 'verborgen' }]]),
    });
    render(<App />);
    const kopf = within(await screen.findByRole('region', { name: 'Gottesdienst' })).getAllByRole(
      'button',
    )[0];
    expect(kopf.textContent).toContain('1 Gruppe');
    expect(kopf.textContent).toContain('Mitglieder nicht sichtbar');
  });

  it('Gruppentyp ausblenden – samt Merken im Gerät', async () => {
    render(<App />);
    expect(await screen.findByRole('region', { name: 'Infos' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Verteiler/ }));
    expect(screen.queryByRole('region', { name: 'Infos' })).toBeNull();
    expect(localStorage.getItem('organigramm-ausgeblendete-typen')).toBe('[9]');
  });

  it('Gruppenfenster: Rollen in ChurchTools-Reihenfolge, Ober-/Untergruppen zum Weiterklicken, Link nach ChurchTools', async () => {
    render(<App />);
    await screen.findByText('3 Personen · Leitung: Alwin Friesen, Dora Dorn');
    fireEvent.click(zeile('Technik'));
    expect(screen.getByRole('region', { name: 'Leiter' }).textContent).toContain('Alwin Friesen');
    expect(screen.getByRole('region', { name: 'Co-Leiter' }).textContent).toContain('Dora Dorn');
    const titel = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titel.slice(0, 3)).toEqual(['Leiter · 1', 'Co-Leiter · 1', 'Mitarbeiter · 1']);
    // Dienste der Gruppe im Fenster (die Zeile im Baum zeigt „Ton“ ebenfalls)
    expect(screen.getByText('Dienste aus dieser Gruppe').parentElement?.textContent).toContain(
      'Ton',
    );
    expect(
      screen.getByRole('link', { name: 'In ChurchTools öffnen' }).getAttribute('href'),
    ).toMatch(/\/groups\/7\/dashboard$/);
    // weiter zur Untergruppe
    fireEvent.click(screen.getByRole('button', { name: 'Stream' }));
    expect(
      screen.getByText('Die Mitglieder dieser Gruppe darfst du in ChurchTools nicht sehen.'),
    ).toBeTruthy();
  });

  it('solange Mitglieder laden, steht der Baum schon', async () => {
    mitgliederLaden.mockReturnValue(new Promise(() => {}));
    render(<App />);
    expect((await screen.findAllByText('Mitglieder werden geladen …')).length).toBeGreaterThan(0);
  });

  it('abgemeldet beim Laden der Mitglieder → Hinweis statt halbem Baum', async () => {
    mitgliederLaden.mockRejectedValue(new ApiError(401, 'x'));
    render(<App />);
    expect(await screen.findByText(/nicht mehr angemeldet/)).toBeTruthy();
  });

  it('Start scheitert vorübergehend → „Erneut versuchen“ lädt neu', async () => {
    laden.mockRejectedValueOnce(new ApiError(502, 'x')).mockResolvedValueOnce(start());
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByText('Hallo Alwin')).toBeTruthy();
    expect(laden).toHaveBeenCalledTimes(2);
  });
});

describe('O3: offene Plätze, Personen, Hinweise', () => {
  it('offene Plätze als Schildchen an der Gruppe des Dienstes', async () => {
    render(<App />);
    const technik = await screen.findByRole('button', { name: /^Technik/ });
    expect(await within(technik).findByText('3 offen')).toBeTruthy();
  });

  it('Admin: Reiter Organigramm · Personen · Hinweise', async () => {
    render(<App />);
    await screen.findByText('Hallo Alwin');
    expect(screen.getByRole('button', { name: 'Personen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hinweise' })).toBeTruthy();
  });

  it('„Neue Gliederung“ (O7) nur für Gruppen-Admins – Leitung kommt auch über die Adresse nicht hin', async () => {
    window.location.hash = '#gliederung';
    const { unmount } = render(<App />);
    expect(await screen.findByRole('button', { name: 'Plan anlegen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Neue Gliederung' })).toBeTruthy();
    unmount();

    laden.mockResolvedValue(start({ rechte: rechte(), geleitet: [7] }));
    render(<App />);
    await screen.findByRole('button', { name: 'Personen' });
    expect(screen.queryByRole('button', { name: 'Neue Gliederung' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Plan anlegen' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Gottesdienst' })).toBeTruthy();
  });

  it('wer nichts leitet und kein Admin ist: keine Reiter, auch nicht über die Adresse', async () => {
    window.location.hash = '#personen';
    laden.mockResolvedValue(
      start({
        rechte: rechte(),
      }),
    );
    render(<App />);
    await screen.findByRole('region', { name: 'Gottesdienst' });
    expect(screen.queryByRole('button', { name: 'Personen' })).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('Personen: Leitung von Technik sieht nur Technik samt Untergruppen – nicht Gottesdienst (Bea)', async () => {
    laden.mockResolvedValue(
      start({
        geleitet: [7],
        rechte: rechte(),
      }),
    );
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Personen' }));
    await screen.findByRole('table');
    const namen = screen
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.querySelector('td')?.textContent);
    expect(namen).toEqual(['AAlwin Friesen', 'DDora Dorn', 'CCarl Clau']);
  });

  it('Personen-Filter „Fast jede Woche“ und „Ohne Einsatz“ – dieselben Regeln wie die Hinweise', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Personen' }));
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: /Fast jede Woche/ }));
    expect(
      screen
        .getAllByRole('row')
        .slice(1)
        .map((r) => r.querySelector('td')?.textContent),
    ).toEqual(['AAlwin Friesen']);
    fireEvent.click(screen.getByRole('button', { name: /Ohne Einsatz/ }));
    expect(
      screen
        .getAllByRole('row')
        .slice(1)
        .map((r) => r.querySelector('td')?.textContent),
    ).toEqual(['CCarl Clau']);
  });

  it('Personenfenster: Gruppen mit Rolle, Einsätze je Dienst', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Personen' }));
    await screen.findByRole('table');
    fireEvent.click(screen.getAllByRole('button', { name: /Alwin Friesen/ })[0]);
    expect(
      screen.getByText('30 Einsätze in 6 Monaten · 2 eingeteilt in den nächsten 3'),
    ).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Einsätze je Dienst' }).textContent).toContain('Ton');
    expect(screen.getByRole('region', { name: 'Gruppen' }).textContent).toContain(
      'Technik · Leiter',
    );
  });

  it('Hinweise: ohne Leitung, fast jede Woche, ohne Einsatz, offene Anfrage', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Hinweise' }));
    const titel = (await screen.findAllByRole('heading', { level: 3 })).map((h) => h.textContent);
    expect(titel).toEqual([
      '1 Person dient fast jede Woche',
      '1 Person in einem Dienst-Team ohne Einsatz',
      '1 offene Mitgliedsanfrage',
    ]);
    // Klick auf eine Person im Hinweis öffnet ihr Fenster
    fireEvent.click(
      within(screen.getByRole('region', { name: '1 offene Mitgliedsanfrage' })).getByRole(
        'button',
        { name: 'Infos' },
      ),
    );
    expect(screen.getByRole('button', { name: 'Schließen' })).toBeTruthy();
  });

  it('Einsätze gerade nicht ladbar → Personen sagen es, „Erneut versuchen“ lädt nur die Einsätze', async () => {
    einsaetzeLaden.mockRejectedValueOnce(new ApiError(503, 'x')).mockResolvedValueOnce(EINSAETZE);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Personen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    expect(einsaetzeLaden).toHaveBeenCalledTimes(2);
    expect(laden).toHaveBeenCalledTimes(1);
  });

  it('abgemeldet beim Laden der Einsätze → Hinweis für die ganze Seite', async () => {
    einsaetzeLaden.mockRejectedValue(new ApiError(401, 'x'));
    render(<App />);
    expect(await screen.findByText(/nicht mehr angemeldet/)).toBeTruthy();
  });
});

describe('O4: Präsentation', () => {
  const oeffnen = async () => {
    render(<App />);
    const knopf = await screen.findByRole('button', { name: /Präsentieren/ });
    await vi.waitFor(() => expect((knopf as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(knopf);
    // Für Gruppen-Admins liest „Präsentieren“ erst den Plan (O7-4) – die Präsentation kommt danach.
    return screen.findByRole('dialog', { name: 'Präsentation' });
  };
  const wo = (d: HTMLElement) => d.querySelector('[aria-live]')?.textContent;

  it('„Präsentieren“ erst, wenn die Mitglieder geladen sind – auch für alle ohne Leitung', async () => {
    mitgliederLaden.mockReturnValue(new Promise(() => {}));
    laden.mockResolvedValue(
      start({
        rechte: rechte(),
      }),
    );
    render(<App />);
    const knopf = await screen.findByRole('button', { name: /Präsentieren/ });
    expect((knopf as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Übersicht: Bereiche wie im Baum, Summen, Leitung – „gesucht“ nur, wo man alles sieht', async () => {
    const d = await oeffnen();
    expect(within(d).getByRole('heading', { name: 'Unsere Bereiche' })).toBeTruthy();
    expect(within(d).getByText('3 Bereiche · 1 Gruppe · 4 Personen')).toBeTruthy();
    const kacheln = within(d)
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent);
    expect(kacheln).toEqual(['Gottesdienst', 'Café', 'Infos']);
    const kachel = (n: string) => within(d).getByRole('heading', { name: n }).closest('button')!;
    expect(within(kachel('Gottesdienst')).getByText('1 Gruppe · 4 Personen')).toBeTruthy();
    expect(within(kachel('Gottesdienst')).getByText('Alwin Friesen')).toBeTruthy();
    // Café gerade nicht ladbar → nicht „gesucht“, und keine Leitungs-Zeile
    expect(within(kachel('Café')).getByText('Mitglieder nicht sichtbar')).toBeTruthy();
    expect(within(kachel('Café')).queryByText(/gesucht/)).toBeNull();
    expect(within(kachel('Café')).queryByText('Leitung')).toBeNull();
    expect(within(kachel('Infos')).getByText('Leitung')).toBeTruthy();
    // Infos lesbar, aber leer → hier stimmt „gesucht“
    expect(within(kachel('Infos')).getByText('Mitarbeitende gesucht')).toBeTruthy();
    expect(within(kachel('Infos')).getByText('Leitung wird noch gesucht')).toBeTruthy();
    expect(wo(d)).toBe('Übersicht');
  });

  it('Bereich: Gruppen als Spalten, jede Person einmal mit Leitung zuerst, Untergruppen mit Stand', async () => {
    const d = await oeffnen();
    fireEvent.click(within(d).getByRole('button', { name: 'Weiter ›' }));
    expect(wo(d)).toBe('1 von 3 · Gottesdienst');
    expect(within(d).getByRole('heading', { level: 1, name: 'Gottesdienst' })).toBeTruthy();
    const technik = within(d).getByRole('region', { name: 'Technik' });
    const namen = within(technik)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(namen).toEqual(['AAlwin FriesenLeiter', 'DDora DornCo-Leiter', 'CCarl Clau']);
    fireEvent.click(within(technik).getByText('1 Untergruppe'));
    expect(within(technik).getByText('Stream')).toBeTruthy();
    expect(within(technik).getByText('Mitglieder nicht sichtbar')).toBeTruthy();
  });

  it('Tastatur: Pfeile, Bild auf/ab, Pos1, Esc zurück zur Übersicht und dort schließen', async () => {
    const d = await oeffnen();
    const taste = (key: string) => fireEvent.keyDown(window, { key });
    taste('ArrowRight');
    expect(wo(d)).toBe('1 von 3 · Gottesdienst');
    taste('PageDown');
    taste(' ');
    expect(wo(d)).toBe('3 von 3 · Infos');
    taste('ArrowRight'); // am Ende bleibt es stehen
    expect(wo(d)).toBe('3 von 3 · Infos');
    taste('PageUp');
    expect(wo(d)).toBe('2 von 3 · Café');
    taste('Home');
    expect(wo(d)).toBe('Übersicht');
    taste('ArrowLeft'); // vor der Übersicht gibt es nichts
    expect(wo(d)).toBe('Übersicht');
    taste('ArrowRight');
    taste('Escape');
    expect(wo(d)).toBe('Übersicht');
    taste('Escape');
    expect(screen.queryByRole('dialog', { name: 'Präsentation' })).toBeNull();
  });

  it('blendet dieselben Gruppentypen aus wie der Baum', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /^Verteiler/ }));
    const knopf = screen.getByRole('button', { name: /Präsentieren/ });
    await vi.waitFor(() => expect((knopf as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(knopf);
    const d = await screen.findByRole('dialog', { name: 'Präsentation' });
    expect(within(d).getByText('2 Bereiche · 1 Gruppe · 4 Personen')).toBeTruthy();
    expect(within(d).queryByRole('heading', { name: 'Infos' })).toBeNull();
  });

  it('Vollbild nur, wo der Browser es kann – Knopf und Taste F', async () => {
    const d0 = await oeffnen();
    expect(within(d0).queryByRole('button', { name: /Vollbild/ })).toBeNull();
    fireEvent.click(within(d0).getByRole('button', { name: 'Schließen' }));

    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
    const anfordern = vi.fn(() => Promise.resolve());
    HTMLElement.prototype.requestFullscreen = anfordern;
    try {
      fireEvent.click(screen.getByRole('button', { name: /Präsentieren/ }));
      const d = await screen.findByRole('dialog', { name: 'Präsentation' });
      fireEvent.click(within(d).getByRole('button', { name: 'Vollbild' }));
      expect(anfordern).toHaveBeenCalledTimes(1);
      fireEvent.keyDown(window, { key: 'f' });
      expect(anfordern).toHaveBeenCalledTimes(2);
    } finally {
      Reflect.deleteProperty(document, 'fullscreenEnabled');
      Reflect.deleteProperty(HTMLElement.prototype, 'requestFullscreen');
    }
  });
});

describe('O7-4: Präsentation „Neue Gliederung | Heute“', () => {
  // Plan: Bereich „Gemeinschaft“ neu mit Café darin, Technik heißt „Medien“, „Jugend“ neu und noch leer
  const PLAN = {
    neu: [
      { id: 'n1', name: 'Gemeinschaft', typId: 2, eltern: null },
      { id: 'n2', name: 'Jugend', typId: 2, eltern: null },
    ],
    eltern: { '47': 'n1' },
    namen: { '7': 'Medien' },
    archiv: [],
  };
  const mitPlan = () =>
    vi.mocked(ladePlan).mockResolvedValueOnce({
      ok: true,
      daten: { version: 1, zeit: 'z', von: { personId: 1, name: 'Alwin' }, inhalt: PLAN },
    });
  const oeffnen = async () => {
    render(<App />);
    const knopf = await screen.findByRole('button', { name: /Präsentieren/ });
    await vi.waitFor(() => expect((knopf as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(knopf);
    return screen.findByRole('dialog', { name: 'Präsentation' });
  };

  it('Gruppen-Admin mit Plan: beginnt mit „Neue Gliederung“ – neue Gruppen, neue Namen; „Heute“ zeigt ChurchTools', async () => {
    mitPlan();
    const d = await oeffnen();
    expect(within(d).getByText(/^Neue Gliederung · 4 Bereiche/)).toBeTruthy();
    expect(within(d).getByRole('heading', { name: 'Gemeinschaft' })).toBeTruthy();
    // eine neue, leere Gruppe ist „gesucht“ – nicht „nicht sichtbar“
    const jugend = within(d).getByRole('heading', { name: 'Jugend' }).closest('button')!;
    expect(within(jugend).getByText('Mitarbeitende gesucht')).toBeTruthy();
    expect(within(d).getAllByText('Medien').length).toBeGreaterThan(0);
    expect(within(d).queryByText('Technik')).toBeNull();

    // eine Seite weiter, dann umschalten → zurück zur Übersicht, Stand von heute
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.click(within(d).getByRole('button', { name: 'Heute' }));
    expect(within(d).getByText(/^Heute · 3 Bereiche/)).toBeTruthy();
    expect(within(d).queryByRole('heading', { name: 'Gemeinschaft' })).toBeNull();
    expect(within(d).getAllByText('Technik').length).toBeGreaterThan(0);
    expect(d.querySelector('[aria-live]')?.textContent).toBe('Übersicht');
  });

  it('ohne Plan, ohne Admin-Recht oder wenn der Plan gerade nicht lesbar ist: nur „Heute“, ohne Umschalter', async () => {
    const plan = vi.mocked(ladePlan);
    let d = await oeffnen(); // kein Plan
    expect(within(d).queryByRole('button', { name: 'Neue Gliederung' })).toBeNull();
    cleanup();

    plan.mockClear();
    laden.mockResolvedValue(start({ rechte: rechte() }));
    mitPlan();
    d = await oeffnen();
    expect(within(d).queryByRole('button', { name: 'Neue Gliederung' })).toBeNull();
    expect(within(d).getByText(/^3 Bereiche/)).toBeTruthy();
    expect(plan).not.toHaveBeenCalled();
    plan.mockReset();
    plan.mockImplementation(() => Promise.resolve({ ok: true, daten: null }));
    cleanup();

    laden.mockResolvedValue(start());
    plan.mockRejectedValueOnce(new Error('Netz weg'));
    d = await oeffnen();
    expect(within(d).queryByRole('button', { name: 'Neue Gliederung' })).toBeNull();
    expect(within(d).getByText(/^3 Bereiche/)).toBeTruthy();
  });
});

describe('O5: Gruppen umhängen und anlegen', () => {
  const technikOeffnen = async () => {
    render(<App />);
    await screen.findByText('3 Personen · Leitung: Alwin Friesen, Dora Dorn');
    fireEvent.click(zeile('Technik'));
  };
  const knopf = (name: string | RegExp) => screen.getByRole('button', { name });
  const ziel = (name: string) =>
    within(screen.getByRole('region', { name: /unter …$/ })).getByRole('button', {
      // Am Ende des Namens: „Gottesdienst“ soll nicht auch „Gottesdienst › Technik“ treffen.
      name: new RegExp(`${name}$`),
    });

  it('Gruppen-Admin: Ändern, Lösen, weitere Obergruppe, Untergruppe anlegen', async () => {
    await technikOeffnen();
    expect(knopf('Ändern')).toBeTruthy();
    expect(knopf('Lösen')).toBeTruthy();
    expect(knopf('＋ Weitere Obergruppe')).toBeTruthy();
    expect(knopf('＋ Untergruppe anlegen')).toBeTruthy();
  });

  it('ohne Recht (z. B. nur Leitung): keine Knöpfe zum Ändern', async () => {
    laden.mockResolvedValue(
      start({
        rechte: rechte(),
        geleitet: [7],
      }),
    );
    await technikOeffnen();
    expect(screen.queryByRole('button', { name: 'Ändern' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Untergruppe anlegen/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Weitere Obergruppe/ })).toBeNull();
  });

  it('Umhängen: Ziel ohne Kreis, Bestätigung mit Rechte-Folgen, erst neu dann alt – und Rückgängig im Fenster', async () => {
    await technikOeffnen();
    const vorher = laden.mock.calls.length;
    fireEvent.click(knopf('Ändern'));
    const ziele = within(screen.getByRole('region', { name: /unter …$/ }))
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    // nicht Technik selbst, nicht Stream (Untergruppe → Kreis), nicht Gottesdienst (ist schon Obergruppe)
    expect(ziele).toEqual(['CCafé', 'IInfos']);
    fireEvent.click(ziel('Café'));
    expect(
      screen.getByText('„Technik“ unter „Café“ hängen statt unter „Gottesdienst“?'),
    ).toBeTruthy();
    expect(
      screen.getByText(/Wer in „Café“ ist, sieht danach auch „Technik“ samt Untergruppen/),
    ).toBeTruthy();
    fireEvent.click(knopf('Umhängen'));
    expect(await screen.findByText('„Technik“ hängt jetzt unter „Café“.')).toBeTruthy();
    expect(ct.log).toEqual(['setzen 7→47', 'loesen 7→10']);
    // danach neu geladen
    expect(laden.mock.calls.length).toBe(vorher + 1);

    fireEvent.click(knopf('Rückgängig'));
    expect(await screen.findByText('Rückgängig gemacht.')).toBeTruthy();
    expect(ct.log.slice(2)).toEqual(['setzen 7→10', 'loesen 7→47']);
    expect(ct.eltern.get(7)).toEqual([10]);
  });

  it('Lösen der letzten Obergruppe: „eigener Bereich“ – Rückgängig hängt wieder ein', async () => {
    await technikOeffnen();
    fireEvent.click(knopf('Lösen'));
    expect(screen.getByText(/„Technik“ ist danach ein eigener Bereich/)).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Bestätigen' })).getByRole('button', {
        name: 'Lösen',
      }),
    );
    expect(
      await screen.findByText('„Technik“ hängt nicht mehr unter „Gottesdienst“.'),
    ).toBeTruthy();
    expect(ct.eltern.get(7)).toEqual([]);
    fireEvent.click(knopf('Rückgängig'));
    await screen.findByText('Rückgängig gemacht.');
    expect(ct.eltern.get(7)).toEqual([10]);
    // Der nächste Schritt beginnt ohne die alte Meldung
    fireEvent.click(knopf('＋ Weitere Obergruppe'));
    expect(screen.queryByText('Rückgängig gemacht.')).toBeNull();
  });

  it('weitere Obergruppe dazu; Rückgängig löst sie wieder', async () => {
    await technikOeffnen();
    fireEvent.click(knopf('＋ Weitere Obergruppe'));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Gruppe suchen' }), {
      target: { value: 'caf' },
    });
    fireEvent.click(ziel('Café'));
    fireEvent.click(knopf('Hinzufügen'));
    expect(await screen.findByText('„Technik“ hängt jetzt auch unter „Café“.')).toBeTruthy();
    expect(ct.eltern.get(7)).toEqual([10, 47]);
    fireEvent.click(knopf('Rückgängig'));
    await screen.findByText('Rückgängig gemacht.');
    expect(ct.eltern.get(7)).toEqual([10]);
  });

  it('Untergruppe anlegen: Name nötig; Typ der Obergruppe, Status „aktiv“; Rückgängig löscht sie wieder', async () => {
    await technikOeffnen();
    fireEvent.click(knopf('＋ Untergruppe anlegen'));
    fireEvent.click(knopf('Anlegen'));
    expect(screen.getByText('Bitte einen Namen eingeben.')).toBeTruthy();
    expect(ct.log).toEqual([]);
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Gruppentyp' }).value).toBe('2');
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: ' Kamera ' },
    });
    fireEvent.click(knopf('Anlegen'));
    expect(await screen.findByText('„Kamera“ ist angelegt.')).toBeTruthy();
    expect(ct.log).toEqual(['anlegen Kamera Typ 2 Status 1 unter 7']);
    fireEvent.click(knopf('Rückgängig'));
    await screen.findByText('Rückgängig gemacht.');
    expect(ct.log).toContain('loeschen 300');
  });

  it('ohne Obergruppe: „unter …“ und „Einhängen“ statt „zusätzlich“/„auch“ (Abnahme 23.10.2026)', async () => {
    render(<App />);
    await screen.findByText('3 Personen · Leitung: Alwin Friesen, Dora Dorn');
    fireEvent.click(screen.getByRole('button', { name: /^Café/ }));
    fireEvent.click(knopf('＋ Unter eine Gruppe hängen'));
    expect(screen.getByRole('region', { name: '„Café“ unter …' })).toBeTruthy();
    fireEvent.click(ziel('Gottesdienst'));
    expect(screen.getByText('„Café“ unter „Gottesdienst“ hängen?')).toBeTruthy();
    fireEvent.click(knopf('Einhängen'));
    expect(await screen.findByText('„Café“ hängt jetzt unter „Gottesdienst“.')).toBeTruthy();
  });

  it('neue Obergruppe liegt unter der alten → „sieht es weiterhin“ statt „nicht mehr“ (Abnahme 23.10.2026)', async () => {
    // Infos (34) hängt unter Gottesdienst (10); Technik (7) liegt ebenfalls unter Gottesdienst
    const eltern = elternAus([
      { groupId: 10, children: [7, 34] },
      { groupId: 7, children: [12] },
    ]);
    laden.mockResolvedValue(start({ eltern, baum: baumAus(GRUPPEN, eltern) }));
    ct.eltern.set(34, [10]);
    render(<App />);
    await screen.findByText('3 Personen · Leitung: Alwin Friesen, Dora Dorn');
    fireEvent.click(zeile('Infos'));
    fireEvent.click(knopf('Ändern'));
    fireEvent.click(ziel('Technik'));
    expect(
      screen.getByText(/wer in „Gottesdienst“ ist, sieht es weiterhin – „Technik“ liegt darunter/),
    ).toBeTruthy();
    expect(screen.queryByText(/sieht es nicht mehr/)).toBeNull();
  });

  it('lösen, aber eine andere Obergruppe darunter bleibt → „sieht weiterhin“, kein „eigener Bereich“', async () => {
    // Infos (34) hängt unter Gottesdienst (10) UND Technik (7, liegt unter Gottesdienst)
    const eltern = elternAus([
      { groupId: 10, children: [7, 34] },
      { groupId: 7, children: [12, 34] },
    ]);
    laden.mockResolvedValue(start({ eltern, baum: baumAus(GRUPPEN, eltern) }));
    render(<App />);
    await screen.findByText('3 Personen · Leitung: Alwin Friesen, Dora Dorn');
    fireEvent.click(screen.getAllByRole('button', { name: /^Infos/ })[0]);
    // der „Lösen“-Knopf neben „Gottesdienst“ (nicht neben „Technik“)
    const neben = screen
      .getAllByRole('button', { name: /Gottesdienst$/ })
      .map((b) => b.parentElement!)
      .find((span) => within(span).queryByRole('button', { name: 'Lösen' }))!;
    fireEvent.click(within(neben).getByRole('button', { name: 'Lösen' }));
    const frage = screen.getByRole('region', { name: 'Bestätigen' }).textContent;
    expect(frage).toContain('„Infos“ von „Gottesdienst“ lösen?');
    expect(frage).toContain('Wer in „Gottesdienst“ ist, sieht „Infos“ weiterhin');
    expect(frage).not.toContain('eigener Bereich');
  });

  it('eine unsichtbare Obergruppe bleibt → Lösen der sichtbaren macht KEINEN eigenen Bereich', async () => {
    // Technik (7) hängt unter Gottesdienst (10) und einer Gruppe 99, die man nicht sehen darf
    const eltern = new Map(ELTERN).set(7, [10, 99]);
    laden.mockResolvedValue(start({ eltern }));
    await technikOeffnen();
    fireEvent.click(knopf('Lösen'));
    expect(screen.getByRole('region', { name: 'Bestätigen' }).textContent).not.toContain(
      'eigener Bereich',
    );
  });

  it('ChurchTools lehnt ab → Meldung, kein Rückgängig; der Baum wird trotzdem neu gelesen', async () => {
    await technikOeffnen();
    const vorher = laden.mock.calls.length;
    ct.panne.setzen = new ApiError(400, 'Das würde eine zyklische Abhängigkeit erzeugen.');
    fireEvent.click(knopf('Ändern'));
    fireEvent.click(ziel('Café'));
    fireEvent.click(knopf('Umhängen'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeNull();
    expect(laden.mock.calls.length).toBe(vorher + 1);
    expect(ct.eltern.get(7)).toEqual([10]);
  });

  it('gespeichert, aber der Baum lädt gerade nicht neu → sagen, nicht abmelden', async () => {
    await technikOeffnen();
    laden.mockRejectedValueOnce(new ApiError(503, 'antwortet nicht'));
    fireEvent.click(knopf('Ändern'));
    fireEvent.click(ziel('Café'));
    fireEvent.click(knopf('Umhängen'));
    expect(await screen.findByText(/ließ sich gerade nicht neu laden/)).toBeTruthy();
    // Die Seite steht noch (kein Fehler für alles), und Rückgängig ist da
    expect(knopf('Rückgängig')).toBeTruthy();
  });
});

describe('O6: Leitung und Mitglieder', () => {
  const technikOeffnen = async () => {
    render(<App />);
    await screen.findByText('3 Personen · Leitung: Alwin Friesen, Dora Dorn');
    fireEvent.click(zeile('Technik'));
  };
  const knopf = (name: string | RegExp) => screen.getByRole('button', { name });
  const suche = vi.mocked(personenSuchen);
  const nurLeitung = () => laden.mockResolvedValue(start({ rechte: rechte(), geleitet: [7] }));

  it('Gruppen-Admin: Rolle und Austragen an jeder Person, „＋ Person aufnehmen“ – ohne Rechte je Gruppe zu laden', async () => {
    await technikOeffnen();
    expect(knopf('Rolle von Carl Clau')).toBeTruthy();
    expect(knopf('Carl Clau austragen')).toBeTruthy();
    expect(knopf('＋ Person aufnehmen')).toBeTruthy();
    expect(vi.mocked(ladeGruppenRechte)).not.toHaveBeenCalled();
  });

  it('Leitung (Rechte je Gruppe wie gemessen): aufnehmen und Rolle ja, austragen nein', async () => {
    nurLeitung();
    cm.rechte.wert = { aufnehmen: true, rolleAendern: true, beenden: false };
    await technikOeffnen();
    expect(await screen.findByRole('button', { name: '＋ Person aufnehmen' })).toBeTruthy();
    expect(knopf('Rolle von Carl Clau')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Carl Clau austragen' })).toBeNull();
    expect(vi.mocked(ladeGruppenRechte)).toHaveBeenCalledWith(7);
  });

  it('nur Mitglied: keine Knöpfe; Rechte nicht ladbar → Hinweis, Knöpfe bleiben zu', async () => {
    nurLeitung();
    await technikOeffnen();
    await vi.waitFor(() => expect(vi.mocked(ladeGruppenRechte)).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /Person aufnehmen/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Rolle von/ })).toBeNull();
    cleanup();
    nurLeitung();
    cm.rechte.wert = new Error('antwortet nicht');
    await technikOeffnen();
    expect(
      await screen.findByText(/Rechte für diese Gruppe ließen sich gerade nicht laden/),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Person aufnehmen/ })).toBeNull();
  });

  it('aufnehmen: Suche, „schon dabei“ gesperrt, Standardrolle, nachgelesen – Rückgängig löscht die neue Mitgliedschaft', async () => {
    suche.mockResolvedValue([
      { personId: 5, vor: 'Emil', nach: 'Ernst', geburtstag: null, email: null },
      { personId: 1, vor: 'Alwin', nach: 'Friesen', geburtstag: null, email: null },
    ]);
    await technikOeffnen();
    fireEvent.click(knopf('＋ Person aufnehmen'));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Name' }), { target: { value: 'Em' } });
    fireEvent.click(knopf('Suchen'));
    const gefunden = await screen.findByRole('list', { name: 'Gefunden' });
    const alwin = within(gefunden).getByRole('button', { name: /Alwin Friesen/ });
    expect((alwin as HTMLButtonElement).disabled).toBe(true);
    expect(alwin.textContent).toContain('schon dabei');
    fireEvent.click(within(gefunden).getByRole('button', { name: /Emil Ernst/ }));
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Rolle' }).value).toBe('15');
    fireEvent.click(knopf('Aufnehmen'));
    expect(
      await screen.findByText('„Emil Ernst“ ist jetzt in „Technik“ (Mitarbeiter).'),
    ).toBeTruthy();
    expect(cm.m.get(5)).toEqual({ rolleId: 15, status: 'active', ende: null });
    // nur DIESE Gruppe neu laden, nicht alle
    expect(vi.mocked(gruppenNachladen)).toHaveBeenLastCalledWith(expect.anything(), [7]);
    fireEvent.click(knopf('Rückgängig'));
    await screen.findByText('Rückgängig gemacht.');
    expect(cm.log.at(-1)).toBe('entfernen 5');
    expect(cm.m.has(5)).toBe(false);
  });

  it('Rolle ändern: Hinweis bei Leitung, nur die Rolle geschickt – Rückgängig setzt die alte', async () => {
    await technikOeffnen();
    fireEvent.click(knopf('Rolle von Carl Clau'));
    const wahl = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Rolle' });
    expect(wahl.value).toBe('15');
    fireEvent.change(wahl, { target: { value: '16' } });
    expect(screen.getByText(/Als Leitung bekommt „Carl Clau“/)).toBeTruthy();
    fireEvent.click(knopf('Ändern'));
    expect(await screen.findByText('„Carl Clau“ ist jetzt Leiter.')).toBeTruthy();
    expect(cm.log).toEqual(['schreiben 3 {"groupTypeRoleId":16}']);
    fireEvent.click(knopf('Rückgängig'));
    await screen.findByText('Rückgängig gemacht.');
    expect(cm.m.get(3)?.rolleId).toBe(15);
  });

  it('austragen = beenden mit Datum heute (nicht löschen) – Rückgängig leert das Ende', async () => {
    await technikOeffnen();
    fireEvent.click(knopf('Carl Clau austragen'));
    expect(screen.getByText(/bleibt sie in der Historie stehen/)).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Bestätigen' })).getByRole('button', {
        name: 'Austragen',
      }),
    );
    expect(await screen.findByText(/„Carl Clau“ ist ausgetragen/)).toBeTruthy();
    expect(cm.m.get(3)?.ende).toBe(heuteImKalender());
    expect(cm.log.some((l) => l.startsWith('entfernen'))).toBe(false);
    fireEvent.click(knopf('Rückgängig'));
    await screen.findByText('Rückgängig gemacht.');
    expect(cm.m.get(3)?.ende).toBeNull();
  });
});
