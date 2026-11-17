/**
 * **Was die Seite „Ablaufvorlagen“ von ihrer App braucht** (E10-V3a) – die Bausteine (`VorlagenBereich`, `VorlageAnsicht`,
 * die Fenster) kennen weder ChurchTools noch den Weg dorthin. Der Dienstplaner gibt Funktionen über `browserSchreiber`
 * herein (`ui/ablauf/browserAblaufZugriff.ts`, auch die Musik-App-Erweiterung nimmt ihn), die Musik-App über ihre Weiche
 * (`client/src/hooks/useVorlagenZugriff.ts`: Erweiterung direkt, Server-Betrieb über `/api/ablauf-vorlagen`) – die Regeln
 * stehen in beiden Fällen im Kern (`@shared/ct/ablaufVorlagen`, `schreibKern`), nicht hier.
 *
 * Alle Funktionen werfen bei Fehler (mit der Meldung des Kerns: 403 `VORLAGE_VERWEIGERT`, 423 `VORLAGE_GESPERRT`,
 * 412 „woanders geändert“); die Bausteine zeigen sie an.
 */
import type { VorlagenStand } from '@shared/ct/ablaufVorlagenListe';
import type { CtAblaufVorlage } from '@shared/ct/typen';
import type { VorlagenAktionen } from './useAblaufBearbeiten';

export interface VorlagenZugriff {
  /** Die Liste samt Kalendern – frisch aus ChurchTools. */
  liste: () => Promise<VorlagenStand>;
  /** Eine Vorlage **frisch** lesen (nie aus einem Zwischenspeicher: danach wird nachgesehen, was geschrieben wurde). */
  vorlage: (vorlageId: number) => Promise<CtAblaufVorlage>;
  /** Die Aktionen für die Punkte einer Vorlage; `geschrieben` wird nach jedem gelungenen Schreiben gerufen. */
  aktionen: (vorlageId: number, geschrieben: () => void) => VorlagenAktionen;
  /** Legt eine leere Vorlage an und liefert ihre ID. */
  anlegen: (daten: { name: string; kalenderId: number }) => Promise<number>;
  umbenennen: (vorlageId: number, name: string) => Promise<void>;
  /** Löscht die Vorlage (kein Papierkorb – die Nachfrage gehört den Bausteinen). „Schon weg“ ist kein Fehler. */
  loeschen: (vorlageId: number) => Promise<void>;
}
