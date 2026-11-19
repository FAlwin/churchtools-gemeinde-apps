/**
 * **Der Renderer der Website** (W1) – reine Logik, kein DOM, keine Uhr, kein Zufall: gleiche Eingabe, gleiche Ausgabe.
 * Vorschau (Erweiterung) und Bau-Dienst benutzen genau diese Datei.
 *
 * Regeln:
 *  - **Alles aus Daten wird geschützt** (`htmlText`/`htmlAttr`); Markdown nur über `markdown.ts`.
 *  - **Keine externen Ressourcen**: keine Skripte, keine iframes, keine fremden Schriften. Bilder bekommen ihre
 *    Adresse ausschließlich vom Kontext (`bildAdresse`), der Renderer erfindet keine.
 *  - Links aus den Daten werden beim Ausgeben **noch einmal** geprüft (`linkAdresse`) – auch wenn das Schema es schon
 *    tut: Daten kommen aus ChurchTools-Werten, die jemand an der Oberfläche vorbei ändern kann.
 *  - Fehlen Daten der dynamischen Bausteine, steht ein ruhiger Hinweis da statt eines Absturzes.
 *  - Datum und Uhrzeit deutsch in der **Zeitzone der Gemeinde** (`kontext.zeitzone`, #847: keine eigene Zone im Code –
 *    die Vorschau gibt `gemeindeZeitzone()`, der Bau-Dienst die Zone aus der ChurchTools-Konfiguration). Über
 *    `shared/ct/zeit.ts` + `datum.ts`, unabhängig von der Zone des Rechners – die Tests laufen mit `TZ=UTC`.
 *  - Gestaltung ist W2: hier nur semantisches HTML mit stabilen Klassen (Präfix `w-`), kein Inline-CSS.
 */
import { datumText, tagPunkt } from '../ct/datum';
import { tagAusIso, uhrText } from '../ct/zeit';
import { htmlAttr, htmlText } from './html';
import { markdownZuHtml } from './markdown';
import {
  istErlaubteAdresse,
  type Baustein,
  type BildRef,
  type Einstellungen,
  type Link,
  type Menue,
  type MenueEintrag,
  type Seite,
} from './modell';

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
  /** Adresse des Videos (der Bau-Dienst setzt sie; ohne Adresse zeigt die Karte keinen Link). */
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

/** Adresse eines Links oder `null` (Seite gibt es nicht / externe Adresse nicht erlaubt). */
function linkAdresse(link: Link, k: RenderKontext): string | null {
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
): string {
  let breiten: number[] = BILD_BREITEN.filter((b) => !bild.breite || b <= bild.breite);
  if (breiten.length === 0) breiten = [bild.breite ?? BILD_BREITEN[0]];
  const standard = [...breiten].reverse().find((b) => b <= 800) ?? breiten[0];
  const srcset = breiten.map((b) => `${htmlAttr(k.bildAdresse(bild, b))} ${b}w`).join(', ');
  const masse = bild.breite && bild.hoehe ? ` width="${bild.breite}" height="${bild.hoehe}"` : '';
  const laden = eager ? '' : ' loading="lazy" decoding="async"';
  const cls = klasse ? ` class="${klasse}"` : '';
  return `<img${cls} src="${htmlAttr(k.bildAdresse(bild, standard))}" srcset="${srcset}" sizes="(min-width: 60rem) 60rem, 100vw" alt="${htmlAttr(alt)}"${masse}${laden}>`;
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
      `<li class="w-termin"><h3 class="w-termin-titel">${htmlText(t.titel)}</h3>` +
      `<p class="w-termin-wann"><time datetime="${htmlAttr(t.beginn)}">${htmlText(terminWann(t, k.zeitzone))}</time></p>` +
      (t.ort ? `<p class="w-ort">${htmlText(t.ort)}</p>` : '') +
      '</li>',
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
    const inhalt = f.link ? verweis(f.link, 'w-folie-link', bild, k) : bild;
    return `<li class="w-folie">${inhalt}</li>`;
  });
  return `<ul class="w-slider-folien"${intervall}>${eintraege.join('')}</ul>`;
}

function videoKarte(v: Video, k: RenderKontext): string {
  const bild = v.vorschaubild ? bildTag(v.vorschaubild, '', k, false, 'w-video-bild') : '';
  const titel = htmlText(v.titel);
  const sicher = v.adresse && istErlaubteAdresse(v.adresse) ? v.adresse : null;
  const kopf = sicher
    ? `<a class="w-video-link" href="${htmlAttr(sicher)}" rel="noopener">${bild}<span class="w-video-titel">${titel}</span></a>`
    : `${bild}<span class="w-video-titel">${titel}</span>`;
  return `<article class="w-video">${kopf}<p class="w-datum"><time datetime="${htmlAttr(v.datum)}">${htmlText(tagText(v.datum, k.zeitzone))}</time></p></article>`;
}

function livestreamHtml(b: Extract<Baustein, { typ: 'livestream' }>, k: RenderKontext): string {
  const stream = k.livestream;
  const teile: string[] = [];
  if (b.zeigen !== 'archiv') {
    teile.push(
      stream?.aktuell
        ? `<div class="w-stream-aktuell"><h3>Livestream</h3>${videoKarte(stream.aktuell, k)}</div>`
        : leer('Zurzeit kein Livestream.'),
    );
  }
  if (b.zeigen !== 'stream') {
    const archiv = (stream?.archiv ?? [])
      .slice()
      .sort((a, c) => c.datum.localeCompare(a.datum))
      .slice(0, b.archivAnzahl);
    teile.push(
      archiv.length > 0
        ? `<div class="w-stream-archiv"><h3>Aufzeichnungen</h3>${archiv.map((v) => videoKarte(v, k)).join('\n')}</div>`
        : leer('Zurzeit keine Aufzeichnungen.'),
    );
  }
  return teile.join('\n');
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
    `<p><button class="w-knopf w-knopf-haupt" type="submit">Absenden</button></p></form>`
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
      (g.beschreibung ? `<p class="w-gruppe-text">${htmlText(g.beschreibung)}</p>` : '') +
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
  const huelle = (inhalt: string) =>
    `<section class="w-baustein w-b-${baustein.typ}">${inhalt}</section>`;
  switch (baustein.typ) {
    case 'ueberschrift':
      return huelle(
        `<h${baustein.ebene} class="w-ueberschrift">${htmlText(baustein.text)}</h${baustein.ebene}>`,
      );
    case 'text':
      return huelle(`<div class="w-text">${markdownZuHtml(baustein.markdown)}</div>`);
    case 'bild':
      return huelle(
        `<figure class="w-bild">${bildTag(baustein.bild, baustein.alt, k, ersteBild)}` +
          (baustein.unterschrift
            ? `<figcaption>${htmlText(baustein.unterschrift)}</figcaption>`
            : '') +
          '</figure>',
      );
    case 'bildText':
      return huelle(
        `<div class="w-bildtext w-bildtext-${baustein.bildSeite}">` +
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
    case 'knopf':
      return huelle(
        verweis(baustein.ziel, `w-knopf w-knopf-${baustein.art}`, htmlText(baustein.text), k),
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
    default:
      return unbekannterTyp(baustein);
  }
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
  return `<nav class="w-nav" aria-label="Hauptmenü"><ul>${k.menue.eintraege.map(punkt).join('')}</ul></nav>`;
}

function kopf(seite: Seite, k: RenderKontext): string {
  const { name, logo } = k.einstellungen;
  const start = k.seiten.find((s) => s.startseite);
  const startAdresse = start ? k.adresseVon(start) : '/';
  const marke = logo
    ? bildTag(logo, name, k, true, 'w-logo-bild')
    : `<span class="w-logo-name">${htmlText(name)}</span>`;
  return `<header class="w-kopf"><a class="w-logo" href="${htmlAttr(startAdresse)}">${marke}</a>${navigation(seite, k)}</header>`;
}

function fuss(k: RenderKontext): string {
  const { name, fusszeile } = k.einstellungen;
  const links = fusszeile
    .map((f) => {
      const a = linkAdresse(f.ziel, k);
      return a === null
        ? `<li><span>${htmlText(f.titel)}</span></li>`
        : `<li><a href="${htmlAttr(a)}"${relFuer(f.ziel)}>${htmlText(f.titel)}</a></li>`;
    })
    .join('');
  return (
    `<footer class="w-fuss">` +
    (links ? `<nav class="w-fuss-nav" aria-label="Fußzeile"><ul>${links}</ul></nav>` : '') +
    `<p class="w-fuss-name">${htmlText(name)}</p></footer>`
  );
}

/** Eine Seite als vollständiges HTML-Dokument. */
export function renderSeite(seite: Seite, k: RenderKontext): string {
  const { name, noindex, sprache } = k.einstellungen;
  let ersteBildOffen = true;
  const inhalt = seite.bausteine
    .map((b) => {
      const eager = ersteBildOffen && hatBild(b, k);
      if (eager) ersteBildOffen = false;
      return renderBaustein(b, k, eager);
    })
    .join('\n');
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
    '</head>',
    '<body>',
    '<a class="w-sprungmarke" href="#inhalt">Zum Inhalt springen</a>',
    kopf(seite, k),
    `<main id="inhalt" class="w-seite">`,
    inhalt,
    '</main>',
    fuss(k),
    '</body>',
    '</html>',
  ]
    .filter((z) => z !== '')
    .join('\n')
    .concat('\n');
}
