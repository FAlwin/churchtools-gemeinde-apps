/**
 * **Der Renderer der Website** (W1) – reine Logik, kein DOM, keine Uhr, kein Zufall: gleiche Eingabe, gleiche Ausgabe.
 * Vorschau (Erweiterung) und Bau-Dienst benutzen genau diese Datei.
 *
 * Regeln:
 *  - **Alles aus Daten wird geschützt** (`htmlText`/`htmlAttr`); Markdown nur über `markdown.ts`. **Einzige Ausnahme:**
 *    der Baustein „Eigenes HTML“ (`html`) und das „Eigene CSS“ der Einstellungen – sie sind bewusst ungeschützt und nur
 *    für die Leitung gedacht (E-W12, Rechte: W3); das CSS kann aber nicht aus dem `<style>` ausbrechen (`theme.ts`).
 *  - **Keine externen Ressourcen**: Skripte nur der **eine** Verweis auf `kontext.skriptAdresse`, **nie ein iframe** –
 *    das YouTube-Video setzt erst das Skript nach der Zustimmung ein; bis dahin steht dort die Sperre (E-W13).
 *    Keine fremden Schriften (`@font-face` nur mit Adressen vom Kontext). Bilder und Schriften bekommen ihre Adresse
 *    ausschließlich vom Kontext (`bildAdresse`, `schriftAdresse`), der Renderer erfindet keine.
 *  - **`style="…"` nur für eigene Werte** eines Abschnitts oder einer Spalte (Farbe, Abdunkeln) – als CSS-Variablen, die
 *    das Schema auf Hex bzw. Zahlen begrenzt und die hier noch einmal geprüft werden.
 *  - Links aus den Daten werden beim Ausgeben **noch einmal** geprüft (`linkAdresse`) – auch wenn das Schema es schon
 *    tut: Daten kommen aus ChurchTools-Werten, die jemand an der Oberfläche vorbei ändern kann.
 *  - Fehlen Daten der dynamischen Bausteine, steht ein ruhiger Hinweis da statt eines Absturzes.
 *  - Datum und Uhrzeit deutsch in der **Zeitzone der Gemeinde** (`kontext.zeitzone`, #847: keine eigene Zone im Code –
 *    die Vorschau gibt `gemeindeZeitzone()`, der Bau-Dienst die Zone aus der ChurchTools-Konfiguration). Über
 *    `shared/ct/zeit.ts` + `datum.ts`, unabhängig von der Zone des Rechners – die Tests laufen mit `TZ=UTC`.
 *  - Gestaltung ist W2: hier semantisches HTML mit stabilen Klassen (Präfix `w-`, die Namen des abgenommenen
 *    Entwurfs `w2-v1`). **Aufbau einer Seite:** `<section class="w-abschnitt …">` > `<div class="w-abschnitt-innen
 *    w-spalten w-spalten--1-1">` > `<div class="w-spalte …">` > Bausteine (`<div class="w-baustein w-b-<typ>">`).
 *  - **Banner und Fußzeilen-Knopf zur Einwilligung stehen nur auf Seiten, die wirklich ein YouTube-Video zeigen**; das
 *    Skript (Handy-Menü, Einwilligung) ist auf jeder Seite eingebunden. Ohne Skript bleibt alles benutzbar: Menü
 *    sichtbar, Video-Sperre mit Link „Auf YouTube ansehen“.
 */
import { datumText, kachel, tagPunkt } from '../ct/datum';
import { tagAusIso, uhrText } from '../ct/zeit';
import { htmlAttr, htmlText } from './html';
import { markdownZuHtml } from './markdown';
import {
  AUFTEILUNGEN,
  HEX_MUSTER,
  SLUG,
  YOUTUBE_ID_MUSTER,
  bausteineDerSeite,
  istErlaubteAdresse,
  istReservierterAnker,
  type Abschnitt,
  type Aufteilung,
  type Baustein,
  type BildRef,
  type Einstellungen,
  type Hintergrund,
  type Link,
  type Menue,
  type MenueEintrag,
  type Seite,
  type Spalte,
} from './modell';
import { brauchtHellenText, themeCss } from './theme';

/** Breiten, in denen der Bau-Dienst Bilder bereithält (`srcset`). */
export const BILD_BREITEN = [480, 800, 1200, 1600] as const;

// ── Daten der dynamischen Bausteine (neutral, nicht die ChurchTools-Rohform) ─────────────────────────────────

export type Beitrag = {
  id: string;
  titel: string;
  /** Markdown (der Bau-Dienst wandelt die Rohform von ChurchTools vorher um). */
  text: string;
  /** ISO-Zeitpunkt. */
  datum: string;
  bild?: BildRef;
  /** Für den Filter `gruppen` des Bausteins. */
  gruppenId?: number;
};
export type Termin = {
  titel: string;
  /** ISO-Zeitpunkte. */
  beginn: string;
  ende: string;
  ganztaegig: boolean;
  ort?: string;
  kalenderId: number;
};
export type SliderFolie = { bild: BildRef; alt: string; link?: Link };
export type Video = {
  id: string;
  titel: string;
  datum: string;
  vorschaubild?: BildRef;
  /**
   * YouTube-Kennung (genau 11 Zeichen `A–Z a–z 0–9 _ -`, sonst ignoriert). Mit Kennung zeigt der Renderer die
   * **Sperre**; erst das Skript setzt nach der Zustimmung den Player (`youtube-nocookie.com`) ein.
   */
  youtubeId?: string;
  /** Adresse des Videos ohne YouTube (der Bau-Dienst setzt sie; ohne Adresse zeigt die Karte keinen Link). */
  adresse?: string;
};
export type Livestream = { aktuell?: Video; archiv: Video[] };
export type Gruppe = {
  id: number;
  name: string;
  beschreibung?: string;
  gruppentypId: number;
  bild?: BildRef;
};

export type RenderKontext = {
  einstellungen: Einstellungen;
  menue: Menue;
  /** Alle Seiten – zum Auflösen von Seiten-Links. */
  seiten: Seite[];
  /** Adresse einer Seite. Vorschau und Bau bilden sie verschieden; `standardAdresse` ist der Normalfall. */
  adresseVon: (seite: Seite) => string;
  /** Adresse eines Bildes in dieser Breite (der Renderer fragt nur, er baut nie selbst eine). */
  bildAdresse: (bild: BildRef, breite: number) => string;
  /** Adresse der Stylesheet-Datei. */
  stylesheet: string;
  /** Adresse des kleinen Seiten-Skripts (Handy-Menü, Einwilligung) – ein Verweis auf jeder Seite, die Datei selbst liefert der Bau. */
  skriptAdresse: string;
  /** Adresse einer Schriftdatei (`Schrift.datei` bzw. die Kennung einer eigenen Schrift). Der Renderer bildet nie selbst eine. */
  schriftAdresse: (datei: string) => string;
  /** IANA-Zeitzone der Gemeinde für alle Datums- und Uhrzeitangaben (#847). */
  zeitzone: string;
  beitraege?: Beitrag[];
  termine?: Termin[];
  sliderFolien?: SliderFolie[];
  livestream?: Livestream;
  gruppen?: Gruppe[];
};

/** `/` für die Startseite, sonst `/pfad/`. */
export function standardAdresse(seite: Seite): string {
  return seite.startseite ? '/' : `/${seite.pfad}/`;
}

// ── Links und Bilder ─────────────────────────────────────────────────────────────────────────────────────────

/** Adresse eines Links oder `null` (Seite gibt es nicht / externe Adresse nicht erlaubt / Anker unzulässig). */
function linkAdresse(link: Link, k: RenderKontext): string | null {
  if (link.art === 'anker') return SLUG.test(link.anker) ? `#${link.anker}` : null;
  if (link.art === 'seite') {
    const seite = k.seiten.find((s) => s.id === link.seiteId);
    return seite ? k.adresseVon(seite) : null;
  }
  return istErlaubteAdresse(link.url) ? link.url : null;
}

/** Zusatz für Links nach außen. */
function relFuer(link: Link): string {
  return link.art === 'extern' ? ' rel="noopener"' : '';
}

/**
 * Ein Wert aus einer festen Liste, sonst die Vorgabe. Alles, was als **Klassenname** ausgegeben wird (Abstand, Breite,
 * Aufteilung …), geht hier durch: Das Schema lässt nur diese Werte zu, aber Daten kommen aus ChurchTools-Werten, die
 * jemand an der Oberfläche vorbei ändern kann – ein Klassenname darf nie Anführungszeichen oder Tags enthalten.
 */
function aus<T extends string | number>(wert: unknown, erlaubt: readonly T[], vorgabe: T): T {
  return erlaubt.find((e) => e === wert) ?? vorgabe;
}

/** Ein Link als `<a>`; ohne gültiges Ziel nur der Text (nie ein kaputter oder gefährlicher `href`). */
function verweis(link: Link, klasse: string, inhalt: string, k: RenderKontext, extra = ''): string {
  const adresse = linkAdresse(link, k);
  if (adresse === null) return `<span class="${klasse}"${extra}>${inhalt}</span>`;
  return `<a class="${klasse}" href="${htmlAttr(adresse)}"${relFuer(link)}${extra}>${inhalt}</a>`;
}

/** `<img>` mit `srcset` aus den Breiten, die das Bild hergibt; `eager` nur für das erste Bild der Seite. */
function bildTag(
  bild: BildRef,
  alt: string,
  k: RenderKontext,
  eager: boolean,
  klasse = '',
  sizes = '(min-width: 60rem) 60rem, 100vw',
): string {
  let breiten: number[] = BILD_BREITEN.filter((b) => !bild.breite || b <= bild.breite);
  if (breiten.length === 0) breiten = [bild.breite ?? BILD_BREITEN[0]];
  const standard = [...breiten].reverse().find((b) => b <= 800) ?? breiten[0];
  const srcset = breiten.map((b) => `${htmlAttr(k.bildAdresse(bild, b))} ${b}w`).join(', ');
  const masse = bild.breite && bild.hoehe ? ` width="${bild.breite}" height="${bild.hoehe}"` : '';
  const laden = eager ? '' : ' loading="lazy" decoding="async"';
  const cls = klasse ? ` class="${klasse}"` : '';
  return `<img${cls} src="${htmlAttr(k.bildAdresse(bild, standard))}" srcset="${srcset}" sizes="${htmlAttr(sizes)}" alt="${htmlAttr(alt)}"${masse}${laden}>`;
}

// ── Datum ────────────────────────────────────────────────────────────────────────────────────────────────────

/** „14.11.2026“ – der Tag in der Zeitzone der Gemeinde. */
function tagText(iso: string, zeitzone: string): string {
  return tagPunkt(tagAusIso(iso, zeitzone));
}

function terminWann(t: Termin, zeitzone: string): string {
  const uhrzeit = (iso: string) => uhrText(iso, zeitzone);
  const tag = tagAusIso(t.beginn, zeitzone);
  const endTag = tagAusIso(t.ende, zeitzone);
  if (t.ganztaegig) {
    return endTag > tag
      ? `${datumText(tag)} – ${datumText(endTag)}`
      : `${datumText(tag)}, ganztägig`;
  }
  const bis = endTag === tag ? uhrzeit(t.ende) : `${datumText(endTag)}, ${uhrzeit(t.ende)}`;
  return `${datumText(tag)}, ${uhrzeit(t.beginn)} – ${bis} Uhr`;
}

/** Datumskachel: „14“ und „NOV“ – der Tag in der Zeitzone der Gemeinde (`kachel` aus `shared/ct/datum.ts`). */
function terminDatum(t: Termin, zeitzone: string): string {
  const { tag, monat } = kachel(tagAusIso(t.beginn, zeitzone));
  return `<div class="w-termin-datum"><span class="w-tag">${htmlText(tag)}</span><span class="w-monat">${htmlText(monat)}</span></div>`;
}

// ── Bausteine ────────────────────────────────────────────────────────────────────────────────────────────────

function leer(text: string): string {
  return `<p class="w-leer">${htmlText(text)}</p>`;
}

function beitraegeHtml(b: Extract<Baustein, { typ: 'beitraege' }>, k: RenderKontext): string {
  const gewaehlt = (k.beitraege ?? [])
    .filter((x) => !b.gruppen || (x.gruppenId !== undefined && b.gruppen.includes(x.gruppenId)))
    .sort((a, c) => c.datum.localeCompare(a.datum))
    .slice(0, b.anzahl);
  if (gewaehlt.length === 0) return leer('Zurzeit keine Beiträge.');
  const karten = gewaehlt.map(
    (x) =>
      `<article class="w-beitrag">${x.bild ? bildTag(x.bild, '', k, false, 'w-beitrag-bild') : ''}` +
      `<h3 class="w-beitrag-titel">${htmlText(x.titel)}</h3>` +
      `<p class="w-datum"><time datetime="${htmlAttr(x.datum)}">${htmlText(tagText(x.datum, k.zeitzone))}</time></p>` +
      `<div class="w-beitrag-text">${markdownZuHtml(x.text)}</div></article>`,
  );
  return `<div class="w-beitraege">${karten.join('\n')}</div>`;
}

function termineHtml(b: Extract<Baustein, { typ: 'termine' }>, k: RenderKontext): string {
  const gewaehlt = (k.termine ?? [])
    .filter((t) => b.kalender.includes(t.kalenderId))
    .sort((a, c) => a.beginn.localeCompare(c.beginn))
    .slice(0, b.anzahl);
  if (gewaehlt.length === 0) return leer('Zurzeit keine Termine.');
  const zeilen = gewaehlt.map(
    (t) =>
      `<li class="w-termin">${terminDatum(t, k.zeitzone)}<div><h3 class="w-termin-titel">${htmlText(t.titel)}</h3>` +
      `<p class="w-termin-wann"><time datetime="${htmlAttr(t.beginn)}">${htmlText(terminWann(t, k.zeitzone))}</time></p>` +
      (t.ort ? `<p class="w-ort">${htmlText(t.ort)}</p>` : '') +
      '</div></li>',
  );
  return `<ul class="w-termine">${zeilen.join('\n')}</ul>`;
}

function sliderHtml(
  b: Extract<Baustein, { typ: 'slider' }>,
  k: RenderKontext,
  ersteBild: boolean,
): string {
  const folien = k.sliderFolien ?? [];
  if (folien.length === 0) return '';
  const intervall = b.intervallSekunden ? ` data-intervall="${b.intervallSekunden}"` : '';
  const eintraege = folien.map((f, i) => {
    const bild = bildTag(f.bild, f.alt, k, ersteBild && i === 0);
    return f.link ? verweis(f.link, 'w-folie', bild, k) : `<div class="w-folie">${bild}</div>`;
  });
  return `<div class="w-slider"${intervall}>${eintraege.join('')}</div>`;
}

// ── Livestream und YouTube-Einwilligung (E-W13) ──────────────────────────────────────────────────────────────

/** Die gültige YouTube-Kennung oder `null` – eine Kennung, die nicht passt, wird behandelt, als gäbe es keine. */
function gueltigeYoutubeId(id: string | undefined): string | null {
  return typeof id === 'string' && YOUTUBE_ID_MUSTER.test(id) ? id : null;
}

/** Text in der Video-Sperre. */
const SPERRE_TEXT =
  'Beim Abspielen wird der Player von YouTube geladen und es werden Daten an Google übertragen.';

/** Standardtext des Banners (die Gemeinde kann ihn in den Einstellungen ersetzen). */
export const BANNER_STANDARDTEXT =
  'Videos auf dieser Seite zeigen wir über YouTube. Dabei werden Daten an Google übertragen. Ohne deine Zustimmung siehst du nur ein Vorschaubild.';

/** Welche Videos zeigt dieser Livestream-Baustein? **Eine** Auswahl für die Ausgabe und für „zeigt die Seite YouTube?“. */
function livestreamVideos(
  b: Extract<Baustein, { typ: 'livestream' }>,
  k: RenderKontext,
): { aktuell?: Video; archiv: Video[] } {
  const stream = k.livestream;
  const archiv =
    b.zeigen === 'stream'
      ? []
      : (stream?.archiv ?? [])
          .slice()
          .sort((a, c) => c.datum.localeCompare(a.datum))
          .slice(0, b.archivAnzahl);
  return { aktuell: b.zeigen === 'archiv' ? undefined : stream?.aktuell, archiv };
}

/** Link zum Datenschutz (`einstellungen.datenschutz`) als `<a>`; ohne gültiges Ziel leerer Text. */
function datenschutzLink(text: string, k: RenderKontext): string {
  const ziel = k.einstellungen.datenschutz;
  const adresse = ziel ? linkAdresse(ziel, k) : null;
  return adresse === null
    ? ''
    : `<a href="${htmlAttr(adresse)}"${ziel ? relFuer(ziel) : ''}>${htmlText(text)}</a>`;
}

/**
 * Ein Video mit YouTube-Kennung als **Sperre**: Vorschaubild, Abspiel-Knopf, Hinweis mit Datenschutz-Link und dem Link
 * „Auf YouTube ansehen“ (der geht auch ohne Skript). `data-youtube` trägt die Kennung – das Skript ersetzt nach der
 * Zustimmung `.w-video-sperre` durch das iframe. **Der Renderer gibt nie selbst ein iframe aus.**
 */
function videoSperre(v: Video, id: string, k: RenderKontext): string {
  const bild = v.vorschaubild ? bildTag(v.vorschaubild, '', k, false, 'w-video-bild') : '';
  const datenschutz = datenschutzLink('Datenschutz', k);
  const ansehen = `<a href="https://www.youtube.com/watch?v=${htmlAttr(id)}" rel="noopener">Auf YouTube ansehen</a>`;
  return (
    `<div class="w-video" data-youtube="${htmlAttr(id)}">${bild}` +
    `<div class="w-video-sperre"><strong class="w-video-titel">${htmlText(v.titel)}</strong>` +
    `<button type="button" class="w-play" data-video-start aria-label="YouTube erlauben und abspielen"></button>` +
    `<small>${htmlText(SPERRE_TEXT)} ${datenschutz ? `${datenschutz} · ` : ''}${ansehen}</small>` +
    '</div></div>'
  );
}

function videoKarte(v: Video, k: RenderKontext): string {
  const datum = `<p class="w-datum"><time datetime="${htmlAttr(v.datum)}">${htmlText(tagText(v.datum, k.zeitzone))}</time></p>`;
  const id = gueltigeYoutubeId(v.youtubeId);
  if (id) return `<article class="w-videokarte">${videoSperre(v, id, k)}${datum}</article>`;
  const bild = v.vorschaubild ? bildTag(v.vorschaubild, '', k, false, 'w-video-bild') : '';
  const titel = htmlText(v.titel);
  const sicher = v.adresse && istErlaubteAdresse(v.adresse) ? v.adresse : null;
  const kopf = sicher
    ? `<a class="w-video-link" href="${htmlAttr(sicher)}" rel="noopener">${bild}<span class="w-video-titel">${titel}</span></a>`
    : `${bild}<span class="w-video-titel">${titel}</span>`;
  return `<article class="w-videokarte">${kopf}${datum}</article>`;
}

function livestreamHtml(b: Extract<Baustein, { typ: 'livestream' }>, k: RenderKontext): string {
  const { aktuell, archiv } = livestreamVideos(b, k);
  const teile: string[] = [];
  if (b.zeigen !== 'archiv') {
    teile.push(
      aktuell
        ? `<div class="w-stream-aktuell"><h3>Livestream</h3>${videoKarte(aktuell, k)}</div>`
        : leer('Zurzeit kein Livestream.'),
    );
  }
  if (b.zeigen !== 'stream') {
    teile.push(
      archiv.length > 0
        ? `<div class="w-stream-archiv"><h3>Aufzeichnungen</h3><div class="w-videos">${archiv.map((v) => videoKarte(v, k)).join('\n')}</div></div>`
        : leer('Zurzeit keine Aufzeichnungen.'),
    );
  }
  return teile.join('\n');
}

/** Zeigt die Seite mindestens ein Video mit gültiger YouTube-Kennung (also eine Sperre)? */
function zeigtYoutube(seite: Seite, k: RenderKontext): boolean {
  return bausteineDerSeite(seite).some((b) => {
    if (b.typ !== 'livestream') return false;
    const { aktuell, archiv } = livestreamVideos(b, k);
    return [...(aktuell ? [aktuell] : []), ...archiv].some((v) => gueltigeYoutubeId(v.youtubeId));
  });
}

function kontaktHtml(b: Extract<Baustein, { typ: 'kontaktformular' }>, k: RenderKontext): string {
  const einleitung = b.einleitung
    ? `<div class="w-kontakt-text">${markdownZuHtml(b.einleitung)}</div>`
    : '';
  const ziel = k.einstellungen.kontaktAdresse;
  if (!ziel) return einleitung + leer('Das Kontaktformular ist noch nicht eingerichtet.');
  const id = htmlAttr(b.id);
  return (
    einleitung +
    `<form class="w-formular" method="post" action="${htmlAttr(ziel)}">` +
    `<p><label for="${id}-name">Name</label><input class="w-feld" type="text" id="${id}-name" name="name" required autocomplete="name"></p>` +
    `<p><label for="${id}-email">E-Mail</label><input class="w-feld" type="email" id="${id}-email" name="email" required autocomplete="email"></p>` +
    `<p><label for="${id}-nachricht">Nachricht</label><textarea class="w-feld" id="${id}-nachricht" name="nachricht" rows="6" required></textarea></p>` +
    // Honigtopf: Menschen sehen ihn nicht (`hidden`), Bots füllen ihn aus – die Annahme-Stelle verwirft dann.
    `<div class="w-honig" hidden aria-hidden="true"><label for="${id}-web">Bitte leer lassen</label><input type="text" id="${id}-web" name="website" tabindex="-1" autocomplete="off"></div>` +
    `<p><button class="w-knopf" type="submit">Absenden</button></p></form>`
  );
}

function gruppenHtml(b: Extract<Baustein, { typ: 'gruppenliste' }>, k: RenderKontext): string {
  const sortierer = new Intl.Collator('de');
  const gewaehlt = (k.gruppen ?? [])
    .filter((g) => !b.gruppentypen || b.gruppentypen.includes(g.gruppentypId))
    .sort((a, c) => sortierer.compare(a.name, c.name));
  if (gewaehlt.length === 0) return leer('Zurzeit keine Gruppen.');
  const karten = gewaehlt.map(
    (g) =>
      `<li class="w-gruppe">${g.bild ? bildTag(g.bild, '', k, false, 'w-gruppe-bild') : ''}` +
      `<h3 class="w-gruppe-name">${htmlText(g.name)}</h3>` +
      (g.beschreibung
        ? `<p class="w-gruppe-text w-text-weich">${htmlText(g.beschreibung)}</p>`
        : '') +
      '</li>',
  );
  return `<ul class="w-gruppen">${karten.join('\n')}</ul>`;
}

/** Wird der `switch` unten um einen Typ ergänzt vergessen, scheitert die Typprüfung hier. */
function unbekannterTyp(_baustein: never): string {
  return '';
}

/** Hat der Baustein ein Bild, das als erstes der Seite sofort geladen werden soll? */
function hatBild(b: Baustein, k: RenderKontext): boolean {
  if (b.typ === 'bild' || b.typ === 'bildText' || b.typ === 'galerie') return true;
  return b.typ === 'slider' && (k.sliderFolien?.length ?? 0) > 0;
}

/**
 * Ein Baustein als HTML (für die Seite und für Vorschauen einzelner Bausteine). `ersteBild`: das erste Bild der
 * Seite lädt sofort, alle anderen träge (`loading="lazy"`).
 */
export function renderBaustein(baustein: Baustein, k: RenderKontext, ersteBild = false): string {
  const huelle = (inhalt: string) => `<div class="w-baustein w-b-${baustein.typ}">${inhalt}</div>`;
  switch (baustein.typ) {
    case 'ueberschrift': {
      const klasse =
        baustein.groesse === 'riesig'
          ? 'w-ueberschrift w-ueberschrift--riesig w-schriftzug'
          : baustein.groesse === 'gross'
            ? 'w-ueberschrift w-ueberschrift--gross'
            : 'w-ueberschrift';
      const punkt = baustein.punkt ? '<span class="w-punkt">.</span>' : '';
      const ebene = aus(baustein.ebene, [1, 2, 3] as const, 2);
      return huelle(`<h${ebene} class="${klasse}">${htmlText(baustein.text)}${punkt}</h${ebene}>`);
    }
    case 'akzentzeile':
      return huelle(`<span class="w-akzent">${htmlText(baustein.text)}</span>`);
    case 'text':
      return huelle(`<div class="w-text">${markdownZuHtml(baustein.markdown)}</div>`);
    case 'bild': {
      const fuellen = baustein.fuellen === true;
      return huelle(
        `<figure class="w-bild${fuellen ? ' w-bild--fuellen' : ''}">${bildTag(
          baustein.bild,
          baustein.alt,
          k,
          ersteBild,
          '',
          fuellen ? '100vw' : undefined,
        )}` +
          (baustein.unterschrift
            ? `<figcaption>${htmlText(baustein.unterschrift)}</figcaption>`
            : '') +
          '</figure>',
      );
    }
    case 'bildText':
      return huelle(
        `<div class="w-bildtext w-bildtext-${aus(baustein.bildSeite, ['links', 'rechts'] as const, 'links')}">` +
          `<figure class="w-bildtext-bild">${bildTag(baustein.bild, baustein.alt, k, ersteBild)}</figure>` +
          `<div class="w-text">${markdownZuHtml(baustein.markdown)}</div></div>`,
      );
    case 'galerie':
      return huelle(
        `<ul class="w-galerie">${baustein.bilder
          .map(
            (g, i) =>
              `<li><figure>${bildTag(g.bild, g.alt, k, ersteBild && i === 0)}` +
              (g.unterschrift ? `<figcaption>${htmlText(g.unterschrift)}</figcaption>` : '') +
              '</figure></li>',
          )
          .join('')}</ul>`,
      );
    case 'knoepfe':
      return huelle(
        `<div class="w-knopfreihe">${baustein.knoepfe
          .map((n) =>
            verweis(
              n.ziel,
              n.art === 'neben' ? 'w-knopf w-knopf--neben' : 'w-knopf',
              htmlText(n.text),
              k,
            ),
          )
          .join('')}</div>`,
      );
    case 'beitraege':
      return huelle(beitraegeHtml(baustein, k));
    case 'termine':
      return huelle(termineHtml(baustein, k));
    case 'slider':
      return huelle(sliderHtml(baustein, k, ersteBild));
    case 'livestream':
      return huelle(livestreamHtml(baustein, k));
    case 'kontaktformular':
      return huelle(kontaktHtml(baustein, k));
    case 'gruppenliste':
      return huelle(gruppenHtml(baustein, k));
    case 'trenner':
      return huelle(
        baustein.art === 'linie'
          ? '<hr class="w-trenner">'
          : '<div class="w-abstand" aria-hidden="true"></div>',
      );
    case 'html':
      // BEWUSST UNGESCHÜTZT (E-W12): Der Inhalt wird unverändert ausgegeben. Wer ihn einfügen darf, regelt W3 (nur
      // Leitung); die Vorschau zeigt ihn nur in einem sandbox-iframe ohne `allow-same-origin`.
      return huelle(baustein.html);
    default:
      return unbekannterTyp(baustein);
  }
}

// ── Abschnitte und Spalten ───────────────────────────────────────────────────────────────────────────────────

/** Wer das erste Bild der Seite sofort laden darf – wird beim Durchlaufen der Abschnitte weitergereicht. */
type BildZaehler = { offen: boolean };

/** Nimmt das „erste Bild“ in Anspruch: `true` genau einmal, für das erste Element mit Bild. */
function ersterBildPlatz(z: BildZaehler, hatEinBild: boolean): boolean {
  const eager = z.offen && hatEinBild;
  if (eager) z.offen = false;
  return eager;
}

/** Text auf diesem Hintergrund hell? (Spalten ohne eigenen Hintergrund erben vom Abschnitt.) */
function textHellAuf(h: Hintergrund): boolean {
  switch (h.art) {
    case 'haupt':
    case 'akzent':
    case 'bild':
      return true;
    case 'farbe':
      return brauchtHellenText(h.farbe);
    default:
      return false; // grund, sanft
  }
}

/** Klassen, `style`-Variablen und Hintergrundbild für einen Hintergrund. `praefix`: `w-abschnitt` oder `w-spalte`. */
function hintergrundTeile(
  h: Hintergrund,
  praefix: string,
  k: RenderKontext,
  z: BildZaehler,
): { klassen: string[]; stil: string[]; bild: string } {
  switch (h.art) {
    case 'grund':
      return { klassen: [], stil: [], bild: '' };
    case 'sanft':
    case 'haupt':
    case 'akzent':
      return { klassen: [`${praefix}--${h.art}`], stil: [], bild: '' };
    case 'farbe': {
      // Das Schema lässt nur Hex zu; hier noch einmal – ein anderer Wert kommt nie in ein `style`.
      const gueltig = HEX_MUSTER.test(h.farbe);
      return {
        klassen: [`${praefix}--farbe`],
        stil: gueltig ? [`--${praefix.slice(2)}-farbe:${h.farbe}`] : [],
        bild: '',
      };
    }
    case 'bild': {
      const abdunkeln = Number.isFinite(h.abdunkeln)
        ? Math.min(90, Math.max(0, Math.round(h.abdunkeln)))
        : 0;
      // Als <img> (nicht als CSS-`url()`): bekommt `srcset`, lädt träge und braucht keine Adresse im `style`.
      const tag = bildTag(h.bild, '', k, ersterBildPlatz(z, true), 'w-hintergrund', '100vw');
      return {
        klassen: [`${praefix}--foto`],
        stil: [`--abdunkeln:${abdunkeln / 100}`],
        bild: tag,
      };
    }
  }
}

const stilAttr = (stil: string[]): string =>
  stil.length > 0 ? ` style="${htmlAttr(stil.join(';'))}"` : '';

function spalteHtml(sp: Spalte, k: RenderKontext, z: BildZaehler): string {
  const klassen = ['w-spalte'];
  if (sp.handyZuerst) klassen.push('w-spalte--handy-zuerst');
  let stil: string[] = [];
  let bild = '';
  if (sp.hintergrund) {
    const t = hintergrundTeile(sp.hintergrund, 'w-spalte', k, z);
    klassen.push(
      ...t.klassen,
      textHellAuf(sp.hintergrund) ? 'w-spalte--text-hell' : 'w-spalte--text-dunkel',
    );
    stil = t.stil;
    bild = t.bild;
  }
  const inhalt = sp.bausteine
    .map((b) => renderBaustein(b, k, ersterBildPlatz(z, hatBild(b, k))))
    .join('\n');
  return `<div class="${klassen.join(' ')}"${stilAttr(stil)}>${bild}${inhalt}</div>`;
}

function abschnittHtml(a: Abschnitt, k: RenderKontext, z: BildZaehler): string {
  const g = a.gestaltung;
  const klassen = ['w-abschnitt'];
  const hg = hintergrundTeile(g.hintergrund, 'w-abschnitt', k, z);
  klassen.push(...hg.klassen);
  const hell = g.text === 'auto' ? textHellAuf(g.hintergrund) : g.text === 'hell';
  klassen.push(hell ? 'w-abschnitt--text-hell' : 'w-abschnitt--text-dunkel');
  const abstand = aus(g.abstand, ['kein', 'klein', 'normal', 'gross'] as const, 'normal');
  if (abstand !== 'normal') klassen.push(`w-abschnitt--abstand-${abstand}`);
  const breite = aus(g.breite, ['schmal', 'normal', 'breit', 'voll'] as const, 'normal');
  if (breite !== 'normal') klassen.push(`w-abschnitt--${breite}`);
  if (g.ausrichtung === 'mitte') klassen.push('w-zentriert');
  const hoehe = aus(g.hoehe, ['auto', 'halb', 'voll'] as const, 'auto');
  if (hoehe !== 'auto') klassen.push(`w-abschnitt--hoehe-${hoehe}`);

  const anker =
    g.anker !== undefined && SLUG.test(g.anker) && !istReservierterAnker(g.anker)
      ? ` id="${htmlAttr(g.anker)}"`
      : '';
  const spalten = a.spalten.map((s) => spalteHtml(s, k, z)).join('\n');
  // Passt die Aufteilung nicht (am Schema vorbei), gilt die gleichmäßige zur Zahl der Spalten.
  const gleichmaessig =
    (['1', '1-1', '1-1-1', '1-1-1-1'] as const)[Math.min(a.spalten.length, 4) - 1] ?? '1';
  const teilung: Aufteilung = aus(a.aufteilung, AUFTEILUNGEN, gleichmaessig);
  const aufteilung = `w-spalten--${teilung}${g.senkrecht === 'mitte' ? ' w-spalten--mitte' : ''}`;
  return (
    `<section class="${klassen.join(' ')}"${anker}${stilAttr(hg.stil)}>${hg.bild}` +
    `<div class="w-abschnitt-innen w-spalten ${aufteilung}">${spalten}</div></section>`
  );
}

/** Ein Abschnitt als HTML (für die Seite und für Vorschauen einzelner Abschnitte). */
export function renderAbschnitt(abschnitt: Abschnitt, k: RenderKontext, ersteBild = false): string {
  return abschnittHtml(abschnitt, k, { offen: ersteBild });
}

// ── Seite ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Zeigt der Link auf diese Seite? */
const zeigtAuf = (link: Link, seite: Seite): boolean =>
  link.art === 'seite' && link.seiteId === seite.id;

function menuePunkt(
  titel: string,
  ziel: Link,
  aktuell: 'page' | 'true' | null,
  k: RenderKontext,
  unter = '',
): string {
  const adresse = linkAdresse(ziel, k);
  const marke = aktuell ? ` aria-current="${aktuell}"` : '';
  const inhalt =
    adresse === null
      ? `<span>${htmlText(titel)}</span>`
      : `<a href="${htmlAttr(adresse)}"${relFuer(ziel)}${marke}>${htmlText(titel)}</a>`;
  return `<li>${inhalt}${unter}</li>`;
}

/** Menü-Knopf (Handy) und Navigation – ohne Menüpunkte beides nicht. */
function navigation(seite: Seite, k: RenderKontext): string {
  if (k.menue.eintraege.length === 0) return '';
  const punkt = (e: MenueEintrag): string => {
    const kinder = e.unter ?? [];
    const kindAktuell = kinder.some((u) => zeigtAuf(u.ziel, seite));
    const eigen = zeigtAuf(e.ziel, seite) ? 'page' : kindAktuell ? 'true' : null;
    const unter =
      kinder.length > 0
        ? `<ul class="w-nav-unter">${kinder
            .map((u) => menuePunkt(u.titel, u.ziel, zeigtAuf(u.ziel, seite) ? 'page' : null, k))
            .join('')}</ul>`
        : '';
    return menuePunkt(e.titel, e.ziel, eigen, k, unter);
  };
  return (
    `<button type="button" class="w-menue-knopf" aria-expanded="false" aria-controls="w-nav">Menü</button>` +
    `<nav class="w-nav" id="w-nav" aria-label="Hauptmenü"><ul>${k.menue.eintraege.map(punkt).join('')}</ul></nav>`
  );
}

function kopf(seite: Seite, k: RenderKontext): string {
  const { name, logo } = k.einstellungen;
  const start = k.seiten.find((s) => s.startseite);
  const startAdresse = start ? k.adresseVon(start) : '/';
  const marke = logo
    ? bildTag(logo, name, k, true, 'w-logo-bild')
    : `<span class="w-logo-name">${htmlText(name)}</span>`;
  return `<header class="w-kopf"><div class="w-kopf-innen"><a class="w-logo" href="${htmlAttr(startAdresse)}">${marke}</a>${navigation(seite, k)}</div></header>`;
}

/** Fußzeile; der Knopf „Einwilligung ändern“ nur, wo es eine Einwilligung gibt (`mitYoutube`). */
function fuss(k: RenderKontext, mitYoutube: boolean): string {
  const { name, fusszeile } = k.einstellungen;
  const links = fusszeile
    .map((f) => {
      const a = linkAdresse(f.ziel, k);
      return a === null
        ? `<li><span>${htmlText(f.titel)}</span></li>`
        : `<li><a href="${htmlAttr(a)}"${relFuer(f.ziel)}>${htmlText(f.titel)}</a></li>`;
    })
    .join('');
  const aendern = mitYoutube
    ? '<button type="button" data-einwilligung-aendern>Einwilligung für YouTube ändern</button>'
    : '';
  return (
    `<footer class="w-fuss"><div class="w-fuss-innen">` +
    `<p class="w-fuss-marke">${htmlText(name)}</p>` +
    (links ? `<nav class="w-fuss-nav" aria-label="Fußzeile"><ul>${links}</ul></nav>` : '') +
    `</div>` +
    (aendern ? `<div class="w-fuss-unten">${aendern}</div>` : '') +
    `</footer>`
  );
}

/** Einwilligungs-Banner: erscheint erst, wenn das Skript keine gespeicherte Entscheidung findet (`hidden`). */
function banner(k: RenderKontext): string {
  const text = k.einstellungen.einwilligung?.youtubeText ?? BANNER_STANDARDTEXT;
  const datenschutz = datenschutzLink('Mehr dazu im Datenschutz', k);
  return (
    `<div class="w-banner" role="dialog" aria-labelledby="w-banner-titel" hidden>` +
    `<h2 id="w-banner-titel">YouTube-Videos anzeigen?</h2>` +
    `<p>${htmlText(text)}${datenschutz ? ` ${datenschutz}` : ''}</p>` +
    `<div class="w-knopfreihe"><button type="button" class="w-knopf" data-einwilligung="ja">YouTube erlauben</button>` +
    `<button type="button" class="w-knopf w-knopf--neben" data-einwilligung="nein">Nur notwendige</button></div></div>`
  );
}

/** Eine Seite als vollständiges HTML-Dokument. */
export function renderSeite(seite: Seite, k: RenderKontext): string {
  const { name, noindex, sprache } = k.einstellungen;
  const zaehler: BildZaehler = { offen: true };
  const inhalt = seite.abschnitte.map((a) => abschnittHtml(a, k, zaehler)).join('\n');
  const mitYoutube = zeigtYoutube(seite, k);
  return [
    '<!doctype html>',
    `<html lang="${htmlAttr(sprache)}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${htmlText(`${seite.titel} – ${name}`)}</title>`,
    seite.beschreibung ? `<meta name="description" content="${htmlAttr(seite.beschreibung)}">` : '',
    noindex ? '<meta name="robots" content="noindex">' : '',
    `<link rel="stylesheet" href="${htmlAttr(k.stylesheet)}">`,
    // NACH dem Stylesheet: gleiche Spezifität (`:root`), die spätere Regel – das Theme – gewinnt.
    `<style>${themeCss(k.einstellungen, k)}</style>`,
    '</head>',
    '<body>',
    '<a class="w-sprungmarke" href="#inhalt">Zum Inhalt springen</a>',
    kopf(seite, k),
    `<main id="inhalt" class="w-seite">`,
    inhalt,
    '</main>',
    fuss(k, mitYoutube),
    mitYoutube ? banner(k) : '',
    `<script src="${htmlAttr(k.skriptAdresse)}" defer></script>`,
    '</body>',
    '</html>',
  ]
    .filter((z) => z !== '')
    .join('\n')
    .concat('\n');
}
