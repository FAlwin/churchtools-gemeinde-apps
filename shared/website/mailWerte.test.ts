import { describe, expect, it } from 'vitest';
import type { Wert } from '../ct/modulDaten';
import {
  LEITUNG_ART,
  MAIL_ART,
  istLeitungsWert,
  istMailWert,
  leitungAusWerten,
  leitungSetzen,
  mailAnAusWerten,
  mailSchalterSetzen,
} from './mailWerte';
import { seiteSpeichern, websiteAusWerten, websiteLesen } from './speicher';
import { statusSetzen } from './status';
import { fakeSpeicher, fehlerMit } from './speicher.testutil';
import { baustein, seiteMit } from './website.testdaten';

/**
 * Die zwei kleinen Werte für die Mails im Freigabe-Weg (W3b-3): `website-leitung` (welche Rollen sind die Leitung) und
 * `website-mail` (der Schalter). Gegen einen nachgebauten Speicher – die Werte werden mit den Schreibfunktionen erzeugt, nicht
 * als Literale hingeschrieben (nur die beschädigten Fälle brauchen Literale).
 */
const T = new Date('2026-11-23T10:00:00Z');
const wert = (id: number, value: string): Wert => ({ id, dataCategoryId: 1, value });
const roh = (o: object) => JSON.stringify(o);

describe('website-leitung', () => {
  it('kein Wert: null (dann gilt die Vorbelegung, siehe mail.ts)', () => {
    expect(leitungAusWerten([])).toBeNull();
  });

  it('schreiben und wieder lesen – sortiert, ohne Doppelte', async () => {
    const s = fakeSpeicher();
    await leitungSetzen(s.ort, [3290, 3287, 3290]);
    expect(leitungAusWerten(s.werte)).toEqual([3287, 3290]);
    expect(s.werte).toHaveLength(1);
    expect(istLeitungsWert(s.werte[0])).toBe(true);
  });

  it('ein leerer Wert ist eine echte Aussage („niemand“) und nicht dasselbe wie „kein Wert“', async () => {
    const s = fakeSpeicher();
    await leitungSetzen(s.ort, []);
    expect(leitungAusWerten(s.werte)).toEqual([]);
  });

  it('ändern: der vorhandene Wert wird geändert, kein zweiter angelegt', async () => {
    const s = fakeSpeicher();
    await leitungSetzen(s.ort, [1]);
    s.neuesLog();
    await leitungSetzen(s.ort, [2]);
    expect(s.werte).toHaveLength(1);
    expect(leitungAusWerten(s.werte)).toEqual([2]);
    expect(s.schreibzugriffe()).toEqual(['PUT 1']);
  });

  it('steht es schon genau so da, wird nichts geschrieben', async () => {
    const s = fakeSpeicher();
    await leitungSetzen(s.ort, [1, 2]);
    s.neuesLog();
    await leitungSetzen(s.ort, [2, 1]);
    expect(s.schreibzugriffe()).toEqual([]);
  });

  it('nachlesen: nimmt ChurchTools das Schreiben nicht an (201/200 ohne Wirkung), wirft es – ein Erfolgssignal ist kein Beleg', async () => {
    const s = fakeSpeicher();
    const schreibe = s.port.schreibe.bind(s.port);
    s.port.schreibe = () => Promise.resolve(); // „success“, aber nichts passiert
    await expect(leitungSetzen(s.ort, [1])).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining('nicht übernommen') as unknown as string,
    });
    s.port.schreibe = schreibe;
  });

  it('Fehler beim Schreiben (503, kein Recht): wird geworfen, der bisherige Wert bleibt', async () => {
    const s = fakeSpeicher();
    await leitungSetzen(s.ort, [1]);
    s.steuerung.ausfall = (z) => (z.art === 'PUT' ? fehlerMit(503) : undefined);
    await expect(leitungSetzen(s.ort, [2])).rejects.toMatchObject({ status: 503 });
    expect(leitungAusWerten(s.werte)).toEqual([1]);
    s.steuerung.ausfall = (z) => (z.art === 'PUT' ? fehlerMit(403) : undefined);
    await expect(leitungSetzen(s.ort, [2])).rejects.toMatchObject({ status: 403 });
    expect(leitungAusWerten(s.werte)).toEqual([1]);
  });

  it('beschädigt (falsche Typen, kein JSON): gilt wie fehlend; das nächste Schreiben stellt ihn wieder her', async () => {
    const s = fakeSpeicher();
    s.lege(roh({ art: LEITUNG_ART, fassung: 1, rollen: 'alle' }));
    expect(leitungAusWerten(s.werte)).toBeNull();
    expect(istLeitungsWert(s.werte[0])).toBe(false);
    await leitungSetzen(s.ort, [4]);
    expect(s.werte).toHaveLength(1); // überschrieben, kein zweiter
    expect(leitungAusWerten(s.werte)).toEqual([4]);
    expect(leitungAusWerten([wert(1, 'kein json')])).toBeNull();
  });

  it('mehrere Werte: es gilt der mit der kleinsten ID', () => {
    const a = wert(5, roh({ art: LEITUNG_ART, fassung: 1, rollen: [5] }));
    const b = wert(2, roh({ art: LEITUNG_ART, fassung: 1, rollen: [2] }));
    expect(leitungAusWerten([a, b])).toEqual([2]);
  });

  it('eine unbekannte Fassung zählt nicht', () => {
    expect(
      leitungAusWerten([wert(1, roh({ art: LEITUNG_ART, fassung: 2, rollen: [1] }))]),
    ).toBeNull();
  });
});

describe('website-mail (der Schalter)', () => {
  it('kein Wert = an', () => {
    expect(mailAnAusWerten([])).toBe(true);
  });

  it('ausschalten und wieder einschalten – es bleibt EIN Wert', async () => {
    const s = fakeSpeicher();
    await mailSchalterSetzen(s.ort, false);
    expect(mailAnAusWerten(s.werte)).toBe(false);
    await mailSchalterSetzen(s.ort, true);
    expect(mailAnAusWerten(s.werte)).toBe(true);
    expect(s.werte).toHaveLength(1);
    expect(istMailWert(s.werte[0])).toBe(true);
  });

  it('nachlesen: ohne Wirkung gemeldet = Fehler; der Schalter bleibt, wie er war', async () => {
    const s = fakeSpeicher();
    await mailSchalterSetzen(s.ort, false);
    s.port.schreibe = () => Promise.resolve();
    await expect(mailSchalterSetzen(s.ort, true)).rejects.toMatchObject({ status: 502 });
    expect(mailAnAusWerten(s.werte)).toBe(false);
  });

  it('Fehler beim Schreiben (503): wird geworfen, der Schalter bleibt', async () => {
    const s = fakeSpeicher();
    await mailSchalterSetzen(s.ort, false);
    s.steuerung.ausfall = (z) => (z.art === 'PUT' ? fehlerMit(503) : undefined);
    await expect(mailSchalterSetzen(s.ort, true)).rejects.toMatchObject({ status: 503 });
    expect(mailAnAusWerten(s.werte)).toBe(false);
  });

  it('beschädigt: gilt wie fehlend (= an); der Wert wird nicht gelöscht und beim nächsten Setzen überschrieben', async () => {
    const s = fakeSpeicher();
    s.lege(roh({ art: MAIL_ART, fassung: 1, an: 'nein' }));
    expect(mailAnAusWerten(s.werte)).toBe(true);
    await mailSchalterSetzen(s.ort, false);
    expect(s.werte).toHaveLength(1);
    expect(mailAnAusWerten(s.werte)).toBe(false);
  });
});

describe('beide Werte beim Lesen der Website', () => {
  it('werden übersprungen: kein Problem, nichts davon in Seiten, Status oder Sperren – bei ALLEN Sonderwerten dieselbe Regel', async () => {
    const s = fakeSpeicher();
    await seiteSpeichern(
      s.ort,
      seiteMit([baustein('text')], { id: 'a', pfad: 'a', titel: 'A' }),
      T,
    );
    await statusSetzen(
      s.ort,
      'a',
      { zustand: 'eingereicht' },
      { person: 5, name: 'Rita', fenster: 'f' },
      T,
    );
    await leitungSetzen(s.ort, [3290]);
    await mailSchalterSetzen(s.ort, false);
    const stand = await websiteLesen(s.port, 7, 1);
    expect(stand.probleme).toEqual([]);
    expect(stand.seiten.map((x) => x.id)).toEqual(['a']);
    expect(Object.keys(stand.status)).toEqual(['a']);
    expect(stand.verwaist).toBe(0);
    expect(stand.staende).toHaveLength(1);
  });

  it('Schreiben der beiden Werte lässt Seiten und Köpfe unberührt (und umgekehrt: Speichern der Seite lässt sie stehen)', async () => {
    const s = fakeSpeicher();
    await leitungSetzen(s.ort, [1]);
    await mailSchalterSetzen(s.ort, false);
    await seiteSpeichern(
      s.ort,
      seiteMit([baustein('text')], { id: 'a', pfad: 'a', titel: 'A' }),
      T,
    );
    expect(leitungAusWerten(s.werte)).toEqual([1]);
    expect(mailAnAusWerten(s.werte)).toBe(false);
    expect(websiteAusWerten(s.werte).probleme).toEqual([]);
  });

  it('ein beschädigter Wert wird – wie ein beschädigter Status – gemeldet statt still verschluckt', () => {
    const kaputt = wert(1, roh({ art: MAIL_ART, fassung: 1, an: 'nein' }));
    expect(websiteAusWerten([kaputt]).probleme).toHaveLength(1);
  });
});

describe('website-leitung je Gruppe (W3b-4a)', () => {
  it('ein alter Wert ohne `gruppe` gilt für die Website – und nur für sie', () => {
    const w = [wert(1, roh({ art: LEITUNG_ART, fassung: 1, rollen: [3290] }))];
    expect(leitungAusWerten(w)).toEqual([3290]);
    expect(leitungAusWerten(w, null)).toEqual([3290]);
    expect(leitungAusWerten(w, 347)).toBeNull();
    expect(istLeitungsWert(w[0])).toBe(true);
  });

  it('je Gruppe ein Wert: Untergruppe und Website stören sich nicht – auch wenn der Untergruppen-Wert die kleinere ID hat', async () => {
    const s = fakeSpeicher();
    await leitungSetzen(s.ort, [3323], 347);
    await leitungSetzen(s.ort, [3290]);
    expect(s.werte).toHaveLength(2);
    expect(leitungAusWerten(s.werte)).toEqual([3290]);
    expect(leitungAusWerten(s.werte, 347)).toEqual([3323]);
    expect(leitungAusWerten(s.werte, 350)).toBeNull();
    expect(s.werte.every(istLeitungsWert)).toBe(true);
  });

  it('der Wert der Website bleibt OHNE `gruppe` (abwärtskompatibel), der einer Untergruppe trägt sie', async () => {
    const s = fakeSpeicher();
    await leitungSetzen(s.ort, [3290]);
    await leitungSetzen(s.ort, [3323], 347);
    const inhalte = s.werte.map((w) => JSON.parse(w.value) as { gruppe?: number });
    expect(inhalte.map((i) => i.gruppe)).toEqual([undefined, 347]);
  });

  it('ändern trifft nur den Wert der eigenen Gruppe', async () => {
    const s = fakeSpeicher();
    await leitungSetzen(s.ort, [3290]);
    await leitungSetzen(s.ort, [3323], 347);
    await leitungSetzen(s.ort, [3320], 347);
    expect(s.werte).toHaveLength(2);
    expect(leitungAusWerten(s.werte)).toEqual([3290]);
    expect(leitungAusWerten(s.werte, 347)).toEqual([3320]);
  });
});
