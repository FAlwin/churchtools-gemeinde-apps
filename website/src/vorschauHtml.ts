/**
 * **Die Vorschau einer Seite** (Bauplan Website W3a-1): das HTML kommt vom **echten Renderer** (`renderSeite`, derselbe
 * Code wie später im Bau-Dienst), damit Vorschau und Website nicht auseinanderlaufen.
 *
 * Das HTML läuft in einem `iframe` mit `srcdoc` und **`sandbox="allow-scripts"` ohne `allow-same-origin`**: Der Baustein
 * „Eigenes HTML“ (E-W12) bringt fremden Code mit; in dieser Sandbox hat er einen eigenen, leeren Ursprung – kein Zugriff
 * auf ChurchTools, die Sitzung oder die Erweiterung. Folge: Das iframe kann nichts von der Erweiterung laden. Deshalb
 * - das **Stylesheet** als `data:`-Adresse (Text aus `website.css`, per `?raw`),
 * - **keine Schriftdateien** (die kommen mit W3a-3; die Seite fällt auf die Ersatzschrift zurück),
 * - **Bilder als neutrales Platzhalter-Bild** (`data:`), echte Bilder kommen mit W4.
 * Dynamische Daten (Termine, Beiträge, Slider, Livestream, Gruppen) bleiben leer – der Renderer zeigt dann seine
 * Leer-Hinweise.
 */
import css from '@shared/website/website.css?raw';
import type { Einstellungen, Menue, Seite } from '@shared/website/modell';
import { renderSeite, type RenderKontext } from '@shared/website/render';
import { vorlaeufigeEinstellungen } from '@shared/website/seitenListe';

/** Was das iframe darf: Skripte (Eigenes HTML), aber **nie** `allow-same-origin`. Test: `Vorschau.test.tsx`. */
export const VORSCHAU_SANDBOX = 'allow-scripts';

/** Das Stylesheet als Adresse – das iframe hat keinen Ursprung, von dem es eine Datei laden könnte. */
export const STYLESHEET_ADRESSE = `data:text/css;charset=utf-8,${encodeURIComponent(css)}`;

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
): RenderKontext {
  return {
    einstellungen: stand.einstellungen ?? vorlaeufigeEinstellungen(gemeinde),
    menue: stand.menue ?? { eintraege: [] },
    seiten: stand.seiten,
    // Links in der Vorschau führen nirgendwohin: Im Sandkasten gäbe es für `/pfad/` keine Seite.
    adresseVon: (s) => `#/${s.pfad}`,
    bildAdresse: () => PLATZHALTER_ADRESSE,
    stylesheet: STYLESHEET_ADRESSE,
    // Das Seiten-Skript (Handy-Menü, Einwilligung) liefert der Bau-Dienst – in der Vorschau läuft keins.
    skriptAdresse: 'data:text/javascript;charset=utf-8,',
    schriftAdresse: () => 'data:,',
    zeitzone,
  };
}

/** Die Seite als vollständiges HTML-Dokument für `srcdoc`. */
export function vorschauHtml(
  seite: Seite,
  stand: VorschauStand,
  gemeinde: string | null,
  zeitzone: string,
): string {
  return renderSeite(seite, vorschauKontext(stand, gemeinde, zeitzone));
}
