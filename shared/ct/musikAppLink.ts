/**
 * **Direktlink in die Musik-App: ein Lied in einem Termin** (E6-O O4, Alwin 28.10.2026). Die Lied-Ansicht im
 * Dienstplaner öffnet damit das Blatt dieses Lieds im Ablauf dieses Termins. EINE Stelle für beide Seiten: Der
 * Dienstplaner baut die Adresse, die Musik-App liest sie – eine abweichende Kopie fiele erst im Browser auf.
 *
 * Form: `<Adresse der Musik-App>#/termin/<Termin-ID>/punkt/<ID des Ablaufpunkts>?am=<JJJJ-MM-TT>`. Der Punkt (nicht die
 * Nummer des Lieds) bleibt richtig, auch wenn jemand den Ablauf inzwischen umsortiert hat. Der Tag (`am`, in der
 * Zeitzone der Gemeinde) ist dabei, weil die Musik-App nur ein Fenster von einer Woche zurück bis sechs Wochen voraus
 * lädt – liegt der Termin außerhalb, holt sie genau diesen Tag nach (gefunden in der Test-Instanz, 28.10.2026: ein
 * Termin von vor zehn Tagen landete in der Übersicht). Ein Link ohne Tag bleibt gültig.
 *
 * **Ohne Punkt** (`#/termin/<Termin-ID>?am=…`, E6-Abschluss, Alwin 30.10.2026): der Ablauf dieses Termins – für den
 * Knopf „Musik-App“ in der Termin-Ansicht, der vorher nur die App öffnete.
 */
const MUSTER = /^#\/termin\/(\d+)(?:\/punkt\/(\d+))?(?:\?am=(\d{4}-\d{2}-\d{2}))?$/;

export interface DirektLink {
  terminId: number;
  /** Der Punkt, zu dessen Lied das Blatt springt – fehlt: der Ablauf des Termins. */
  punktId?: number;
  /** Tag des Termins (`JJJJ-MM-TT`) – fehlt bei einem Link ohne `am`. */
  am?: string;
}

export function musikAppDirektLink(
  appAdresse: string,
  terminId: number,
  punktId: number | null,
  am?: string,
): string {
  const punkt = punktId === null ? '' : `/punkt/${punktId}`;
  return `${appAdresse.replace(/#.*$/, '')}#/termin/${terminId}${punkt}${am ? `?am=${am}` : ''}`;
}

/** Termin, Punkt und Tag aus `location.hash` – `null`, wenn die Adresse kein Direktlink ist. */
export function direktLinkAus(hash: string): DirektLink | null {
  const m = MUSTER.exec(hash);
  if (!m) return null;
  return {
    terminId: Number(m[1]),
    ...(m[2] ? { punktId: Number(m[2]) } : {}),
    ...(m[3] ? { am: m[3] } : {}),
  };
}
