/**
 * **Wie eine Datei eines Arrangements aussieht** – Symbol, Art und die zwei Zeilen in einer Liste. Seit E6-O O4 hier
 * (vorher `client/src/utils/dateiVerwaltung.ts`): Die Lied-Ansicht im Dienstplaner zeigt dieselben Dateien wie die
 * Dateiverwaltung der Musik-App und soll sie nicht nachbauen.
 */
import type { ArrangementFileEntry, ArrangementFileKind } from '@shared/types/index';
import type { IconName } from '../icons/icons';
import { dateiGroesse } from './dateiGroesse';

/**
 * Symbol je Art – Linien-Icons wie im Lied-Menü, damit eine Datei überall gleich aussieht (bis 22.10.2026
 * Emoji: Sie passten nicht zu den Linien-Icons, und ein Zeichen fehlte auf iOS ganz).
 */
export const DATEI_SYMBOL: Record<ArrangementFileKind, IconName> = {
  'chordpro-original': 'music',
  'chordpro-version': 'music',
  pdf: 'dokument',
  image: 'bild',
  other: 'anhang',
};

/**
 * Die zwei Zeilen einer Datei in der Liste (#321).
 *
 * Oben steht die **sprechende** Bezeichnung vom Server (`label`) – „Notenblatt (ChordPro)",
 * „Version „Akustik"" oder bei PDF/Bild der Dateiname selbst. Was darunter kommt, folgt daraus:
 *
 *  - Weicht die Bezeichnung vom Dateinamen ab, steht **der Dateiname** darunter. Sonst wüsste man
 *    nicht, welche Datei in ChurchTools gemeint ist – und genau danach sucht man dort.
 *  - Ist sie der Dateiname, steht die **Art** darunter („PDF", „Bild").
 *
 * **Die Größe erscheint nur, wenn sie bekannt ist.** ChurchTools liefert sie für ChordPro-Dateien
 * nicht mit; ein „· –" am Ende jeder Zeile sah aus wie ein Fehler (von Alwin gemeldet, 11.08.2026).
 * Wo nichts bekannt ist, gehört auch nichts hin.
 */
export function dateiZeilen(datei: ArrangementFileEntry): { titel: string; unter: string } {
  const teile = [datei.label === datei.name ? DATEI_ART[datei.kind] : datei.name];
  if (datei.size !== null) teile.push(dateiGroesse(datei.size));
  return { titel: datei.label, unter: teile.join(' · ') };
}

/** Was eine Datei IST – der Zusatz unter dem Namen, wenn die Bezeichnung schon der Dateiname ist. */
export const DATEI_ART: Record<ArrangementFileKind, string> = {
  'chordpro-original': 'ChordPro – daraus entsteht das Notenblatt',
  'chordpro-version': 'ChordPro – von der App verwaltete Version',
  pdf: 'PDF',
  image: 'Bild',
  other: 'Datei',
};
