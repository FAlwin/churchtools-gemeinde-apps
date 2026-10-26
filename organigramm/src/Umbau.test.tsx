// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { KAT, MODUL, speicher } from '@shared/dienstplan/entwuerfe.testutil';
import { baumAus, type OrgGruppe } from '@shared/organigramm/gruppen';
import { orgRechteAus } from '@shared/organigramm/rechte';
import { PLAN_ART, planAus, type PlanAenderungen } from '@shared/organigramm/plan';
import { nachbau } from '@shared/organigramm/struktur.testutil';
import { NichtUebernommen } from '@ui/ct/fehler';
import { NeueGliederung } from './NeueGliederung';
import { _vergissModul } from './plan';
import type { Start } from './start';

// Gegen ein nachgebautes ChurchTools (`nachbau`: Obergruppen, Name, Status – wie gemessen) und den echten
// Plan-Speicher auf dem nachgebauten Speicher der Erweiterung (wie NeueGliederung.test.tsx).
const h = vi.hoisted(() => ({
  kategorie: null as number | null,
  port: null as object | null,
  ct: null as unknown as ReturnType<typeof import('@shared/organigramm/struktur.testutil').nachbau>,
}));
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
const ARCHIVIERT = 3;
/** Was ChurchTools liefert: ohne archivierte Gruppen, weder in der Liste noch in der Hierarchie (Messung O7-3). */
const heuteAusCt = () => {
  const sichtbar = [...h.ct.gruppen].filter((id) => h.ct.status.get(id) !== ARCHIVIERT);
  const gruppen: OrgGruppe[] = sichtbar.map((id) => ({
    id,
    name: h.ct.name.get(id) ?? '',
    typId: 2,
    statusId: h.ct.status.get(id) ?? 1,
    farbe: null,
  }));
  const eltern = new Map(
    sichtbar.map((id) => [id, (h.ct.eltern.get(id) ?? []).filter((e) => sichtbar.includes(e))]),
  );
  return { gruppen, eltern };
};
vi.mock('./start', () => ({ ladeGruppenbaum: () => Promise.resolve(heuteAusCt()) }));
vi.mock('./struktur', () => ({
  ladeUmbauStatus: () =>
    Promise.resolve({
      aktiv: 1,
      archiviert: ARCHIVIERT,
      archivierteGruppen: new Map(
        [...h.ct.gruppen]
          .filter((id) => h.ct.status.get(id) === ARCHIVIERT)
          .map((id) => [id, h.ct.name.get(id) ?? '']),
      ),
    }),
  umbauZugriff: new Proxy({}, { get: (_ziel, k) => Reflect.get(h.ct.z, k) }),
}));

function startAusCt(): Start {
  const { gruppen, eltern } = heuteAusCt();
  return {
    ichId: 1,
    vorname: 'Alwin',
    gemeinde: 'ECG',
    gruppen,
    baum: baumAus(gruppen, eltern),
    eltern,
    typFarben: new Map(),
    typNamen: new Map([[2, 'Dienst']]),
    rollen: new Map(),
    dienste: null,
    rechte: orgRechteAus(
      { churchdb: { 'administer groups': true } },
      (s, m) => new Error(`${s} ${m}`),
    ),
    geleitet: [],
  };
}

/** Wie die Seite: nach einem Schritt liest sie Gruppen und Hierarchie neu (`onStruktur`). */
function Seite() {
  const [start, setStart] = useState(startAusCt);
  return (
    <NeueGliederung
      start={start}
      onStruktur={() => {
        setStart(startAusCt());
        return Promise.resolve(true);
      }}
    />
  );
}

let sp: ReturnType<typeof speicher>;
/** Plan im Speicher: Gemeinschaft (n1) neu als Bereich, Café hinein, Technik → „Medien“, Stream archivieren. */
const PLAN: PlanAenderungen = {
  neu: [{ id: 'n1', name: 'Gemeinschaft', typId: 2, eltern: null }],
  eltern: { '47': 'n1' },
  namen: { '7': 'Medien' },
  archiv: [12],
};
function mitPlan(a: PlanAenderungen) {
  h.kategorie = KAT;
  sp.s.werte.push({
    id: 1,
    dataCategoryId: KAT,
    value: JSON.stringify({
      ...PLAN_ART,
      version: 1,
      zeit: '2026-10-24T10:00:00.000Z',
      von: { personId: 1, name: 'Alwin' },
      inhalt: a,
    }),
  });
}
const gespeichert = () => planAus((JSON.parse(sp.s.werte[0].value) as { inhalt: unknown }).inhalt);

beforeEach(() => {
  sp = speicher();
  h.port = sp.port;
  h.kategorie = null;
  _vergissModul();
  // Gottesdienst (10) → Technik (7) → Stream (12); Café (47)
  h.ct = nachbau(
    { 10: [], 7: [10], 12: [7], 47: [] },
    { 10: 'Gottesdienst', 7: 'Technik', 12: 'Stream', 47: 'Café' },
  );
  h.ct.z.nichtUebernommen = (was) => new NichtUebernommen(was);
});
afterEach(cleanup);

async function zumUmbau(a: PlanAenderungen = PLAN) {
  mitPlan(a);
  render(<Seite />);
  fireEvent.click(await screen.findByRole('button', { name: /^Umbau · \d+ offen$/ }));
  return within(screen.getByRole('region', { name: 'Umbau-Schritte' }));
}
const zeile = (liste: ReturnType<typeof within>, titel: string) =>
  within(liste.getByText(titel).closest('li'));

describe('Umbau (O7-3)', () => {
  it('Schritte in Gruppen, Zahl im Umschalter; Umhängen in eine neue Gruppe wartet auf sie', async () => {
    mitPlan(PLAN);
    render(<Seite />);
    fireEvent.click(await screen.findByRole('button', { name: 'Umbau · 4 offen' }));
    const liste = within(screen.getByRole('region', { name: 'Umbau-Schritte' }));
    expect(liste.getByText('1 · Neue Gruppen anlegen')).toBeTruthy();
    expect(liste.getByText('„Gemeinschaft“ anlegen')).toBeTruthy();
    expect(liste.getByText('wartet auf „Gemeinschaft“ (Schritt oben)')).toBeTruthy();
    expect(
      zeile(liste, '„Café“ umhängen').getByRole<HTMLButtonElement>('button', { name: 'Ausführen' })
        .disabled,
    ).toBe(true);
    expect(liste.getByText('in „Medien“')).toBeTruthy();
    expect(screen.getByText('0 von 4 erledigt')).toBeTruthy();
  });

  it('Anlegen: in ChurchTools angelegt, Plan übernimmt die echte ID, Wartendes wird frei; Rückgängig nimmt beides zurück', async () => {
    const liste = await zumUmbau();
    fireEvent.click(
      zeile(liste, '„Gemeinschaft“ anlegen').getByRole('button', { name: 'Ausführen' }),
    );
    await screen.findByText('Ausgeführt: „Gemeinschaft“ anlegen.');
    expect(h.ct.log).toEqual(['anlegen Gemeinschaft unter null']);
    expect(gespeichert()).toMatchObject({ neu: [], eltern: { '47': 900 } });
    const neu = within(screen.getByRole('region', { name: 'Umbau-Schritte' }));
    // bleibt als erledigt stehen – vom Umbau angelegt, also nichts „im Plan zu übernehmen“
    expect(neu.getByText('„Gemeinschaft“ angelegt')).toBeTruthy();
    expect(neu.queryByRole('button', { name: 'Im Plan übernehmen' })).toBeNull();
    expect(neu.getByText('von eigener Bereich nach „Gemeinschaft“')).toBeTruthy();
    expect(
      zeile(neu, '„Café“ umhängen').getByRole<HTMLButtonElement>('button', { name: 'Ausführen' })
        .disabled,
    ).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig' }));
    await vi.waitFor(() => expect(h.ct.gruppen.has(900)).toBe(false));
    await vi.waitFor(() => expect(gespeichert()).toEqual(PLAN));
  });

  it('Umbenennen: erledigt, sobald ChurchTools den Namen hat – in der Vergangenheit, mit Fortschritt', async () => {
    const liste = await zumUmbau();
    fireEvent.click(
      zeile(liste, '„Technik“ umbenennen').getByRole('button', { name: 'Ausführen' }),
    );
    await screen.findByText('umbenannt in „Medien“');
    expect(h.ct.name.get(7)).toBe('Medien');
    expect(screen.getByText('1 von 4 erledigt')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Umbau · 3 offen' })).toBeTruthy();
  });

  it('ChurchTools übernimmt es nicht → Meldung, kein Rückgängig, Schritt bleibt offen', async () => {
    const liste = await zumUmbau();
    h.ct.panne.aendernOhneWirkung = true;
    fireEvent.click(
      zeile(liste, '„Technik“ umbenennen').getByRole('button', { name: 'Ausführen' }),
    );
    await screen.findByText(/ChurchTools hat den neuen Namen nicht übernommen/);
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeNull();
    expect(screen.getByText('0 von 4 erledigt')).toBeTruthy();
  });

  it('Archivieren wartet, solange noch eine Gruppe darunter hängt', async () => {
    const liste = await zumUmbau({ ...PLAN, archiv: [7] });
    expect(liste.getByText('wartet: erst „Stream“ woanders einhängen')).toBeTruthy();
    expect(
      zeile(liste, '„Technik“ archivieren').getByRole<HTMLButtonElement>('button', {
        name: 'Ausführen',
      }).disabled,
    ).toBe(true);
  });

  it('Archivieren: Status „archiviert“; danach erledigt, obwohl ChurchTools die Gruppe nicht mehr auflistet', async () => {
    const liste = await zumUmbau();
    fireEvent.click(
      zeile(liste, '„Stream“ archivieren').getByRole('button', { name: 'Ausführen' }),
    );
    await screen.findByText('„Stream“ archiviert');
    expect(h.ct.status.get(12)).toBe(ARCHIVIERT);
    expect(screen.getByText('1 von 4 erledigt')).toBeTruthy();
  });

  it('„Alle nacheinander“: nach Rückfrage alles in der richtigen Reihenfolge – auch, was erst frei wird', async () => {
    await zumUmbau();
    fireEvent.click(screen.getByRole('button', { name: 'Alle offenen nacheinander ausführen' }));
    // Café wartet noch auf Gemeinschaft – die Rückfrage sagt, dass es mitkommt
    expect(
      within(screen.getByRole('dialog')).getByText(
        /3 sind jetzt frei – 1 wartet noch; was dabei frei wird, kommt gleich mit dran/,
      ),
    ).toBeTruthy();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Ausführen' }));
    await screen.findByText('4 von 4 erledigt', undefined, { timeout: 3000 });
    expect(h.ct.log).toEqual([
      'anlegen Gemeinschaft unter null',
      'setzen 47→900',
      'aendern 7 {"name":"Medien"}',
      'aendern 12 {"statusId":3}',
    ]);
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeNull();
    expect(screen.getByText('jetzt unter „Gemeinschaft“')).toBeTruthy();
  });

  it('„Alle“ hält beim ersten Fehler an und sagt, nach wie vielen Schritten', async () => {
    await zumUmbau();
    h.ct.panne.setzenOhneWirkung = true;
    fireEvent.click(screen.getByRole('button', { name: 'Alle offenen nacheinander ausführen' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Ausführen' }));
    await screen.findByText(
      /Nach 1 Schritt angehalten: ChurchTools hat die neue Obergruppe nicht übernommen/,
    );
    expect(h.ct.log.some((x) => x.startsWith('aendern'))).toBe(false);
  });

  it('eine neue Gruppe gibt es schon in ChurchTools → „Im Plan übernehmen“ ersetzt die eigene ID', async () => {
    h.ct.gruppen.add(500);
    h.ct.name.set(500, 'Gemeinschaft');
    h.ct.eltern.set(500, []);
    const liste = await zumUmbau();
    expect(liste.getByText('„Gemeinschaft“ gibt es schon in ChurchTools')).toBeTruthy();
    fireEvent.click(liste.getByRole('button', { name: 'Im Plan übernehmen' }));
    await vi.waitFor(() => expect(gespeichert()).toMatchObject({ neu: [], eltern: { '47': 500 } }));
    expect(h.ct.log).toEqual([]);
  });

  it('Plan gleich ChurchTools → „Plan und ChurchTools sind gleich.“', async () => {
    mitPlan({ neu: [], eltern: {}, namen: {}, archiv: [] });
    render(<Seite />);
    fireEvent.click(await screen.findByRole('button', { name: 'Umbau · 0 offen' }));
    expect(screen.getByText('Plan und ChurchTools sind gleich.')).toBeTruthy();
  });
});
