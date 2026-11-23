import { describe, expect, it } from 'vitest';
import { endeStelle, liveListe, type LivePunkt } from './liveAgenda';
import {
  ausnahmeSetzen,
  laeufeAus,
  wechselAus,
  zusammenfuehren,
  type Ausnahme,
  type Wechsel,
} from './liveVerlauf';
import {
  rueckblickAus,
  schnittAus,
  schnittSchluessel,
  terminBeendet,
  type VerlaufTermin,
} from './liveRueckblick';
import type { CtAgendaItem } from './typen';

const EVENT = 216;
const T0 = Date.parse('2027-03-07T09:00:00Z');
const MIN = 60_000;

/**
 * Ein Ablauf: Soundcheck (vor Beginn), Begrüßung 10 Min, zwei Lieder à 5 Min, Gebet 5 Min, Predigt 30 Min – Plan ab 09:05
 * (Beginn des Termins), Ende 10:00. Über `liveListe`, wie ChurchTools den Ablauf liefert.
 */
const ITEMS: CtAgendaItem[] = [
  { id: 1, title: 'Soundcheck', type: 'text', duration: 300, isBeforeEvent: true, min: -5 },
  { id: 2, title: 'Begrüßung', type: 'text', duration: 600, min: 0 },
  { id: 3, title: 'Anbetung', type: 'song', duration: 300, song: songMit('Halleluja'), min: 10 },
  { id: 4, title: 'Gnade', type: 'song', duration: 300, song: songMit('Gnade'), min: 15 },
  { id: 5, title: 'Gebet', type: 'text', duration: 300, min: 20 },
  { id: 6, title: 'Predigt', type: 'text', duration: 1800, min: 25 },
].map(({ min, ...i }) => ({
  ...i,
  startTimes: { [String(EVENT)]: new Date(T0 + (5 + min) * MIN).toISOString() },
}));

function songMit(title: string): CtAgendaItem['song'] {
  return { title, songId: 1, arrangementId: 1, arrangement: 'Standard' } as CtAgendaItem['song'];
}

const liste: LivePunkt[] = liveListe(ITEMS, EVENT);
const ENDE = endeStelle(liste);

/**
 * Ein Live-Durchgang aus den Erzeugern: `[Stelle, Sekunden seit dem Start]` – jeder Eintrag wird mit `wechselAus` zum
 * Wechsel, wie ihn ein klickendes Gerät festhält. `ab` = Startzeit.
 */
function durchgang(schritte: [number, number][], ab = T0, l: LivePunkt[] = liste): Wechsel[] {
  return schritte.reduce<Wechsel[]>(
    (acc, [stelle, sek]) => zusammenfuehren(acc, [wechselAus(l, stelle, ab + sek * 1000)]),
    [],
  );
}

/** Alles nach Plan, nur die Predigt 6:40 länger (Plan 09:30–10:00). */
const NACH_PLAN: [number, number][] = [
  [1, 0],
  [2, 300],
  [3, 900],
  [4, 1200],
  [5, 1500],
  [6, 1800],
  [ENDE, 3600 + 400],
];

const ohne = (wechsel: Wechsel[]): VerlaufTermin => ({ wechsel, ausnahmen: [] });

describe('terminBeendet', () => {
  it('Live ist zu Ende, wenn zuletzt „Ende“ dran war', () => {
    expect(terminBeendet(laeufeAus(durchgang(NACH_PLAN)).laeufe)).toBe(true);
  });

  it('mitten im Ablauf, ohne Verlauf oder nach „nicht gestartet“: nicht zu Ende', () => {
    expect(terminBeendet(laeufeAus(durchgang(NACH_PLAN.slice(0, 4))).laeufe)).toBe(false);
    expect(terminBeendet(laeufeAus([]).laeufe)).toBe(false);
    expect(terminBeendet(laeufeAus(durchgang([[0, 0]])).laeufe)).toBe(false);
  });

  it('wer vom Ende wieder zurückgeht, ist nicht fertig', () => {
    const v = durchgang([...NACH_PLAN, [6, 4300]]);
    expect(terminBeendet(laeufeAus(v).laeufe)).toBe(false);
    expect(rueckblickAus(liste, ohne(v))).toBeNull();
  });
});

describe('rueckblickAus – Beginn, Ende, eingeholt, überzogen', () => {
  it('gibt es erst, wenn Live zu Ende ist', () => {
    expect(rueckblickAus(liste, ohne(durchgang(NACH_PLAN.slice(0, 5))))).toBeNull();
  });

  it('Beginn und Ende gegen den Plan: + früher, − später (wie das Zeitkonto)', () => {
    // Soundcheck um 09:00, Begrüßung erst 09:07 (statt 09:05), Ende 10:01:40 (Plan 10:00)
    const v = durchgang([
      [1, 0],
      [2, 7 * 60],
      [3, 17 * 60],
      [4, 22 * 60],
      [5, 27 * 60],
      [6, 32 * 60],
      [ENDE, 3700],
    ]);
    const rb = rueckblickAus(liste, ohne(v))!;
    expect(rb.beginn).toEqual({ zeit: T0 + 7 * 60_000, abweichungSek: -120 });
    expect(rb.ende).toEqual({ zeit: T0 + 3700_000, abweichungSek: -100 });
  });

  it('der Beginn ist der erste Punkt NACH dem Vorlauf', () => {
    const rb = rueckblickAus(liste, ohne(durchgang(NACH_PLAN)))!;
    expect(rb.beginn?.zeit).toBe(T0 + 300_000);
    expect(rb.beginn?.abweichungSek).toBe(0);
  });

  it('je Punkt Plan, Gelaufen und ± – dieselbe Rechnung wie die Live-Ansicht', () => {
    const rb = rueckblickAus(liste, ohne(durchgang(NACH_PLAN)))!;
    const predigt = rb.zeilen.find((z) => z.punkt.id === 6)!;
    expect(predigt).toMatchObject({
      planSek: 1800,
      gelaufenSek: 1800 + 400 - 0,
      abweichungSek: -400,
    });
    const gebet = rb.zeilen.find((z) => z.punkt.id === 5)!;
    expect(gebet).toMatchObject({ planSek: 300, gelaufenSek: 300, abweichungSek: 0 });
    expect(rb.zeilen.map((z) => z.punkt.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('am meisten eingeholt und überzogen', () => {
    // Begrüßung 5 Min früher fertig (+300), Predigt 400 länger (−400), das Gebet 20 s länger (−20)
    const v = durchgang([
      [1, 0],
      [2, 300],
      [3, 600],
      [4, 900],
      [5, 1200],
      [6, 1520],
      [ENDE, 1520 + 1800 + 400],
    ]);
    const rb = rueckblickAus(liste, ohne(v))!;
    expect(rb.eingeholt?.punkt.id).toBe(2);
    expect(rb.eingeholt?.sek).toBe(300);
    expect(rb.ueberzogen?.punkt.id).toBe(6);
    expect(rb.ueberzogen?.sek).toBe(-400);
  });

  it('gibt es nichts Überzogenes (oder Eingeholtes), steht dort nichts', () => {
    const genau = durchgang([
      [1, 0],
      [2, 300],
      [3, 900],
      [4, 1200],
      [5, 1500],
      [6, 1800],
      [ENDE, 3600],
    ]);
    const rb = rueckblickAus(liste, ohne(genau))!;
    expect(rb.eingeholt).toBeNull();
    expect(rb.ueberzogen).toBeNull();
  });

  it('Fehlklick: die kurzen Stopps zählen nicht, der Punkt läuft mit seiner alten Zeit weiter', () => {
    // Begrüßung 09:05, „Weiter“ nach 9:55 auf Lied 1, 5 s später wieder „Zurück“: Begrüßung läuft weiter, Lied 1 zählt nicht
    const v = durchgang([
      [1, 0],
      [2, 300],
      [3, 300 + 595],
      [2, 300 + 600],
      [3, 300 + 640],
      [4, 300 + 940],
      [5, 300 + 1240],
      [6, 300 + 1540],
      [ENDE, 300 + 1540 + 1800],
    ]);
    const rb = rueckblickAus(liste, ohne(v))!;
    expect(rb.zeilen.find((z) => z.punkt.id === 2)?.gelaufenSek).toBe(640);
    // Das Lied begann erst bei 300+640, davor zählt der Fehlklick nicht
    expect(rb.zeilen.find((z) => z.punkt.id === 3)?.gelaufenSek).toBe(300);
  });

  it('Lieder ohne Plan-Dauer haben kein ±', () => {
    const l = liveListe(
      [{ id: 9, title: 'Lied', type: 'song', duration: 0, song: songMit('X') }],
      EVENT,
    );
    const rb = rueckblickAus(
      l,
      ohne(
        durchgang(
          [
            [1, 0],
            [2, 120],
          ],
          T0,
          l,
        ),
      ),
    )!;
    expect(rb.zeilen[0]).toMatchObject({ planSek: null, abweichungSek: null, gelaufenSek: 120 });
  });

  it('Punkte, die nie dran waren, stehen nicht in der Tabelle', () => {
    const v = durchgang([
      [1, 0],
      [2, 300],
      [5, 900],
      [ENDE, 1200],
    ]);
    const rb = rueckblickAus(liste, ohne(v))!;
    expect(rb.zeilen.map((z) => z.punkt.id)).toEqual([1, 2, 5]);
  });
});

describe('Aus dem Schnitt nehmen im Rückblick (A9)', () => {
  const v = durchgang(NACH_PLAN);

  it('ein ausgenommener Punkt bleibt in der Tabelle, zählt aber nicht für überzogen/eingeholt', () => {
    const aus = ausnahmeSetzen([], 6, true, T0);
    const rb = rueckblickAus(liste, { wechsel: v, ausnahmen: aus })!;
    expect(rb.zeilen.find((z) => z.punkt.id === 6)?.ausgenommen).toBe(true);
    expect(rb.zeilen.find((z) => z.punkt.id === 2)?.ausgenommen).toBe(false);
    expect(rb.ueberzogen).toBeNull();
    expect(rueckblickAus(liste, ohne(v))!.ueberzogen?.punkt.id).toBe(6);
  });

  it('die Rücknahme macht ihn wieder zählend', () => {
    const aus = ausnahmeSetzen([], 6, true, T0);
    const zurueck = ausnahmeSetzen(aus, 6, false, T0 - 1000); // auch bei nachgehender Uhr
    const rb = rueckblickAus(liste, { wechsel: v, ausnahmen: zurueck })!;
    expect(rb.zeilen.find((z) => z.punkt.id === 6)?.ausgenommen).toBe(false);
    expect(rb.ueberzogen?.punkt.id).toBe(6);
  });

  it('ist der Termin ausgenommen, steht das im Rückblick', () => {
    const rb = rueckblickAus(liste, { wechsel: v, ausnahmen: ausnahmeSetzen([], null, true, T0) })!;
    expect(rb.terminAusgenommen).toBe(true);
    expect(rueckblickAus(liste, ohne(v))!.terminAusgenommen).toBe(false);
  });
});

describe('schnittSchluessel', () => {
  it('alle Lieder gemeinsam, sonst der Titel (ohne Groß-/Kleinschreibung und Randleerzeichen)', () => {
    expect(schnittSchluessel('Halleluja', true)).toBe(schnittSchluessel('Gnade', true));
    expect(schnittSchluessel(' Predigt ', false)).toBe(schnittSchluessel('predigt', false));
    expect(schnittSchluessel('Predigt', false)).not.toBe(schnittSchluessel('Gebet', false));
  });

  it('ein Punkt namens „Lied“, der kein Lied ist, zählt nicht mit den Liedern', () => {
    expect(schnittSchluessel('Lied', false)).not.toBe(schnittSchluessel('Lied', true));
  });

  it('ohne Titel kein Schlüssel – außer bei Liedern', () => {
    expect(schnittSchluessel('  ', false)).toBeNull();
    expect(schnittSchluessel('', true)).not.toBeNull();
  });
});

describe('schnittAus – Ø bisher (T5)', () => {
  /** Ein Termin: Begrüßung `begruessung` s, Lieder je `lied` s, Predigt `predigt` s – alles aus den Erzeugern. */
  function termin(begruessung: number, lied: number, predigt: number): Wechsel[] {
    const t1 = begruessung;
    const t2 = t1 + lied;
    const t3 = t2 + lied;
    return durchgang([
      [2, 0],
      [3, t1],
      [4, t2],
      [6, t3],
      [ENDE, t3 + predigt],
    ]);
  }

  it('rechnet den Durchschnitt je Titel aus allen Terminen', () => {
    const s = schnittAus([ohne(termin(480, 240, 2000)), ohne(termin(600, 360, 1800))]);
    expect(s.get(schnittSchluessel('Begrüßung', false)!)).toEqual({ sek: 540, n: 2 });
    expect(s.get(schnittSchluessel('Predigt', false)!)).toEqual({ sek: 1900, n: 2 });
  });

  it('alle Lieder zählen zusammen als „Lied“', () => {
    const s = schnittAus([ohne(termin(480, 240, 2000)), ohne(termin(600, 360, 1800))]);
    // Zwei Lieder je Termin (Halleluja/Gnade): 240, 240, 360, 360 → Ø 300, n = 4
    expect(s.get('lied')).toEqual({ sek: 300, n: 4 });
    expect([...s.keys()].some((k) => k.includes('halleluja'))).toBe(false);
  });

  it('nur Termine, deren Live zu Ende ist', () => {
    const offen = ohne(termin(480, 240, 2000).slice(0, -1)); // ohne Ende
    const s = schnittAus([offen, ohne(termin(600, 360, 1800))]);
    expect(s.get(schnittSchluessel('Begrüßung', false)!)).toEqual({ sek: 600, n: 1 });
  });

  it('Werte ohne Titel zählen nicht', () => {
    const ohneTitel = termin(480, 240, 2000).map((w) => ({ ...w, titel: '' }));
    expect(schnittAus([ohne(ohneTitel)]).size).toBe(0);
  });

  it('ein ausgenommener Punkt zählt nicht – in diesem Termin, in den anderen schon', () => {
    const a = { wechsel: termin(480, 240, 6000), ausnahmen: ausnahmeSetzen([], 6, true, T0) };
    const s = schnittAus([a, ohne(termin(600, 360, 1800))]);
    expect(s.get(schnittSchluessel('Predigt', false)!)).toEqual({ sek: 1800, n: 1 });
    expect(s.get(schnittSchluessel('Begrüßung', false)!)).toEqual({ sek: 540, n: 2 });
  });

  it('ein ausgenommener Termin zählt gar nicht', () => {
    const a = { wechsel: termin(480, 240, 6000), ausnahmen: ausnahmeSetzen([], null, true, T0) };
    const s = schnittAus([a, ohne(termin(600, 360, 1800))]);
    expect(s.get(schnittSchluessel('Predigt', false)!)).toEqual({ sek: 1800, n: 1 });
    expect(s.get('lied')).toEqual({ sek: 360, n: 2 });
  });

  it('eine zurückgenommene Markierung zählt wieder', () => {
    const aus: Ausnahme[] = ausnahmeSetzen(ausnahmeSetzen([], 6, true, T0), 6, false, T0);
    const s = schnittAus([{ wechsel: termin(480, 240, 6000), ausnahmen: aus }]);
    expect(s.get(schnittSchluessel('Predigt', false)!)).toEqual({ sek: 6000, n: 1 });
  });

  it('Fehlklick-Stopps zählen im Schnitt nicht – dieselbe Rechnung wie im Rückblick', () => {
    const v = durchgang([
      [2, 0],
      [3, 595],
      [2, 600],
      [3, 640],
      [ENDE, 940],
    ]);
    const s = schnittAus([ohne(v)]);
    const rb = rueckblickAus(liste, ohne(v))!;
    expect(s.get(schnittSchluessel('Begrüßung', false)!)?.sek).toBe(
      rb.zeilen.find((z) => z.punkt.id === 2)?.gelaufenSek,
    );
    expect(s.get(schnittSchluessel('Begrüßung', false)!)?.sek).toBe(640);
  });

  it('ohne Verläufe: leer', () => {
    expect(schnittAus([]).size).toBe(0);
  });
});
