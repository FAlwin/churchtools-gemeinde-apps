import { describe, expect, it } from 'vitest';
import {
  DATEN_NAME,
  dateienAus,
  erstellePersonenAblage,
  type AblagePort,
  type DatenDatei,
} from './personenAblage';

/**
 * Die Personen-Ablage für eine **zweite App** (Protokolle S7-3): eigenes Präfix, eigene Daten-Datei, `holeDaten` und
 * `mischeEin`. Gegen einen nachgestellten Dateispeicher der eigenen Person – mit Musik-App-Dateien daneben.
 */
function speicher() {
  let naechste = 1;
  const dateien: { id: number; name: string; inhalt: string }[] = [];
  const aufrufe: string[] = [];
  const port: AblagePort = {
    meineId: () => Promise.resolve(19),
    lesen: () =>
      Promise.resolve({
        data: dateien.map((d) => ({ id: d.id, name: d.name, fileUrl: `u${d.id}` })),
      }),
    datei: (url) =>
      Promise.resolve(new TextEncoder().encode(dateien.find((d) => `u${d.id}` === url)!.inhalt)),
    hochladen: (_p, name, inhalt) => {
      aufrufe.push(`hoch ${name}`);
      dateien.push({ id: naechste++, name, inhalt: new TextDecoder().decode(inhalt) });
      return Promise.resolve();
    },
    loeschen: (id) => {
      aufrufe.push(`weg ${id}`);
      dateien.splice(
        dateien.findIndex((d) => d.id === id),
        1,
      );
      return Promise.resolve();
    },
    fehler: (status, meldung) => Object.assign(new Error(meldung), { status }),
    istKeinRecht: () => false,
    istNichtGefunden: () => false,
  };
  const ablegen = (name: string, d: unknown) =>
    dateien.push({ id: naechste++, name, inhalt: JSON.stringify(d) });
  return { port, dateien, aufrufe, ablegen };
}
const datei = (felder: Record<string, [unknown, number]>): DatenDatei => ({
  v: 1,
  felder: Object.fromEntries(Object.entries(felder).map(([k, [w, t]]) => [k, { w, t }])),
});
const NAME = 'protokolle_einstellungen.json';
const neu = () => erstellePersonenAblage({ praefix: 'protokolle_', datenName: NAME });

describe('Personen-Ablage für die Protokolle (S7-3)', () => {
  it('sieht nur die eigenen Dateien – die der Musik-App bleiben unberührt', async () => {
    const s = speicher();
    s.ablegen(DATEN_NAME, datei({ sortierung: ['fremd', 99] }));
    s.ablegen(NAME, datei({ sortierung: ['alpha', 5] }));
    expect(await neu().holeDaten(s.port)).toEqual(datei({ sortierung: ['alpha', 5] }));
    expect(
      dateienAus({ data: [{ id: 1, name: DATEN_NAME, fileUrl: 'x' }] }, 'protokolle_'),
    ).toEqual([]);
    await neu().mischeEin(s.port, datei({ ansicht: ['board', 6] }));
    expect(s.dateien.find((d) => d.name === DATEN_NAME)).toBeTruthy();
  });

  it('mischeEin: Feld für Feld, die jüngere Änderung gewinnt; ersetzt (neu hoch, dann alt weg)', async () => {
    const s = speicher();
    s.ablegen(NAME, datei({ ansicht: ['board', 10], nach: ['person', 3] }));
    const stand = await neu().mischeEin(
      s.port,
      datei({ ansicht: ['liste', 5], nach: ['status', 8] }),
    );
    expect(stand).toEqual(datei({ ansicht: ['board', 10], nach: ['status', 8] }));
    expect(s.aufrufe).toEqual([`hoch ${NAME}`, 'weg 1']);
    expect(JSON.parse(s.dateien[0].inhalt)).toEqual(stand);
  });

  it('mischeEin: hat das Gerät nichts Neueres, wird nichts hochgeladen', async () => {
    const s = speicher();
    s.ablegen(NAME, datei({ ansicht: ['board', 10] }));
    expect(await neu().mischeEin(s.port, datei({ ansicht: ['liste', 5] }))).toEqual(
      datei({ ansicht: ['board', 10] }),
    );
    expect(s.aufrufe).toEqual([]);
  });

  it('mischeEin: noch keine Datei – legt sie an', async () => {
    const s = speicher();
    await neu().mischeEin(s.port, datei({ sortierung: ['manuell', 1] }));
    expect(s.dateien.map((d) => d.name)).toEqual([NAME]);
  });
});
