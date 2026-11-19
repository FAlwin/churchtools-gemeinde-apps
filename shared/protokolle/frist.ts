/**
 * **Die Frist in Worten** (W8b, Alwin 19.11.2026, Entwurf `todos-vorschlaege-v2.html`) – die eine Stelle für das
 * Frist-Kästchen auf Karte, Tabelle und Startseite: überfällig „seit 20.10.“ (rot), „heute“ und „morgen“ (orange), innerhalb
 * der nächsten 7 Tage der Wochentag („Samstag“), weiter weg das Datum „29.11.“. Erledigt: nur das Datum, neutral.
 *
 * Gerechnet wird mit `heute` als `JJJJ-MM-TT` in der Ortszeit des Aufrufers (`heuteImKalender`) – wie `istUeberfaellig`,
 * die hier benutzt wird (keine zweite Regel für „überfällig“).
 */
import { datumText, tageBis, tagMonat, wochentagName } from '../ct/datum';
import { istUeberfaellig, type Aufgabe } from './aufgaben';

/** Wie das Kästchen aussieht: rot umrandet, orange, neutral. */
export type FristArt = 'ueberfaellig' | 'bald' | 'normal';

export interface FristAnzeige {
  /** Das Wort im Kästchen. */
  text: string;
  art: FristArt;
  /** Das volle Datum für den Tooltip („Sa, 21.11.2026“), bei Überfälligen mit „überfällig seit“. */
  titel: string;
}

/** Ab wie vielen Tagen Abstand wieder das Datum statt des Wochentags dasteht. */
export const WOCHENTAG_BIS_TAGE = 7;

/** `null`, wenn das To-Do keine Frist hat. */
export function fristAnzeige(
  a: Pick<Aufgabe, 'bis' | 'status'>,
  heute: string,
): FristAnzeige | null {
  if (a.bis === null) return null;
  const voll = datumText(a.bis);
  if (a.status === 'erledigt') return { text: tagMonat(a.bis), art: 'normal', titel: voll };
  if (istUeberfaellig(a, heute))
    return {
      text: `seit ${tagMonat(a.bis)}`,
      art: 'ueberfaellig',
      titel: `überfällig seit ${voll}`,
    };
  const tage = tageBis(heute, a.bis);
  if (tage === 0) return { text: 'heute', art: 'bald', titel: voll };
  if (tage === 1) return { text: 'morgen', art: 'bald', titel: voll };
  if (tage < WOCHENTAG_BIS_TAGE) return { text: wochentagName(a.bis), art: 'normal', titel: voll };
  return { text: tagMonat(a.bis), art: 'normal', titel: voll };
}

/** Wo ein To-Do bei „Nach Fälligkeit“ steht. Erledigte zuerst geprüft – sie sind nie „überfällig“. */
export type Faelligkeit = 'ueberfaellig' | 'woche' | 'spaeter' | 'ohne' | 'erledigt';

/**
 * **Das Fach bei „Nach Fälligkeit“**: Überfällig · Diese Woche (heute bis in 6 Tagen – dieselbe Grenze wie beim Wochentag
 * im Kästchen) · Später · Ohne Frist · Erledigt.
 */
export function faelligkeit(a: Pick<Aufgabe, 'bis' | 'status'>, heute: string): Faelligkeit {
  if (a.status === 'erledigt') return 'erledigt';
  if (a.bis === null) return 'ohne';
  if (istUeberfaellig(a, heute)) return 'ueberfaellig';
  return tageBis(heute, a.bis) < WOCHENTAG_BIS_TAGE ? 'woche' : 'spaeter';
}
