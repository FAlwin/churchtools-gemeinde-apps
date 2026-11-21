/**
 * **Kennzeichen einer Tabellenzeile** (W13, Alwin 21.11.2026): „nur zur Info“ und „Unterzeile“. BlockNote-Tabellenzeilen
 * haben keine eigenen Eigenschaften – darum stehen die Kennzeichen als **Text am Anfang der ersten Zelle** der Zeile
 * („ⓘ “ bzw. „↳ “), wie die Text-Aufzählung in der Zelle (W11, `zellenListe.ts`): Sie überstehen Verschieben und
 * Einfügen von Zeilen und brauchen kein neues Speicherformat. Editor, Lese-Ansicht und PDF erkennen sie am Präfix.
 *
 * Hier steht nur die Regel (reine Funktionen). **Die Reihenfolge steht an EINER Stelle: `praefix`** – erst „↳“, dann „ⓘ“
 * („↳ ⓘ 17.04.“).
 */

export const UNTER_ZEICHEN = '↳';
export const INFO_ZEICHEN = 'ⓘ';

/** Die Legende unter einer Tabelle mit Info-Zeilen – das Zeichen davor setzt jeder Ort selbst (Symbol, nicht Buchstabe). */
export const INFO_LEGENDE = 'nur zur Info – nicht Thema dieses Treffens';

export interface ZeilenArt {
  /** Zeile gehört zur Zeile darüber („↳ “). */
  unter: boolean;
  /** Zeile ist nur zur Information („ⓘ “). */
  info: boolean;
}

export const OHNE_ART: ZeilenArt = { unter: false, info: false };

export const hatArt = (a: ZeilenArt): boolean => a.unter || a.info;

/** Der Text vor dem Zelltext für diese Kennzeichen – die EINE Reihenfolge: „↳ “, dann „ⓘ “. */
export const praefix = (a: ZeilenArt): string =>
  `${a.unter ? `${UNTER_ZEICHEN} ` : ''}${a.info ? `${INFO_ZEICHEN} ` : ''}`;

const PRAEFIX = new RegExp(`^(${UNTER_ZEICHEN} )?(${INFO_ZEICHEN} )?`);

/** Die Kennzeichen am Anfang des Zelltextes und wie viele Zeichen sie belegen. */
export function artDesTextes(text: string): { art: ZeilenArt; laenge: number } {
  const m = PRAEFIX.exec(text);
  return { art: { unter: !!m?.[1], info: !!m?.[2] }, laenge: m?.[0].length ?? 0 };
}

/** Der Zelltext mit diesen Kennzeichen (die alten fallen weg). */
export const mitArt = (text: string, art: ZeilenArt): string =>
  praefix(art) + text.slice(artDesTextes(text).laenge);

/** Eines der beiden Kennzeichen umschalten – das andere bleibt. */
export function umschalten(text: string, welches: keyof ZeilenArt): string {
  const { art } = artDesTextes(text);
  return mitArt(text, { ...art, [welches]: !art[welches] });
}

type Stueck = { type?: unknown; text?: unknown; content?: unknown };

/** Die Textstücke am Anfang eines Zellinhalts (Links mit ihrem Text), in Lesereihenfolge. */
function textStuecke(inhalt: unknown): { text: string; setzen: (neu: string) => void }[] {
  const aus: { text: string; setzen: (neu: string) => void }[] = [];
  const sammle = (liste: unknown) => {
    if (!Array.isArray(liste)) return;
    for (const c of liste as Stueck[]) {
      if (c?.type === 'text' && typeof c.text === 'string') {
        const s = c as { text: string };
        aus.push({ text: s.text, setzen: (neu) => (s.text = neu) });
      } else if (c?.type === 'link') sammle(c.content);
    }
  };
  sammle(inhalt);
  return aus;
}

/**
 * **Die erste Zelle einer Zeile ohne ihre Kennzeichen** – für Lese-Ansicht und PDF, die sie als Symbol zeigen. Gibt die
 * Kennzeichen und den Inhalt ohne das Präfix zurück (eine Kopie; der Eingang bleibt, wie er ist). Das Präfix kann über
 * mehrere Textstücke gehen (Auszeichnung mitten im Zeichen).
 */
export function ohneKennzeichen(inhalt: unknown): { art: ZeilenArt; inhalt: unknown } {
  if (!Array.isArray(inhalt)) return { art: OHNE_ART, inhalt };
  const kopie: unknown = JSON.parse(JSON.stringify(inhalt));
  const stuecke = textStuecke(kopie);
  const { art, laenge } = artDesTextes(stuecke.map((s) => s.text).join(''));
  if (!laenge) return { art: OHNE_ART, inhalt };
  let rest = laenge;
  for (const s of stuecke) {
    if (rest <= 0) break;
    const weg = Math.min(rest, s.text.length);
    s.setzen(s.text.slice(weg));
    rest -= weg;
  }
  // Leer gewordene Textstücke weglassen – sonst bliebe ein leeres Stück mit Auszeichnung.
  const bereinigt = (kopie as Stueck[])
    .map((c) =>
      c?.type === 'link' && Array.isArray(c.content)
        ? {
            ...c,
            content: (c.content as Stueck[]).filter((t) => !(t?.type === 'text' && t.text === '')),
          }
        : c,
    )
    .filter(
      (c) =>
        !(c?.type === 'text' && c.text === '') &&
        !(c?.type === 'link' && Array.isArray(c.content) && c.content.length === 0),
    );
  return { art, inhalt: bereinigt };
}

/**
 * **Die Kennzeichen jeder Zeile einer Tabelle** (aus ihrer ersten Zelle) – `zellen` wie `tabellenZeilen` sie liefert.
 */
export function zeilenArten(zeilen: readonly (readonly { inhalt: unknown }[])[]): ZeilenArt[] {
  return zeilen.map((z) => (z[0] ? ohneKennzeichen(z[0].inhalt).art : OHNE_ART));
}

/** Wie viele Zeilen sind „nur zur Info“? */
export const anzahlInfo = (arten: readonly ZeilenArt[]): number =>
  arten.filter((a) => a.info).length;
