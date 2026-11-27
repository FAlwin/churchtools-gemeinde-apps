import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { istAufgabe } from '@shared/protokolle/aufgaben';
import {
  istThemenreihe,
  neueThemenreihe,
  neueZeile,
  type Themenreihe,
} from '@shared/protokolle/themenreihe';
import { ladeMitarbeit } from './lesen';
import { MODUL, nachbauEnde, nachbauStarten, werteVon, type Nachbau } from './nachbau.testhilfe';
import { aufgabenWerte } from './aufgabenSchreiben';
import { ladeThemenreihen, ReiheGeaendert, themenreiheSpeichern } from './themenreiheSchreiben';

/** Die Reihen in „Mitarbeit“ gegen die nachgestellte ChurchTools-Instanz. */
let ct: Nachbau;
const KAT = 66;
const ORT = { modul: MODUL, kategorie: KAT };
const AM = '2026-11-27T10:00:00Z';
const reihe = (name = 'Jona', zeilen = [neueZeile('a', '2027-01-13')]): Themenreihe =>
  neueThemenreihe({ id: 'r1', gruppe: 194, name, zeilen, von: 1, am: AM });
const gespeichert = (): Themenreihe[] =>
  werteVon(ct, KAT)
    .map((w) => JSON.parse(w.value) as unknown)
    .filter(istThemenreihe);

beforeEach(() => {
  ct = nachbauStarten();
  ct.kategorien.push({ id: KAT, shorty: 'mitarbeit-g194', name: 'Mitarbeit · Technik' });
});
afterEach(nachbauEnde);

describe('themenreiheSpeichern', () => {
  it('legt die Reihe an und liest nach – ein zweiter Versuch mit derselben ID legt keine zweite an', async () => {
    const r = await themenreiheSpeichern(ORT, reihe(), null, 1, AM);
    expect(gespeichert()).toEqual([r]);
    await themenreiheSpeichern(ORT, reihe(), null, 1, AM);
    expect(gespeichert()).toHaveLength(1);
  });

  it('ändert denselben Wert und stempelt Person und Zeit; nie gelöscht', async () => {
    const erste = await themenreiheSpeichern(ORT, reihe(), null, 1, AM);
    const zweite = await themenreiheSpeichern(
      ORT,
      reihe('Jona neu'),
      erste,
      7,
      '2026-11-28T08:00:00Z',
    );
    expect(zweite).toMatchObject({ name: 'Jona neu', von: 7, am: '2026-11-28T08:00:00Z' });
    expect(werteVon(ct, KAT)).toHaveLength(1);
    expect(ct.aufrufe.some((x) => x.startsWith('DELETE'))).toBe(false);
  });

  it('hat jemand inzwischen anders gespeichert: nichts überschrieben, ReiheGeaendert', async () => {
    const erste = await themenreiheSpeichern(ORT, reihe(), null, 1, AM);
    await themenreiheSpeichern(ORT, reihe('Von der anderen Person'), erste, 7, AM);
    await expect(
      themenreiheSpeichern(ORT, reihe('Meine Fassung'), erste, 1, AM),
    ).rejects.toBeInstanceOf(ReiheGeaendert);
    expect(gespeichert()[0].name).toBe('Von der anderen Person');
  });

  it('der Wert ist inzwischen verschwunden: nicht still neu angelegt', async () => {
    const erste = await themenreiheSpeichern(ORT, reihe(), null, 1, AM);
    for (const w of werteVon(ct, KAT)) w.value = '{}';
    await expect(themenreiheSpeichern(ORT, reihe('x'), erste, 1, AM)).rejects.toBeInstanceOf(
      ReiheGeaendert,
    );
  });

  it('verschwunden und der Stand sieht aus wie der gesehene: trotzdem nicht still neu angelegt', async () => {
    const erste = await themenreiheSpeichern(ORT, reihe(), null, 1, AM);
    for (const w of werteVon(ct, KAT)) w.value = '{}';
    // Gleiche Person, gleiche Zeit, gleicher Inhalt: der Vergleich mit dem gesehenen Stand allein träfe nichts.
    await expect(themenreiheSpeichern(ORT, reihe(), erste, 1, AM)).rejects.toBeInstanceOf(
      ReiheGeaendert,
    );
    expect(gespeichert()).toEqual([]);
  });

  it('ChurchTools nimmt sie nicht an (201, aber nichts gespeichert): Fehler', async () => {
    ct.schluckeWert = () => true;
    await expect(themenreiheSpeichern(ORT, reihe(), null, 1, AM)).rejects.toThrow(
      /nicht übernommen/,
    );
    expect(gespeichert()).toEqual([]);
  });

  it('ein vorübergehender Fehler (503) beim Schreiben: Fehler, nichts angelegt', async () => {
    ct.fehlerBei = { methode: 'POST', status: 503 };
    await expect(themenreiheSpeichern(ORT, reihe(), null, 1, AM)).rejects.toThrow();
    expect(gespeichert()).toEqual([]);
  });
});

describe('Reihe in „Mitarbeit“ ist kein To-Do', () => {
  it('kein To-Do-Leser sieht sie – weder die Liste zum Schreiben noch die Übersichten', async () => {
    await themenreiheSpeichern(ORT, reihe(), null, 1, AM);
    expect(await aufgabenWerte(ORT)).toEqual([]);
    const m = await ladeMitarbeit(MODUL, { mitarbeit: KAT });
    expect(m.aufgaben).toEqual([]);
    expect(m.todoVorschlaege).toEqual([]);
    expect(m.vorschlaege).toEqual([]);
    expect(m.termine).toEqual([]);
    expect(werteVon(ct, KAT).every((w) => !istAufgabe(JSON.parse(w.value)))).toBe(true);
    expect(await ladeThemenreihen(ORT)).toHaveLength(1);
  });

  it('als gelöscht vermerkte Reihen erscheinen nicht', async () => {
    const r = await themenreiheSpeichern(ORT, reihe(), null, 1, AM);
    const w = werteVon(ct, KAT)[0];
    w.value = JSON.stringify({ ...r, geloescht: { von: 1, am: AM } });
    expect(await ladeThemenreihen(ORT)).toEqual([]);
  });
});
