/**
 * **Die Vorlagen-Liste aus den ChurchTools-Antworten** (E10-V3a): `GET /agendatemplates` (mit Punkten, gemessen E10-0)
 * und `GET /calendars`, gruppiert nach Kalender – für die Seite „Ablaufvorlagen“ in Dienstplaner und Musik-App.
 *
 * Gebaut **auf** `vorlagenAus` (Id, Name, Kalender, Punktzahl, nach Namen sortiert – dieselbe Regel wie in „Ablauf
 * anlegen“) und `kalenderAus`: Hier kommen nur dazu, was die Liste zusätzlich zeigt – Vorlauf-Anzahl (`vorlaufAnzahl`,
 * dieselbe Zählung, die auch beim Speichern einer Vorlage gilt) und der Tag der letzten Änderung. Ein zweiter Weg von
 * „roh“ zu „Vorlage“ würde bei der nächsten Regel (etwa „Einträge ohne ID fallen weg“) abweichen.
 */
import type { AblaufVorlage, Kalender } from '../types/index';
import { kalenderAus, vorlagenAus } from './ablaufAnlegen';
import { vorlaufAnzahl } from './ablaufVorlagen';
import { ctId } from './ctId';
import type { CtAblaufVorlage, CtKalender } from './typen';
import { ablaufZeileAus, type AblaufZeile } from './ablaufZeile';
import { tagAusIso } from './zeit';

/** Eine Zeile der Liste. */
export interface VorlagenEintrag extends AblaufVorlage {
  /** Wie viele Punkte vor dem Beginn laufen (`vorlaufAnzahl`); 0 = keine. */
  vorlauf: number;
  /** Der Tag der letzten Änderung (`JJJJ-MM-TT`, Ortszeit der Gemeinde) – `null`, wenn ChurchTools ihn nicht nennt. */
  geaendert: string | null;
}

/** Die Vorlagen eines Kalenders – ein Band in der Liste. */
export interface VorlagenGruppe {
  /** `null` = Vorlagen ohne Kalender. */
  kalenderId: number | null;
  kalender: string;
  vorlagen: VorlagenEintrag[];
}

/** Wie das Band heißt, wenn eine Vorlage keinen (bekannten) Kalender hat. */
export const OHNE_KALENDER = 'Ohne Kalender';

export function vorlagenListeAus(
  roh: CtAblaufVorlage[] | null | undefined,
  kalenderRoh: CtKalender[] | null | undefined,
  zeitzone: string,
): VorlagenGruppe[] {
  const rohe = new Map<number, CtAblaufVorlage>();
  for (const v of roh ?? []) {
    const id = ctId(v.id);
    if (id !== null) rohe.set(id, v);
  }
  const namen = new Map(kalenderAus(kalenderRoh).map((k) => [k.id, k.name]));
  const gruppen = new Map<number | null, VorlagenGruppe>();
  for (const basis of vorlagenAus(roh)) {
    const quelle = rohe.get(basis.id);
    const stand = quelle?.meta?.modifiedDate;
    const eintrag: VorlagenEintrag = {
      ...basis,
      vorlauf: quelle ? vorlaufAnzahl(quelle) : 0,
      geaendert: stand ? tagAusIso(stand, zeitzone) : null,
    };
    // Ein Kalender, den `/calendars` nicht nennt (kein Recht, gelöscht): als Nummer, nicht unter „ohne“ – sonst verschwände
    // die Zuordnung, nach der das Bearbeiten-Recht entscheidet.
    const kalender = basis.kalenderId;
    const gruppe = gruppen.get(kalender) ?? {
      kalenderId: kalender,
      kalender: kalender === null ? OHNE_KALENDER : (namen.get(kalender) ?? `Kalender ${kalender}`),
      vorlagen: [],
    };
    gruppe.vorlagen.push(eintrag);
    gruppen.set(kalender, gruppe);
  }
  return [...gruppen.values()].sort((a, b) => {
    // „Ohne Kalender“ zuletzt, sonst nach Namen.
    if ((a.kalenderId === null) !== (b.kalenderId === null)) return a.kalenderId === null ? 1 : -1;
    return a.kalender.localeCompare(b.kalender, 'de');
  });
}

/**
 * Was die Seite „Ablaufvorlagen“ braucht: die Liste, gruppiert, und die Kalender (für „Neue Vorlage“ – auch ein Kalender
 * ohne Vorlage muss zur Wahl stehen, sonst ließe sich dort nie die erste anlegen).
 */
export interface VorlagenStand {
  gruppen: VorlagenGruppe[];
  kalender: Kalender[];
}

export function vorlagenStandAus(
  roh: CtAblaufVorlage[] | null | undefined,
  kalenderRoh: CtKalender[] | null | undefined,
  zeitzone: string,
): VorlagenStand {
  return {
    gruppen: vorlagenListeAus(roh, kalenderRoh, zeitzone),
    kalender: kalenderAus(kalenderRoh),
  };
}

/**
 * **Die Zeilen einer geöffneten Vorlage** – `ablaufZeileAus` mit Termin 0: Eine Vorlage hat keinen Termin, also nichts
 * „Weggelassenes“. Die Uhrzeit wird ausdrücklich geleert (auch wenn ChurchTools an einem Punkt ein `start` mitgäbe): Die
 * Vorlage hat keine Zeiten, nur Dauern – die Liste zeigt sie in der Zeitspalte unter dem leeren Platz der Uhrzeit.
 */
export function vorlageZeilenAus(v: Pick<CtAblaufVorlage, 'items'>): AblaufZeile[] {
  return (v.items ?? []).map((i) => ({
    ...ablaufZeileAus(i, 0, 'UTC'),
    time: null,
    weggelassen: false,
  }));
}
