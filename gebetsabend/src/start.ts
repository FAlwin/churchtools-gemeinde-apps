/**
 * **Was die Seite des Gebetsabends beim Öffnen braucht** (Bauplan Gebetsabend G1): wer angemeldet ist, die Gemeinde,
 * welche Kategorien man sieht und was man darf. Die Regeln stehen in `@shared/gebetsabend/einrichten`; hier wird nur
 * gelesen.
 *
 * Ein Fehler beim Lesen wird **geworfen**, nicht zu „nicht eingerichtet“ gemacht – vorübergehend ist nicht leer
 * (die Seite zeigt dann „Erneut versuchen“).
 */
import { ladeIch } from '@ui/ct/ich';
import { modulId, modulPort } from '@ui/ct/modulPort';
import { ctDaten } from '@ui/ct/verbindung';
import { kategorienLesen } from '@shared/ct/modulDaten';
import { modulRechteAus } from '@shared/ct/modulRechte';
import { einrichtungAus, type Einrichtung } from '@shared/gebetsabend/einrichten';

export interface Start {
  vorname: string;
  gemeinde: string | null;
  modul: number;
  einrichtung: Einrichtung;
  /** Darf Kategorien anlegen (ChurchTools „Kategorien erstellen“) → sieht „Einrichten“. */
  darfAnlegen: boolean;
  /** Darf die Zugangsdaten schreiben (anlegen, ändern UND löschen in „Zugang“) → gehört zur Technik. */
  technik: boolean;
}

export async function ladeStart(): Promise<Start> {
  const [ich, modul, rechte] = await Promise.all([
    ladeIch(),
    modulId('Die Erweiterung „Gebetsabend“'),
    ctDaten('/permissions/global'),
  ]);
  const einrichtung = einrichtungAus(await kategorienLesen(modulPort, modul));
  const eigene = modulRechteAus(
    (rechte as Record<string, unknown> | null)?.[modulPort.kuerzel() ?? 'gebetsabend'],
  );
  return {
    vorname: ich.vorname,
    gemeinde: ich.gemeinde,
    modul,
    einrichtung,
    darfAnlegen: eigene.anlegen,
    technik: einrichtung.zugang !== null && eigene.aendern.includes(einrichtung.zugang),
  };
}
