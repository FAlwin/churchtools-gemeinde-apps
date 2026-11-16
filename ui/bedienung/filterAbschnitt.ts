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
}

/**
 * Hat der Abschnitt etwas zu wählen? Eine Möglichkeit allein nur, wenn sie ein Zusatz-Häkchen trägt. Auch für
 * Aufrufer, die um den Knopf etwas legen (Einführungs-Ziel) – der Knopf selbst fehlt ohne Wahl.
 */
export function abschnittMitWahl(a: FilterAbschnitt): boolean {
  return a.optionen.length > 1 || a.optionen.some((o) => o.zusatz);
}
