/**
 * **Inhaltsmodell der Website** (Bauplan Website W1, §3/§3.4).
 *
 * Eine ChurchTools-Erweiterung pflegt Seiten aus Bausteinen, ein Bau-Dienst macht daraus statische HTML-Dateien;
 * Vorschau und Bau benutzen denselben Renderer (`render.ts`). Hier steht nur das Datenmodell: Schemas, Typen, das
 * Speicherformat (`website:v1:` + JSON, je Einheit ein Wert) und die Gesamtprüfung.
 *
 * **Aufbau (W1b, E-W11):** Eine Seite besteht aus **Abschnitten**. Jeder Abschnitt hat eine Gestaltung (Hintergrund,
 * Textfarbe, Abstand, Breite …) und eine Aufteilung in **Spalten**; in den Spalten stehen die **Bausteine**. Eine
 * Spalte kann einen eigenen Hintergrund haben (links Farbfläche, rechts Foto).
 *
 * Gemeindeneutral: nichts Festes von einer Gemeinde. Name, Logo, Links, Farben, Schriften und Adresse des
 * Kontaktformulars kommen aus den `Einstellungen`; ohne Angaben gelten neutrale Vorgaben (`theme.ts`).
 *
 * Alles, was in `style="…"` oder im `<style>` der Seite landen darf, ist hier **eng begrenzt**: Hex-Farben nur als
 * `#rgb`/`#rrggbb`, Schriftnamen nur aus Buchstaben/Ziffern/Leerzeichen/Bindestrich, Zahlen als ganze Zahlen im
 * Bereich. Die einzigen Felder, die bewusst **nicht** geschützt ausgegeben werden, sind `Baustein.html` und
 * `Einstellungen.eigenesCss` (siehe dort).
 */
import { z } from 'zod';
import { GEWICHTE_MUSTER, findeSchrift, istSichererSchriftname } from './schriften';

// ── Adressen ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Was ein externer Link sein darf. Alles andere (`javascript:`, `data:`, `vbscript:` …) scheitert. */
const ERLAUBTE_PROTOKOLLE = ['https:', 'http:', 'mailto:', 'tel:'];

/** Leerzeichen, Tabs, Zeilenumbrüche oder Steuerzeichen irgendwo im Text? */
export function hatLeerOderSteuerzeichen(text: string): boolean {
  // eslint-disable-next-line no-control-regex -- gerade die Steuerzeichen sollen gefunden werden
  return /[\s\u0000-\u001f\u007f-\u009f]/.test(text);
}

/**
 * Ist das eine erlaubte externe Adresse? Streng: **kein** Trimmen und **keine** Leerzeichen/Steuerzeichen irgendwo –
 * Browser entfernen Tabs und Zeilenumbrüche mitten in der Adresse (`java\tscript:`) und Leerzeichen am Anfang, ein
 * Schema-Vergleich auf dem rohen Text würde das übersehen. Geprüft wird über `URL` (Groß-/Kleinschreibung).
 */
export function istErlaubteAdresse(roh: unknown): boolean {
  if (typeof roh !== 'string' || roh.length === 0 || roh.length > 2000) return false;
  if (hatLeerOderSteuerzeichen(roh)) return false;
  try {
    return ERLAUBTE_PROTOKOLLE.includes(new URL(roh).protocol);
  } catch {
    return false;
  }
}

// ── Bausteine der Schemas ────────────────────────────────────────────────────────────────────────────────────

/** Kleinbuchstaben, Ziffern, Bindestriche – für Seitenpfade und Anker. */
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ANKER_MELDUNG = 'Nur Kleinbuchstaben, Ziffern und Bindestriche (z. B. „termine“).';

/** Anker, die die Seite selbst benutzt – ein Abschnitt darf nicht so heißen. */
export function istReservierterAnker(anker: string): boolean {
  return anker === 'inhalt' || anker.startsWith('w-');
}

/** Eine YouTube-Video-Kennung: genau 11 Zeichen. Alles andere ist keine (und steht nie im HTML). */
export const YOUTUBE_ID_MUSTER = /^[A-Za-z0-9_-]{11}$/;

/** Hex-Farbe `#rgb` oder `#rrggbb` – nur das darf als Farbe in ein `style`-Attribut oder das Theme. */
export const HEX_MUSTER = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
export const hexSchema = z
  .string()
  .regex(HEX_MUSTER, 'Eine Farbe wird als #rgb oder #rrggbb angegeben (z. B. #1f4e79).');

const idSchema = z.string().min(1).max(64);
const zahlSchema = z.number().int().min(0);
const kennungenSchema = z.array(zahlSchema).max(100);

/** Text eines Markdown-Felds – eine Seite muss samt allem in einen Speicherwert (10.000 Zeichen) passen. */
const markdownSchema = z.string().max(8000);

export const linkSchema = z.discriminatedUnion('art', [
  z.object({ art: z.literal('seite'), seiteId: idSchema }),
  /** Sprunglink auf einen Abschnitt derselben Seite (`#anker`). */
  z.object({
    art: z.literal('anker'),
    anker: z.string().min(1).max(60).regex(SLUG, ANKER_MELDUNG),
  }),
  z.object({
    art: z.literal('extern'),
    url: z.string().refine(istErlaubteAdresse, {
      message: 'Erlaubt sind nur Adressen mit https:, http:, mailto: oder tel: (ohne Leerzeichen).',
    }),
  }),
]);
export type Link = z.infer<typeof linkSchema>;

/** Undurchsichtige Bild-Kennung – was die `id` ist, legt W4 fest. Der Renderer bildet nie selbst Adressen. */
export const bildRefSchema = z.object({
  id: z.string().min(1).max(200),
  breite: z.number().int().min(1).max(20000).optional(),
  hoehe: z.number().int().min(1).max(20000).optional(),
});
export type BildRef = z.infer<typeof bildRefSchema>;

const altSchema = z.string().max(300); // Pflichtfeld, darf aber leer sein (reine Zierbilder)
const unterschriftSchema = z.string().max(300).optional();

// ── Bausteine (§3.4) ─────────────────────────────────────────────────────────────────────────────────────────

export const bausteinSchema = z.discriminatedUnion('typ', [
  z.object({
    typ: z.literal('ueberschrift'),
    id: idSchema,
    text: z.string().min(1).max(200),
    ebene: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    groesse: z.enum(['normal', 'gross', 'riesig']),
    /** Ein Punkt in der Akzentfarbe am Ende („ECG-Donrath.“). */
    punkt: z.boolean().optional(),
  }),
  /** Handschrift-Zeile über einer Überschrift („Herzlich willkommen!“). */
  z.object({ typ: z.literal('akzentzeile'), id: idSchema, text: z.string().min(1).max(100) }),
  z.object({ typ: z.literal('text'), id: idSchema, markdown: markdownSchema }),
  z.object({
    typ: z.literal('bild'),
    id: idSchema,
    bild: bildRefSchema,
    alt: altSchema,
    unterschrift: unterschriftSchema,
    /** Das Bild füllt die ganze Spalte (für die Foto-Hälfte neben einer Farbfläche). */
    fuellen: z.boolean().optional(),
  }),
  z.object({
    typ: z.literal('bildText'),
    id: idSchema,
    bild: bildRefSchema,
    alt: altSchema,
    markdown: markdownSchema,
    bildSeite: z.enum(['links', 'rechts']),
  }),
  z.object({
    typ: z.literal('galerie'),
    id: idSchema,
    bilder: z
      .array(z.object({ bild: bildRefSchema, alt: altSchema, unterschrift: unterschriftSchema }))
      .min(1)
      .max(50),
  }),
  /** Eine Reihe von 1 bis 4 Knöpfen. */
  z.object({
    typ: z.literal('knoepfe'),
    id: idSchema,
    knoepfe: z
      .array(
        z.object({
          text: z.string().min(1).max(100),
          ziel: linkSchema,
          art: z.enum(['haupt', 'neben']),
        }),
      )
      .min(1)
      .max(4),
  }),
  z.object({
    typ: z.literal('beitraege'),
    id: idSchema,
    anzahl: z.number().int().min(1).max(20),
    gruppen: kennungenSchema.optional(),
  }),
  z.object({
    typ: z.literal('termine'),
    id: idSchema,
    kalender: z.array(zahlSchema).min(1).max(100),
    anzahl: z.number().int().min(1).max(50),
  }),
  z.object({
    typ: z.literal('slider'),
    id: idSchema,
    intervallSekunden: z.number().int().min(2).max(60).optional(),
  }),
  z.object({
    typ: z.literal('livestream'),
    id: idSchema,
    zeigen: z.enum(['stream', 'archiv', 'beides']),
    archivAnzahl: z.number().int().min(0).max(20),
  }),
  z.object({
    typ: z.literal('kontaktformular'),
    id: idSchema,
    einleitung: z.string().max(2000).optional(),
  }),
  z.object({
    typ: z.literal('gruppenliste'),
    id: idSchema,
    gruppentypen: kennungenSchema.optional(),
  }),
  z.object({ typ: z.literal('trenner'), id: idSchema, art: z.enum(['linie', 'abstand']) }),
  /**
   * **Eigenes HTML – wird unverändert ausgegeben, bewusst NICHT geschützt** (Entscheidung E-W12). Skripte, Stile,
   * Formulare – alles, was hier steht, landet so auf der Seite. Deshalb darf nur die **Leitung** diesen Baustein
   * einfügen oder ändern; das erzwingt W3 (Rechte der Erweiterung), nicht dieses Modell. Die Vorschau in
   * ChurchTools zeigt ihn nur in einem `sandbox`-iframe **ohne** `allow-same-origin`.
   */
  z.object({ typ: z.literal('html'), id: idSchema, html: z.string().max(20_000) }),
]);
export type Baustein = z.infer<typeof bausteinSchema>;
export type BausteinTyp = Baustein['typ'];

/** Alle Typen – aus dem Schema abgeleitet, damit eine zweite Liste nicht auseinanderläuft. */
export const BAUSTEIN_TYPEN: readonly BausteinTyp[] = bausteinSchema.options.map(
  (o) => o.shape.typ.value,
);

// ── Abschnitte, Spalten, Gestaltung (E-W11) ──────────────────────────────────────────────────────────────────

/** Hintergrund eines Abschnitts oder einer Spalte. `grund`/`sanft`/`haupt`/`akzent` sind Farben der Gemeinde. */
export const hintergrundSchema = z.discriminatedUnion('art', [
  z.object({ art: z.literal('grund') }),
  z.object({ art: z.literal('sanft') }),
  z.object({ art: z.literal('haupt') }),
  z.object({ art: z.literal('akzent') }),
  z.object({ art: z.literal('farbe'), farbe: hexSchema }),
  z.object({
    art: z.literal('bild'),
    bild: bildRefSchema,
    /** Wie stark das Bild abgedunkelt wird, damit Text lesbar bleibt: 0 (gar nicht) bis 90 Prozent. */
    abdunkeln: z.number().int().min(0).max(90),
  }),
]);
export type Hintergrund = z.infer<typeof hintergrundSchema>;

export const AUFTEILUNGEN = ['1', '1-1', '2-1', '1-2', '1-1-1', '1-1-1-1'] as const;
export const aufteilungSchema = z.enum(AUFTEILUNGEN);
export type Aufteilung = z.infer<typeof aufteilungSchema>;

/** Wie viele Spalten eine Aufteilung hat – aus dem Namen abgeleitet, damit es keine zweite Liste gibt. */
export function spaltenAnzahl(aufteilung: Aufteilung): number {
  return aufteilung.split('-').length;
}

export const gestaltungSchema = z.object({
  hintergrund: hintergrundSchema,
  /** `auto`: hell auf `haupt`/`akzent`/Bild, sonst dunkel; bei eigener Farbe nach deren Helligkeit. */
  text: z.enum(['auto', 'hell', 'dunkel']),
  abstand: z.enum(['kein', 'klein', 'normal', 'gross']),
  breite: z.enum(['schmal', 'normal', 'breit', 'voll']),
  ausrichtung: z.enum(['links', 'mitte']),
  /** Wie die Spalten nebeneinander stehen. */
  senkrecht: z.enum(['oben', 'mitte']),
  /** `halb`/`voll`: mindestens so hoch wie der halbe bzw. ganze Bildschirm. */
  hoehe: z.enum(['auto', 'halb', 'voll']),
  /** Name für Sprunglinks (`#termine`) – je Seite einmalig (`pruefeWebsite`), nicht `inhalt` oder `w-…`. */
  anker: z
    .string()
    .min(1)
    .max(60)
    .regex(SLUG, ANKER_MELDUNG)
    .refine((a) => !istReservierterAnker(a), {
      message:
        'Dieser Anker ist von der Seite selbst belegt („inhalt“ und alles mit „w-“ am Anfang).',
    })
    .optional(),
});
export type Gestaltung = z.infer<typeof gestaltungSchema>;

/** Die Gestaltung eines neuen, schlichten Abschnitts. */
export const STANDARD_GESTALTUNG: Gestaltung = {
  hintergrund: { art: 'grund' },
  text: 'auto',
  abstand: 'normal',
  breite: 'normal',
  ausrichtung: 'links',
  senkrecht: 'oben',
  hoehe: 'auto',
};

export const spalteSchema = z.object({
  id: idSchema,
  bausteine: z.array(bausteinSchema).max(100),
  /** Eigener Hintergrund nur dieser Spalte. */
  hintergrund: hintergrundSchema.optional(),
  /** Auf dem Handy (Spalten untereinander) vor die anderen holen. */
  handyZuerst: z.boolean().optional(),
});
export type Spalte = z.infer<typeof spalteSchema>;

export const abschnittSchema = z
  .object({
    id: idSchema,
    /** Nur Information: aus welcher Vorlage der Abschnitt entstand (`vorlagen.ts`). Wirkt auf nichts. */
    vorlage: z.string().min(1).max(64).optional(),
    gestaltung: gestaltungSchema,
    aufteilung: aufteilungSchema,
    spalten: z.array(spalteSchema).min(1).max(4),
  })
  .superRefine((a, ctx) => {
    const soll = spaltenAnzahl(a.aufteilung);
    if (a.spalten.length !== soll) {
      ctx.addIssue({
        code: 'custom',
        path: ['spalten'],
        message: `Die Aufteilung „${a.aufteilung}“ braucht ${soll} ${soll === 1 ? 'Spalte' : 'Spalten'}, es sind aber ${a.spalten.length}.`,
      });
    }
  });
export type Abschnitt = z.infer<typeof abschnittSchema>;

// ── Seite, Menü, Einstellungen ───────────────────────────────────────────────────────────────────────────────

export const seiteSchema = z.object({
  id: idSchema,
  titel: z.string().min(1).max(150),
  pfad: z
    .string()
    .min(1)
    .max(80)
    .regex(SLUG, 'Nur Kleinbuchstaben, Ziffern und Bindestriche (z. B. „unsere-gruppen“).'),
  beschreibung: z.string().max(300).optional(),
  startseite: z.boolean().optional(),
  abschnitte: z.array(abschnittSchema).max(50),
});
export type Seite = z.infer<typeof seiteSchema>;

const menuePunktSchema = z.object({ titel: z.string().min(1).max(60), ziel: linkSchema });
const menueEintragSchema = menuePunktSchema.extend({
  /** Höchstens eine Unterebene – die Unterpunkte haben selbst kein `unter`. */
  unter: z.array(menuePunktSchema).max(20).optional(),
});
export type MenueEintrag = z.infer<typeof menueEintragSchema>;

export const menueSchema = z.object({ eintraege: z.array(menueEintragSchema).max(30) });
export type Menue = z.infer<typeof menueSchema>;

/** Farben der Gemeinde. Fehlt `hauptTief`, leitet das Theme es aus `haupt` ab (`color-mix`). */
export const farbenSchema = z.object({
  haupt: hexSchema,
  hauptTief: hexSchema.optional(),
  akzent: hexSchema,
  grund: hexSchema,
  sanft: hexSchema,
  text: hexSchema,
});
export type Farben = z.infer<typeof farbenSchema>;

/** Eine Schrift: aus der festen Auswahl (`schriften.ts`) oder eine eigene, hochgeladene Datei. */
export const schriftSchema = z.discriminatedUnion('art', [
  z.object({
    art: z.literal('auswahl'),
    name: z.string().refine((n) => findeSchrift(n) !== undefined, {
      message: 'Diese Schrift gibt es in der Auswahl nicht.',
    }),
  }),
  z.object({
    art: z.literal('eigene'),
    name: z.string().refine(istSichererSchriftname, {
      message:
        'Der Schriftname darf nur Buchstaben, Ziffern, Leerzeichen und Bindestriche enthalten.',
    }),
    /** Kennung der hochgeladenen Datei – was sie ist, legt W4 fest; die Adresse bildet der Kontext. */
    datei: z.string().min(1).max(200),
    /** `font-weight`: `400` oder ein Bereich wie `300 700`. */
    gewichte: z.string().regex(GEWICHTE_MUSTER, 'Gewichte als „400“ oder „300 700“.').optional(),
  }),
]);
export type SchriftWahl = z.infer<typeof schriftSchema>;

export const schriftenSchema = z.object({
  text: schriftSchema,
  ueberschrift: schriftSchema,
  /** Für die Handschrift-Zeile; fehlt sie, nimmt die Akzentzeile die Überschrift-Schrift. */
  akzent: schriftSchema.optional(),
});
export type Schriften = z.infer<typeof schriftenSchema>;

export const einstellungenSchema = z.object({
  /** Name der Gemeinde – Titel-Zusatz („Seite – Name“) und Logo-Alternativtext. */
  name: z.string().min(1).max(100),
  logo: bildRefSchema.optional(),
  /** Links in der Fußzeile (Impressum, Datenschutz …). */
  fusszeile: z.array(z.object({ titel: z.string().min(1).max(60), ziel: linkSchema })).max(10),
  /** Test-Adresse: Suchmaschinen sollen sie nicht aufnehmen. */
  noindex: z.boolean(),
  /** Wohin das Kontaktformular sendet (`https:`/`http:`). Ohne Adresse zeigt der Baustein einen Hinweis. */
  kontaktAdresse: z
    .string()
    .refine((a) => /^https?:/i.test(a) && istErlaubteAdresse(a), {
      message: 'Die Adresse für das Kontaktformular muss mit https:// beginnen.',
    })
    .optional(),
  sprache: z
    .string()
    .regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, 'Sprachkürzel wie „de“.')
    .default('de'),
  /** Farben; ohne Angabe gelten neutrale Vorgaben (`NEUTRALE_FARBEN`). */
  farben: farbenSchema.optional(),
  /** Schriften; ohne Angabe die Systemschrift (nichts wird geladen). */
  schriften: schriftenSchema.optional(),
  /**
   * **Eigenes CSS – wird bewusst nicht geprüft**, nur am Ausbruch aus dem `<style>` gehindert (jedes `</` wird
   * entschärft). Es kann das ganze Aussehen verändern und Adressen laden. Nur die **Leitung** darf es setzen (E-W12) –
   * das erzwingt W3. Hinweis: ein Speicherwert fasst 10.000 Zeichen; die Aufteilung auf mehrere Werte ist Sache von W3.
   */
  eigenesCss: z.string().max(20_000).optional(),
  /** Einwilligung für YouTube: optional ein eigener Text für das Banner (sonst der Standardtext). */
  einwilligung: z.object({ youtubeText: z.string().min(1).max(600).optional() }).optional(),
  /**
   * Wohin der Datenschutz-Link im Einwilligungs-Banner und in der Video-Sperre zeigt. **Eigenes Feld** statt „den
   * Fußzeilen-Eintrag mit dem passenden Titel suchen“: Eine Titel-Suche würde bei „Datenschutzerklärung“, „Privacy“
   * oder einer anderen Sprache still ins Leere laufen. `pruefeWebsite` meldet, wenn ein Livestream-Baustein da ist,
   * aber der Link fehlt.
   */
  datenschutz: linkSchema.optional(),
});
export type Einstellungen = z.infer<typeof einstellungenSchema>;

// ── Speicherformat ───────────────────────────────────────────────────────────────────────────────────────────

/** Wie `EINSTELLUNGEN_KENNUNG` der Anmeldungen: Präfix mit Version, damit spätere Formate erkennbar bleiben. */
export const WEBSITE_KENNUNG = 'website:v1:';

/**
 * Gemessene Grenze eines ChurchTools-Speicherwerts: **10.000 Zeichen** (Zeichen, nicht Bytes; Messung W0,
 * 19.11.2026). Gezählt wird `string.length` (UTF-16-Einheiten) – das ist nie weniger als die Zahl der Zeichen, die
 * Prüfung ist also eher zu streng als zu lax. Aufteilen auf mehrere Werte ist Sache von W3.
 */
export const WERT_MAX_ZEICHEN = 10_000;

/** Passt der gespeicherte Text in einen Wert? */
export function passtInEinenWert(text: string): boolean {
  return text.length <= WERT_MAX_ZEICHEN;
}

export type LeseFehler = 'kein-praefix' | 'neuere-version' | 'kein-json' | 'ungueltig';
export type LeseErgebnis<T> =
  | { ok: true; wert: T }
  | { ok: false; fehler: LeseFehler; meldung: string };

function alsText(wert: unknown): string {
  return WEBSITE_KENNUNG + JSON.stringify(wert);
}

function ausText<S extends z.ZodType>(
  text: string,
  schema: S,
  was: string,
): LeseErgebnis<z.infer<S>> {
  const version = /^website:v(\d+):/.exec(text);
  if (!version) {
    return {
      ok: false,
      fehler: 'kein-praefix',
      meldung: `Das ist kein gespeicherter Website-Inhalt (${was}): Die Kennung „${WEBSITE_KENNUNG}“ fehlt.`,
    };
  }
  const nummer = Number(version[1]);
  if (nummer > 1) {
    return {
      ok: false,
      fehler: 'neuere-version',
      meldung: `Dieser Inhalt (${was}) stammt aus einer neueren Version der Website-Erweiterung (Format v${nummer}). Bitte die Erweiterung aktualisieren, bevor etwas gespeichert wird.`,
    };
  }
  if (nummer < 1) {
    return {
      ok: false,
      fehler: 'kein-praefix',
      meldung: `Unbekanntes Format v${nummer} (${was}).`,
    };
  }
  let roh: unknown;
  try {
    roh = JSON.parse(text.slice(version[0].length));
  } catch {
    return {
      ok: false,
      fehler: 'kein-json',
      meldung: `Der gespeicherte Inhalt (${was}) ist beschädigt und lässt sich nicht lesen.`,
    };
  }
  const r = schema.safeParse(roh);
  if (!r.success) {
    const stelle = r.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.') || 'Inhalt'}: ${i.message}`)
      .join('; ');
    return {
      ok: false,
      fehler: 'ungueltig',
      meldung: `Der gespeicherte Inhalt (${was}) ist nicht gültig – ${stelle}`,
    };
  }
  return { ok: true, wert: r.data };
}

export const seiteAlsText = (seite: Seite): string => alsText(seite);
export const seiteAusText = (text: string): LeseErgebnis<Seite> =>
  ausText(text, seiteSchema, 'Seite');
export const menueAlsText = (menue: Menue): string => alsText(menue);
export const menueAusText = (text: string): LeseErgebnis<Menue> =>
  ausText(text, menueSchema, 'Menü');
export const einstellungenAlsText = (e: Einstellungen): string => alsText(e);
export const einstellungenAusText = (text: string): LeseErgebnis<Einstellungen> =>
  ausText(text, einstellungenSchema, 'Einstellungen');

// ── Gesamtprüfung ────────────────────────────────────────────────────────────────────────────────────────────

export type Hinweis = {
  art: 'startseite' | 'pfad' | 'id' | 'anker' | 'link';
  meldung: string;
};

/** Jeder Baustein einer Seite, in der Reihenfolge der Seite. */
export function bausteineDerSeite(seite: Seite): Baustein[] {
  return seite.abschnitte.flatMap((a) => a.spalten.flatMap((s) => s.bausteine));
}

type LinkStelle = { wo: string; link: Link; seite?: Seite };

/** Alle Links, die auf eine Seite zeigen können: Menü, Fußzeile, Datenschutz und Knöpfe. */
function seitenLinks(seiten: Seite[], menue: Menue, einstellungen: Einstellungen): LinkStelle[] {
  const aus: LinkStelle[] = [];
  for (const e of menue.eintraege) {
    aus.push({ wo: `Menü „${e.titel}“`, link: e.ziel });
    for (const u of e.unter ?? []) aus.push({ wo: `Menü „${e.titel} › ${u.titel}“`, link: u.ziel });
  }
  for (const f of einstellungen.fusszeile) aus.push({ wo: `Fußzeile „${f.titel}“`, link: f.ziel });
  if (einstellungen.datenschutz)
    aus.push({ wo: 'Datenschutz-Link', link: einstellungen.datenschutz });
  for (const s of seiten) {
    for (const b of bausteineDerSeite(s)) {
      if (b.typ !== 'knoepfe') continue;
      for (const k of b.knoepfe)
        aus.push({ wo: `Knopf „${k.text}“ auf Seite „${s.titel}“`, link: k.ziel, seite: s });
    }
  }
  return aus;
}

/** Wie oft kommt jeder Wert vor? Nur die, die mehrfach vorkommen. */
function doppelte(werte: string[]): string[] {
  return [...new Set(werte.filter((w, i, alle) => alle.indexOf(w) !== i))];
}

/**
 * Fehlt der Datenschutz-Link, obwohl ihn etwas braucht? Ein **Livestream-Baustein** zeigt Banner und Video-Sperre – beide
 * verweisen darauf. EINE Regel für die Gesamtprüfung (`pruefeWebsite`) und den Hinweis im Fenster „Einstellungen“.
 */
export function datenschutzFehlt(seiten: readonly Seite[], einstellungen: Einstellungen): boolean {
  return (
    !einstellungen.datenschutz &&
    seiten.some((s) => bausteineDerSeite(s).some((b) => b.typ === 'livestream'))
  );
}

/**
 * **Hängt das alles zusammen?** Genau eine Startseite, keine doppelten Pfade, IDs und Anker, jeder Link trifft ein
 * Ziel, das es gibt. Liefert verständliche Hinweise (leer = alles in Ordnung); gebaut werden darf nur ohne Hinweise.
 */
export function pruefeWebsite(
  seiten: Seite[],
  menue: Menue,
  einstellungen: Einstellungen,
): Hinweis[] {
  const hinweise: Hinweis[] = [];

  const starts = seiten.filter((s) => s.startseite);
  if (starts.length === 0) {
    hinweise.push({ art: 'startseite', meldung: 'Es ist keine Startseite festgelegt.' });
  } else if (starts.length > 1) {
    hinweise.push({
      art: 'startseite',
      meldung: `Es gibt ${starts.length} Startseiten (${starts.map((s) => `„${s.titel}“`).join(', ')}) – erlaubt ist genau eine.`,
    });
  }

  const pfade = new Map<string, string[]>();
  const ids = new Map<string, string[]>();
  for (const s of seiten) {
    pfade.set(s.pfad, [...(pfade.get(s.pfad) ?? []), s.titel]);
    ids.set(s.id, [...(ids.get(s.id) ?? []), s.titel]);
  }
  for (const [pfad, titel] of pfade) {
    if (titel.length > 1) {
      hinweise.push({
        art: 'pfad',
        meldung: `Der Pfad „${pfad}“ wird von mehreren Seiten benutzt (${titel.map((t) => `„${t}“`).join(', ')}).`,
      });
    }
  }
  for (const [id, titel] of ids) {
    if (titel.length > 1) {
      hinweise.push({
        art: 'id',
        meldung: `Die Seiten-ID „${id}“ kommt mehrfach vor (${titel.map((t) => `„${t}“`).join(', ')}).`,
      });
    }
  }
  for (const s of seiten) {
    // Abschnitte, Spalten und Bausteine teilen sich EINEN Namensraum je Seite.
    const alleIds = s.abschnitte.flatMap((a) => [
      a.id,
      ...a.spalten.flatMap((sp) => [sp.id, ...sp.bausteine.map((b) => b.id)]),
    ]);
    for (const id of doppelte(alleIds)) {
      hinweise.push({
        art: 'id',
        meldung: `Auf Seite „${s.titel}“ kommt die ID „${id}“ mehrfach vor (Abschnitt, Spalte oder Baustein).`,
      });
    }
    for (const anker of doppelte(s.abschnitte.flatMap((a) => a.gestaltung.anker ?? []))) {
      hinweise.push({
        art: 'anker',
        meldung: `Auf Seite „${s.titel}“ ist der Anker „${anker}“ mehrfach vergeben.`,
      });
    }
  }

  const vorhanden = new Set(seiten.map((s) => s.id));
  for (const { wo, link, seite } of seitenLinks(seiten, menue, einstellungen)) {
    if (link.art === 'seite' && !vorhanden.has(link.seiteId)) {
      hinweise.push({ art: 'link', meldung: `${wo} zeigt auf eine Seite, die es nicht gibt.` });
    } else if (link.art === 'anker') {
      if (!seite) {
        hinweise.push({
          art: 'link',
          meldung: `${wo} ist ein Sprunglink – der gehört in einen Knopf auf einer Seite, nicht hierhin.`,
        });
      } else if (!seite.abschnitte.some((a) => a.gestaltung.anker === link.anker)) {
        hinweise.push({
          art: 'link',
          meldung: `${wo} springt zu „${link.anker}“, aber diesen Anker hat auf der Seite kein Abschnitt.`,
        });
      }
    }
  }

  if (datenschutzFehlt(seiten, einstellungen)) {
    hinweise.push({
      art: 'link',
      meldung:
        'Es gibt einen Livestream, aber in den Einstellungen ist kein Datenschutz-Link angegeben – Banner und Video-Sperre brauchen ihn.',
    });
  }
  return hinweise;
}
