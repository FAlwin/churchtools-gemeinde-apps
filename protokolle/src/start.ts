/**
 * **Was die Startseite der Protokolle braucht** (Bauplan S1): wer angemeldet ist, die Gemeinde und die Gruppen
 * (nur die, deren Protokolle man sehen darf). Die Regeln stehen in `@shared/protokolle/gruppen`; hier wird nur
 * gelesen.
 *
 * Ein Fehler beim Lesen wird **geworfen**, nicht zu „keine Gruppen“ gemacht – vorübergehend ist nicht leer
 * (die Seite zeigt dann „Erneut versuchen“).
 */
import { ladeIch } from '@ui/ct/ich';
import { modulId, modulPort } from '@ui/ct/modulPort';
import { kategorienLesen } from '@shared/ct/modulDaten';
import { modulRechteAus } from '@shared/ct/modulRechte';
import { protokollGruppen, type ProtokollGruppe } from '@shared/protokolle/gruppen';
import { darfVerwalten } from '@shared/protokolle/einrichten';
import { ctDaten } from '@ui/ct/verbindung';

export interface Start {
  id: number;
  vorname: string;
  gemeinde: string | null;
  modul: number;
  gruppen: ProtokollGruppe[];
  /** Darf Rechte vergeben → sieht den Reiter „Verwaltung“ (S2-2). */
  darfVerwalten: boolean;
  /**
   * Kategorien, in denen man anlegen, ändern und löschen darf – bei „Protokolle“ heißt das: Protokolle schreiben
   * (die Leitung, S4-1). Die Schnittstelle prüft es ohnehin; hier entscheidet es nur, ob der Editor aufgeht.
   */
  schreibbar: number[];
}

export async function ladeStart(): Promise<Start> {
  const [ich, modul, rechte] = await Promise.all([
    ladeIch(),
    modulId('Die Erweiterung „Protokolle“'),
    ctDaten('/permissions/global'),
  ]);
  const kategorien = await kategorienLesen(modulPort, modul);
  return {
    id: ich.id,
    vorname: ich.vorname,
    gemeinde: ich.gemeinde,
    modul,
    gruppen: protokollGruppen(ich.mitgliedschaften, kategorien),
    darfVerwalten: darfVerwalten(rechte),
    schreibbar: modulRechteAus(
      (rechte as Record<string, unknown> | null)?.[modulPort.kuerzel() ?? 'protokolle'],
    ).aendern,
  };
}
