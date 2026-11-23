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

const zeigen = (
  gruppen = [gruppe()],
  kalender: number[] = [4],
  mehr: { vorlagen?: number[]; tags?: boolean } = {},
) =>
  render(
    <Termine
      modul={MODUL}
      ich={ICH}
      gruppen={gruppen}
      kalenderSchreiben={kalender}
      vorlagenSchreiben={mehr.vorlagen}
      tagsVerwalten={mehr.tags}
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
    expect(within(f).getByLabelText<HTMLInputElement>(/^Titel/).value).toBe('Heiligabend');
    expect(within(f).getByLabelText<HTMLInputElement>('Beginn Datum').value).toBe('2027-12-24');
    expect(within(f).getByLabelText<HTMLSelectElement>('Beginn Stunde').value).toBe('16');
    expect(within(f).getByLabelText<HTMLSelectElement>('Beginn Minute').value).toBe('00');
    expect(within(f).getByLabelText<HTMLSelectElement>('Ende Stunde').value).toBe('17');
    expect(within(f).getByLabelText<HTMLInputElement>('Ganztägig').checked).toBe(false);
    expect(within(f).getByText(/^Es werden keine Einladungen verschickt\./)).toBeTruthy();
    // „Ersteller informieren“ ist wie in ChurchTools vorgehakt – dann steht dort, dass er bei Änderungen eine Mail bekommt.
    expect(
      within(f).getByLabelText<HTMLInputElement>('Ersteller über Änderungen informieren').checked,
    ).toBe(true);
    expect(within(f).getByText(/Mail von ChurchTools/)).toBeTruthy();
    await bereit(f, 'Speichern');
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
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
    expect(within(f).queryByLabelText('Beginn Stunde')).toBeNull();
    await bereit(f, 'Speichern');
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(ct.termine[0]).toMatchObject({ beginn: '2027-04-24', ende: '2027-04-24' });
    expect(staende()[0].kalender?.zeit).toBe('ganztägig');
  });

  it('Titel, Datum und Ort lassen sich ändern – der Ort geht mit', async () => {
    zeigen();
    await karte();
    const f = await fensterOeffnen('Gemeinde-Eislaufen');
    fireEvent.change(within(f).getByLabelText(/^Titel/), {
      target: { value: 'Eislaufen mit allen' },
    });
    fireEvent.change(within(f).getByLabelText('Beginn Datum'), { target: { value: '2027-01-07' } });
    fireEvent.click(
      within(within(f).getByRole('group', { name: 'Ort' })).getByRole('button', {
        name: '+ Hinzufügen',
      }),
    );
    fireEvent.change(within(f).getByLabelText('Ort Name'), { target: { value: 'Eishalle' } });
    await bereit(f, 'Speichern');
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(ct.termine[0]).toMatchObject({ titel: 'Eislaufen mit allen', beginn: '2027-01-07' });
    // Der Ort heißt in ChurchTools `address.name` (nicht mehr `meetingAt`).
    expect(ct.terminRumpf?.address).toEqual({ name: 'Eishalle' });
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
    fireEvent.click(await within(f).findByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(ct.termine).toHaveLength(2);
    expect(staende()[0].kalender?.id).not.toBe(161);
  });

  it('ChurchTools verweigert (kein Recht im Kalender): Meldung im Fenster, nichts vermerkt', async () => {
    ct.terminFehler = { status: 403, angelegt: false, ctVerbot: true };
    zeigen();
    await karte();
    const f = await fensterOeffnen('Heiligabend, 16 Uhr');
    await bereit(f, 'Speichern');
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
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
    await bereit(f, 'Speichern');
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
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
    await bereit(f, 'Speichern');
    // Ab jetzt nimmt ChurchTools keine Werte mehr an – nur der Vermerk scheitert.
    ct.schluckeWert = () => true;
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
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
    expect(within(f).getByRole<HTMLButtonElement>('button', { name: 'Speichern' }).disabled).toBe(
      true,
    );
    expect(posts()).toEqual([]);
    // Wieder erreichbar: „Noch einmal versuchen“ holt es nach, dann geht es.
    ct.fehlerBei = null;
    fireEvent.click(within(f).getByRole('button', { name: 'Noch einmal versuchen' }));
    await bereit(f, 'Speichern');
  });

  it('der Stand überlebt das Neuladen: ein zweites Öffnen des Reiters zeigt „Im Kalender“', async () => {
    zeigen();
    await karte();
    const f = await fensterOeffnen('Bibel-Action-Tag');
    await bereit(f, 'Speichern');
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
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

describe('Reiter „Kalender“ wie in ChurchTools (W15-1)', () => {
  const gottesdienst = {
    id: 7,
    calendarId: 4,
    title: 'Gottesdienst',
    subtitle: 'Sonntag',
    description: 'Wir feiern.',
    startTime: '10:30',
    duration: 5400,
    repeatId: 7,
    repeatFrequency: 1,
    repeatDuration: 86_400 * 28,
    address: { name: 'Saal', city: 'Lohmar' },
  };
  const speichern = async (f: HTMLElement) => {
    await bereit(f, 'Speichern');
    fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  };

  it('Vorlage wählen füllt das Formular – nur die Vorlagen des gewählten Kalenders – und Speichern sendet sie', async () => {
    ct.vorlagen.push(gottesdienst, {
      ...gottesdienst,
      id: 8,
      calendarId: 99,
      title: 'Fremder Kalender',
    });
    zeigen();
    await karte();
    const f = await fensterOeffnen('Heiligabend, 16 Uhr');
    const spalte = await within(f).findByRole('complementary', { name: 'Termin-Vorlagen' });
    expect(within(spalte).getByText(/Gemeindeleitung/)).toBeTruthy();
    expect(
      within(spalte).getByText(/Mit Vorlagen stellst du einheitliche Bezeichnungen/),
    ).toBeTruthy();
    await within(spalte).findByLabelText('Gottesdienst');
    expect(within(spalte).queryByLabelText('Fremder Kalender')).toBeNull();
    expect(within(spalte).getByLabelText<HTMLInputElement>('Ohne Vorlage').checked).toBe(true);

    fireEvent.click(within(spalte).getByLabelText('Gottesdienst'));
    expect(within(f).getByLabelText<HTMLInputElement>(/^Titel/).value).toBe('Gottesdienst');
    expect(within(f).getByLabelText<HTMLInputElement>('Untertitel').value).toBe('Sonntag');
    expect(within(f).getByLabelText<HTMLInputElement>('Beginn Datum').value).toBe('2027-12-24');
    expect(within(f).getByLabelText<HTMLSelectElement>('Beginn Stunde').value).toBe('10');
    expect(within(f).getByLabelText<HTMLSelectElement>('Beginn Minute').value).toBe('30');
    expect(within(f).getByLabelText<HTMLSelectElement>('Ende Stunde').value).toBe('12');
    expect(within(f).getByLabelText<HTMLSelectElement>('Ende Minute').value).toBe('00');
    expect(within(f).getByLabelText<HTMLSelectElement>('Wiederholungen').value).toBe('7');
    expect(within(f).getByLabelText<HTMLInputElement>('Wiederholen bis').value).toBe('2028-01-21');
    expect(within(f).getByLabelText<HTMLInputElement>('Ort Name').value).toBe('Saal');

    await speichern(f);
    expect(ct.terminRumpf).toMatchObject({
      calendarId: 4,
      title: 'Gottesdienst',
      subtitle: 'Sonntag',
      description: 'Wir feiern.',
      startDate: '2027-12-24T09:30:00Z',
      endDate: '2027-12-24T11:00:00Z',
      repeatId: 7,
      repeatFrequency: 1,
      repeatUntil: '2028-01-21',
      address: { name: 'Saal', city: 'Lohmar' },
      informOwner: true,
    });
    expect(ct.terminRumpf).not.toHaveProperty('meetingrequests');
  });

  it('„Ohne Vorlage“ stellt die Vorbelegung aus dem Protokoll wieder her', async () => {
    ct.vorlagen.push(gottesdienst);
    zeigen();
    await karte();
    const f = await fensterOeffnen('Heiligabend, 16 Uhr');
    fireEvent.click(await within(f).findByLabelText('Gottesdienst'));
    fireEvent.click(within(f).getByLabelText('Ohne Vorlage'));
    expect(within(f).getByLabelText<HTMLInputElement>(/^Titel/).value).toBe('Heiligabend');
    expect(within(f).getByLabelText<HTMLSelectElement>('Wiederholungen').value).toBe('0');
    expect(within(f).getByLabelText<HTMLSelectElement>('Beginn Stunde').value).toBe('16');
  });

  it('Wiederholung selbst gewählt: „Bis“ aus der Vorgabe, „Alle x“, Weitere Termine, Ausnahmen, Ende an einem anderen Tag', async () => {
    zeigen();
    await karte();
    const f = await fensterOeffnen('Heiligabend, 16 Uhr');
    fireEvent.change(within(f).getByLabelText('Wiederholungen'), { target: { value: '7' } });
    // 24.12.2027 + 7 Tage (gemessen: Bis = Beginn + repeatId Tage).
    expect(within(f).getByLabelText<HTMLInputElement>('Wiederholen bis').value).toBe('2027-12-31');
    fireEvent.change(within(f).getByLabelText('Wiederholen bis'), {
      target: { value: '2028-02-04' },
    });
    fireEvent.change(within(f).getByLabelText('Alle x'), { target: { value: '2' } });
    fireEvent.click(within(f).getByRole('button', { name: 'Weitere Termine: Datum hinzufügen' }));
    fireEvent.change(within(f).getByLabelText('Weitere Termine: Datum wählen'), {
      target: { value: '2028-02-05' },
    });
    fireEvent.click(within(f).getByRole('button', { name: 'Ausnahmen: Datum hinzufügen' }));
    fireEvent.change(within(f).getByLabelText('Ausnahmen: Datum wählen'), {
      target: { value: '2028-01-07' },
    });
    expect(within(f).getByText('05.02.2028')).toBeTruthy();
    fireEvent.change(within(f).getByLabelText('Ende Datum'), { target: { value: '2027-12-25' } });
    fireEvent.change(within(f).getByLabelText('Ende Stunde'), { target: { value: '01' } });
    await speichern(f);
    expect(ct.terminRumpf).toMatchObject({
      startDate: '2027-12-24T15:00:00Z',
      endDate: '2027-12-25T00:00:00Z',
      repeatId: 7,
      repeatFrequency: 2,
      repeatUntil: '2028-02-04',
      additionals: [{ date: '2028-02-05', isRepeated: false }],
      exceptions: [{ date: '2028-01-07' }],
    });
  });

  it('eine Marke lässt sich wieder entfernen', async () => {
    zeigen();
    await karte();
    const f = await fensterOeffnen('Heiligabend, 16 Uhr');
    fireEvent.change(within(f).getByLabelText('Wiederholungen'), { target: { value: '999' } });
    fireEvent.click(within(f).getByRole('button', { name: 'Ausnahmen: Datum hinzufügen' }));
    fireEvent.change(within(f).getByLabelText('Ausnahmen: Datum wählen'), {
      target: { value: '2028-01-07' },
    });
    fireEvent.click(within(f).getByRole('button', { name: 'Ausnahmen: 07.01.2028 entfernen' }));
    expect(within(f).queryByText('07.01.2028')).toBeNull();
    await speichern(f);
    expect(ct.terminRumpf).toMatchObject({ repeatId: 999 });
    expect(ct.terminRumpf).not.toHaveProperty('exceptions');
  });

  it('nur gefüllt und wie gewählt: intern, Untertitel, Link, Ort-Felder, „Ersteller informieren“ aus', async () => {
    zeigen();
    await karte();
    const f = await fensterOeffnen('Bibel-Action-Tag');
    fireEvent.change(within(f).getByLabelText('Untertitel'), { target: { value: 'Für alle' } });
    fireEvent.click(within(f).getByLabelText('Nur für eingeloggte Personen sichtbar'));
    fireEvent.change(within(f).getByLabelText('Link'), { target: { value: 'https://bat.de' } });
    fireEvent.change(within(f).getByLabelText('Ende Datum'), { target: { value: '2027-04-25' } });
    fireEvent.click(
      within(within(f).getByRole('group', { name: 'Ort' })).getByRole('button', {
        name: '+ Hinzufügen',
      }),
    );
    fireEvent.change(within(f).getByLabelText('Ort Straße'), { target: { value: 'Hauptstr. 1' } });
    fireEvent.change(within(f).getByLabelText('Ort PLZ'), { target: { value: '53797' } });
    fireEvent.change(within(f).getByLabelText('Ort Zusatz'), { target: { value: 'EG' } });
    fireEvent.click(within(f).getByLabelText('Ersteller über Änderungen informieren'));
    await speichern(f);
    expect(ct.terminRumpf).toMatchObject({
      subtitle: 'Für alle',
      isInternal: true,
      link: 'https://bat.de',
      allDay: true,
      startDate: '2027-04-24',
      endDate: '2027-04-25',
      address: { street: 'Hauptstr. 1', zip: '53797', addition: 'EG' },
      informOwner: false,
    });
    expect(ct.terminRumpf).not.toHaveProperty('repeatId');
  });

  it('Tags: vorhandene wählen; neue nur mit „Tags verwalten“', async () => {
    ct.tags.push({ id: 3, name: 'Jugend' }, { id: 4, name: 'Gemeinde' });
    zeigen(undefined, undefined, { tags: true });
    await karte();
    const f = await fensterOeffnen('Heiligabend, 16 Uhr');
    const tagsReihe = within(f).getByRole('group', { name: 'Tags' });
    fireEvent.click(within(tagsReihe).getByRole('button', { name: '+ Hinzufügen' }));
    fireEvent.change(await within(tagsReihe).findByLabelText('Tag hinzufügen'), {
      target: { value: '3' },
    });
    fireEvent.change(within(tagsReihe).getByLabelText('Neuer Tag'), {
      target: { value: 'Weihnachten' },
    });
    fireEvent.keyDown(within(tagsReihe).getByLabelText('Neuer Tag'), { key: 'Enter' });
    expect(within(tagsReihe).getByText('Jugend')).toBeTruthy();
    expect(within(tagsReihe).getByText('Weihnachten')).toBeTruthy();
    await speichern(f);
    expect(ct.terminRumpf?.tags).toEqual([3, 'Weihnachten']);
  });

  it('ohne „Tags verwalten“ gibt es kein Feld für neue Tags', async () => {
    ct.tags.push({ id: 3, name: 'Jugend' });
    zeigen();
    await karte();
    const f = await fensterOeffnen('Heiligabend, 16 Uhr');
    const tagsReihe = within(f).getByRole('group', { name: 'Tags' });
    fireEvent.click(within(tagsReihe).getByRole('button', { name: '+ Hinzufügen' }));
    await within(tagsReihe).findByLabelText('Tag hinzufügen');
    expect(within(tagsReihe).queryByLabelText('Neuer Tag')).toBeNull();
  });

  describe('Als Vorlage speichern', () => {
    it('nur mit dem Recht für den Kalender – sonst steht der Knopf nicht da', async () => {
      zeigen();
      await karte();
      const f = await fensterOeffnen('Heiligabend, 16 Uhr');
      await bereit(f, 'Speichern');
      expect(within(f).queryByRole('button', { name: 'Als Vorlage speichern' })).toBeNull();
    });

    it('speichert NUR die Vorlage (kein Termin, kein Vermerk), liest die Liste neu und zeigt sie an', async () => {
      zeigen(undefined, undefined, { vorlagen: [4] });
      await karte();
      const f = await fensterOeffnen('Heiligabend, 16 Uhr');
      await bereit(f, 'Speichern');
      fireEvent.click(within(f).getByRole('button', { name: 'Als Vorlage speichern' }));
      expect(await within(f).findByRole('status')).toHaveProperty(
        'textContent',
        'Die Vorlage „Heiligabend“ ist gespeichert.',
      );
      expect(ct.vorlagen).toEqual([
        expect.objectContaining({
          calendarId: 4,
          title: 'Heiligabend',
          startTime: '16:00',
          duration: 3600,
        }),
      ]);
      expect(ct.termine).toEqual([]);
      expect(posts()).toEqual([]);
      expect(staende()).toEqual([]);
      // Die Vorlage steht jetzt links in der Liste.
      expect(await within(f).findByLabelText('Heiligabend')).toBeTruthy();
    });

    it('ChurchTools sagt „gespeichert“, ist es aber nicht: keine Erfolgsmeldung', async () => {
      ct.vorlagenSchlucken = true;
      zeigen(undefined, undefined, { vorlagen: [4] });
      await karte();
      const f = await fensterOeffnen('Heiligabend, 16 Uhr');
      await bereit(f, 'Speichern');
      fireEvent.click(within(f).getByRole('button', { name: 'Als Vorlage speichern' }));
      expect((await within(f).findByRole('alert')).textContent).toMatch(
        /ob die Vorlage gespeichert wurde/,
      );
      expect(within(f).queryByRole('status')).toBeNull();
    });
  });

  it('Ein gefüllter Knopf (R1): nur „Speichern“ – „Als Vorlage speichern“ und „Abbrechen“ sind leiser', async () => {
    zeigen(undefined, undefined, { vorlagen: [4] });
    await karte();
    const f = await fensterOeffnen('Heiligabend, 16 Uhr');
    await bereit(f, 'Speichern');
    const gefuellt = [...f.querySelectorAll('button')].filter((b) =>
      /haupt|neu|gefahr/.test(b.className),
    );
    expect(gefuellt.map((b) => b.textContent)).toEqual(['Speichern']);
    // Die Reiterleiste erscheint erst, wenn es mehr als einen Reiter gibt (W15-2…5).
    expect(within(f).queryByRole('tablist')).toBeNull();
  });
});
