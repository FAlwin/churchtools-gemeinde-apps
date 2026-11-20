/**
 * **Die Schreibsperre** – „eine Person bearbeitet, alle anderen sehen nur zu“. Entstanden in den Protokollen (S4-1) und
 * seit der Website (W3a-2) von beiden benutzt; hier steht nur die Regel, **wo** die Sperre gespeichert wird, entscheidet
 * jede Erweiterung selbst (Protokolle: im Kopf der Sitzung, Website: ein eigener Wert je Seite).
 *
 * - Eine Sperre gilt höchstens `SPERRE_MINUTEN` ohne Lebenszeichen – verlässt jemand die Seite, ohne sie freizugeben
 *   (Akku leer, Netz weg), bleibt niemand ewig ausgesperrt.
 * - Dieselbe Person in zwei Fenstern sperrt sich selbst: Sonst überschriebe das eine Fenster still, was das andere gerade
 *   gespeichert hat (der Speicher kennt keine Versionen).
 */

/** Wer gerade schreibt (eine Person schreibt, alle lesen). */
export interface Sperre {
  von: number;
  name: string;
  /** ISO-Zeit des letzten Lebenszeichens. */
  seit: string;
  /**
   * Kennung des Editor-Fensters (S4-1). Dieselbe Person in zwei Fenstern oder auf zwei Geräten sperrt sich gegenseitig
   * – sonst überschriebe das eine Fenster still, was das andere gerade gespeichert hat. Fehlt sie (ältere Werte),
   * ist die Sperre für jedes Fenster fremd.
   */
  fenster?: string;
}

/** Wer schreiben will: Person, Name für die Anzeige („Alwin schreibt gerade“) und das eigene Fenster. */
export interface Schreiber {
  person: number;
  name: string;
  fenster: string;
}

/** Nach so vielen Minuten ohne Lebenszeichen gilt eine Schreibsperre als verlassen. */
export const SPERRE_MINUTEN = 10;

/**
 * Darf ich schreiben? `frei` = niemand (oder die Sperre ist verlassen), `meine` = dieses Fenster, `fremd` = jemand
 * anderes – oder ich selbst in einem anderen Fenster (`sperre.von === ich.person` unterscheidet das für die Anzeige).
 */
export function sperreLage(
  sperre: Sperre | null,
  ich: Pick<Schreiber, 'person' | 'fenster'>,
  jetzt: Date,
): 'frei' | 'meine' | 'fremd' {
  if (!sperre) return 'frei';
  const alter = jetzt.getTime() - new Date(sperre.seit).getTime();
  if (!Number.isFinite(alter) || alter > SPERRE_MINUTEN * 60_000) return 'frei';
  return sperre.von === ich.person && sperre.fenster === ich.fenster ? 'meine' : 'fremd';
}

/** Die Sperre dieses Fensters, Lebenszeichen jetzt. */
export function sperreVon(ich: Schreiber, jetzt: Date): Sperre {
  return { von: ich.person, name: ich.name, seit: jetzt.toISOString(), fenster: ich.fenster };
}
