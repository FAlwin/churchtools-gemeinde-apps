/**
 * **Die Vorschau einer Seite** (Bauplan Website W3a-1): das HTML kommt vom **echten Renderer** (`renderSeite`, derselbe
 * Code wie später im Bau-Dienst), damit Vorschau und Website nicht auseinanderlaufen.
 *
 * Das HTML läuft in einem `iframe` mit `srcdoc` und **`sandbox="allow-scripts"` ohne `allow-same-origin`**: Der Baustein
 * „Eigenes HTML“ (E-W12) bringt fremden Code mit; in dieser Sandbox hat er einen eigenen, leeren Ursprung – kein Zugriff
 * auf ChurchTools, die Sitzung oder die Erweiterung. Folge: Das iframe kann nichts von der Erweiterung laden. Zudem **erbt
 * es die Content-Security-Policy von ChurchTools** (gemessen 20.11.2026): `data:`-Stylesheets und Skripte ohne Nonce sind
 * dort blockiert, ein `<style>` im Dokument nicht. Deshalb
 * - das **Stylesheet** als `<style>` im Dokument (Text aus `website.css`, per `?raw`; `stylesheetText` im Renderer),
 * - **kein Seiten-Skript** (die Vorschau braucht keins; die Bearbeiten-Ebene trägt die Nonce der ChurchTools-Seite),
 * - **Schriften als `data:`-Adresse** (`schriftLader.ts`; ChurchTools erlaubt `font-src data:`) – bis eine Datei da ist (und für
 *   eigene Schriften bis W4) fällt die Seite auf die Ersatzschrift zurück,
 * - **Bilder als neutrales Platzhalter-Bild** (`data:`), echte Bilder kommen mit W4.
 * Dynamische Daten (Termine, Beiträge, Slider, Livestream, Gruppen) bleiben leer – der Renderer zeigt dann seine
 * Leer-Hinweise.
 */
import css from '@shared/website/website.css?raw';
import type { Einstellungen, Menue, Seite } from '@shared/website/modell';
import { renderSeite, type RenderKontext } from '@shared/website/render';
import { vorlaeufigeEinstellungen } from '@shared/website/seitenListe';
import { mitEbene } from './ebene';
import { KEINE_SCHRIFT } from './schriftLader';

/** Was das iframe darf: Skripte (Eigenes HTML), aber **nie** `allow-same-origin`. Test: `Vorschau.test.tsx`. */
export const VORSCHAU_SANDBOX = 'allow-scripts';

/** Das Stylesheet als Text – das iframe hat keinen Ursprung, von dem es eine Datei laden könnte, und ChurchTools sperrt `data:`-Stylesheets. */
export const STYLESHEET_TEXT = css;

/** Neutrales Platzhalter-Bild (grau, mit Berg und Sonne) – bis Bilder in W4 hochgeladen werden können. */
const PLATZHALTER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="#cbd5e1"/>' +
  '<circle cx="1180" cy="240" r="90" fill="#e2e8f0"/><path d="M0 780l420-320 280 210 360-400 540 500v130H0z" fill="#94a3b8"/></svg>';
export const PLATZHALTER_ADRESSE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PLATZHALTER_SVG)}`;

/** Der Zustand der Website, soweit die Vorschau ihn braucht. */
export interface VorschauStand {
  seiten: Seite[];
  menue: Menue | null;
  einstellungen: Einstellungen | null;
}

/** Der Kontext für den Renderer: nichts wird nachgeladen, alles steckt im Dokument. */
export function vorschauKontext(
  stand: VorschauStand,
  gemeinde: string | null,
  zeitzone: string,
  schriftAdresse: (datei: string) => string = () => KEINE_SCHRIFT,
): RenderKontext {
  return {
    einstellungen: stand.einstellungen ?? vorlaeufigeEinstellungen(gemeinde),
    menue: stand.menue ?? { eintraege: [] },
    seiten: stand.seiten,
    // Links in der Vorschau führen nirgendwohin: Im Sandkasten gäbe es für `/pfad/` keine Seite.
    adresseVon: (s) => `#/${s.pfad}`,
    bildAdresse: () => PLATZHALTER_ADRESSE,
    stylesheet: '',
    stylesheetText: STYLESHEET_TEXT,
    // Das Seiten-Skript (Handy-Menü, Einwilligung) liefert der Bau-Dienst – in der Vorschau läuft keins (`skriptAdresse` fehlt).
    schriftAdresse,
    zeitzone,
  };
}

/**
 * Die Seite als vollständiges HTML-Dokument für `srcdoc`. Mit `bearbeiten` hängt die **Bearbeiten-Ebene** daran (W3a-2:
 * Leisten, „Abschnitt einfügen“, Klick auf Bausteine; `ebene.ts`) – **nur hier, in der Vorschau**. Der Renderer selbst
 * bekommt dafür keinen Sonderweg: Die Ebene findet Abschnitte, Spalten und Bausteine an der Reihenfolge im Dokument.
 */
export function vorschauHtml(
  seite: Seite,
  stand: VorschauStand,
  gemeinde: string | null,
  zeitzone: string,
  bearbeiten?: { scroll: number; nonce?: string | null },
  schriftAdresse?: (datei: string) => string,
): string {
  try {
    const html = renderSeite(seite, vorschauKontext(stand, gemeinde, zeitzone, schriftAdresse));
    return bearbeiten ? mitEbene(html, bearbeiten.scroll, bearbeiten.nonce) : html;
  } catch {
    // Mitten im Bearbeiten kann etwas Unfertiges stehen, das der Renderer nicht mag – die Erweiterung soll deshalb nicht
    // abstürzen. Gespeichert wird so etwas nie (`seitePruefen`).
    return '<!doctype html><meta charset="utf-8"><p style="font:15px system-ui,sans-serif;padding:24px">Die Vorschau lässt sich mit diesen Angaben gerade nicht zeichnen.</p>';
  }
}
