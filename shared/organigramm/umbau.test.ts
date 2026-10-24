import { describe, expect, it } from 'vitest';
import type { OrgGruppe } from './gruppen';
import {
  archivieren,
  einhaengen,
  KEINE_AENDERUNGEN,
  neueGruppe,
  umbauSchritte,
  umbenennen,
  type Heute,
  type PlanAenderungen,
} from './plan';
import { rueckgaengig, schrittAusfuehren } from './umbau';
import { nachbau } from './struktur.testutil';

const g = (id: number, name: string): OrgGruppe => ({
  id,
  name,
  typId: 2,
  statusId: 1,
  farbe: null,
});
// Gottesdienst (10) → Technik (7) → Stream (12); Café (47); Bibelarbeit (37)
const HEUTE: Heute = {
  gruppen: [
    g(10, 'Gottesdienst'),
    g(7, 'Technik'),
    g(12, 'Stream'),
    g(47, 'Café'),
    g(37, 'Bibelarbeit'),
  ],
  eltern: new Map([
    [7, [10]],
    [12, [7]],
  ]),
};
const STATUS = { aktiv: 1, archiviert: 3 };
const ct = () =>
  nachbau(
    { 7: [10], 12: [7], 47: [], 37: [] },
    { 10: 'Gottesdienst', 7: 'Technik', 12: 'Stream', 47: 'Café', 37: 'Bibelarbeit' },
  );
/** Die Schritte, wie sie der Umbau zeigt – aus dem Erzeuger, nicht von Hand. */
const schritte = (a: PlanAenderungen, h: Heute = HEUTE) => umbauSchritte(h, a, new Map());

describe('schrittAusfuehren + rueckgaengig (O7-3)', () => {
  it('neue Gruppe unter einer bestehenden: angelegt, aktiv, nachgelesen; Rückgängig löscht sie', async () => {
    const n = ct();
    const [s] = schritte(neueGruppe(KEINE_AENDERUNGEN, 'Kamera', 2, 7).aenderungen);
    const r = await schrittAusfuehren(n.z, s, STATUS);
    expect(r.angelegt).toEqual({ id: 'n1', ctId: 900 });
    expect(n.eltern.get(900)).toEqual([7]);
    expect(n.status.get(900)).toBe(1);
    await rueckgaengig(n.z, r.rueckweg);
    expect(n.gruppen.has(900)).toBe(false);
  });

  it('neuer Bereich: ohne Obergruppe angelegt; hängt er doch irgendwo → nicht übernommen', async () => {
    const n = ct();
    const [s] = schritte(neueGruppe(KEINE_AENDERUNGEN, 'Gemeinschaft', 2, null).aenderungen);
    await schrittAusfuehren(n.z, s, STATUS);
    expect(n.log).toEqual(['anlegen Gemeinschaft unter null']);
    expect(n.eltern.get(900)).toEqual([]);

    const m = ct();
    m.z.anlegen = (d) => {
      m.gruppen.add(901);
      m.eltern.set(901, [10]);
      m.name.set(901, d.name);
      return Promise.resolve(901);
    };
    await expect(schrittAusfuehren(m.z, s, STATUS)).rejects.toThrow('Obergruppe der neuen Gruppe');
  });

  it('umhängen ersetzt ALLE Obergruppen – erst setzen, dann lösen; Rückgängig stellt beide wieder her', async () => {
    const n = ct();
    n.eltern.set(12, [7, 10]);
    const zwei: Heute = { ...HEUTE, eltern: new Map([...HEUTE.eltern, [12, [7, 10]]]) };
    const [s] = schritte(einhaengen(zwei, KEINE_AENDERUNGEN, 12, 47), zwei);
    const r = await schrittAusfuehren(n.z, s, STATUS);
    expect(n.log).toEqual(['setzen 12→47', 'loesen 12→7', 'loesen 12→10']);
    expect(n.eltern.get(12)).toEqual([47]);
    expect(r.rueckweg).toEqual({ art: 'eltern', id: 12, vorher: [7, 10] });
    await rueckgaengig(n.z, r.rueckweg);
    expect(n.eltern.get(12)?.slice().sort()).toEqual([10, 7]);
  });

  it('umhängen als eigener Bereich: alle lösen; ChurchTools übernimmt es nicht → Fehler', async () => {
    const n = ct();
    const [s] = schritte(einhaengen(HEUTE, KEINE_AENDERUNGEN, 7, null));
    await schrittAusfuehren(n.z, s, STATUS);
    expect(n.eltern.get(7)).toEqual([]);

    const m = ct();
    m.panne.loesenOhneWirkung = true;
    await expect(schrittAusfuehren(m.z, s, STATUS)).rejects.toThrow('das Lösen von der Obergruppe');
    const k = ct();
    k.panne.setzenOhneWirkung = true;
    const [t] = schritte(einhaengen(HEUTE, KEINE_AENDERUNGEN, 12, 47));
    await expect(schrittAusfuehren(k.z, t, STATUS)).rejects.toThrow('die neue Obergruppe');
  });

  it('umbenennen: nachgelesen; ChurchTools übernimmt es nicht → Fehler; Rückgängig = alter Name', async () => {
    const n = ct();
    const [s] = schritte(umbenennen(HEUTE, KEINE_AENDERUNGEN, 37, 'Bibelabend'));
    const r = await schrittAusfuehren(n.z, s, STATUS);
    expect(n.name.get(37)).toBe('Bibelabend');
    await rueckgaengig(n.z, r.rueckweg);
    expect(n.name.get(37)).toBe('Bibelarbeit');

    const m = ct();
    m.panne.aendernOhneWirkung = true;
    await expect(schrittAusfuehren(m.z, s, STATUS)).rejects.toThrow('den neuen Namen');
  });

  it('archivieren: Status „archiviert“, nachgelesen; Rückgängig = Status von vorher', async () => {
    const n = ct();
    n.status.set(47, 2); // „Entwurf“ vorher
    const [s] = schritte(archivieren(KEINE_AENDERUNGEN, 47, true));
    const r = await schrittAusfuehren(n.z, s, STATUS);
    expect(n.status.get(47)).toBe(3);
    await rueckgaengig(n.z, r.rueckweg);
    expect(n.status.get(47)).toBe(2);

    const m = ct();
    m.panne.aendernOhneWirkung = true;
    await expect(schrittAusfuehren(m.z, s, STATUS)).rejects.toThrow('den Status „archiviert“');
  });

  it('Status „archiviert“ unbekannt → Fehler, ohne etwas zu schreiben', async () => {
    const n = ct();
    const [s] = schritte(archivieren(KEINE_AENDERUNGEN, 47, true));
    await expect(schrittAusfuehren(n.z, s, { aktiv: 1, archiviert: null })).rejects.toThrow(
      'archiviert',
    );
    expect(n.log).toEqual([]);
  });

  it('nicht ausführbar (wartet, oder Untergruppen hängen noch darunter) → Fehler, nichts geschrieben', async () => {
    const n = ct();
    const { aenderungen, id } = neueGruppe(KEINE_AENDERUNGEN, 'Gemeinschaft', 2, null);
    const wartend = schritte(einhaengen(HEUTE, aenderungen, 47, id)).find((x) => x.art === 'um')!;
    await expect(schrittAusfuehren(n.z, wartend, STATUS)).rejects.toThrow('nicht ausführbar');
    const [arch] = schritte(archivieren(KEINE_AENDERUNGEN, 7, true)); // Stream hängt darunter
    await expect(schrittAusfuehren(n.z, arch, STATUS)).rejects.toThrow('nicht ausführbar');
    expect(n.log).toEqual([]);
  });
});
