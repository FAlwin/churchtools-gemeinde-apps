import { describe, expect, it } from 'vitest';
import type { AltAnfragePort } from './altSchnittstelle';
import { diensteAus } from './dienste';
import {
  abweichungText,
  darfLiveSteuern,
  endeStelle,
  liveLage,
  liveLesen,
  liveListe,
  liveSchreiben,
  liveStandAus,
  naechsteStelle,
  restText,
  stelleNachziehen,
  uhrVersatz,
  vorigeStelle,
  weiterZiel,
  zurueckZiel,
  zusatzZiel,
  type LiveStand,
} from './liveAgenda';
import type { CtAgendaItem } from './typen';

const EVENT = 216;
const ms = (iso: string) => Date.parse(iso);

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
    const l = liveLage(liste, stand(3, '2027-03-07T09:07:00Z'), ms('2027-03-07T09:08:00Z'));
    expect(l).toMatchObject({
      art: 'laeuft',
      stelle: 3,
      jetzt: { title: 'Predigt' },
      dann: { title: 'Ansagen' },
      mit: [],
      dauerSek: 1800,
      restSek: 1740,
      verspaetungSek: 120,
    });
    expect(abweichungText(120)).toBe('2 Min. später');
  });

  it('Zusatzzeit verlängert, überzogen wird negativ', () => {
    const plus = liveLage(liste, stand(1, '2027-03-07T09:00:00Z', 60), ms('2027-03-07T09:06:45Z'));
    expect(plus).toMatchObject({ art: 'laeuft', dauerSek: 360, restSek: -45 });
    expect(restText(-45)).toBe('+0:45');
    expect(restText(132)).toBe('2:12');
  });

  it('Lieder ohne Dauer laufen mit „Jetzt“ mit, „Dann“ ist der nächste eigene Punkt', () => {
    const l = liveLage(
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
    const l = liveLage(liste, stand(2, '2027-03-07T09:05:00Z'), ms('2027-03-07T09:05:30Z'));
    expect(l).toMatchObject({ art: 'laeuft', jetzt: { title: 'Lied' }, verspaetungSek: null });
  });

  it('letzter Punkt: „Dann“ ist das Ende', () => {
    expect(
      liveLage(liste, stand(5, '2027-03-07T09:40:00Z'), ms('2027-03-07T09:41:00Z')),
    ).toMatchObject({
      dann: 'ende',
    });
  });

  it('Ende: 4 Min. später fertig als geplant (Plan-Ende 09:45)', () => {
    const l = liveLage(liste, stand(6, '2027-03-07T09:49:00Z'), ms('2027-03-07T09:50:00Z'));
    expect(l).toEqual({ art: 'ende', seit: ms('2027-03-07T09:49:00Z'), verspaetungSek: 240 });
  });

  describe('nicht gestartet → nach der Uhr', () => {
    it('vor dem ersten Punkt: kein „Jetzt“, „Dann“ der erste', () => {
      const l = liveLage(liste, null, ms('2027-03-07T08:55:00Z'));
      expect(l).toMatchObject({
        art: 'nach-plan',
        jetzt: null,
        dann: { title: 'Begrüßung' },
        vorbei: false,
      });
    });

    it('Stelle 0 (nach „Zurück“) wie nie gestartet', () => {
      const l = liveLage(liste, stand(0, '2027-03-07T08:00:00Z'), ms('2027-03-07T09:10:00Z'));
      expect(l).toMatchObject({ art: 'nach-plan', jetzt: { title: 'Predigt' }, restSek: 1500 });
    });

    it('der weggelassene Punkt kommt nach der Uhr nie dran', () => {
      const l = liveLage(liste, null, ms('2027-03-07T09:04:00Z'));
      expect(l).toMatchObject({
        jetzt: { title: 'Begrüßung' },
        dann: { title: 'Predigt' },
        restSek: 60,
      });
    });

    it('nach dem Plan-Ende: vorbei', () => {
      expect(liveLage(liste, null, ms('2027-03-07T10:00:00Z'))).toMatchObject({
        jetzt: null,
        vorbei: true,
      });
    });
  });
});

describe('abweichungText – abgeschnitten wie ChurchTools', () => {
  it.each([
    [0, 'im Plan'],
    [59, 'im Plan'],
    [-59, 'im Plan'],
    [119, '1 Min. später'],
    [-61, '1 Min. früher'],
    [-696360, '11606 Min. früher'],
  ])('%i s → %s', (sek, text) => expect(abweichungText(sek)).toBe(text));
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
    expect(liveLage(liste, r.stand, ct.jetzt)).toMatchObject({ restSek: 1800 + 60 - 90 });
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
