/**
 * **Was eine Terminvorlage an einem Termin ändern würde** (Dienstplaner, Plätze-Fach, „Vorlage übernehmen“).
 *
 * Die Regel, entschieden mit Alwin am 13.11.2026: **nur dazunehmen.** Für jeden Dienst der Vorlage, den man an diesem
 * Termin planen darf, wird die Anzahl auf die Zahl der Vorlage **erhöht** – nie verringert, nie entfernt. Dienste mit
 * Entwürfen am Termin bleiben, wie sie sind (ChurchTools nummeriert die Plätze beim Ändern neu, ein Entwurf fände
 * seinen Platz nicht mehr – dieselbe Begründung wie bei der Sperre im Plätze-Fach).
 *
 * Reine Rechnung ohne ChurchTools-Aufrufe: Wer planen darf und wie viele Plätze schon da sind, bestimmt der Aufrufer
 * (`plaetzeZeilen` in `dienstplaner/src/planEntwuerfe.ts` – dieselbe Regel wie das Fach selbst).
 */
import type { TerminVorlage } from '../ct/terminVorlagen';

/** Ein Dienst, der geändert würde. */
export interface VorlagenSchritt {
  serviceId: number;
  name: string;
  /** So viele Plätze hat der Dienst jetzt … */
  von: number;
  /** … und so viele hätte er danach. */
  nach: number;
}

export type VorlagenGrund = 'entwurf' | 'nicht-planbar' | 'unbekannt';

/** Ein Dienst der Vorlage, der übersprungen wird – mit Grund. */
export interface VorlagenUebersprungen {
  serviceId: number;
  name: string;
  grund: VorlagenGrund;
}

export interface VorlagenRechnung {
  /** Was geändert würde, in der Reihenfolge der Vorlage. */
  aendern: VorlagenSchritt[];
  uebersprungen: VorlagenUebersprungen[];
  /** Wie viele Dienste der Vorlage schon genug Plätze haben. */
  schonErfuellt: number;
}

/** Was der Termin je Dienst, den man dort planen darf, jetzt hat. */
export interface VorlagenStand {
  name: string;
  anzahl: number;
  entwuerfe: number;
}

export function vorlageRechnen(
  vorlage: Pick<TerminVorlage, 'dienste'>,
  o: {
    /** Dienste, die man an diesem Termin planen darf (ganz sichtbar und planbar) – mit dem aktuellen Stand. */
    stand: ReadonlyMap<number, VorlagenStand>;
    /** Alle Dienste der Gemeinde (`/services`) mit Namen – was hier fehlt, gibt es nicht (mehr). */
    namen: ReadonlyMap<number, string>;
  },
): VorlagenRechnung {
  const r: VorlagenRechnung = { aendern: [], uebersprungen: [], schonErfuellt: 0 };
  for (const d of vorlage.dienste) {
    const stand = o.stand.get(d.serviceId);
    const name = stand?.name ?? o.namen.get(d.serviceId);
    if (name === undefined) {
      r.uebersprungen.push({
        serviceId: d.serviceId,
        name: `Dienst ${d.serviceId}`,
        grund: 'unbekannt',
      });
    } else if (!stand) {
      r.uebersprungen.push({ serviceId: d.serviceId, name, grund: 'nicht-planbar' });
    } else if (stand.entwuerfe > 0) {
      // Auch, wenn schon genug Plätze da sind? Dann gäbe es nichts zu überspringen – Entwürfe sperren nur eine Änderung.
      if (stand.anzahl < d.count)
        r.uebersprungen.push({ serviceId: d.serviceId, name, grund: 'entwurf' });
      else r.schonErfuellt++;
    } else if (stand.anzahl < d.count) {
      r.aendern.push({ serviceId: d.serviceId, name, von: stand.anzahl, nach: d.count });
    } else {
      r.schonErfuellt++;
    }
  }
  return r;
}

/** Der Grund in Worten, für die Vorschau. */
export function vorlagenGrundText(g: VorlagenGrund): string {
  switch (g) {
    case 'entwurf':
      return 'hier liegt ein Entwurf';
    case 'nicht-planbar':
      return 'darfst du nicht planen';
    case 'unbekannt':
      return 'gibt es in ChurchTools nicht (mehr)';
  }
}
