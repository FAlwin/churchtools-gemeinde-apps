/**
 * **Was die Website beim Öffnen braucht** (Bauplan Website W3a-1): wer angemeldet ist, welche Website eingerichtet ist
 * (Kategorien) und was die Person darf. Die Regeln stehen in `@shared/website/` (`einrichten`, `zugang`); hier wird nur
 * gelesen.
 *
 * Ein Fehler beim Lesen wird **geworfen**, nicht zu „nicht eingerichtet“ gemacht – vorübergehend ist nicht leer (die Seite
 * zeigt dann „Erneut versuchen“).
 */
import { ladeIch } from '@ui/ct/ich';
import { modulId, modulPort } from '@ui/ct/modulPort';
import { ctDaten } from '@ui/ct/verbindung';
import { kategorienLesen } from '@shared/ct/modulDaten';
import {
  einrichtungAus,
  einrichtungsStand,
  type Einrichtung,
  type EinrichtungsStand,
} from '@shared/website/einrichten';
import { istAdmin, leitetGruppe, zugangFuer, type Zugang } from '@shared/website/zugang';

export interface Start {
  ichId: number;
  vorname: string;
  /** Vor- und Nachname – so steht man in „Gerade bearbeitet von …“. */
  name: string;
  gemeinde: string | null;
  modul: number;
  /** Die sichtbare Website – `null`, wenn keine Kategorie zu sehen ist. */
  einrichtung: Einrichtung | null;
  stand: EinrichtungsStand;
  /** Gruppen verwalten dürfen (ChurchTools „Admin“) → sieht „Einrichten“. */
  admin: boolean;
  /** Warum man hineindarf – `null`: nicht (Hinweis statt Editor). */
  zugang: Zugang | null;
}

export async function ladeStart(): Promise<Start> {
  const [ich, modul, rechte] = await Promise.all([
    ladeIch(),
    modulId('Die Erweiterung „Website“'),
    ctDaten<unknown>('/permissions/global'),
  ]);
  const einrichtung = einrichtungAus(await kategorienLesen(modulPort, modul));
  const admin = istAdmin(rechte);
  const leitung = einrichtung
    ? leitetGruppe(ich.mitgliedschaften, ich.rollen, einrichtung.gruppe)
    : false;
  return {
    ichId: ich.id,
    vorname: ich.vorname,
    name: [ich.vorname, ich.nachname].filter((t) => t && t.trim() !== '').join(' '),
    gemeinde: ich.gemeinde,
    modul,
    einrichtung,
    stand: einrichtungsStand(einrichtung, admin),
    admin,
    zugang: zugangFuer(admin, leitung),
  };
}
