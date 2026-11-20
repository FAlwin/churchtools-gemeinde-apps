/**
 * **Die Regeln des Fensters „Einstellungen“** (Bauplan Website W3a-3b) – rein, ohne Oberfläche. Das Fenster hält einen
 * **Formular-Entwurf** (`EinstellungenFormular`: Name, Fußzeilen-Links, Datenschutz-Link, Banner-Text); erst „Speichern“
 * macht daraus über `formularAnwenden` ein Einstellungen-Objekt – **nur diese vier Felder ändern sich**, Farben, Schriften,
 * Logo und CSS bleiben, wie sie in der Arbeitskopie gerade sind (der Reiter „Aussehen“ schreibt dieselbe Einheit).
 * Was hier herauskommt, besteht `einstellungenSchema`; ob es das tut, sagt `einstellungenMeldung` in Worten.
 */
import { einstellungenSchema, type Einstellungen, type Link, type Seite } from './modell';
import type { Richtung } from './bearbeiten';

/** Höchstens so viele Links in der Fußzeile – dieselbe Grenze wie im Schema (`einstellungenSchema.fusszeile`). */
export const FUSSZEILE_MAX = 10;

export interface FussLink {
  titel: string;
  ziel: Link;
}

export interface EinstellungenFormular {
  name: string;
  fusszeile: FussLink[];
  datenschutz: Link | null;
  /** Leer = der Standardtext (`BANNER_STANDARDTEXT`). */
  youtubeText: string;
}

/** Was das Fenster beim Öffnen zeigt. */
export function formularAus(e: Einstellungen): EinstellungenFormular {
  return {
    name: e.name,
    fusszeile: e.fusszeile.map((f) => ({ titel: f.titel, ziel: f.ziel })),
    datenschutz: e.datenschutz ?? null,
    youtubeText: e.einwilligung?.youtubeText ?? '',
  };
}

/**
 * Das Formular in die Einstellungen übernehmen – **nur Name, Fußzeile, Datenschutz-Link und Banner-Text**. Ein leerer Banner-
 * Text nimmt den eigenen Text zurück (dann gilt der Standard), ohne Datenschutz-Link fällt das Feld ganz weg. Leerzeichen am
 * Rand von Name, Titeln und Text werden abgeschnitten, Adressen ebenso.
 */
export function formularAnwenden(e: Einstellungen, f: EinstellungenFormular): Einstellungen {
  const { datenschutz: _alt, einwilligung: _einw, ...rest } = e;
  const text = f.youtubeText.trim();
  const ziel = (l: Link): Link => (l.art === 'extern' ? { art: 'extern', url: l.url.trim() } : l);
  const einwilligung = { ...e.einwilligung };
  if (text === '') delete einwilligung.youtubeText;
  else einwilligung.youtubeText = text;
  return {
    ...rest,
    name: f.name.trim(),
    fusszeile: f.fusszeile.map((l) => ({ titel: l.titel.trim(), ziel: ziel(l.ziel) })),
    ...(f.datenschutz ? { datenschutz: ziel(f.datenschutz) } : {}),
    ...(Object.keys(einwilligung).length > 0 ? { einwilligung } : {}),
  };
}

/** Ein neuer Link: auf die erste Seite der Website, sonst auf eine (noch leere) Adresse. */
export function neuerLink(seiten: readonly Seite[], art: 'seite' | 'extern'): Link {
  if (art === 'seite' && seiten.length > 0) {
    const start = seiten.find((s) => s.startseite) ?? seiten[0];
    return { art: 'seite', seiteId: start.id };
  }
  return { art: 'extern', url: '' };
}

/** Einen Link ans Ende der Fußzeile – am Rand (zehn) bleibt sie, wie sie ist. */
export function fusszeileHinzufuegen(
  f: EinstellungenFormular,
  seiten: readonly Seite[],
): EinstellungenFormular {
  if (f.fusszeile.length >= FUSSZEILE_MAX) return f;
  return { ...f, fusszeile: [...f.fusszeile, { titel: '', ziel: neuerLink(seiten, 'seite') }] };
}

export function fusszeileEntfernen(f: EinstellungenFormular, i: number): EinstellungenFormular {
  if (!Number.isInteger(i) || i < 0 || i >= f.fusszeile.length) return f;
  return { ...f, fusszeile: f.fusszeile.filter((_, n) => n !== i) };
}

/** Den Link `i` eine Stelle nach oben oder unten; am Rand: unverändert. */
export function fusszeileVerschieben(
  f: EinstellungenFormular,
  i: number,
  richtung: Richtung,
): EinstellungenFormular {
  const ziel = richtung === 'hoch' ? i - 1 : i + 1;
  const ok = (n: number) => Number.isInteger(n) && n >= 0 && n < f.fusszeile.length;
  if (!ok(i) || !ok(ziel)) return f;
  const fusszeile = [...f.fusszeile];
  [fusszeile[i], fusszeile[ziel]] = [fusszeile[ziel], fusszeile[i]];
  return { ...f, fusszeile };
}

export function fusszeileAendern(
  f: EinstellungenFormular,
  i: number,
  neu: Partial<FussLink>,
): EinstellungenFormular {
  if (!Number.isInteger(i) || i < 0 || i >= f.fusszeile.length) return f;
  return { ...f, fusszeile: f.fusszeile.map((l, n) => (n === i ? { ...l, ...neu } : l)) };
}

/**
 * Warum lassen sich diese Einstellungen nicht speichern – in Worten für Menschen? `null`: Sie bestehen das Schema.
 * Die erste Meldung gilt (wer sie behebt, sieht die nächste). Bei den Feldern dieses Fensters steht dabei, **wo** es hakt.
 */
export function einstellungenMeldung(e: Einstellungen): string | null {
  const r = einstellungenSchema.safeParse(e);
  if (r.success) return null;
  const i = r.error.issues[0];
  const [feld, n, ...weiter] = i.path;
  const stelle = typeof n === 'number' ? `Fußzeile, Link ${n + 1}: ` : '';
  if (feld === 'name') return 'Der Name der Gemeinde darf nicht leer sein (höchstens 100 Zeichen).';
  if (feld === 'fusszeile' && typeof n === 'number') {
    if (weiter[0] === 'titel') return `${stelle}Der Titel fehlt (höchstens 60 Zeichen).`;
    if (weiter.includes('seiteId')) return `${stelle}Bitte eine Seite wählen.`;
    return `${stelle}${i.message}`;
  }
  if (feld === 'fusszeile') return `Die Fußzeile darf höchstens ${FUSSZEILE_MAX} Links haben.`;
  if (feld === 'datenschutz') {
    if (n === 'seiteId') return 'Datenschutz-Link: Bitte eine Seite wählen.';
    return `Datenschutz-Link: ${i.message}`;
  }
  if (feld === 'einwilligung')
    return 'Der Text des YouTube-Banners darf höchstens 600 Zeichen haben.';
  return i.message;
}
