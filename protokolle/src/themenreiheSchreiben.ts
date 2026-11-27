/**
 * **Reihen in „Mitarbeit“ lesen und schreiben** (Baustein „Reihe“) – ein Wert je Reihe, derselbe Weg wie bei To-Dos und
 * Termin-Ständen: frisch lesen, schreiben, **nachlesen** (ein `201` ist kein Beleg), jeder Fehler wird geworfen, nie hart
 * gelöscht. Die Regeln stehen in `@shared/protokolle/themenreihe`.
 *
 * **Gleichzeitiges Bearbeiten:** Das Fenster ersetzt die ganze Zeilenliste. Hat jemand die Reihe inzwischen anders
 * gespeichert als sie beim Öffnen aussah (`gesehen`), wird nichts überschrieben – `ReiheGeaendert`.
 */
import {
  istThemenreihe,
  reiheLesen,
  reiheSchreibform,
  type Themenreihe,
} from '@shared/protokolle/themenreihe';
import { derArt, mitarbeitRoh, wertNachgelesen, type MitarbeitOrt } from './mitarbeitWerte';

const TEXTE = {
  verweigert: 'Du darfst in dieser Gruppe nichts speichern.',
  nichtUebernommen: 'ChurchTools hat die Reihe nicht übernommen.',
};

/** Jemand hat die Reihe inzwischen anders gespeichert – nichts wurde überschrieben. */
export class ReiheGeaendert extends Error {
  constructor() {
    super('Die Reihe wurde inzwischen von jemand anderem geändert. Bitte öffne sie neu.');
    this.name = 'ReiheGeaendert';
  }
}

/** Die Reihen aus einem gelesenen Stand (`mitarbeitRoh`) – ohne die als gelöscht vermerkten, normalisiert zum Anzeigen. */
export function themenreihenAusRoh(roh: readonly { wert: number; x: unknown }[]): Themenreihe[] {
  return derArt(roh, istThemenreihe)
    .map((w) => w.x)
    .filter((r) => !r.geloescht)
    .map(reiheLesen);
}

/** Alle Reihen der Gruppe, einmal gelesen. */
export async function ladeThemenreihen(ort: MitarbeitOrt): Promise<Themenreihe[]> {
  return themenreihenAusRoh(await mitarbeitRoh(ort));
}

/**
 * **Eine Reihe speichern** (neu oder geändert). `gesehen`: die Reihe, wie das Fenster sie beim Öffnen las – `null` bei einer
 * neuen. Wurde sie inzwischen anders gespeichert (oder gibt es sie nicht mehr), wird nichts geschrieben. Der zweite Versuch
 * mit derselben ID legt nichts doppelt an (`wertNachgelesen` findet den ersten vor). Liefert die gespeicherte Reihe.
 */
export function themenreiheSpeichern(
  ort: MitarbeitOrt,
  reihe: Themenreihe,
  gesehen: Themenreihe | null,
  ich: number,
  am: string,
): Promise<Themenreihe> {
  const soll = reiheSchreibform({ ...reihe, von: ich, am });
  const vorher = gesehen ? JSON.stringify(reiheSchreibform(gesehen)) : null;
  return wertNachgelesen(
    ort,
    istThemenreihe,
    soll.id,
    (alt) => {
      if (vorher !== null && JSON.stringify(reiheSchreibform(alt)) !== vorher)
        throw new ReiheGeaendert();
      return soll;
    },
    () => {
      if (vorher !== null) throw new ReiheGeaendert();
      return soll;
    },
    TEXTE,
  );
}
