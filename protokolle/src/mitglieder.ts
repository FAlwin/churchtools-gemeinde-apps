/**
 * **Wer kann eine Aufgabe übernehmen?** (Bauplan Protokolle S4-2, entschieden 16.10.2026): die aktiven Mitglieder der
 * Gruppe – Externe nur als freier Name. Gelesen wird über `/groups/{id}/members` (alle Seiten), ausgewertet mit
 * `mitgliederAus` (dieselbe Regel wie im Organigramm: nur aktive, nicht beendete).
 *
 * Bei versteckten Gruppen braucht die Rolle „versteckte Gruppe sehen“ (10119) – das setzt „Gruppe einrichten“ (S0/S2).
 * Fehlt es (403), gibt es keine Liste; die Oberfläche sagt das und lässt nur den externen Namen zu. Alles andere wird
 * geworfen – vorübergehend ist nicht „keine Mitglieder“.
 */
import { ctAlleSeiten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { mitgliederAus, type Person, type RohMitglied } from '@shared/organigramm/mitglieder';

export async function ladeGruppenMitglieder(
  gruppe: number,
  holen: (pfad: string) => Promise<RohMitglied[]> = (pfad) => ctAlleSeiten<RohMitglied>(pfad),
): Promise<Person[] | 'verborgen'> {
  try {
    const { mitglieder, personen } = mitgliederAus(await holen(`/groups/${gruppe}/members`));
    // `personen` enthält auch die Angefragten – zuständig sein können nur aktive Mitglieder.
    const aktiv = new Set(mitglieder.map((m) => m.personId));
    const je = new Map(personen.filter((p) => aktiv.has(p.id)).map((p) => [p.id, p]));
    return [...je.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) return 'verborgen';
    throw e;
  }
}
