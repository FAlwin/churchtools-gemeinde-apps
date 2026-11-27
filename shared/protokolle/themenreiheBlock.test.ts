import { describe, expect, it } from 'vitest';
import { istAufgabe } from './aufgaben';
import {
  BLOCK,
  ableiten,
  fremdeTypen,
  istDokument,
  mitNeuenIds,
  themenreiheIds,
  type Block,
} from './dokument';
import { festePunkteFesthalten, festePunkteLoesen } from './festePunkte';
import { gliederung } from './gliederung';
import { tagesordnung } from './ki';
import { aufgabeNachziehen } from './nachziehen';
import { protokollBlatt, type ProtokollQuelle } from './protokollBlatt';
import { dokumentAusTeilen, teileBauen } from './speicher';
import { istTerminStand } from './terminStand';
import { neueThemenreihe, neueZeile, istThemenreihe } from './themenreihe';
import { istVorschlag } from './vorschlaege';
import { startDokument, wieLetztesMal, STANDARD_VORLAGEN, type Vorlage } from './vorlagen';

/**
 * **Der Baustein „Reihe“ in den Wegen, die ein Dokument OHNE Editor lesen oder schreiben** (Regel-Dopplung: Wo ein Block
 * gleich behandelt wird, hängt er an jeder dieser Stellen). Die Blöcke stammen aus dem Erzeuger (`BLOCK`), nicht aus Literalen.
 */

const reiheBlock = (id: string, reihe: string): Block => ({
  id,
  type: BLOCK.themenreihe,
  props: { reihe },
});
const punkt = (id: string, titel: string): Block => ({
  id,
  type: 'heading',
  props: { level: 1 },
  content: [{ type: 'text', text: titel, styles: {} }],
});

const DOK: Block[] = [
  punkt('p1', 'Themenreihe'),
  reiheBlock('r1', 'reihe-1'),
  punkt('p2', 'Sonstiges'),
  { id: 'u', type: 'paragraph', children: [reiheBlock('r2', 'reihe-2')] },
];

describe('Reihe-Block im Dokument', () => {
  it('themenreiheIds findet alle Reihen, auch in Unterblöcken, ohne Doppelte', () => {
    expect(themenreiheIds(DOK)).toEqual(['reihe-1', 'reihe-2']);
    expect(themenreiheIds([...DOK, reiheBlock('r3', 'reihe-1'), reiheBlock('r4', '')])).toEqual([
      'reihe-1',
      'reihe-2',
    ]);
    expect(themenreiheIds([])).toEqual([]);
  });

  it('überlebt Teile packen und lesen, Freigabe festhalten und lösen, Nachziehen', () => {
    const t = teileBauen(DOK, 's1');
    const teile = t.werte.map((w) => JSON.parse(w) as never);
    expect(dokumentAusTeilen({ sitzung: 's1', stand: t.stand }, teile)).toEqual(DOK);
    const fest = festePunkteFesthalten(DOK, {
      offen: { offen: [], erledigt: [], seit: null },
      letztes: null,
    });
    expect(fest).toEqual(DOK);
    expect(festePunkteLoesen(DOK)).toEqual(DOK);
    expect(aufgabeNachziehen(DOK, 'gibt-es-nicht', { art: 'raus' }).dokument).toEqual(DOK);
    expect(istDokument(DOK)).toBe(true);
  });

  it('ist für diese Fassung ein bekannter Typ – eine ältere kennt ihn nicht und öffnet nur lesend', () => {
    const aelter = new Set(['paragraph', 'heading', 'verweis', 'aufgabe', 'beschluss', 'termin']);
    expect(fremdeTypen(DOK, aelter)).toEqual([BLOCK.themenreihe]);
    expect(fremdeTypen(DOK, new Set([...aelter, ...Object.values(BLOCK)]))).toEqual([]);
  });

  it('bekommt in der Kopie mit neuen IDs eine neue Block-ID, behält aber props.reihe', () => {
    const kopie = mitNeuenIds(
      DOK,
      (() => {
        let n = 0;
        return () => `n${++n}`;
      })(),
    );
    expect(kopie[1].id).not.toBe('r1');
    expect(kopie[1].props?.reihe).toBe('reihe-1');
  });

  it('zählt in der Gliederung als Inhalt („1 Reihe“), nicht als „noch ohne Inhalt“', () => {
    const g = gliederung(DOK);
    expect(g[0].mit).toBe('1 Reihe');
    expect(g[1].mit).toBe('1 Reihe');
  });

  it('macht in der KI-Tagesordnung keinen „festen Punkt“ und zählt nicht als Text', () => {
    expect(tagesordnung(DOK).map((p) => p.fest)).toEqual([false, false]);
    expect(ableiten(DOK).aufgaben).toEqual([]);
  });
});

describe('Vorlage und „wie letztes Mal“ ohne Reihe', () => {
  const ids = () => {
    let n = 0;
    return () => `x${++n}`;
  };

  it('wieLetztesMal nimmt den Reihe-Block nicht mit', () => {
    const neu = wieLetztesMal(DOK, ids());
    expect(neu.map((b) => b.type)).toEqual(['heading', 'heading']);
    expect(themenreiheIds(neu)).toEqual([]);
  });

  it('startDokument lässt einen Reihe-Block aus der Vorlage weg – auch in Unterblöcken', () => {
    const vorlage: Vorlage = { art: 'vorlage', fassung: 1, id: 'v', name: 'V', bloecke: DOK };
    const neu = startDokument(vorlage, ids());
    expect(themenreiheIds(neu)).toEqual([]);
    expect(JSON.stringify(neu)).not.toContain(BLOCK.themenreihe);
    // die Standard-Vorlagen sind davon unberührt
    for (const v of STANDARD_VORLAGEN)
      expect(startDokument(v, ids())).toHaveLength(v.bloecke.length);
  });
});

describe('Reihe ist nie ein To-Do und kein anderer Wert aus „Mitarbeit“', () => {
  const r = neueThemenreihe({
    id: 'r',
    gruppe: 1,
    name: 'R',
    zeilen: [neueZeile('a', '2027-01-01')],
    von: 1,
    am: 'x',
  });

  it('kein Leser aus „Mitarbeit“ hält sie für seinen Wert – und sie keinen anderen für eine Reihe', () => {
    expect(istThemenreihe(r)).toBe(true);
    expect(istAufgabe(r)).toBe(false);
    expect(istTerminStand(r)).toBe(false);
    expect(istVorschlag(r)).toBe(false);
    expect(istThemenreihe({ art: 'aufgabe', fassung: 1 })).toBe(false);
  });
});

describe('PDF', () => {
  const q = (themenreihen?: ProtokollQuelle['themenreihen']): ProtokollQuelle => ({
    gruppe: 'Jugend',
    gruppeId: 5,
    sitzung: 's1',
    titel: 'Planung',
    beginn: '2026-11-25T18:00:00Z',
    zeitzone: 'Europe/Berlin',
    kopf: null,
    dokument: DOK,
    aufgaben: [],
    name: null,
    heute: '2026-11-27',
    protokolle: [],
    letztes: null,
    anwesenheit: null,
    naechste: null,
    gemeinde: null,
    stand: 'Stand',
    farbe: () => null,
    ...(themenreihen ? { themenreihen } : {}),
  });
  const reihe = neueThemenreihe({
    id: 'reihe-1',
    gruppe: 5,
    name: 'Jona',
    zeilen: [
      {
        ...neueZeile('b', '2027-01-20'),
        thema: 'Im Bauch des Fisches',
        wer: { personId: 3, name: 'Lena' },
        bibelstelle: 'Jona 2',
      },
      { ...neueZeile('a', '2027-01-13'), thema: 'Weglaufen' },
    ],
    von: 1,
    am: 'x',
  });

  it('zeigt Name und Abende (nach Datum) als Kasten', () => {
    const blatt = protokollBlatt(q(new Map([['reihe-1', reihe]])));
    const kasten = blatt.teile.filter((t) => t.art === 'kasten');
    expect(kasten).toHaveLength(2);
    const zeilen = kasten[0].zeilen.map((z) => z.absaetze[0].map((l) => l.text).join(''));
    expect(zeilen).toEqual([
      'Reihe „Jona“',
      '13.01.2027  Weglaufen',
      '20.01.2027  Im Bauch des Fisches · Lena · Jona 2',
    ]);
  });

  it('sagt ehrlich, dass die Reihe nicht geladen ist, statt sie wegzulassen', () => {
    const kasten = protokollBlatt(q()).teile.find((t) => t.art === 'kasten');
    expect(kasten?.zeilen[0].absaetze[0][0].text).toMatch(/nicht laden/);
  });
});
