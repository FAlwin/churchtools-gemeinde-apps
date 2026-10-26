/** Menü „Einfügen“ im Lied-Editor (L6): was es anbietet – eigene Datei, damit die Komponente nur Komponenten exportiert. */
import { LIEDINFO_FELDER, type LiedinfoFeld } from '@shared/ct/liedinfo';

/** Was das Menü einfügen kann – der Editor setzt es in den Text. */
export type Einfuegen =
  | { art: 'teil'; name: string }
  | { art: 'pedal' }
  | { art: 'anderes'; tag: string; mitWert: boolean }
  | { art: 'liedinfo'; feld: LiedinfoKopf; tag: string };

/** Eine Kopfangabe: ein Feld der Liedinfo oder die Tonart (`{key}` – Feld „Tonart“ der Liedinfo-Karte). */
export type LiedinfoKopf = LiedinfoFeld | 'key';

/** Die Teile, die das Menü anbietet; „Vers“ nummeriert sich selbst (`neuerTeilName`). */
export const TEILE = [
  'Vers',
  'Refrain',
  'Pre-Chorus',
  'Bridge',
  'Intro',
  'Zwischenspiel',
  'Outro',
  'Ende',
];

/**
 * **Die Kopfangaben** wie im alten Format-Menü (Alwin, 26.10.2026: „all diese Infos sollten irgendwo auffindbar
 * sein“). Sie gehören seit L4 in die Liedinfo: Mit Liedinfo öffnet ein Tipp dort das Feld, ohne (Original-Notenblatt)
 * kommen sie wie früher als Angabe in den Text. Die Angaben stammen aus `LIEDINFO_FELDER` (Feld ↔ ChordPro-Angabe),
 * dazu die Tonart – keine zweite Aufzählung.
 */
const KOPF_TEXTE: Record<LiedinfoKopf, string> = {
  name: 'Titel des Lieds',
  author: 'Interpret / Künstler',
  key: 'Tonart',
  tempo: 'Tempo (BPM)',
  beat: 'Taktart',
  ccli: 'CCLI-Nummer',
  copyright: 'Copyright',
};
const KOPF_REIHE: LiedinfoKopf[] = ['name', 'author', 'key', 'tempo', 'beat', 'ccli', 'copyright'];
export const KOPFANGABEN: { feld: LiedinfoKopf; tag: string; label: string }[] = KOPF_REIHE.map(
  (feld) => ({
    feld,
    tag: feld === 'key' ? 'key' : LIEDINFO_FELDER.find((f) => f.feld === feld)!.zeile,
    label: KOPF_TEXTE[feld],
  }),
);

/**
 * Gültiges ChordPro, das in DIESER App nichts bewirkt (Kapo kommt vom Kapo-Wähler am Blatt, die übrigen
 * übergeht die Vorschau) – für Notenblätter, die auch in anderen Programmen laufen.
 */
export const ANDERE: { tag: string; label: string; mitWert: boolean }[] = [
  { tag: 'capo', label: 'Kapo (Bund)', mitWert: true },
  { tag: 'column_break', label: 'Neue Spalte', mitWert: false },
  { tag: 'new_page', label: 'Neue Seite', mitWert: false },
  { tag: 'subtitle', label: 'Untertitel', mitWert: true },
];
