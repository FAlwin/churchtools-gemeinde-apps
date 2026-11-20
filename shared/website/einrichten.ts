/**
 * **Die Kategorien der Website und ob die Erweiterung eingerichtet ist** (Bauplan Website W3a-1, §3.2/§3.3).
 *
 * Je Website zwei Kategorien, damit die Rechte später (W3b) getrennt vergeben werden können (gemessen W0: ChurchTools
 * vergibt „Daten sehen/ändern“ je Kategorie):
 *  - `entwuerfe-g<ID>` – die Arbeitsfassung aller Seiten, des Menüs und der Einstellungen;
 *  - `veroeffentlicht-g<ID>` – nur die freigegebene Fassung (schreibt später nur die Leiter-Rolle; der Bau-Dienst liest
 *    nur sie). Beschrieben wird sie seit W3b-2 – allein durch „Freigeben“ (`freigabe.ts`).
 *
 * **Die Gruppe steckt im Kürzel** (wie bei den Protokollen: `protokolle-g<ID>`): Die Erweiterung erfährt so, welche
 * Gruppe „Website“ gewählt wurde, ohne etwas zusätzlich zu speichern, und – wichtig – das Kürzel ist auch für den sichtbar,
 * der die Kategorie sehen darf, ohne die Gruppe selbst zu sehen. Der Name trägt den Gruppennamen für die Anzeige.
 */
import { kategorieAusListe, type KategorieAngabe } from '../ct/modulDaten';

export const KUERZEL_ENTWUERFE = 'entwuerfe';
export const KUERZEL_VEROEFFENTLICHT = 'veroeffentlicht';

/** Trenner im Namen einer Kategorie: „Website: Entwürfe · Website“. */
export const NAMENS_TRENNER = ' · ';

export function kuerzelEntwuerfe(gruppe: number): string {
  return `${KUERZEL_ENTWUERFE}-g${gruppe}`;
}

export function kuerzelVeroeffentlicht(gruppe: number): string {
  return `${KUERZEL_VEROEFFENTLICHT}-g${gruppe}`;
}

/** Welche Gruppe und welche Art steckt in einem Kürzel? `null` für fremde Kategorien. */
export function kuerzelLesen(
  kuerzel: string,
): { art: 'entwuerfe' | 'veroeffentlicht'; gruppe: number } | null {
  const m = /^(entwuerfe|veroeffentlicht)-g([1-9]\d*)$/.exec(kuerzel);
  return m ? { art: m[1] as 'entwuerfe' | 'veroeffentlicht', gruppe: Number(m[2]) } : null;
}

/** Die beiden Kategorien, wie sie beim Einrichten angelegt werden. */
export function kategorienFuer(gruppe: number, gruppenName: string): KategorieAngabe[] {
  return [
    {
      kuerzel: kuerzelEntwuerfe(gruppe),
      name: `Website: Entwürfe${NAMENS_TRENNER}${gruppenName}`,
      beschreibung:
        'Arbeitsfassung der Website (Seiten, Menü, Einstellungen). Sehen und Bearbeiten: das Website-Team (Rechte vergibt die Verwaltung).',
    },
    {
      kuerzel: kuerzelVeroeffentlicht(gruppe),
      name: `Website: Veröffentlicht${NAMENS_TRENNER}${gruppenName}`,
      beschreibung:
        'Freigegebene Fassung der Website. Schreiben: nur die Leitung. Lesen: der Bau-Dienst.',
    },
  ];
}

export interface Einrichtung {
  /** Die gewählte Gruppe „Website“. */
  gruppe: number;
  /** Ihr Name aus der Kategorie – `null`, wenn die Kategorie keinen trägt. */
  name: string | null;
  /** ID der Kategorie „Entwürfe“, `null` = nicht da oder nicht sichtbar. */
  entwuerfe: number | null;
  veroeffentlicht: number | null;
}

function gruppenNameAus(kategorieName: string | undefined): string | null {
  if (!kategorieName) return null;
  const i = kategorieName.indexOf(NAMENS_TRENNER);
  const name = i >= 0 ? kategorieName.slice(i + NAMENS_TRENNER.length).trim() : '';
  return name || null;
}

/**
 * Welche Website man sieht – aus der Liste der Kategorien von ChurchTools. Gibt es mehrere (`…-g<ID>` zu
 * verschiedenen Gruppen), gilt die mit der **kleinsten Kategorie-ID** (die älteste), damit alle Geräte dieselbe nehmen –
 * wie bei gleichem Kürzel. `null`: keine sichtbar. „Nicht sichtbar“ und „nicht angelegt“ sehen gleich aus (ohne Recht
 * kommt eine leere Liste, gemessen); was davon gilt, entscheidet erst das Recht zum Anlegen.
 */
export function einrichtungAus(
  liste: readonly { id: number; shorty: string; name?: string }[],
): Einrichtung | null {
  const eigene = [...liste]
    .sort((a, b) => a.id - b.id)
    .filter((k) => kuerzelLesen(k.shorty) !== null);
  const erste = eigene[0];
  if (!erste) return null;
  const gruppe = kuerzelLesen(erste.shorty)!.gruppe;
  return {
    gruppe,
    name: gruppenNameAus(eigene.find((k) => kuerzelLesen(k.shorty)?.gruppe === gruppe)?.name),
    entwuerfe: kategorieAusListe(liste, kuerzelEntwuerfe(gruppe)),
    veroeffentlicht: kategorieAusListe(liste, kuerzelVeroeffentlicht(gruppe)),
  };
}

export type EinrichtungsStand = 'fertig' | 'einrichten' | 'unvollstaendig' | 'fehlt';

/**
 * Was die Seite zeigt: `fertig` (beide Kategorien sichtbar), `einrichten` (es fehlt etwas und man darf einrichten – der
 * Admin richtet ein oder repariert), `unvollstaendig` (es fehlt eine Kategorie, man darf nicht einrichten) oder `fehlt`
 * (nichts sichtbar, man darf nicht einrichten – Hinweis an die Verwaltung).
 */
export function einrichtungsStand(
  e: Einrichtung | null,
  darfEinrichten: boolean,
): EinrichtungsStand {
  if (e && e.entwuerfe !== null && e.veroeffentlicht !== null) return 'fertig';
  if (darfEinrichten) return 'einrichten';
  return e ? 'unvollstaendig' : 'fehlt';
}
