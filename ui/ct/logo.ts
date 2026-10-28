/**
 * **Das Logo der Gemeinde** aus ChurchTools – fürs Papier (Organigramm-PDF, O7b-4). Gemessen in der Test-Instanz
 * (28.10.2026): `GET /api/config` → `site_logo` = `images/558/…` (ohne `data`-Hülle, relativ zur Instanz), dahinter ein
 * PNG 150 × 150 – dasselbe Bild wie oben links in der ChurchTools-Leiste.
 *
 * Beiwerk wie der Gemeindename: Fehlt es oder lädt es nicht, steht das Blatt ohne Logo da.
 */
import { ctAnfrage, ctDatei } from './verbindung';
import { ctBasis } from './basis';

/** Die Adresse des Logos – `null`, wenn keins eingestellt ist. */
export function logoAdresse(config: unknown, basis: string): string | null {
  const pfad = (config as { site_logo?: unknown } | null | undefined)?.site_logo;
  if (typeof pfad !== 'string' || pfad.trim() === '') return null;
  return /^https?:\/\//.test(pfad) ? pfad : `${basis}/${pfad.trim().replace(/^\/+/, '')}`;
}

/** Größte Kante des Bildes für die PDF – auf 13 mm reichen gut 300 dpi. */
const KANTE = 300;

/**
 * Das Logo als PNG-Daten-Adresse (für `<image>` in SVG und PDF) – `null`, wenn keins eingestellt ist. **Wirft**, wenn
 * es nicht lesbar ist; der Aufrufer entscheidet (die PDF lässt es dann weg). Über eine Zeichenfläche, damit jedes Format,
 * das der Browser zeigt (auch SVG oder WebP), als PNG in der PDF landet.
 */
export async function ladeGemeindeLogo(): Promise<string | null> {
  const url = logoAdresse(await ctAnfrage<unknown>('/config'), ctBasis());
  if (!url) return null;
  const bild = await createImageBitmap(await ctDatei(url));
  const f = Math.min(1, KANTE / Math.max(bild.width, bild.height));
  const flaeche = document.createElement('canvas');
  flaeche.width = Math.max(1, Math.round(bild.width * f));
  flaeche.height = Math.max(1, Math.round(bild.height * f));
  const zeichner = flaeche.getContext('2d');
  if (!zeichner) throw new Error('Keine Zeichenfläche für das Logo.');
  zeichner.drawImage(bild, 0, 0, flaeche.width, flaeche.height);
  bild.close();
  return flaeche.toDataURL('image/png');
}
