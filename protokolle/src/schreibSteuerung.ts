/**
 * **Wann gespeichert wird** (Bauplan S4-1; Alwin 24.10.2026: automatisch, Sperre erst beim Tippen). Ohne Oberfläche und
 * ohne ChurchTools – beides wird hereingereicht –, damit sich die Zeitregeln mit Fake-Timern prüfen lassen:
 *
 * - **Erste Änderung** → sofort die Sperre nehmen (andere sehen schnell „schreibt gerade“) und speichern.
 * - Danach **`PAUSE_MS` nach der letzten Eingabe** speichern; es läuft nie mehr als ein Speichern gleichzeitig, kommt
 *   währenddessen etwas dazu, folgt gleich das nächste.
 * - **Fehler** (Netz, 5xx, nicht nachgelesen) → „nicht gespeichert“ bleibt sichtbar, nach `ERNEUT_MS` neuer Versuch;
 *   nichts wird verworfen. **Abgewiesen** (fremde Sperre, anderer Stand, freigegeben) → nicht mehr speichern, die
 *   Oberfläche zeigt warum; die eigenen ungespeicherten Änderungen bleiben im Editor sichtbar.
 */
import type { Block } from '@shared/protokolle/dokument';
import type { ProtokollKopf, Sperre } from '@shared/protokolle/speicher';
import type { SchreibErgebnis } from './schreiben';

export const PAUSE_MS = 3_000;
export const ERNEUT_MS = 10_000;

export type Lage =
  /** Niemand schreibt; dieses Fenster darf beginnen. */
  | 'frei'
  /** Dieses Fenster hält die Sperre. */
  | 'schreibe'
  | 'gesperrt'
  | 'fest'
  | 'weg'
  | 'veraendert';

export interface SteuerZustand {
  lage: Lage;
  /** Gibt es Änderungen, die noch nicht gespeichert sind? */
  offen: boolean;
  speichert: boolean;
  /** Zeit des letzten erfolgreichen Speicherns. */
  zuletzt: Date | null;
  /** Meldung des letzten gescheiterten Versuchs – `null`, sobald einer klappt. */
  fehler: string | null;
  /** Wer gerade schreibt, wenn `lage` = `gesperrt`. */
  sperre: Sperre | null;
}

export interface Anschluss {
  sperreNehmen(basisStand: string): Promise<SchreibErgebnis>;
  speichern(basisStand: string, dokument: Block[]): Promise<SchreibErgebnis>;
  /** Das Dokument, wie es gerade im Editor steht. */
  dokument(): Block[];
  jetzt(): Date;
}

export class SchreibSteuerung {
  private z: SteuerZustand;
  private stand: string;
  private uhr: ReturnType<typeof setTimeout> | null = null;
  private lauf: Promise<void> | null = null;
  private nochmal = false;
  private hoerer = new Set<(z: SteuerZustand) => void>();

  constructor(
    private a: Anschluss,
    kopf: Pick<ProtokollKopf, 'stand'>,
    lage: Lage = 'frei',
    sperre: Sperre | null = null,
  ) {
    this.stand = kopf.stand;
    this.z = { lage, offen: false, speichert: false, zuletzt: null, fehler: null, sperre };
  }

  get zustand(): SteuerZustand {
    return this.z;
  }

  /** Der Stand, auf dem dieses Fenster aufsetzt (zuletzt geladen oder gespeichert). */
  get basisStand(): string {
    return this.stand;
  }

  abonnieren(f: (z: SteuerZustand) => void): () => void {
    this.hoerer.add(f);
    return () => this.hoerer.delete(f);
  }

  private setze(teil: Partial<SteuerZustand>): void {
    this.z = { ...this.z, ...teil };
    for (const f of this.hoerer) f(this.z);
  }

  /** Von außen neu aufsetzen: nach Übernehmen, Neu-Laden oder wenn die fremde Sperre verfallen ist. */
  neuAufsetzen(kopf: Pick<ProtokollKopf, 'stand'>, lage: Lage, sperre: Sperre | null = null): void {
    this.stoppen();
    this.stand = kopf.stand;
    this.setze({ lage, sperre, offen: false, fehler: null });
  }

  /** Der Text hat sich durch eine Eingabe geändert. */
  geaendert(): void {
    this.setze({ offen: true });
    this.planen(this.z.lage === 'frei' ? 0 : PAUSE_MS);
  }

  private planen(ms: number): void {
    if (this.uhr) clearTimeout(this.uhr);
    this.uhr = setTimeout(() => {
      this.uhr = null;
      void this.starten();
    }, ms);
  }

  private starten(): Promise<void> {
    if (this.lauf) {
      this.nochmal = true;
      return this.lauf;
    }
    this.lauf = this.speichernLauf().finally(() => {
      this.lauf = null;
      if (this.nochmal && this.z.offen && this.z.lage === 'schreibe') {
        this.nochmal = false;
        void this.starten();
      }
      this.nochmal = false;
    });
    return this.lauf;
  }

  private abgewiesen(r: Exclude<SchreibErgebnis, { art: 'ok' }>): void {
    this.setze({
      lage: r.art,
      sperre: r.art === 'gesperrt' ? r.sperre : null,
      speichert: false,
    });
  }

  private async speichernLauf(): Promise<void> {
    if (!this.z.offen || (this.z.lage !== 'frei' && this.z.lage !== 'schreibe')) return;
    this.setze({ speichert: true });
    try {
      if (this.z.lage === 'frei') {
        const r = await this.a.sperreNehmen(this.stand);
        if (r.art !== 'ok') return this.abgewiesen(r);
        this.setze({ lage: 'schreibe', sperre: null });
      }
      // Ab hier zählt, was bis jetzt im Editor steht; spätere Eingaben machen `offen` wieder wahr.
      this.setze({ offen: false });
      const r = await this.a.speichern(this.stand, this.a.dokument());
      if (r.art !== 'ok') {
        this.setze({ offen: true });
        return this.abgewiesen(r);
      }
      this.stand = r.kopf.stand;
      this.setze({ speichert: false, zuletzt: this.a.jetzt(), fehler: null });
    } catch (e) {
      // Vorübergehend ist nicht ungültig: nichts verwerfen, erneut versuchen.
      this.setze({
        offen: true,
        speichert: false,
        fehler: e instanceof Error ? e.message : String(e),
      });
      if (!this.uhr) this.planen(ERNEUT_MS);
    }
  }

  /**
   * **Jetzt speichern** (Zurück, Fenster schließen) – wartet ein laufendes Speichern ab. `true`, wenn danach nichts
   * mehr offen ist.
   */
  async jetzt(): Promise<boolean> {
    if (this.uhr) {
      clearTimeout(this.uhr);
      this.uhr = null;
    }
    if (this.lauf) await this.lauf;
    if (this.z.offen) await this.starten();
    return !this.z.offen;
  }

  /** Keine weiteren Versuche (Editor wird geschlossen). */
  stoppen(): void {
    if (this.uhr) clearTimeout(this.uhr);
    this.uhr = null;
  }
}
