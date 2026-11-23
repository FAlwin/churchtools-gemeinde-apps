// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Block } from '@shared/protokolle/dokument';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import { teileBauen, type ProtokollKopf } from '@shared/protokolle/speicher';
import { istTerminStand, terminStandId, type TerminStand } from '@shared/protokolle/terminStand';
import { _vergissGemeindeZeitzone, merkeGemeindeZeitzone } from '@shared/ct/zeit';
import { gruppeEinrichten } from './einrichten';
import {
  kategorieVon,
  LEITER,
  MODUL,
  nachbauEnde,
  nachbauStarten,
  TEILNEHMER,
  werteVon,
  type Nachbau,
} from './nachbau.testhilfe';
import { Termine } from './Termine';

/**
 * **Reiter „Termine“** (W14) mit den echten Lesern und Schreibern (`ladeUebersicht`, Eintragen, Vermerk) gegen die
 * nachgestellte ChurchTools-Instanz – nur die Zeit ist fest: Die Termine stehen weit in der Zukunft.
 */
vi.mock('./mitglieder', () => ({ ladeGruppenMitglieder: vi.fn() }));
vi.mock('./useToDoEinstellungen', async (orig) =>
  (await import('./ohneAbgleich.testutil')).ohneAbgleich(orig),
);

let ct: Nachbau;
const ICH = { person: 1, name: 'Alwin' };
const onZeigen = vi.fn();

const t = (text: string) => [{ type: 'text', text, styles: {} }];
const punkt = (id: string, titel: string): Block => ({
  id,
  type: 'heading',
  props: { level: 1 },
  content: t(titel),
  children: [],
});
const termin = (id: string, datum: string, text: string): Block => ({
  id,
  type: 'termin',
  props: { datum },
  content: t(text),
  children: [],
});

const gruppe = (id = 194): ProtokollGruppe => ({
  id,
  name: id === 194 ? 'Technik' : 'Jugend',
  lage: 'eingerichtet',
  protokolle: kategorieVon(ct, `protokolle-g${id}`),
  mitarbeit: kategorieVon(ct, `mitarbeit-g${id}`),
});

/** Ein Protokoll im echten Speicherformat in die Kategorie der Gruppe legen. */
function ablegen(
  g: number,
  sitzung: string,
  titel: string,
  beginn: string,
  status: ProtokollKopf['status'],
  dokument: Block[],
) {
  const kat = gruppe(g).protokolle!;
  const { stand, werte } = teileBauen(dokument, sitzung);
  for (const w of werte) werteVon(ct, kat).push({ id: ct.naechste++, value: w });
  const kopf: ProtokollKopf = {
    art: 'protokoll',
    fassung: 1,
    sitzung,
    titel,
    status,
    beginn,
    termin: null,
    treffen: null,
    freigabe: status === 'frei' ? { von: 1, am: beginn } : null,
    sperre: null,
    stand,
  };
  werteVon(ct, kat).push({ id: ct.naechste++, value: JSON.stringify(kopf) });
}

const staende = (g = 194): TerminStand[] =>
  werteVon(ct, gruppe(g).mitarbeit!)
    .map((w) => JSON.parse(w.value) as unknown)
    .filter(istTerminStand);
const posts = () => ct.aufrufe.filter((a) => a.startsWith('POST') && a.endsWith('/appointments'));

beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  ct = nachbauStarten();
  // Die Uhr der Gemeinde, nicht die des Rechners: Heiligabend 16 Uhr ist 15 Uhr UTC.
  merkeGemeindeZeitzone({ timezone: 'Europe/Berlin' });
  ct.kategorien.length = 0;
  for (const [id, name] of [
    [194, 'Technik'],
    [195, 'Jugend'],
  ] as const)
    await gruppeEinrichten(
      MODUL,
      { id, name, versteckt: false },
      {
        rollen: [
          { rolle: LEITER, stufe: 'leitung' },
          { rolle: TEILNEHMER, stufe: 'mitglied' },
        ],
        punkte: 'vorschlagen',
        kalender: 4,
      },
    );
  ablegen(194, 'fest', 'Festplanung 2027', '2026-11-21T18:00:00Z', 'entwurf', [
    punkt('p1', 'Feste 2027'),
    termin('t1', '2027-12-24', 'Heiligabend, 16 Uhr'),
    termin('t2', '2027-04-24', 'Bibel-Action-Tag'),
    termin('t3', '2027-01-06', 'Gemeinde-Eislaufen'),
  ]);
  ablegen(194, 'okt', 'Leitungssitzung', '2026-10-14T17:00:00Z', 'frei', [
    punkt('q1', 'Freizeit'),
    termin('u1', '2027-02-02', 'Anmeldung öffnet'),
  ]);
  ablegen(195, 'jug', 'Teamtreffen', '2026-11-02T16:00:00Z', 'frei', [
    punkt('j1', 'Räume'),
    termin('j2', '2027-03-03', 'Jugendfreizeit'),
  ]);
});
afterEach(() => {
  cleanup();
  _vergissGemeindeZeitzone();
  nachbauEnde();
});

const zeigen = (gruppen = [gruppe()], kalender: number[] = [4]) =>
  render(
    <Termine
      modul={MODUL}
      ich={ICH}
      gruppen={gruppen}
      kalenderSchreiben={kalender}
      onZeigen={onZeigen}
    />,
  );
const karte = async () => screen.findByRole('region', { name: 'Termine aus den Protokollen' });
const zeilen = async () =>
  within(await karte())
    .getAllByRole('listitem')
    .map((z) => z.querySelector('b')?.textContent);
const zeile = async (text: string) =>
  within(await karte())
    .getAllByRole('listitem')
    .find((z) => z.querySelector('b')?.textContent === text)!;
const fensterOeffnen = async (text: string) => {
  fireEvent.click(within(await zeile(text)).getByRole('button', { name: 'Eintragen' }));
  return screen.findByRole('dialog', { name: 'In Kalender eintragen' });
};
/** Das Fenster ist fertig geladen: Kalender gewählt und der Tag im Kalender geprüft. */
const bereit = async (fenster: HTMLElement, knopf: string) =>
  waitFor(() => {
    expect(within(fenster).getByRole<HTMLButtonElement>('button', { name: knopf }).disabled).toBe(
      false,
    );
  });

describe('Liste', () => {
  it('sammelt die Termine aller Sitzungen (Entwurf und freigegeben) nach Datum', async () => {
    zeigen();
    await karte();
    expect(await zeilen()).toEqual([
      'Gemeinde-Eislaufen',
      'Anmeldung öffnet',
      'Bibel-Action-Tag',
      'Heiligabend, 16 Uhr',
    ]);
    expect(screen.getByText('Noch nicht im Kalender')).toBeTruthy();
    // Woher: Sitzung, Datum der Sitzung und Punkt – bei einer Gruppe ohne Gruppenname.
    const z = await zeile('Gemeinde-Eislaufen');
    expect(z.textContent).toContain('aus Festplanung 2027 · ');
    expect(z.textContent).toContain('Punkt 1 · Feste 2027');
    expect(z.textContent).not.toContain('Technik');
  });

  it('mehrere Gruppen: Gruppenname in der Zeile, Filter „Gruppe“ schränkt ein', async () => {
    zeigen([gruppe(194), gruppe(195)]);
    await karte();
    expect(await zeilen()).toContain('Jugendfreizeit');
    expect((await zeile('Jugendfreizeit')).textContent).toContain('Jugend ·');
    fireEvent.click(screen.getByRole('button', { name: /Filter/ }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Jugend' }));
    await waitFor(async () => expect(await zeilen()).toEqual(['Jugendfreizeit']));
    fireEvent.click(screen.getByRole('radio', { name: 'Alle Gruppen' }));
    await waitFor(async () => expect((await zeilen()).length).toBe(5));
  });

  it('keine Termine in den Protokollen: ein Satz statt einer leeren Karte', async () => {
    zeigen([gruppe(195)]);
    await screen.findByText(/Jugendfreizeit/);
    cleanup();
    ct.werte.set(gruppe(195).protokolle!, []);
    zeigen([gruppe(195)]);
    await screen.findByText(/noch keine Termine/);
  });

  it('„Im Protokoll zeigen“ springt in die Sitzung zum Punkt', async () => {
    zeigen();
    await karte();
    fireEvent.click(
      within(await zeile('Heiligabend, 16 Uhr')).getByRole('button', { name: 'Mehr' }),
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Im Protokoll zeigen' }));
    expect(onZeigen).toHaveBeenCalledWith(194, 'p:fest', 'p1');
  });
});

describe('Eintragen', () => {
  it('mit Uhrzeit: Fenster vorbelegt, legt ohne Einladung an, Zeile wandert nach „Im Kalender“', async () => {
    zeigen();
    await karte();
    const f = await fensterOeffnen('Heiligabend, 16 Uhr');
    expect(within(f).getByLabelText<HTMLInputElement>('Titel').value).toBe('Heiligabend');
    expect(within(f).getByLabelText<HTMLInputElement>('Datum').value).toBe('2027-12-24');
    expect(within(f).getByLabelText<HTMLInputElement>('Von').value).toBe('16:00');
    expect(within(f).getByLabelText<HTMLInputElement>('Bis').value).toBe('17:00');
    expect(within(f).getByLabelText<HTMLInputElement>('Ganztägig').checked).toBe(false);
    expect(within(f).getByText('Es werden keine Einladungen verschickt.')).toBeTruthy();
    await bereit(f, 'Eintragen');
    fireEvent.click(within(f).getByRole('button', { name: 'Eintragen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    expect(ct.termine).toHaveLength(1);
    expect(ct.termine[0]).toMatchObject({
      kalender: 4,
      titel: 'Heiligabend',
      beginn: '2027-12-24T15:00:00Z',
      ende: '2027-12-24T16:00:00Z',
      anfragen: [],
    });
    expect(ct.mails).toEqual([]);
    expect(staende()).toEqual([
      expect.objectContaining({
        id: terminStandId('fest', 't1'),
        stand: 'imKalender',
        kalender: { kalender: 4, id: ct.termine[0].id, name: 'Gemeindeleitung', zeit: '16:00 Uhr' },
      }),
    ]);
    // Aus „Noch nicht im Kalender“ heraus, unter „Im Kalender“ (zu, bis man es öffnet).
    expect(await zeilen()).not.toContain('Heiligabend, 16 Uhr');
    fireEvent.click(screen.getByRole('button', { name: /Im Kalender/ }));
    const z = await zeile('Heiligabend, 16 Uhr');
    expect(z.textContent).toContain('Gemeindeleitung · 16:00 Uhr');
    expect(
      within(z).getByRole('link', { name: 'In ChurchTools öffnen' }).getAttribute('href'),
    ).toMatch(/\/\?q=churchcal$/);
  });

  it('ohne Uhrzeit: ganztägig – der Tag geht an ChurchTools, nicht eine Uhrzeit', async () => {
    zeigen();
    await karte();
    const f = await fensterOeffnen('Bibel-Action-Tag');
    expect(within(f).getByLabelText<HTMLInputElement>('Ganztägig').checked).toBe(true);
    expect(within(f).queryByLabelText('Von')).toBeNull();
    await bereit(f, 'Eintragen');
    fireEvent.click(within(f).getByRole('button', { name: 'Eintragen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(ct.termine[0]).toMatchObject({ beginn: '2027-04-24', ende: '2027-04-24' });
    expect(staende()[0].kalender?.zeit).toBe('ganztägig');
  });

  it('Titel, Datum und Ort lassen sich ändern – der Ort geht mit', async () => {
    zeigen();
    await karte();
    const f = await fensterOeffnen('Gemeinde-Eislaufen');
    fireEvent.change(within(f).getByLabelText('Titel'), {
      target: { value: 'Eislaufen mit allen' },
    });
    fireEvent.change(within(f).getByLabelText('Datum'), { target: { value: '2027-01-07' } });
    fireEvent.change(within(f).getByLabelText('Ort (optional)'), { target: { value: 'Eishalle' } });
    await bereit(f, 'Eintragen');
    fireEvent.click(within(f).getByRole('button', { name: 'Eintragen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(ct.termine[0]).toMatchObject({ titel: 'Eislaufen mit allen', beginn: '2027-01-07' });
  });

  it('steht am Tag schon ein ähnlicher Termin: „Nur verknüpfen“ ist vorgewählt – nichts wird angelegt', async () => {
    ct.termine.push({
      kalender: 4,
      id: 161,
      titel: 'Heiligabend – Familiengottesdienst',
      beginn: '2027-12-24T09:00:00Z',
      anfragen: [],
    });
    zeigen();
    await karte();
    const f = await fensterOeffnen('Heiligabend, 16 Uhr');
    await within(f).findByText(/schon „Heiligabend – Familiengottesdienst“/);
    expect(within(f).getByLabelText<HTMLInputElement>(/Nur verknüpfen/).checked).toBe(true);
    await bereit(f, 'Verknüpfen');
    fireEvent.click(within(f).getByRole('button', { name: 'Verknüpfen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(posts()).toEqual([]);
    expect(staende()[0]).toMatchObject({
      stand: 'imKalender',
      kalender: { kalender: 4, id: 161, zeit: '10:00 Uhr' },
    });
  });

  it('„Trotzdem neu anlegen“ legt an, obwohl einer da ist', async () => {
    ct.termine.push({
      kalender: 4,
      id: 161,
      titel: 'Heiligabend – Familiengottesdienst',
      beginn: '2027-12-24T09:00:00Z',
      anfragen: [],
    });
    zeigen();
    await karte();
    const f = await fensterOeffnen('Heiligabend, 16 Uhr');
    await within(f).findByText(/schon „Heiligabend/);
    fireEvent.click(within(f).getByLabelText(/Trotzdem neu anlegen/));
    fireEvent.click(await within(f).findByRole('button', { name: 'Eintragen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(ct.termine).toHaveLength(2);
    expect(staende()[0].kalender?.id).not.toBe(161);
  });

  it('ChurchTools verweigert (kein Recht im Kalender): Meldung im Fenster, nichts vermerkt', async () => {
    ct.terminFehler = { status: 403, angelegt: false, ctVerbot: true };
    zeigen();
    await karte();
    const f = await fensterOeffnen('Heiligabend, 16 Uhr');
    await bereit(f, 'Eintragen');
    fireEvent.click(within(f).getByRole('button', { name: 'Eintragen' }));
    expect(await within(f).findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringMatching(/keine Termine anlegen/),
    );
    expect(staende()).toEqual([]);
    expect(ct.termine).toEqual([]);
  });

  it('unklare Antwort, nichts zu finden: „bitte nachsehen“ – der Termin gilt NICHT als eingetragen', async () => {
    ct.terminFehler = { status: 504, angelegt: false };
    zeigen();
    await karte();
    const f = await fensterOeffnen('Heiligabend, 16 Uhr');
    await bereit(f, 'Eintragen');
    fireEvent.click(within(f).getByRole('button', { name: 'Eintragen' }));
    expect((await within(f).findByRole('alert')).textContent).toMatch(/unklar/);
    expect(staende()).toEqual([]);
    // Die Zeile steht noch unter „Noch nicht im Kalender“.
    fireEvent.click(within(f).getByRole('button', { name: 'Abbrechen' }));
    expect(await zeilen()).toContain('Heiligabend, 16 Uhr');
  });

  it('der Vermerk scheitert, der Termin steht: „Nochmal vermerken“ legt nichts doppelt an', async () => {
    zeigen();
    await karte();
    const f = await fensterOeffnen('Heiligabend, 16 Uhr');
    await bereit(f, 'Eintragen');
    // Ab jetzt nimmt ChurchTools keine Werte mehr an – nur der Vermerk scheitert.
    ct.schluckeWert = () => true;
    fireEvent.click(within(f).getByRole('button', { name: 'Eintragen' }));
    expect((await within(f).findByRole('alert')).textContent).toMatch(/antwortet gerade nicht/);
    expect(within(f).getByText(/Es fehlt nur noch der Vermerk/)).toBeTruthy();
    expect(ct.termine).toHaveLength(1);
    expect(staende()).toEqual([]);

    ct.schluckeWert = null;
    fireEvent.click(within(f).getByRole('button', { name: 'Nochmal vermerken' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(ct.termine).toHaveLength(1);
    expect(posts()).toHaveLength(1);
    expect(staende()[0]).toMatchObject({ stand: 'imKalender', kalender: { id: ct.termine[0].id } });
  });

  it('der Kalender lässt sich nicht lesen (Prüfung auf „steht schon da“ unmöglich): Fehler, „Eintragen“ gesperrt, nichts angelegt', async () => {
    zeigen();
    await karte();
    ct.fehlerBei = { methode: 'GET', status: 503 };
    const f = await fensterOeffnen('Heiligabend, 16 Uhr');
    expect(await within(f).findByRole('alert')).toBeTruthy();
    expect(within(f).getByRole<HTMLButtonElement>('button', { name: 'Eintragen' }).disabled).toBe(
      true,
    );
    expect(posts()).toEqual([]);
    // Wieder erreichbar: „Noch einmal versuchen“ holt es nach, dann geht es.
    ct.fehlerBei = null;
    fireEvent.click(within(f).getByRole('button', { name: 'Noch einmal versuchen' }));
    await bereit(f, 'Eintragen');
  });

  it('der Stand überlebt das Neuladen: ein zweites Öffnen des Reiters zeigt „Im Kalender“', async () => {
    zeigen();
    await karte();
    const f = await fensterOeffnen('Bibel-Action-Tag');
    await bereit(f, 'Eintragen');
    fireEvent.click(within(f).getByRole('button', { name: 'Eintragen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    cleanup();
    zeigen();
    await karte();
    expect(await zeilen()).not.toContain('Bibel-Action-Tag');
    fireEvent.click(screen.getByRole('button', { name: /Im Kalender/ }));
    expect(await zeilen()).toContain('Bibel-Action-Tag');
  });
});

describe('Nicht eintragen', () => {
  it('blendet den Termin aus und merkt es sich – „Wieder anzeigen“ holt ihn zurück', async () => {
    zeigen();
    await karte();
    fireEvent.click(
      within(await zeile('Gemeinde-Eislaufen')).getByRole('button', { name: 'Mehr' }),
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Nicht eintragen' }));
    await waitFor(async () => expect(await zeilen()).not.toContain('Gemeinde-Eislaufen'));
    expect(staende()[0]).toMatchObject({
      id: terminStandId('fest', 't3'),
      stand: 'nichtEintragen',
    });
    expect(ct.termine).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: /Nicht eintragen/ }));
    fireEvent.click(
      within(await zeile('Gemeinde-Eislaufen')).getByRole('button', { name: 'Wieder anzeigen' }),
    );
    await waitFor(async () => expect(await zeilen()).toContain('Gemeinde-Eislaufen'));
    expect(staende()).toHaveLength(1);
    expect(staende()[0].stand).toBe('offen');
  });

  it('scheitert das Speichern: Meldung, der Termin bleibt in der Liste (nie fälschlich ausgeblendet)', async () => {
    zeigen();
    await karte();
    ct.fehlerBei = { methode: 'POST', status: 503 };
    fireEvent.click(
      within(await zeile('Gemeinde-Eislaufen')).getByRole('button', { name: 'Mehr' }),
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Nicht eintragen' }));
    expect((await screen.findByRole('alert')).textContent).toBeTruthy();
    expect(await zeilen()).toContain('Gemeinde-Eislaufen');
    expect(staende()).toEqual([]);
  });
});

describe('Ohne Recht, in einem Kalender anzulegen (Mitglieder-Sicht)', () => {
  it('Liste ja – aber weder „Eintragen“ noch „Nicht eintragen“; dazu der Satz', async () => {
    zeigen([gruppe()], []);
    await karte();
    expect(await zeilen()).toContain('Heiligabend, 16 Uhr');
    expect(screen.queryByRole('button', { name: 'Eintragen' })).toBeNull();
    expect(screen.getByText(/Eintragen kann, wer im Kalender Termine anlegen darf/)).toBeTruthy();
    fireEvent.click(
      within(await zeile('Heiligabend, 16 Uhr')).getByRole('button', { name: 'Mehr' }),
    );
    expect((await screen.findAllByRole('menuitem')).map((m) => m.textContent)).toEqual([
      'Im Protokoll zeigen',
    ]);
  });

  it('wer darf, sieht den Satz nicht', async () => {
    zeigen();
    await karte();
    expect(screen.queryByText(/Eintragen kann, wer/)).toBeNull();
  });
});

describe('Fehler beim Laden', () => {
  it('ChurchTools antwortet nicht: „Erneut versuchen“ statt einer leeren Liste', async () => {
    ct.fehlerBei = { methode: 'GET', status: 503 };
    zeigen();
    expect(await screen.findByRole('button', { name: /erneut|nochmal/i })).toBeTruthy();
    expect(screen.queryByText(/noch keine Termine/)).toBeNull();
  });
});
