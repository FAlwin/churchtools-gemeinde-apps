/**
 * **Speichern, eins nach dem anderen** (Bauplan Website W3a-2). Der Editor speichert nach jeder Änderung die ganze Seite;
 * der Speicher kennt keine Versionen (`speicher.ts`) – liefen zwei Speicherungen derselben Seite gleichzeitig, gewänne die
 * spätere beim Umstellen des Kopfes, nicht unbedingt die neuere. Darum gilt:
 *
 * - **Nie zwei gleichzeitig.** Kommt während einer Speicherung eine neue Änderung, wartet sie; danach wird **nur der
 *   neueste Stand** gespeichert (jeder Stand enthält ja alle früheren Änderungen) – keine Warteschlange von Zwischenständen.
 * - **Ein Fehler zerstört nichts.** Scheitert eine Speicherung (Netz, 502/504, kein Recht), bleibt der Stand **erhalten**
 *   (`nochmal()` versucht es erneut, eine weitere Änderung ebenfalls). Die Schlange verwirft nie etwas.
 * - **Abgewiesen** (`gesperrt`, `veraendert`): Jemand anderes bearbeitet die Seite oder hat sie inzwischen geändert. Nichts
 *   wird geschrieben (sonst gingen seine Änderungen still verloren), der Stand bleibt ebenfalls erhalten.
 *
 * Rein (kein React, keine Uhr): Der Editor bindet sie an seinen Zustand, die Tests steuern die Versprechen von Hand.
 */
export type SpeicherAusgang = { art: 'ok' } | { art: 'gesperrt' } | { art: 'veraendert' };

export type SchlangenStand =
  | { art: 'gespeichert' }
  | { art: 'speichert' }
  /** Etwas ging schief – `fehler` ist das, was geworfen wurde (der Editor macht daraus eine Meldung). */
  | { art: 'fehler'; fehler: unknown }
  | { art: 'gesperrt' }
  | { art: 'veraendert' };

export class Speicherschlange<T> {
  private ausstehend: { wert: T } | null = null;
  private laeuft = false;

  constructor(
    private readonly speichern: (wert: T) => Promise<SpeicherAusgang>,
    private readonly beiStand: (stand: SchlangenStand) => void,
  ) {}

  /** Läuft etwas, oder wartet etwas (auch ein gescheiterter Stand, der noch nicht gespeichert ist)? */
  get offen(): boolean {
    return this.laeuft || this.ausstehend !== null;
  }

  /** Läuft gerade eine Speicherung? (Anders als `offen`: ein gescheiterter, wartender Stand zählt nicht.) */
  get aktiv(): boolean {
    return this.laeuft;
  }

  /** Dieser Stand soll gespeichert werden. Ein früherer, noch wartender Stand ist damit überholt. */
  anfordern(wert: T): void {
    this.ausstehend = { wert };
    if (!this.laeuft) void this.lauf();
  }

  /**
   * Den wartenden (nicht gespeicherten) Stand bewusst wegwerfen – nur, wenn der Mensch es will („Neu laden“, weil jemand
   * anderes die Seite geändert hat). Eine laufende Speicherung bleibt unberührt.
   */
  verwerfen(): void {
    this.ausstehend = null;
  }

  /** „Erneut versuchen“: den Stand speichern, der nicht angekommen ist. */
  nochmal(): void {
    if (this.ausstehend && !this.laeuft) void this.lauf();
  }

  private async lauf(): Promise<void> {
    this.laeuft = true;
    try {
      while (this.ausstehend) {
        const dran = this.ausstehend;
        this.ausstehend = null;
        this.beiStand({ art: 'speichert' });
        let ausgang: SpeicherAusgang;
        try {
          ausgang = await this.speichern(dran.wert);
        } catch (fehler) {
          // Vorübergehend ist nicht ungültig: Der Stand bleibt, es sei denn, ein neuerer ist schon da.
          this.ausstehend ??= dran;
          this.beiStand({ art: 'fehler', fehler });
          return;
        }
        if (ausgang.art !== 'ok') {
          this.ausstehend ??= dran;
          this.beiStand({ art: ausgang.art });
          return;
        }
      }
      this.beiStand({ art: 'gespeichert' });
    } finally {
      this.laeuft = false;
    }
  }
}
