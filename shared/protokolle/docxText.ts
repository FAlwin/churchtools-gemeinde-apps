/**
 * **Text einer Word-Datei (.docx)** für „Mit KI füllen“ (Bauplan S8-1): nur der Text der Absätze, ohne neue Abhängigkeit
 * (`fflate` ist schon im Repo) und ohne DOM – läuft im Browser und in Node-Tests gleich.
 *
 * Eine `.docx` ist ein ZIP; der Text steht in `word/document.xml`. Gelesen wird so:
 * - jeder Absatz (`w:p`) ist eine Zeile, auch in Tabellenzellen; leere Absätze bleiben leere Zeilen (Ende wird gekürzt);
 * - `w:t` wird aneinandergehängt, `w:tab` wird ein Tab, `w:br` / `w:cr` ein Zeilenumbruch;
 * - Gelöschtes aus der Änderungsverfolgung (`w:delText`), Feldcodes und die Tabulator-Stopps in den Absatz-Eigenschaften
 *   (`w:pPr`) zählen nicht;
 * - XML-Entities (`&amp;`, `&#228;`, `&#xE4;` …) sind aufgelöst.
 *
 * Fehler werden **nicht geworfen**, sondern als `{ ok: false, meldung }` mit verständlichem Text geliefert.
 */
import { unzipSync } from 'fflate';

export type DocxErgebnis = { ok: true; text: string } | { ok: false; meldung: string };

/** Größer als das ist `word/document.xml` entpackt keine Sitzungsnotiz mehr – schützt vor Zip-Bomben. */
const MAX_XML_BYTES = 50 * 1024 * 1024;

const KEINE_DOCX =
  'Diese Datei lässt sich nicht als Word-Datei (.docx) lesen. Bitte in Word als „.docx“ speichern (nicht „.doc“) – oder den Text einfach einfügen.';
const KEIN_TEXT =
  'In dieser Datei steht kein Text, den ich lesen kann. Bitte den Text aus Word kopieren und einfügen.';
const ZU_GROSS = 'Diese Word-Datei ist zu groß. Bitte den Text aus Word kopieren und einfügen.';

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function entitiesAufloesen(s: string): string {
  return s.replace(/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z]+));/g, (treffer, dez, hex, name) => {
    if (name) return ENTITIES[name as string] ?? treffer;
    const code = dez ? parseInt(dez as string, 10) : parseInt(hex as string, 16);
    try {
      return String.fromCodePoint(code);
    } catch {
      return treffer;
    }
  });
}

/** Der Text der `document.xml` – siehe Dateikopf. */
export function textAusDocumentXml(xml: string): string {
  const zeilen: string[] = [];
  const absaetze = /<w:p(?=[\s>/])[^>]*?(?:\/>|>([\s\S]*?)<\/w:p>)/g;
  for (const m of xml.matchAll(absaetze)) {
    const rumpf = (m[1] ?? '').replace(/<w:pPr(?=[\s>/])[\s\S]*?<\/w:pPr>/g, '');
    let zeile = '';
    for (const t of rumpf.matchAll(
      /<w:t(?=[\s>/])[^>]*?(?:\/>|>([^<]*)<\/w:t>)|<w:(tab|br|cr)(?=[\s/>])[^>]*>/g,
    )) {
      if (t[2] === 'tab') zeile += '\t';
      else if (t[2]) zeile += '\n';
      else zeile += entitiesAufloesen(t[1] ?? '');
    }
    zeilen.push(zeile);
  }
  return zeilen.join('\n').replace(/\s+$/, '');
}

/** **Text aus den Bytes einer `.docx`.** Keine ZIP-Datei, keine `document.xml` oder ohne Text → `ok: false` mit Meldung. */
export function docxText(daten: Uint8Array): DocxErgebnis {
  let zu = false;
  let teile: Record<string, Uint8Array>;
  try {
    teile = unzipSync(daten, {
      filter: (f) => {
        if (f.name !== 'word/document.xml') return false;
        if (f.originalSize > MAX_XML_BYTES) {
          zu = true;
          return false;
        }
        return true;
      },
    });
  } catch {
    return { ok: false, meldung: KEINE_DOCX };
  }
  if (zu) return { ok: false, meldung: ZU_GROSS };
  const xml = teile['word/document.xml'];
  if (!xml) return { ok: false, meldung: KEINE_DOCX };
  // `TextDecoder` entfernt ein BOM am Anfang von selbst.
  const text = textAusDocumentXml(new TextDecoder('utf-8').decode(xml));
  return text.trim() ? { ok: true, text } : { ok: false, meldung: KEIN_TEXT };
}
