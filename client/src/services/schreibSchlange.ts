/**
 * **Die Speicher-Warteschlange** – EIN Baustein für Anmerkungen und Lied-Einstellungen (#846).
 *
 * Bis zum 05.11.2026 gab es sie zweimal, von Hand gebaut, in `annotations.ts` und `userSettings.ts`. Jede Lehre
 * musste zweimal eingebaut werden und wurde es auch – aber immer erst, nachdem sie an der zweiten Stelle Daten
 * gekostet hatte (#213 → #245, #193/#256 → #275). Hier liegt jetzt alles, was beide gleich machen:
 *
 * - **Verzögern und bündeln** (`VERZOEGERUNG_MS`): Viele schnelle Änderungen werden ein Upload.
 * - **Merker über den Neustart** (`pendingKeys.ts`, #256/#275): Was noch nicht oben ist, steht im localStorage.
 * - **Schutz vor dem Abgleich** (`schutz`): Ein Schlüssel, dessen Upload aussteht oder gerade läuft, darf vom
 *   (älteren) Server-Stand nicht überschrieben werden (#275).
 * - **Nichts verwerfen bei vorübergehenden Fehlern** (#213/#245): zurücklegen, neuere Werte gewinnen, nach
 *   `WIEDERHOLEN_MS` erneut – aber nur, wenn der Server erreichbar ist, sonst funkt die App offline ins Leere.
 * - **Die Fehlerzweige** (`fehlerBewerten`): fehlendes Recht in der Extension und 401 schalten ab, 413 ist
 *   endgültig und wird gemeldet. Dieselbe Bewertung nutzen auch Abgleich und Migration der beiden Dienste.
 * - **Sofort abschicken beim Weglegen der App** (`jetztAbschicken`, #193/#275): iOS friert die Timer sonst ein.
 *
 * Was die Dienste selbst behalten: den Transport (Server oder Personen-Ablage) und was ein Wert ist. Die
 * Einstellungen gehen **gebündelt** in einem Upload, die Anmerkungen **je Seite** (`buendeln`).
 */
import { ApiError } from './api';
import { KeinSpeicherRecht } from './ctRuntime';
import { getReachable } from './reachability';
import type { PendingKeys } from './pendingKeys';

export const VERZOEGERUNG_MS = 600;
export const WIEDERHOLEN_MS = 5000;

/** Wie ein Fehler beim Holen oder Schreiben zu behandeln ist. */
export type Fehlerart = 'kein-recht' | 'abgemeldet' | 'zu-gross' | 'voruebergehend';

export interface SchreibSchlangeOptionen<V> {
  /** Merker im localStorage – überlebt das Schließen der App. */
  merker: PendingKeys;
  /** Ein Stapel geht hoch. Muss bei einem Fehlschlag WERFEN – ein stiller Fehlschlag gilt als Erfolg. */
  schreiben: (stapel: Map<string, V>, keepalive: boolean) => Promise<unknown>;
  /** `alle`: ein Upload für alle Schlüssel (Einstellungen); `je-schluessel`: einer je Schlüssel (Anmerkungen). */
  buendeln: 'alle' | 'je-schluessel';
  /**
   * Ein fehlgeschlagener Wert kommt zurück, während schon ein neuerer wartet. Vorgabe: der neuere gewinnt ganz.
   * Die Anmerkungen ergänzen feldweise, was im neueren fehlt (#245).
   */
  zusammenfuehren?: (neuer: V, fehlgeschlagen: V) => V;
  /** Meldung an die Person (Toast) – bei fehlendem Recht und bei 413. */
  melden: (meldung: string) => void;
}

export interface SchreibSchlange<V> {
  /** Den ausstehenden Wert eines Schlüssels ändern; die Verzögerung beginnt neu. */
  vormerken(key: string, aendern: (bisher: V | undefined) => V): void;
  /** Beim Start: nachzuholenden Wert einreihen, ohne Verzögerung (danach `abschicken`). */
  einreihen(key: string, wert: V): void;
  /** Alles Ausstehende jetzt hochladen, nacheinander. */
  abschicken(): Promise<void>;
  /** Alles Ausstehende sofort abschicken, mit `keepalive` – beim Weglegen der App. */
  jetztAbschicken(): void;
  /** Welche Schlüssel der Abgleich NICHT überschreiben darf. Liest den Merker einmal – je Abgleich aufrufen. */
  schutz(): (key: string) => boolean;
  /** Einen Fehler einordnen und die Folgen ziehen (abschalten, melden). Der Aufrufer entscheidet den Ablauf. */
  fehlerBewerten(e: unknown): Fehlerart;
  /** Abgeschaltet (nicht angemeldet, Recht fehlt) – dann bleibt alles lokal. */
  istAus(): boolean;
  /** Nach jeder erfolgreichen Anmeldung wieder einschalten (#211). */
  einschalten(): void;
}

export function erstelleSchreibSchlange<V>(o: SchreibSchlangeOptionen<V>): SchreibSchlange<V> {
  const zusammenfuehren = o.zusammenfuehren ?? ((neuer: V) => neuer);
  const ausstehend = new Map<string, V>();
  // Schlüssel, deren Upload gerade LÄUFT – solange darf ein paralleler Abgleich sie nicht mit dem (noch alten)
  // Server-Stand überschreiben. Früher wurde die Warteschlange VOR dem Request geleert, ein gleichzeitig laufender
  // Abgleich sah also nichts und drehte die frische Änderung zurück (#275).
  const laeuft = new Set<string>();
  const timer = new Map<string, ReturnType<typeof setTimeout>>();
  let aus = false;

  const gruppeVon = (key: string) => (o.buendeln === 'alle' ? '' : key);

  function fehlerBewerten(e: unknown): Fehlerart {
    if (e instanceof KeinSpeicherRecht) {
      // Ein Recht fehlt dauerhaft (nur Extension, #334): abschalten und SAGEN warum – sonst arbeitete jemand
      // weiter und wunderte sich auf dem nächsten Gerät. Die Merker bleiben, mit dem Recht wird es nachgeholt.
      aus = true;
      o.melden(e.message);
      return 'kein-recht';
    }
    if (e instanceof ApiError && e.status === 401) {
      aus = true;
      return 'abgemeldet';
    }
    if (e instanceof ApiError && e.status === 413) {
      // Konto-Obergrenze: Ein erneuter Versuch scheiterte genauso. Sagen, was los ist – lokal bleibt es erhalten.
      o.melden(e.message);
      return 'zu-gross';
    }
    return 'voruebergehend';
  }

  function zuruecklegen(stapel: Map<string, V>): void {
    for (const [k, v] of stapel) {
      const neuer = ausstehend.get(k);
      ausstehend.set(k, neuer === undefined ? v : zusammenfuehren(neuer, v));
    }
  }

  function planen(gruppe: string, ms: number): void {
    const t = timer.get(gruppe);
    if (t) clearTimeout(t);
    timer.set(
      gruppe,
      setTimeout(() => void hochladen(gruppe, false), ms),
    );
  }

  async function hochladen(gruppe: string, keepalive: boolean): Promise<void> {
    timer.delete(gruppe);
    // Abgeschaltet: liegen lassen, nicht verwerfen – nach dem Wieder-Einschalten geht es mit hoch.
    if (aus) return;
    const stapel = new Map([...ausstehend].filter(([k]) => gruppeVon(k) === gruppe));
    if (stapel.size === 0) return;
    for (const k of stapel.keys()) {
      ausstehend.delete(k);
      laeuft.add(k);
    }
    try {
      await o.schreiben(stapel, keepalive);
      // Durch – der Merker darf weg. Aber nicht, wenn inzwischen schon wieder etwas geändert wurde: Dann trägt er
      // die NEUE Änderung über einen Neustart, und ohne ihn wäre sie still weg.
      for (const k of stapel.keys()) if (!ausstehend.has(k)) o.merker.unmark(k);
    } catch (e) {
      const art = fehlerBewerten(e);
      // Kein Recht: nichts verwerfen, der Merker trägt es zum nächsten Start. Abgemeldet: der Merker trägt es.
      if (art === 'kein-recht') zuruecklegen(stapel);
      if (art === 'kein-recht' || art === 'abgemeldet') return;
      if (art === 'zu-gross') {
        // Endgültig – sonst versuchte es jeder Start erneut (#256).
        for (const k of stapel.keys()) if (!ausstehend.has(k)) o.merker.unmark(k);
        return;
      }
      // Netz-/Serverfehler: zurücklegen, sonst ist die Änderung weg (#213/#245). Die Merker bleiben stehen.
      zuruecklegen(stapel);
      // Nur erneut ansetzen, wenn der Server grundsätzlich erreichbar ist – sonst wartet es auf die nächste
      // Änderung bzw. aufs Weglegen der App, statt offline alle paar Sekunden vergeblich zu funken.
      if (getReachable() && !timer.has(gruppe)) planen(gruppe, WIEDERHOLEN_MS);
    } finally {
      for (const k of stapel.keys()) laeuft.delete(k);
    }
  }

  const gruppen = () => [...new Set([...ausstehend.keys()].map(gruppeVon))];

  return {
    vormerken(key, aendern) {
      if (aus) return;
      ausstehend.set(key, aendern(ausstehend.get(key)));
      o.merker.mark(key); // übersteht das Schließen der App (#256/#275)
      planen(gruppeVon(key), VERZOEGERUNG_MS);
    },
    einreihen(key, wert) {
      ausstehend.set(key, wert);
    },
    async abschicken() {
      for (const g of gruppen()) await hochladen(g, false);
    },
    jetztAbschicken() {
      for (const t of timer.values()) clearTimeout(t);
      timer.clear();
      for (const g of gruppen()) void hochladen(g, true);
    },
    schutz() {
      const gemerkt = o.merker.read();
      return (key) => ausstehend.has(key) || laeuft.has(key) || gemerkt.has(key);
    },
    fehlerBewerten,
    istAus: () => aus,
    einschalten() {
      aus = false;
    },
  };
}
