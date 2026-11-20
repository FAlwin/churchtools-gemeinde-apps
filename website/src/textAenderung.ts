/**
 * **Text, direkt in der Vorschau getippt → Änderung am Seitenmodell** (Bauplan Website W3c-1). Rein: Die Ebene im iframe schickt
 * den getippten Text (`nachricht.ts`, Form geprüft), hier wird daraus die neue Seite – oder eine Meldung, warum nicht.
 *
 * - **Welche Felder tippbar sind** (`textFeldGueltig`): Überschrift und Akzentzeile (`text`), Text und Bild+Text (`markdown`), die
 *   Beschriftung eines Knopfes (`knopf`, `n` = welcher). **Alles andere nie** – vor allem nicht „Eigenes HTML“: Die Ebene bietet es
 *   nicht an, und der Rahmen nähme eine Nachricht dazu auch nicht an (`nachricht.ts` prüft dasselbe).
 * - **Markdown entsteht nur hier** (`markdownAusBloecken`, die EINE Stelle für den Rückweg samt Escape). Davor die Probe, ob sich die
 *   Formatierung eindeutig schreiben lässt (`formatierungEindeutig`), danach die **Gegenprobe**: Zeigt das Markdown nicht genau
 *   den getippten Text, wird nichts übernommen – kein stilles Verfälschen.
 * - Das Schema (`seiteSchema`) prüft der Aufrufer vor dem Übernehmen (`seitePruefen` in `Seitenarbeit`).
 */
import {
  formatierungEindeutig,
  markdownAusBloecken,
  markdownSichtbarerText,
  type TextBlock,
} from '@shared/website/markdown';
import { bausteinDa, bausteinErsetzen } from '@shared/website/bearbeiten';
import type { Baustein, Seite } from '@shared/website/modell';

export type TextFeld = 'text' | 'markdown' | 'knopf';

/** Das Feld eines Bausteins, das getippt werden darf – `false` für alles andere. */
export function textFeldGueltig(b: Baustein | undefined, feld: TextFeld, n: number): boolean {
  if (!b) return false;
  switch (b.typ) {
    case 'ueberschrift':
    case 'akzentzeile':
      return feld === 'text' && n === 0;
    case 'text':
    case 'bildText':
      return feld === 'markdown' && n === 0;
    case 'knoepfe':
      return feld === 'knopf' && Number.isInteger(n) && n >= 0 && n < b.knoepfe.length;
    default:
      return false; // vor allem „Eigenes HTML“ – nie tippbar
  }
}

export interface TextAenderung {
  i: number;
  j: number;
  k: number;
  feld: TextFeld;
  n: number;
  /** Reiner Text (Überschrift, Akzentzeile, Knopf). */
  wert?: string;
  /** Text mit Auszeichnung (Text, Bild+Text). */
  bloecke?: TextBlock[];
}

export type TextErgebnis = { ok: true; seite: Seite } | { ok: false; meldung: string };

const ohneLeerraum = (t: string) => t.replace(/\s+/g, '');

/** Die neue Seite mit dem getippten Text – oder eine Meldung. */
export function textUebernehmen(seite: Seite, m: TextAenderung): TextErgebnis {
  if (!bausteinDa(seite, m.i, m.j, m.k))
    return { ok: false, meldung: 'Diesen Baustein gibt es nicht mehr.' };
  const b = seite.abschnitte[m.i].spalten[m.j].bausteine[m.k];
  if (!textFeldGueltig(b, m.feld, m.n))
    return { ok: false, meldung: 'Dieser Baustein lässt sich nicht direkt im Text ändern.' };

  let neu: Baustein;
  if (m.feld === 'markdown') {
    if (!m.bloecke || m.wert !== undefined)
      return { ok: false, meldung: 'Der Text ist nicht angekommen.' };
    if (!formatierungEindeutig(m.bloecke)) {
      return {
        ok: false,
        meldung:
          'Zwei unterschiedliche Formatierungen direkt nebeneinander (ohne Leerzeichen dazwischen, zum Beispiel kursiv neben fett) lassen sich im Text nicht speichern. Der Text bleibt, wie er war – bitte ein Leerzeichen dazwischen setzen.',
      };
    }
    const markdown = markdownAusBloecken(m.bloecke);
    const getippt = ohneLeerraum(
      m.bloecke.map((bl) => bl.laeufe.map((l) => l.t).join('')).join(''),
    );
    if (ohneLeerraum(markdownSichtbarerText(markdown)) !== getippt) {
      return {
        ok: false,
        meldung:
          'Dieser Text lässt sich so nicht genau speichern. Er bleibt, wie er war – bitte etwas einfacher formatieren.',
      };
    }
    neu = { ...(b as Extract<Baustein, { typ: 'text' | 'bildText' }>), markdown };
  } else {
    if (m.wert === undefined || m.bloecke !== undefined)
      return { ok: false, meldung: 'Der Text ist nicht angekommen.' };
    const wert = m.wert.replace(/\s+/g, ' ').trim();
    if (b.typ === 'knoepfe') {
      neu = { ...b, knoepfe: b.knoepfe.map((kn, n) => (n === m.n ? { ...kn, text: wert } : kn)) };
    } else {
      neu = { ...(b as Extract<Baustein, { typ: 'ueberschrift' | 'akzentzeile' }>), text: wert };
    }
  }
  return { ok: true, seite: bausteinErsetzen(seite, m.i, m.j, m.k, neu) };
}
