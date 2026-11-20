/** Die Daten des `FilterKnopf` – eigene Datei, damit die Komponenten-Datei nur Komponenten exportiert (Fast Refresh). */

/**
 * Ein zweites, eingerücktes Häkchen unter einer Möglichkeit – in der Terminliste der Musik-App „auch ohne Ablauf“ je
 * Kalender (05.11.2026). Es zählt nicht in die Zahl am Knopf und ist aus, solange die Möglichkeit selbst aus ist.
 */
export interface FilterZusatz {
  text: string;
  an: boolean;
  onUmschalten: () => void;
}

/**
 * Eine Liste eingerückter Häkchen unter einer Möglichkeit – im Dienstplaner die Dienste unter einer Gruppe (Wunsch 10,
 * 16.11.2026). Das Häkchen der Möglichkeit steht für alle zusammen (`teilweise` = ein Strich statt Haken); ein Tipp
 * darauf ruft `onAlle`, die Wahl der einzelnen Punkte bleibt beim Aufrufer. Ausgeblendete Punkte einer Möglichkeit, die
 * selbst an ist, zählen in die Zahl am Knopf.
 */
export interface FilterUnter {
  teilweise: boolean;
  onAlle: () => void;
  punkte: { text: string; an: boolean; onUmschalten: () => void }[];
}

/** Eine Möglichkeit im Abschnitt. */
export interface FilterOption {
  wert: string;
  text: string;
  zusatz?: FilterZusatz;
  unter?: FilterUnter;
}

/** Ein Abschnitt im Filter-Menü, z. B. „Veranstaltungen“ oder „Gruppen“. */
export interface FilterAbschnitt {
  titel: string;
  optionen: FilterOption[];
  /** Die ausgeschalteten Werte. */
  aus: string[];
  /** Die neue Liste der ausgeschalteten Werte nach einem Tipp. */
  onAus: (aus: string[]) => void;
  /** Ein kurzer Satz unter den Häkchen, z. B. wofür das Zusatz-Häkchen gilt. */
  hinweis?: string;
  /**
   * **Anzeige statt Filter** (R6, „Ruhige Bedienung“ B3): Schalter, die nur das Aussehen ändern (Spaltenbreite der Matrix),
   * stehen im Filter-Fenster unter „Anzeige“. Sie blenden nichts aus – deshalb zählen sie nicht in die Zahl am Knopf, und
   * der Abschnitt gilt auch mit einer einzigen Möglichkeit als Wahl.
   */
  anzeige?: boolean;
  /**
   * **Genau eine Möglichkeit** statt Häkchen (Punkte statt Kästchen; Organigramm „Personen: Aus · Nur Rollen · Alle“, B5/E13):
   * `wert` ist die gewählte, `onWahl` bekommt die neue. Es ist eine Anzeige und zählt nicht in die Zahl am Knopf. Mit
   * `eineWahl` bauen – dort stehen `aus`/`onAus` richtig leer.
   */
  eine?: { wert: string; onWahl: (wert: string) => void };
  /**
   * **Abkürzungen** unter den Häkchen („Alle“, „Nur Leitung“ bei den Rollen des Organigramms) – schalten mehrere Häkchen auf
   * einmal um, über dieselbe Liste `aus` wie die Häkchen selbst.
   */
  kurz?: { text: string; onClick: () => void }[];
}

/** Ein Abschnitt, in dem genau eine Möglichkeit gilt (Punkte); zählt nicht als Filter. */
export function eineWahl(
  titel: string,
  optionen: { wert: string; text: string }[],
  wert: string,
  onWahl: (wert: string) => void,
): FilterAbschnitt {
  return { titel, optionen, aus: [], onAus: () => undefined, eine: { wert, onWahl } };
}

/**
 * Hat der Abschnitt etwas zu wählen? Eine Möglichkeit allein nur, wenn sie ein Zusatz-Häkchen trägt. Auch für
 * Aufrufer, die um den Knopf etwas legen (Einführungs-Ziel) – der Knopf selbst fehlt ohne Wahl.
 */
export function abschnittMitWahl(a: FilterAbschnitt): boolean {
  return a.anzeige === true || a.optionen.length > 1 || a.optionen.some((o) => o.zusatz);
}
