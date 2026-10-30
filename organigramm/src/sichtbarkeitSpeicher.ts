/**
 * **„Was das Organigramm zeigt“ im Speicher der Erweiterung** (Bauplan O7b-7): EIN Wert in der Kategorie „Sichtbar“,
 * mit Version, Konflikt und Nachlesen wie der Plan. Das Format steht in `@shared/organigramm/sichtbarkeit`.
 *
 * Anders als der Plan muss diese Kategorie **jede** Person lesen dürfen, die das Organigramm öffnet – sonst sieht sie
 * alles. Ändern dürfen nur Gruppen-Admins. Beides schützt ChurchTools über die Rechte der Kategorie (setzt Alwin); die
 * Oberfläche zeigt „Einstellungen“ nur Gruppen-Admins.
 */
import { kategorieSicherstellen } from '@shared/ct/modulDaten';
import {
  dokumentSpeichern,
  type LeseErgebnis,
  type SpeicherErgebnis,
} from '@shared/ct/versionierterWert';
import { SICHT_ART, sichtbarkeitAus, type Sichtbarkeit } from '@shared/organigramm/sichtbarkeit';
import { dokumentAusKategorie, modulId, port } from './speicher';

const NUR_ADMIN =
  'Was das Organigramm für alle zeigt, dürfen nur Gruppen-Admins ändern – und wer in ChurchTools die Kategorie „Sichtbar“ bearbeiten darf.';
const KATEGORIE = {
  kuerzel: 'sichtbar',
  name: 'Was das Organigramm zeigt',
  beschreibung:
    'Angelegt von der Erweiterung „Organigramm“ – lesen: alle, die das Organigramm öffnen; ändern: Gruppen-Admins.',
};

export type SichtbarkeitStand = LeseErgebnis<Sichtbarkeit>;

/** Frisch lesen. Keine Kategorie (noch nie gespeichert oder kein Leserecht) = nichts für alle ausgeblendet. */
export function ladeSichtbarkeit(): Promise<SichtbarkeitStand> {
  return dokumentAusKategorie(KATEGORIE.kuerzel, SICHT_ART, sichtbarkeitAus);
}

/** Speichern – `erwartet` ist die gesehene Version (`null` = zum ersten Mal). */
export async function speichereSichtbarkeit(
  sichtbarkeit: Sichtbarkeit,
  von: { personId: number; name: string },
  erwartet: number | null,
): Promise<SpeicherErgebnis<Sichtbarkeit>> {
  const modul = await modulId();
  const kategorie = await kategorieSicherstellen(port, modul, KATEGORIE, NUR_ADMIN);
  return dokumentSpeichern(
    port,
    modul,
    kategorie,
    SICHT_ART,
    sichtbarkeit,
    von,
    erwartet,
    NUR_ADMIN,
  );
}
