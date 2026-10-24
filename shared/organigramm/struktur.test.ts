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
  weiterSichtbarUeber,
} from './struktur';
import { nachbau } from './struktur.testutil';

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

describe('weiterSichtbarUeber (Abnahme 23.10.2026)', () => {
  // A (1) → C (3); B (2) hängt unter A
  const e = new Map<number, number[]>([
    [3, [1]],
    [2, [1]],
  ]);
  it('neue Obergruppe liegt unter der alten → weiter sichtbar', () => {
    expect(weiterSichtbarUeber(e, 1, [3])).toBe(true);
  });
  it('neue Obergruppe woanders → nicht mehr über die alte', () => {
    expect(weiterSichtbarUeber(e, 1, [47])).toBe(false);
  });
  it('lösen, aber eine andere bleibende Obergruppe liegt unter der alten → weiter sichtbar', () => {
    expect(weiterSichtbarUeber(e, 1, [3])).toBe(true);
    expect(weiterSichtbarUeber(e, 1, [])).toBe(false);
  });
});
