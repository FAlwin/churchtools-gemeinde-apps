import type {
  ArrangementAnsicht,
  ArrangementAuftrag,
  LiedStammdaten,
  LiedStammdatenAnsicht,
} from '@shared/types/index';
import {
  liedinfoAusDatei,
  liedinfoVergleich,
  type Liedinfo,
  type LiedinfoFeld,
  type LiedinfoVergleich,
} from '@shared/ct/liedinfo';
import { aenderungAus, formularAusLied, type NeuesLiedFormular } from './liedFormular';
import {
  auftragAus,
  formularAusArrangement,
  hatAenderung as arrangementGeaendert,
  type ArrangementFormular,
} from './arrangementFormular';

/**
 * **Die Liedinfo im Editor** (Lied-Editor L4): Lied-Stammdaten und Arrangement aus ChurchTools, wie sie der Editor
 * bekommt. Der Editor selbst lädt nichts – die aufrufende Seite reicht das hinein (testbar, Demo ohne Server).
 */
export interface LiedinfoQuelle {
  lied: LiedStammdatenAnsicht;
  arrangement: ArrangementAnsicht;
  /** Darf diese Person die Stammdaten ändern? Sonst nur lesen – und die Kopfzeilen bleiben in der Datei. */
  darf: boolean;
}

/**
 * Das Formular besteht aus den **vorhandenen** Formularen des Stammdaten-Blatts – so rechnen beim Speichern dieselben
 * geprüften Funktionen (`aenderungAus`, `auftragAus`), was an ChurchTools geht, statt einer zweiten Fassung davon.
 */
export interface LiedinfoFormular {
  lied: NeuesLiedFormular;
  arrangement: ArrangementFormular;
}

/** Was ChurchTools an Liedinfo hat – EINE Abbildung für den Start UND den Stand nach dem Speichern. */
export function liedinfoAusStand(lied: LiedStammdatenAnsicht, arr: ArrangementAnsicht): Liedinfo {
  return {
    name: lied.name,
    author: lied.author,
    ccli: lied.ccli,
    copyright: lied.copyright,
    tempo: arr.tempo === null ? null : String(arr.tempo),
    beat: arr.beat,
  };
}

/** Was nach dem Speichern in ChurchTools stünde – für die Vorschau und das Ausblenden. */
export function liedinfoAusFormular(f: LiedinfoFormular): Liedinfo {
  return {
    name: f.lied.name,
    author: f.lied.author,
    ccli: f.lied.ccli,
    copyright: f.lied.copyright,
    tempo: f.arrangement.tempo,
    beat: f.arrangement.beat,
  };
}

/** Einen Wert aus der Datei ins passende Formularfeld legen. */
function setzeFeld(f: LiedinfoFormular, feld: LiedinfoFeld, wert: string): LiedinfoFormular {
  if (feld === 'tempo') {
    const zahl = Math.round(Number(wert.replace(',', '.')));
    return Number.isFinite(zahl) && zahl > 0
      ? { ...f, arrangement: { ...f.arrangement, tempo: String(zahl) } }
      : f;
  }
  if (feld === 'beat') return { ...f, arrangement: { ...f.arrangement, beat: wert } };
  return { ...f, lied: { ...f.lied, [feld]: wert } };
}

/**
 * **Wie die Liedinfo beginnt:** mit dem Stand aus ChurchTools; Felder, die dort leer sind, aber in der Datei stehen,
 * sind vorbelegt (Alwin, 23.10.2026). Bei Abweichungen bleibt ChurchTools stehen, der Vergleich trägt den Hinweis.
 */
export function liedinfoStart(
  quelle: LiedinfoQuelle,
  dateiText: string,
): { formular: LiedinfoFormular; vergleich: LiedinfoVergleich[] } {
  const vergleich = liedinfoVergleich(
    liedinfoAusDatei(dateiText),
    liedinfoAusStand(quelle.lied, quelle.arrangement),
  );
  let formular: LiedinfoFormular = {
    lied: formularAusLied(quelle.lied),
    arrangement: formularAusArrangement(quelle.arrangement),
  };
  // Ohne Recht wird nichts vorbelegt – es könnte ohnehin nicht gespeichert werden.
  if (quelle.darf)
    for (const v of vergleich)
      if (v.art === 'vorbelegen') formular = setzeFeld(formular, v.feld, v.datei);
  return { formular, vergleich };
}

/** „übernehmen“ am Hinweis: den Datei-Wert in das Feld legen. */
export function liedinfoUebernehmen(f: LiedinfoFormular, v: LiedinfoVergleich): LiedinfoFormular {
  return setzeFeld(f, v.feld, v.datei);
}

/** Der Wert eines Felds im Formular – für Anzeige und Vergleich. */
export function liedinfoWert(f: LiedinfoFormular, feld: LiedinfoFeld): string {
  if (feld === 'tempo') return f.arrangement.tempo;
  if (feld === 'beat') return f.arrangement.beat;
  return f.lied[feld];
}

/**
 * **Was beim Speichern an ChurchTools geht** – über die Funktionen des Stammdaten-Blatts. `null` je Teil heißt:
 * dort hat sich nichts geändert.
 */
export function liedinfoAenderung(
  f: LiedinfoFormular,
  quelle: LiedinfoQuelle,
): { lied: Partial<LiedStammdaten> | null; arrangement: ArrangementAuftrag | null } {
  const lied = aenderungAus(f.lied, quelle.lied);
  return {
    lied: Object.keys(lied).length ? lied : null,
    arrangement: arrangementGeaendert(f.arrangement, quelle.arrangement)
      ? auftragAus(f.arrangement, quelle.arrangement)
      : null,
  };
}
