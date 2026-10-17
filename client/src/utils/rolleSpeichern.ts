/**
 * **Was auf der Rolle gemalt wird, auf den A4-Seiten speichern** (#608).
 *
 * Die Anmerkungen leben auf den A4-Seiten (#614). Gemalt wird auf der Rolle in einem **Entwurf**: einer
 * Leinwand und einer Textliste in Rollen-Koordinaten, die beim Start aus den KERNEN der A4-Seiten
 * zusammengesetzt werden. Jede Änderung geht von hier zurück auf die A4-Seiten – Kern für Kern (die
 * Lücken bleiben unberührt; sie liegen auf der Rolle über dem nächsten Teil und werden dort nicht
 * bearbeitet). Gespeichert wird wie beim Blättern: im Gerät (`lokalSchreiben`) und zum Konto (`pushField`).
 */
import type { AnnotationText } from '@shared/types/index';
import { pushField } from '../services/annotations';
import { lokalSchreiben } from './lokalSpeicher';
import { readPageTexts, textSchluessel } from './annotationKeys';
import { PAGE_H, PAGE_W } from './blattMasse';
import {
  a4NachRolle,
  kerneAufSeite,
  stricheAufRolle,
  textAufRolle,
  textAufSeite,
  type Streifen,
} from './rollenAbbildung';

/** Ein gespeichertes Strich-Bild laden – `null`, wenn es keins gibt oder es kaputt ist. */
export function bildLaden(daten: string | null): Promise<HTMLImageElement | null> {
  if (!daten) return Promise.resolve(null);
  return new Promise((fertig) => {
    const img = new Image();
    img.onload = () => fertig(img);
    img.onerror = () => fertig(null);
    img.src = daten;
  });
}

function lesen(key: string | null): string | null {
  if (!key) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Die eigenen Striche aller A4-Seiten – nur die Kerne – auf die Entwurfs-Leinwand der Rolle zeichnen.
 * `eigene[i]` ist der Schlüssel der A4-Seite i.
 */
export async function entwurfStriche(
  leinwand: HTMLCanvasElement,
  eigene: (string | null)[],
  liste: Streifen[],
): Promise<void> {
  const bilder = await Promise.all(eigene.map((k) => bildLaden(lesen(k))));
  const ctx = leinwand.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, leinwand.width, leinwand.height);
  bilder.forEach((bild, seite) => {
    if (bild) stricheAufRolle(ctx, bild, liste, seite, leinwand.width, 'kern');
  });
}

/** Die eigenen Texte aller A4-Seiten, die in einem Kern stehen – in Rollen-Koordinaten. */
export function entwurfTexte(
  eigene: (string | null)[],
  liste: Streifen[],
  rollenHoehe: number,
): AnnotationText[] {
  return eigene.flatMap((k, seite) =>
    readPageTexts<AnnotationText>(k).flatMap((t) => {
      const z = textAufRolle(t, liste, seite, rollenHoehe);
      if (!z || z.art !== 'kern') return [];
      const { art: _art, ...text } = z;
      return [text];
    }),
  );
}

/** Größe einer A4-Leinwand in Bildpunkten zu einer Breite. */
function a4Leinwand(breite: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.round(breite);
  c.height = Math.round((breite * PAGE_H) / PAGE_W);
  return c;
}

/**
 * Die Entwurfs-Leinwand (als Bild) zurück in die A4-Seiten schreiben. `rolle === null` heißt: alles
 * gelöscht – dann werden die Kerne geleert. Jede Seite, die einen Schlüssel hat, wird geschrieben.
 */
export async function stricheZurueck(
  rolle: string | null,
  rollenBreite: number,
  rollenHoehe: number,
  eigene: (string | null)[],
  liste: Streifen[],
): Promise<void> {
  let quelle: CanvasImageSource & { width: number };
  const bild = await bildLaden(rolle);
  if (bild) quelle = bild;
  else {
    // Leere Rolle in derselben Größe – die Kerne werden dann einfach geleert.
    const leer = document.createElement('canvas');
    leer.width = rollenBreite;
    leer.height = rollenHoehe;
    quelle = leer;
  }
  const alt = await Promise.all(eigene.map((k) => bildLaden(lesen(k))));
  eigene.forEach((key, seite) => {
    if (!key) return;
    const vorher = alt[seite];
    const c = a4Leinwand(vorher?.width ?? rollenBreite);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    if (vorher) ctx.drawImage(vorher, 0, 0, c.width, c.height);
    kerneAufSeite(ctx, quelle, liste, seite, c.width);
    const daten = c.toDataURL('image/png', 0.7);
    lokalSchreiben(key, daten);
    pushField(key, 'strokes', daten);
  });
}

/**
 * Die Texte des Entwurfs zurück auf ihre A4-Seiten. Was auf einer Seite in einer LÜCKE steht, war nicht im
 * Entwurf und bleibt, wie es ist; alles andere ersetzt der Entwurf (neue, geänderte, gelöschte Texte).
 */
export function texteZurueck(
  texte: AnnotationText[],
  rollenHoehe: number,
  eigene: (string | null)[],
  liste: Streifen[],
): void {
  const jeSeite = eigene.map(() => [] as AnnotationText[]);
  for (const t of texte) {
    const z = textAufSeite(t, liste, rollenHoehe);
    if (z && jeSeite[z.seite]) jeSeite[z.seite].push(z.text);
  }
  eigene.forEach((key, seite) => {
    if (!key) return;
    const inLuecke = readPageTexts<AnnotationText>(key).filter(
      (t) => a4NachRolle(liste, seite, t.fx * PAGE_W, t.fy * PAGE_H)?.art === 'luecke',
    );
    const neu = [...inLuecke, ...jeSeite[seite]];
    const vorher = lesen(textSchluessel(key)) ?? '[]';
    if (JSON.stringify(neu) === vorher) return;
    lokalSchreiben(textSchluessel(key), neu.length ? JSON.stringify(neu) : null);
    pushField(key, 'texts', neu);
  });
}
