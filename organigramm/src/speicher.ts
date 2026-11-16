/**
 * **Der Speicher der Erweiterung** – Anschluss, eigenes Modul und das Lesen eines Dokuments aus einer Kategorie: EINE
 * Stelle für den Plan „neue Gliederung“ (O7-1) und „Was das Organigramm zeigt“ (O7b-7). Die Regeln für Version,
 * Konflikt und Nachlesen stehen in `@shared/ct/versionierterWert`.
 */
import { kategorieSuchen, modulSuchen, werteLesen } from '@shared/ct/modulDaten';
import { merkeVersprechen } from '@shared/ct/versprechenMerker';
import {
  dokumentLesen,
  type Dokumentart,
  type LeseErgebnis,
  type SpeicherGrund,
  type Versioniert,
} from '@shared/ct/versionierterWert';
import { kuerzelAusBasis } from '@ui/erweiterung/kuerzel';
import { versionPortFuer } from '@ui/ct/modulPort';

export const port = versionPortFuer(() => kuerzelAusBasis(import.meta.env.BASE_URL));

/** Die ID des eigenen Moduls – je Sitzung einmal gesucht; ein Fehlschlag wird nicht gemerkt. */
const modulSuche = merkeVersprechen<number>();
export const modulId = () => modulSuche.hole('modul', () => modulSuchen(port, 'Das Organigramm'));

/**
 * Was beim Lesen eines Dokuments herauskommt – mit der Unterscheidung, die `dokumentAusKategorie` verwischt:
 * - `da`: gelesen und im erwarteten Format,
 * - `keine`: Es gibt keinen Wert (keine Kategorie – noch nie gespeichert oder ChurchTools zeigt sie einem nicht –
 *   oder eine Kategorie ohne Wert),
 * - `unlesbar`: Es GIBT einen Wert, aber `aus` erkennt ihn nicht (andere Fassung, beschädigt). Das ist **nicht**
 *   „keine“: Wer ihn für leer hält und neu anlegt, überschreibt ihn,
 * - `fehler`: nicht lesbar (abgemeldet, kein Recht, vorübergehend).
 */
export type KategorieDokument<T> =
  | { art: 'da'; daten: Versioniert<T> }
  | { art: 'keine' }
  | { art: 'unlesbar' }
  | { art: 'fehler'; grund: SpeicherGrund };

/** Ein Dokument frisch lesen und dabei „keine“ von „unlesbar“ unterscheiden (Einrichtung des Gruppenwechsels, O9-5c). */
export const dokumentGenau = <T>(
  kuerzel: string,
  art: Dokumentart,
  aus: (roh: unknown) => T | null,
): Promise<KategorieDokument<T>> => dokumentLesenAls(kuerzel, art, aus, true);

const grundAus = (e: unknown): SpeicherGrund =>
  port.istAbgemeldet(e) ? 'abgemeldet' : port.istKeinRecht(e) ? 'kein-recht' : 'voruebergehend';

async function dokumentLesenAls<T>(
  kuerzel: string,
  art: Dokumentart,
  aus: (roh: unknown) => T | null,
  genau: boolean,
): Promise<KategorieDokument<T>> {
  let modul: number;
  let kategorie: number | null;
  try {
    modul = await modulId();
    kategorie = await kategorieSuchen(port, modul, kuerzel);
  } catch (e) {
    return { art: 'fehler', grund: grundAus(e) };
  }
  if (kategorie === null) return { art: 'keine' };
  const l = await dokumentLesen<unknown>(port, modul, kategorie, art);
  if (!l.ok) return { art: 'fehler', grund: l.grund };
  if (l.daten === null) {
    if (!genau) return { art: 'keine' };
    // Kein Wert „unserer“ Art – aber steht überhaupt etwas in der Kategorie (andere Fassung, kein JSON)? Dann ist sie
    // nicht leer, nur nicht lesbar: Wer sie für leer hielte und neu anlegte, legte einen zweiten Wert daneben.
    try {
      return (await werteLesen(port, modul, kategorie)).length > 0
        ? { art: 'unlesbar' }
        : { art: 'keine' };
    } catch (e) {
      return { art: 'fehler', grund: grundAus(e) };
    }
  }
  const inhalt = aus(l.daten.inhalt);
  return inhalt === null ? { art: 'unlesbar' } : { art: 'da', daten: { ...l.daten, inhalt } };
}

/**
 * Ein Dokument frisch lesen. Keine Kategorie (noch nie gespeichert – oder ChurchTools zeigt sie einem nicht, weil das
 * Leserecht fehlt) = kein Dokument. Ein Wert, der nicht passt (`aus` liefert `null`), zählt ebenso wie keiner;
 * überschreiben darf ihn erst, wer ihn gesehen hat (Version). Wer „kein Wert“ und „Wert, der nicht passt“ trennen
 * muss, nimmt `dokumentGenau` (dort kostet das eine zweite Abfrage; hier bleibt es bei einer).
 */
export async function dokumentAusKategorie<T>(
  kuerzel: string,
  art: Dokumentart,
  aus: (roh: unknown) => T | null,
): Promise<LeseErgebnis<T>> {
  const r = await dokumentLesenAls(kuerzel, art, aus, false);
  if (r.art === 'da') return { ok: true, daten: r.daten };
  if (r.art === 'fehler') return { ok: false, grund: r.grund };
  return { ok: true, daten: null };
}

/** Nur für Tests. */
export function _vergissModul(): void {
  modulSuche.vergiss();
}
