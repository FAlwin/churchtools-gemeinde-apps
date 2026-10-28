/**
 * **Direktlink in die Musik-App: ein Lied in einem Termin** (E6-O O4, Alwin 28.10.2026). Die Lied-Ansicht im
 * Dienstplaner öffnet damit das Blatt dieses Lieds im Ablauf dieses Termins. EINE Stelle für beide Seiten: Der
 * Dienstplaner baut die Adresse, die Musik-App liest sie – eine abweichende Kopie fiele erst im Browser auf.
 *
 * Form: `<Adresse der Musik-App>#/termin/<Termin-ID>/punkt/<ID des Ablaufpunkts>`. Der Punkt (nicht die Nummer des
 * Lieds) bleibt richtig, auch wenn jemand den Ablauf inzwischen umsortiert hat.
 */
const MUSTER = /^#\/termin\/(\d+)\/punkt\/(\d+)$/;

export function musikAppDirektLink(appAdresse: string, terminId: number, punktId: number): string {
  return `${appAdresse.replace(/#.*$/, '')}#/termin/${terminId}/punkt/${punktId}`;
}

/** Termin und Punkt aus `location.hash` – `null`, wenn die Adresse kein Direktlink ist. */
export function direktLinkAus(hash: string): { terminId: number; punktId: number } | null {
  const m = MUSTER.exec(hash);
  return m ? { terminId: Number(m[1]), punktId: Number(m[2]) } : null;
}
