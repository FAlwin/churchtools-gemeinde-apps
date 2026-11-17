/**
 * **Links in Hinweistexten** (Etappe F, Scheibe F5b; Klick-Runde 6: Knopf „Link“, nur `https`; Entwurf
 * `f5b-links-v1`, Variante A am 17.11.2026). Im Text steht ein Link als `[Linktext](https://…)` – so sieht die Leitung
 * im Baukasten genau, was gespeichert ist. Die EINE Stelle, die dieses Format kennt: Zerlegen für die Anzeige,
 * Einsetzen, Ändern, Entfernen und die Prüfung der Adresse.
 *
 * Sicherheit: Als Link gilt nur, was mit `https://` beginnt und sich als Adresse lesen lässt. Alles andere bleibt
 * Text – `javascript:` oder `http:` werden nie zu einem Link. Angezeigt wird über React, also ohne eigenes HTML.
 */

/**
 * Ein Link im Text: `[Linktext](Adresse)` – Linktext ohne `]` und Zeilenumbruch, Adresse ohne Leerzeichen. Ob die
 * Adresse taugt (nur `https`), entscheidet allein `adresseGueltig`.
 */
const LINK = /\[([^\]\n]{1,120})\]\(([^\s)]+)\)/g;

/** Ein Stück des Hinweistexts: Text oder Link. */
export type HinweisTeil =
  | { art: 'text'; text: string }
  | { art: 'link'; text: string; adresse: string };

/** Ein Link mit seiner Stelle im Text (für „ändern“ und „entfernen“). */
export interface HinweisLink {
  von: number;
  bis: number;
  text: string;
  adresse: string;
}

/** **Taugt die Adresse für einen Link?** Nur `https`, mit Rechnername (mindestens ein Punkt), ohne Leerzeichen. */
export function adresseGueltig(adresse: string): boolean {
  const a = adresse.trim();
  // Ohne Leerzeichen und Klammer – sonst ginge das Format `[Text](…)` kaputt. Das Protokoll prüft `URL` unten.
  if (!/^\S+$/.test(a) || a.includes(')')) return false;
  try {
    const u = new URL(a);
    return u.protocol === 'https:' && u.hostname.includes('.');
  } catch {
    return false;
  }
}

/** Die Links im Text, in ihrer Reihenfolge. Was nicht gültig ist (`adresseGueltig`), bleibt Text. */
export function hinweisLinks(text: string): HinweisLink[] {
  return [...text.matchAll(LINK)]
    .filter((m) => adresseGueltig(m[2]))
    .map((m) => ({ von: m.index, bis: m.index + m[0].length, text: m[1], adresse: m[2] }));
}

/** **Der Text in Stücken** – für die Anzeige im Formular. */
export function hinweisTeile(text: string): HinweisTeil[] {
  const teile: HinweisTeil[] = [];
  let pos = 0;
  for (const l of hinweisLinks(text)) {
    if (l.von > pos) teile.push({ art: 'text', text: text.slice(pos, l.von) });
    teile.push({ art: 'link', text: l.text, adresse: l.adresse });
    pos = l.bis;
  }
  if (pos < text.length) teile.push({ art: 'text', text: text.slice(pos) });
  return teile;
}

/** Was im Fenster stehen darf: Linktext ohne `]`/Umbruch, sonst ginge das Format kaputt. */
const linkText = (t: string) => t.replace(/[\]\n[]/g, ' ').trim();

/**
 * **Einen Link setzen** – über die Stelle `von`–`bis` (die Markierung oder ein vorhandener Link). Gibt den neuen Text
 * zurück; `null`, wenn die Adresse nicht taugt oder der Linktext leer ist.
 */
export function linkSetzen(
  text: string,
  von: number,
  bis: number,
  anzeige: string,
  adresse: string,
): string | null {
  const t = linkText(anzeige);
  if (!t || !adresseGueltig(adresse)) return null;
  return `${text.slice(0, von)}[${t}](${adresse.trim()})${text.slice(bis)}`;
}

/** **Einen Link entfernen** – der Linktext bleibt als Text stehen. */
export function linkEntfernen(text: string, l: HinweisLink): string {
  return `${text.slice(0, l.von)}${l.text}${text.slice(l.bis)}`;
}
