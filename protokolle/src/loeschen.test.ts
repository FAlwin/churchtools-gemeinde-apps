import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { alsGeloescht, istAufgabe, neueAufgabe, type Aufgabe } from '@shared/protokolle/aufgaben';
import { BLOCKNOTE_DOKUMENT } from '@shared/protokolle/dokument.testdaten';
import { geplanterKopf } from '@shared/protokolle/planen';
import {
  dokumentDerSitzung,
  istKopf,
  istTeil,
  sitzungAusWerten,
  teileBauen,
  type ProtokollKopf,
  type Schreiber,
} from '@shared/protokolle/speicher';
import { NichtUebernommen } from '@ui/ct/fehler';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { LoeschUnterbrochen, protokollLoeschen, type LoeschPlan } from './loeschen';
import { MODUL, nachbauEnde, nachbauStarten, werteVon, type Nachbau } from './nachbau.testhilfe';

/**
 * „Protokoll löschen“ (W6) gegen die nachgestellte ChurchTools-Instanz – verhält sich wie gemessen (Termin: K2b
 * 29.10.2026, Werte: S0). Termin 70 (Alwin + Spike, Spike hat zugesagt), Treffen 80 in Gruppe 194, Protokoll „s1“ in
 * Kategorie 62, To-Dos in Kategorie 63.
 */
let ct: Nachbau;
const KAT = 62;
const MIT = 63;
const BEGINN = '2027-05-26T17:30:00Z';
const ENDE = '2027-05-26T19:30:00Z';
const JETZT = new Date('2026-11-17T10:00:00Z');
const ICH: Schreiber = { person: 1, name: 'Alwin Friesen', fenster: 'f1' };

/** Kopf + Teile so ablegen, wie das Speichern sie schreibt (`teileBauen`) – dazu ein alter Teil von früher. */
function protokollAblegen(
  sitzung: string,
  status: ProtokollKopf['status'] = 'entwurf',
  kopfTeil: Partial<ProtokollKopf> = {},
): number {
  const { stand, werte } = teileBauen(BLOCKNOTE_DOKUMENT, sitzung);
  const alt = teileBauen([BLOCKNOTE_DOKUMENT[0]], sitzung).werte[0];
  const kopf: ProtokollKopf = {
    ...geplanterKopf(
      { titel: 'Leitungssitzung', beginn: BEGINN, termin: { kalender: 4, id: 70 }, treffen: 80 },
      sitzung,
    ),
    status,
    stand,
    ...kopfTeil,
  };
  const liste = werteVon(ct, KAT);
  const kopfId = ct.naechste++;
  liste.push({ id: kopfId, value: JSON.stringify(kopf) });
  for (const w of [...werte, alt]) liste.push({ id: ct.naechste++, value: w });
  return kopfId;
}

const aufgabe = (id: string, sitzung: string | null): Aufgabe =>
  neueAufgabe({
    id,
    gruppe: 194,
    sitzung,
    text: `To-Do ${id}`,
    von: 7,
    am: '2026-11-10T10:00:00Z',
  });
const todosAblegen = (...liste: Aufgabe[]) => {
  for (const a of liste) werteVon(ct, MIT).push({ id: ct.naechste++, value: JSON.stringify(a) });
};
const todos = (): Aufgabe[] =>
  werteVon(ct, MIT)
    .map((w) => JSON.parse(w.value) as unknown)
    .filter(istAufgabe);
const todo = (id: string) => todos().find((a) => a.id === id)!;

/** Was in der Protokoll-Kategorie zu einer Sitzung liegt. */
const von = (sitzung: string) =>
  werteVon(ct, KAT).filter((w) => {
    const x = JSON.parse(w.value) as unknown;
    return (istKopf(x) || istTeil(x)) && x.sitzung === sitzung;
  });
const kopfVon = (sitzung: string) => sitzungAusWerten(werteVon(ct, KAT), sitzung).kopf?.inhalt;
const termin = () => ct.termine.find((t) => t.id === 70);
const treffen = () => ct.treffen.get(194)?.find((t) => t.id === 80);

const plan = (teil: Partial<LoeschPlan> = {}): LoeschPlan => ({
  ort: { modul: MODUL, kategorie: KAT, sitzung: 's1' },
  ich: ICH,
  gruppe: 194,
  mitarbeit: { modul: MODUL, kategorie: MIT },
  todos: false,
  termin: null,
  treffen: null,
  jetzt: JETZT,
  ...teil,
});
const MIT_TERMIN = { termin: { kalender: 4, id: 70 }, beginn: BEGINN, zeitzone: 'Europe/Berlin' };

beforeEach(() => {
  ct = nachbauStarten();
  ct.termine.push({
    kalender: 4,
    id: 70,
    titel: 'Leitungssitzung',
    beginn: BEGINN,
    ende: ENDE,
    anfragen: [
      { person: 1, state: 'accepted', id: 501 },
      { person: 19, state: 'accepted', id: 502 },
    ],
  });
  ct.treffen.set(194, [{ id: 80, startDate: BEGINN, isCanceled: false, isCompleted: false }]);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(nachbauEnde);

describe('protokollLoeschen – nur das Protokoll', () => {
  it('Entwurf: Kopf und alle Teile (auch ein alter Teil) weg, andere Sitzungen, Termin und Treffen bleiben, keine Mail', async () => {
    protokollAblegen('s1');
    protokollAblegen('s9', 'frei');
    expect(von('s1').length).toBeGreaterThan(2);

    expect(await protokollLoeschen(plan())).toEqual({ art: 'ok' });

    expect(von('s1')).toEqual([]);
    expect(kopfVon('s9')?.status).toBe('frei');
    expect(
      dokumentDerSitzung(
        kopfVon('s9')!,
        sitzungAusWerten(werteVon(ct, KAT), 's9').teile.map((t) => t.teil),
      ),
    ).toEqual(BLOCKNOTE_DOKUMENT);
    expect(termin()).toBeDefined();
    expect(treffen()).toBeDefined();
    expect(ct.mails).toEqual([]);
  });

  it('freigegeben geht direkt, ohne Zurücknehmen', async () => {
    protokollAblegen('s1', 'frei', { freigabe: { von: 7, am: '2026-11-12T10:00:00Z' } });
    expect(await protokollLoeschen(plan())).toEqual({ art: 'ok' });
    expect(von('s1')).toEqual([]);
  });

  it('gibt es das Protokoll schon nicht mehr (zweiter Versuch), ist das erledigt', async () => {
    expect(await protokollLoeschen(plan())).toEqual({ art: 'ok' });
  });

  it('To-Dos bleiben unberührt, solange nicht „Mitlöschen“ gewählt ist', async () => {
    protokollAblegen('s1');
    todosAblegen(aufgabe('a', 's1'), aufgabe('b', 's1'));
    const vorher = todos();
    await protokollLoeschen(plan({ todos: false }));
    expect(todos()).toEqual(vorher);
  });
});

describe('protokollLoeschen – To-Dos', () => {
  it('Mitlöschen: genau die aus diesem Protokoll als gelöscht vermerkt (nie hart), mit Verlauf; die anderen bleiben', async () => {
    protokollAblegen('s1');
    const schonWeg = alsGeloescht(aufgabe('d', 's1'), 7, '2026-11-11T10:00:00Z');
    todosAblegen(aufgabe('a', 's1'), aufgabe('b', 's1'), aufgabe('c', 's2'), schonWeg);
    const anzahl = werteVon(ct, MIT).length;

    await protokollLoeschen(plan({ todos: true }));

    expect(werteVon(ct, MIT)).toHaveLength(anzahl); // vermerkt, nicht hart gelöscht
    for (const id of ['a', 'b']) {
      expect(todo(id).geloescht).toBe(true);
      expect(todo(id).verlauf.at(-1)).toMatchObject({ art: 'geloescht', von: 1, name: 'Alwin' });
    }
    expect(todo('c').geloescht).toBe(false);
    expect(todo('c').verlauf).toHaveLength(1);
    // Das schon vermerkte bekommt keinen zweiten Eintrag.
    expect(todo('d').verlauf.filter((v) => v.art === 'geloescht')).toHaveLength(1);
  });

  it('Mitlöschen ohne Mitarbeit-Kategorie: nichts zu vermerken, das Protokoll geht trotzdem', async () => {
    protokollAblegen('s1');
    expect(await protokollLoeschen(plan({ todos: true, mitarbeit: null }))).toEqual({ art: 'ok' });
    expect(von('s1')).toEqual([]);
  });
});

describe('protokollLoeschen – Termin und Gruppentreffen', () => {
  it('Termin: gelöscht (Mail „Termin gelöscht“ an die Eingeladenen), Treffen bleibt', async () => {
    protokollAblegen('s1');
    await protokollLoeschen(plan({ termin: MIT_TERMIN }));
    expect(termin()).toBeUndefined();
    expect(ct.mails).toEqual([{ person: 19, art: 'geloescht' }]);
    expect(treffen()).toBeDefined();
    expect(von('s1')).toEqual([]);
  });

  it('Gruppentreffen: gelöscht, ohne Mail; Termin bleibt', async () => {
    protokollAblegen('s1');
    await protokollLoeschen(plan({ treffen: 80 }));
    expect(treffen()).toBeUndefined();
    expect(termin()).toBeDefined();
    expect(ct.mails).toEqual([]);
    expect(von('s1')).toEqual([]);
  });

  it('beides, dazu To-Dos: alles weg', async () => {
    protokollAblegen('s1');
    todosAblegen(aufgabe('a', 's1'));
    await protokollLoeschen(plan({ todos: true, termin: MIT_TERMIN, treffen: 80 }));
    expect(termin()).toBeUndefined();
    expect(treffen()).toBeUndefined();
    expect(todo('a').geloescht).toBe(true);
    expect(von('s1')).toEqual([]);
  });

  it('Termin und Treffen sind schon weg (404): erledigt, es geht weiter', async () => {
    protokollAblegen('s1');
    ct.termine.length = 0;
    ct.treffen.set(194, []);
    expect(await protokollLoeschen(plan({ termin: MIT_TERMIN, treffen: 80 }))).toEqual({
      art: 'ok',
    });
    expect(ct.mails).toEqual([]);
    expect(von('s1')).toEqual([]);
  });

  describe('Terminserie', () => {
    const W = (tag: string, zeit = '17:30') => `2027-${tag}T${zeit}:00Z`;
    const serie = () => ct.termine.find((t) => t.id === 90)!;
    beforeEach(() => {
      ct.termine.push({
        kalender: 4,
        id: 90,
        titel: 'Leitungssitzung',
        beginn: W('07-07'),
        ende: W('07-07', '19:30'),
        repeatId: 7,
        felder: { repeatFrequency: 1, repeatUntil: '2027-08-25' },
        anfragen: [
          { person: 1, state: 'accepted', id: 601 },
          { person: 19, state: 'accepted', id: 602 },
        ],
      });
      ct.treffen.get(194)!.push({ id: 81, startDate: W('07-14'), isCanceled: false });
      protokollAblegen('s2', 'entwurf', {
        beginn: W('07-14'),
        termin: { kalender: 4, id: 90 },
        treffen: 81,
      });
    });

    it('„nur diese“: der Tag fällt still aus der Serie (Ausnahme), die Serie bleibt, keine Mail', async () => {
      await protokollLoeschen(
        plan({
          ort: { modul: MODUL, kategorie: KAT, sitzung: 's2' },
          termin: {
            termin: { kalender: 4, id: 90 },
            beginn: W('07-14'),
            zeitzone: 'Europe/Berlin',
            art: 'diese',
          },
        }),
      );
      expect(serie().felder?.exceptions).toEqual([{ date: '2027-07-14' }]);
      expect(ct.mails).toEqual([]);
      expect(von('s2')).toEqual([]);
    });

    it('ohne Wahl bei einer Serie: abgewiesen, nichts gelöscht (ein `DELETE` träfe die ganze Serie)', async () => {
      await expect(
        protokollLoeschen(
          plan({
            ort: { modul: MODUL, kategorie: KAT, sitzung: 's2' },
            termin: {
              termin: { kalender: 4, id: 90 },
              beginn: W('07-14'),
              zeitzone: 'Europe/Berlin',
            },
          }),
        ),
      ).rejects.toThrow('Terminserie bitte wählen');
      expect(serie()).toBeDefined();
      expect(ct.mails).toEqual([]);
      expect(von('s2').length).toBeGreaterThan(0);
    });
  });
});

describe('protokollLoeschen – Schreibsperre', () => {
  const sperre = (teil: Partial<NonNullable<ProtokollKopf['sperre']>> = {}) => ({
    von: 19,
    name: 'Peter',
    seit: JETZT.toISOString(),
    fenster: 'fremd',
    ...teil,
  });

  it('jemand anderes schreibt: nichts gelöscht – weder To-Dos noch Termin noch Protokoll', async () => {
    protokollAblegen('s1', 'entwurf', { sperre: sperre() });
    todosAblegen(aufgabe('a', 's1'));
    const r = await protokollLoeschen(plan({ todos: true, termin: MIT_TERMIN, treffen: 80 }));
    expect(r).toMatchObject({ art: 'gesperrt', sperre: { name: 'Peter' }, erledigt: [] });
    expect(todo('a').geloescht).toBe(false);
    expect(termin()).toBeDefined();
    expect(treffen()).toBeDefined();
    expect(ct.mails).toEqual([]);
    expect(von('s1').length).toBeGreaterThan(0);
  });

  it('ich selbst in einem anderen Fenster zählt auch als fremd', async () => {
    protokollAblegen('s1', 'entwurf', { sperre: sperre({ von: 1, name: 'Alwin', fenster: 'f2' }) });
    expect(await protokollLoeschen(plan())).toMatchObject({ art: 'gesperrt' });
    expect(von('s1').length).toBeGreaterThan(0);
  });

  it('die eigene Sperre dieses Fensters (der Editor) steht nicht im Weg', async () => {
    protokollAblegen('s1', 'entwurf', { sperre: sperre({ von: 1, name: 'Alwin', fenster: 'f1' }) });
    expect(await protokollLoeschen(plan())).toEqual({ art: 'ok' });
    expect(von('s1')).toEqual([]);
  });

  it('eine verfallene fremde Sperre (über zehn Minuten) steht nicht im Weg', async () => {
    protokollAblegen('s1', 'entwurf', {
      sperre: sperre({ seit: new Date(JETZT.getTime() - 11 * 60_000).toISOString() }),
    });
    expect(await protokollLoeschen(plan())).toEqual({ art: 'ok' });
  });

  it('fängt jemand an, während Termin und To-Dos laufen: vor dem Protokoll noch einmal geprüft – Protokoll bleibt', async () => {
    const kopfId = protokollAblegen('s1');
    todosAblegen(aufgabe('a', 's1'));
    // Nach dem Löschen des Termins setzt jemand anderes die Sperre.
    const echt = (
      globalThis.fetch as unknown as MockInstance<typeof fetch>
    ).getMockImplementation()!;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (i, init) => {
      const r = await echt(i, init);
      if (init?.method === 'DELETE' && String(i).includes('/appointments/'))
        werteVon(ct, KAT).find((w) => w.id === kopfId)!.value = JSON.stringify({
          ...kopfVon('s1'),
          sperre: sperre(),
        });
      return r;
    });
    const r = await protokollLoeschen(plan({ todos: true, termin: MIT_TERMIN }));
    expect(r).toMatchObject({ art: 'gesperrt', erledigt: ['todos', 'termin'] });
    expect(von('s1').length).toBeGreaterThan(0);
  });
});

describe('protokollLoeschen – Fehler mittendrin', () => {
  it('502 beim Termin: Protokoll noch da, Meldung nennt Erledigtes und Offenes; der zweite Versuch vollendet, ohne Doppeltes', async () => {
    protokollAblegen('s1');
    todosAblegen(aufgabe('a', 's1'));
    ct.terminAendernFehler = { status: 502, angelegt: false };

    const fehler = await protokollLoeschen(
      plan({ todos: true, termin: MIT_TERMIN, treffen: 80 }),
    ).catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(LoeschUnterbrochen);
    const text = fehlerMeldung(fehler).text;
    expect(text).toContain('Schon erledigt: To-Dos als gelöscht vermerkt.');
    expect(text).toContain('Noch offen: der Termin, das Gruppentreffen, das Protokoll.');
    expect(text).toContain('die Absage nicht übernommen');
    expect(von('s1').length).toBeGreaterThan(0);
    expect(termin()).toBeDefined();
    expect(treffen()).toBeDefined();
    expect(todo('a').geloescht).toBe(true);

    ct.terminAendernFehler = null;
    expect(await protokollLoeschen(plan({ todos: true, termin: MIT_TERMIN, treffen: 80 }))).toEqual(
      { art: 'ok' },
    );
    expect(von('s1')).toEqual([]);
    expect(termin()).toBeUndefined();
    expect(treffen()).toBeUndefined();
    // Nichts doppelt: ein Verlaufseintrag „gelöscht“, eine Mail.
    expect(todo('a').verlauf.filter((v) => v.art === 'geloescht')).toHaveLength(1);
    expect(ct.mails).toEqual([{ person: 19, art: 'geloescht' }]);
  });

  it('der Termin ist gelöscht, das Treffen scheitert: der zweite Versuch löscht den Termin nicht noch einmal (keine zweite Mail)', async () => {
    protokollAblegen('s1');
    ct.treffenLoeschenSchlucken = true;
    await expect(protokollLoeschen(plan({ termin: MIT_TERMIN, treffen: 80 }))).rejects.toThrow(
      LoeschUnterbrochen,
    );
    expect(termin()).toBeUndefined();
    ct.treffenLoeschenSchlucken = false;
    await protokollLoeschen(plan({ termin: MIT_TERMIN, treffen: 80 }));
    expect(ct.mails).toEqual([{ person: 19, art: 'geloescht' }]);
    expect(treffen()).toBeUndefined();
    expect(von('s1')).toEqual([]);
  });

  it('Nachlesen: sagt ChurchTools „gelöscht“ und der Kopf steht noch da, ist das ein Fehler – kein Erfolg', async () => {
    protokollAblegen('s1');
    ct.schlucken.add('DELETE WERT');
    const fehler = await protokollLoeschen(plan()).catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(LoeschUnterbrochen);
    expect((fehler as LoeschUnterbrochen).cause).toBeInstanceOf(NichtUebernommen);
    expect(fehlerMeldung(fehler).text).toContain('das Löschen des Protokolls nicht übernommen');
    expect(kopfVon('s1')).toBeDefined();
  });

  it('Nachlesen beim Gruppentreffen: „gelöscht“ gesagt, aber noch da → Fehler, das Protokoll bleibt', async () => {
    protokollAblegen('s1');
    ct.treffenLoeschenSchlucken = true;
    const fehler = await protokollLoeschen(plan({ treffen: 80 })).catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(LoeschUnterbrochen);
    expect(fehlerMeldung(fehler).text).toContain(
      'das Löschen des Gruppentreffens nicht übernommen',
    );
    expect(von('s1').length).toBeGreaterThan(0);
  });

  it('Kopf zuletzt: scheitert sein Löschen, sind die Teile weg, der Kopf steht – kein lesbares Halbes, und ein zweiter Versuch vollendet', async () => {
    const kopfId = protokollAblegen('s1');
    const echt = (
      globalThis.fetch as unknown as MockInstance<typeof fetch>
    ).getMockImplementation()!;
    let kopfFehler = true;
    vi.spyOn(globalThis, 'fetch').mockImplementation((i, init) =>
      kopfFehler && init?.method === 'DELETE' && String(i).endsWith(`/customdatavalues/${kopfId}`)
        ? Promise.resolve(new Response('{"message":"weg"}', { status: 502 }))
        : echt(i, init),
    );

    await expect(protokollLoeschen(plan())).rejects.toThrow(LoeschUnterbrochen);
    const f = sitzungAusWerten(werteVon(ct, KAT), 's1');
    expect(f.kopf).not.toBeNull();
    expect(f.teile).toEqual([]);
    // Die Ansicht nimmt keinen halben Stand: ohne Teile gibt es kein Dokument.
    expect(
      dokumentDerSitzung(
        f.kopf!.inhalt,
        f.teile.map((t) => t.teil),
      ),
    ).toBeNull();

    kopfFehler = false;
    expect(await protokollLoeschen(plan())).toEqual({ art: 'ok' });
    expect(von('s1')).toEqual([]);
  });

  it('die Sperre prüft vorab: ein Lesefehler dort ist ein gewöhnlicher Fehler – nichts gelöscht', async () => {
    protokollAblegen('s1');
    ct.werteLesenFehlerFuer.set(KAT, 503);
    await expect(protokollLoeschen(plan({ treffen: 80 }))).rejects.not.toBeInstanceOf(
      LoeschUnterbrochen,
    );
    expect(treffen()).toBeDefined();
  });
});
