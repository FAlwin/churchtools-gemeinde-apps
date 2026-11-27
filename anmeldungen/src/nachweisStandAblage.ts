/**
 * **Der Nachweis-Stand für die Leitungen** (N3a) – die Erweiterungs-Seite der Ablage (Regeln, Format und Rechte in
 * `@shared/anmeldung/nachweisStandAblage`): mit den echten Anschlüssen (`modulPort` für den Datenspeicher, `ctPortMit` für
 * die Rechte) und dem Stand aus der einen Regel `personStand` → `standFuerLeitung`. Gelesen wird für die Ampel (N3d) mit
 * `nachweisStandLesen` aus dem gemeinsamen Baustein.
 */
import { ctPortMit } from '@ui/ct/ctPort';
import { modulId, modulPort } from '@ui/ct/modulPort';
import { kategorieSuchen } from '@shared/ct/modulDaten';
import { NACHWEIS_STAND_KATEGORIE } from '@shared/anmeldung/nachweise';
import { personStand, standFuerLeitung } from '@shared/anmeldung/nachweisStand';
import {
  nachweisStandSchreiben,
  standAblageSichern,
  type StandEintraege,
} from '@shared/anmeldung/nachweisStandAblage';
import { uebersetzt } from './nachweise';
import type { NachweisArtMitPersonen } from './nachweisPersonen';

const WER = 'Die Erweiterung „Anmeldungen“';
const VERWEIGERT = 'Dir fehlt in ChurchTools das Recht, den Nachweis-Stand zu speichern.';

/** Kategorie anlegen und Rechte ergänzen (Admin). Wirft bei jedem Fehler – in den Fehlerarten des Projekts (`uebersetzt`). */
export async function nachweisStandEinrichten(leiterRolle: number): Promise<void> {
  try {
    await standAblageSichern(
      ctPortMit('Dir fehlt in ChurchTools das Recht dafür (Berechtigungen verwalten).'),
      modulPort,
      leiterRolle,
      VERWEIGERT,
    );
  } catch (e) {
    throw uebersetzt(e);
  }
}

/** Der Stand je Person einer Art für `heute` – `null`, wenn die Personen nicht gelesen wurden oder die Art nicht fertig ist. */
export function standDerArt(a: NachweisArtMitPersonen, heute: string): StandEintraege | null {
  if (a.personen === null || a.einstellungen === null) return null;
  return new Map(
    a.personen.map((p) => [
      p.personId,
      standFuerLeitung(personStand(p, a.einstellungen, heute).stand),
    ]),
  );
}

/**
 * **Den Stand der Arten schreiben, die man sieht** (Vertrauensperson oder Admin; beim Öffnen der Seite „Nachweise“ – und
 * damit auch nach „Einsicht festhalten“, denn danach lädt die Seite neu). Arten, deren Personen nicht gelesen wurden,
 * bleiben unberührt. Ohne sichtbare Kategorie (noch nicht eingerichtet, kein Recht) geschieht nichts: Anlegen darf nur ein
 * Admin. Fehler wirft sie – der Aufrufer entscheidet, dass die Seite daran nicht scheitert.
 */
export async function nachweisStandAktualisieren(
  arten: readonly NachweisArtMitPersonen[],
  heute: string,
): Promise<number[]> {
  const liste = arten.flatMap((a) => {
    const eintraege = standDerArt(a, heute);
    return eintraege ? [{ gruppe: a.id, eintraege }] : [];
  });
  if (liste.length === 0) return [];
  const modul = await modulId(WER);
  const kategorie = await kategorieSuchen(modulPort, modul, NACHWEIS_STAND_KATEGORIE.kuerzel);
  if (kategorie === null) return [];
  return await nachweisStandSchreiben(modulPort, modul, kategorie, liste, VERWEIGERT);
}
