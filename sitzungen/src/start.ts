/**
 * **Was die Startseite der Sitzungen braucht** (Bauplan S1): wer angemeldet ist, die Gemeinde und die Gruppen
 * mit „eingerichtet / nicht eingerichtet“. Die Regeln stehen in `@shared/sitzungen/gruppen`; hier wird nur
 * gelesen.
 *
 * Ein Fehler beim Lesen wird **geworfen**, nicht zu „keine Gruppen“ gemacht – vorübergehend ist nicht leer
 * (die Seite zeigt dann „Erneut versuchen“).
 */
import { ladeIch } from '@ui/ct/ich';
import { modulId, modulPort } from '@ui/ct/modulPort';
import { kategorienLesen } from '@shared/ct/modulDaten';
import { sitzungsGruppen, type SitzungsGruppe } from '@shared/sitzungen/gruppen';

export interface Start {
  id: number;
  vorname: string;
  gemeinde: string | null;
  modul: number;
  gruppen: SitzungsGruppe[];
}

export async function ladeStart(): Promise<Start> {
  const [ich, modul] = await Promise.all([ladeIch(), modulId('Die Erweiterung „Sitzungen“')]);
  const kategorien = await kategorienLesen(modulPort, modul);
  return {
    id: ich.id,
    vorname: ich.vorname,
    gemeinde: ich.gemeinde,
    modul,
    gruppen: sitzungsGruppen(ich.mitgliedschaften, kategorien),
  };
}
