/**
 * **Den Umbau ausführen** (Bauplan O7-3, Alwin 24.10.2026): einen Schritt aus `umbauSchritte` in ChurchTools tun –
 * und zurücknehmen („Rückgängig“ für den zuletzt ausgeführten Schritt). Nur die Regeln; wie geschrieben wird, reicht
 * der Aufrufer herein (`UmbauZugriff`).
 *
 * Gemessen an der Test-Instanz (Messung O7-3, 24.10.2026): Umbenennen und Archivieren = `PATCH /groups/{id}` mit
 * `name` bzw. `groupStatusId` (beides 200, keine Mail; Mitgliedschaften bleiben beim Archivieren). **ChurchTools nimmt
 * auch einen leeren Namen an** – den lässt die Erweiterung gar nicht erst zu (`nameFehler`). Anlegen und Umhängen wie
 * in O5 (`struktur.ts`).
 *
 * Wie überall: **nach jedem Schreiben nachlesen**, nichts automatisch wiederholen.
 */
import { ausfuehrbar, type Schritt } from './plan';
import {
  gruppeWiederLoeschen,
  obergruppenGenau,
  untergruppeAnlegen,
  type StrukturZugriff,
} from './struktur';

export interface UmbauZugriff extends StrukturZugriff {
  /** Name und Status einer Gruppe – frisch, auch wenn sie archiviert ist; `null`, wenn es sie nicht gibt. */
  gruppe(id: number): Promise<{ name: string; statusId: number | null } | null>;
  aendern(id: number, felder: { name?: string; statusId?: number }): Promise<void>;
}

/** Die Status-IDs aus den Stammdaten (`aktivStatus`, `archivStatus`). */
export interface UmbauStatus {
  aktiv: number | null;
  archiviert: number | null;
}

/** Wie ein ausgeführter Schritt zurückgeht. */
export type Rueckweg =
  | { art: 'loeschen'; id: number }
  | { art: 'eltern'; id: number; vorher: number[] }
  | { art: 'name'; id: number; vorher: string }
  | { art: 'status'; id: number; vorher: number };

export interface Ausgefuehrt {
  rueckweg: Rueckweg;
  /** Bei einer neuen Gruppe: ihre eigene ID im Plan und die echte – der Plan übernimmt sie (`angelegt`). */
  angelegt: { id: string; ctId: number } | null;
}

async function feldSetzen(
  z: UmbauZugriff,
  id: number,
  felder: { name: string } | { statusId: number },
  was: string,
): Promise<void> {
  await z.aendern(id, felder);
  const g = await z.gruppe(id);
  const stimmt = 'name' in felder ? g?.name === felder.name : g?.statusId === felder.statusId;
  if (!stimmt) throw z.nichtUebernommen(was);
}

/** Einen Schritt ausführen. Nur, was `ausfuehrbar` ist – alles andere ist ein Fehler des Aufrufers. */
export async function schrittAusfuehren(
  z: UmbauZugriff,
  s: Schritt,
  status: UmbauStatus,
): Promise<Ausgefuehrt> {
  if (!ausfuehrbar(s) || (s.art !== 'name' && s.art !== 'arch' && typeof s.eltern === 'string')) {
    throw new Error('Dieser Schritt ist gerade nicht ausführbar.');
  }
  switch (s.art) {
    case 'neu': {
      if (status.aktiv === null) throw z.nichtUebernommen('den Status „aktiv“ (unbekannt)');
      const ctId = await untergruppeAnlegen(z, {
        name: s.name,
        typId: s.typId,
        statusId: status.aktiv,
        elternId: s.eltern as number | null,
      });
      return { rueckweg: { art: 'loeschen', id: ctId }, angelegt: { id: s.id, ctId } };
    }
    case 'um': {
      const ziel = s.eltern === null ? [] : [s.eltern as number];
      const vorher = await obergruppenGenau(z, s.id, ziel);
      return { rueckweg: { art: 'eltern', id: s.id, vorher }, angelegt: null };
    }
    case 'name': {
      const g = await z.gruppe(s.id);
      if (!g) throw z.nichtUebernommen('die Gruppe (gibt es nicht mehr)');
      await feldSetzen(z, s.id, { name: s.name }, 'den neuen Namen');
      return { rueckweg: { art: 'name', id: s.id, vorher: g.name }, angelegt: null };
    }
    case 'arch': {
      if (status.archiviert === null)
        throw z.nichtUebernommen('den Status „archiviert“ (unbekannt)');
      const g = await z.gruppe(s.id);
      if (!g) throw z.nichtUebernommen('die Gruppe (gibt es nicht mehr)');
      // Wohin „Rückgängig“ zurückgeht, steht VOR dem Schreiben fest – sonst wäre archiviert, aber ohne Rückweg.
      const vorher = g.statusId ?? status.aktiv;
      if (vorher === null) throw z.nichtUebernommen('den bisherigen Status (unbekannt)');
      await feldSetzen(z, s.id, { statusId: status.archiviert }, 'den Status „archiviert“');
      return { rueckweg: { art: 'status', id: s.id, vorher }, angelegt: null };
    }
  }
}

/** Den zuletzt ausgeführten Schritt zurücknehmen – und nachlesen. */
export async function rueckgaengig(z: UmbauZugriff, r: Rueckweg): Promise<void> {
  switch (r.art) {
    case 'loeschen':
      return gruppeWiederLoeschen(z, r.id);
    case 'eltern':
      await obergruppenGenau(z, r.id, r.vorher);
      return;
    case 'name':
      return feldSetzen(z, r.id, { name: r.vorher }, 'den alten Namen');
    case 'status':
      return feldSetzen(z, r.id, { statusId: r.vorher }, 'den alten Status');
  }
}
