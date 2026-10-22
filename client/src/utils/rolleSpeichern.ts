/**
 * **Was auf der Rolle gemalt wird, auf den A4-Seiten speichern** (#608).
 *
 * Die Anmerkungen leben auf den A4-Seiten (#614). Gemalt wird auf der Rolle in einem **Entwurf**: einer
 * Leinwand und einer Textliste in Rollen-Koordinaten, die beim Start aus den KERNEN der A4-Seiten
 * zusammengesetzt werden. Jede Änderung geht von hier zurück auf die A4-Seiten – Kern für Kern (die
 * Lücken bleiben unberührt; sie liegen auf der Rolle über dem nächsten Teil). Nur das Lasso holt
 * Lücken-Anmerkungen ausdrücklich in den Entwurf (`lueckenTexteHolen`, `lueckenStricheHolen`, #615). Gespeichert wird wie beim Blättern: im Gerät (`lokalSchreiben`) und zum Konto (`pushField`).
 */
import type { AnnotationText } from '@shared/types/index';
import { pushField } from '../services/annotations';
import { lokalSchreiben } from './lokalSpeicher';
import { readPageTexts, textSchluessel } from './annotationKeys';
import { PAGE_H, PAGE_W } from './blattMasse';
import { hatInhalt, imLasso, lassoPfad, pixelRahmen, type Punkt } from './lasso';
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
  let quelle: CanvasImageSource & { width: number; height: number };
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

/**
 * **Lasso auf der Rolle: die Texte aus den Lücken holen** (#615). Was beim Blättern in einer Lücke steht,
 * zeigt die Rolle am Ende des vorigen Stücks – oft über dem nächsten Teil. Liegt seine Mitte in der
 * Lasso-Form, wird es von seiner A4-Seite genommen und in Rollen-Koordinaten zurückgegeben; der Aufrufer
 * legt es in den Entwurf, und beim Speichern landet es über `texteZurueck` im Kern, wo es jetzt steht.
 */
export function lueckenTexteHolen(
  form: Punkt[],
  rollenHoehe: number,
  eigene: (string | null)[],
  liste: Streifen[],
): AnnotationText[] {
  const geholt: AnnotationText[] = [];
  eigene.forEach((key, seite) => {
    if (!key) return;
    const alle = readPageTexts<AnnotationText>(key);
    const bleiben = alle.filter((t) => {
      const z = textAufRolle(t, liste, seite, rollenHoehe);
      if (!z || z.art !== 'luecke' || !imLasso({ x: z.fx, y: z.fy }, form)) return true;
      const { art: _art, ...text } = z;
      geholt.push(text);
      return false;
    });
    if (bleiben.length === alle.length) return;
    lokalSchreiben(textSchluessel(key), bleiben.length ? JSON.stringify(bleiben) : null);
    pushField(key, 'texts', bleiben);
  });
  return geholt;
}

/**
 * **Lasso auf der Rolle: die Striche aus den Lücken holen** (#615). Was in der Form liegt und auf der Rolle
 * über einem Kern steht, wird auf die Entwurfs-Leinwand gezeichnet und auf seiner A4-Seite gelöscht – danach
 * gehört es zum Entwurf und wandert beim Speichern in den Kern. Was über keinem Kern stünde (unter dem
 * letzten Teil), bleibt in seiner Lücke: Im Entwurf ginge es beim Speichern verloren.
 *
 * Gibt zurück, ob etwas geholt wurde.
 */
export async function lueckenStricheHolen(
  leinwand: HTMLCanvasElement,
  form: Punkt[],
  eigene: (string | null)[],
  liste: Streifen[],
): Promise<boolean> {
  const W = leinwand.width;
  const H = leinwand.height;
  const ziel = leinwand.getContext('2d');
  if (!ziel || !W || !H) return false;
  const z = W / PAGE_W; // Bildpunkte je mm auf der Rolle
  const { x: bx, y: by, w: bw, h: bh } = pixelRahmen(form, W, H);

  // Die Maske: Lasso-Form, beschnitten auf die Kerne.
  const maske = document.createElement('canvas');
  maske.width = bw;
  maske.height = bh;
  const m = maske.getContext('2d');
  if (!m) return false;
  m.fill(lassoPfad(form, W, H, bx, by));
  const kerne = new Path2D();
  for (const s of liste)
    if (s.art === 'kern' && s.quelle.h > 0)
      kerne.rect(s.ziel.x * z - bx, s.ziel.y * z - by, s.quelle.w * z, s.quelle.h * z);
  m.globalCompositeOperation = 'destination-in';
  m.fill(kerne);

  const bilder = await Promise.all(eigene.map((k) => bildLaden(lesen(k))));
  let geholt = false;
  eigene.forEach((key, seite) => {
    const bild = bilder[seite];
    if (!key || !bild) return;
    const a4 = a4Leinwand(bild.width);
    const a = a4.getContext('2d');
    if (!a) return;
    a.drawImage(bild, 0, 0, a4.width, a4.height);
    const q = a4.width / PAGE_W; // Bildpunkte je mm auf der A4-Seite
    let geaendert = false;
    for (const s of liste) {
      if (s.seite !== seite || s.art !== 'luecke' || s.quelle.h <= 0) continue;
      // Wo die Lücke auf der Rolle steht – geschnitten mit dem Rahmen der Form.
      const zx = s.ziel.x * z;
      const zy = s.ziel.y * z;
      const ix = Math.max(zx, bx);
      const iy = Math.max(zy, by);
      const iw = Math.min(zx + s.quelle.w * z, bx + bw) - ix;
      const ih = Math.min(zy + s.quelle.h * z, by + bh) - iy;
      if (iw <= 0 || ih <= 0) continue;
      // Derselbe Ausschnitt auf der A4-Seite.
      const ax = (s.quelle.x + (ix - zx) / z) * q;
      const ay = (s.quelle.y + (iy - zy) / z) * q;
      const aw = (iw / z) * q;
      const ah = (ih / z) * q;
      const stueck = document.createElement('canvas');
      stueck.width = Math.ceil(iw);
      stueck.height = Math.ceil(ih);
      const st = stueck.getContext('2d');
      if (!st) continue;
      st.drawImage(a4, ax, ay, aw, ah, 0, 0, iw, ih);
      st.globalCompositeOperation = 'destination-in';
      st.drawImage(maske, ix - bx, iy - by, iw, ih, 0, 0, iw, ih);
      if (!hatInhalt(stueck)) continue;
      ziel.drawImage(stueck, 0, 0, iw, ih, ix, iy, iw, ih);
      a.save();
      a.globalCompositeOperation = 'destination-out';
      a.drawImage(maske, ix - bx, iy - by, iw, ih, ax, ay, aw, ah);
      a.restore();
      geaendert = true;
    }
    if (!geaendert) return;
    geholt = true;
    const daten = a4.toDataURL('image/png', 0.7);
    lokalSchreiben(key, daten);
    pushField(key, 'strokes', daten);
  });
  return geholt;
}
