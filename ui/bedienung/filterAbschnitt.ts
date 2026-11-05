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

/** Ein Abschnitt im Filter-Menü, z. B. „Veranstaltungen“ oder „Gruppen“. */
export interface FilterAbschnitt {
  titel: string;
  optionen: { wert: string; text: string; zusatz?: FilterZusatz }[];
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
