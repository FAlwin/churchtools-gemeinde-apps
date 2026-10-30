import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { istAufgabe, neueAufgabe, statusSetzen, type Aufgabe } from '@shared/protokolle/aufgaben';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { toDoAendern, toDoAnlegen, toDoLoeschen, toDoVerschieben } from './todoSchreiben';
import { MODUL, nachbauEnde, nachbauStarten, werteVon, type Nachbau } from './nachbau.testhilfe';

/** Fenster „To-Do“ schreibt (S7-2a) – gegen die nachgestellte ChurchTools-Instanz. */
let ct: Nachbau;
const LT = 61; // „Mitarbeit“ Leitungsteam
const JG = 65; // „Mitarbeit“ Jugend
const ort = (kategorie: number) => ({ modul: MODUL, kategorie });
const AM = '2026-10-30T10:00:00Z';
const ALWIN = { person: 1, name: 'Alwin' };
const SPIKE = { person: 19, name: 'Spike' };
const ablegen = (kat: number, a: Aufgabe) =>
  werteVon(ct, kat).push({ id: ct.naechste++, value: JSON.stringify(a) });
const lies = (kat: number): Aufgabe[] =>
  werteVon(ct, kat)
    .map((w) => JSON.parse(w.value) as unknown)
    .filter(istAufgabe);
const BEAMER = neueAufgabe({
  id: 'b',
  gruppe: 11,
  sitzung: 's1',
  text: 'Beamer',
  wer: [1],
  bis: '2026-11-01',
  von: 1,
  am: AM,
});

beforeEach(() => {
  ct = nachbauStarten();
});
afterEach(nachbauEnde);

describe('toDoAendern', () => {
  it('nur angefasste Felder – was inzwischen jemand anderes geändert hat, bleibt', async () => {
    ablegen(LT, statusSetzen(BEAMER, 'erledigt', 19, AM)); // Spike hat inzwischen abgehakt
    const n = await toDoAendern(
      ort(LT),
      'b',
      { bis: '2026-11-20', notiz: 'Termin verschoben' },
      ALWIN,
    );
    expect(n).toMatchObject({ status: 'erledigt', bis: '2026-11-20' });
    expect(lies(LT)[0]).toEqual(n);
    expect(n.verlauf.at(-1)).toMatchObject({ art: 'notiz', text: 'Termin verschoben', von: 1 });
  });

  it('To-Do inzwischen weg: genau das wird gesagt, nichts angelegt', async () => {
    const e: unknown = await toDoAendern(ort(LT), 'b', { bis: null }, ALWIN).catch(
      (x: unknown) => x,
    );
    expect(fehlerMeldung(e).text).toMatch(/gibt es nicht mehr/);
    expect(lies(LT)).toEqual([]);
  });
});

describe('toDoAnlegen', () => {
  const q = {
    neueId: 'n1',
    gruppe: 11,
    text: ' Sommerfest ',
    wer: [],
    extern: '',
    bis: null,
    status: 'arbeit' as const,
    notiz: 'erste Ideen',
    karte: { notiz: true },
  };
  it('ohne Sitzung, ohne Zuständige, mit Status, Notiz und Karte', async () => {
    const n = await toDoAnlegen(ort(LT), q, SPIKE);
    expect(n).toMatchObject({
      id: 'n1',
      sitzung: null,
      text: 'Sommerfest',
      wer: [],
      status: 'arbeit',
      karte: { notiz: true },
    });
    expect(n.verlauf.map((v) => v.art)).toEqual(['angelegt', 'status', 'notiz']);
    expect(lies(LT)).toHaveLength(1);
  });
  it('zweiter Versuch mit derselben ID (unklare Antwort): kein zweites To-Do', async () => {
    await toDoAnlegen(ort(LT), q, SPIKE);
    await toDoAnlegen(ort(LT), q, SPIKE);
    expect(lies(LT)).toHaveLength(1);
  });
});

describe('toDoLoeschen', () => {
  it('nur als gelöscht vermerkt – der Wert bleibt', async () => {
    ablegen(LT, BEAMER);
    await toDoLoeschen(ort(LT), 'b', ALWIN);
    expect(lies(LT)[0]).toMatchObject({ id: 'b', geloescht: true });
    expect(ct.aufrufe.some((a) => a.startsWith('DELETE'))).toBe(false);
  });
});

describe('toDoVerschieben', () => {
  const verschiebe = (x = {}) =>
    toDoVerschieben({
      von: { ort: ort(LT), name: 'Leitungsteam' },
      nach: { ort: ort(JG), gruppe: 194, name: 'Jugend' },
      id: 'b',
      neueId: 'n2',
      x,
      wer: [19],
      ich: ALWIN,
    });

  it('neu in der anderen Gruppe (ohne Sitzung, Verlauf zieht mit), altes als gelöscht vermerkt', async () => {
    ablegen(LT, BEAMER);
    expect(await verschiebe({ status: 'arbeit' })).toEqual({ hinweis: null });
    expect(lies(JG)).toEqual([
      expect.objectContaining({
        id: 'n2',
        gruppe: 194,
        sitzung: null,
        wer: [19],
        status: 'arbeit',
        text: 'Beamer',
      }),
    ]);
    expect(lies(LT)[0]).toMatchObject({ id: 'b', geloescht: true });
    expect(lies(LT)[0].verlauf.at(-2)).toMatchObject({
      art: 'notiz',
      text: 'Nach „Jugend“ verschoben.',
    });
  });

  it('erst anlegen, dann löschen: scheitert das Löschen, steht es doppelt da – mit Hinweis', async () => {
    ablegen(LT, BEAMER);
    ct.schlucken.add('PUT WERT'); // das Vermerken „gelöscht“ kommt nicht an
    const r = await verschiebe();
    expect(r.hinweis).toMatch(/in „Leitungsteam“ ließ es sich nicht entfernen/);
    expect(lies(JG)).toHaveLength(1);
    expect(lies(LT)[0].geloescht).toBe(false);
  });

  it('zweiter Versuch nach halbem Erfolg: kein zweites in der neuen Gruppe, das alte wird nachgeholt', async () => {
    ablegen(LT, BEAMER);
    ct.schlucken.add('PUT WERT');
    await verschiebe();
    ct.schlucken.clear();
    expect(await verschiebe()).toEqual({ hinweis: null });
    expect(lies(JG)).toHaveLength(1);
    expect(lies(LT)[0].geloescht).toBe(true);
    expect(lies(LT)[0].verlauf.filter((v) => v.text === 'Nach „Jugend“ verschoben.')).toHaveLength(
      1,
    );
    // und noch ein dritter Versuch: das schon gelöschte bleibt, wie es ist
    await verschiebe();
    expect(lies(LT)[0].verlauf.filter((v) => v.text === 'Nach „Jugend“ verschoben.')).toHaveLength(
      1,
    );
  });

  it('das alte gibt es nicht mehr: nichts angelegt', async () => {
    await expect(verschiebe()).rejects.toThrow(/gibt es nicht mehr/);
    expect(lies(JG)).toEqual([]);
  });
});
