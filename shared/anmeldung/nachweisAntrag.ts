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
 */
import { z } from 'zod';

export const ANTRAG_LOGOS = ['gemeinde', 'eigen', 'ohne'] as const;
export type AntragLogo = (typeof ANTRAG_LOGOS)[number];

export const ANTRAG_BRIEFKOPF_MAX = 200;
export const ANTRAG_UEBERSCHRIFT_MAX = 120;
export const ANTRAG_TEXT_MAX = 3000;

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
}

export const antragSchema = z.object({
  an: z.boolean(),
  logo: z.enum(ANTRAG_LOGOS),
  briefkopf: z.string().max(ANTRAG_BRIEFKOPF_MAX),
  ueberschrift: z.string().max(ANTRAG_UEBERSCHRIFT_MAX),
  text: z.string().max(ANTRAG_TEXT_MAX),
  vorlageId: z.number().int().positive().nullable(),
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
    a.vorlageId === b.vorlageId);

// ── Bilder ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Nur eingebettete PNG/JPG oder eine https-Adresse (Logo der Gemeinde) – alles andere kommt nicht ins HTML. */
const BILD_ADRESSE =
  /^(?:data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}|https:\/\/[^\s"'<>]+)$/;
export const bildAdresseOk = (s: unknown): s is string =>
  typeof s === 'string' && BILD_ADRESSE.test(s);

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

/** Die Vorschau im Fenster: dasselbe Blatt, die Platzhalter durch die Beispielperson ersetzt (`heute` schon formatiert). */
export function antragVorschau(b: AntragBlatt, heute: string): string {
  const x = ANTRAG_BEISPIEL;
  return antragKoerper(b)
    .replaceAll('{{person.firstName}}', x.vorname)
    .replaceAll('{{person.lastName}}', x.nachname)
    .replaceAll('{{person.birthday}}', x.geburtsdatum)
    .replaceAll('{{person.street}}', x.strasse)
    .replaceAll('{{person.zip}}', x.plz)
    .replaceAll('{{person.city}}', x.ort)
    .replaceAll('{{currentDate}}', antragEscape(heute));
}

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

/**
 * **Die Bilder aus dem HTML einer Vorlage** – oder `null`, wenn es kein Blatt von dieser Erweiterung ist (Marker fehlt:
 * jemand hat die Vorlage in ChurchTools umgebaut, ChurchTools hat das HTML umgeformt, die Antwort war leer). `null` ist
 * NICHT „keine Bilder“: Ohne Marker weiß man nicht, ob Bilder da waren – der Aufrufer darf dann nichts schreiben, das eins
 * verlieren könnte. Mit Marker und ohne `<img>` ist es ein Blatt ohne dieses Bild.
 */
export function antragBilderLesen(
  html: string,
): { logo: string | null; unterschrift: string | null } | null {
  if (!html.includes('data-nachweis="blatt"')) return null;
  const erg: { logo: string | null; unterschrift: string | null } = {
    logo: null,
    unterschrift: null,
  };
  for (const tag of html.match(/<img\b[^>]*>/g) ?? []) {
    const art = /\bdata-nachweis="(logo|unterschrift)"/.exec(tag)?.[1] as
      | 'logo'
      | 'unterschrift'
      | undefined;
    const src = /\bsrc="([^"]*)"/.exec(tag)?.[1];
    if (!art || src === undefined) continue;
    const adresse = entschluesseln(src);
    if (bildAdresseOk(adresse) && erg[art] === null) erg[art] = adresse;
  }
  return erg;
}
