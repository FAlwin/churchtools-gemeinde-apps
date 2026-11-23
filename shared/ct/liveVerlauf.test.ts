import { describe, expect, it } from 'vitest';
import {
  liveLage,
  liveListe,
  liveStandAus,
  kontoSek,
  type LivePunkt,
  type LiveStand,
} from './liveAgenda';
import {
  abweichungen,
  enthaelt,
  FEHLKLICK_MS,
  hatWechsel,
  laeufeAus,
  nachzutragen,
  prognose,
  warumPunkte,
  wechselAus,
  wechselBeiKlick,
  wirksamerStand,
  zusammenfuehren,
  type Wechsel,
} from './liveVerlauf';
import type { CtAgendaItem } from './typen';

const EVENT = 216;
const T0 = Date.parse('2027-03-07T09:00:00Z');
const MIN = 60_000;

/** Fünf Punkte à 5 Minuten (Plan 09:00–09:25) – wie `liveListe` sie aus dem Ablauf von ChurchTools macht. */
const ITEMS: CtAgendaItem[] = ['A', 'B', 'C', 'D', 'E'].map((titel, i) => ({
  id: 100 + i,
  title: titel,
  type: 'text',
  duration: 300,
  startTimes: { [String(EVENT)]: new Date(T0 + i * 5 * MIN).toISOString() },
}));
const liste: LivePunkt[] = liveListe(ITEMS, EVENT);
const ENDE = liste.length + 1;

/** Ein Stand von ChurchTools – über `liveStandAus`, also mit den Antworten, wie ChurchTools sie liefert. */
function standVon(
  stelle: number | null,
  zeit: number | null,
  zusatz = 0,
  jetzt = zeit ?? T0,
): LiveStand {
  return liveStandAus({
    pos_id: stelle === null ? null : String(stelle),
    switchdate: zeit === null ? null : new Date(zeit).toISOString(),
    addseconds: String(zusatz),
    currentTime: jetzt,
  }) as LiveStand;
}

/**
 * Eine Sitzung am Mischpult: Jeder `klick` schaltet auf eine Stelle, `nach` Sekunden nach dem vorigen Klick, und hält fest,
 * was `wechselBeiKlick` verlangt – samt Ausgleich, wie die Live-Ansicht es schreibt. Die Wechsel entstehen so aus den
 * Erzeugern, nicht aus handgeschriebenen Literalen.
 */
function sitzung(start = T0) {
  let verlauf: Wechsel[] = [];
  let stand: LiveStand | null = null;
  let t = start;
  const s = {
    get verlauf() {
      return verlauf;
    },
    get stand() {
      return stand;
    },
    get zeit() {
      return t;
    },
    klick(ziel: number, nachSek: number) {
      t += nachSek * 1000;
      const neu = standVon(ziel, t);
      const wirksam = wirksamerStand(stand, laeufeAus(verlauf).laeufe);
      const k = wechselBeiKlick(verlauf, liste, stand, wirksam?.zusatzSek ?? 0, neu);
      let neue = k.neue;
      let gesetzt = neu;
      if (k.fortsetzung) {
        const f = k.fortsetzung;
        neue = neue.map((w) =>
          w.zeit === t && w.stelle === ziel ? { ...w, ausgleich: f.ausgleich } : w,
        );
        gesetzt = standVon(ziel, t, f.ausgleich);
      }
      verlauf = zusammenfuehren(verlauf, neue);
      stand = gesetzt;
      return k;
    },
    /** „Neu starten“: der Wechsel am Stand wird zum normalen, CT bekommt Zusatzzeit 0 zurück. */
    neuStarten() {
      if (!stand || stand.stelle === null || stand.seit === null) throw new Error('kein Stand');
      const { stelle, seit } = stand;
      verlauf = zusammenfuehren(verlauf, [
        { ...(verlauf.find((w) => w.zeit === seit && w.stelle === stelle) as Wechsel), neu: true },
      ]);
      stand = standVon(stelle, seit, 0);
    },
    /** Der Stand nach `nachSek` weiteren Sekunden – `liveLage` zeigt dann, was die Anzeige zeigt. */
    lage(nachSek = 0, art: 'immer-uhr' | 'klicken' = 'klicken') {
      const jetzt = t + nachSek * 1000;
      const eff = wirksamerStand(stand, laeufeAus(verlauf).laeufe);
      return { lage: liveLage(liste, eff, jetzt, art), jetzt, eff };
    },
  };
  return s;
}

const stellen = (v: readonly Wechsel[]) => v.map((w) => w.stelle);

describe('zusammenfuehren – kein Doppel, nichts geht verloren', () => {
  const a = wechselAus(liste, 1, T0);
  const b = wechselAus(liste, 2, T0 + 300_000, 12);

  it('gleicher switchdate und gleiche Stelle = derselbe Wechsel, auch aus beiden Richtungen', () => {
    expect(zusammenfuehren([a, b], [b])).toEqual([a, b]);
    expect(zusammenfuehren([b], [a, b])).toEqual([a, b]);
    expect(zusammenfuehren([a, a], [a])).toHaveLength(1);
  });

  it('sortiert nach Zeit; gleiche Zeit, andere Stelle sind zwei Wechsel', () => {
    expect(zusammenfuehren([b], [a]).map((w) => w.zeit)).toEqual([T0, T0 + 300_000]);
    expect(zusammenfuehren([a], [{ ...a, stelle: 2 }])).toHaveLength(2);
  });

  it('Felder, die nur eine Seite kennt, bleiben; „neu“ und „ausgleich“ gehen nie verloren', () => {
    const gepflegt = { ...b, ausgleich: -40 };
    expect(zusammenfuehren([gepflegt], [b])[0]).toMatchObject({ ausgleich: -40, zusatzDavor: 12 });
    expect(zusammenfuehren([b], [gepflegt])[0]).toMatchObject({ ausgleich: -40, zusatzDavor: 12 });
    expect(zusammenfuehren([{ ...b, neu: true }], [b])[0].neu).toBe(true);
    expect(zusammenfuehren([b], [{ ...b, neu: true }])[0].neu).toBe(true);
  });

  it('enthaelt: gleicher Wechsel mit allen gesetzten Feldern, „neu“ nur, wenn es dasteht', () => {
    expect(enthaelt([a, b], [b])).toBe(true);
    expect(enthaelt([a], [b])).toBe(false);
    expect(enthaelt([{ ...b, zusatzDavor: 99 }], [b])).toBe(false);
    expect(enthaelt([b], [{ ...b, ausgleich: 5 }])).toBe(false);
    expect(enthaelt([b], [{ ...b, neu: true }])).toBe(false);
    expect(enthaelt([{ ...b, neu: true }], [b])).toBe(true);
  });

  it('hatWechsel prüft Zeit UND Stelle', () => {
    expect(hatWechsel([a], T0, 1)).toBe(true);
    expect(hatWechsel([a], T0, 2)).toBe(false);
    expect(hatWechsel([a], T0 + 1000, 1)).toBe(false);
  });
});

describe('wechselAus', () => {
  it('Punkt-ID und Titel kommen aus der Liste – bei „nicht gestartet“ und „Ende“ keine', () => {
    expect(wechselAus(liste, 2, T0)).toEqual({
      stelle: 2,
      punktId: liste[1].id,
      titel: 'B',
      zeit: T0,
    });
    expect(wechselAus(liste, 0, T0)).toMatchObject({ punktId: null, titel: '' });
    expect(wechselAus(liste, ENDE, T0)).toMatchObject({ punktId: null, titel: '' });
  });
});

describe('laeufeAus – normaler Verlauf', () => {
  it('jeder Wechsel schließt den vorigen Lauf; der letzte läuft', () => {
    const s = sitzung();
    s.klick(1, 0);
    s.klick(2, 300);
    s.klick(3, 290);
    const { laeufe, uebersprungen } = laeufeAus(s.verlauf);
    expect(laeufe.map((l) => [l.stelle, l.seit, l.bis])).toEqual([
      [1, T0, T0 + 300_000],
      [2, T0 + 300_000, T0 + 590_000],
      [3, T0 + 590_000, null],
    ]);
    expect(uebersprungen).toEqual([]);
  });

  it('die Zusatzzeit beim Verlassen kommt aus dem nächsten Wechsel', () => {
    const s = sitzung();
    s.klick(1, 0);
    // Zwei Minuten dazu, dann weiter: der Wechsel trägt „zusatzDavor“.
    const neu = standVon(2, T0 + 400_000);
    const k = wechselBeiKlick(s.verlauf, liste, s.stand, 120, neu);
    const l = laeufeAus(zusammenfuehren(s.verlauf, k.neue)).laeufe;
    expect(l[0].zusatzSek).toBe(120);
  });

  it('die Reihenfolge der Eingabe spielt keine Rolle', () => {
    const s = sitzung();
    s.klick(1, 0);
    s.klick(2, 100);
    s.klick(3, 100);
    expect(laeufeAus([...s.verlauf].reverse())).toEqual(laeufeAus(s.verlauf));
  });
});

describe('laeufeAus – Fehlklick (A19)', () => {
  it('Weiter, nach 10 s wieder Zurück: der Punkt läuft mit seiner alten Zeit weiter', () => {
    const s = sitzung();
    s.klick(2, 0);
    const beginnB = s.zeit;
    s.klick(3, 120); // B hat 2 Minuten gedauert, Weiter auf C
    s.klick(2, 10); // … doch ein Fehlklick: Zurück auf B
    const { laeufe, uebersprungen } = laeufeAus(s.verlauf);
    expect(laeufe).toHaveLength(1);
    expect(laeufe[0]).toMatchObject({ stelle: 2, seit: beginnB, bis: null, fortgesetzt: true });
    // Der kurze Stopp auf C zählt nicht – er steht für den Rückblick als „übersprungen“ da.
    expect(stellen(uebersprungen)).toEqual([3]);
  });

  it('Zurück, nach 5 s wieder Weiter (andersherum): der Punkt, bei dem man war, läuft weiter', () => {
    const s = sitzung();
    s.klick(1, 0);
    s.klick(2, 200);
    const beginnB = s.zeit;
    s.klick(1, 200); // B lief schon 200 s – Zurück auf A (A war schon einmal dran)
    s.klick(2, 5); // Weiter: B wieder
    const { laeufe, uebersprungen } = laeufeAus(s.verlauf);
    expect(laeufe.map((l) => l.stelle)).toEqual([1, 2]);
    expect(laeufe[1]).toMatchObject({ seit: beginnB, bis: null, fortgesetzt: true });
    // A ist nur einmal gelaufen (die 200 Sekunden davor); der Stopp bei 5 s zählt nicht.
    expect(laeufe[0].bis).toBe(beginnB);
    expect(stellen(uebersprungen)).toEqual([1]);
  });

  it('war B vor dem Zurück selbst nur ein Fehlklick, bleibt A der Punkt, bei dem man war', () => {
    const s = sitzung();
    s.klick(1, 0);
    s.klick(2, 200);
    s.klick(1, 5); // B lief nur 5 s – Zurück auf A: A läuft weiter
    expect(laeufeAus(s.verlauf).laeufe).toMatchObject([{ stelle: 1, seit: T0, fortgesetzt: true }]);
  });

  it('mehrere Schritte: C, D und wieder zurück auf B – alles dazwischen unter 30 s', () => {
    const s = sitzung();
    s.klick(2, 0);
    const beginnB = s.zeit;
    s.klick(3, 100);
    s.klick(4, 8);
    s.klick(3, 6); // C: Fortsetzung von C
    s.klick(2, 4); // B: Fortsetzung von B
    const { laeufe, uebersprungen } = laeufeAus(s.verlauf);
    expect(laeufe).toHaveLength(1);
    expect(laeufe[0]).toMatchObject({ stelle: 2, seit: beginnB, fortgesetzt: true });
    expect(uebersprungen.map((w) => w.stelle).sort()).toEqual([3, 3, 4]);
  });

  it('ab genau 30 Sekunden dazwischen ist es ein normaler Wechsel', () => {
    const s = sitzung();
    s.klick(2, 0);
    s.klick(3, 100);
    s.klick(2, FEHLKLICK_MS / 1000); // C war genau 30 s dran
    const { laeufe } = laeufeAus(s.verlauf);
    expect(laeufe.map((l) => [l.stelle, l.fortgesetzt])).toEqual([
      [2, false],
      [3, false],
      [2, false],
    ]);
  });

  it('29 Sekunden zählen noch als Fehlklick', () => {
    const s = sitzung();
    s.klick(2, 0);
    s.klick(3, 100);
    s.klick(2, 29);
    expect(laeufeAus(s.verlauf).laeufe).toHaveLength(1);
  });

  it('ein einziger langer Stopp dazwischen macht es normal – auch wenn die anderen kurz waren', () => {
    const s = sitzung();
    s.klick(2, 0);
    s.klick(3, 100);
    s.klick(4, 5); // C: 5 s
    s.klick(5, 40); // D: 40 s
    s.klick(2, 5); // zurück auf B: dazwischen lag D mit 40 s
    expect(laeufeAus(s.verlauf).laeufe.map((l) => l.stelle)).toEqual([2, 3, 4, 5, 2]);
  });

  it('auf einen Punkt, der noch nie dran war, gibt es nichts fortzusetzen', () => {
    const s = sitzung();
    s.klick(1, 0);
    s.klick(2, 100);
    s.klick(3, 5);
    expect(laeufeAus(s.verlauf).laeufe.map((l) => [l.stelle, l.fortgesetzt])).toEqual([
      [1, false],
      [2, false],
      [3, false],
    ]);
  });

  it('„nicht gestartet“ (Stelle 0) wird nie fortgesetzt', () => {
    const s = sitzung();
    s.klick(0, 0);
    s.klick(1, 5);
    s.klick(0, 5);
    expect(laeufeAus(s.verlauf).laeufe.map((l) => l.fortgesetzt)).toEqual([false, false, false]);
  });

  it('das „Ende“ ist ein Stopp wie jeder: Weiter bis Ende, gleich Zurück auf den letzten Punkt', () => {
    const s = sitzung();
    s.klick(5, 0);
    const beginnE = s.zeit;
    s.klick(ENDE, 200);
    s.klick(5, 3);
    expect(laeufeAus(s.verlauf).laeufe).toMatchObject([
      { stelle: 5, seit: beginnE, fortgesetzt: true },
    ]);
  });

  it('„Neu starten“: derselbe Wechsel zählt als normaler', () => {
    const s = sitzung();
    s.klick(2, 0);
    s.klick(3, 100);
    s.klick(2, 10);
    expect(laeufeAus(s.verlauf).laeufe).toHaveLength(1);
    s.neuStarten();
    const { laeufe, uebersprungen } = laeufeAus(s.verlauf);
    expect(laeufe.map((l) => [l.stelle, l.fortgesetzt])).toEqual([
      [2, false],
      [3, false],
      [2, false],
    ]);
    expect(uebersprungen).toEqual([]);
    expect(laeufe[2].seit).toBe(s.zeit);
  });

  it('nach einem Fehlklick zählt der nächste Wechsel wieder normal', () => {
    const s = sitzung();
    s.klick(2, 0);
    s.klick(3, 100);
    s.klick(2, 10);
    s.klick(3, 60);
    expect(laeufeAus(s.verlauf).laeufe.map((l) => l.stelle)).toEqual([2, 3]);
  });

  it('zweimal hintereinander versehentlich – der Punkt bleibt der alte', () => {
    const s = sitzung();
    s.klick(2, 0);
    const beginnB = s.zeit;
    s.klick(3, 100);
    s.klick(2, 5);
    s.klick(3, 5);
    s.klick(2, 5);
    const { laeufe } = laeufeAus(s.verlauf);
    expect(laeufe).toHaveLength(1);
    expect(laeufe[0].seit).toBe(beginnB);
  });
});

describe('wechselBeiKlick – was ein Klick festhält', () => {
  it('der erste Klick hält nur den neuen Wechsel fest', () => {
    const k = wechselBeiKlick([], liste, null, 0, standVon(1, T0));
    expect(k.neue).toEqual([wechselAus(liste, 1, T0)]);
    expect(k.fortsetzung).toBeNull();
  });

  it('fehlt der verlassene Punkt im Verlauf, kommt er mit (das Gerät war nicht dabei)', () => {
    const vorher = standVon(2, T0 + 300_000);
    const k = wechselBeiKlick([], liste, vorher, 0, standVon(3, T0 + 500_000));
    expect(k.neue.map((w) => [w.stelle, w.zeit])).toEqual([
      [2, T0 + 300_000],
      [3, T0 + 500_000],
    ]);
    expect(k.neue[1].zusatzDavor).toBe(0);
  });

  it('kein Wechsel (gleiche Stelle und gleicher switchdate, z. B. ±1 Min) → nichts festhalten', () => {
    const vorher = standVon(2, T0);
    expect(
      wechselBeiKlick([wechselAus(liste, 2, T0)], liste, vorher, 0, standVon(2, T0, 60)),
    ).toEqual({
      neue: [],
      fortsetzung: null,
    });
  });

  it('ohne Zeitpunkt oder Stelle (nie gestartet) nichts', () => {
    expect(wechselBeiKlick([], liste, null, 0, standVon(null, null)).neue).toEqual([]);
  });

  it('Fehlklick: Ausgleich = alte Zusatzzeit − schon gelaufene Sekunden', () => {
    const s = sitzung();
    s.klick(2, 0);
    s.klick(3, 120); // B lief 120 s
    // B hatte beim Verlassen 60 s Zusatzzeit (zusatzDavor am Wechsel auf C)
    const vorher = s.stand;
    const mitZusatz = zusammenfuehren(
      s.verlauf.filter((w) => w.stelle !== 3),
      [{ ...(s.verlauf.find((w) => w.stelle === 3) as Wechsel), zusatzDavor: 60 }],
    );
    const k = wechselBeiKlick(mitZusatz, liste, vorher, 0, standVon(2, s.zeit + 10_000));
    // Beginn von B war T0; der Klick zurück kommt bei T0 + 130 s → 130 s gelaufen, 60 s Zusatz → 60 − 130 = −70.
    expect(k.fortsetzung).toEqual({ seit: T0, zusatzSek: 60, ausgleich: -70 });
  });

  it('die Rückkehr zeigt auch ohne Ausgleich (Schreiben gescheitert) nur die Rechnung – kein Ausgleich im Wechsel', () => {
    const s = sitzung();
    s.klick(2, 0);
    s.klick(3, 100);
    const k = wechselBeiKlick(s.verlauf, liste, s.stand, 0, standVon(2, s.zeit + 10_000));
    expect(k.fortsetzung).not.toBeNull();
    expect(k.neue[k.neue.length - 1].ausgleich).toBeUndefined();
  });
});

describe('wirksamerStand – was CT zeigt, bereinigt um Fehlklick und Ausgleich', () => {
  it('ohne Fortsetzung bleibt der Stand, wie er ist', () => {
    const s = sitzung();
    s.klick(2, 0);
    s.klick(3, 100);
    const eff = wirksamerStand(s.stand, laeufeAus(s.verlauf).laeufe);
    expect(eff).toEqual(s.stand);
  });

  it('ohne Stand oder ohne Verlauf bleibt es beim Stand', () => {
    expect(wirksamerStand(null, [])).toBeNull();
    const st = standVon(2, T0 + 5);
    expect(wirksamerStand(st, [])).toBe(st);
    const nie = standVon(null, null);
    expect(wirksamerStand(nie, laeufeAus([wechselAus(liste, 1, T0)]).laeufe)).toBe(nie);
  });

  it('nach dem Fehlklick: früherer Beginn, Zusatzzeit von damals – der Ausgleich in CT ist herausgerechnet', () => {
    const s = sitzung();
    s.klick(2, 0);
    s.klick(3, 120);
    s.klick(2, 10);
    const eff = wirksamerStand(s.stand, laeufeAus(s.verlauf).laeufe);
    expect(eff).toMatchObject({ stelle: 2, seit: T0, zusatzSek: 0 });
    // CT selbst steht auf dem neuen switchdate mit Ausgleich in addseconds.
    expect(s.stand?.seit).toBe(T0 + 130_000);
    expect(s.stand?.zusatzSek).toBe(-130);
  });

  it('„+1 Min“ nach der Rückkehr kommt dazu – genau eine Minute', () => {
    const s = sitzung();
    s.klick(2, 0);
    s.klick(3, 120);
    s.klick(2, 10);
    const roh = s.stand as LiveStand;
    const plus = { ...roh, zusatzSek: roh.zusatzSek + 60 };
    expect(wirksamerStand(plus, laeufeAus(s.verlauf).laeufe)?.zusatzSek).toBe(60);
  });

  it('gescheiterter Ausgleich (CT steht auf 0, Wechsel ohne „ausgleich“): unsere Zeit stimmt trotzdem', () => {
    const s = sitzung();
    s.klick(2, 0);
    s.klick(3, 120);
    // Rückkehr auf B, CT-Schreiben des Ausgleichs scheitert: im Verlauf steht kein „ausgleich“, CT hat addseconds 0.
    const neu = standVon(2, s.zeit + 10_000, 0);
    const k = wechselBeiKlick(s.verlauf, liste, s.stand, 0, neu);
    const verlauf = zusammenfuehren(s.verlauf, k.neue);
    expect(wirksamerStand(neu, laeufeAus(verlauf).laeufe)).toMatchObject({
      seit: T0,
      zusatzSek: 0,
    });
  });

  it('die Restzeit läuft weiter, als wäre man nie weg gewesen – und CT (mit Ausgleich) zeigt dieselbe', () => {
    const s = sitzung();
    s.klick(2, 0); // B beginnt bei T0, Dauer 300 s
    s.klick(3, 120);
    s.klick(2, 10); // zurück bei T0 + 130 s
    const { lage, eff } = s.lage(50); // T0 + 180 s: 120 s Rest
    expect(lage).toMatchObject({ art: 'laeuft', stelle: 2, restSek: 120, dauerSek: 300 });
    // Was die CT-Live-Agenda aus dem rohen Stand rechnet: Dauer + addseconds − (jetzt − switchdate).
    const roh = s.stand as LiveStand;
    const ct = 300 + roh.zusatzSek - (s.zeit + 50_000 - (roh.seit as number)) / 1000;
    expect(ct).toBe(120);
    expect(eff?.seit).toBe(T0);
  });

  it('das Zeitkonto ist dasselbe wie ohne Fehlklick', () => {
    const glatt = sitzung();
    glatt.klick(2, 0);
    const mit = sitzung();
    mit.klick(2, 0);
    mit.klick(3, 120);
    mit.klick(2, 10);
    const a = kontoSek(liste[1], glatt.stand?.seit as number, T0 + 200_000);
    const b = kontoSek(liste[1], mit.lage(70).eff?.seit as number, T0 + 200_000);
    expect(b).toBe(a);
  });

  it('gehört der Stand nicht zum letzten Lauf (Verlauf veraltet), bleibt er roh', () => {
    const s = sitzung();
    s.klick(2, 0);
    s.klick(3, 120);
    s.klick(2, 10);
    const anders = standVon(4, s.zeit + 60_000);
    expect(wirksamerStand(anders, laeufeAus(s.verlauf).laeufe)).toBe(anders);
  });
});

describe('abweichungen – ± je Punkt (A14)', () => {
  it('geplante minus gelaufene Dauer: früher = Plus, überzogen = Minus', () => {
    const s = sitzung();
    s.klick(1, 0);
    s.klick(2, 260); // A: 40 s gespart
    s.klick(3, 340); // B: 40 s überzogen
    s.klick(4, 300); // C: genau im Plan
    const a = abweichungen(liste, laeufeAus(s.verlauf).laeufe, s.zeit + 10_000);
    expect(a.get(liste[0].id)).toEqual({ sek: 40, laeuft: false });
    expect(a.get(liste[1].id)).toEqual({ sek: -40, laeuft: false });
    expect(a.get(liste[2].id)).toEqual({ sek: 0, laeuft: false });
    expect(Object.is(a.get(liste[2].id)?.sek, -0)).toBe(false);
  });

  it('der laufende Punkt fehlt, solange er in der Zeit ist, und kommt mit seinem Minus, sobald er überzieht', () => {
    const s = sitzung();
    s.klick(1, 0);
    expect(abweichungen(liste, laeufeAus(s.verlauf).laeufe, T0 + 100_000).size).toBe(0);
    expect(abweichungen(liste, laeufeAus(s.verlauf).laeufe, T0 + 300_000).size).toBe(0);
    expect(abweichungen(liste, laeufeAus(s.verlauf).laeufe, T0 + 345_000).get(liste[0].id)).toEqual(
      {
        sek: -45,
        laeuft: true,
      },
    );
  });

  it('„−1 / +1 Min“ ändert das ± nicht (gerechnet gegen den ursprünglichen Plan)', () => {
    const s = sitzung();
    s.klick(1, 0);
    const k = wechselBeiKlick(s.verlauf, liste, s.stand, 120, standVon(2, T0 + 280_000));
    const a = abweichungen(
      liste,
      laeufeAus(zusammenfuehren(s.verlauf, k.neue)).laeufe,
      T0 + 290_000,
    );
    expect(a.get(liste[0].id)?.sek).toBe(20);
  });

  it('Fehlklick: die kurzen Stopps zählen nicht, der Punkt zählt von seinem ersten Beginn an', () => {
    const s = sitzung();
    s.klick(1, 0);
    s.klick(2, 100); // A: 100 s
    s.klick(3, 200); // B: 200 s
    s.klick(2, 8); // Fehlklick auf C, zurück auf B
    s.klick(3, 90); // B insgesamt 200 + 8 + 90 = 298 s, dann C regulär
    const a = abweichungen(liste, laeufeAus(s.verlauf).laeufe, s.zeit + 5_000);
    expect(a.get(liste[1].id)?.sek).toBe(2);
    // C lief nur die 8 s des Fehlklicks – und zählt dafür nicht: sein Lauf beginnt erst mit dem regulären Wechsel.
    expect(a.get(liste[2].id)).toBeUndefined();
  });

  it('ein Punkt, der zweimal dran war (normaler Wechsel), zählt beide Läufe zusammen', () => {
    const s = sitzung();
    s.klick(1, 0);
    s.klick(2, 100);
    s.klick(1, 60); // B 60 s, zurück auf A (60 s ≥ 30 → normaler Wechsel)
    s.klick(2, 100); // A noch einmal 100 s
    const a = abweichungen(liste, laeufeAus(s.verlauf).laeufe, s.zeit + 5_000);
    expect(a.get(liste[0].id)?.sek).toBe(300 - 200);
  });

  it('weggelassene Punkte und Lieder ohne Dauer haben kein ±', () => {
    const mit = liveListe(
      [
        ITEMS[0],
        { ...ITEMS[1], startTimes: { [String(EVENT)]: null } },
        {
          ...ITEMS[2],
          duration: 0,
          song: { title: 'Lied', songId: 1, arrangementId: 1 } as CtAgendaItem['song'],
        },
      ],
      EVENT,
    );
    const laeufe = laeufeAus([
      wechselAus(mit, 1, T0),
      wechselAus(mit, 2, T0 + 100_000),
      wechselAus(mit, 3, T0 + 200_000),
      wechselAus(mit, 4, T0 + 300_000),
    ]).laeufe;
    const a = abweichungen(mit, laeufe, T0 + 400_000);
    expect([...a.keys()]).toEqual([mit[0].id]);
  });

  it('Läufe ohne Punkt („nicht gestartet“, „Ende“) werden nicht gezählt', () => {
    const s = sitzung();
    s.klick(0, 0);
    s.klick(1, 10);
    s.klick(ENDE, 500);
    const a = abweichungen(liste, laeufeAus(s.verlauf).laeufe, s.zeit + 1000);
    expect([...a.keys()]).toEqual([liste[0].id]);
  });
});

describe('warumPunkte – die drei größten Abweichungen', () => {
  function abw(sekunden: number[]) {
    const s = sitzung();
    let t = 0;
    sekunden.forEach((dauerPlan, i) => {
      s.klick(i + 1, i === 0 ? 0 : t);
      t = dauerPlan;
    });
    s.klick(sekunden.length + 1, t);
    return abweichungen(liste, laeufeAus(s.verlauf).laeufe, s.zeit + 1000);
  }

  it('nach Betrag, egal ob Plus oder Minus; höchstens drei', () => {
    // Läufe: A 260 s (+40), B 380 s (−80), C 290 s (+10), D 400 s (−100) – E noch nicht dran
    const a = abw([260, 380, 290, 400]);
    const w = warumPunkte(liste, a);
    expect(w.map((x) => [x.punkt.title, x.sek])).toEqual([
      ['D', -100],
      ['B', -80],
      ['A', 40],
    ]);
  });

  it('nichts, wenn alles im Plan ist; bei Gleichstand der frühere Punkt', () => {
    expect(warumPunkte(liste, abw([300, 300]))).toEqual([]);
    const gleich = warumPunkte(liste, abw([250, 350]));
    expect(gleich.map((x) => x.punkt.title)).toEqual(['A', 'B']);
  });

  it('der überziehende laufende Punkt gehört dazu', () => {
    const s = sitzung();
    s.klick(1, 0);
    s.klick(2, 290);
    const a = abweichungen(liste, laeufeAus(s.verlauf).laeufe, s.zeit + 400_000);
    expect(warumPunkte(liste, a).map((x) => [x.punkt.title, x.sek])).toEqual([
      ['B', -100],
      ['A', 10],
    ]);
  });
});

describe('prognose – „Ende voraussichtlich“ (A14)', () => {
  it('Plan-Ende minus Zeitkonto, auf die Minute', () => {
    const planEnde = T0 + 25 * MIN;
    expect(prognose(liste, 0)).toEqual({ ende: planEnde, plan: planEnde, konto: 0 });
    expect(prognose(liste, 20)?.ende).toBe(planEnde); // 20 s gespart → 08:24:40 → Minute 25
    expect(prognose(liste, -380)).toMatchObject({ ende: planEnde + 6 * MIN, konto: -380 });
    expect(prognose(liste, 135)?.ende).toBe(planEnde - 2 * MIN);
  });

  it('ohne Konto oder ohne Plan-Zeit keine Prognose', () => {
    expect(prognose(liste, null)).toBeNull();
    expect(prognose([], 10)).toBeNull();
  });

  it('passt zur Lage: Konto der Anzeige in die Prognose', () => {
    const s = sitzung();
    s.klick(1, 0);
    s.klick(2, 360); // A hat 60 s überzogen → Rückstand
    const { lage } = s.lage(0);
    if (lage.art !== 'laeuft' || lage.konto === null) throw new Error('keine Lage');
    expect(lage.konto).toBe(-60);
    expect(prognose(liste, lage.konto)?.ende).toBe(T0 + 26 * MIN);
  });
});

describe('nachzutragen – was ein offenes Gerät aus CT nachträgt', () => {
  it('ein Wechsel in CT, der im Verlauf fehlt, wird nachgetragen – mit Punkt und Zusatzzeit davor', () => {
    const st = standVon(3, T0 + 600_000);
    expect(nachzutragen([wechselAus(liste, 2, T0 + 300_000)], liste, st, 45)).toEqual({
      stelle: 3,
      punktId: liste[2].id,
      titel: 'C',
      zeit: T0 + 600_000,
      zusatzDavor: 45,
    });
  });

  it('gleicher switchdate und gleiche Stelle = kein Doppel', () => {
    const st = standVon(3, T0 + 600_000);
    expect(nachzutragen([wechselAus(liste, 3, T0 + 600_000)], liste, st)).toBeNull();
  });

  it('nichts ohne Stand, ohne Stelle oder ohne switchdate', () => {
    expect(nachzutragen([], liste, null)).toBeNull();
    expect(nachzutragen([], liste, standVon(null, null))).toBeNull();
  });
});
