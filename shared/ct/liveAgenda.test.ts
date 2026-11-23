import { describe, expect, it } from 'vitest';
import type { AltAnfragePort } from './altSchnittstelle';
import { diensteAus } from './dienste';
import {
  darfLiveSteuern,
  eigeneDienstgruppen,
  endeStelle,
  kontoSek,
  kontoText,
  kontoWort,
  liveInfoGruppen,
  liveLage,
  liveLesen,
  liveListe,
  liveSchreiben,
  liveStandAus,
  naechsteStelle,
  restText,
  STANDARD_BETRIEBSART,
  stelleNachziehen,
  uhrVersatz,
  vorigeStelle,
  weiterZiel,
  zurueckZiel,
  zusatzZiel,
  type Betriebsart,
  type LiveLage,
  type LiveStand,
} from './liveAgenda';
import type { CtAgendaItem } from './typen';

const EVENT = 216;
const ms = (iso: string) => Date.parse(iso);
/** `liveLage` mit „immer nach der Uhr“ als Vorgabe – so rechneten die Tests vor L4-2; die Betriebsarten prüft ein eigener Block. */
const lage = (
  liste: Parameters<typeof liveLage>[0],
  stand: Parameters<typeof liveLage>[1],
  jetzt: number,
  art: Betriebsart = 'immer-uhr',
): LiveLage => liveLage(liste, stand, jetzt, art);

/**
 * Der Ablauf des Probe-Termins 216 aus der Messung L0 (02.11.2026), so wie `GET /events/216/agenda` ihn lieferte –
 * „Lied“ per Auge weggelassen (`startTimes` null). Die CT-Live-Agenda zeigte dazu: 1 Begrüßung · 2 Lied · 3 Predigt ·
 * 4 Ansagen · 5 Segen · 6 „– Ende –“.
 */
const ABLAUF_L0: CtAgendaItem[] = [
  {
    id: 964,
    title: 'Ankommen',
    type: 'header',
    duration: 0,
    startTimes: { '216': '2027-03-07T09:00:00Z' },
  },
  {
    id: 966,
    title: 'Lobpreis',
    type: 'header',
    duration: 0,
    startTimes: { '216': '2027-03-07T09:00:00Z' },
  },
  {
    id: 968,
    title: 'Begrüßung',
    type: 'text',
    duration: 300,
    startTimes: { '216': '2027-03-07T09:00:00Z' },
  },
  { id: 970, title: 'Lied', type: 'text', duration: 240, startTimes: { '216': null } },
  {
    id: 972,
    title: 'Predigt',
    type: 'text',
    duration: 1800,
    startTimes: { '216': '2027-03-07T09:05:00Z' },
  },
  {
    id: 974,
    title: 'Ansagen',
    type: 'text',
    duration: 300,
    startTimes: { '216': '2027-03-07T09:35:00Z' },
  },
  {
    id: 976,
    title: 'Segen',
    type: 'text',
    duration: 300,
    startTimes: { '216': '2027-03-07T09:40:00Z' },
  },
];

/** Ein Lied ohne Dauer hinter der Begrüßung – ChurchTools springt mit „Weiter“ darüber. */
const MIT_LIED: CtAgendaItem[] = [
  ABLAUF_L0[2],
  {
    id: 980,
    title: 'Lied',
    type: 'song',
    duration: 0,
    startTimes: { '216': '2027-03-07T09:05:00Z' },
    song: { title: 'Wie groß', songId: 5, arrangementId: 7 } as CtAgendaItem['song'],
  },
  ABLAUF_L0[4],
];

class Fehler extends Error {
  constructor(readonly status: number | null) {
    super(`Fehler ${status}`);
  }
}

/**
 * ChurchTools nachgebaut, wie gemessen (02.11.2026): Werte als Zeichenketten, `switchdate` nur neu, wenn sich die
 * Stelle ändert, `addseconds` als Gesamtwert, `currentTime` die eigene Uhr.
 */
class CtLive implements AltAnfragePort {
  pos: string | null = null;
  switchdate: string | null = null;
  add: string | null = null;
  jetzt = ms('2027-03-07T09:00:00Z');
  geschrieben = 0;
  /** Schreiben meldet Erfolg, übernimmt aber nichts. */
  stumm = false;
  fehler: { lesen?: number | null; schreiben?: number | null } = {};
  anders: unknown = undefined;

  anfrage(func: string, felder: Record<string, string>): Promise<unknown> {
    if (func === 'saveAgendaLivePosition') {
      if (this.fehler.schreiben !== undefined)
        return Promise.reject(new Fehler(this.fehler.schreiben));
      this.geschrieben++;
      if (!this.stumm) {
        if (felder.pos_id !== this.pos)
          this.switchdate = new Date(this.jetzt).toISOString().replace('.000', '');
        this.pos = felder.pos_id;
        this.add = felder.addseconds;
      }
      return Promise.resolve({ switchdate: this.switchdate });
    }
    if (this.fehler.lesen !== undefined) return Promise.reject(new Fehler(this.fehler.lesen));
    if (this.anders !== undefined) return Promise.resolve(this.anders);
    return Promise.resolve({
      pos_id: this.pos,
      switchdate: this.switchdate,
      addseconds: this.add,
      category_id: '2',
      currentTime: this.jetzt,
    });
  }
  status(e: unknown): number | null {
    return e instanceof Fehler ? e.status : null;
  }
}

describe('liveStandAus – Antworten wie gemessen', () => {
  it('nie gestartet (Termin 151, 02.11.2026)', () => {
    expect(
      liveStandAus({
        pos_id: null,
        switchdate: null,
        addseconds: null,
        category_id: '2',
        currentTime: 1793614535032,
      }),
    ).toEqual({ stelle: null, seit: null, zusatzSek: 0, serverZeit: 1793614535032 });
  });

  it('läuft (Termin 148, alles Zeichenketten)', () => {
    expect(
      liveStandAus({
        pos_id: '1',
        switchdate: '2026-11-02T10:59:38Z',
        addseconds: '-60',
        category_id: '2',
        currentTime: 1793617184141,
      }),
    ).toEqual({
      stelle: 1,
      seit: ms('2026-11-02T10:59:38Z'),
      zusatzSek: -60,
      serverZeit: 1793617184141,
    });
  });

  it('anders als gemessen → null statt raten', () => {
    expect(liveStandAus(null)).toBeNull();
    expect(liveStandAus([])).toBeNull();
    expect(liveStandAus({ pos_id: '1' })).toBeNull();
    expect(liveStandAus({ pos_id: 'eins', currentTime: 1 })).toBeNull();
    expect(liveStandAus({ pos_id: '-1', currentTime: 1 })).toBeNull();
  });

  it('Uhrabgleich: Gerät geht 3 s vor', () => {
    const s = liveStandAus({ pos_id: null, currentTime: 1_000_000 }) as LiveStand;
    expect(uhrVersatz(s, 1_003_000)).toBe(3000);
  });
});

describe('liveListe – dieselbe Zählung wie ChurchTools', () => {
  const liste = liveListe(ABLAUF_L0, EVENT);

  it('ohne Überschriften, MIT dem weggelassenen Punkt – Stelle n zeigt, was die CT-Live-Agenda zeigte', () => {
    const gemessen = ['Begrüßung', 'Lied', 'Predigt', 'Ansagen', 'Segen'];
    gemessen.forEach((titel, i) => expect(liste[i].title).toBe(titel));
    expect(endeStelle(liste)).toBe(6);
  });

  it('weggelassen: ohne Plan-Zeit; sonst Beginn aus startTimes', () => {
    expect(liste[1]).toMatchObject({ weggelassen: true, planBeginn: null });
    expect(liste[2]).toMatchObject({
      weggelassen: false,
      planBeginn: ms('2027-03-07T09:05:00Z'),
      dauerSek: 1800,
    });
  });

  it('nur „header“ fällt weg – wie die Live-Agenda von ChurchTools', () => {
    const l = liveListe(
      [{ id: 1, title: 'Abschnitt', type: 'section', duration: 0 }, ABLAUF_L0[2]],
      EVENT,
    );
    expect(l.map((p) => p.title)).toEqual(['Abschnitt', 'Begrüßung']);
  });

  it('Lied ohne Dauer erkannt', () => {
    expect(liveListe(MIT_LIED, EVENT).map((p) => p.liedOhneDauer)).toEqual([false, true, false]);
  });
});

describe('Weiter und Zurück', () => {
  const liste = liveListe(ABLAUF_L0, EVENT);

  it('Weiter überspringt den weggelassenen Punkt, endet am Ende', () => {
    expect(naechsteStelle(liste, null)).toBe(1);
    expect(naechsteStelle(liste, 0)).toBe(1);
    expect(naechsteStelle(liste, 1)).toBe(3);
    expect(naechsteStelle(liste, 5)).toBe(6);
    expect(naechsteStelle(liste, 6)).toBe(6);
    expect(naechsteStelle(liste, 9)).toBe(6);
  });

  it('Zurück überspringt ebenfalls, vor dem ersten „nicht gestartet“', () => {
    expect(vorigeStelle(liste, 3)).toBe(1);
    expect(vorigeStelle(liste, 1)).toBe(0);
    expect(vorigeStelle(liste, 0)).toBe(0);
    expect(vorigeStelle(liste, null)).toBe(0);
    expect(vorigeStelle(liste, 6)).toBe(5);
  });

  it('Lied ohne Dauer wird übersprungen (Regel von ChurchTools)', () => {
    const l = liveListe(MIT_LIED, EVENT);
    expect(naechsteStelle(l, 1)).toBe(3);
    expect(vorigeStelle(l, 3)).toBe(1);
  });

  it('Ziele: Zusatzzeit zurück auf 0; ±1 Min als Gesamtwert', () => {
    const stand: LiveStand = { stelle: 3, seit: 0, zusatzSek: 60, serverZeit: 0 };
    expect(weiterZiel(liste, stand)).toEqual({ stelle: 4, zusatzSek: 0 });
    expect(zurueckZiel(liste, stand)).toEqual({ stelle: 1, zusatzSek: 0 });
    expect(zusatzZiel(stand, 1)).toEqual({ stelle: 3, zusatzSek: 120 });
    expect(zusatzZiel(stand, -1)).toEqual({ stelle: 3, zusatzSek: 0 });
    expect(weiterZiel(liste, null)).toEqual({ stelle: 1, zusatzSek: 0 });
  });
});

describe('liveLage', () => {
  const liste = liveListe(ABLAUF_L0, EVENT);
  const stand = (stelle: number | null, seit: string | null, zusatzSek = 0): LiveStand => ({
    stelle,
    seit: seit === null ? null : ms(seit),
    zusatzSek,
    serverZeit: 0,
  });

  it('läuft: Predigt 2 Min. später begonnen, 1 Min. vergangen', () => {
    const l = lage(liste, stand(3, '2027-03-07T09:07:00Z'), ms('2027-03-07T09:08:00Z'));
    expect(l).toMatchObject({
      art: 'laeuft',
      stelle: 3,
      jetzt: { title: 'Predigt' },
      dann: { title: 'Ansagen' },
      mit: [],
      dauerSek: 1800,
      restSek: 1740,
      // Predigt: Plan 09:05–09:35, begonnen 09:07 → endet voraussichtlich 09:37 → 2 Min. Rückstand.
      konto: -120,
    });
  });

  it('Zusatzzeit verlängert, überzogen wird negativ', () => {
    const plus = lage(liste, stand(1, '2027-03-07T09:00:00Z', 60), ms('2027-03-07T09:06:45Z'));
    expect(plus).toMatchObject({ art: 'laeuft', dauerSek: 360, restSek: -45 });
    // A5: „−0:45“ (echtes Minus), nicht „+0:45“ – dasselbe Vorzeichen wie beim Zeitkonto: Minus = Rückstand.
    expect(restText(-45)).toBe('−0:45');
    expect(restText(132)).toBe('2:12');
  });

  it('Lieder ohne Dauer laufen mit „Jetzt“ mit, „Dann“ ist der nächste eigene Punkt', () => {
    const l = lage(
      liveListe(MIT_LIED, EVENT),
      stand(1, '2027-03-07T09:00:00Z'),
      ms('2027-03-07T09:01:00Z'),
    );
    expect(l).toMatchObject({
      art: 'laeuft',
      mit: [{ title: 'Lied' }],
      dann: { title: 'Predigt' },
    });
  });

  it('steht ChurchTools auf einem weggelassenen Punkt, wird er gezeigt – ohne Abweichung', () => {
    const l = lage(liste, stand(2, '2027-03-07T09:05:00Z'), ms('2027-03-07T09:05:30Z'));
    expect(l).toMatchObject({ art: 'laeuft', jetzt: { title: 'Lied' }, konto: null });
  });

  it('letzter Punkt: „Dann“ ist das Ende', () => {
    expect(lage(liste, stand(5, '2027-03-07T09:40:00Z'), ms('2027-03-07T09:41:00Z'))).toMatchObject(
      {
        dann: 'ende',
      },
    );
  });

  it('Ende: 4 Min. später fertig als geplant (Plan-Ende 09:45)', () => {
    const l = lage(liste, stand(6, '2027-03-07T09:49:00Z'), ms('2027-03-07T09:50:00Z'));
    expect(l).toEqual({ art: 'ende', seit: ms('2027-03-07T09:49:00Z'), konto: -240 });
  });

  describe('nicht gestartet → nach der Uhr', () => {
    it('vor dem ersten Punkt: kein „Jetzt“, „Dann“ der erste', () => {
      const l = lage(liste, null, ms('2027-03-07T08:55:00Z'));
      expect(l).toMatchObject({
        art: 'nach-plan',
        jetzt: null,
        dann: { title: 'Begrüßung' },
        vorbei: false,
      });
    });

    it('Stelle 0 (nach „Zurück“) wie nie gestartet', () => {
      const l = lage(liste, stand(0, '2027-03-07T08:00:00Z'), ms('2027-03-07T09:10:00Z'));
      expect(l).toMatchObject({ art: 'nach-plan', jetzt: { title: 'Predigt' }, restSek: 1500 });
    });

    it('der weggelassene Punkt kommt nach der Uhr nie dran', () => {
      const l = lage(liste, null, ms('2027-03-07T09:04:00Z'));
      expect(l).toMatchObject({
        jetzt: { title: 'Begrüßung' },
        dann: { title: 'Predigt' },
        restSek: 60,
      });
    });

    it('nach dem Plan-Ende: vorbei', () => {
      expect(lage(liste, null, ms('2027-03-07T10:00:00Z'))).toMatchObject({
        jetzt: null,
        vorbei: true,
      });
    });
  });
});

/**
 * Ein Ablauf mit Vorlauf (`isBeforeEvent`) – Soundcheck 09:00, Countdown 09:30, **Beginn 09:35**, Begrüßung, Predigt, Segen
 * (Ende 10:15). Die Zeiten kommen aus `startTimes` wie bei ChurchTools; alles Weitere rechnen die Erzeuger (`liveListe`).
 */
const ABLAUF_VOR: CtAgendaItem[] = [
  {
    id: 1,
    title: 'Soundcheck',
    type: 'text',
    duration: 1800,
    isBeforeEvent: true,
    startTimes: { '216': '2027-03-07T09:00:00Z' },
  },
  {
    id: 2,
    title: 'Countdown',
    type: 'text',
    duration: 300,
    isBeforeEvent: true,
    startTimes: { '216': '2027-03-07T09:30:00Z' },
  },
  {
    id: 3,
    title: 'Begrüßung',
    type: 'text',
    duration: 300,
    isBeforeEvent: false,
    startTimes: { '216': '2027-03-07T09:35:00Z' },
  },
  {
    id: 4,
    title: 'Predigt',
    type: 'text',
    duration: 1800,
    isBeforeEvent: false,
    startTimes: { '216': '2027-03-07T09:40:00Z' },
  },
  {
    id: 5,
    title: 'Segen',
    type: 'text',
    duration: 300,
    isBeforeEvent: false,
    startTimes: { '216': '2027-03-07T10:10:00Z' },
  },
];

describe('Betriebsart (L4-2, T2) – ohne Schreiben, alle Geräte rechnen gleich', () => {
  const liste = liveListe(ABLAUF_VOR, EVENT);
  const [soundcheck, countdown, begruessung] = liste;
  const beginn = begruessung.planBeginn!;
  const nachPlan = (art: Betriebsart, jetzt: number) => {
    const l = liveLage(liste, null, jetzt, art);
    if (l.art !== 'nach-plan') throw new Error('kein nach-plan');
    return l;
  };

  it('die Vorlauf-Punkte kommen aus `isBeforeEvent`', () => {
    expect(liste.map((p) => p.vorBeginn)).toEqual([true, true, false, false, false]);
  });

  it('der Standard ist „bis Beginn“', () => {
    expect(STANDARD_BETRIEBSART).toBe('bis-beginn');
  });

  describe('bis Beginn nach der Uhr, ab Beginn klicken (Standard)', () => {
    it('vor Beginn läuft „Jetzt“ nach der Uhr durch den Vorlauf', () => {
      const l1 = nachPlan('bis-beginn', soundcheck.planBeginn! + 10 * 60_000);
      expect(l1).toMatchObject({ jetzt: soundcheck, dann: countdown, wartet: false });
      expect(l1.restSek).toBe(20 * 60);
      const l2 = nachPlan('bis-beginn', countdown.planBeginn! + 60_000);
      expect(l2).toMatchObject({ jetzt: countdown, dann: { title: 'Begrüßung' }, wartet: false });
      expect(l2.konto).toBe(0);
    });

    it('ab Beginn bleibt die Ansicht am letzten Punkt vor Beginn stehen, die Restzeit läuft ins Minus', () => {
      const l = nachPlan('bis-beginn', beginn + 134_000);
      expect(l).toMatchObject({
        jetzt: countdown,
        dann: { title: 'Begrüßung' },
        wartet: true,
        vorbei: false,
      });
      expect(l.restSek).toBe(-134);
      // Das Zeitkonto läuft mit: Der Countdown hätte um `beginn` enden sollen.
      expect(l.konto).toBe(-134);
      // Auch viel später (Plan-Ende längst vorbei) bleibt es stehen – nie „vorbei“.
      expect(nachPlan('bis-beginn', ms('2027-03-07T12:00:00Z'))).toMatchObject({
        jetzt: countdown,
        vorbei: false,
        wartet: true,
      });
    });

    it('genau zum Beginn wartet die Ansicht schon (Grenze zählt dazu)', () => {
      expect(nachPlan('bis-beginn', beginn)).toMatchObject({ jetzt: countdown, wartet: true });
      expect(nachPlan('bis-beginn', beginn - 1000)).toMatchObject({ wartet: false });
    });

    it('„Weiter“ und „Zurück“ gehen vom gezeigten Punkt aus – nicht ganz vorn', () => {
      const l = nachPlan('bis-beginn', beginn + 5000);
      // Countdown steht an Stelle 2: weiter → Begrüßung (3), zurück → Soundcheck (1).
      expect(weiterZiel(liste, null, l)).toEqual({ stelle: 3, zusatzSek: 0 });
      expect(zurueckZiel(liste, null, l)).toEqual({ stelle: 1, zusatzSek: 0 });
      // Ohne die Lage (altes Verhalten) startet „Weiter“ vorn.
      expect(weiterZiel(liste, null)).toEqual({ stelle: 1, zusatzSek: 0 });
    });

    it('ohne Punkte vor Beginn: kein „Jetzt“ vor dem Beginn, danach „wartet“; „Weiter“ startet den ersten', () => {
      const ohneVorlauf = liveListe(
        ABLAUF_VOR.slice(2).map((i) => ({ ...i, isBeforeEvent: false })),
        EVENT,
      );
      const vorher = liveLage(ohneVorlauf, null, beginn - 60_000, 'bis-beginn');
      expect(vorher).toMatchObject({ jetzt: null, wartet: false, dann: { title: 'Begrüßung' } });
      const nachher = liveLage(ohneVorlauf, null, beginn + 60_000, 'bis-beginn');
      expect(nachher).toMatchObject({ jetzt: null, wartet: true, konto: null, vorbei: false });
      expect(weiterZiel(ohneVorlauf, null, nachher)).toEqual({ stelle: 1, zusatzSek: 0 });
    });

    it('ohne erkennbaren Beginn (alles Vorlauf) wie „immer nach der Uhr“ – sonst bliebe es am Ende hängen', () => {
      const allesVor = liveListe(
        ABLAUF_VOR.map((i) => ({ ...i, isBeforeEvent: true })),
        EVENT,
      );
      const ende = liveLage(allesVor, null, ms('2027-03-07T11:00:00Z'), 'bis-beginn');
      expect(ende).toMatchObject({
        jetzt: null,
        vorbei: true,
        wartet: false,
        weiterAbJetzt: false,
      });
      expect(liveLage(allesVor, null, ms('2027-03-07T09:41:00Z'), 'bis-beginn')).toMatchObject({
        jetzt: { title: 'Predigt' },
      });
    });
  });

  describe('immer nach der Uhr (wie bisher)', () => {
    it('folgt der Uhr durch den ganzen Ablauf und wird „vorbei“', () => {
      expect(nachPlan('immer-uhr', beginn + 134_000)).toMatchObject({
        jetzt: { title: 'Begrüßung' },
        wartet: false,
        weiterAbJetzt: false,
        // Es läuft alles nur nach der Uhr – nichts zu verbuchen.
        konto: null,
      });
      expect(nachPlan('immer-uhr', ms('2027-03-07T10:30:00Z'))).toMatchObject({
        jetzt: null,
        vorbei: true,
      });
    });

    it('„Starten“ beginnt vorn (nicht beim gezeigten Punkt)', () => {
      const l = nachPlan('immer-uhr', beginn + 134_000);
      expect(weiterZiel(liste, null, l)).toEqual({ stelle: 1, zusatzSek: 0 });
    });
  });

  describe('von Anfang an klicken', () => {
    it('nie automatisch: kein „Jetzt“, „Dann“ ist der erste Punkt, die Ansicht wartet – zu jeder Zeit', () => {
      for (const t of [
        soundcheck.planBeginn! + 60_000,
        beginn + 60_000,
        ms('2027-03-07T12:00:00Z'),
      ]) {
        expect(nachPlan('klicken', t)).toMatchObject({
          jetzt: null,
          dann: { title: 'Soundcheck' },
          wartet: true,
          vorbei: false,
          restSek: null,
          konto: null,
        });
      }
    });
  });

  it('läuft ChurchTools schon (Stelle ≥ 1), ist die Betriebsart ohne Wirkung', () => {
    const stand: LiveStand = { stelle: 3, seit: beginn + 5000, zusatzSek: 0, serverZeit: 0 };
    const jetzt = beginn + 65_000;
    const [a, b, c] = (['bis-beginn', 'immer-uhr', 'klicken'] as const).map((art) =>
      liveLage(liste, stand, jetzt, art),
    );
    expect(a).toEqual(b);
    expect(b).toEqual(c);
    expect(a).toMatchObject({ art: 'laeuft', jetzt: { title: 'Begrüßung' } });
  });
});

describe('Zeitkonto (L4-2, T3/A5) – eine Rechnung, sekundengenau und laufend', () => {
  const liste = liveListe(ABLAUF_VOR, EVENT);
  const begruessung = liste[2];
  const stelle = 3;
  const laeuft = (seit: number, jetzt: number, zusatzSek = 0) => {
    const l = liveLage(liste, { stelle, seit, zusatzSek, serverZeit: 0 }, jetzt, 'bis-beginn');
    if (l.art !== 'laeuft') throw new Error('läuft nicht');
    return l;
  };
  const plan = begruessung.planBeginn!;
  const dauer = begruessung.dauerSek * 1000;

  it('pünktlich begonnen, in der Zeit: 0', () => {
    expect(laeuft(plan, plan + 60_000).konto).toBe(0);
  });

  it('20 s zu früh begonnen: +20 gespart – und es bleibt, solange der Punkt in der Zeit läuft', () => {
    expect(laeuft(plan - 20_000, plan + 5_000).konto).toBe(20);
    expect(laeuft(plan - 20_000, plan - 20_000 + dauer - 1000).konto).toBe(20);
  });

  it('zu spät begonnen: Rückstand von Anfang an', () => {
    expect(laeuft(plan + 130_000, plan + 131_000).konto).toBe(-130);
  });

  it('ein überzogener Punkt verbraucht das Konto sofort und läuft sekündlich weiter', () => {
    const seit = plan;
    const ende = seit + dauer;
    expect(laeuft(seit, ende).konto).toBe(0);
    expect(laeuft(seit, ende + 1000).konto).toBe(-1);
    expect(laeuft(seit, ende + 130_000).konto).toBe(-130);
    expect(laeuft(seit, ende + 131_000).konto).toBe(-131);
    // Ein Rückstand schon vor dem Überziehen wächst mit.
    expect(laeuft(seit + 20_000, ende + 20_000 + 10_000).konto).toBe(-30);
  });

  it('„−1 / +1 Min“ (`addseconds`) ändert nur den Kreis, nie das Konto (A13)', () => {
    const seit = plan;
    const jetzt = seit + dauer + 130_000;
    const ohne = laeuft(seit, jetzt, 0);
    const plus = laeuft(seit, jetzt, 60);
    const minus = laeuft(seit, jetzt, -60);
    expect(plus.konto).toBe(ohne.konto);
    expect(minus.konto).toBe(ohne.konto);
    expect(ohne.restSek).toBe(-130);
    expect(plus.restSek).toBe(-70);
    expect(minus.restSek).toBe(-190);
  });

  it('der Endstand: Plan-Ende minus der letzte Klick (gespart +, später −)', () => {
    const planEnde = liste[4].planBeginn! + liste[4].dauerSek * 1000;
    const frueh = liveLage(
      liste,
      { stelle: 6, seit: planEnde - 90_000, zusatzSek: 0, serverZeit: 0 },
      planEnde,
      'bis-beginn',
    );
    expect(frueh).toMatchObject({ art: 'ende', konto: 90 });
    const spaet = liveLage(
      liste,
      { stelle: 6, seit: planEnde + 45_000, zusatzSek: 0, serverZeit: 0 },
      planEnde + 99_000,
      'bis-beginn',
    );
    expect(spaet).toMatchObject({ art: 'ende', konto: -45 });
  });

  it('ohne Plan-Zeit oder ohne Wechselzeit kein Konto', () => {
    expect(kontoSek({ ...begruessung, planBeginn: null }, plan, plan)).toBeNull();
    const ohneSeit = liveLage(
      liste,
      { stelle, seit: null, zusatzSek: 0, serverZeit: 0 },
      plan,
      'bis-beginn',
    );
    expect(ohneSeit).toMatchObject({ art: 'laeuft', konto: null });
  });

  it('nie „−0“', () => {
    expect(Object.is(kontoSek(begruessung, plan + 400, plan + 400)!, 0)).toBe(true);
  });
});

describe('kontoText – „+0:20“ gespart, „−2:10“ Rückstand (U+2212 wie restText)', () => {
  it.each([
    [20, '+0:20', 'gespart'],
    [-130, '−2:10', 'Rückstand'],
    [0, '±0:00', 'im Plan'],
    [3600 + 61, '+61:01', 'gespart'],
    [-1, '−0:01', 'Rückstand'],
  ])('%i s → %s (%s)', (sek, text, wort) => {
    expect(kontoText(sek)).toBe(text);
    expect(kontoWort(sek)).toBe(wort);
  });

  it('dasselbe Minuszeichen wie restText', () => {
    expect(kontoText(-45)[0]).toBe(restText(-45)[0]);
    expect(kontoText(-45).charCodeAt(0)).toBe(0x2212);
  });
});

describe('darfLiveSteuern – genau wie ChurchTools', () => {
  const dienste = diensteAus([
    { id: 6, name: 'Ton', allowControlLiveAgenda: true },
    { id: 9, name: 'Gesang', allowControlLiveAgenda: false },
  ]);

  it('eingeteilt in einem Dienst mit „Live-Agenda steuern“', () => {
    expect(
      darfLiveSteuern(
        { eventServices: [{ serviceId: 6, personId: 1, isValid: true }] },
        dienste,
        1,
      ),
    ).toBe(true);
  });

  it('IDs als Zeichenkette zählen', () => {
    expect(
      darfLiveSteuern({ eventServices: [{ serviceId: '6', personId: '1' }] }, dienste, 1),
    ).toBe(true);
  });

  it('nicht: ungültiger Platz, andere Person, Dienst ohne Recht, niemand angemeldet, keine Plätze', () => {
    expect(
      darfLiveSteuern(
        { eventServices: [{ serviceId: 6, personId: 1, isValid: false }] },
        dienste,
        1,
      ),
    ).toBe(false);
    expect(darfLiveSteuern({ eventServices: [{ serviceId: 6, personId: 2 }] }, dienste, 1)).toBe(
      false,
    );
    expect(darfLiveSteuern({ eventServices: [{ serviceId: 9, personId: 1 }] }, dienste, 1)).toBe(
      false,
    );
    expect(darfLiveSteuern({ eventServices: [{ serviceId: 6, personId: 1 }] }, dienste, null)).toBe(
      false,
    );
    expect(darfLiveSteuern({ eventServices: null }, dienste, 1)).toBe(false);
  });

  it('das Recht kommt aus `diensteAus` – ohne `allowControlLiveAgenda: true` kein Recht', () => {
    expect(
      diensteAus([{ id: 1, name: 'X', allowControlLiveAgenda: 'true' }]).get(1)?.liveSteuern,
    ).toBe(false);
  });
});

describe('stelleNachziehen', () => {
  const alt = liveListe(ABLAUF_L0, EVENT);

  it('L0: Begrüßung gelöscht, während die Predigt läuft → aus 3 wird 2 (ChurchTools zeigte sonst „Ansagen“)', () => {
    const neu = liveListe(
      ABLAUF_L0.filter((i) => i.id !== 968),
      EVENT,
    );
    expect(neu[3 - 1].title).toBe('Ansagen');
    expect(stelleNachziehen(alt, neu, 3)).toBe(2);
    expect(neu[2 - 1].title).toBe('Predigt');
  });

  it('der aktuelle Punkt selbst gelöscht → der nächste vorhandene', () => {
    const neu = liveListe(
      ABLAUF_L0.filter((i) => i.id !== 972),
      EVENT,
    );
    expect(neu[stelleNachziehen(alt, neu, 3) - 1].title).toBe('Ansagen');
  });

  it('alles danach gelöscht → Ende; nicht gestartet bleibt; Ende bleibt Ende', () => {
    const neu = liveListe(ABLAUF_L0.slice(0, 3), EVENT);
    expect(stelleNachziehen(alt, neu, 3)).toBe(endeStelle(neu));
    expect(stelleNachziehen(alt, neu, 0)).toBe(0);
    expect(stelleNachziehen(alt, neu, 6)).toBe(endeStelle(neu));
  });
});

describe('liveLesen / liveSchreiben', () => {
  const liste = liveListe(ABLAUF_L0, EVENT);

  it('Weiter schreibt, liest nach und liefert den neuen Stand', async () => {
    const ct = new CtLive();
    const r = await liveSchreiben(ct, EVENT, 126, weiterZiel(liste, null));
    expect(r).toMatchObject({ ok: true, stand: { stelle: 1, zusatzSek: 0, seit: ct.jetzt } });
    expect(ct.geschrieben).toBe(1);
  });

  it('+1 Min lässt den Beginn stehen – die Restzeit läuft nahtlos weiter (gemessen 02.11.2026)', async () => {
    const ct = new CtLive();
    await liveSchreiben(ct, EVENT, 126, { stelle: 3, zusatzSek: 0 });
    const beginn = ct.jetzt;
    ct.jetzt += 90_000;
    const vorher = await liveLesen(ct, EVENT, 126);
    if (!vorher.ok) throw new Error('lesen');
    const r = await liveSchreiben(ct, EVENT, 126, zusatzZiel(vorher.stand, 1));
    if (!r.ok) throw new Error('schreiben');
    expect(r.stand.seit).toBe(beginn);
    expect(lage(liste, r.stand, ct.jetzt)).toMatchObject({ restSek: 1800 + 60 - 90 });
  });

  it('stumm nicht übernommen → „nicht angekommen“', async () => {
    const ct = new CtLive();
    ct.stumm = true;
    expect(await liveSchreiben(ct, EVENT, 126, { stelle: 1, zusatzSek: 0 })).toEqual({
      ok: false,
      grund: 'nicht-angekommen',
    });
  });

  it.each([
    [401, 'abgemeldet'],
    [403, 'kein-recht'],
    [502, 'voruebergehend'],
    [null, 'voruebergehend'],
  ] as const)('Fehler beim Schreiben %s → %s, nichts nachgelesen', async (status, grund) => {
    const ct = new CtLive();
    ct.fehler.schreiben = status;
    expect(await liveSchreiben(ct, EVENT, 126, { stelle: 1, zusatzSek: 0 })).toEqual({
      ok: false,
      grund,
    });
  });

  it('Schreiben ging durch, Nachlesen nicht → vorübergehend (nie ein zweites Mal geschrieben)', async () => {
    const ct = new CtLive();
    ct.fehler.lesen = null;
    expect(await liveSchreiben(ct, EVENT, 126, { stelle: 1, zusatzSek: 0 })).toEqual({
      ok: false,
      grund: 'voruebergehend',
    });
    expect(ct.geschrieben).toBe(1);
  });

  it('Antwort anders als gemessen → unlesbar', async () => {
    const ct = new CtLive();
    ct.anders = '<html>';
    expect(await liveLesen(ct, EVENT, 126)).toEqual({ ok: false, grund: 'unlesbar' });
  });

  it('fragt mit Termin und Ablauf', async () => {
    const felder: Record<string, string>[] = [];
    const p: AltAnfragePort = {
      anfrage: (func, f) => {
        felder.push({ func, ...f });
        return Promise.resolve({ pos_id: null, currentTime: 1 });
      },
      status: () => null,
    };
    await liveLesen(p, 148, 31);
    expect(felder).toEqual([{ func: 'loadAgendaLivePosition', event_id: '148', agenda_id: '31' }]);
  });
});

describe('eigeneDienstgruppen und liveInfoGruppen – Infos nur der eigenen Gruppen (A16)', () => {
  // Die Dienste kommen aus dem Erzeuger (`diensteAus`), nicht als handgeschriebene Literale.
  const dienste = diensteAus([
    { id: 6, name: 'Ton', serviceGroupId: 3 },
    { id: 7, name: 'Licht', serviceGroupId: 3 },
    { id: 9, name: 'Gesang', serviceGroupId: 4 },
    { id: 12, name: 'Ohne Gruppe' },
  ]);

  it('Gruppen der Plätze, an denen ich gültig eingeteilt bin – ohne Doppelte', () => {
    const t = {
      eventServices: [
        { serviceId: 6, personId: 1 },
        { serviceId: 7, personId: 1 },
        { serviceId: '9', personId: '1' },
      ],
    };
    expect(eigeneDienstgruppen(t, dienste, 1).sort()).toEqual([3, 4]);
  });

  it('nicht: ungültiger Platz, andere Person, Dienst ohne Gruppe, niemand angemeldet, keine Plätze', () => {
    expect(
      eigeneDienstgruppen(
        {
          eventServices: [
            { serviceId: 6, personId: 1, isValid: false },
            { serviceId: 9, personId: 2 },
            { serviceId: 12, personId: 1 },
          ],
        },
        dienste,
        1,
      ),
    ).toEqual([]);
    expect(
      eigeneDienstgruppen({ eventServices: [{ serviceId: 6, personId: 1 }] }, dienste, null),
    ).toEqual([]);
    expect(eigeneDienstgruppen({}, dienste, 1)).toEqual([]);
  });

  const sichtbar = [
    { id: 3, name: 'Technik' },
    { id: 4, name: 'Musik' },
    { id: 5, name: 'Kinder' },
  ];
  const gewaehlt = [{ id: 5, name: 'Kinder' }];

  it('eingeteilt: nur die eigenen Gruppen (soweit sichtbar), die „Spalten“-Wahl zählt nicht', () => {
    expect(liveInfoGruppen([3], sichtbar, gewaehlt)).toEqual([{ id: 3, name: 'Technik' }]);
    expect(liveInfoGruppen([4, 3], sichtbar, gewaehlt).map((g) => g.id)).toEqual([3, 4]);
    // Eingeteilt, aber ohne Recht, die Gruppe zu sehen: nichts – nicht die Wahl der Spalten.
    expect(liveInfoGruppen([99], sichtbar, gewaehlt)).toEqual([]);
  });

  it('nirgends eingeteilt: wie bisher die Wahl unter „Spalten“', () => {
    expect(liveInfoGruppen([], sichtbar, gewaehlt)).toBe(gewaehlt);
  });
});
