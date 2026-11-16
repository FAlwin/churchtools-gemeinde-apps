/**
 * **Das Formular „Gruppenwechsel einrichten / Stufen ändern“ als reine Rechnung** (Bauplan O9-5c-2, Entwurf
 * `o9-5-einrichten-v1`, Schritt „Stufen“) – ohne Oberfläche. Das Fenster hält Texte (so, wie jemand sie tippt: „30.09.“,
 * „8“ Wochen); hier wird daraus die `Einrichtung` und die Liste dessen, was nicht stimmt – **dieselbe Prüfung**, die auch
 * das Lesen der gespeicherten Einrichtung anwendet (`einrichtungFehlerJeFeld`), nicht eine zweite.
 *
 * Gespeichert wird in Tagen (`GRUNDWERTE`: 56 Tage = 8 Wochen), getippt in Wochen. Eine gespeicherte Zahl, die kein
 * Vielfaches von 7 ist (nur von Hand möglich), bleibt unverändert, solange das Feld nicht angefasst wird – sonst würde
 * „Stufen ändern“ stillschweigend die Ankündigung verschieben.
 */
import { einrichtungFehlerJeFeld, type Einrichtung } from './gruppenwechselEinrichtung';
import { GRUNDWERTE, type FehlerFeld, type Stufe } from './gruppenwechsel';

export interface StufeForm {
  /** `null`: noch keine Gruppe gewählt. */
  gruppeId: number | null;
  name: string;
  /** Wie getippt. */
  abAlter: string;
}

export interface Formular {
  /** `null`: noch keine Gruppe gewählt. */
  bereichGruppeId: number | null;
  stufen: StufeForm[];
  /** „30.09.“ */
  stichtag: string;
  ankuendigungWochen: string;
  aufnahmeTage: string;
  aufraeumenTage: string;
  ferienkalender: string;
  ferienStichwort: string;
  /** Die gespeicherte Ankündigung in Tagen – `null` beim ersten Einrichten (siehe oben). */
  ankuendigungTageAlt: number | null;
}

const zweistellig = (n: string | number) => String(n).padStart(2, '0');

/** `09-30` → „30.09.“ */
export const stichtagText = (mmtt: string): string => {
  const [mm, tt] = mmtt.split('-');
  return mm && tt ? `${tt}.${mm}.` : mmtt;
};

/**
 * „30.09.“ (auch „30.9“) → `09-30`. Was keine Tagesangabe ist, bleibt, wie es getippt wurde – `einstellungFehler` meldet
 * es dann als Stichtag, der kein Tag ist.
 */
export function stichtagAus(text: string): string {
  const m = /^\s*(\d{1,2})\.\s*(\d{1,2})\.?\s*$/.exec(text);
  return m ? `${zweistellig(m[2])}-${zweistellig(m[1])}` : text.trim();
}

/** Tage → Wochen fürs Feld: 56 → „8“; Tage, die keine ganzen Wochen sind, mit einer Nachkommastelle („8,5“ → `8.5`). */
export const wochenText = (tage: number): string =>
  Number.isInteger(tage / 7) ? String(tage / 7) : String(Math.round((tage / 7) * 10) / 10);

/**
 * Wochen (getippt) → Tage. Eine ganze Zahl ab 1 gibt `n * 7`. Wer das Feld nicht angefasst hat (`text` = Anzeige der
 * gespeicherten Tage), behält die gespeicherten Tage. Alles andere gibt `NaN` – `einstellungFehler` meldet das.
 */
export function wochenZuTage(text: string, tageAlt: number | null): number {
  const t = text.trim();
  if (tageAlt !== null && t === wochenText(tageAlt)) return tageAlt;
  const n = Number(t);
  return t !== '' && Number.isInteger(n) && n >= 1 ? n * 7 : NaN;
}

const zahl = (text: string): number => (text.trim() === '' ? NaN : Number(text));

/**
 * **Vorbelegung:** beim Ändern die gespeicherte Einrichtung, beim Einrichten `GRUNDWERTE` und zwei leere Zeilen (weniger
 * als zwei Gruppen gibt keinen Wechsel).
 */
export function formularAus(e: Einrichtung | null): Formular {
  const s = e?.einstellung ?? { ...GRUNDWERTE, stufen: [] as Stufe[] };
  return {
    bereichGruppeId: e?.bereichGruppeId ?? null,
    stufen:
      s.stufen.length > 0
        ? s.stufen.map((x) => ({ gruppeId: x.gruppeId, name: x.name, abAlter: String(x.abAlter) }))
        : [
            { gruppeId: null, name: '', abAlter: '' },
            { gruppeId: null, name: '', abAlter: '' },
          ],
    stichtag: stichtagText(s.stichtag),
    ankuendigungWochen: wochenText(s.ankuendigungTage),
    aufnahmeTage: String(s.aufnahmeTage),
    aufraeumenTage: String(s.aufraeumenTage),
    ferienkalender: s.ferienkalender,
    ferienStichwort: s.ferienStichwort,
    ankuendigungTageAlt: e ? s.ankuendigungTage : null,
  };
}

/**
 * **Aus dem Formular die Einrichtung (ohne Wechsel-Gruppen) und was nicht stimmt.** `einrichtung` ist auch dann da, wenn
 * es Fehler gibt (mit unfertigen Werten) – verwenden darf man sie nur ohne Fehler.
 */
export function einrichtungAusFormular(f: Formular): {
  einrichtung: Pick<Einrichtung, 'einstellung' | 'bereichGruppeId'>;
  fehler: { feld: FehlerFeld | 'bereich'; text: string }[];
} {
  const einrichtung = {
    bereichGruppeId: f.bereichGruppeId ?? 0,
    einstellung: {
      stufen: f.stufen.map((s) => ({
        gruppeId: s.gruppeId ?? 0,
        name: s.name,
        abAlter: zahl(s.abAlter),
      })),
      stichtag: stichtagAus(f.stichtag),
      ankuendigungTage: wochenZuTage(f.ankuendigungWochen, f.ankuendigungTageAlt),
      aufnahmeTage: zahl(f.aufnahmeTage),
      aufraeumenTage: zahl(f.aufraeumenTage),
      ferienkalender: f.ferienkalender,
      ferienStichwort: f.ferienStichwort,
    },
  };
  return { einrichtung, fehler: einrichtungFehlerJeFeld(einrichtung) };
}
