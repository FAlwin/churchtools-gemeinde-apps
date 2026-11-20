import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  istAufgabe,
  modusSetzen,
  neueAufgabe,
  statusSetzen,
  type Aufgabe,
} from '@shared/protokolle/aufgaben';
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

describe('„Jeder für sich“ schreiben (W8a)', () => {
  const JEDER = modusSetzen({ ...BEAMER, wer: [1, 19, 23] }, true, 1, AM);
  const teil = (person: number) => ({ teile: [{ person, fertig: true }] });

  it('zwei Personen haken kurz nacheinander ab – keiner löscht den Teil des anderen', async () => {
    ablegen(LT, JEDER);
    // Beide haben denselben (alten) Stand auf dem Bildschirm; geschrieben wird auf den frisch gelesenen.
    await toDoAendern(ort(LT), 'b', teil(1), ALWIN);
    const n = await toDoAendern(ort(LT), 'b', teil(19), SPIKE);
    expect(Object.keys(n.fertig ?? {}).sort()).toEqual(['1', '19']);
    expect(n.status).toBe('arbeit');
    expect(lies(LT)[0]).toEqual(n);
    const letzte = await toDoAendern(ort(LT), 'b', teil(23), { person: 23, name: 'Spike2' });
    expect(letzte.status).toBe('erledigt');
    expect(Object.keys(letzte.fertig ?? {})).toHaveLength(3);
  });

  it('Rechte: ein Mitglied setzt nur den eigenen Teil – für einen anderen scheitert es, nichts wird geschrieben', async () => {
    ablegen(LT, JEDER);
    const vorher = ct.aufrufe.length;
    const e: unknown = await toDoAendern(ort(LT), 'b', teil(23), ALWIN, false).catch(
      (x: unknown) => x,
    );
    expect(fehlerMeldung(e).text).toMatch(/nur deinen eigenen Teil/);
    expect(ct.aufrufe.slice(vorher).filter((x) => !x.startsWith('GET'))).toEqual([]);
    expect(lies(LT)[0].fertig).toBeUndefined();
  });

  it('Rechte: die Leitung darf für andere abhaken – der Verlauf nennt, wer es getan hat', async () => {
    ablegen(LT, JEDER);
    const n = await toDoAendern(ort(LT), 'b', teil(23), ALWIN, true);
    expect(n.fertig).toHaveProperty('23');
    expect(n.verlauf.find((v) => v.art === 'teil')).toMatchObject({
      von: 1,
      person: 23,
      fertig: true,
    });
  });

  it('anlegen: Modus „jeder“ mit Teilen (Leitung); ein Mitglied legt es so gar nicht erst an', async () => {
    const q = {
      neueId: 'n1',
      gruppe: 11,
      text: 'Abwesenheiten eintragen',
      wer: [1, 19],
      extern: '',
      bis: null,
      status: 'offen' as const,
      jeder: true,
      notiz: '',
      karte: {},
    };
    const n = await toDoAnlegen(
      ort(LT),
      { ...q, teile: [{ person: 1, fertig: true }] },
      ALWIN,
      true,
    );
    expect(n).toMatchObject({ jeder: true, status: 'arbeit' });
    expect(Object.keys(n.fertig ?? {})).toEqual(['1']);
    const e: unknown = await toDoAnlegen(
      ort(LT),
      { ...q, neueId: 'n2', teile: [{ person: 19, fertig: true }] },
      ALWIN,
    ).catch((x: unknown) => x);
    expect(fehlerMeldung(e).text).toMatch(/nur für dich selbst/);
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
    const n = await toDoAnlegen(ort(LT), q, SPIKE, true);
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
    await toDoAnlegen(ort(LT), q, SPIKE, true);
    await toDoAnlegen(ort(LT), q, SPIKE, true);
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
      leitung: true,
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

describe('Rechte im To-Do (W9a): der Schreibweg lässt Mitarbeiter nur, was `toDoRechte` erlaubt', () => {
  const GETEILT = { ...BEAMER, wer: [1, 19] };
  const OHNE = { ...BEAMER, wer: [] };
  /** Scheitert mit 409 und der Meldung – und es wurde nichts geschrieben. */
  const verweigert = async (arbeit: () => Promise<unknown>, meldung: RegExp) => {
    const vorher = ct.aufrufe.length;
    const e: unknown = await arbeit().catch((x: unknown) => x);
    expect(fehlerMeldung(e).text).toMatch(meldung);
    expect(ct.aufrufe.slice(vorher).filter((x) => !x.startsWith('GET'))).toEqual([]);
  };
  const mitFrage = {
    neueId: 'n1',
    gruppe: 11,
    text: 'Plakat',
    extern: '',
    bis: null,
    status: 'offen' as const,
    notiz: '',
    karte: {},
  };

  it('Text an einem geteilten To-Do ändern: 409', async () => {
    ablegen(LT, GETEILT);
    await verweigert(
      () => toDoAendern(ort(LT), 'b', { text: 'Neu' }, ALWIN),
      /Text ändert nur die Leitung/,
    );
    expect(lies(LT)[0].text).toBe('Beamer');
  });

  it('Frist und Zuständige an einem geteilten To-Do: 409', async () => {
    ablegen(LT, GETEILT);
    await verweigert(() => toDoAendern(ort(LT), 'b', { bis: '2027-01-01' }, ALWIN), /Frist/);
    await verweigert(() => toDoAendern(ort(LT), 'b', { wer: [1] }, ALWIN), /Zuständigen/);
  });

  it('Geteilt: abhaken und Notiz gehen', async () => {
    ablegen(LT, GETEILT);
    const n = await toDoAendern(ort(LT), 'b', { status: 'erledigt', notiz: 'fertig' }, ALWIN);
    expect(n.status).toBe('erledigt');
  });

  it('Eigenes To-Do: Text, Frist, Status „in Arbeit“, Notiz und Abgeben gehen', async () => {
    ablegen(LT, BEAMER);
    const n = await toDoAendern(
      ort(LT),
      'b',
      { text: 'Beamer prüfen', bis: '2026-12-24', status: 'arbeit', notiz: 'läuft' },
      ALWIN,
    );
    expect(n).toMatchObject({ text: 'Beamer prüfen', bis: '2026-12-24', status: 'arbeit' });
    const ab = await toDoAendern(ort(LT), 'b', { wer: [19] }, ALWIN);
    expect(ab.wer).toEqual([19]);
  });

  it('Eigenes To-Do an mehrere abgeben oder weitere dazunehmen: 409', async () => {
    ablegen(LT, BEAMER);
    await verweigert(
      () => toDoAendern(ort(LT), 'b', { wer: [1, 19] }, ALWIN),
      /nur an ein anderes Mitglied/,
    );
  });

  it('Eigenes To-Do im Protokoll-Entwurf: Text scheitert, Frist geht', async () => {
    ablegen(LT, BEAMER);
    await verweigert(
      () => toDoAendern(ort(LT), 'b', { text: 'Neu' }, ALWIN, false, true),
      /Protokoll-Entwurf/,
    );
    const n = await toDoAendern(ort(LT), 'b', { bis: '2026-12-24' }, ALWIN, false, true);
    expect(n.bis).toBe('2026-12-24');
  });

  it('Modus umstellen: 409 für Mitarbeiter, Leitung darf', async () => {
    ablegen(LT, GETEILT);
    await verweigert(() => toDoAendern(ort(LT), 'b', { jeder: true }, ALWIN), /nur die Leitung/);
    const n = await toDoAendern(ort(LT), 'b', { jeder: true }, ALWIN, true);
    expect(n.jeder).toBe(true);
  });

  it('Ohne Zuständigen: „Das mache ich“ geht, jemand anderen eintragen nicht, abhaken nicht', async () => {
    ablegen(LT, OHNE);
    await verweigert(() => toDoAendern(ort(LT), 'b', { wer: [19] }, ALWIN), /selbst eintragen/);
    await verweigert(() => toDoAendern(ort(LT), 'b', { status: 'erledigt' }, ALWIN), /Status/);
    const n = await toDoAendern(ort(LT), 'b', { wer: [1] }, ALWIN);
    expect(n.wer).toEqual([1]);
  });

  it('Gegen den frisch gelesenen Stand: hat inzwischen jemand anderes es übernommen, scheitert „Das mache ich“', async () => {
    ablegen(LT, { ...BEAMER, wer: [19] }); // Spike war schneller; auf dem Bildschirm stand es noch „ohne“
    await verweigert(() => toDoAendern(ort(LT), 'b', { wer: [1] }, ALWIN), /gehört jemand anderem/);
  });

  it('Löschen: ein eigenes To-Do ja – geteilt, ohne Zuständigen und im Entwurf nicht', async () => {
    ablegen(LT, GETEILT);
    await verweigert(() => toDoLoeschen(ort(LT), 'b', ALWIN), /löscht nur die Leitung/);
    await toDoLoeschen(ort(LT), 'b', ALWIN, true); // Leitung
    expect(lies(LT)[0].geloescht).toBe(true);
  });

  it('Löschen eines eigenen To-Dos: Mitarbeiter ja, aber nicht im Entwurf', async () => {
    ablegen(LT, BEAMER);
    await verweigert(
      () => toDoLoeschen(ort(LT), 'b', ALWIN, false, true),
      /löscht nur die Leitung/,
    );
    await toDoLoeschen(ort(LT), 'b', ALWIN);
    expect(lies(LT)[0].geloescht).toBe(true);
  });

  it('Anlegen: ein Mitarbeiter nur für sich – für andere, mehrere oder niemanden: 409', async () => {
    await verweigert(
      () => toDoAnlegen(ort(LT), { ...mitFrage, wer: [19] }, ALWIN),
      /nur für dich selbst/,
    );
    await verweigert(
      () => toDoAnlegen(ort(LT), { ...mitFrage, wer: [] }, ALWIN),
      /nur für dich selbst/,
    );
    await verweigert(
      () => toDoAnlegen(ort(LT), { ...mitFrage, wer: [1, 19] }, ALWIN),
      /nur für dich selbst/,
    );
    const n = await toDoAnlegen(ort(LT), { ...mitFrage, wer: [1] }, ALWIN);
    expect(n.wer).toEqual([1]);
  });

  it('Verschieben in eine andere Gruppe: nur die Leitung', async () => {
    ablegen(LT, BEAMER);
    await verweigert(
      () =>
        toDoVerschieben({
          von: { ort: ort(LT), name: 'Leitungsteam' },
          nach: { ort: ort(JG), gruppe: 194, name: 'Jugend' },
          id: 'b',
          neueId: 'n2',
          x: {},
          wer: [1],
          ich: ALWIN,
        }),
      /nur die Leitung/,
    );
    expect(lies(JG)).toEqual([]);
  });
});
