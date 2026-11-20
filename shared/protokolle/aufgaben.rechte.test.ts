import { describe, expect, it } from 'vitest';
import {
  aenderungVerboten,
  anlegenVerboten,
  bearbeiten,
  modusSetzen,
  neueAufgabe,
  ohneZustaendige,
  toDoRechte,
  type Aufgabe,
  type ToDoAenderung,
  type ToDoFall,
} from './aufgaben';

/**
 * **Wer darf was an einem To-Do?** (W9a, 20.11.2026) – `toDoRechte` und `aenderungVerboten`. Die To-Dos kommen aus den
 * echten Erzeugern (`neueAufgabe`, `modusSetzen`), nicht als Literale; ich bin Person 1, die anderen 19 und 23.
 */
const AM = '2026-11-20T08:00:00Z';
const ICH = 1;
const aufgabe = (t: Partial<Pick<Aufgabe, 'wer' | 'extern'>> = {}): Aufgabe =>
  neueAufgabe({
    id: 'a',
    gruppe: 11,
    sitzung: 's1',
    text: 'Beamer',
    bis: '2026-12-01',
    von: ICH,
    am: AM,
    ...t,
  });

const EIGEN = aufgabe({ wer: [ICH] });
const GETEILT = aufgabe({ wer: [ICH, 19] });
const GETEILT_JEDER = modusSetzen(aufgabe({ wer: [ICH, 19] }), true, ICH, AM);
const MIT_EXTERN = aufgabe({ wer: [ICH], extern: 'Herr Meier' });
const OHNE = aufgabe();
const FREMD = aufgabe({ wer: [19] });
const NUR_EXTERN = aufgabe({ extern: 'Herr Meier' });

/** Die vier Vorschlag-Rechte (W9b) gibt es nur im Fall `vorschlag` – an einem To-Do sind sie alle aus. */
const KEIN_VORSCHLAG = {
  uebernehmen: false,
  ablehnen: false,
  vorschlagAendern: false,
  zurueckziehen: false,
};

const mitarbeiter = { ich: ICH, leitung: false };
const leitung = { ich: ICH, leitung: true };

describe('toDoRechte: der Fall', () => {
  const fall = (a: Aufgabe, q = mitarbeiter): ToDoFall => toDoRechte(a, q).fall;
  it('eigen · geteilt · ohne · fremd – und die Leitung vor allem', () => {
    expect(fall(EIGEN)).toBe('eigen');
    expect(fall(GETEILT)).toBe('geteilt');
    expect(fall(GETEILT_JEDER)).toBe('geteilt');
    expect(fall(OHNE)).toBe('ohne');
    expect(fall(FREMD)).toBe('fremd');
    for (const a of [EIGEN, GETEILT, OHNE, FREMD]) expect(fall(a, leitung)).toBe('leitung');
  });

  it('ich und eine Person außerhalb der Gruppe: geteilt, nicht eigen', () => {
    expect(toDoRechte(MIT_EXTERN, mitarbeiter).fall).toBe('geteilt');
  });

  it('nur ein Externer zuständig: kein „ohne“ (das sieht ein Mitglied gar nicht) – also fremd', () => {
    expect(ohneZustaendige(NUR_EXTERN)).toBe(false);
    expect(toDoRechte(NUR_EXTERN, mitarbeiter)).toMatchObject({ fall: 'fremd', sehen: false });
  });
});

describe('toDoRechte: was ein Mitarbeiter darf', () => {
  it('eigen: abhaken, Status, Notiz, Frist, Karte, abgeben, Text, löschen – aber nicht Zuständige, Modus, Gruppe', () => {
    expect(toDoRechte(EIGEN, mitarbeiter)).toEqual({
      fall: 'eigen',
      sehen: true,
      haken: true,
      status: true,
      notiz: true,
      text: true,
      frist: true,
      karte: true,
      zustaendig: false,
      modus: false,
      gruppe: false,
      abgeben: true,
      loeschen: true,
      mache: false,
      ...KEIN_VORSCHLAG,
    });
  });

  it('eigen im Protokoll-Entwurf: Text und Löschen nicht – der Rest bleibt', () => {
    const r = toDoRechte(EIGEN, { ...mitarbeiter, imEntwurf: true });
    expect(r).toMatchObject({
      text: false,
      loeschen: false,
      haken: true,
      frist: true,
      abgeben: true,
    });
  });

  it('geteilt gemeinsam: abhaken (auch „in Arbeit“) und Notiz – sonst nichts', () => {
    expect(toDoRechte(GETEILT, mitarbeiter)).toEqual({
      fall: 'geteilt',
      sehen: true,
      haken: true,
      status: true,
      notiz: true,
      text: false,
      frist: false,
      karte: false,
      zustaendig: false,
      modus: false,
      gruppe: false,
      abgeben: false,
      loeschen: false,
      mache: false,
      ...KEIN_VORSCHLAG,
    });
  });

  it('geteilt „Jeder für sich“: nur der eigene Teil, kein Gesamt-Status', () => {
    expect(toDoRechte(GETEILT_JEDER, mitarbeiter)).toMatchObject({
      haken: true,
      status: false,
      notiz: true,
    });
  });

  it('ohne Zuständigen: nur „Das mache ich“ – kein Haken, keine Notiz', () => {
    const r = toDoRechte(OHNE, mitarbeiter);
    expect(r).toMatchObject({ fall: 'ohne', sehen: true, mache: true });
    expect(
      Object.entries(r).filter(([k, v]) => v === true && !['sehen', 'mache'].includes(k)),
    ).toEqual([]);
  });

  it('fremd: nichts, nicht einmal sehen', () => {
    const r = toDoRechte(FREMD, mitarbeiter);
    expect(Object.entries(r).filter(([k, v]) => v === true && k !== 'fall')).toEqual([]);
  });

  it('die Leitung darf alles außer „Abgeben“ und „Das mache ich“ (die gibt es nur für Mitglieder)', () => {
    for (const a of [EIGEN, GETEILT, OHNE, FREMD]) {
      const r = toDoRechte(a, leitung);
      expect(r).toMatchObject({
        sehen: true,
        haken: true,
        status: true,
        notiz: true,
        text: true,
        frist: true,
        karte: true,
        zustaendig: true,
        modus: true,
        gruppe: true,
        loeschen: true,
        abgeben: false,
        mache: false,
      });
    }
  });
});

describe('aenderungVerboten: der Schreibweg folgt denselben Rechten', () => {
  const x = (z: ToDoAenderung) => z;
  /** Je Feld: eine Änderung, die wirklich etwas ändert, und welches Recht sie braucht. */
  const FELDER: { feld: string; x: ToDoAenderung; recht: keyof ReturnType<typeof toDoRechte> }[] = [
    { feld: 'text', x: { text: 'Anderer Text' }, recht: 'text' },
    { feld: 'bis', x: { bis: '2027-01-01' }, recht: 'frist' },
    { feld: 'extern', x: { extern: 'Frau Müller' }, recht: 'zustaendig' },
    { feld: 'karte', x: { karte: { notiz: true } }, recht: 'karte' },
    { feld: 'notiz', x: { notiz: 'Stand: Angebot da' }, recht: 'notiz' },
    { feld: 'status', x: { status: 'arbeit' }, recht: 'status' },
  ];

  for (const [name, a, imEntwurf] of [
    ['eigen', EIGEN, false],
    ['eigen im Entwurf', EIGEN, true],
    ['geteilt', GETEILT, false],
    ['ohne', OHNE, false],
  ] as const)
    for (const f of FELDER)
      it(`${name}: ${f.feld} nur, wenn „${f.recht}“ erlaubt ist`, () => {
        const r = toDoRechte(a, { ...mitarbeiter, imEntwurf });
        const grund = aenderungVerboten(a, f.x, { ...mitarbeiter, imEntwurf });
        expect(grund === null).toBe(r[f.recht] === true);
      });

  it('die Leitung darf jede dieser Änderungen', () => {
    for (const a of [EIGEN, GETEILT, OHNE, FREMD])
      for (const f of FELDER) expect(aenderungVerboten(a, f.x, leitung)).toBeNull();
  });

  it('Felder, die sich gar nicht ändern, zählen nicht (das Fenster schickt nur Geändertes, der Rest ist egal)', () => {
    expect(
      aenderungVerboten(
        GETEILT,
        x({ text: 'Beamer', bis: '2026-12-01', wer: [ICH, 19] }),
        mitarbeiter,
      ),
    ).toBeNull();
  });

  it('Zuständige: Mitarbeiter dürfen abgeben (genau ein anderes Mitglied) oder sich selbst eintragen – sonst nichts', () => {
    // eigen → abgeben
    expect(aenderungVerboten(EIGEN, x({ wer: [19] }), mitarbeiter)).toBeNull();
    expect(aenderungVerboten(EIGEN, x({ wer: [19, 23] }), mitarbeiter)).toMatch(/abgeben/);
    expect(aenderungVerboten(EIGEN, x({ wer: [ICH, 19] }), mitarbeiter)).toMatch(/abgeben/);
    expect(aenderungVerboten(EIGEN, x({ wer: [] }), mitarbeiter)).toMatch(/abgeben/);
    // ohne → „Das mache ich“
    expect(aenderungVerboten(OHNE, x({ wer: [ICH] }), mitarbeiter)).toBeNull();
    expect(aenderungVerboten(OHNE, x({ wer: [19] }), mitarbeiter)).toMatch(/selbst eintragen/);
    expect(aenderungVerboten(OHNE, x({ wer: [ICH, 19] }), mitarbeiter)).toMatch(/selbst eintragen/);
    // geteilt: keine Änderung der Zuständigen
    expect(aenderungVerboten(GETEILT, x({ wer: [ICH] }), mitarbeiter)).toMatch(/Leitung/);
    expect(aenderungVerboten(GETEILT, x({ wer: [ICH, 19, 23] }), mitarbeiter)).toMatch(/Leitung/);
  });

  it('Modus Gemeinsam ↔ Jeder für sich: nur die Leitung', () => {
    expect(aenderungVerboten(GETEILT, x({ jeder: true }), mitarbeiter)).toMatch(/Leitung/);
    expect(aenderungVerboten(EIGEN, x({ jeder: true }), mitarbeiter)).toMatch(/Leitung/);
    expect(aenderungVerboten(GETEILT, x({ jeder: true }), leitung)).toBeNull();
  });

  it('Teile bei „Jeder für sich“: den eigenen darf ein Mitglied setzen, den eines anderen nicht', () => {
    expect(
      aenderungVerboten(GETEILT_JEDER, x({ teile: [{ person: ICH, fertig: true }] }), mitarbeiter),
    ).toBeNull();
    expect(
      aenderungVerboten(GETEILT_JEDER, x({ teile: [{ person: 19, fertig: true }] }), mitarbeiter),
    ).toMatch(/nur deinen eigenen Teil/);
    expect(
      aenderungVerboten(OHNE, x({ teile: [{ person: ICH, fertig: true }] }), mitarbeiter),
    ).toMatch(/nichts abhaken/);
  });

  it('fremd: jede Änderung scheitert – egal welche', () => {
    for (const f of FELDER)
      expect(aenderungVerboten(FREMD, f.x, mitarbeiter)).toMatch(/gehört jemand anderem/);
    expect(aenderungVerboten(FREMD, x({ wer: [ICH] }), mitarbeiter)).toMatch(
      /gehört jemand anderem/,
    );
  });

  it('was erlaubt ist, lässt sich auch wirklich anwenden (bearbeiten)', () => {
    const n = bearbeiten(OHNE, { wer: [ICH] }, ICH, AM);
    expect(toDoRechte(n, mitarbeiter).fall).toBe('eigen');
    const ab = bearbeiten(EIGEN, { wer: [19] }, ICH, AM);
    expect(toDoRechte(ab, mitarbeiter).fall).toBe('fremd');
  });
});

describe('anlegenVerboten', () => {
  it('ein Mitglied legt nur für sich selbst an – ohne Externen', () => {
    expect(anlegenVerboten({ wer: [ICH], extern: '' }, mitarbeiter)).toBeNull();
    expect(anlegenVerboten({ wer: [], extern: '' }, mitarbeiter)).toMatch(/nur für dich selbst/);
    expect(anlegenVerboten({ wer: [19], extern: '' }, mitarbeiter)).toMatch(/nur für dich selbst/);
    expect(anlegenVerboten({ wer: [ICH, 19], extern: '' }, mitarbeiter)).toMatch(
      /nur für dich selbst/,
    );
    expect(anlegenVerboten({ wer: [ICH], extern: 'Herr Meier' }, mitarbeiter)).toMatch(
      /nur für dich selbst/,
    );
  });
  it('die Leitung legt an, für wen sie will', () => {
    expect(anlegenVerboten({ wer: [], extern: '' }, leitung)).toBeNull();
    expect(anlegenVerboten({ wer: [19, 23], extern: 'X' }, leitung)).toBeNull();
  });
});
