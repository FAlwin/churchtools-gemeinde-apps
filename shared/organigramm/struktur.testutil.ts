// Test-Hilfe: ein nachgebautes ChurchTools für die Struktur (O5) und den Umbau (O7-3) – eine Stelle statt zweier Kopien.
import type { StrukturZugriff } from './struktur';
import type { UmbauZugriff } from './umbau';

/**
 * Ein nachgebautes ChurchTools: Obergruppen je Gruppe, Name und Status, ein Protokoll der Aufrufe – und einstellbare
 * Pannen. Verhält sich wie gemessen: `PATCH` nimmt alles an (auch einen leeren Namen), Anlegen ohne Obergruppe ergibt
 * einen Bereich.
 */
export function nachbau(start: Record<number, number[]>, namen: Record<number, string> = {}) {
  const eltern = new Map(Object.entries(start).map(([k, v]) => [Number(k), [...v]]));
  const gruppen = new Set([...eltern.keys(), ...[...eltern.values()].flat()]);
  const name = new Map<number, string>(Object.entries(namen).map(([k, v]) => [Number(k), v]));
  const status = new Map<number, number>();
  const log: string[] = [];
  const panne = {
    setzenOhneWirkung: false,
    loesenOhneWirkung: false,
    loesenWirft: false,
    aendernOhneWirkung: false,
  };
  const anlegenPanne = { verschwindet: false, ohneEltern: false, loeschenOhneWirkung: false };
  let naechste = 900;
  const z: StrukturZugriff & UmbauZugriff = {
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
      name.set(id, d.name);
      status.set(id, d.statusId);
      if (!anlegenPanne.ohneEltern) eltern.set(id, d.elternId === null ? [] : [d.elternId]);
      return Promise.resolve(id);
    },
    gibtEs: (id) => Promise.resolve(gruppen.has(id)),
    loeschen: (id) => {
      log.push(`loeschen ${id}`);
      if (!anlegenPanne.loeschenOhneWirkung) gruppen.delete(id);
      return Promise.resolve();
    },
    gruppe: (id) =>
      Promise.resolve(
        gruppen.has(id) ? { name: name.get(id) ?? '', statusId: status.get(id) ?? 1 } : null,
      ),
    aendern: (id, f) => {
      log.push(`aendern ${id} ${JSON.stringify(f)}`);
      if (!panne.aendernOhneWirkung) {
        if (f.name !== undefined) name.set(id, f.name);
        if (f.statusId !== undefined) status.set(id, f.statusId);
      }
      return Promise.resolve();
    },
    nichtUebernommen: (was) => new Error(`nicht übernommen: ${was}`),
  };
  return { z, eltern, gruppen, name, status, log, panne, anlegenPanne };
}
