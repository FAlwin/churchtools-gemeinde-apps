/**
 * **Ins Archiv und zurück** (A4-Nachtrag, A9-4) – die eine Stelle für „Löschen“ (= Archiv) samt „Rückgängig“, für das
 * Fenster „Verwalten“ und die Startseite. Archivieren schaltet unsere Abläufe in ChurchTools ab, und das Zurückholen
 * schaltet sie nicht wieder ein (gemessen 24.10.2026) – darum holt „Rückgängig“ eine freigegebene Veranstaltung samt
 * Abläufen zurück (`ablaeufeWiederAn`). Ein Entwurf braucht das nicht: Beim Freigeben gehen sie ohnehin an.
 */
import { ablaeufeWiederAn } from './ablaeufe';
import { STATUS, setzeStatus } from './einrichten';
import type { Aenderung } from './Rueckgaengig';

/** Archivieren – liefert die Meldung samt „Rückgängig“ auf den Status von vorher. */
export async function insArchiv(
  id: number,
  name: string,
  statusVorher: number,
): Promise<Aenderung> {
  await setzeStatus(id, STATUS.archiviert);
  return {
    text: `„${name}“ ist im Archiv.`,
    rueckgaengig: () => zurueckAusDemArchiv(id, statusVorher),
  };
}

/** Den Status von vorher wiederherstellen – freigegeben samt Abläufen. */
export async function zurueckAusDemArchiv(id: number, statusId: number): Promise<void> {
  await setzeStatus(id, statusId);
  if (statusId === STATUS.freigegeben) await ablaeufeWiederAn(id);
}
