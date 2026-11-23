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
 *
 * **Untergruppen (W3b-4a, E-W28):** Jede direkte Untergruppe der Gruppe „Website“ bekommt beim Einrichten eine eigene
 * `veroeffentlicht-g<Untergruppe>` – aber **keine** eigene Entwürfe-Kategorie (E-W19: eine gemeinsame). Darum bestimmt nur
 * `entwuerfe-g<ID>`, welche Website man sieht; eine Veröffentlicht-Kategorie allein sagt nicht, ob sie zur Website oder zu
 * einer ihrer Untergruppen gehört.
 */
import { kategorieAusListe, type KategorieAngabe } from '../ct/modulDaten';
import { elternAus, kinderVon, type RohHierarchie } from '../organigramm/gruppen';

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

/** Der Name einer Veröffentlicht-Kategorie – für die Website und für jede Untergruppe derselbe Aufbau. */
const veroeffentlichtName = (gruppenName: string): string =>
  `Website: Veröffentlicht${NAMENS_TRENNER}${gruppenName}`;

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
      name: veroeffentlichtName(gruppenName),
      beschreibung:
        'Freigegebene Fassung der Website. Schreiben: nur die Leitung. Lesen: der Bau-Dienst.',
    },
  ];
}

/**
 * **Die Kategorie einer Untergruppe** (W3b-4a): nur „Veröffentlicht“ – Entwürfe teilen sich alle (E-W19). Gleicher Aufbau wie
 * die Veröffentlicht-Kategorie der Website, damit eine schon angelegte (Messung W3b-4-0: `veroeffentlicht-g347`) gefunden wird.
 */
export function untergruppenKategorie(gruppe: number, gruppenName: string): KategorieAngabe {
  return {
    kuerzel: kuerzelVeroeffentlicht(gruppe),
    name: veroeffentlichtName(gruppenName),
    beschreibung:
      'Freigegebene Seiten einer Untergruppe der Website. Schreiben: die Leitung der Untergruppe und der Website. Lesen: der Bau-Dienst.',
  };
}

/**
 * **Die Untergruppen der Website:** alle **direkten** Kinder der Gruppe in `GET /groups/hierarchies` (E-W28) – Enkel nicht. Die
 * Auswertung der Hierarchie ist die des Organigramms (`elternAus`/`kinderVon`), nicht nachgebaut.
 */
export function untergruppenAus(
  hierarchie: readonly RohHierarchie[] | null | undefined,
  website: number,
): number[] {
  return kinderVon(elternAus(hierarchie), website);
}

/** Eine eingerichtete Untergruppe: ihre Gruppe und ihre Veröffentlicht-Kategorie. */
export interface UntergruppenKategorie {
  gruppe: number;
  kategorie: number;
}

/**
 * **Welche Untergruppen eingerichtet sind:** die, deren `veroeffentlicht-g<Untergruppe>` in der Liste steht (bei gleichem
 * Kürzel die kleinste ID, wie überall). Nur Kinder der Website zählen – eine fremde `veroeffentlicht-g…` nie.
 */
export function untergruppenKategorienAus(
  liste: readonly { id: number; shorty: string }[],
  untergruppen: readonly number[],
): UntergruppenKategorie[] {
  return untergruppen.flatMap((gruppe) => {
    const kategorie = kategorieAusListe(liste, kuerzelVeroeffentlicht(gruppe));
    return kategorie === null ? [] : [{ gruppe, kategorie }];
  });
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
 * Welche Website man sieht – aus der Liste der Kategorien von ChurchTools. **Die Gruppe kommt allein aus `entwuerfe-g<ID>`**
 * (W3b-4a): Seit es Untergruppen gibt, steht neben `veroeffentlicht-g344` (Website) auch `veroeffentlicht-g347` (Untergruppe)
 * – eine Veröffentlicht-Kategorie wird darum nie als Website gewählt, auch nicht, wenn ihre ID kleiner ist oder jemand nur sie
 * sieht (dann: `null`). Gibt es mehrere `entwuerfe-g<ID>` zu verschiedenen Gruppen, gilt die mit der **kleinsten Kategorie-ID**
 * (die älteste), damit alle Geräte dieselbe nehmen – wie bei gleichem Kürzel. `null`: keine sichtbar. „Nicht sichtbar“ und
 * „nicht angelegt“ sehen gleich aus (ohne Recht kommt eine leere Liste, gemessen); was davon gilt, entscheidet erst das Recht
 * zum Anlegen.
 */
export function einrichtungAus(
  liste: readonly { id: number; shorty: string; name?: string }[],
): Einrichtung | null {
  const sortiert = [...liste].sort((a, b) => a.id - b.id);
  const erste = sortiert.find((k) => kuerzelLesen(k.shorty)?.art === KUERZEL_ENTWUERFE);
  if (!erste) return null;
  const gruppe = kuerzelLesen(erste.shorty)!.gruppe;
  return {
    gruppe,
    name: gruppenNameAus(sortiert.find((k) => kuerzelLesen(k.shorty)?.gruppe === gruppe)?.name),
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
