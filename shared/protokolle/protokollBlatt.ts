/**
 * **Das Protokoll als Blatt** (Bauplan S6-3a, Entwurf `s6-freigabe-pdf-v1`, abgenommen 11.11.2026) – was aufs PDF eines
 * Protokolls kommt: Kopf (Gruppe, Titel, Datum, Freigabe-Vermerk), das Protokoll wie in der Lese-Ansicht und am Ende die
 * Übersicht (Beschlüsse, To-Dos, Termine, Nächste Sitzung). Hier steht nur, **was** auf dem Blatt steht; gezeichnet wird in
 * `ui/teilen/protokollPdf.ts` auf dem gemeinsamen Satz (`pdfSatz.ts`).
 *
 * Alles kommt aus denselben Regeln wie die Seite – nichts wird ein zweites Mal gerechnet:
 * - Nummern 4. / 4.1 und Übersicht aus `ableiten` (wie Lese-Ansicht und Bereiche);
 * - Wer bei einem To-Do: `zustaendigeNamen`; „Offene To-Dos von früher“: `offeneVonFrueher`; „Früheres Protokoll“ wie
 *   `FesterPunkt`; Anwesenheit: `kurzform`; Tabellen: `tabellenZeilen`; Links nur über `sichererLink`.
 * - To-Dos mit Wer und Bis, **ohne Status** (Alwin 09.11.2026); bei „Offene To-Dos von früher“ stehen die seit der letzten
 *   Sitzung erledigten ausgeschrieben darunter – das PDF lässt sich nicht aufklappen (Alwin 12.11.2026).
 * - Leere Absätze sind nur Abstand und fallen weg (wie beim Lesen); unbekannte Blöcke behalten ihren Text.
 */
import { tagPunkt } from '../ct/datum';
import { sichererLink } from '../ct/sichereAdresse';
import type { Absatz, Lauf, Rgb } from '../ct/terminBlatt';
import { tagAusIso, wannLang } from '../ct/zeit';
import { gaesteAus, kurzform, type TreffenStand } from './anwesenheit';
import { istUeberfaellig, vorabLesen, zustaendigeNamen, type Aufgabe } from './aufgaben';
import {
  ableiten,
  BLOCK,
  punktNummer,
  tabellenZeilen,
  terminDatum,
  textAus,
  type Ableitung,
  type AufgabenEintrag,
  type Block,
  type Punkt,
} from './dokument';
import { festeAufgabenAus, festesProtokollAus, offeneVonFrueher } from './festePunkte';
import { freigabeVermerk, zurueckText, type KopfMitVerlauf } from './freigabe';
import type { Sitzung } from './sitzungen';

// ── Eingang ──────────────────────────────────────────────────────────────────

export type FarbArt = 'hintergrund' | 'schrift';

/** Was der Aufrufer über die Sitzung und ihr Protokoll weiß. */
export interface ProtokollQuelle {
  /** Name der Gruppe. */
  gruppe: string;
  gruppeId: number;
  /** `kopf.sitzung` – für die festen Punkte. */
  sitzung: string;
  titel: string;
  /** Beginn der Sitzung (ISO). */
  beginn: string;
  zeitzone: string;
  /** Kopf des Protokolls – Status und Verlauf der Freigabe. */
  kopf: KopfMitVerlauf | null;
  dokument: readonly Block[];
  /** Alle To-Dos der Gruppe. */
  aufgaben: readonly Aufgabe[];
  /** Name einer Person aus der Mitgliederliste – `null`, wenn man sie nicht sieht. */
  name: ((person: number) => string | null) | null;
  /** `JJJJ-MM-TT` in der Zeitzone der Gemeinde. */
  heute: string;
  /** Die freigegebenen Protokolle der Gruppe und das letzte vor dieser Sitzung (wie `FestePunkteWert`). */
  protokolle: readonly Sitzung[];
  letztes: Sitzung | null;
  /** Das Gruppentreffen: `null` = keins, `'unbekannt'` = ließ sich nicht lesen. */
  anwesenheit: TreffenStand | null | 'unbekannt';
  /** Beginn der nächsten Sitzung (ISO) – `null`, wenn keine festgelegt ist. */
  naechste: string | null;
  gemeinde: string | null;
  /** „Stand 12.11.2026, 10:30 Uhr“ – oben rechts auf jeder Seite. */
  stand: string;
  /** Eine Markier-Farbe des Editors (gespeicherter Name) als Farbe – `null` für „keine“ oder Unbekanntes. */
  farbe: (name: unknown, art: FarbArt) => Rgb | null;
}

// ── Ausgang ──────────────────────────────────────────────────────────────────

/** Was vor einer Zeile steht: Aufzählungspunkt, Nummer, Kästchen (Checkliste, To-Do). */
export type Zeichen =
  | { art: 'punkt' }
  | { art: 'nummer'; nr: number }
  | { art: 'kasten'; an: boolean };

/** Ein Text mit Auszeichnung am linken Rand: Zitat (grau), Beschluss (grün), Termin (blau). */
export type Rand = 'zitat' | 'beschluss' | 'termin';

export interface TabellenZelleBlatt {
  absaetze: Absatz[];
  kopf: boolean;
  spalten: number;
  zeilen: number;
  hintergrund: Rgb | null;
}

/** Eine Zeile in einem festen Punkt. */
export interface KastenZeile {
  absaetze: Absatz[];
  zeichen?: Zeichen;
  /** Eine Stufe eingerückt (die To-Dos unter „Seit … erledigt“). */
  eingerueckt?: boolean;
}

export type BlattTeil =
  /** Tagesordnungspunkt (Ebene 0) oder Unterpunkt (1–4); `nummer` fehlt, wo nicht gezählt wird. */
  | { art: 'punkt'; ebene: number; nummer: string | null; absaetze: Absatz[]; einzug: number }
  /** Überschrift ohne Nummer; `klein` = Stufe 3 („Überschrift“). */
  | { art: 'ueberschrift'; klein: boolean; absaetze: Absatz[]; einzug: number }
  | { art: 'text'; absaetze: Absatz[]; einzug: number; zeichen?: Zeichen; rand?: Rand }
  | { art: 'tabelle'; zeilen: TabellenZelleBlatt[][]; einzug: number }
  | { art: 'linie'; einzug: number }
  /** Ein fester Punkt (Anwesenheit, Offene To-Dos, Früheres Protokoll) – grau hinterlegt. */
  | { art: 'kasten'; zeilen: KastenZeile[]; einzug: number };

export interface UebersichtEintrag {
  absatz: Absatz;
  /** „Punkt 4.1“ oder „vor dem ersten Punkt“. */
  punkt: string;
}

export interface Uebersicht {
  beschluesse: UebersichtEintrag[];
  aufgaben: UebersichtEintrag[];
  termine: UebersichtEintrag[];
  /** „Mi, 09.12.2026 · 19:00 Uhr“ – `null`, wenn keine festgelegt ist. */
  naechste: string | null;
}

export interface ProtokollBlatt {
  /** Kopf und Fuß jeder Seite (wie `BlattKopf` im Satz). */
  titel: string;
  untertitel: string;
  gemeinde: string | null;
  app: string;
  stand: string;
  /** Noch nicht freigegeben. */
  entwurf: boolean;
  /** Oben auf Seite 1: „Freigegeben am … von …“ bzw. „Entwurf – noch nicht freigegeben“ (+ Zurücknahme). */
  vermerk: Absatz[];
  /** Das Protokoll – leer, wenn noch nichts drinsteht. */
  teile: BlattTeil[];
  uebersicht: Uebersicht;
}

export const LEER_TEXT = 'Das Protokoll ist noch leer.';

// ── Text ─────────────────────────────────────────────────────────────────────

interface Stueck {
  type?: unknown;
  text?: unknown;
  styles?: Record<string, unknown>;
  href?: unknown;
  content?: unknown;
}

/** Ein Textstück des Editors als Lauf – Auszeichnung und Farben wie im Editor. */
function lauf(t: Stueck, q: Pick<ProtokollQuelle, 'farbe'>, link: string | null): Lauf | null {
  if (typeof t.text !== 'string' || !t.text) return null;
  const s = t.styles ?? {};
  const l: Lauf = { text: t.text };
  if (s.bold) l.stil = 'fett';
  if (s.italic) l.kursiv = true;
  if (s.underline) l.unterstrichen = true;
  if (s.strike) l.durchgestrichen = true;
  if (s.code) l.code = true;
  const farbe = q.farbe(s.textColor, 'schrift');
  if (farbe) l.farbe = farbe;
  const hinten = q.farbe(s.backgroundColor, 'hintergrund');
  if (hinten) l.hintergrund = hinten;
  if (link) l.link = link;
  return l;
}

/** Der Inhalt eines Blocks als Läufe – Links nur, wenn die Adresse sicher ist (wie die Lese-Ansicht, #849). */
function laeufeAus(content: unknown, q: Pick<ProtokollQuelle, 'farbe'>): Absatz {
  if (typeof content === 'string') return content ? [{ text: content }] : [];
  if (!Array.isArray(content)) return [];
  const aus: Absatz = [];
  for (const c of content as Stueck[]) {
    if (c?.type === 'text') {
      const l = lauf(c, q, null);
      if (l) aus.push(l);
    } else if (c?.type === 'link') {
      const href = typeof c.href === 'string' ? sichererLink(c.href, { mailto: true }) : null;
      for (const t of Array.isArray(c.content) ? (c.content as Stueck[]) : []) {
        const l = lauf(t, q, href ?? null);
        if (l) aus.push(l);
      }
    }
  }
  return aus;
}

/** Ein Zeilenumbruch im Text (Umschalt+Enter) beginnt einen neuen Absatz – sonst flösse er im PDF zusammen. */
export function zeilenAus(absatz: Absatz): Absatz[] {
  const aus: Absatz[] = [[]];
  for (const l of absatz) {
    l.text.split('\n').forEach((teil, i) => {
      if (i > 0) aus.push([]);
      if (teil) aus[aus.length - 1].push({ ...l, text: teil });
    });
  }
  return aus;
}

const grau = (text: string): Lauf => ({ text, stil: 'grau' });
const fett = (text: string): Lauf => ({ text, stil: 'fett' });

// ── To-Dos ───────────────────────────────────────────────────────────────────

/**
 * **„– Maria Dück, bis 06.12.2026“** – Wer und Bis eines To-Dos im Protokoll, ohne Status (Entwurf: „– noch niemand“).
 * Gibt es das To-Do noch nicht (nicht gespeichert), gilt die Wahl im Block (`vorab`).
 */
function werBis(e: Pick<AufgabenEintrag, 'aufgabe' | 'vorab'>, q: ProtokollQuelle): Lauf {
  const a = e.aufgabe ? q.aufgaben.find((x) => x.id === e.aufgabe) : undefined;
  const sicht = a ?? e.vorab;
  const wer = sicht ? zustaendigeNamen(sicht, q.name) : [];
  const teile = [wer.length ? wer.join(', ') : 'noch niemand'];
  if (sicht?.bis) teile.push(`bis ${tagPunkt(sicht.bis)}`);
  return grau(` – ${teile.join(', ')}`);
}

/**
 * Eine Zeile unter „Offene To-Dos von früher“ – wie `FesterPunkt` (Wer · bis …, überfällig rot; ein inzwischen erledigtes
 * To-Do durchgestrichen – festgehaltene Listen zeigen den heutigen Stand).
 */
function fruehereZeile(a: Aufgabe, q: ProtokollQuelle): Absatz {
  const wer = zustaendigeNamen(a, q.name);
  const text: Lauf =
    a.status === 'erledigt'
      ? { text: a.text, stil: 'grau', durchgestrichen: true }
      : { text: a.text };
  const aus: Absatz = [text];
  if (!wer.length && !a.bis) return aus;
  aus.push(grau(` – ${wer.join(', ')}${wer.length && a.bis ? ' · ' : ''}`));
  if (a.bis) {
    const ueber = istUeberfaellig(a, q.heute);
    aus.push(
      ueber
        ? { text: `überfällig · ${tagPunkt(a.bis)}`, stil: 'rot' }
        : grau(`bis ${tagPunkt(a.bis)}`),
    );
  }
  return aus;
}

// ── Feste Punkte ─────────────────────────────────────────────────────────────

const tagVon = (iso: string, zeitzone: string) => tagPunkt(tagAusIso(iso, zeitzone));

function anwesenheitKasten(b: Block, q: ProtokollQuelle): KastenZeile[] {
  if (q.anwesenheit === 'unbekannt')
    return [{ absaetze: [[grau('Die Anwesenheit ließ sich nicht laden.')]] }];
  if (!q.anwesenheit)
    return [{ absaetze: [[grau('Zu dieser Sitzung gibt es kein Gruppentreffen.')]] }];
  const k = kurzform(q.anwesenheit.personen, gaesteAus(b.props?.gaeste));
  const absatz: Absatz = [
    fett(`Anwesend (${k.anwesend.length}): `),
    { text: k.anwesend.join(', ') || '–' },
  ];
  const dazu = (titel: string, namen: string[]) => {
    if (namen.length) absatz.push(grau(' · '), fett(`${titel}: `), { text: namen.join(', ') });
  };
  dazu('Abwesend', k.abwesend);
  dazu('Offen', k.offen);
  dazu('Gäste', k.gaeste);
  return [{ absaetze: [absatz] }];
}

function offeneKasten(b: Block, q: ProtokollQuelle): KastenZeile[] {
  const r = offeneVonFrueher({
    aufgaben: q.aufgaben,
    gruppe: q.gruppeId,
    sitzung: q.sitzung,
    seit: q.letztes?.beginn ?? null,
    heute: q.heute,
    fest: festeAufgabenAus(b.props?.fest),
  });
  const zeilen: KastenZeile[] = [
    { absaetze: [[fett('Offene To-Dos von früher'), grau(` (${r.offen.length})`)]] },
  ];
  if (!r.offen.length) zeilen.push({ absaetze: [[grau('Nichts offen von früher.')]] });
  for (const a of r.offen)
    zeilen.push({ absaetze: [fruehereZeile(a, q)], zeichen: { art: 'punkt' } });
  if (r.erledigt.length && r.seit) {
    zeilen.push({
      absaetze: [
        [
          fett(`Seit der Sitzung am ${tagVon(r.seit, q.zeitzone)} erledigt`),
          grau(` (${r.erledigt.length})`),
        ],
      ],
    });
    for (const a of r.erledigt)
      zeilen.push({ absaetze: [fruehereZeile(a, q)], zeichen: { art: 'punkt' } });
  }
  return zeilen;
}

function frueheresKasten(b: Block, q: ProtokollQuelle): KastenZeile[] {
  const f = festesProtokollAus(b.props?.fest);
  // Wie `FesterPunkt`: festgehalten = genau das damalige; fehlt es inzwischen, sagt der Punkt das.
  const s: Sitzung | null | 'weg' = !f
    ? q.letztes
    : f.sitzung === null
      ? null
      : (q.protokolle.find((p) => p.kopf?.sitzung === f.sitzung) ?? 'weg');
  if (s === null) return [{ absaetze: [[grau('Keine frühere Sitzung mit Protokoll.')]] }];
  if (s === 'weg') return [{ absaetze: [[grau('Das damalige Protokoll gibt es nicht mehr.')]] }];
  const frei = s.kopf?.freigabe
    ? ` · freigegeben am ${tagVon(s.kopf.freigabe.am, q.zeitzone)}`
    : '';
  return [{ absaetze: [[fett(s.titel), grau(` vom ${tagVon(s.beginn, q.zeitzone)}${frei}`)]] }];
}

function festerPunkt(b: Block, q: ProtokollQuelle): KastenZeile[] {
  // Je Art ausdrücklich – eine unbekannte Art wird nicht als eine bekannte gezeigt (wie `FesterPunkt`).
  const art = b.props?.art;
  if (art === 'anwesenheit') return anwesenheitKasten(b, q);
  if (art === 'offene-aufgaben') return offeneKasten(b, q);
  if (art === 'letztes-protokoll') return frueheresKasten(b, q);
  return [{ absaetze: [[grau('Fester Punkt')]] }];
}

// ── Blöcke ───────────────────────────────────────────────────────────────────

interface Kontext {
  q: ProtokollQuelle;
  punkte: Map<string, Punkt>;
}

function tabelle(content: unknown, q: ProtokollQuelle): TabellenZelleBlatt[][] | null {
  const zeilen = tabellenZeilen(content);
  if (!zeilen?.length) return null;
  return zeilen.map((zellen) =>
    zellen.map((c) => {
      const schrift = q.farbe(c.schrift, 'schrift');
      const laeufe = laeufeAus(c.inhalt, q).map((l) =>
        schrift && !l.farbe ? { ...l, farbe: schrift } : l,
      );
      return {
        absaetze: zeilenAus(laeufe),
        kopf: c.kopf,
        spalten: c.spalten,
        zeilen: c.zeilen,
        hintergrund: q.farbe(c.hintergrund, 'hintergrund'),
      };
    }),
  );
}

/** Ein Block (ohne seine Kinder) – `null`, wenn er nichts zeigt (leerer Absatz, leere Aufgabe …). */
function teilAus(b: Block, einzug: number, k: Kontext, nr: number): BlattTeil | null {
  const { q } = k;
  const laeufe = laeufeAus(b.content, q);
  const absaetze = zeilenAus(laeufe);
  const hatText = textAus(b.content).trim() !== '';
  switch (b.type) {
    case 'heading': {
      const stufe = Number(b.props?.level ?? 1);
      const p = k.punkte.get(b.id);
      if (!hatText && !p) return null;
      if (stufe <= 1)
        return { art: 'punkt', ebene: 0, nummer: p ? punktNummer(p) : null, absaetze, einzug };
      if (p) return { art: 'punkt', ebene: p.tiefe, nummer: punktNummer(p), absaetze, einzug };
      return { art: 'ueberschrift', klein: stufe === 3, absaetze, einzug };
    }
    case 'bulletListItem':
    case 'numberedListItem':
    case 'checkListItem': {
      if (!hatText) return null;
      const zeichen: Zeichen =
        b.type === 'bulletListItem'
          ? { art: 'punkt' }
          : b.type === 'numberedListItem'
            ? { art: 'nummer', nr }
            : { art: 'kasten', an: !!b.props?.checked };
      return { art: 'text', absaetze, einzug, zeichen };
    }
    case 'quote':
      return hatText ? { art: 'text', absaetze, einzug, rand: 'zitat' } : null;
    case BLOCK.aufgabe: {
      if (!hatText) return null;
      const id = b.props?.aufgabe;
      const zusatz = werBis(
        { aufgabe: typeof id === 'string' && id ? id : null, vorab: vorabLesen(b.props?.vorab) },
        q,
      );
      return {
        art: 'text',
        absaetze: zeilenAus([...laeufe, zusatz]),
        einzug,
        zeichen: { art: 'kasten', an: false },
      };
    }
    case BLOCK.beschluss:
      return hatText
        ? {
            art: 'text',
            absaetze: zeilenAus([fett('Beschluss: '), ...laeufe]),
            einzug,
            rand: 'beschluss',
          }
        : null;
    case BLOCK.termin: {
      if (!hatText) return null;
      const d = terminDatum(b.props);
      const datum = d ? [fett(tagPunkt(d)), { text: ' – ' }] : [];
      return { art: 'text', absaetze: zeilenAus([...datum, ...laeufe]), einzug, rand: 'termin' };
    }
    case 'table': {
      const zeilen = tabelle(b.content, q);
      return zeilen ? { art: 'tabelle', zeilen, einzug } : null;
    }
    case 'divider':
      return { art: 'linie', einzug };
    case BLOCK.verweis:
      return { art: 'kasten', zeilen: festerPunkt(b, q), einzug };
    default:
      // Absatz – und jeder unbekannte Block: sein Text bleibt sichtbar. Leere Absätze sind nur Abstand.
      return hatText ? { art: 'text', absaetze, einzug } : null;
  }
}

function teileAus(bloecke: readonly Block[], einzug: number, k: Kontext): BlattTeil[] {
  const aus: BlattTeil[] = [];
  let nr = 0;
  let vorher = '';
  for (const b of bloecke) {
    // Nummern zählen wie eine Liste in der Lese-Ansicht: aufeinanderfolgende nummerierte Punkte derselben Ebene.
    nr = b.type === 'numberedListItem' && vorher === 'numberedListItem' ? nr + 1 : 1;
    vorher = b.type;
    const t = teilAus(b, einzug, k, nr);
    if (t) aus.push(t);
    if (b.children?.length) aus.push(...teileAus(b.children, einzug + 1, k));
  }
  return aus;
}

// ── Übersicht ────────────────────────────────────────────────────────────────

function uebersichtAus(a: Ableitung, q: ProtokollQuelle): Uebersicht {
  const punkt = (id: string | null): string => {
    const p = a.punkte.find((x) => x.blockId === id);
    return p ? `Punkt ${p.nummer}` : 'vor dem ersten Punkt';
  };
  return {
    beschluesse: a.beschluesse.map((b) => ({ absatz: [{ text: b.text }], punkt: punkt(b.punkt) })),
    aufgaben: a.aufgaben.map((x) => ({
      absatz: [{ text: x.text }, werBis(x, q)],
      punkt: punkt(x.punkt),
    })),
    termine: a.termine.map((t) => ({
      absatz: t.datum ? [fett(tagPunkt(t.datum)), { text: ` – ${t.text}` }] : [{ text: t.text }],
      punkt: punkt(t.punkt),
    })),
    naechste: q.naechste ? wannLang(q.naechste, q.zeitzone) : null,
  };
}

// ── Das Blatt ────────────────────────────────────────────────────────────────

function vermerkAus(q: ProtokollQuelle): { entwurf: boolean; vermerk: Absatz[] } {
  const v = freigabeVermerk(q.kopf);
  const tag = (iso: string) => tagVon(iso, q.zeitzone);
  if (q.kopf?.status === 'frei') {
    const f = v.freigabe;
    return {
      entwurf: false,
      vermerk: [
        [fett(`Freigegeben${f ? ` am ${tag(f.am)}` : ''}${f?.name ? ` von ${f.name}` : ''}`)],
      ],
    };
  }
  return {
    entwurf: true,
    vermerk: [
      [{ text: 'Entwurf – noch nicht freigegeben', stil: 'rot' }],
      ...(v.zurueck ? [[grau(zurueckText(v.zurueck, tag))]] : []),
    ],
  };
}

export function protokollBlatt(q: ProtokollQuelle): ProtokollBlatt {
  const a = ableiten(q.dokument);
  const k: Kontext = { q, punkte: new Map(a.punkte.map((p) => [p.blockId, p])) };
  return {
    titel: q.titel.trim() || 'Sitzung',
    untertitel: `${q.gruppe} · ${wannLang(q.beginn, q.zeitzone)}`,
    gemeinde: q.gemeinde,
    app: 'Protokolle',
    stand: q.stand,
    ...vermerkAus(q),
    teile: teileAus(q.dokument, 0, k),
    uebersicht: uebersichtAus(a, q),
  };
}
