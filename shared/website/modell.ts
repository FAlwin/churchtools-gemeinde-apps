/**
 * **Inhaltsmodell der Website** (Bauplan Website W1, §3/§3.4).
 *
 * Eine ChurchTools-Erweiterung pflegt Seiten aus Bausteinen, ein Bau-Dienst macht daraus statische HTML-Dateien;
 * Vorschau und Bau benutzen denselben Renderer (`render.ts`). Hier steht nur das Datenmodell: Schemas, Typen, das
 * Speicherformat (`website:v1:` + JSON, je Einheit ein Wert) und die Gesamtprüfung.
 *
 * Gemeindeneutral: nichts Festes von einer Gemeinde. Name, Logo, Links und Adresse des Kontaktformulars kommen aus den
 * `Einstellungen`; Farben und Schriften (W2) kommen später als **optionale** Felder dazu.
 */
import { z } from 'zod';

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

const idSchema = z.string().min(1).max(64);
const zahlSchema = z.number().int().min(0);
const kennungenSchema = z.array(zahlSchema).max(100);

/** Text eines Markdown-Felds – eine Seite muss samt allem in einen Speicherwert (10.000 Zeichen) passen. */
const markdownSchema = z.string().max(8000);

export const linkSchema = z.discriminatedUnion('art', [
  z.object({ art: z.literal('seite'), seiteId: idSchema }),
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
    ebene: z.union([z.literal(2), z.literal(3)]),
  }),
  z.object({ typ: z.literal('text'), id: idSchema, markdown: markdownSchema }),
  z.object({
    typ: z.literal('bild'),
    id: idSchema,
    bild: bildRefSchema,
    alt: altSchema,
    unterschrift: unterschriftSchema,
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
  z.object({
    typ: z.literal('knopf'),
    id: idSchema,
    text: z.string().min(1).max(100),
    ziel: linkSchema,
    art: z.enum(['haupt', 'neben']),
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
]);
export type Baustein = z.infer<typeof bausteinSchema>;
export type BausteinTyp = Baustein['typ'];

/** Alle Typen – aus dem Schema abgeleitet, damit eine zweite Liste nicht auseinanderläuft. */
export const BAUSTEIN_TYPEN: readonly BausteinTyp[] = bausteinSchema.options.map(
  (o) => o.shape.typ.value,
);

// ── Seite, Menü, Einstellungen ───────────────────────────────────────────────────────────────────────────────

export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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
  bausteine: z.array(bausteinSchema).max(200),
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
  art: 'startseite' | 'pfad' | 'id' | 'link';
  meldung: string;
};

/** Alle Links, die auf eine Seite zeigen können: Menü, Fußzeile und Knöpfe. */
function seitenLinks(
  seiten: Seite[],
  menue: Menue,
  einstellungen: Einstellungen,
): { wo: string; link: Link }[] {
  const aus: { wo: string; link: Link }[] = [];
  for (const e of menue.eintraege) {
    aus.push({ wo: `Menü „${e.titel}“`, link: e.ziel });
    for (const u of e.unter ?? []) aus.push({ wo: `Menü „${e.titel} › ${u.titel}“`, link: u.ziel });
  }
  for (const f of einstellungen.fusszeile) aus.push({ wo: `Fußzeile „${f.titel}“`, link: f.ziel });
  for (const s of seiten) {
    for (const b of s.bausteine) {
      if (b.typ === 'knopf')
        aus.push({ wo: `Knopf „${b.text}“ auf Seite „${s.titel}“`, link: b.ziel });
    }
  }
  return aus;
}

/**
 * **Hängt das alles zusammen?** Genau eine Startseite, keine doppelten Pfade und IDs, jeder Link auf eine Seite trifft
 * eine vorhandene. Liefert verständliche Hinweise (leer = alles in Ordnung); gebaut werden darf nur ohne Hinweise.
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
    const doppelt = s.bausteine.map((b) => b.id).filter((id, i, alle) => alle.indexOf(id) !== i);
    for (const id of new Set(doppelt)) {
      hinweise.push({
        art: 'id',
        meldung: `Auf Seite „${s.titel}“ kommt die Baustein-ID „${id}“ mehrfach vor.`,
      });
    }
  }

  const vorhanden = new Set(seiten.map((s) => s.id));
  for (const { wo, link } of seitenLinks(seiten, menue, einstellungen)) {
    if (link.art === 'seite' && !vorhanden.has(link.seiteId)) {
      hinweise.push({ art: 'link', meldung: `${wo} zeigt auf eine Seite, die es nicht gibt.` });
    }
  }
  return hinweise;
}
