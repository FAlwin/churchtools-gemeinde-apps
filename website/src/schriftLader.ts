/**
 * **Schriften in die Vorschau laden** (Bauplan Website W3a-3, E-W15). Das Vorschau-Fenster hat keinen Ursprung, von dem es eine
 * Datei holen könnte (`vorschauHtml.ts`), und erbt die Regeln von ChurchTools: Schriften dürfen als **`data:`-Adresse**
 * kommen (gemessen 20.11.2026, `font-src … data:`). Darum kommt jede Schrift als eigener, **nachgeladener Teil** des Bündels,
 * der die Datei als `data:font/woff2;base64,…` liefert (`?inline` – Vite macht daraus eine Base64-Adresse, Dokumentation
 * „Explicit Inline Handling“).
 *
 * - **Nur die gewählten Schriften werden geladen**, nicht alle 14: Das Haupt-Bündel enthält keine Schrift, jede Datei ist ein
 *   eigener Teil (`import.meta.glob` ohne `eager`: ein Teil je Datei). Die Tabelle entsteht aus dem Ordner
 *   `shared/website/schriften/` – eine Quelle mit dem Bau-Dienst (W5); ein Wächter-Test (`schriftdateien.test.ts`) hält Liste
 *   und Ordner zusammen.
 * - **Doppel-Ladeschutz:** Wer eine Schrift anfordert, während sie schon lädt, wartet auf denselben Versuch.
 * - **Ein Ladefehler ist vorübergehend** (Netz, ChurchTools liefert einen Teil gerade nicht aus): Er wird **nicht** als
 *   „kaputt“ gemerkt – es gibt nur einen leisen Hinweis, die Vorschau zeigt die Ersatzschrift, und der **nächste Bedarf**
 *   (andere Wahl, erneutes Öffnen, „Erneut laden“) versucht es wieder. Nichts wird gespeichert oder verworfen.
 * - Eigene Schriften (`art: 'eigene'`) kommen mit W4; bis dahin gibt es für sie keine Adresse (Ersatzschrift).
 */

/** Liefert die Schriftdatei als `data:`-Adresse. */
export type Lader = () => Promise<string>;

/** Die Lade-Tabelle: Dateiname (wie `datei` in `schriften.ts`) → Lader. Aus dem Ordner der Schriftdateien. */
export function ladeTabelle(
  glob: Record<string, () => Promise<unknown>>,
): Record<string, Lader> {
  const tabelle: Record<string, Lader> = {};
  for (const [pfad, laden] of Object.entries(glob)) {
    const datei = pfad.split('/').pop() ?? pfad;
    tabelle[datei] = async () => {
      const adresse = await laden();
      if (typeof adresse !== 'string' || !adresse.startsWith('data:'))
        throw new Error(`Die Schrift ${datei} kam nicht als data:-Adresse an.`);
      return adresse;
    };
  }
  return tabelle;
}

export const SCHRIFT_LADER: Record<string, Lader> = ladeTabelle(
  import.meta.glob('@shared/website/schriften/*.woff2', { query: '?inline', import: 'default' }),
);

/** Die Adresse, solange eine Schrift nicht da ist: leer – der Browser nimmt die Ersatzschrift. */
export const KEINE_SCHRIFT = 'data:,';

/**
 * Der Zwischenspeicher: geladene Adressen, laufende Versuche, gescheiterte Dateien (nur für den Hinweis). Kein React – die
 * Oberfläche hängt sich per `abonnieren` an (`useSchriften`), die Tests steuern die Lader von Hand.
 */
export class Schriftspeicher {
  private readonly fertig = new Map<string, string>();
  private readonly laeuft = new Map<string, Promise<void>>();
  private readonly gescheitert = new Set<string>();
  private readonly hoerer = new Set<() => void>();
  private stand = 0;

  constructor(private readonly lader: Record<string, Lader>) {}

  /** Die geladene Adresse – `undefined`, solange sie nicht da ist (oder es sie nicht gibt). */
  adresse(datei: string): string | undefined {
    return this.fertig.get(datei);
  }

  /** Ist der letzte Versuch für diese Datei gescheitert? (Nur für den leisen Hinweis – gemerkt wird es nicht.) */
  gescheitertFuer(datei: string): boolean {
    return this.gescheitert.has(datei);
  }

  /** Eine Zahl, die sich bei jeder Änderung erhöht (für `useSyncExternalStore`). */
  schnappschuss = (): number => this.stand;

  abonnieren = (fn: () => void): (() => void) => {
    this.hoerer.add(fn);
    return () => this.hoerer.delete(fn);
  };

  private geaendert() {
    this.stand++;
    for (const h of [...this.hoerer]) h();
  }

  /**
   * Diese Dateien werden gebraucht: Was nicht da ist und nicht gerade lädt, wird geladen. Was es nicht gibt (eigene
   * Schriften), wird übergangen. **Jeder Aufruf versucht auch Gescheitertes noch einmal** – das ist der „nächste Bedarf“.
   */
  anfordern(dateien: readonly string[]): void {
    for (const datei of new Set(dateien)) {
      const laden = this.lader[datei];
      if (!laden || this.fertig.has(datei) || this.laeuft.has(datei)) continue;
      this.gescheitert.delete(datei);
      const versuch = (async () => {
        try {
          this.fertig.set(datei, await laden());
        } catch (e) {
          // Vorübergehend ist nicht ungültig: nur merken, damit der Hinweis erscheint – keine Sperre für spätere Versuche.
          this.gescheitert.add(datei);
          console.warn('Website: Schrift konnte nicht geladen werden', datei, e);
        } finally {
          this.laeuft.delete(datei);
          this.geaendert();
        }
      })();
      this.laeuft.set(datei, versuch);
    }
  }
}

/** Der Zwischenspeicher der Erweiterung – er bleibt beim Wechsel der Reiter erhalten. */
export const schriftspeicher = new Schriftspeicher(SCHRIFT_LADER);
