/**
 * **Der Antrag einer Nachweis-Art** (Etappe F, N1c) – eine ChurchTools-**Bescheinigung** (globale HTML-Vorlage vom Typ
 * `groupmember-document`), die jede Person der Gruppe „Nachweis: …“ mit ihren Daten als PDF herunterladen kann. Gemessen
 * an der Test-Instanz am 19.11.2026 (N0 zweite Runde, M4, M5): ChurchTools setzt `{{person.firstName}}` & Co. je Person
 * ein, rendert mit Chromium (A4) und druckt eingebettete Bilder (`data:`-Adressen) mit.
 *
 * **Die EINE Stelle für das HTML:** `antragHtml` (für ChurchTools) und `antragVorschau` (für das Fenster) bauen beide aus
 * `antragKoerper` – die Vorschau ist also dasselbe Blatt, nur mit Beispielwerten statt der Platzhalter. Alles Nutzergeschriebene
 * wird HTML-escaped, und `{`/`}` darin werden zu Zeichenverweisen (`&#123;`/`&#125;`): ChurchTools liest nur unsere eigenen
 * `{{…}}` als Platzhalter, ein `{{person.lastName}}` im Text bliebe sonst ein Einschleusen fremder Platzhalter.
 *
 * **Bilder** (eigenes Logo, Unterschrift) stehen NUR im HTML der Vorlage, markiert mit `data-nachweis="logo"` und
 * `data-nachweis="unterschrift"` – nie als Gruppenbild (M4: Gruppenbilder sind über den Link öffentlich). Beim Bearbeiten
 * liest `antragBilderLesen` sie wieder heraus; **`null` heißt „nicht lesbar“** (kein Blatt von uns) – dann darf nichts
 * überschrieben werden, was ein Bild verlieren könnte.
 *
 * **Zwei Gestaltungen (`art`)** – N1d: der **Baukasten** (Briefkopf, Überschrift, Text) und die **eigene PDF**: Die Gemeinde
 * lädt ihr Antragsformular hoch, die Erweiterung macht aus der ersten Seite ein Hintergrundbild (JPEG, nur im HTML, markiert
 * mit `data-nachweis="hintergrund"`), die Platzhalter liegen als absolut positionierte Felder darüber (`antragPdfHtml`).
 * **Der Anker eines Feldes ist seine linke obere Ecke**, Positionen stehen in Prozent der Seite – Editor (`pdfFeldStil`) und
 * HTML benutzen dieselbe Funktion, sonst säße der Text im PDF versetzt.
 */
import { z } from 'zod';

export const ANTRAG_LOGOS = ['gemeinde', 'eigen', 'ohne'] as const;
export type AntragLogo = (typeof ANTRAG_LOGOS)[number];

export const ANTRAG_BRIEFKOPF_MAX = 200;
export const ANTRAG_UEBERSCHRIFT_MAX = 120;
export const ANTRAG_TEXT_MAX = 3000;

export const ANTRAG_ARTEN = ['baukasten', 'pdf'] as const;
export type AntragArt = (typeof ANTRAG_ARTEN)[number];

/** Was auf der eigenen PDF-Seite stehen kann: Angaben der Person (ChurchTools setzt sie ein) und die Unterschrift (Bild). */
export const PDF_FELD_ARTEN = [
  'NachnameVorname',
  'Vorname',
  'Nachname',
  'Geburtsdatum',
  'Adresse',
  'Heute',
  'Email',
  'Unterschrift',
] as const;
export type PdfFeldArt = (typeof PDF_FELD_ARTEN)[number];

/** Schriftgrößen (pt), aus denen man je Platzhalter wählt. */
export const PDF_SCHRIFTEN = [9, 11, 13] as const;
export const PDF_SCHRIFT_STANDARD = 11;
/** Breite der Unterschrift in mm. */
export const PDF_UNTERSCHRIFT_BREITEN = [30, 40, 50, 60, 70] as const;
export const PDF_UNTERSCHRIFT_STANDARD = 50;
export const PDF_FELDER_MAX = 20;
export const PDF_VORSATZ_MAX = 60;
/** Seitenformat, das die Erweiterung akzeptiert (mm) – A4 hoch ist der Normalfall. */
export const PDF_MASS_MIN = 50;
export const PDF_MASS_MAX = 500;

/** Ein Platzhalter auf der Seite. `x`/`y` in Prozent der Seite, Anker = linke obere Ecke des Textkastens. */
export interface PdfFeld {
  id: string;
  art: PdfFeldArt;
  x: number;
  y: number;
  /** Schriftgröße in pt (bei der Unterschrift ohne Wirkung). */
  pt: number;
  /** Nur Unterschrift: Breite in mm. */
  breiteMm?: number;
  /** Nur Heute: Text davor, z. B. „Lohmar, “. */
  vorsatz?: string;
}

/** Seitenformat und Platzhalter der eigenen PDF – **ohne Bild** (Hintergrund und Unterschrift stehen nur im HTML). */
export interface PdfSeite {
  breiteMm: number;
  hoeheMm: number;
  felder: PdfFeld[];
}

const pdfFeldSchema = z.object({
  id: z.string().min(1).max(24),
  art: z.enum(PDF_FELD_ARTEN),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  pt: z.number().int().min(6).max(24),
  breiteMm: z.number().min(10).max(150).optional(),
  vorsatz: z.string().max(PDF_VORSATZ_MAX).optional(),
});

const pdfSeiteSchema = z.object({
  breiteMm: z.number().min(PDF_MASS_MIN).max(PDF_MASS_MAX),
  hoeheMm: z.number().min(PDF_MASS_MIN).max(PDF_MASS_MAX),
  felder: z.array(pdfFeldSchema).max(PDF_FELDER_MAX),
});

/** Die Einstellungen des Antrags, die im Datenblock der Art stehen – **ohne Bilder** (zu groß). */
export interface NachweisAntrag {
  /** „Mit Antrag“: aus = keine Bescheinigung an der Gruppe (eine vorhandene wird abgehängt, nicht gelöscht). */
  an: boolean;
  logo: AntragLogo;
  /** Eine Zeile unter dem Logo, Vorgabe: der Name der Gemeinde. */
  briefkopf: string;
  ueberschrift: string;
  /** Mit den Platzhaltern aus `ANTRAG_PLATZHALTER`, Absätze durch Leerzeilen. */
  text: string;
  /** Nummer der Vorlage in ChurchTools – `null`, solange es sie nicht gibt. */
  vorlageId: number | null;
  /** Gestaltung (N1d, Fassung 3 des Blocks). Fehlt sie, ist es der Baukasten (N1c). Die Felder des anderen bleiben stehen. */
  art?: AntragArt;
  /** Seitenformat und Platzhalter der eigenen PDF (nur mit `art: 'pdf'` gebraucht). */
  pdf?: PdfSeite;
}

export const antragSchema = z.object({
  an: z.boolean(),
  logo: z.enum(ANTRAG_LOGOS),
  briefkopf: z.string().max(ANTRAG_BRIEFKOPF_MAX),
  ueberschrift: z.string().max(ANTRAG_UEBERSCHRIFT_MAX),
  text: z.string().max(ANTRAG_TEXT_MAX),
  vorlageId: z.number().int().positive().nullable(),
  art: z.enum(ANTRAG_ARTEN).optional(),
  pdf: pdfSeiteSchema.optional(),
});

export const ANTRAG_VORGABE_UEBERSCHRIFT = 'Bestätigung zur Vorlage bei der Meldebehörde';
export const ANTRAG_VORGABE_TEXT =
  'Hiermit bestätigen wir, dass [Vorname] [Nachname], geboren am [Geburtsdatum], wohnhaft [Adresse], ehrenamtlich in der Kinder- und Jugendarbeit unserer Gemeinde tätig ist bzw. tätig werden soll. Für diese Tätigkeit wird ein erweitertes Führungszeugnis nach § 30a Abs. 1 Nr. 2b BZRG benötigt. Wir bitten um Gebührenbefreiung, da die Tätigkeit ehrenamtlich ausgeübt wird.';

/** Die Vorgabe für eine neue Art (Briefkopf: der Name der Gemeinde, falls bekannt). */
export const antragVorgabe = (gemeinde: string | null): NachweisAntrag => ({
  an: true,
  logo: 'gemeinde',
  briefkopf: (gemeinde ?? '').slice(0, ANTRAG_BRIEFKOPF_MAX),
  ueberschrift: ANTRAG_VORGABE_UEBERSCHRIFT,
  text: ANTRAG_VORGABE_TEXT,
  vorlageId: null,
});

/** Was in der Aufforderungs-Mail einer Art mit Antrag steht: der Weg zur Bescheinigung (Alwin, 19.11.2026). */
export function nachweisMailVorgabe(artName: string, mitAntrag: boolean): string {
  const weg = mitAntrag
    ? `Den Antrag mit deinen Daten findest du in ChurchTools unter „Meine Gruppen“ → „Nachweis: ${artName.trim() || '…'}“ → Bescheinigungen. Zeig den Nachweis danach einer Vertrauensperson.`
    : 'Alles Weitere findest du in ChurchTools unter „Meine Gruppen“. Zeig den Nachweis danach einer Vertrauensperson.';
  return `Hallo [Vorname],\n\nfür deine Mitarbeit brauchen wir einen Nachweis von dir. ${weg}\n\nDie Einladung zu ChurchTools kommt in einer eigenen Mail.`;
}

// ── Platzhalter ─────────────────────────────────────────────────────────────────────────────────────────────────

export const ANTRAG_PLATZHALTER = [
  'Vorname',
  'Nachname',
  'Geburtsdatum',
  'Adresse',
  'Heute',
] as const;
type Platzhalter = (typeof ANTRAG_PLATZHALTER)[number];

/** Was ChurchTools einsetzt (gemessen 19.11.2026: `person.birthday` als TT.MM.JJJJ, `currentDate` als „19. November 2026“). */
const CT_PLATZHALTER: Record<Platzhalter, string> = {
  Vorname: '{{person.firstName}}',
  Nachname: '{{person.lastName}}',
  Geburtsdatum: '{{person.birthday}}',
  Adresse: '{{person.street}}, {{person.zip}} {{person.city}}',
  Heute: '{{currentDate}}',
};

/** Die Beispielperson der Vorschau. */
export const ANTRAG_BEISPIEL = {
  vorname: 'Lena',
  nachname: 'Probst',
  geburtsdatum: '14.03.2001',
  strasse: 'Bachweg 7',
  plz: '53797',
  ort: 'Lohmar',
  email: 'lena.probst@example.org',
} as const;

const istPlatzhalter = (n: string): n is Platzhalter =>
  (ANTRAG_PLATZHALTER as readonly string[]).includes(n);

const KLAMMERN = /\[([^[\]\n]+)\]/g;

/** Eckige Klammern im Text, die keiner der Platzhalter sind. */
export function antragUnbekannte(text: string): string[] {
  return [
    ...new Set([...text.matchAll(KLAMMERN)].map((m) => m[1]).filter((n) => !istPlatzhalter(n))),
  ];
}

/** Was an den Einstellungen des Antrags nicht passt – `null`, wenn sie taugen. Gilt nur bei „Mit Antrag“. */
export function antragFehler(a: NachweisAntrag): string | null {
  if (!a.an) return null;
  if (a.art === 'pdf') return pdfSeiteFehler(a.pdf);
  if (a.briefkopf.length > ANTRAG_BRIEFKOPF_MAX)
    return `Der Briefkopf ist zu lang (höchstens ${ANTRAG_BRIEFKOPF_MAX} Zeichen).`;
  if (!a.ueberschrift.trim()) return 'Bitte eine Überschrift für den Antrag eintragen.';
  if (a.ueberschrift.length > ANTRAG_UEBERSCHRIFT_MAX)
    return `Die Überschrift des Antrags ist zu lang (höchstens ${ANTRAG_UEBERSCHRIFT_MAX} Zeichen).`;
  if (!a.text.trim()) return 'Bitte einen Text für den Antrag eintragen.';
  if (a.text.length > ANTRAG_TEXT_MAX)
    return `Der Text des Antrags ist zu lang (höchstens ${ANTRAG_TEXT_MAX} Zeichen).`;
  const unbekannt = antragUnbekannte(a.text);
  if (unbekannt.length)
    return `Im Antrag steht ${unbekannt.map((u) => `[${u}]`).join(', ')} – nur ${ANTRAG_PLATZHALTER.map((p) => `[${p}]`).join(', ')} kennt der Antrag. Eckige Klammern sonst bitte weglassen.`;
  return null;
}

/** Was an der eigenen PDF-Seite nicht passt – `null`, wenn sie taugt. */
export function pdfSeiteFehler(p: PdfSeite | undefined): string | null {
  if (!p) return 'Bitte eine PDF mit dem Antragsformular wählen.';
  const r = pdfSeiteSchema.safeParse(p);
  if (!r.success) return 'Die Seite der PDF hat ein Format oder Platzhalter, die nicht passen.';
  if (p.felder.length === 0) return 'Bitte mindestens einen Platzhalter auf die Seite setzen.';
  if (p.felder.filter((f) => f.art === 'Unterschrift').length > 1)
    return 'Die Unterschrift darf nur einmal auf der Seite stehen.';
  return null;
}

/** Gleicher Antrag? (Zum Vergleichen nach dem Nachlesen; „kein Antrag“ und „kein Antrag“ sind gleich.) */
export const gleicherAntrag = (a: NachweisAntrag | undefined, b: NachweisAntrag | undefined) =>
  a === b ||
  (!!a &&
    !!b &&
    a.an === b.an &&
    a.logo === b.logo &&
    a.briefkopf === b.briefkopf &&
    a.ueberschrift === b.ueberschrift &&
    a.text === b.text &&
    a.vorlageId === b.vorlageId &&
    (a.art ?? 'baukasten') === (b.art ?? 'baukasten') &&
    JSON.stringify(a.pdf ?? null) === JSON.stringify(b.pdf ?? null));

// ── Bilder ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Nur eingebettete PNG/JPG oder eine https-Adresse (Logo der Gemeinde) – alles andere kommt nicht ins HTML. */
const BILD_ADRESSE =
  /^(?:data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}|https:\/\/[^\s"'<>]+)$/;
export const bildAdresseOk = (s: unknown): s is string =>
  typeof s === 'string' && BILD_ADRESSE.test(s);
/** Nur eingebettet (`data:`) – für Hintergrund und Unterschrift der eigenen PDF: nie eine fremde Adresse im Antrag. */
export const dataBildOk = (s: unknown): s is string =>
  typeof s === 'string' && s.startsWith('data:') && BILD_ADRESSE.test(s);

// ── HTML ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Nutzertext als HTML-Text: escaped, und `{`/`}` als Zeichenverweise, damit sie nie als ChurchTools-Platzhalter zählen. */
export function antragEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');
}

const entschluesseln = (s: string): string =>
  s
    .replace(/&#123;/g, '{')
    .replace(/&#125;/g, '}')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');

/** Der Text als Absätze: Leerzeilen trennen sie, ein einfacher Zeilenumbruch bleibt einer; `[Name]` wird zum CT-Platzhalter. */
function absaetze(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== '')
    .map((p) => {
      const html = antragEscape(p)
        .replace(KLAMMERN, (alt, n: string) => (istPlatzhalter(n) ? CT_PLATZHALTER[n] : alt))
        .replace(/\n/g, '<br>');
      return `<p style="margin:0 0 4mm 0">${html}</p>`;
    })
    .join('\n');
}

export interface AntragBlatt {
  /** Wie `NachweisAntrag`, aber ohne Nummer. */
  briefkopf: string;
  ueberschrift: string;
  text: string;
  /** Adresse des Logos (`data:` oder https), `null`: kein Logo. */
  logo: string | null;
  /** Adresse der Unterschrift (`data:`), `null`: keine. */
  unterschrift: string | null;
}

const bild = (art: 'logo' | 'unterschrift', src: string | null, stil: string): string =>
  bildAdresseOk(src)
    ? `<img data-nachweis="${art}" src="${antragEscape(src)}" alt="" style="${stil}">`
    : '';

/**
 * **Das Blatt** (ohne Seitenrand und Dokument-Rahmen): Briefkopf mit Logo links und Datum rechts, Überschrift, Text,
 * Unterschrift mit Linie. Nur Inline-Stile – so sieht die Vorschau im Fenster genauso aus wie das PDF.
 */
export function antragKoerper(b: AntragBlatt): string {
  const logo = bild('logo', b.logo, 'display:block;height:16mm;max-width:55mm;margin:0 0 2mm 0');
  const kopf = antragEscape(b.briefkopf.replace(/\s+/g, ' ').trim());
  const unterschrift = bild(
    'unterschrift',
    b.unterschrift,
    'display:block;max-height:22mm;max-width:100%;margin:0 0 1mm 0',
  );
  return [
    '<div data-nachweis="blatt" style="font-family:Georgia,\'Times New Roman\',serif;font-size:11pt;line-height:1.5;color:#111">',
    '<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:8mm;font-size:10pt;color:#444;border-bottom:1px solid #ccc;padding-bottom:3mm;margin-bottom:8mm">',
    `<div>${logo}${kopf}</div>`,
    `<div style="white-space:nowrap">${CT_PLATZHALTER.Heute}</div>`,
    '</div>',
    `<h1 style="font-size:15pt;line-height:1.3;margin:0 0 6mm 0">${antragEscape(b.ueberschrift.trim())}</h1>`,
    absaetze(b.text),
    '<div style="margin-top:16mm;width:60%;page-break-inside:avoid">',
    unterschrift,
    '<div style="border-top:1px solid #444;padding-top:1mm;font-size:9pt;color:#444">Unterschrift / Stempel der Gemeinde</div>',
    '</div>',
    '</div>',
  ].join('\n');
}

/** **Das HTML für ChurchTools**: ein vollständiges Dokument, A4 mit Rand, die Platzhalter noch als `{{…}}`. */
export function antragHtml(b: AntragBlatt): string {
  return [
    '<!doctype html>',
    '<html lang="de">',
    '<head>',
    '<meta charset="utf-8">',
    '<title>Antrag</title>',
    '<style>@page { size: A4; margin: 20mm 22mm; }</style>',
    '</head>',
    '<body style="margin:0">',
    antragKoerper(b),
    '</body>',
    '</html>',
  ].join('\n');
}

/** Die Beispielperson statt der ChurchTools-Platzhalter (`heute` schon formatiert) – für jede Vorschau dieselbe Ersetzung. */
function beispielEinsetzen(html: string, heute: string): string {
  const x = ANTRAG_BEISPIEL;
  return html
    .replaceAll('{{person.firstName}}', x.vorname)
    .replaceAll('{{person.lastName}}', x.nachname)
    .replaceAll('{{person.birthday}}', x.geburtsdatum)
    .replaceAll('{{person.street}}', x.strasse)
    .replaceAll('{{person.zip}}', x.plz)
    .replaceAll('{{person.city}}', x.ort)
    .replaceAll('{{person.email}}', x.email)
    .replaceAll('{{currentDate}}', antragEscape(heute));
}

/** Die Vorschau im Fenster: dasselbe Blatt, die Platzhalter durch die Beispielperson ersetzt (`heute` schon formatiert). */
export const antragVorschau = (b: AntragBlatt, heute: string): string =>
  beispielEinsetzen(antragKoerper(b), heute);

/** Das Blatt aus den Einstellungen und den (schon aufgelösten) Bildern. */
export const antragBlatt = (
  a: Pick<NachweisAntrag, 'briefkopf' | 'ueberschrift' | 'text'>,
  bilder: { logo: string | null; unterschrift: string | null },
): AntragBlatt => ({
  briefkopf: a.briefkopf,
  ueberschrift: a.ueberschrift,
  text: a.text,
  logo: bilder.logo,
  unterschrift: bilder.unterschrift,
});

/** Die Bilder eines gespeicherten Blatts: Logo/Unterschrift (Baukasten), Hintergrund/Unterschrift (eigene PDF). */
export interface AntragBilderGelesen {
  logo: string | null;
  unterschrift: string | null;
  hintergrund: string | null;
}

/**
 * **Die Bilder aus dem HTML einer Vorlage** – oder `null`, wenn es kein Blatt von dieser Erweiterung ist (Marker fehlt:
 * jemand hat die Vorlage in ChurchTools umgebaut, ChurchTools hat das HTML umgeformt, die Antwort war leer). `null` ist
 * NICHT „keine Bilder“: Ohne Marker weiß man nicht, ob Bilder da waren – der Aufrufer darf dann nichts schreiben, das eins
 * verlieren könnte. Mit Marker und ohne `<img>` ist es ein Blatt ohne dieses Bild. Hintergrund und Unterschrift der eigenen
 * PDF gelten nur als `data:`-Bild.
 */
export function antragBilderLesen(html: string): AntragBilderGelesen | null {
  if (!html.includes('data-nachweis="blatt"')) return null;
  const erg: AntragBilderGelesen = { logo: null, unterschrift: null, hintergrund: null };
  for (const tag of html.match(/<img\b[^>]*>/g) ?? []) {
    const art = /\bdata-nachweis="(logo|unterschrift|hintergrund)"/.exec(tag)?.[1] as
      | keyof AntragBilderGelesen
      | undefined;
    const src = /\bsrc="([^"]*)"/.exec(tag)?.[1];
    if (!art || src === undefined) continue;
    const adresse = entschluesseln(src);
    const ok = art === 'hintergrund' ? dataBildOk(adresse) : bildAdresseOk(adresse);
    if (ok && erg[art] === null) erg[art] = adresse;
  }
  return erg;
}

// ── Eigene PDF (N1d) ────────────────────────────────────────────────────────────────────────────────────────────

/** Was ChurchTools für die Angaben einsetzt (gemessen 19.11.2026; `person.email` wie die übrigen `person.…`). */
const CT_PDF_TEXT: Record<Exclude<PdfFeldArt, 'Unterschrift'>, string> = {
  NachnameVorname: `${CT_PLATZHALTER.Nachname}, ${CT_PLATZHALTER.Vorname}`,
  Vorname: CT_PLATZHALTER.Vorname,
  Nachname: CT_PLATZHALTER.Nachname,
  Geburtsdatum: CT_PLATZHALTER.Geburtsdatum,
  Adresse: CT_PLATZHALTER.Adresse,
  Heute: CT_PLATZHALTER.Heute,
  Email: '{{person.email}}',
};

/** So heißt der Platzhalter auf dem Knopf und im Editor. */
export const PDF_FELD_NAME: Record<PdfFeldArt, string> = {
  NachnameVorname: '[Nachname], [Vorname]',
  Vorname: '[Vorname]',
  Nachname: '[Nachname]',
  Geburtsdatum: '[Geburtsdatum]',
  Adresse: '[Adresse]',
  Heute: '[Heute]',
  Email: '[E-Mail]',
  Unterschrift: 'Unterschrift',
};

/** Das Blatt der eigenen PDF: Format, Bilder (`data:`) und Platzhalter. */
export interface PdfBlatt extends PdfSeite {
  /** Die erste Seite der PDF als JPEG-`data:`-Adresse – `null`: noch keine. */
  hintergrund: string | null;
  /** Die Unterschrift als `data:`-Adresse – `null`: keine (das Feld bleibt dann leer). */
  unterschrift: string | null;
}

/** Das Blatt aus den Einstellungen der Seite und den (schon aufgelösten) Bildern. */
export const pdfBlatt = (
  p: PdfSeite,
  bilder: { hintergrund: string | null; unterschrift: string | null },
): PdfBlatt => ({ ...p, hintergrund: bilder.hintergrund, unterschrift: bilder.unterschrift });

/** pt (PDF-Einheit) in mm, auf 0,1 mm gerundet (A4: 595,28 pt → 210 mm). */
export const ptZuMm = (pt: number): number => Math.round(((pt * 25.4) / 72) * 10) / 10;

const zahl = (n: number): string => String(Math.round(n * 100) / 100);

/** Ein Stil als Text für `style="…"` (aus camelCase wird kebab-case). */
export const stilText = (o: Record<string, string>): string =>
  Object.entries(o)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${v}`)
    .join(';');

/** Der Stil der Seite: Maße in mm, Bezugspunkt der Felder. */
export const pdfSeitenStil = (
  p: Pick<PdfSeite, 'breiteMm' | 'hoeheMm'>,
): Record<string, string> => ({
  position: 'relative',
  width: `${zahl(p.breiteMm)}mm`,
  height: `${zahl(p.hoeheMm)}mm`,
  overflow: 'hidden',
});

/** Das Hintergrundbild füllt die ganze Seite. */
export const pdfHintergrundStil = (
  p: Pick<PdfSeite, 'breiteMm' | 'hoeheMm'>,
): Record<string, string> => ({
  position: 'absolute',
  left: '0',
  top: '0',
  width: `${zahl(p.breiteMm)}mm`,
  height: `${zahl(p.hoeheMm)}mm`,
});

/**
 * **Die EINE Stelle für die Lage eines Platzhalters** – der Editor (React-Stil) und das HTML für ChurchTools rechnen
 * beide damit. Anker = linke obere Ecke (`left`/`top` in Prozent der Seite, kein `transform`), Text einzeilig.
 */
export function pdfFeldStil(f: PdfFeld): Record<string, string> {
  const lage = { position: 'absolute', left: `${zahl(f.x)}%`, top: `${zahl(f.y)}%` };
  if (f.art === 'Unterschrift')
    return {
      ...lage,
      width: `${zahl(f.breiteMm ?? PDF_UNTERSCHRIFT_STANDARD)}mm`,
      height: 'auto',
      margin: '0',
    };
  return {
    ...lage,
    margin: '0',
    padding: '0',
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: `${zahl(f.pt)}pt`,
    lineHeight: '1.2',
    color: '#000',
    whiteSpace: 'nowrap',
  };
}

/** Der Text eines Feldes mit den ChurchTools-Platzhaltern (escaped, `{`/`}` nur aus unseren eigenen `{{…}}`). */
export function pdfFeldChurchTools(f: PdfFeld): string {
  if (f.art === 'Unterschrift') return '';
  return `${antragEscape(f.vorsatz ?? '')}${CT_PDF_TEXT[f.art]}`;
}

/** Der Text eines Feldes mit der Beispielperson – so zeigt ihn der Editor (`heute` schon formatiert). */
export const pdfFeldBeispiel = (f: PdfFeld, heute: string): string =>
  f.art === 'Unterschrift' ? '' : entschluesseln(beispielEinsetzen(pdfFeldChurchTools(f), heute));

/** **Das Blatt der eigenen PDF** (ohne Dokument-Rahmen): Hintergrund ganzseitig, darüber die Felder an ihrer Stelle. */
export function antragPdfKoerper(b: PdfBlatt): string {
  const teile = [
    `<div data-nachweis="blatt" data-art="pdf" style="${stilText(pdfSeitenStil(b))}">`,
  ];
  if (dataBildOk(b.hintergrund))
    teile.push(
      `<img data-nachweis="hintergrund" src="${antragEscape(b.hintergrund)}" alt="" style="${stilText(pdfHintergrundStil(b))}">`,
    );
  for (const f of b.felder) {
    if (f.art === 'Unterschrift') {
      if (dataBildOk(b.unterschrift))
        teile.push(
          `<img data-nachweis="unterschrift" src="${antragEscape(b.unterschrift)}" alt="" style="${stilText(pdfFeldStil(f))}">`,
        );
      continue;
    }
    teile.push(
      `<span data-nachweis="feld" style="${stilText(pdfFeldStil(f))}">${pdfFeldChurchTools(f)}</span>`,
    );
  }
  teile.push('</div>');
  return teile.join('\n');
}

/** **Das HTML für ChurchTools**: Seitenformat der PDF, kein Rand (gemessen M5: 1 Seite, Felder landen exakt). */
export function antragPdfHtml(b: PdfBlatt): string {
  return [
    '<!doctype html>',
    '<html lang="de">',
    '<head>',
    '<meta charset="utf-8">',
    '<title>Antrag</title>',
    `<style>@page { size: ${zahl(b.breiteMm)}mm ${zahl(b.hoeheMm)}mm; margin: 0 } html, body { margin: 0; padding: 0 }</style>`,
    '</head>',
    '<body style="margin:0">',
    antragPdfKoerper(b),
    '</body>',
    '</html>',
  ].join('\n');
}

/** Dasselbe Blatt mit der Beispielperson – die Vorschau rechnet nicht anders als das HTML für ChurchTools. */
export const antragPdfVorschau = (b: PdfBlatt, heute: string): string =>
  beispielEinsetzen(antragPdfKoerper(b), heute);

/** Die nächste freie Kennung (`f1`, `f2` …) – nie eine doppelte. */
export function pdfNeueId(felder: readonly PdfFeld[]): string {
  const hoechste = felder.reduce((m, f) => Math.max(m, Number(/^f(\d+)$/.exec(f.id)?.[1] ?? 0)), 0);
  return `f${hoechste + 1}`;
}

/** Ein neuer Platzhalter mit den Vorgaben der Art (Schrift 11 pt, Unterschrift 50 mm). */
export function pdfNeuesFeld(
  felder: readonly PdfFeld[],
  art: PdfFeldArt,
  x: number,
  y: number,
  vorsatz?: string,
): PdfFeld {
  return {
    id: pdfNeueId(felder),
    art,
    x,
    y,
    pt: PDF_SCHRIFT_STANDARD,
    ...(art === 'Unterschrift' ? { breiteMm: PDF_UNTERSCHRIFT_STANDARD } : {}),
    ...(art === 'Heute' && vorsatz ? { vorsatz } : {}),
  };
}

/** Der Ort aus dem Briefkopf („… · 53797 Lohmar“) – `null`, wenn keiner zu erkennen ist. Vorgabe für „Ort, [Heute]“. */
export function antragOrt(briefkopf: string): string | null {
  const m = /\b\d{5}\s+([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß.\- ]*?)\s*(?:[,·|;/\n]|$)/.exec(briefkopf);
  return m?.[1] ? m[1].trim() : null;
}

/** Die Platzhalter beim ersten Hochladen: Name, Geburtsdatum, Adresse, „Ort, [Heute]“ und Unterschrift untereinander. */
export function pdfVorgabeFelder(ort: string | null): PdfFeld[] {
  const liste: PdfFeld[] = [];
  const dazu = (art: PdfFeldArt, y: number, vorsatz?: string) =>
    liste.push(pdfNeuesFeld(liste, art, 36, y, vorsatz));
  dazu('NachnameVorname', 17.6);
  dazu('Geburtsdatum', 23.1);
  dazu('Adresse', 28.6);
  dazu('Heute', 40.2, ort ? `${ort}, ` : undefined);
  dazu('Unterschrift', 50);
  return liste;
}
