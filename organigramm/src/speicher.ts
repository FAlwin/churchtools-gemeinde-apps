/**
 * **Der Speicher der Erweiterung** – Anschluss, eigenes Modul und das Lesen eines Dokuments aus einer Kategorie: EINE
 * Stelle für den Plan „neue Gliederung“ (O7-1) und „Was das Organigramm zeigt“ (O7b-7). Die Regeln für Version,
 * Konflikt und Nachlesen stehen in `@shared/ct/versionierterWert`.
 */
import { kategorieSuchen, modulSuchen } from '@shared/ct/modulDaten';
import { merkeVersprechen } from '@shared/ct/versprechenMerker';
import { dokumentLesen, type Dokumentart, type LeseErgebnis } from '@shared/ct/versionierterWert';
import { kuerzelAusBasis } from '@ui/erweiterung/kuerzel';
import { versionPortFuer } from '@ui/ct/modulPort';

export const port = versionPortFuer(() => kuerzelAusBasis(import.meta.env.BASE_URL));

/** Die ID des eigenen Moduls – je Sitzung einmal gesucht; ein Fehlschlag wird nicht gemerkt. */
const modulSuche = merkeVersprechen<number>();
export const modulId = () => modulSuche.hole('modul', () => modulSuchen(port, 'Das Organigramm'));

/**
 * Ein Dokument frisch lesen. Keine Kategorie (noch nie gespeichert – oder ChurchTools zeigt sie einem nicht, weil das
 * Leserecht fehlt) = kein Dokument. Ein Wert, der nicht passt (`aus` liefert `null`), zählt ebenso wie keiner;
 * überschreiben darf ihn erst, wer ihn gesehen hat (Version).
 */
export async function dokumentAusKategorie<T>(
  kuerzel: string,
  art: Dokumentart,
  aus: (roh: unknown) => T | null,
): Promise<LeseErgebnis<T>> {
  let modul: number;
  let kategorie: number | null;
  try {
    modul = await modulId();
    kategorie = await kategorieSuchen(port, modul, kuerzel);
  } catch (e) {
    return {
      ok: false,
      grund: port.istAbgemeldet(e)
        ? 'abgemeldet'
        : port.istKeinRecht(e)
          ? 'kein-recht'
          : 'voruebergehend',
    };
  }
  if (kategorie === null) return { ok: true, daten: null };
  const l = await dokumentLesen<unknown>(port, modul, kategorie, art);
  if (!l.ok || l.daten === null) return l as LeseErgebnis<T>;
  const inhalt = aus(l.daten.inhalt);
  return inhalt === null ? { ok: true, daten: null } : { ok: true, daten: { ...l.daten, inhalt } };
}

/** Nur für Tests. */
export function _vergissModul(): void {
  modulSuche.vergiss();
}
