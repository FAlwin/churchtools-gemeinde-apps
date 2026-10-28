/**
 * **Nachrücken und Absagen schreiben** (A7-3) – nach dem Plan aus `shared/anmeldung/bewegung.ts`. Gemessen 19.10.2026:
 * - Nachrücken: `PATCH {groupMemberStatus: 'active'}` – geht auch bei voller Gruppe (dann erhöhen wir die Plätze,
 *   Alwin: „dann ändert sich auch das Limit“). ChurchTools schickt „war erfolgreich“ – mit eingerichteten
 *   Abläufen (A9-1) stattdessen die Bestätigung mit Betrag. **Kein Rückgängig** (zurück auf die
 *   Warteliste löst die Mail „Du stehst auf der Warteliste“ aus).
 * - Absagen: `DELETE` – keine Mail. Rückgängig: `PUT` mit Rolle, Status, Warteplatz und allen Feldern – keine Mail von
 *   ChurchTools selbst; mit eingerichteten Abläufen kommt die Bestätigung noch einmal (A9-1, echt geprüft 24.10.2026).
 * Jede Person wird vor dem Schreiben frisch gelesen (nicht aus der Liste), jeder Schritt nachgelesen.
 */
import { ctAnfrage, ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { einmalFelder } from '@shared/anmeldung/liste';
import type { AbsagePlan, NachrueckPlan } from '@shared/anmeldung/bewegung';
import { euroText } from '@shared/anmeldung/preis';
import { NichtUebernommen, anmeldungVon, speichereAnmeldung } from './einrichten';
import { felderSchreiben } from './zahlung';

interface MitgliedRoh {
  personId?: number;
  groupTypeRoleId?: number;
  groupMemberStatus?: string;
  waitinglistPosition?: number | null;
  fields?: { id?: unknown; value?: unknown }[];
}

type Feldwerte = Record<number, string | boolean | null>;

const mitglied = (id: number, personId: number) =>
  ctDaten<MitgliedRoh>(`/groups/${id}/members/${personId}`);

/** Die Felder einer Person, wie ChurchTools sie hält (Auswahl als Options-ID) – zum Kopieren und Zurückschreiben. */
function rohWerte(m: MitgliedRoh): Map<number, string | null> {
  const out = new Map<number, string | null>();
  for (const f of m.fields ?? []) {
    const v = f.value;
    out.set(Number(f.id), typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null);
  }
  return out;
}

/** **Nachrücken lassen** – bei voller Gruppe vorher die Plätze erhöhen; die Zahlung aus dem Plan bei der Person. */
export async function nachrueckenLassen(
  id: number,
  e: OeffentlicheEinstellungen,
  plan: NachrueckPlan,
): Promise<void> {
  if (plan.neuesMax !== null) {
    const a = await anmeldungVon(id);
    if (a.maxPlaetze !== null && a.maxPlaetze < plan.neuesMax)
      await speichereAnmeldung(id, { ...a, maxPlaetze: plan.neuesMax });
  }
  const f = e.ctFelder;
  const felder: Feldwerte = {};
  if (plan.zahlung && f.betrag !== undefined && f.aufschluesselung !== undefined) {
    felder[f.betrag] = euroText(plan.zahlung.betragCent);
    felder[f.aufschluesselung] = plan.zahlung.aufschluesselung;
    // Eine eigene Zahlung beginnt offen – wie bei einer neuen Anmeldung.
    if (plan.zahlung.art === 'eigene') {
      if (f.bezahlt !== undefined) felder[f.bezahlt] = false;
      if (f.bezahltAm !== undefined) felder[f.bezahltAm] = null;
      if (f.zahlart !== undefined) felder[f.zahlart] = null;
    }
  }
  // Erst die Zahlung (solange sie noch wartet), dann der Platz. Scheitert der Platz, kommt die Zahlung wieder weg –
  // ein Fehler darf nichts halb geändert zurücklassen.
  const vorher = rohWerte(await mitglied(id, plan.personId));
  if (Object.keys(felder).length) await felderSchreiben(id, plan.personId, felder, 'die Zahlung');
  try {
    await ctAnfrage(`/groups/${id}/members/${plan.personId}`, {
      method: 'PATCH',
      body: JSON.stringify({ groupMemberStatus: 'active' }),
    });
    if ((await mitglied(id, plan.personId)).groupMemberStatus !== 'active')
      throw new NichtUebernommen('das Nachrücken');
  } catch (x) {
    await zuruecksetzen(id, new Map([[plan.personId, alteWerte(felder, vorher)]]));
    throw x;
  }
}

/** Was in den Feldern stand, bevor `felder` geschrieben wurden. */
function alteWerte(felder: Feldwerte, vorher: Map<number, string | null>): Feldwerte {
  return Object.fromEntries(Object.keys(felder).map((k) => [k, vorher.get(Number(k)) ?? null]));
}

/** Felder zurückschreiben, so gut es geht – nach einem Fehler; der ursprüngliche Fehler wird danach gemeldet. */
async function zuruecksetzen(id: number, alt: Map<number, Feldwerte>): Promise<void> {
  for (const [personId, felder] of alt)
    await felderSchreiben(id, personId, felder, 'das Zurückschreiben').catch((x: unknown) =>
      console.warn('Zurückschreiben nach Fehler gescheitert', personId, x),
    );
}

/**
 * **Absagen** – Übergabe bzw. neue Zahlung zuerst, dann entfernen. Gibt „Rückgängig“ zurück: Die Person kommt mit
 * Rolle, Status, Warteplatz und allen Antworten zurück, geänderte Felder anderer werden zurückgeschrieben.
 */
export async function absagenLassen(
  id: number,
  e: OeffentlicheEinstellungen,
  plan: AbsagePlan,
): Promise<() => Promise<void>> {
  const f = e.ctFelder;
  const weg = await mitglied(id, plan.personId);
  const wegWerte = rohWerte(weg);
  const vorher = new Map<number, Feldwerte>();

  const schreiben = async (personId: number, felder: Feldwerte) => {
    vorher.set(personId, alteWerte(felder, rohWerte(await mitglied(id, personId))));
    await felderSchreiben(id, personId, felder, 'die Übergabe der Anmeldung');
  };

  if (plan.uebergabeAn !== null) {
    // Kontakt, Unterschrift, Fragen der Anmeldung, Zahlung – wie sie bei der Absagenden stehen.
    const ids = [
      ...einmalFelder(e),
      ...[f.bezahlt, f.bezahltAm, f.zahlart].filter((x): x is number => x !== undefined),
    ];
    const felder: Feldwerte = Object.fromEntries(ids.map((k) => [k, wegWerte.get(k) ?? null]));
    if (f.bezahlt !== undefined) felder[f.bezahlt] = wegWerte.get(f.bezahlt) === '1';
    if (plan.haupt && f.betrag !== undefined && f.aufschluesselung !== undefined) {
      felder[f.betrag] = euroText(plan.haupt.betragCent);
      felder[f.aufschluesselung] = plan.haupt.aufschluesselung;
    }
    await schreiben(plan.uebergabeAn, felder);
  } else if (plan.haupt && f.betrag !== undefined && f.aufschluesselung !== undefined) {
    await schreiben(plan.haupt.personId, {
      [f.betrag]: euroText(plan.haupt.betragCent),
      [f.aufschluesselung]: plan.haupt.aufschluesselung,
    });
  }

  try {
    await ctAnfrage(`/groups/${id}/members/${plan.personId}`, { method: 'DELETE' });
    await mitglied(id, plan.personId);
    throw new NichtUebernommen('die Absage');
  } catch (x) {
    // 404 heißt: entfernt (gemessen). Sonst ist sie noch da – dann die Übergabe bzw. neue Zahlung zurücknehmen.
    if (!(x instanceof ApiError && x.status === 404) || x instanceof NichtUebernommen) {
      await zuruecksetzen(id, vorher);
      throw x;
    }
  }

  return async () => {
    const felder: Feldwerte = {};
    for (const [k, v] of wegWerte) if (v !== null && v !== '' && v !== '0') felder[k] = v;
    await ctAnfrage(`/groups/${id}/members/${plan.personId}`, {
      method: 'PUT',
      body: JSON.stringify({
        groupTypeRoleId: weg.groupTypeRoleId,
        groupMemberStatus: weg.groupMemberStatus,
        ...(weg.groupMemberStatus === 'waiting' && weg.waitinglistPosition
          ? { waitinglistPosition: weg.waitinglistPosition }
          : {}),
        fields: felder,
        // Neu anlegen, nie überschreiben – ist sie inzwischen wieder dabei, lehnt ChurchTools ab (403).
        only_add: true,
      }),
    });
    const zurueck = await mitglied(id, plan.personId);
    if (zurueck.groupMemberStatus !== weg.groupMemberStatus)
      throw new NichtUebernommen('das Zurückholen');
    for (const [personId, alt] of vorher)
      await felderSchreiben(id, personId, alt, 'das Zurückschreiben');
  };
}
