/**
 * **Die Gruppenfelder einer Veranstaltung in ChurchTools** (A3, #486). Beim Anlegen entstehen die
 * Systemfelder (`SYSTEMFELDER`: Betrag, bezahlt …); ihre ChurchTools-Nummern stehen in `ctFelder` der
 * Einstellungen. Beim Kopieren („wie frühere Veranstaltung“) legt ChurchTools die Felder neu an – mit
 * **neuen** Nummern (gemessen A0 #5) –, die Beschreibung mit den alten Nummern kommt aber unverändert mit.
 * Deshalb wird nach dem Kopieren über den Namen neu zugeordnet.
 */
import { SYSTEMFELDER, ctAblage, type Feld } from './formular';
import type { Bereich } from './baukasten';

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

// ── Formularfelder als Gruppenfelder (A5) ───────────────────────────────────────────────────────

/**
 * Sicherheitsstufe der **Antworten** aus dem Formular (Alwin, 13.10.2026: „nur das Team“). Das Team hat in der
 * Veranstaltung Stufe 3 (so eingestellt) und sieht die Werte; wer weniger hat, sieht nur die Spaltennamen
 * (gemessen). Die Systemfelder (Betrag, bezahlt) bleiben auf Stufe 1.
 */
export const STUFE_ANTWORTEN = 3;

/** Eine Antwortmöglichkeit eines Gruppenfelds; ChurchTools vergibt die `id`. */
export interface CtOption {
  id?: string;
  name: string;
}

/** Was `POST/PATCH …/memberfields/group` für ein Formularfeld bekommt. */
export interface CtFeldDefinition {
  name: string;
  fieldTypeCode: string;
  securityLevel: number;
  useInRegistrationForm: boolean;
  requiredInRegistrationForm: boolean;
  options?: CtOption[];
}

/**
 * Der Name der Spalte in ChurchTools – die Frage, gekürzt und **eindeutig** in der Gruppe: Die Kopie („wie
 * frühere“) ordnet die Felder über den Namen neu zu (`felderNeuZuordnen`), zwei gleiche Namen wären dort nicht
 * auseinanderzuhalten. Belegte Namen (auch die Systemfelder) bekommen „(2)“, „(3)“ …
 */
export function ctFeldName(frage: string, belegt: Iterable<string>): string {
  const vergeben = new Set([...belegt].map((n) => n.trim().toLowerCase()));
  const basis = (frage.trim() || 'Frage').slice(0, 120);
  if (!vergeben.has(basis.toLowerCase())) return basis;
  for (let i = 2; ; i++) {
    const name = `${basis} (${i})`;
    if (!vergeben.has(name.toLowerCase())) return name;
  }
}

/**
 * **Die Antwortmöglichkeiten planen** (A5, gemessen): Umbenennen behält die ID (und damit die Wahl der
 * Personen); ohne ID legt ChurchTools eine neue an. Eine entfernte Antwort, die schon jemand gewählt hat, bleibt
 * mit ihrer ID stehen und wird nur **verborgen** (Alwin: „ausblenden“) – sonst wäre die Wahl still weg.
 * `neu`: die Antworten im Fenster, in Reihenfolge, je mit der ID, aus der sie hervorgegangen sind.
 */
export function optionenPlanen(
  alt: { id: string; name: string }[],
  neu: { text: string; altId?: string }[],
  gewaehlt: ReadonlySet<string>,
): { senden: CtOption[]; verborgen: string[] } {
  const senden: CtOption[] = neu.map((n) =>
    n.altId && alt.some((a) => a.id === n.altId)
      ? { id: n.altId, name: n.text.trim() }
      : { name: n.text.trim() },
  );
  const behalten = new Set(senden.map((o) => o.id).filter(Boolean));
  const verborgen: string[] = [];
  for (const a of alt) {
    if (behalten.has(a.id) || !gewaehlt.has(a.id)) continue;
    senden.push({ id: a.id, name: a.name });
    verborgen.push(a.name);
  }
  return { senden, verborgen };
}

/**
 * **Die Definition eines Formularfelds in ChurchTools** – `null`, wenn es kein Gruppenfeld ist (Name, E-Mail,
 * Geburtsdatum liegen an der Person; Hinweistext, Preis, Datenschutz haben keine Spalte). Ausgeschaltet heißt:
 * nicht im Anmeldeformular – die Spalte (und ihre Antworten) bleibt.
 *
 * **Felder der Anmeldung sind in ChurchTools nie Pflicht** (#597, gemessen 16.10.2026): ChurchTools prüft „Pflicht“
 * bei **jeder** angemeldeten Person, die Antworten der Anmeldung (Telefon, Erziehungsberechtigte, Unterschrift …)
 * stehen aber nur bei der ersten (`anmeldungAufbauen`). Mit zwei Kindern lehnte ChurchTools deshalb ab („Das Feld
 * darf nicht leer sein“). Ob alles ausgefüllt ist, prüft unser Formular (`pruefeAntworten`).
 */
export function feldDefinition(
  f: Feld,
  bereich: Bereich,
  name: string,
  optionen?: CtOption[],
): CtFeldDefinition | null {
  const ablage = ctAblage(f);
  if (ablage.ort !== 'gruppenfeld') return null;
  const mitOptionen = ablage.fieldTypeCode === 'radioselect' || ablage.fieldTypeCode === 'select';
  return {
    name,
    fieldTypeCode: ablage.fieldTypeCode,
    securityLevel: STUFE_ANTWORTEN,
    useInRegistrationForm: f.zustand !== 'aus',
    requiredInRegistrationForm: bereich === 'person' && f.zustand === 'pflicht',
    ...(mitOptionen ? { options: optionen ?? ablage.optionen.map((n) => ({ name: n })) } : {}),
  };
}
