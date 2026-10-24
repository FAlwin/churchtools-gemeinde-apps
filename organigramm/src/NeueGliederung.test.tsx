// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { KAT, MODUL, speicher } from '@shared/dienstplan/entwuerfe.testutil';
import { Fehler } from '@shared/dienstplan/einteilen.testutil';
import { baumAus, elternAus, type OrgGruppe } from '@shared/organigramm/gruppen';
import { orgRechteAus } from '@shared/organigramm/rechte';
import { PLAN_ART, planAus } from '@shared/organigramm/plan';
import { NeueGliederung } from './NeueGliederung';
import { _vergissModul } from './plan';
import type { Start } from './start';

// Gegen den echten Plan-Speicher (`./plan` + `versionierterWert`) auf dem nachgebauten Speicher der Erweiterung –
// wie `plan.test.ts`; Modul und Kategorie sind gefunden bzw. fehlen.
const h = vi.hoisted(() => ({ kategorie: null as number | null, port: null as object | null }));
vi.mock('@ui/ct/modulPort', () => ({
  versionPortFuer: () => new Proxy({}, { get: (_ziel, k) => Reflect.get(h.port ?? {}, k) }),
}));
vi.mock('@shared/ct/modulDaten', async (original) => ({
  ...(await original<typeof import('@shared/ct/modulDaten')>()),
  modulSuchen: () => Promise.resolve(MODUL),
  kategorieSuchen: () => Promise.resolve(h.kategorie),
  kategorieSicherstellen: () => {
    h.kategorie = KAT;
    return Promise.resolve(KAT);
  },
}));

const g = (id: number, name: string, typId = 2): OrgGruppe => ({
  id,
  name,
  typId,
  statusId: 1,
  farbe: null,
});
// Gottesdienst (10) → Technik (7) → Stream (12); Café (47)
// Café ist eine Kleingruppe (Typ 1): Typ-Vorgaben unterscheiden sich so von „der häufigste“ (Dienst).
const GRUPPEN = [g(10, 'Gottesdienst'), g(7, 'Technik'), g(12, 'Stream'), g(47, 'Café', 1)];
const ELTERN = elternAus([
  { groupId: 10, children: [7] },
  { groupId: 7, children: [12] },
]);
const START = {
  ichId: 1,
  vorname: 'Alwin',
  gemeinde: 'ECG',
  gruppen: GRUPPEN,
  baum: baumAus(GRUPPEN, ELTERN),
  eltern: ELTERN,
  typFarben: new Map([[2, 'lime']]),
  typNamen: new Map([
    [2, 'Dienst'],
    // nach Namen vor „Dienst“ – die Vorgabe für einen neuen Bereich ist aber der häufigste Typ
    [1, 'Arbeitskreis'],
  ]),
  rollen: new Map(),
  dienste: null,
  rechte: orgRechteAus(
    { churchdb: { 'administer groups': true } },
    (s, m) => new Error(`${s} ${m}`),
  ),
  geleitet: [],
} as Start;

let sp: ReturnType<typeof speicher>;
beforeEach(() => {
  sp = speicher();
  h.port = sp.port;
  h.kategorie = null;
  _vergissModul();
});
afterEach(cleanup);

/** Was im Speicher steht – der Plan, wie ChurchTools ihn hat. */
const gespeichert = () => {
  const roh = JSON.parse(sp.s.werte[0].value) as { version: number; inhalt: unknown };
  return { version: roh.version, inhalt: planAus(roh.inhalt) };
};
const zeile = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
const fenster = () => within(screen.getByRole('dialog'));

async function mitPlan() {
  render(<NeueGliederung start={START} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Plan anlegen' }));
  await screen.findByText(/Gespeichert von Alwin/);
}

function umbenennenKlick(gruppe: string, neu: string) {
  fireEvent.click(zeile(gruppe));
  fireEvent.change(fenster().getByRole('textbox', { name: 'Name im Plan' }), {
    target: { value: neu },
  });
  fireEvent.click(fenster().getByRole('button', { name: 'Umbenennen' }));
}
async function umbenennen(gruppe: string, neu: string) {
  umbenennenKlick(gruppe, neu);
  await screen.findByText(`vorher „${gruppe}“`);
}

describe('Reiter „Neue Gliederung“ (O7-2)', () => {
  it('kein Plan → „Plan anlegen“ kopiert heute: gespeichert, nachgelesen, Baum wie heute', async () => {
    await mitPlan();
    expect(gespeichert()).toEqual({
      version: 1,
      inhalt: { neu: [], eltern: {}, namen: {}, archiv: [] },
    });
    const gd = within(screen.getByRole('region', { name: 'Gottesdienst' }));
    expect(gd.getByText('Technik')).toBeTruthy();
    expect(gd.getByText('Stream')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Café' })).toBeTruthy();
  });

  it('umbenennen: Marke und „vorher …“, gespeichert als Änderung gegenüber heute', async () => {
    await mitPlan();
    await umbenennen('Technik', 'Medien');
    expect(within(zeile('Medien')).getByText('umbenannt')).toBeTruthy();
    expect(gespeichert()).toMatchObject({ version: 2, inhalt: { namen: { '7': 'Medien' } } });
  });

  it('neuer Bereich, Café hinein (Ziel mit Suche); „Wie heute“ nimmt es zurück', async () => {
    await mitPlan();
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Bereich' }));
    fireEvent.change(fenster().getByPlaceholderText('Name der neuen Gruppe'), {
      target: { value: 'Gemeinschaft' },
    });
    fireEvent.click(fenster().getByRole('button', { name: 'Im Plan anlegen' }));
    const bereich = await screen.findByRole('region', { name: 'Gemeinschaft' });
    expect(within(bereich).getByText('neu')).toBeTruthy();
    expect(gespeichert().inhalt?.neu).toEqual([
      { id: 'n1', name: 'Gemeinschaft', typId: 2, eltern: null },
    ]);

    fireEvent.click(zeile('Café'));
    fireEvent.click(fenster().getByRole('button', { name: 'Woanders einhängen' }));
    fireEvent.change(fenster().getByRole('searchbox', { name: 'Gruppe suchen' }), {
      target: { value: 'gemein' },
    });
    fireEvent.click(fenster().getByRole('button', { name: /Gemeinschaft/ }));
    await screen.findByText('vorher eigener Bereich');
    expect(
      within(screen.getByRole('region', { name: 'Gemeinschaft' })).getByText('Café'),
    ).toBeTruthy();
    expect(gespeichert().inhalt?.eltern).toEqual({ '47': 'n1' });

    fireEvent.click(zeile('Café'));
    fireEvent.click(fenster().getByRole('button', { name: 'Wie heute' }));
    await screen.findByRole('region', { name: 'Café' });
    expect(gespeichert().inhalt?.eltern).toEqual({});
  });

  it('Einhängen: keine Untergruppe als Ziel (Kreis), „Eigener Bereich“ als Wahl', async () => {
    await mitPlan();
    fireEvent.click(zeile('Technik'));
    fireEvent.click(fenster().getByRole('button', { name: 'Woanders einhängen' }));
    const ziele = fenster()
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    // ohne Technik selbst, Stream (darunter) und Gottesdienst (schon die Obergruppe); vorn die Kachel mit dem Anfangsbuchstaben
    expect(ziele).toEqual(['Eigener Bereich', 'CCafé']);

    // ein Bereich ist schon „eigener Bereich“ – das steht nicht noch einmal zur Wahl
    fireEvent.click(fenster().getAllByRole('button', { name: 'Schließen' })[0]);
    fireEvent.click(zeile('Café'));
    fireEvent.click(fenster().getByRole('button', { name: 'Woanders einhängen' }));
    expect(fenster().queryByRole('button', { name: 'Eigener Bereich' })).toBeNull();
  });

  it('archivieren und doch behalten; eine neue Untergruppe wieder aus dem Plan nehmen', async () => {
    await mitPlan();
    fireEvent.click(zeile('Stream'));
    fireEvent.click(fenster().getByRole('button', { name: 'Im Plan archivieren' }));
    await screen.findByText('wird archiviert');
    expect(gespeichert().inhalt?.archiv).toEqual([12]);
    fireEvent.click(zeile('Stream'));
    fireEvent.click(fenster().getByRole('button', { name: 'Doch behalten' }));
    await vi.waitFor(() => expect(screen.queryByText('wird archiviert')).toBeNull());
    expect(gespeichert().inhalt?.archiv).toEqual([]);

    // Untergruppe im Plan – vorbelegt mit dem Typ der Gruppe (Café: Kleingruppe, nicht der häufigste)
    fireEvent.click(zeile('Café'));
    fireEvent.change(fenster().getByPlaceholderText('Name der neuen Gruppe'), {
      target: { value: 'Kamera' },
    });
    fireEvent.click(fenster().getByRole('button', { name: 'Im Plan anlegen' }));
    await screen.findByText('Kamera');
    expect(gespeichert().inhalt?.neu).toEqual([{ id: 'n1', name: 'Kamera', typId: 1, eltern: 47 }]);
    fireEvent.click(zeile('Kamera'));
    expect(fenster().getByText(/neu im Plan – gibt es in ChurchTools noch nicht/)).toBeTruthy();
    fireEvent.click(fenster().getByRole('button', { name: 'Aus dem Plan nehmen' }));
    await vi.waitFor(() => expect(screen.queryByText('Kamera')).toBeNull());
    expect(gespeichert().inhalt?.neu).toEqual([]);
  });

  it('ein Name ist Pflicht – leer wird nicht gespeichert', async () => {
    await mitPlan();
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Bereich' }));
    fireEvent.click(fenster().getByRole('button', { name: 'Im Plan anlegen' }));
    expect(fenster().getByText('Bitte einen Namen eingeben.')).toBeTruthy();
    expect(sp.s.schreibvorgaenge).toHaveLength(1);
  });

  it('Konflikt: ein anderer speichert gleichzeitig → nichts überschrieben; „Nochmal“ auf dem neuen Stand', async () => {
    await mitPlan();
    // Bea speichert genau zwischen unserem Lesen und Schreiben (ChurchTools nimmt beides an, nachgelesen steht ihres)
    sp.s.vorher = () => {
      sp.s.vorher = null;
      sp.s.werte[0] = {
        ...sp.s.werte[0],
        value: JSON.stringify({
          ...PLAN_ART,
          version: 2,
          zeit: '2026-10-24T10:00:00.000Z',
          von: { personId: 2, name: 'Bea' },
          inhalt: { neu: [], eltern: {}, namen: { '47': 'Café Team' }, archiv: [] },
        }),
      };
    };
    sp.s.verschlucken = true;
    umbenennenKlick('Technik', 'Medien');
    await screen.findByText(/Bea hat den Plan inzwischen geändert/);
    expect(gespeichert().inhalt?.namen).toEqual({ '47': 'Café Team' });
    expect(screen.getByRole('button', { name: /^Café Team/ })).toBeTruthy();

    sp.s.verschlucken = false;
    fireEvent.click(screen.getByRole('button', { name: 'Nochmal auf dem neuen Stand' }));
    await screen.findByText('vorher „Technik“');
    expect(gespeichert()).toMatchObject({
      version: 3,
      inhalt: { namen: { '47': 'Café Team', '7': 'Medien' } },
    });
    expect(screen.queryByText(/inzwischen geändert/)).toBeNull();
  });

  it('ChurchTools antwortet nicht → Hinweis, Plan bleibt; „Nochmal“ speichert', async () => {
    await mitPlan();
    sp.s.schreibenWirft = new Fehler(503);
    fireEvent.click(zeile('Stream'));
    fireEvent.click(fenster().getByRole('button', { name: 'Im Plan archivieren' }));
    await screen.findByText(/ChurchTools antwortet gerade nicht/);
    expect(gespeichert().inhalt?.archiv).toEqual([]);
    sp.s.schreibenWirft = null;
    fireEvent.click(screen.getByRole('button', { name: 'Nochmal auf dem neuen Stand' }));
    await screen.findByText('wird archiviert');
    expect(gespeichert().inhalt?.archiv).toEqual([12]);
  });

  it('inzwischen verworfen → sagen, kein „Nochmal“ (es gibt keinen Plan mehr, auf den es passt)', async () => {
    await mitPlan();
    sp.s.vorher = () => {
      sp.s.vorher = null;
      sp.s.werte.length = 0;
    };
    umbenennenKlick('Technik', 'Medien');
    await screen.findByText(/Der Plan wurde inzwischen verworfen/);
    expect(screen.queryByRole('button', { name: 'Nochmal auf dem neuen Stand' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Plan anlegen' })).toBeTruthy();
  });

  it('kein Recht auf die Kategorie → Hinweis ohne „Nochmal“', async () => {
    await mitPlan();
    sp.s.schreibenWirft = new Fehler(403);
    umbenennenKlick('Technik', 'Medien');
    await screen.findByText(/Rechte für die Kategorie „Plan“/);
    expect(screen.queryByRole('button', { name: 'Nochmal auf dem neuen Stand' })).toBeNull();
  });

  it('Laden scheitert vorübergehend → „Erneut versuchen“ lädt den Plan', async () => {
    h.kategorie = KAT;
    sp.s.lesenWirft = new Fehler(503);
    render(<NeueGliederung start={START} />);
    await screen.findByText(/ChurchTools antwortet gerade nicht/);
    sp.s.lesenWirft = null;
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    await screen.findByRole('button', { name: 'Plan anlegen' });
  });

  it('Plan verwerfen: erst fragen, dann für alle weg – ChurchTools bleibt, wie es ist', async () => {
    await mitPlan();
    fireEvent.click(screen.getByRole('button', { name: 'Plan verwerfen' }));
    expect(fenster().getByText(/ChurchTools bleibt, wie es ist/)).toBeTruthy();
    fireEvent.click(fenster().getByRole('button', { name: 'Verwerfen' }));
    await screen.findByRole('button', { name: 'Plan anlegen' });
    expect(sp.s.werte).toEqual([]);
  });
});
