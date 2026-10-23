import { describe, expect, it } from 'vitest';
import type { OrgGruppe } from './gruppen';
import {
  aktivStatus,
  gruppeWiederLoeschen,
  moeglicheObergruppen,
  nameFehler,
  obergruppeAendern,
  obergruppeDazu,
  obergruppeLoesen,
  pfadVon,
  untergruppeAnlegen,
  untergruppenVon,
  type StrukturZugriff,
} from './struktur';

/** Ein nachgebautes ChurchTools: Obergruppen je Gruppe, ein Protokoll der Aufrufe – und einstellbare Pannen. */
function nachbau(start: Record<number, number[]>) {
  const eltern = new Map(Object.entries(start).map(([k, v]) => [Number(k), [...v]]));
  const gruppen = new Set([...eltern.keys(), ...[...eltern.values()].flat()]);
  const log: string[] = [];
  const panne = { setzenOhneWirkung: false, loesenOhneWirkung: false, loesenWirft: false };
  const anlegenPanne = { verschwindet: false, ohneEltern: false, loeschenOhneWirkung: false };
  let naechste = 900;
  const z: StrukturZugriff = {
    obergruppen: (id) => Promise.resolve([...(eltern.get(id) ?? [])]),
    setzen: (id, e) => {
      log.push(`setzen ${id}→${e}`);
      if (!panne.setzenOhneWirkung) eltern.set(id, [...new Set([...(eltern.get(id) ?? []), e])]);
      return Promise.resolve();
    },
    loesen: (id, e) => {
      log.push(`loesen ${id}→${e}`);
      if (panne.loesenWirft) return Promise.reject(new Error('Netz weg'));
      if (!panne.loesenOhneWirkung)
        eltern.set(
          id,
          (eltern.get(id) ?? []).filter((x) => x !== e),
        );
      return Promise.resolve();
    },
    anlegen: (d) => {
      const id = naechste++;
      log.push(`anlegen ${d.name} unter ${d.elternId}`);
      if (!anlegenPanne.verschwindet) gruppen.add(id);
      if (!anlegenPanne.ohneEltern) eltern.set(id, [d.elternId]);
      return Promise.resolve(id);
    },
    gibtEs: (id) => Promise.resolve(gruppen.has(id)),
    loeschen: (id) => {
      log.push(`loeschen ${id}`);
      if (!anlegenPanne.loeschenOhneWirkung) gruppen.delete(id);
      return Promise.resolve();
    },
    nichtUebernommen: (was) => new Error(`nicht übernommen: ${was}`),
  };
  return { z, eltern, log, panne, anlegenPanne };
}

describe('obergruppeAendern – erst neu setzen, dann alt lösen, nachlesen', () => {
  it('Reihenfolge: nie ohne Obergruppe; danach nur die neue', async () => {
    const n = nachbau({ 7: [10] });
    expect(await obergruppeAendern(n.z, 7, 10, 11)).toEqual([11]);
    expect(n.log).toEqual(['setzen 7→11', 'loesen 7→10']);
  });

  it('andere Obergruppen bleiben stehen', async () => {
    const n = nachbau({ 7: [10, 20] });
    expect(await obergruppeAendern(n.z, 7, 10, 11)).toEqual([20, 11]);
  });

  it('Lösen scheitert → die Gruppe hängt unter beiden; der Fehler kommt durch', async () => {
    const n = nachbau({ 7: [10] });
    n.panne.loesenWirft = true;
    await expect(obergruppeAendern(n.z, 7, 10, 11)).rejects.toThrow('Netz weg');
    expect(n.eltern.get(7)).toEqual([10, 11]);
  });

  it('„gesetzt“ gemeldet, aber nicht da → nicht übernommen (kein falsches Erledigt)', async () => {
    const n = nachbau({ 7: [10] });
    n.panne.setzenOhneWirkung = true;
    await expect(obergruppeAendern(n.z, 7, 10, 11)).rejects.toThrow(/die neue Obergruppe/);
  });

  it('„gelöst“ gemeldet, aber noch da → nicht übernommen', async () => {
    const n = nachbau({ 7: [10] });
    n.panne.loesenOhneWirkung = true;
    await expect(obergruppeAendern(n.z, 7, 10, 11)).rejects.toThrow(/Lösen von der bisherigen/);
  });
});

describe('obergruppeDazu / obergruppeLoesen', () => {
  it('weitere Obergruppe dazu', async () => {
    const n = nachbau({ 7: [10] });
    expect(await obergruppeDazu(n.z, 7, 11)).toEqual([10, 11]);
  });

  it('dazu gemeldet, aber nicht da → nicht übernommen', async () => {
    const n = nachbau({ 7: [10] });
    n.panne.setzenOhneWirkung = true;
    await expect(obergruppeDazu(n.z, 7, 11)).rejects.toThrow(/weitere Obergruppe/);
  });

  it('die letzte lösen → eigener Bereich (keine Obergruppe)', async () => {
    const n = nachbau({ 7: [10] });
    expect(await obergruppeLoesen(n.z, 7, 10)).toEqual([]);
  });

  it('lösen gemeldet, aber noch da → nicht übernommen', async () => {
    const n = nachbau({ 7: [10] });
    n.panne.loesenOhneWirkung = true;
    await expect(obergruppeLoesen(n.z, 7, 10)).rejects.toThrow(/Lösen von der Obergruppe/);
  });
});

describe('untergruppeAnlegen / gruppeWiederLoeschen', () => {
  const neu = { name: 'Kamera', typId: 2, statusId: 1, elternId: 7 };

  it('angelegt, nachgelesen: da und unter der Obergruppe', async () => {
    const n = nachbau({ 7: [10] });
    expect(await untergruppeAnlegen(n.z, neu)).toBe(900);
    expect(n.eltern.get(900)).toEqual([7]);
  });

  it('„angelegt“ gemeldet, aber nicht da → nicht übernommen', async () => {
    const n = nachbau({ 7: [10] });
    n.anlegenPanne.verschwindet = true;
    await expect(untergruppeAnlegen(n.z, neu)).rejects.toThrow(/die neue Gruppe/);
  });

  it('da, aber nicht unter der Obergruppe → nicht übernommen', async () => {
    const n = nachbau({ 7: [10] });
    n.anlegenPanne.ohneEltern = true;
    await expect(untergruppeAnlegen(n.z, neu)).rejects.toThrow(/Obergruppe der neuen Gruppe/);
  });

  it('Rückgängig löscht die neue Gruppe; noch da → nicht übernommen', async () => {
    const n = nachbau({ 7: [10] });
    const id = await untergruppeAnlegen(n.z, neu);
    await gruppeWiederLoeschen(n.z, id);
    expect(await n.z.gibtEs(id)).toBe(false);

    const m = nachbau({ 7: [10] });
    const id2 = await untergruppeAnlegen(m.z, neu);
    m.anlegenPanne.loeschenOhneWirkung = true;
    await expect(gruppeWiederLoeschen(m.z, id2)).rejects.toThrow(/Löschen der Gruppe/);
  });
});

const g = (id: number, name: string): OrgGruppe => ({
  id,
  name,
  typId: 2,
  statusId: 1,
  farbe: null,
});
// Gottesdienst (10) → Technik (7) → Stream (12) → Kamera (13); Café (47); Leitung (11); 99 unsichtbar über Ton (15)
const GRUPPEN = [
  g(10, 'Gottesdienst'),
  g(7, 'Technik'),
  g(12, 'Stream'),
  g(13, 'Kamera'),
  g(47, 'Café'),
  g(11, 'Leitung'),
  g(15, 'Ton'),
];
const ELTERN = new Map<number, number[]>([
  [7, [10]],
  [12, [7]],
  [13, [12]],
  [99, [7]],
  [15, [99]],
]);

describe('untergruppenVon / pfadVon / moeglicheObergruppen', () => {
  it('alle Untergruppen über die ganze Hierarchie – auch hinter einer unsichtbaren Stufe', () => {
    expect([...untergruppenVon(ELTERN, 7)].sort((a, b) => a - b)).toEqual([12, 13, 15, 99]);
    expect([...untergruppenVon(ELTERN, 13)]).toEqual([]);
  });

  it('kreisfest', () => {
    const kreis = new Map([
      [1, [2]],
      [2, [1]],
    ]);
    expect([...untergruppenVon(kreis, 1)]).toEqual([2]);
    expect(pfadVon([g(1, 'A'), g(2, 'B')], kreis, 1)).toEqual(['B', 'A']);
  });

  it('Pfad von oben, über sichtbare Obergruppen', () => {
    expect(pfadVon(GRUPPEN, ELTERN, 13)).toEqual(['Gottesdienst', 'Technik', 'Stream', 'Kamera']);
    // Ton hängt unter einer unsichtbaren Gruppe → beginnt bei sich selbst
    expect(pfadVon(GRUPPEN, ELTERN, 15)).toEqual(['Ton']);
  });

  it('Ziele: nicht sie selbst, keine Untergruppe (Kreis), nicht die jetzige Obergruppe; nach Pfad sortiert', () => {
    const ziele = moeglicheObergruppen(GRUPPEN, ELTERN, 7).map((x) => x.pfad.join(' › '));
    expect(ziele).toEqual(['Café', 'Leitung']);
    expect(moeglicheObergruppen(GRUPPEN, ELTERN, 47).map((x) => x.pfad.join(' › '))).toEqual([
      'Gottesdienst',
      'Gottesdienst › Technik',
      'Gottesdienst › Technik › Stream',
      'Gottesdienst › Technik › Stream › Kamera',
      'Leitung',
      'Ton',
    ]);
  });
});

describe('nameFehler / aktivStatus', () => {
  it('Name: leer, nur Leerzeichen, zu lang', () => {
    expect(nameFehler('  ')).toMatch(/Namen eingeben/);
    expect(nameFehler('x'.repeat(256))).toMatch(/zu lang/);
    expect(nameFehler(' Kamera ')).toBeNull();
    expect(nameFehler('x'.repeat(255))).toBeNull();
  });

  it('„aktiv“ über den internen Namen, nicht über die Zahl; sonst Status der Obergruppe', () => {
    const st = [
      { id: 7, name: 'pending' },
      { id: 5, name: 'active' },
    ];
    expect(aktivStatus(st, 1)).toBe(5);
    expect(aktivStatus([{ id: 2, name: 'pending' }], 1)).toBe(1);
    expect(aktivStatus(null, null)).toBeNull();
  });
});
