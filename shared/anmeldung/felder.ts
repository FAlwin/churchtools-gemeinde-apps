/**
 * **Die Gruppenfelder einer Veranstaltung in ChurchTools** (A3, #486). Beim Anlegen entstehen die
 * Systemfelder (`SYSTEMFELDER`: Betrag, bezahlt …); ihre ChurchTools-Nummern stehen in `ctFelder` der
 * Einstellungen. Beim Kopieren („wie frühere Veranstaltung“) legt ChurchTools die Felder neu an – mit
 * **neuen** Nummern (gemessen A0 #5) –, die Beschreibung mit den alten Nummern kommt aber unverändert mit.
 * Deshalb wird nach dem Kopieren über den Namen neu zugeordnet.
 */
import { SYSTEMFELDER } from './formular';

/** Der Rumpf für `POST /groups/{id}/memberfields/group` (Pflichtangaben gemessen 12.10.2026). */
export function systemfeldAnlage(f: (typeof SYSTEMFELDER)[number]) {
  return {
    name: f.name,
    fieldTypeCode: f.fieldTypeCode,
    securityLevel: 1,
    // Nur Felder mit `useInRegistrationForm` lassen sich bei der Anmeldung befüllen (A0 #1).
    useInRegistrationForm: f.beimAnmelden,
    requiredInRegistrationForm: false,
  };
}

/**
 * `ctFelder` auf die Felder der Kopie umschreiben. Zuordnung über den **Namen** (in einer Gruppe eindeutig);
 * fehlt ein Name in der Kopie, wirft es – lieber kein Kopieren als Antworten im falschen Feld.
 */
export function felderNeuZuordnen(
  ctFelder: Record<string, number>,
  altFelder: { id: number; name: string }[],
  neuFelder: { id: number; name: string }[],
): Record<string, number> {
  const nameVon = new Map(altFelder.map((f) => [f.id, f.name]));
  const idVon = new Map(neuFelder.map((f) => [f.name, f.id]));
  const out: Record<string, number> = {};
  for (const [schluessel, altId] of Object.entries(ctFelder)) {
    const name = nameVon.get(altId);
    const neu = name === undefined ? undefined : idVon.get(name);
    if (neu === undefined) {
      throw new Error(`Das Feld „${name ?? schluessel}“ fehlt in der Kopie.`);
    }
    out[schluessel] = neu;
  }
  return out;
}
